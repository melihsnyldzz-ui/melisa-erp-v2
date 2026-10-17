// Actual auth service; SQL, credentials and time are synthetic. No live DB is imported.
import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
let state;
const fixtureUser = { id: 8, username: 'fixture.operator', display_name: 'Fixture', role_id: 2, role_code: 'terminal_user', role_name: 'Terminal', is_active: true, password_hash: 'synthetic-only' };
const env = { sql: { readOnly: false }, auth: { jwtSecret: randomBytes(32).toString('hex'), refreshSecret: randomBytes(32).toString('hex'), accessExpiresIn: '15m', refreshExpiresIn: '7d' } };
class Request {
  args = {};
  input(key, _type, value) { this.args[key] = value; return this; }
  async query(q) {
    const a = this.args;
    if (q.includes('AS is_ready')) return { recordset: [{ is_ready: 1 }] };
    if (q.includes('FROM dbo.terminal_devices')) return { recordset: [{ device_code: a.terminalCode, device_name: 'Fixture TC21', is_active: state.deviceActive }] };
    if (q.includes('INNER JOIN dbo.employees')) return { recordset: state.personnelActive ? [fixtureUser] : [] };
    if (q.includes('FROM dbo.permissions')) return { recordset: [] };
    if (q.includes('FROM dbo.users u')) return { recordset: [{ ...fixtureUser, is_active: state.userActive }] };
    if (q.includes('INSERT INTO dbo.auth_refresh_tokens')) {
      state.tokens.set(a.refreshTokenHash, { user_id: a.loginUserId, user_agent: a.userAgent, expires_at: a.refreshExpiresAt, revoked: false });
      return { rowsAffected: [1] };
    }
    if (q.includes('SET revoked_at')) {
      const row = state.tokens.get(a.refreshTokenHashForLogout);
      if (row) row.revoked = true;
      return { rowsAffected: [row ? 1 : 0] };
    }
    if (q.includes('FROM dbo.auth_refresh_tokens')) {
      assert.match(q, /revoked_at IS NULL/); assert.match(q, /expires_at > SYSUTCDATETIME/);
      const row = state.tokens.get(a.refreshTokenHashForRefresh);
      return { recordset: row && !row.revoked && row.expires_at > state.now ? [row] : [] };
    }
    throw Error('Unexpected mock SQL');
  }
}
mock.module('mssql', { defaultExport: { NVarChar: () => 0, BigInt: 0, DateTime2: 0 } });
mock.module('bcrypt', { defaultExport: { compare: async p => p === 'fixture-password' } });
mock.module('../config/env.js', { namedExports: { env } });
mock.module('../config/database.js', { namedExports: { getSqlPool: async () => ({ request: () => new Request() }) } });
mock.module('./writeGuardService.js', { namedExports: { assertMelisaWriteEnabled() { assert.equal(env.sql.readOnly, false); } } });
const { login, terminalLogin, refreshAccessToken, logout, verifyAccessToken } = await import('./authService.js');
const credentials = { username: fixtureUser.username, password: 'fixture-password', terminalCode: 'TEST-TC21' };
const native = { nativeTerminal: true, terminalCode: credentials.terminalCode };
const rowFor = s => state.tokens.get(createHash('sha256').update(s.refreshToken).digest('hex'));
beforeEach(() => { state = { tokens: new Map(), deviceActive: true, personnelActive: true, userActive: true, now: new Date() }; env.sql.readOnly = false; });

test('native personnel session survives long inactivity with short access JWTs and no stored password', async () => {
  const session = await terminalLogin(credentials, 'fixture', native);
  assert.equal(verifyAccessToken(session.accessToken).nativeTerminalCode, credentials.terminalCode);
  assert.equal(rowFor(session).expires_at.getUTCFullYear(), 9999);
  assert.notEqual([...state.tokens.keys()][0], session.refreshToken);
  assert.equal(JSON.stringify([...state.tokens.values()]).includes(credentials.password), false);
  state.now = new Date('2040-01-01');
  for (let i = 0; i < 2; i++) {
    const renewed = await refreshAccessToken(session.refreshToken, native);
    assert.equal(renewed.user.id, 8);
    const jwt = verifyAccessToken(renewed.accessToken);
    assert.equal(jwt.nativeTerminalCode, credentials.terminalCode);
    assert.equal(jwt.exp - jwt.iat, 900);
  }
});
test('ordinary web and pilot login keep seven-day expiry; body and user-agent cannot opt in', async () => {
  const session = await login({ ...credentials, nativeTerminal: true }, 'melisa-native-v1:forged');
  assert.equal(verifyAccessToken(session.accessToken).nativeTerminalCode, undefined);
  assert.ok(rowFor(session).expires_at < new Date(Date.now() + 8 * 86400000));
  assert.ok(rowFor(session).user_agent.startsWith('client:'));
  const pilot = await terminalLogin({ ...credentials, nativeTerminal: true });
  assert.ok(rowFor(pilot).expires_at < new Date(Date.now() + 8 * 86400000));
  state.now = new Date(Date.now() + 8 * 86400000);
  await assert.rejects(refreshAccessToken(session.refreshToken), { code: 'AUTH_REFRESH_INVALID' });
});
test('native refresh is restricted to its registered terminal and dedicated server', async () => {
  const session = await terminalLogin(credentials, '', native);
  await assert.rejects(refreshAccessToken(session.refreshToken), { code: 'AUTH_REFRESH_INVALID' });
  await assert.rejects(refreshAccessToken(session.refreshToken, { ...native, terminalCode: 'OTHER' }), { code: 'AUTH_REFRESH_INVALID' });
});
test('logout revokes persistent token and repeated logout cannot revive it', async () => {
  const session = await terminalLogin(credentials, '', native);
  await logout(session.refreshToken); await logout(session.refreshToken);
  await assert.rejects(refreshAccessToken(session.refreshToken, native), { code: 'AUTH_REFRESH_INVALID' });
});
test('disabled terminal blocks persistent renewal', async () => {
  const session = await terminalLogin(credentials, '', native); state.deviceActive = false;
  await assert.rejects(refreshAccessToken(session.refreshToken, native), { code: 'AUTH_REFRESH_INVALID' });
});
test('removed personnel blocks persistent renewal', async () => {
  const session = await terminalLogin(credentials, '', native); state.personnelActive = false;
  await assert.rejects(refreshAccessToken(session.refreshToken, native), { code: 'AUTH_REFRESH_INVALID' });
});
test('inactive ERP user blocks persistent renewal', async () => {
  const session = await terminalLogin(credentials, '', native); state.userActive = false;
  await assert.rejects(refreshAccessToken(session.refreshToken, native), { code: 'AUTH_USER_INACTIVE' });
});
test('wrong password cannot create a persistent session', async () => {
  await assert.rejects(terminalLogin({ ...credentials, password: 'wrong' }, '', native), { code: 'AUTH_INVALID_CREDENTIALS' });
  assert.equal(state.tokens.size, 0);
});
test('read-only mode cannot create persistent token records', async () => {
  env.sql.readOnly = true;
  const session = await terminalLogin(credentials, '', native);
  assert.equal(session.refreshToken, null); assert.equal(state.tokens.size, 0);
});
