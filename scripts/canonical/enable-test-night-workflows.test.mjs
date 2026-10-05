import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSetupSql,sqlHash,PREVIOUS_GUARDS} from './enable-test-night-workflows.mjs';
import {WORK_TRADE_SQL_PROOF} from '../../apps/api/src/services/workTradeSqlProof.mjs';
const input=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/night-20261006-before.json',import.meta.url),'utf8'));
test('controlled upgrade preserves each previous native trigger body and its independent pin',()=>{
 const f=input(),b=buildSetupSql(f.exported,f.previous);
 assert.equal(b.wrapped.length,9);
 for(const o of b.wrapped){const split=o.before.indexOf(' AS BEGIN')+' AS BEGIN'.length;assert.ok(o.after.endsWith(o.before.slice(split)));assert.equal(sqlHash(o.before),PREVIOUS_GUARDS[o.name]);assert.match(o.after,/reject|WORK_NIGHT_SCOPE_REQUIRED/i);}
 assert.deepEqual(b.proof,WORK_TRADE_SQL_PROOF);
 assert.equal(b.sql,fs.readFileSync(new URL('./enable-test-night-workflows.sql',import.meta.url),'utf8'));
});
test('unknown/disabled prior guard and incomplete metadata snapshot cannot produce an installer',()=>{
 for(const corrupt of [f=>f.exported.resultSets[0].find(o=>o.name==='test_guard_products').definition+=' ',f=>f.exported.resultSets[0].find(o=>o.name==='test_guard_products').is_disabled=true,f=>f.previous.resultSets[1].pop(),f=>f.previous.resultSets[2].push(f.previous.resultSets[2][0])]){const f=input();corrupt(f);assert.throws(()=>buildSetupSql(f.exported,f.previous));}
});
test('native/quarantine guards never disable; only sealed metadata pins upgrade atomically before exact seeds',()=>{
 const f=input(),{sql}=buildSetupSql(f.exported,f.previous);
 const disabled=[...sql.matchAll(/DISABLE TRIGGER dbo\.(\w+)/g)].map(m=>m[1]);
 assert.deepEqual(disabled,['test_batch_guard_test_purchase_batch_guard_manifest','c03_immutable_test_purchase_fx_guard_manifest']);
 assert.ok(sql.indexOf('BEGIN TRANSACTION')<sql.indexOf('DISABLE TRIGGER'));
 assert.ok(sql.indexOf('ENABLE TRIGGER dbo.c03_immutable_test_purchase_fx_guard_manifest')<sql.indexOf('INSERT dbo.products(stock_code'));
 assert.ok(!/UPDATE dbo\.test_purchase_batch_guard_manifest SET (?:before_hash|before_definition)/.test(sql));
 assert.match(sql,/ROLLBACK; THROW;/);
 assert.match(sql,/IS_SRVROLEMEMBER\(N'sysadmin'\)<>1/);
 assert.match(sql,/r\.id IS NULL/);
 assert.match(sql,/COUNT\(\*\) FROM dbo\.work_trade_guard_manifest\)<>22/);
});
test('new write grants stay on bounded journals and intents; source, roles and accepted quarantine never gain a writer',()=>{
 const f=input(),{sql}=buildSetupSql(f.exported,f.previous);
 const grants=[...sql.matchAll(/GRANT (?:SELECT,INSERT(?:,UPDATE,DELETE)?) ON dbo\.(\w+)/g)].map(m=>m[1]).sort();
 assert.deepEqual(grants,['work_collection_links','work_sales_links','work_trade_intents','work_trade_requests']);
 assert.ok(!/GRANT .* ON (?:erp_migration|dbo\.(?:users|roles|permissions|products|customers|product_prices|finance_accounts))/.test(sql));
 assert.match(sql,/CREATE UNIQUE INDEX work_collection_one_reversal/);
 assert.match(sql,/n\.actor_id=16/);
 assert.ok(sql.includes("CONVERT(varchar(64),HASHBYTES(''SHA2_256'',i.payload_json),2)"));
});
