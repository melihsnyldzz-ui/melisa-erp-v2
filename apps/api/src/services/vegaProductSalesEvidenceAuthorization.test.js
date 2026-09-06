import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
let permissions = [];
let reads = 0;
let failure;
const query = { sourceId: '42', dateFrom: '2026-06-01', dateTo: '2026-09-05' };
mock.module('./authService.js', { namedExports: {
  verifyAccessToken: (token) => { if (token !== 'fixture-token') throw new Error('Invalid fixture'); return { sub: '7' }; },
  getUserById: async () => ({ id: 7, permissions }),
} });
mock.module('./vegaProductSalesEvidenceService.js', { namedExports: { getVegaProductSalesEvidence: async (options) => {
  reads++; assert.deepEqual(options, query); if (failure) throw failure;
  return { data: { sourceId: '42', state: 'NO_SALES_IN_WINDOW', noSalesInWindow: true }, meta: { writePerformed: false } };
} } });
const { productIntelligenceRoutes } = await import('../routes/productIntelligenceRoutes.js');
function request(token) {
  return new Promise((resolve) => {
    const req = { url: '/vega/ai/product-sales-evidence', method: 'GET', query, get: () => token ? `Bearer ${token}` : '' };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { resolve({ status: this.statusCode, body }); } };
    productIntelligenceRoutes.handle(req, res, (error) => resolve({ status: error?.statusCode || 500 }));
  });
}

test('sales evidence requires authentication and sales.view before any read', async () => {
  permissions = []; reads = 0;
  assert.equal((await request()).status, 401);
  permissions = ['product.view'];
  assert.equal((await request('fixture-token')).status, 403);
  assert.equal(reads, 0);
  permissions = ['sales.view'];
  const response = await request('fixture-token');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.noSalesInWindow, true);
  assert.equal(response.body.meta.writePerformed, false);
  assert.equal(reads, 1);
});

test('failed SQL read returns sanitized 503 and never an empty successful zero-sales result', async () => {
  permissions = ['sales.view']; failure = Object.assign(new Error('PRIVATE_FIXTURE_CONNECTION'), { code: 'ETIMEOUT' });
  const response = await request('fixture-token');
  assert.equal(response.status, 503);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'VEGA_SALES_EVIDENCE_FAILED');
  assert.equal(JSON.stringify(response.body).includes('PRIVATE_FIXTURE_CONNECTION'), false);
  assert.equal('data' in response.body, false);
  failure = undefined;
});
