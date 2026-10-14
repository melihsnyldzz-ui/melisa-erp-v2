import test from 'node:test';
import assert from 'node:assert/strict';
import {customerContactFixture} from './shared-business-customer-contact-test-fixture.mjs';
import {buildCustomerContactRevision,assertPreparedCustomerContactArtifact,customerContactHash,customerContactJSON} from './shared-business-customer-contact-sql.mjs';
import {CUSTOMER_CONTACT_CONTEXT as GET,CUSTOMER_CONTACT_UPDATE as SET,CUSTOMER_CONTACT_PROOF as PROOF,CUSTOMER_CONTACT_PROJECTOR as FN,CUSTOMER_CONTACT_PREDECESSOR_NAMES as PARENTS} from './shared-business-customer-contact-contract.mjs';
test('contact compiler deterministic finite22 successor, original source/registries unchanged',async()=>{
 const f=await customerContactFixture(),before=customerContactJSON(f.input),b=buildCustomerContactRevision(f.input);
 assert.deepEqual(b.revision,f.bundle.revision);assert.equal(customerContactJSON(f.input),before);assert.equal(b.replacements.length,18);assert.equal(b.objects.length,4);
 assert.deepEqual(b.replacements.map(m=>m.name),PARENTS);for(const m of [...b.replacements,...b.objects])assert.equal(customerContactHash(m.definition),m.afterHash);
 assert.equal(assertPreparedCustomerContactArtifact(f.copy,b),b);assert.throws(()=>assertPreparedCustomerContactArtifact(f.copy,structuredClone(b)));
 assert.equal(b.businessWrites,0);assert.equal(b.changesParentManifest,false);assert.equal(b.rolesChanged,false);
 assert.doesNotMatch(b.registryInsertSQL,/UPDATE|DELETE/);assert.equal(f.nativeExecution,false);
});
test('contact intent denies every noncustomer table and preserves all noncontact data',async()=>{
 const f=await customerContactFixture(),g=f.bundle.replacements.find(m=>m.name==='dbo.usp_stage4_copy_guard').definition;
 assert.match(g,/@table_name<>N'customers'/);assert.match(g,/COUNT\(\*\) FROM OPENJSON\(@inserted\)\)<>1/);
 for(const field of ['balance','currency_code','customer_type','risk_limit','email','address','source_record_key','party_entity_id','source_payload_json'])assert(g.includes("N'"+field+"'"));
 assert(g.indexOf('@table_name<>')<g.indexOf('STAGE4_TRIGGER_ROWSETS_REQUIRED'));
 assert.match(g,/session_id=@@SPID AND n.transaction_id=CURRENT_TRANSACTION_ID\(\)/);
});
test('setter only uses existing journal, historical replay precedes CAS, no financial DML',async()=>{
 const f=await customerContactFixture(),s=f.bundle.objects.find(m=>m.name===SET).definition;
 assert.match(s,/INSERT dbo\.stage4_copy_intents/);assert.match(s,/INSERT dbo\.stage4_copy_requests/);assert.match(s,/UPDATE dbo\.stage4_copy_intents/);
 assert(s.indexOf('SET @replayed=1')<s.indexOf('IF @revision<>@expected'));
 assert.match(s,/payload_json COLLATE Latin1_General_100_BIN2=@payload_json/);assert.match(s,/COUNT\(DISTINCT \[key\]\)/);assert.match(s,/type<>1/);
 assert.doesNotMatch(s,/(?:UPDATE|INSERT|DELETE)\s+(?:dbo\.)?(?:stock_movements|customer_movements|supplier_movements|finance_account_movements|party_currency_accounts|audit_logs)/i);
 assert.match(s,/UPDATE dbo\.customers SET phone=.*city=.*country=/);assert.match(s,/before_accounts COLLATE/);
});
test('fresh role/permission and all FX witnesses stay separate; no actor15/16 inference',async()=>{
 const f=await customerContactFixture(),s=f.bundle.objects.find(m=>m.name===GET).definition;
 assert.match(s,/customer\.update.*can_view=1 AND e\.can_update=1/);assert.match(s,/permissionsRowsHash/);
 assert.match(s,/sourceAccountWitnessCount=1/);assert.match(s,/currency NOT IN\(N'TRY',N'USD',N'EUR'\)/);
 assert.match(s,/operation_quarantine_holds/);assert.match(s,/IN\(591,592\)/);assert.match(s,/source_currency=N'LL'/);
 assert.doesNotMatch(s,/actor_id NOT IN\(15,16\)|SET .*balance|UPDATE dbo\.users|UPDATE dbo\.permissions/);
});
test('function reads real native hash, proof is nonrecursive and CRM own-TX boundaries survive',async()=>{
 const f=await customerContactFixture(),fn=f.bundle.objects.find(m=>m.name===FN).definition,p=f.bundle.objects.find(m=>m.name===PROOF).definition;
 assert.match(fn,/OBJECT_DEFINITION\(OBJECT_ID\(@name\)\)/);assert.match(fn,/r\.after_hash=@actual/);assert.match(fn,/WHEN @before IS NULL THEN @actual ELSE @before END/);
 assert.doesNotMatch(p,/EXEC dbo\.usp_stage4_copy_ready|fn_customer_contact_predecessor_hash_v1\(/);
 for(const n of ['create','read','proof']){const s=f.bundle.replacements.find(m=>m.name===`dbo.usp_shared_crm_price_${n}_v1`).definition;assert(s.indexOf('EXEC '+PROOF)>s.indexOf('BEGIN TRANSACTION'));}
 assert.doesNotMatch(f.bundle.grantSQL,/GRANT (?:SELECT|EXECUTE) ON OBJECT::dbo\.fn_|GRANT .* TO \[public\]/);
 assert.match(f.bundle.grantSQL,/DENY EXECUTE ON OBJECT::dbo\.fn_/);
});
test('reject wrong target, altered raw parent hash, missing closure/schema and empty actor witnesses',async()=>{
 const f=await customerContactFixture();for(const mutate of [x=>x.copyContext={...x.copyContext,actualT1:true},x=>x.parentModules.pop(),x=>x.parentModules[0].definition+=' ',x=>x.schema=x.schema.filter(c=>c.columnName!=='phone'),x=>x.contactActor.permissionsRowsHash=null]){const v=structuredClone(f.input);mutate(v);assert.throws(()=>buildCustomerContactRevision(v));}
});
