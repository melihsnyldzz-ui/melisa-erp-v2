import test from 'node:test';
import assert from 'node:assert/strict';
import { reportPeriod } from '../../apps/api/src/services/reportPeriod.js';
const defaults = { dateFrom: '2026-09-01', dateTo: '2026-09-10' };
test('only omitted dates use the default reporting period', () => {
  assert.deepEqual(reportPeriod({}, defaults), defaults);
  assert.deepEqual(reportPeriod({ dateFrom: '2026-08-01' }, defaults), { ...defaults, dateFrom: '2026-08-01' });
});
test('valid leap day and single day periods preserve exact calendar dates', () => {
  const period = { dateFrom: '2024-02-29', dateTo: '2024-02-29' };
  assert.deepEqual(reportPeriod(period, defaults), period);
});
test('invalid calendar, non-string, extra characters and reversed periods fail with HTTP400', () => {
  for (const value of ['', null, [], {}, 20260101, 'not-a-date', '2026-02-29', '2026-02-30', '2026-13-01', '2026-01-00', '2026-01-01junk', '2026-01-01T00:00:00Z', '0000-01-01']) {
    for (const field of ['dateFrom', 'dateTo']) assert.throws(() => reportPeriod({ [field]: value }, defaults), { code: 'REPORT_PERIOD_INVALID', statusCode: 400 });
  }
  assert.throws(() => reportPeriod({ dateFrom: '2026-09-11', dateTo: '2026-09-10' }, defaults), { code: 'REPORT_PERIOD_INVALID', statusCode: 400 });
});
