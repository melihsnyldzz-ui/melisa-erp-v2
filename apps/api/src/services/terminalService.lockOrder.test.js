import assert from 'node:assert/strict';
import test from 'node:test';
import { terminalProductLockIds } from './terminalService.js';

test('terminal product locks use one ascending order regardless of basket order', () => {
  const forward = terminalProductLockIds([
    { productId: 2 },
    { productId: 5 },
    { productId: 9 },
    { productId: 5 },
  ]);
  const reverse = terminalProductLockIds([
    { productId: 9 },
    { productId: 5 },
    { productId: 2 },
  ]);

  assert.deepEqual(forward, [2, 5, 9]);
  assert.deepEqual(reverse, [2, 5, 9]);
});

test('terminal product lock ordering rejects invalid identities before SQL work', () => {
  assert.throws(
    () => terminalProductLockIds([{ productId: 2 }, { productId: 0 }]),
    { code: 'TERMINAL_PRODUCT_REQUIRED', statusCode: 400 },
  );
});
