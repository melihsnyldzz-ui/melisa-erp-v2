import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAutoOpenTestAdmin } from './testAdminSession.mjs';
const context = { location: { hostname: '127.0.0.1', protocol: 'http:', port: '5194' }, apiBase: 'http://127.0.0.1:4144', mode: null };
test('fresh TEST session opens admin; manual role acceptance survives reload', () => {
  assert.equal(shouldAutoOpenTestAdmin(context), true);
  assert.equal(shouldAutoOpenTestAdmin({ ...context, mode: 'admin' }), true);
  assert.equal(shouldAutoOpenTestAdmin({ ...context, mode: 'manual' }), false);
});
test('LIVE, remote UI and non-TEST API never auto-open admin', () => {
  for (const change of [{ port: '5188' }, { hostname: '192.168.1.46' }, { protocol: 'https:' }])
    assert.equal(shouldAutoOpenTestAdmin({ ...context, location: { ...context.location, ...change } }), false);
  assert.equal(shouldAutoOpenTestAdmin({ ...context, apiBase: 'http://127.0.0.1:4114' }), false);
});
