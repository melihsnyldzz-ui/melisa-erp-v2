import test from 'node:test';
import assert from 'node:assert/strict';
import { compareOpening, is2026Opening, patchPrefix } from './vega-2026-opening-model.mjs';

test('PAKEL uses exact source opening and retains historical closing', () => {
  const c = compareOpening('37265.26003454', [{ document_date: '2025-12-31', effect: '37102.78770591', affects_balance: true }], new Set());
  assert.equal(c.requiredCorrection, '162.47232863');
  assert.equal(c.historical, '37102.78770591');
});
test('already effective opening is not posted a second time; 2026 operating movements are not part of opening', () => {
  const c = compareOpening('12', [{ document_date: '2026-01-01', source_record_key: 'opening', effect: '12', affects_balance: true }, { document_date: '2026-01-01', effect: '900', affects_balance: true }], new Set(['opening']));
  assert.equal(c.remaining, '0.00000000');
});
test('repeated patch produces zero residual, and disabled annual carries do not compound', () => {
  const c = compareOpening('15', [{ document_date: '2025-01-01', effect: '10', affects_balance: true }, { document_date: '2025-01-01', effect: '999', affects_balance: false }, { source_record_key: patchPrefix+'1/USD', effect: '5', affects_balance: true }], new Set());
  assert.equal(c.requiredCorrection, '5.00000000'); assert.equal(c.remaining, '0.00000000');
});
test('negative adjustment remains signed, while currencies are separately passed by account', () => {
  assert.equal(compareOpening('-3.12345678', [{ document_date: '2025-12-31', effect: '2', affects_balance: true }], new Set()).requiredCorrection, '-5.12345678');
  assert.equal(compareOpening('0', [], new Set()).remaining, '0.00000000');
});
test('later slips and operating type 90 are not January opening anchors', () => {
  assert.equal(is2026Opening({TARIH:'2026-01-01T00:00:00',IZAHAT:'103'}),true);
  assert.equal(is2026Opening({TARIH:'2026-01-23T00:00:00',IZAHAT:'103'}),false);
  assert.equal(is2026Opening({TARIH:'2026-01-01T00:00:00',IZAHAT:'90'}),false);
});
