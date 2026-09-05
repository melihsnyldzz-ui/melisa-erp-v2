import crypto from 'node:crypto';

function enabled() {
  return String(process.env.EXTERNAL_READ_ONLY_ENABLED || 'false').toLowerCase() === 'true';
}

function configuredKey() {
  return process.env.EXTERNAL_READ_ONLY_API_KEY || '';
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function requireExternalReadOnly(req, res, next) {
  if (!enabled()) {
    return res.status(503).json({
      success: false,
      error: { code: 'EXTERNAL_READ_ONLY_DISABLED', message: 'External read-only gateway is disabled' },
    });
  }

  const key = configuredKey();
  const provided = req.get('x-melisa-read-key');
  if (!key || !provided || !secureEqual(provided, key)) {
    return res.status(401).json({
      success: false,
      error: { code: 'EXTERNAL_READ_ONLY_UNAUTHORIZED', message: 'Invalid read-only gateway key' },
    });
  }

  return next();
}
