import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

function accessError(code, message, statusCode = 403) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function parsePasswordHash(value = '') {
  const [algorithm, salt, digest] = String(value).split('$');
  if (algorithm !== 'scrypt' || !salt || !digest) return null;
  return { salt, digest };
}

export function verifyCrmAccessPassword(password) {
  const stored = parsePasswordHash(env.crmAccess.passwordHash);
  if (!stored || typeof password !== 'string' || password.length < 1) return false;

  const expected = Buffer.from(stored.digest, 'hex');
  const actual = crypto.scryptSync(password, stored.salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function issueCrmAccessToken(user) {
  if (!env.auth.jwtSecret) {
    throw accessError('WHATSAPP_CRM_AUTH_SECRET_MISSING', 'CRM auth secret is not configured', 503);
  }

  return jwt.sign(
    { scope: 'crm.unlock', username: user?.username || '' },
    env.auth.jwtSecret,
    {
      subject: String(user?.id || ''),
      audience: 'melisa-whatsapp-crm',
      issuer: env.appName,
      expiresIn: env.crmAccess.tokenExpiresIn,
    },
  );
}

export function unlockCrmAccess({ password, user }) {
  if (!env.crmAccess.enabled) {
    return {
      unlockToken: issueCrmAccessToken(user),
      expiresIn: env.crmAccess.tokenExpiresIn,
      secondaryLockEnabled: false,
    };
  }

  if (!env.crmAccess.passwordHash) {
    throw accessError('WHATSAPP_CRM_ACCESS_NOT_CONFIGURED', 'CRM ikinci sifresi yapilandirilmamis.', 503);
  }

  if (!verifyCrmAccessPassword(password)) {
    throw accessError('WHATSAPP_CRM_ACCESS_DENIED', 'CRM sifresi hatali.', 403);
  }

  return {
    unlockToken: issueCrmAccessToken(user),
    expiresIn: env.crmAccess.tokenExpiresIn,
  };
}

export function verifyCrmAccessToken(token, user) {
  if (!env.crmAccess.enabled) {
    return {
      scope: 'crm.erp-session',
      sub: String(user?.id || ''),
    };
  }

  if (!token) {
    throw accessError('WHATSAPP_CRM_ACCESS_LOCKED', 'CRM sifresiyle kilidi acmaniz gerekiyor.', 423);
  }

  try {
    const payload = jwt.verify(token, env.auth.jwtSecret, {
      audience: 'melisa-whatsapp-crm',
      issuer: env.appName,
    });

    if (payload.scope !== 'crm.unlock' || String(payload.sub) !== String(user?.id || '')) {
      throw accessError('WHATSAPP_CRM_ACCESS_TOKEN_INVALID', 'CRM kilit anahtari bu kullaniciya ait degil.', 423);
    }

    return payload;
  } catch (error) {
    if (error.code?.startsWith('WHATSAPP_CRM_')) throw error;
    throw accessError('WHATSAPP_CRM_ACCESS_TOKEN_INVALID', 'CRM kilidi suresi dolmus; sifreyi tekrar girin.', 423);
  }
}
