// Positional transport schema from App_Web_uashzoja / srvclasses BindPiped.
// This module has no network or database access and grants no sale authority.
export const ARMADA_HEADER_FIELDS = Object.freeze([
  'Id', 'Cari', 'BelgeNo', 'BelgeKod', 'Tarih', 'BelgeTutar', 'AraToplam',
  'BelgeKDV', 'NetToplam', 'BelgeTip', 'IskontoTop', 'AIsk1', 'AIsk2', 'AIsk3',
  'AIsk4', 'Vade', 'Termin', 'Parabirimi', 'Kur', 'VgFatInd', 'Terminal',
  'Aktarim', 'Kapali', 'BelgeNot', 'PesinAd', 'PesinVergiNo', 'OzelKod',
  'Depo', 'CariExtId', 'KayitTarihi', 'CikanDepo', 'UID', 'OzelKod9',
  'Personel', 'Depozitolu', 'OtvToplam', 'OdemeTutar', 'SonBakiye', 'Locked',
  'AltBelgeNo', 'AltBelgeTarihi', 'FirmaNo',
]);

export const ARMADA_LINE_FIELDS = Object.freeze([
  'Id', 'Stok', 'Barcode', 'Miktar', 'Fiyat', 'Tutar', 'Isk1', 'Isk2', 'Isk3',
  'Isk4', 'AltIskonto', 'IskToplam', 'SatirToplam', 'VgFatHarInd', 'KDV',
  'KDVTutar', 'StokExtId', 'SatirSayisi', 'Parabirimi', 'Kur', 'Aciklama',
  'RBMiktar', 'MiktarBos', 'Kampanya', 'Otv', 'OtvTutar', 'Belge',
]);

function invalid(code) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function field(value) {
  // Preserve decimal/date/currency text exactly. Business validation belongs
  // to the authenticated adapter; never silently insert a default or coerce.
  if (typeof value !== 'string' || value.length > 4096
    || /[|\u0000-\u001f\u007f\ufffd]/u.test(value)
    || Buffer.from(value, 'utf8').toString('utf8') !== value) {
    throw invalid('ARMADA_FIELD_INVALID');
  }
  return value;
}

function values(record, schema) {
  if (!record || Object.getPrototypeOf(record) !== Object.prototype
    || Object.keys(record).length !== schema.length
    || !schema.every((key) => Object.hasOwn(record, key))) {
    throw invalid('ARMADA_FIELD_SET_MISMATCH');
  }
  return schema.map((key) => field(record[key]));
}

function parseRow(row, schema) {
  let parts = row.split('|');
  // An extra trailing separator is framing, not another business field.
  if (parts.length === schema.length + 1 && parts.at(-1) === '') parts = parts.slice(0, -1);
  if (parts.length !== schema.length) throw invalid('ARMADA_FIELD_COUNT_MISMATCH');
  return Object.fromEntries(schema.map((key, index) => [key, field(parts[index])]));
}

export function parseArmadaDocument(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 1024 * 1024) {
    throw invalid('ARMADA_DOCUMENT_INVALID');
  }
  const rows = text.replaceAll('\r\n', '\n').split('\n');
  if (rows.at(-1) === '') rows.pop();
  if (rows.length < 2 || rows.length > 501) throw invalid('ARMADA_LINE_COUNT_INVALID');
  return {
    header: parseRow(rows[0], ARMADA_HEADER_FIELDS),
    lines: rows.slice(1).map((row) => parseRow(row, ARMADA_LINE_FIELDS)),
  };
}

export function serializeArmadaDocument({ header, lines }) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 500) throw invalid('ARMADA_LINE_COUNT_INVALID');
  const text = [values(header, ARMADA_HEADER_FIELDS).join('|') + '|',
    ...lines.map((line) => values(line, ARMADA_LINE_FIELDS).join('|'))].join('\n');
  if (Buffer.byteLength(text, 'utf8') > 1024 * 1024) throw invalid('ARMADA_DOCUMENT_INVALID');
  return text;
}

export function encodeArmadaForm({ userId, document }) {
  // userId is the verified Armada HTTP user parameter, NOT header.Terminal,
  // the Melisa user ID, Vega PERSONEL, or the observed UI label.
  if (typeof userId !== 'string' || !/^[1-9]\d{0,8}$/.test(userId)) throw invalid('ARMADA_HTTP_USER_REQUIRED');
  const content = Buffer.from(serializeArmadaDocument(document), 'utf8').toString('base64');
  // ASP.NET decodes Request.Form, then the page explicitly calls UrlDecode.
  // Escape Base64 before form encoding so '+' survives both decode stages.
  return new URLSearchParams({ user: userId, cnt: encodeURIComponent(content) }).toString();
}
