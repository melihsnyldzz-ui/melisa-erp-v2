import test from 'node:test';
import assert from 'node:assert/strict';
import {nullableCost} from '../src/services/productCostValue.js';
test('unknown opening cost remains JSON null and an explicit zero remains numeric zero',()=>{
  assert.equal(nullableCost(null),null);
  assert.equal(nullableCost(undefined),null);
  assert.equal(nullableCost('0.0000'),0);
  assert.equal(nullableCost('12.1250'),12.125);
  assert.equal(JSON.stringify({averageCostTry:nullableCost(null)}),'{"averageCostTry":null}');
});
