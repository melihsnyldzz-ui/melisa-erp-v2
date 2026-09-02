import crypto from 'node:crypto';
import { env } from '../config/env.js';

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function requireBionicReadOnly(req, res, next) {
  if (!env.bionicReadOnly.enabled) {
    return res.status(503).json({
      success: false,
      error: { code: 'BIONIC_READ_ONLY_DISABLED', message: 'Bionic read-only integration is disabled' },
    });
  }

  const provided = req.get('x-bionic-read-key');
  if (!provided || !secureEqual(provided, env.bionicReadOnly.apiKey)) {
    return res.status(401).json({
      success: false,
      error: { code: 'BIONIC_READ_ONLY_UNAUTHORIZED', message: 'Invalid Bionic read-only key' },
    });
  }

  return next();
}
