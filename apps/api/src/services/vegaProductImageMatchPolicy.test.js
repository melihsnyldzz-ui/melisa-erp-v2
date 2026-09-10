import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findRecentWaitingCards,
  normalizeImageStockCode,
  rankReviewCandidates,
  selectImageImportMatch,
} from './vegaProductImageMatchPolicy.js';

const receivedAt = '2026-09-03T11:21:42.000Z';

const leylek = { sourceId: 159414, stockCode: '4711 LEYLEK', brand: 'LEYLEK' };
const mymio = { sourceId: 2, stockCode: '4711 MY MIO', brand: 'MY MIO' };
const match = (overrides = {}) => selectImageImportMatch({
  supplier: 'MY MIO', codeCandidates: [leylek], brandCandidates: [],
  manualCandidate: null, recentWaitingCandidates: [], fuzzyWinner: null, ...overrides,
});

test('MY MIO 4711 cannot auto-bind to the only active LEYLEK 4711 card', () => {
  assert.deepEqual(match(), { exact: null, confidence: 0, matchSource: 'unresolved' });
});

test('brand and code still select the correct card among duplicate model numbers', () => {
  assert.equal(match({ codeCandidates: [leylek, mymio], brandCandidates: [mymio] }).exact, mymio);
});

test('supplier-less unique code remains supported but duplicate codes require review', () => {
  assert.equal(match({ supplier: '' }).exact, leylek);
  assert.equal(match({ supplier: '', codeCandidates: [leylek, mymio] }).exact, null);
});

test('explicit manual choice remains distinct from an automatic identity match', () => {
  assert.equal(match({ manualCandidate: leylek }).matchSource, 'manual_approval');
});

test('810 selects the single recent image-less EMINS card', () => {
  const candidates = [
    { sourceId: 142266, brand: "BEBEDEX'S", cardOpenedAt: '2025-01-22T10:38:18.000Z' },
    { sourceId: 153981, brand: 'MIDIRIK', cardOpenedAt: '2025-12-04T09:23:44.000Z' },
    { sourceId: 161263, brand: 'EMİNS TRİKO', cardOpenedAt: '2026-09-03T09:20:46.000Z' },
  ];

  const result = findRecentWaitingCards(candidates, { existingImages: new Map(), receivedAt });
  assert.equal(result.length, 1);
  assert.equal(result[0].product.sourceId, 161263);
  assert.equal(result[0].waitingAgeHours, 2.02);
});

test('a card opened after the image is not eligible', () => {
  const result = findRecentWaitingCards([
    { sourceId: 1, cardOpenedAt: '2026-09-03T11:22:00.000Z' },
  ], { existingImages: new Map(), receivedAt });
  assert.deepEqual(result, []);
});

test('a card older than the waiting window is not eligible', () => {
  const result = findRecentWaitingCards([
    { sourceId: 1, cardOpenedAt: '2026-08-31T11:21:41.000Z' },
  ], { existingImages: new Map(), receivedAt, windowHours: 72 });
  assert.deepEqual(result, []);
});

test('a card with an active primary image is not eligible', () => {
  const result = findRecentWaitingCards([
    { sourceId: 1, cardOpenedAt: '2026-09-03T10:21:42.000Z' },
  ], { existingImages: new Map([[1, '/image.jpg']]), receivedAt });
  assert.deepEqual(result, []);
});

test('multiple recent image-less cards remain ambiguous', () => {
  const result = findRecentWaitingCards([
    { sourceId: 1, cardOpenedAt: '2026-09-03T09:21:42.000Z' },
    { sourceId: 2, cardOpenedAt: '2026-09-03T10:21:42.000Z' },
  ], { existingImages: new Map(), receivedAt });
  assert.equal(result.length, 2);
});

test('missing or invalid card dates fail closed', () => {
  const result = findRecentWaitingCards([
    { sourceId: 1, cardOpenedAt: null },
    { sourceId: 2, cardOpenedAt: 'not-a-date' },
  ], { existingImages: new Map(), receivedAt });
  assert.deepEqual(result, []);
});

test('the exact 72 hour boundary is eligible', () => {
  const result = findRecentWaitingCards([
    { sourceId: 1, cardOpenedAt: '2026-08-31T11:21:42.000Z' },
  ], { existingImages: new Map(), receivedAt, windowHours: 72 });
  assert.equal(result.length, 1);
  assert.equal(result[0].waitingAgeHours, 72);
});

test('numeric stock codes preserve leading zeroes', () => {
  assert.equal(normalizeImageStockCode('00810'), '00810');
  assert.notEqual(normalizeImageStockCode('00810'), normalizeImageStockCode('810'));
});

test('manual review receives every candidate, not only the first five', () => {
  const candidates = Array.from({ length: 8 }, (_, index) => ({
    sourceId: index + 1,
    stockCode: '817',
  }));
  const ranked = rankReviewCandidates(candidates, [{
    product: candidates[1],
    waitingAgeHours: 1,
  }]);

  assert.equal(ranked.length, 8);
  assert.equal(ranked[0].product.sourceId, 2);
  assert.deepEqual(
    [...ranked.map((item) => item.product.sourceId)].sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
});
