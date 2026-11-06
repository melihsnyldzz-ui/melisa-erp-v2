import test from 'node:test';
import assert from 'node:assert/strict';
import {assertEmptyLocalBuildEnvironment, assertEmptyLocalBrowserOrigin, assertEmptyLocalRequest, emptyLocalScreenIds} from './emptyLocalInstallation.mjs';

const profile = () => ({
  VITE_EMPTY_LOCAL_INSTALLATION: '20261105',
  VITE_API_BASE_URL: 'http://127.0.0.1:4294',
  VITE_DEMO_MODE: 'false',
  VITE_MELISA_PILOT: 'true',
  VITE_LOCAL_PASSWORDLESS_LOGIN: 'false',
});

test('legacy builds remain opt-in and the exact empty local profile is accepted', () => {
  assert.equal(assertEmptyLocalBuildEnvironment({}), false);
  assert.equal(assertEmptyLocalBuildEnvironment({VITE_API_BASE_URL: 'http://localhost:4100', VITE_DEMO_MODE: 'true'}), false);
  assert.equal(assertEmptyLocalBuildEnvironment(profile(), 'empty-local'), true);
  assert.throws(() => assertEmptyLocalBuildEnvironment({}, 'empty-local'), /EMPTY_LOCAL_BUILD_PROFILE_REQUIRED/);
});

for (const [key, values] of Object.entries({
  VITE_EMPTY_LOCAL_INSTALLATION: [undefined, '', 'other'],
  VITE_API_BASE_URL: [undefined, 'http://127.0.0.1:4194', 'http://localhost:4294', 'http://127.0.0.1:4294/'],
  VITE_DEMO_MODE: [undefined, 'true'],
  VITE_MELISA_PILOT: [undefined, 'false'],
  VITE_LOCAL_PASSWORDLESS_LOGIN: [undefined, 'true'],
  VITE_VEGA_BRIDGE_MODE: ['true'],
  VITE_VEGA_PRODUCTS_MODE: ['true'],
  VITE_ERP_WORKFACE: ['ERP-5244-REALDATA-20261027'],
  VITE_VEGA_PRODUCTS_BASE_URL: ['https://vega-api.melisababy.com'],
})) {
  test('empty local build rejects inconsistent ' + key, () => {
    for (const value of values) assert.throws(() => assertEmptyLocalBuildEnvironment({...profile(), [key]: value}, 'empty-local'), /EMPTY_LOCAL_BUILD_PROFILE_REQUIRED/);
  });
}

test('only the separate loopback browser origin can use the profile', () => {
  assert.doesNotThrow(() => assertEmptyLocalBrowserOrigin(new URL('http://127.0.0.1:5294/')));
  for (const origin of ['http://localhost:5294', 'http://127.0.0.1:5244', 'http://192.168.1.46:5294', 'https://127.0.0.1:5294']) {
    assert.throws(() => assertEmptyLocalBrowserOrigin(new URL(origin)), /EMPTY_LOCAL_BROWSER_ORIGIN_REQUIRED/);
  }
});

test('normal login and finite reads are allowed; seed, external and mutation paths are rejected', () => {
  for (const path of ['/api/auth/me', '/api/products', '/api/products/options', '/api/customers', '/api/suppliers', '/api/dashboard/summary', '/api/dashboard/alerts']) {
    assert.doesNotThrow(() => assertEmptyLocalRequest('GET', path));
    assert.throws(() => assertEmptyLocalRequest('POST', path), {code: 'EMPTY_LOCAL_READ_ONLY'});
  }
  assert.doesNotThrow(() => assertEmptyLocalRequest('POST', '/api/auth/login'));
  for (const [method, path] of [
    ['POST', '/api/customers/cash/ensure'],
    ['POST', '/api/auth/local-passwordless-admin'],
    ['POST', '/api/auth/refresh'],
    ['GET', '/api/vega/products'],
    ['GET', '/api/vega/customers'],
    ['GET', '/api/vega/suppliers'],
    ['GET', 'http://127.0.0.1:4146/api/products'],
    ['GET', '//vega-api.melisababy.com/api/products'],
    ['DOWNLOAD', '/api/products'],
  ]) assert.throws(() => assertEmptyLocalRequest(method, path), {code: 'EMPTY_LOCAL_READ_ONLY'});
  assert.deepEqual([...emptyLocalScreenIds], ['dashboard', 'stock-list', 'customer-list', 'supplier-list']);
});
