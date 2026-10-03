import { paymentMethodLabel } from './collectionsFormatters.js';

function identity(value, field) {
  const text = String(value ?? '');
  const number = Number(text);
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(number)) throw new Error(`Makbuz bağlantısındaki ${field} geçersiz.`);
  return number;
}

export function linkedReceiptQuery(payload = {}) {
  if (!['collection', 'payment'].includes(payload.mode)) throw new Error('Makbuzun işlem türü geçersiz.');
  const supplier = payload.mode === 'payment';
  const partyId = payload[supplier ? 'supplierId' : 'customerId'];
  return {
    movementId: identity(payload.movementId, 'hareket kimliği'),
    movementType: payload.mode,
    partyType: supplier ? 'supplier' : 'customer',
    ...(partyId == null || partyId === '' ? {} : { partyId: identity(partyId, 'cari kimliği') }),
    limit: 2,
  };
}

export function readLinkedReceipt(response, query) {
  if (response?.success !== true || !Array.isArray(response.data)) throw new Error('Makbuz kaydı okunamadı.');
  if (!response.data.length) throw new Error('Bu cariye ve işlem türüne ait makbuz bulunamadı.');
  if (response.data.length !== 1) throw new Error('Makbuz bağlantısı tek bir kayıtla doğrulanamadı.');
  const row = response.data[0];
  const partyId = identity(row.partyId ?? row[row.partyType === 'supplier' ? 'supplierId' : 'customerId'], 'cari kimliği');
  if (identity(row.id, 'hareket kimliği') !== query.movementId || row.partyType !== query.partyType || row.movementType !== query.movementType
    || (query.partyId != null && partyId !== query.partyId)) throw new Error('Gelen makbuz seçilen hareketle eşleşmiyor.');
  return { ...row, partyId };
}

export function receiptFromMovement(row) {
  if (!['collection', 'payment'].includes(row?.movementType)) return null;
  const payment = row.movementType === 'payment';
  return {
    receiptNo: row.documentNo || `${payment ? 'OD' : 'TH'}-${row.id}`,
    type: payment ? 'Ödeme Makbuzu' : 'Tahsilat Makbuzu',
    partyType: row.partyType, partyCode: row.partyCode, partyName: row.partyName,
    documentDate: row.documentDate, amount: row.amount, currency: row.currency,
    accountCurrency: row.accountCurrency, accountAmount: row.accountAmount,
    exchangeRate: row.exchangeRate, accountExchangeRate: row.accountExchangeRate,
    amountTry: row.amountTry, settlementKnown: row.settlementKnown,
    paymentMethod: paymentMethodLabel(row.paymentMethod),
    accountLabel: row.accountCode ? `${row.accountCode} / ${row.accountName || '-'}` : 'Hesap atanmamış',
    balanceEffect: row.balanceEffect, source: 'Kayıtlı hareket', description: row.description || '',
  };
}
