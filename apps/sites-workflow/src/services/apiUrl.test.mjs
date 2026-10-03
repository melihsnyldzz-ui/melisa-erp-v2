import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApiUrl } from './apiUrl.js';
test('relative and absolute API configuration preserve /api exactly once', () => {
  assert.equal(String(buildApiUrl('/api/products', '/api', 'https://erp.example', { search: 'bebek & takım', page: 2, activeOnly: false, empty: '' })),
    'https://erp.example/api/products?search=bebek+%26+tak%C4%B1m&page=2&activeOnly=false');
  assert.equal(String(buildApiUrl('/api/products', 'http://localhost:4134', 'https://erp.example')), 'http://localhost:4134/api/products');
  assert.equal(String(buildApiUrl('/api/products', 'https://api.example/api', 'https://erp.example')), 'https://api.example/api/products');
});
test('absolute API configuration also works without a browser location', () => {
  assert.equal(String(buildApiUrl('/api/auth/me', 'http://auth.test', undefined)), 'http://auth.test/api/auth/me');
});
