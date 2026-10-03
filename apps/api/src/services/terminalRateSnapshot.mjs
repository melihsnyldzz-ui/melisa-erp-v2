import { createHmac, timingSafeEqual } from 'node:crypto';

const currencies = ['TRY', 'USD', 'EUR'];
const company = 'F0102', period = 'D0007', source = 'sql-currency-rates';
const invalid = (code, message, statusCode = 400) => {
  throw Object.assign(new Error(message), { code, statusCode });
};
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function keyBytes(profile) {
  if (!/^[a-f0-9]{64}$/.test(profile?.rateSigningKey || '')) {
    invalid('TERMINAL_RATE_SNAPSHOT_KEY_REQUIRED', 'Terminal kur doğrulama anahtarı yapılandırılmadı.', 503);
  }
  return Buffer.from(profile.rateSigningKey, 'hex');
}
function decimal(value) {
  if (!['string', 'number'].includes(typeof value) || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,8})?$/.test(String(value))) {
    invalid('TERMINAL_RATE_SNAPSHOT_INVALID', 'Kur kaydının tutarı geçerli değil. Kurları yenileyin.');
  }
  const [whole, fraction = ''] = String(value).split('.');
  const amount = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
  if (amount <= 0n) invalid('TERMINAL_RATE_SNAPSHOT_INVALID', 'Kur sıfırdan büyük olmalı. Kurları yenileyin.');
  const tail = String(amount % 100000000n).padStart(8, '0').replace(/0+$/, '');
  return `${amount / 100000000n}${tail ? '.' + tail : ''}`;
}
function rateDate(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    invalid('TERMINAL_RATE_SNAPSHOT_INVALID', 'Kur kaydının tarihi geçerli değil. Kurları yenileyin.');
  }
  return value;
}
function text(value) {
  if (typeof value !== 'string' || !value.length || value.length > 80 || /[\x00-\x1f\x7f]/.test(value)) {
    invalid('TERMINAL_RATE_SNAPSHOT_INVALID', 'Kur kaydının kaynağı geçerli değil. Kurları yenileyin.');
  }
  return value;
}
function canonicalRates(rows) {
  if (!Array.isArray(rows) || rows.length !== currencies.length
    || new Set(rows.map((row) => row?.currency)).size !== currencies.length) {
    invalid('TERMINAL_RATE_SNAPSHOT_INVALID', 'Kur kaydı eksik veya yinelenmiş. Kurları yenileyin.');
  }
  return currencies.map((currency) => {
    const row = rows.find((item) => item?.currency === currency);
    if (!plain(row) || typeof row.defined !== 'boolean' || (currency === 'TRY' && row.defined !== true)) {
      invalid('TERMINAL_RATE_SNAPSHOT_INVALID', 'Kur kaydı doğrulanamadı. Kurları yenileyin.');
    }
    const rateToTry = row.defined ? decimal(row.rateToTry) : null;
    if (currency === 'TRY' && rateToTry !== '1') invalid('TERMINAL_RATE_SNAPSHOT_INVALID', 'TL kuru 1 olmalı.');
    return { currency, rateToTry, rateDate: rateDate(row.rateDate), source: text(row.source), defined: row.defined };
  });
}
function canonicalSnapshot(snapshot) {
  if (!plain(snapshot) || snapshot.version !== 1 || snapshot.company !== company || snapshot.period !== period
    || snapshot.source !== source || typeof snapshot.issuedAt !== 'string'
    || !Number.isFinite(Date.parse(snapshot.issuedAt)) || new Date(snapshot.issuedAt).toISOString() !== snapshot.issuedAt) {
    invalid('TERMINAL_RATE_SNAPSHOT_INVALID', 'Kur kaydı doğrulanamadı. Kurları yenileyin.');
  }
  return { version: 1, company, period, source, issuedAt: snapshot.issuedAt, rates: canonicalRates(snapshot.rates) };
}
const sign = (snapshot, key) => createHmac('sha256', key).update(JSON.stringify(snapshot)).digest('hex');

// This proof is business data, never an authentication token. There is no automatic
// expiry: an existing draft must retain its transaction-time rates after a rate edit.
export function issueTerminalRateSnapshot({ rateSet, profile, issuedAt = new Date().toISOString() }) {
  const key = keyBytes(profile);
  const rows = rateSet?.rates;
  if (!Array.isArray(rows)) invalid('TERMINAL_RATE_SNAPSHOT_INVALID', 'Kur kaydı okunamadı.');
  const rates = rows.map((row) => ({ ...row, rateDate: row?.rateDate ?? null }));
  const snapshot = canonicalSnapshot({ version: 1, company, period, source, issuedAt, rates });
  return { ...snapshot, signature: sign(snapshot, key) };
}

export function verifyTerminalRateSnapshot({ snapshot, profile, currency, exchangeRate, company: requestedCompany, period: requestedPeriod }) {
  const key = keyBytes(profile);
  if (!plain(snapshot)) invalid('TERMINAL_RATE_SNAPSHOT_REQUIRED', 'Fişin doğrulanmış kur kaydı yok. Kurları yenileyip fişi kontrol edin.');
  const canonical = canonicalSnapshot(snapshot);
  if (snapshot.rates.some((row) => row.rateToTry !== canonical.rates.find((item) => item.currency === row.currency)?.rateToTry)) {
    invalid('TERMINAL_RATE_SNAPSHOT_INVALID', 'Kur kaydının tutarı değiştirilmiş. Kurları yenileyin.');
  }
  const expected = sign(canonical, key);
  if (!/^[a-f0-9]{64}$/.test(snapshot.signature || '')
    || !timingSafeEqual(Buffer.from(snapshot.signature, 'hex'), Buffer.from(expected, 'hex'))) {
    invalid('TERMINAL_RATE_SNAPSHOT_UNTRUSTED', 'Fişin kur kaydı doğrulanamadı. Kurları yenileyin.');
  }
  if (requestedCompany !== company || requestedPeriod !== period) {
    invalid('TERMINAL_RATE_SNAPSHOT_CONTEXT_MISMATCH', 'Fiş ile kur kaydının firma veya dönemi farklı.');
  }
  const normalizedCurrency = ({ TL: 'TRY', TRY: 'TRY', USD: 'USD', '$': 'USD', EUR: 'EUR', '€': 'EUR' })[currency];
  const row = canonical.rates.find((item) => item.currency === normalizedCurrency);
  if (!row?.defined || decimal(exchangeRate) !== row.rateToTry) {
    invalid('TERMINAL_RATE_SNAPSHOT_AMOUNT_MISMATCH', 'Fiş kuru sunucudan alınan kur kaydıyla aynı değil. Kurları kontrol edin.');
  }
  return {
    rates: Object.fromEntries(canonical.rates.filter((item) => item.defined).map((item) => [item.currency, item.rateToTry])),
    row,
    snapshot: { ...canonical, signature: expected },
  };
}
