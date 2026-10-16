import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllPages } from './fetchAllPages.js';
import { fetchCompleteLedger } from './fetchCompleteLedger.js';

const totalError = /toplam kayıt bilgisi okunamadı/;

test('unknown totals cannot acknowledge an empty party list', async () => {
  for (const total of [null, undefined, '', '   ', false, true, [], [0], {}]) {
    await assert.rejects(fetchAllPages(async () => ({ data: [], meta: { total } })), totalError);
  }
});

test('unknown totals cannot mark a customer or supplier ledger complete', async () => {
  for (const total of [null, '', false]) {
    await assert.rejects(fetchCompleteLedger(async () => ({ data: [], meta: { total } })), totalError);
  }
});

test('a valid first page cannot hide a malformed later total', async () => {
  for (const total of [true, [2]]) {
    let calls = 0;
    await assert.rejects(fetchAllPages(async () => {
      calls += 1;
      return calls === 1
        ? { data: [{ id: 1 }], meta: { total: 2 } }
        : { data: [{ id: 2 }], meta: { total } };
    }), totalError);
  }
});

test('explicit numeric zero still acknowledges an empty complete ledger', async () => {
  for (const total of [0, '0']) {
    const result = await fetchCompleteLedger(async () => ({ data: [], meta: { total, source: 'synthetic' } }));
    assert.deepEqual(result.data, []);
    assert.equal(result.meta.total, 0);
    assert.equal(result.meta.complete, true);
    assert.equal(result.meta.source, 'synthetic');
  }
});

test('valid numeric and numeric-string totals preserve pagination and filters', async () => {
  const calls = [];
  const rows = [{ id: 11 }, { id: 12 }, { id: 13 }];
  const result = await fetchAllPages(async query => {
    calls.push(query);
    return { data: query.page === 1 ? rows.slice(0, 2) : rows.slice(2), meta: { total: query.page === 1 ? 3 : '3' } };
  }, { limit: 2, activeOnly: true });
  assert.deepEqual(result, rows);
  assert.deepEqual(calls, [{ limit: 2, page: 1, activeOnly: true }, { limit: 2, page: 2, activeOnly: true }]);
});

test('incomplete, repeated, drifting and invalid totals remain rejected', async () => {
  for (const total of [-1, 0.5, Infinity, NaN, 'bad', Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(fetchAllPages(async () => ({ data: [], meta: { total } })), totalError);
  }
  await assert.rejects(fetchAllPages(async () => ({ data: [], meta: { total: 1 } })), /bütün sayfaları alınamadı/);
  await assert.rejects(fetchAllPages(async () => ({ data: [{ id: 1 }], meta: { total: 2 } })), /eksik veya tekrarlı/);
  await assert.rejects(fetchAllPages(async ({ page }) => ({ data: [{ id: page }], meta: { total: page === 1 ? 2 : 3 } })), /yüklenirken değişti/);
});
