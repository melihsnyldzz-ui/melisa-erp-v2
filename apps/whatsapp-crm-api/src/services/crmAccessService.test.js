import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { env } from '../config/env.js';
import { unlockCrmAccess, verifyCrmAccessToken } from './crmAccessService.js';

function makeHash(password, salt = 'test-salt') {
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

test('CRM password issues a user-bound unlock token', () => {
  const originalEnabled = env.crmAccess.enabled;
  const originalHash = env.crmAccess.passwordHash;
  const originalSecret = env.auth.jwtSecret;
  env.crmAccess.enabled = true;
  env.crmAccess.passwordHash = makeHash('correct-password');
  env.auth.jwtSecret = 'test-secret-that-is-long-enough';

  try {
    const result = unlockCrmAccess({ password: 'correct-password', user: { id: 7, username: 'admin' } });
    const payload = verifyCrmAccessToken(result.unlockToken, { id: 7 });
    assert.equal(payload.scope, 'crm.unlock');
    assert.throws(
      () => verifyCrmAccessToken(result.unlockToken, { id: 8 }),
      (error) => error.code === 'WHATSAPP_CRM_ACCESS_TOKEN_INVALID',
    );
  } finally {
    env.crmAccess.enabled = originalEnabled;
    env.crmAccess.passwordHash = originalHash;
    env.auth.jwtSecret = originalSecret;
  }
});

test('CRM password fails closed when the password is wrong', () => {
  const originalEnabled = env.crmAccess.enabled;
  const originalHash = env.crmAccess.passwordHash;
  env.crmAccess.enabled = true;
  env.crmAccess.passwordHash = makeHash('correct-password');
  try {
    assert.throws(
      () => unlockCrmAccess({ password: 'wrong-password', user: { id: 7 } }),
      (error) => error.code === 'WHATSAPP_CRM_ACCESS_DENIED' && error.statusCode === 403,
    );
  } finally {
    env.crmAccess.enabled = originalEnabled;
    env.crmAccess.passwordHash = originalHash;
  }
});

test('CRM uses the authenticated ERP session when the secondary lock is disabled', () => {
  const originalEnabled = env.crmAccess.enabled;
  env.crmAccess.enabled = false;

  try {
    const payload = verifyCrmAccessToken('', { id: 7, username: 'admin' });
    assert.equal(payload.scope, 'crm.erp-session');
    assert.equal(payload.sub, '7');
  } finally {
    env.crmAccess.enabled = originalEnabled;
  }
});
