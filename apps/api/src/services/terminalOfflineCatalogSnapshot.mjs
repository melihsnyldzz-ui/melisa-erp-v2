import { createHmac, timingSafeEqual } from 'node:crypto';

const domain = 'melisa-terminal-offline-catalog-v1\n';
const kinds = new Set(['product', 'customer', 'context']);
const fail = (code = 'TERMINAL_OFFLINE_SNAPSHOT_INVALID') => {
  throw Object.assign(new Error('Cihazdaki satış verisi doğrulanamadı. Verileri güncelleyin.'), { code, statusCode: 409 });
};
function key(profile) {
  if (!/^[a-f0-9]{64}$/.test(profile?.rateSigningKey || '')) fail('TERMINAL_OFFLINE_KEY_REQUIRED');
  return Buffer.from(profile.rateSigningKey, 'hex');
}
function canonical(value, depth = 0) {
  if (depth > 12) fail();
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map((v) => canonical(v, depth + 1)).join(',') + ']';
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map((name) => {
      if (['__proto__', 'constructor', 'prototype'].includes(name)) fail();
      return JSON.stringify(name) + ':' + canonical(value[name], depth + 1);
    }).join(',') + '}';
  }
  fail();
}
function envelope(snapshot, kind) {
  if (!kinds.has(kind) || snapshot?.version !== 1 || snapshot.kind !== kind
    || snapshot.company !== 'F0102' || snapshot.period !== 'D0007'
    || !snapshot.data || Object.getPrototypeOf(snapshot.data) !== Object.prototype
    || typeof snapshot.issuedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.issuedAt))
    || new Date(snapshot.issuedAt).toISOString() !== snapshot.issuedAt
    || Date.parse(snapshot.issuedAt) > Date.now() + 300000) fail();
  const result = { version: 1, kind, company: 'F0102', period: 'D0007', issuedAt: snapshot.issuedAt, data: snapshot.data };
  if (Buffer.byteLength(canonical(result), 'utf8') > 32768) fail();
  return result;
}
const sign = (snapshot, secret) => createHmac('sha256', secret).update(domain + canonical(snapshot)).digest('hex');

// Business snapshots carry no authentication credentials. They deliberately do
// not expire: a saved offline document retains the cards and rate it used.
// Current user permissions and configured terminal mapping are checked on send.
export function issueOfflineCatalogSnapshot(kind, data, profile, { issuedAt = new Date().toISOString() } = {}) {
  const value = envelope({ version: 1, kind, company: 'F0102', period: 'D0007', issuedAt, data }, kind);
  return structuredClone({ ...value, signature: sign(value, key(profile)) });
}

export function verifyOfflineCatalogSnapshot(snapshot, kind, profile) {
  const value = envelope(snapshot, kind);
  const expected = sign(value, key(profile));
  if (!/^[a-f0-9]{64}$/.test(snapshot.signature || '')
    || !timingSafeEqual(Buffer.from(snapshot.signature, 'hex'), Buffer.from(expected, 'hex'))) {
    fail('TERMINAL_OFFLINE_SNAPSHOT_UNTRUSTED');
  }
  return structuredClone(value.data);
}
