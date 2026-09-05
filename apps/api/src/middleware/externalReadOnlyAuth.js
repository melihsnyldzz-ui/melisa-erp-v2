import crypto from 'node:crypto';
import { env } from '../config/env.js';

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function requireExternalReadOnly(req, res, next) {
  if (!env.externalReadOnly.enabled) {
    return res.status(503).json({
      success: false,
      error: { code: 'EXTERNAL_READ_ONLY_DISABLED', message: 'External read-only gateway is disabled' },
    });
  }

  const provided = req.get('x-melisa-read-key');
  if (!provided || !secureEqual(provided, env.externalReadOnly.apiKey)) {
    return res.status(401).json({
      success: false,
      error: { code: 'EXTERNAL_READ_ONLY_UNAUTHORIZED', message: 'Invalid read-only gateway key' },
    });
  }

  return next();
}
