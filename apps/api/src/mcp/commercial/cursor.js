import crypto from 'node:crypto';
import { fail } from './policy.js';

export function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function key() {
  const token = process.env.MCP_READ_ONLY_TOKEN;
  if (!token || token.length < 32) throw fail('CURSOR_KEY_NOT_CONFIGURED');
  return crypto.createHash('sha256').update('melisa-commercial-cursor-v1\0' + token).digest();
}

export function sealCursor(binding, position) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from('commercial-mcp-v1'));
  const body = Buffer.from(JSON.stringify({ binding, position, expires: Date.now() + 900000 }));
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function openCursor(value, binding) {
  try {
    if (typeof value !== 'string' || value.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const raw = Buffer.from(value, 'base64url');
    if (raw.length < 30 || raw.toString('base64url') !== value) throw new Error();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from('commercial-mcp-v1'));
    decipher.setAuthTag(raw.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
    if (data.binding !== binding || !Number.isFinite(data.expires) || data.expires < Date.now()) throw new Error();
    return data.position;
  } catch { throw fail('INVALID_OR_EXPIRED_CURSOR'); }
}
