import test from 'node:test';
import assert from 'node:assert/strict';
import { isCrmOrderTestRouteAllowed as allowed } from './crmOrderTestRoutePolicy.mjs';

test('only login, actor, context, draft create and exact UUID readback are mounted', () => {
  for (const [method, path] of [
    ['POST', '/api/auth/login'], ['GET', '/api/auth/me'],
    ['GET', '/api/test/crm/orders/context'], ['POST', '/api/test/crm/orders/drafts'],
    ['GET', '/api/test/crm/orders/drafts/01234567-89ab-cdef-0123-456789abcdef'],
  ]) assert.equal(allowed(method, path), true, `${method} ${path}`);
});

test('daily business writes, arbitrary reads, malformed IDs and alternate methods stay unavailable', () => {
  for (const [method, path] of [
    ['POST', '/api/sales-invoices/test-complete'], ['POST', '/api/finance/collections'],
    ['POST', '/api/test/crm/orders/context'], ['DELETE', '/api/test/crm/orders/drafts'],
    ['GET', '/api/customer-cards'], ['GET', '/api/products'],
    ['GET', '/api/test/crm/orders/drafts/' + '-'.repeat(36)],
    ['GET', '/api/test/crm/orders/drafts/01234567-89ab-cdef-0123-456789abcdef/extra'],
    ['GET', '/api/test/crm/orders/drafts/01234567-89ab-cdef-0123-456789abcdeg'],
  ]) assert.equal(allowed(method, path), false, `${method} ${path}`);
});
