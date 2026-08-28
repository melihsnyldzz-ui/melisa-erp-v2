const GTIP = Object.freeze({
  BABY_KNIT_COTTON_OTHER: '611120900000',
  BABY_KNIT_COTTON_GLOVES: '611120100000',
  BABY_KNIT_SYNTHETIC_OTHER: '611130900000',
  BABY_KNIT_SYNTHETIC_GLOVES: '611130100000',
  BABY_WOVEN_COTTON_OTHER: '620920000019',
  BABY_WOVEN_OTHER_TEXTILE: '620990900019',
  COTTON_BLANKET: '630130100000',
  SYNTHETIC_BLANKET_OTHER: '630140900000',
});

const SYNTHETIC_TERMS = ['VELSOFT', 'POLAR', 'POLYESTER', 'SENTETIK', 'AKRILIK', 'PELUŞ', 'PELUS'];
const BLANKET_TERMS = ['BATTANIYE', 'BATTANİYE', 'BLANKET'];
const GLOVE_TERMS = ['ELDIVEN', 'ELDİVEN', 'GLOVE'];
const LINEN_TERMS = ['KETEN', 'LINEN'];
const WOVEN_TERMS = ['DOKUMA', 'WOVEN', 'BORNOZ', 'BATHROBE', 'ELBISE', 'ELBİSE', 'DRESS'];
const KNIT_TERMS = ['TRIKO', 'TRİKO', 'TRIKJO', 'KNIT', 'HIRKA', 'CARDIGAN'];

function normalizeText(value) {
  return String(value || '')
    .toLocaleUpperCase('tr-TR')
    .replaceAll('İ', 'I')
    .replaceAll('Ş', 'S')
    .replaceAll('Ğ', 'G')
    .replaceAll('Ü', 'U')
    .replaceAll('Ö', 'O')
    .replaceAll('Ç', 'C')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(normalizeText(term)));
}

function result({ code, confidence, materialBasis, ruleId, note }) {
  return {
    code,
    status: 'draft',
    confidence,
    materialBasis,
    note,
    source: 'automatic-rule',
    ruleId,
    requiresReview: true,
  };
}

export function classifyProductCustomsDraft(product = {}) {
  const text = normalizeText([
    product.productName,
    product.description,
    product.category,
    product.brand,
    product.materialBasis,
  ].filter(Boolean).join(' '));

  const isSynthetic = includesAny(text, SYNTHETIC_TERMS);
  const isBlanket = includesAny(text, BLANKET_TERMS);
  const isGlove = includesAny(text, GLOVE_TERMS);
  const isLinen = includesAny(text, LINEN_TERMS);
  const isKnit = includesAny(text, KNIT_TERMS);
  const isWoven = includesAny(text, WOVEN_TERMS);

  if (isBlanket) {
    return result({
      code: isSynthetic ? GTIP.SYNTHETIC_BLANKET_OTHER : GTIP.COTTON_BLANKET,
      confidence: 'medium',
      materialBasis: isSynthetic ? 'Ürün adında sentetik/velsoft işareti' : 'Battaniye; pamuk varsayımı',
      ruleId: isSynthetic ? 'blanket-synthetic' : 'blanket-cotton-default',
      note: 'Battaniye malzemesi ürün etiketiyle doğrulanmalıdır.',
    });
  }

  if (isGlove) {
    return result({
      code: isSynthetic ? GTIP.BABY_KNIT_SYNTHETIC_GLOVES : GTIP.BABY_KNIT_COTTON_GLOVES,
      confidence: 'medium',
      materialBasis: isSynthetic ? 'Sentetik bebek eldiveni' : 'Pamuk varsayımlı bebek eldiveni',
      ruleId: isSynthetic ? 'baby-glove-synthetic' : 'baby-glove-cotton-default',
      note: 'Malzeme ve bebek ölçü sınıfı ürün etiketiyle doğrulanmalıdır.',
    });
  }

  if (isSynthetic) {
    return result({
      code: GTIP.BABY_KNIT_SYNTHETIC_OTHER,
      confidence: 'medium',
      materialBasis: 'Ürün adında velsoft, polar, polyester, sentetik veya eşdeğer işaret',
      ruleId: 'baby-knit-synthetic-explicit',
      note: 'Örme/dokuma yapısı ve bebek ölçü sınıfı sevk öncesinde doğrulanmalıdır.',
    });
  }

  if (isLinen) {
    return result({
      code: GTIP.BABY_WOVEN_OTHER_TEXTILE,
      confidence: 'medium',
      materialBasis: 'Ürün adında keten/linen işareti',
      ruleId: 'baby-woven-linen-explicit',
      note: 'Keten oranı, dokuma yapısı ve bebek ölçü sınıfı etiketten doğrulanmalıdır.',
    });
  }

  if (isKnit) {
    return result({
      code: GTIP.BABY_KNIT_COTTON_OTHER,
      confidence: 'medium',
      materialBasis: 'Ürün adında triko/örme işareti; pamuk varsayımı',
      ruleId: 'baby-knit-cotton-explicit',
      note: 'Pamuk oranı ve bebek ölçü sınıfı ürün etiketiyle doğrulanmalıdır.',
    });
  }

  if (isWoven) {
    return result({
      code: GTIP.BABY_WOVEN_COTTON_OTHER,
      confidence: 'low',
      materialBasis: 'Elbise/bornoz/dokuma ürün; pamuk varsayımı',
      ruleId: 'baby-woven-cotton-default',
      note: 'Dokuma yapısı, pamuk oranı ve bebek ölçü sınıfı ürün etiketiyle doğrulanmalıdır.',
    });
  }

  return result({
    code: GTIP.BABY_KNIT_COTTON_OTHER,
    confidence: 'low',
    materialBasis: 'Açık malzeme işareti yok; Melisa ERP pamuk varsayımı',
    ruleId: 'baby-knit-cotton-fallback',
    note: 'Otomatik varsayımdır. Ürün türü, malzeme, örme/dokuma yapısı ve bebek ölçü sınıfı doğrulanmalıdır.',
  });
}

export { GTIP };
