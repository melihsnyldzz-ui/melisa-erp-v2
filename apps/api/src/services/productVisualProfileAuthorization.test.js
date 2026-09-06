import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
let permissions = [];
let reads = 0;
mock.module('./authService.js', { namedExports: {
  verifyAccessToken: (token) => { if (token !== 'fixture-token') throw new Error('Invalid fixture token'); return { sub: '7' }; },
  getUserById: async () => ({ id: 7, permissions }),
} });
mock.module('./productVisualProfileService.js', { namedExports: { getProductVisualProfile: async (id) => { reads += 1; return { sourceId: id, state: 'UNAVAILABLE', fields: [] }; } } });
const { productVisualProfileRoutes } = await import('../routes/productVisualProfileRoutes.js');

function request(token) {
  return new Promise((resolve) => {
    const req = { url: '/vega/products/42/visual-profile', method: 'GET', get: () => token ? `Bearer ${token}` : '' };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { resolve({ status: this.statusCode, body }); } };
    productVisualProfileRoutes.handle(req, res, (error) => resolve({ status: error?.statusCode || 500, code: error?.code }));
  });
}

test('visual profile route requires existing authentication and product.view without bypass', async () => {
  reads = 0; permissions = [];
  assert.equal((await request()).status, 401);
  assert.equal((await request('fixture-token')).status, 403);
  assert.equal(reads, 0);
  permissions = ['product.view'];
  const response = await request('fixture-token');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.state, 'UNAVAILABLE');
  assert.equal(response.body.meta.writePerformed, false);
  assert.equal(reads, 1);
});
