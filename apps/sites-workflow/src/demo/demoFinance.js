import { demoMeta } from './demoReadModel.js';

const currencies = ['TRY', 'USD', 'EUR'];
const sessions = new Map();
let nextSessionId = 700;
let nextMovementId = 900;

const drawers = [{ id: 1, code: 'KASA-ANA', name: 'Ana Kasa', isActive: true }];
const categories = [
  { id: 1, code: 'KARGO', name: 'Kargo', sortOrder: 1 },
  { id: 2, code: 'OFIS', name: 'Ofis gideri', sortOrder: 2 },
  { id: 3, code: 'DIGER', name: 'Diğer', sortOrder: 3 },
];

const amount = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const money = value => amount(value).toFixed(8);
const now = () => new Date().toISOString();

function sessionForDate(date) {
  return sessions.get(String(date || '')) || null;
}

function expectedFor(session, currency) {
  const opening = session.counts[currency].physicalOpening + session.counts[currency].openingTransfer;
  return session.movements
    .filter(row => row.currency === currency)
    .reduce((total, row) => total + (row.direction === 'in' ? row.amountValue : -row.amountValue), opening);
}

function responseFor(date) {
  const entry = sessionForDate(date);
  if (!entry) {
    return { success: true, data: { drawers, categories, session: null, currencies: [], movements: [] }, meta: demoMeta() };
  }

  const running = Object.fromEntries(currencies.map(currency => [currency, entry.counts[currency].physicalOpening]));
  const movements = entry.movements.map(row => {
    running[row.currency] += row.direction === 'in' ? row.amountValue : -row.amountValue;
    return { ...row, amount: money(row.amountValue), runningBalance: money(running[row.currency]) };
  });
  const currencyRows = currencies.map(currency => {
    const count = entry.counts[currency];
    const expected = expectedFor(entry, currency);
    const closing = entry.closingCounts?.[currency];
    return {
      currency,
      physicalOpening: money(count.physicalOpening),
      openingTransfer: money(count.openingTransfer),
      expected: money(expected),
      physicalClosing: closing ? money(closing.physicalClosing) : null,
      difference: closing ? (closing.physicalClosing - expected).toFixed(8) : null,
      carryForward: closing ? money(closing.carryForward) : null,
      transferredToMain: closing ? money(Math.max(0, closing.physicalClosing - closing.carryForward)) : null,
      ledgerBalance: money(expected),
    };
  });

  return {
    success: true,
    data: {
      drawers,
      categories,
      session: {
        id: entry.id,
        drawerId: 1,
        drawerCode: drawers[0].code,
        drawerName: drawers[0].name,
        businessDate: entry.businessDate,
        status: entry.status,
        openingNote: entry.openingNote,
        closingNote: entry.closingNote || '',
        openedAt: entry.openedAt,
        closedAt: entry.closedAt || null,
      },
      currencies: currencyRows,
      movements,
    },
    meta: demoMeta(),
  };
}

export function demoCashRegisterResponse(params = {}) {
  return responseFor(params.businessDate);
}

export function demoOpenCashRegister(payload = {}) {
  const businessDate = String(payload.businessDate || '');
  if (!businessDate) throw Object.assign(new Error('Kasa tarihi zorunludur.'), { code: 'INVALID_DATE' });
  if (sessionForDate(businessDate)) throw Object.assign(new Error('Bu tarih için kasa zaten açılmış.'), { code: 'CASH_SESSION_EXISTS' });
  const counts = Object.fromEntries(currencies.map(currency => [currency, {
    physicalOpening: amount(payload.counts?.[currency]?.physicalOpening),
    openingTransfer: amount(payload.counts?.[currency]?.openingTransfer),
  }]));
  const entry = { id: ++nextSessionId, businessDate, counts, status: 'open', openingNote: String(payload.openingNote || ''), openedAt: now(), movements: [] };
  sessions.set(businessDate, entry);
  return { success: true, data: { sessionId: entry.id, status: entry.status }, meta: demoMeta() };
}

function openSession(id) {
  const entry = [...sessions.values()].find(item => String(item.id) === String(id));
  if (!entry || entry.status !== 'open') throw Object.assign(new Error('Açık demo kasa oturumu bulunamadı.'), { code: 'CASH_SESSION_NOT_OPEN' });
  return entry;
}

function addMovement(entry, row) {
  const movement = {
    id: ++nextMovementId,
    sourceType: row.sourceType,
    typeLabel: row.typeLabel,
    direction: row.direction,
    amountValue: amount(row.amount),
    currency: row.currency,
    documentNo: row.documentNo || '-',
    documentDate: entry.businessDate,
    description: row.description || '',
    categoryName: row.categoryName || '',
    createdAt: now(),
  };
  entry.movements.push(movement);
  return movement;
}

export function demoCreateCashExpense(payload = {}) {
  const entry = openSession(payload.sessionId);
  const category = categories.find(item => String(item.id) === String(payload.categoryId));
  const movement = addMovement(entry, { ...payload, sourceType: 'expense', typeLabel: 'Masraf', direction: 'out', categoryName: category?.name || 'Diğer' });
  return { success: true, data: { id: movement.id }, meta: demoMeta() };
}

export function demoCreateCashTransfer(payload = {}) {
  const entry = openSession(payload.sessionId);
  const incoming = payload.direction === 'main_to_drawer';
  const movement = addMovement(entry, { ...payload, sourceType: 'cash_transfer', typeLabel: incoming ? 'Ana Kasadan Giriş' : 'Ana Kasaya Teslim', direction: incoming ? 'in' : 'out' });
  return { success: true, data: { id: movement.id }, meta: demoMeta() };
}

export function demoCloseCashRegister(payload = {}) {
  const entry = openSession(payload.sessionId);
  entry.closingCounts = Object.fromEntries(currencies.map(currency => [currency, {
    physicalClosing: amount(payload.counts?.[currency]?.physicalClosing),
    carryForward: amount(payload.counts?.[currency]?.carryForward),
  }]));
  entry.status = 'closed';
  entry.closingNote = String(payload.closingNote || '');
  entry.closedAt = now();
  return { success: true, data: { sessionId: entry.id, status: entry.status }, meta: demoMeta() };
}

export function resetDemoFinance() {
  sessions.clear();
}
