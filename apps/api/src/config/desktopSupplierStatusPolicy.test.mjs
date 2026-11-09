import test from 'node:test';import assert from 'node:assert/strict';
import {DESKTOP_SUPPLIER_STATUS_RIGHTS as rights} from './desktopSupplierStatusPolicy.mjs';
import {DESKTOP_FINANCE_V7_PERMISSION_MANIFEST as v7} from './desktopFinanceV7Policy.mjs';
import {DESKTOP_GOODS_V6_PERMISSION_MANIFEST as v6} from './desktopGoodsV6Policy.mjs';
test('supplier status adds only four column UPDATE rights, with no delete or broad update',()=>{assert.deepEqual(rights.map(r=>r.column),['is_active','passive_at','passive_reason','updated_by']);for(const r of rights){assert.equal(r.schema,'dbo');assert.equal(r.name,'suppliers');assert.equal(r.permission,'UPDATE');assert.ok(v7.some(x=>JSON.stringify(x)===JSON.stringify(r)));assert.ok(!v6.some(x=>JSON.stringify(x)===JSON.stringify(r)));}assert.ok(!v7.some(r=>r.name==='suppliers'&&(r.permission==='DELETE'||r.permission==='UPDATE'&&r.column===null)));});
