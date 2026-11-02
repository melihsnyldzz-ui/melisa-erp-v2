import test from 'node:test';
import assert from 'node:assert/strict';
import {customerMasterSqlFixture,identityActor as actor} from './customerMasterSql.test-fixture.mjs';
import {createCanonicalCustomerMasterBinding} from './customerMasterCanonicalBinding.mjs';
import {createCanonicalCustomerMasterRuntime,CUSTOMER_MASTER_NORMAL_TARGET,CUSTOMER_MASTER_NORMAL_SCOPE} from './customerMasterCanonicalRuntime.mjs';
import {createCustomerMasterSqlStore} from './customerMasterSqlStore.mjs';
import {createCustomerMasterService} from './customerMasterService.mjs';
import {canonicalCustomerMasterDDL,NORMAL_MASTER_FRAME_SQL,NORMAL_MASTER_UPDATE_SQL,NORMAL_MASTER_SOURCE_SQL} from './customerMasterCanonicalSql.mjs';
import {CUSTOMER_MASTER_DDL} from './customerMasterSqlContract.mjs';
import {createCustomerMasterEditor,customerMasterCard} from '../../../sites-workflow/src/workflow/workCustomerMaster.mjs';
import {customerContactContext,contactCardFromContext} from '../../../sites-workflow/src/workflow/workCustomerContact.mjs';
const fixture=()=>customerMasterSqlFixture({normal:true});
const uuid=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const body=async(f,n=1,id='100')=>({requestId:uuid(n),expectedRevision:(await f.service.context(id,actor)).revision,customerCode:'000'+id,customerName:'Normal kart '+id,customerType:'wholesale'});

test('normal binding consumes the existing canonical source plus final and current finance proofs; source and balances stay exact',async()=>{
 const f=fixture(),binding=await createCanonicalCustomerMasterBinding(f.normalOptions),original=f.snapshot(),before=(await binding.cards.detail('100',actor)).data,b=await body(f);
 const result=await binding.service.update('100',b,actor),after=(await binding.cards.detail('100',actor)).data;
 assert.equal(result.context.schemaVersion,'melisa-customer-master-context.v3');assert.deepEqual(result.context.target,CUSTOMER_MASTER_NORMAL_TARGET);assert.equal(result.context.scopeKey,CUSTOMER_MASTER_NORMAL_SCOPE);assert(!('copyId'in result.context));assert(!('sealHash'in result.context));
 assert.equal(after.customerName,b.customerName);assert.equal(after.customerCode,'000100');assert.deepEqual(after.accounts,before.accounts);assert.deepEqual(after.source,before.source);assert.deepEqual(after.quarantine,before.quarantine);assert.deepEqual(f.snapshot().rows,original.rows);
 assert.deepEqual(after.accounts.map(a=>[a.currency,a.balanceExact]),[['TRY','-93.00000001'],['USD','8.12345678'],['EUR','0.00000000']]);
 assert(f.calls.some(c=>c[0]==='reader'&&c[1]==='dbo.usp_read_customer_cards'));assert(f.calls.some(c=>c[0]==='finance'&&c[1]==='dbo.usp_read_final_currency_deltas'));assert(f.calls.some(c=>c[0]==='finance'&&c[1]==='dbo.usp_read_current_finance_deltas'));assert(!f.calls.some(c=>c[0]==='reader'&&c[1].includes('shared')));
 assert.equal(f.snapshot().journal.length,1);assert.equal(f.snapshot().audit.length,1);
});
test('normal admission rejects a wrong target, reader login, elevated/control/live identity, port and missing current context before opening pool',async()=>{
 for(const mutate of [o=>o.startup.env.sql.database='MELISA_ERP_CRM_SHARED_TEST_20261009_02',o=>o.startup.env.sql.server='Semih\\MELISADEV',o=>o.startup.env.sql.port=1434,o=>o.startup.identity.serverName='Other',o=>o.startup.identity.loginName='melisa_sirket_test_20260929_01',o=>o.startup.identity.databaseControl=1,o=>o.startup.identity.sysadmin=1,o=>o.startup.identity.liveDatabaseAccess=1,o=>o.startup.port=4146,o=>o.startup.env.sql.trustedConnection=true,o=>o.getCurrentFinanceContext=()=>null,o=>o.database.isCanonicalTest=()=>false]){
  const f=fixture(),o=f.normalOptions;let pools=0;o.database.getSqlPool=async()=>{pools++;throw Error('Must not open');};mutate(o);await assert.rejects(createCanonicalCustomerMasterRuntime(o));assert.equal(pools,0);
 }
 const f=fixture();const store=createCustomerMasterSqlStore({getRuntime:()=>({pool:{},sql:{},canonical:true,target:CUSTOMER_MASTER_NORMAL_TARGET,scopeKey:CUSTOMER_MASTER_NORMAL_SCOPE})});await assert.rejects(store.withCustomerMaster({customerId:'100',actor},()=>{}));assert.equal(f.calls.length,0);
});
test('normal replay precedes CAS and GET recovery never creates a second revision, journal or audit',async()=>{
 const f=fixture(),b=await body(f);await f.service.update('100',b,actor);f.change('100',r=>{r.customer.city='Ankara';r.customer.revision++;});const original=f.snapshot();
 assert.equal((await f.service.update('100',b,actor)).replayed,true);assert.equal((await f.service.recover('100',b.requestId,actor)).committed,true);assert.deepEqual(f.snapshot(),original);
 for(const [id,v,a] of [['100',{...b,customerName:'Başka içerik'},actor],['100',b,{...actor,id:18}],['101',b,actor]])await assert.rejects(f.service.update(id,v,a),{code:'CUSTOMER_MASTER_REQUEST_CONFLICT'});
 assert.deepEqual(f.snapshot(),original);
});
test('normal CAS, original code reservation and local uniqueness reject competing writes without damaging source',async()=>{
 const f=fixture(),b=await body(f);const r=await Promise.allSettled([f.service.update('100',b,actor),f.service.update('100',{...b,requestId:uuid(2),customerName:'Diğer yazar'},actor)]);assert.equal(r[0].status,'fulfilled');assert.equal(r[1].reason.code,'CUSTOMER_MASTER_STALE');
 const next=await body(f,3,'101'),before=f.snapshot();for(const code of ['000100','offline-100'])await assert.rejects(f.service.update('101',{...next,customerCode:code},actor),{code:'CUSTOMER_MASTER_CODE_CONFLICT'});assert.deepEqual(f.snapshot(),before);
});
test('normal transaction failures roll back all three metadata effects; ACK loss is resolved only by GET',async()=>{
 for(const mode of ['journalFailure','auditFailure','commitFailure']){const f=fixture(),b=await body(f),before=f.snapshot();f.modes[mode]=true;await assert.rejects(f.service.update('100',b,actor));assert.deepEqual(f.snapshot(),before);f.modes[mode]=false;assert.equal((await f.service.recover('100',b.requestId,actor)).committed,false);}
 const f=fixture(),b=await body(f);f.modes.lostCommitAck=true;await assert.rejects(f.service.update('100',b,actor));f.modes.lostCommitAck=false;const before=f.snapshot();assert.equal((await f.service.recover('100',b.requestId,actor)).committed,true);assert.deepEqual(f.snapshot(),before);
});
test('normal target/schema/guard/actor/source/finance drift fails closed and leaves metadata unchanged',async()=>{
 for(const frame of [{db:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},{databaseUser:'other'},{control:1},{guardHash:'B'.repeat(64)},{schemaValid:false},{sourceReaderHash:'B'.repeat(64)},{actorJson:'[]'},{actorJson:JSON.stringify([{id:17,roleId:2,roleCode:'admin',canView:true,canUpdate:false}])}]){const f=fixture(),before=f.snapshot();f.modes.frame=frame;await assert.rejects(f.service.context('100',actor));assert.deepEqual(f.snapshot(),before);}
 for(const mode of ['financeHash','financeMissing','financeUnverified']){const f=fixture(),before=f.snapshot();f.modes[mode]=mode==='financeHash'?'F'.repeat(64):true;await assert.rejects(f.service.context('100',actor));assert.deepEqual(f.snapshot(),before);}
 const f=fixture();await f.service.update('100',await body(f),actor);f.tamper(s=>{s.local[0].identityHash='F'.repeat(64);});await assert.rejects(f.cards.detail('100',actor));
});
test('normal count/page/effective search and original alias share the same typed SQL and preserve leading zeros',async()=>{
 const f=fixture();await f.service.update('100',{...await body(f),customerCode:'000%_[1',customerName:'Yeni Normal'},actor);
 for(const search of ['000%_[1','Yeni Normal','OFFLINE-100']){const r=await f.cards.list({search},actor);assert.equal(r.meta.total,1);assert.equal(r.data[0].id,'100');}
 assert.equal((await f.cards.list({search:'Örnek Müşteri'},actor)).meta.total,0);assert.equal((await f.cards.list({page:'2',limit:'1'},actor)).data[0].id,'101');
 const before=f.snapshot();for(const code of ['x'.repeat(51),'x'.repeat(80)])await assert.rejects(f.service.update('100',{...await body(f,2),customerCode:code},actor),{code:'CUSTOMER_VALIDATION_FAILED'});assert.deepEqual(f.snapshot(),before);
});
test('normal UI save and reload after lost ACK keeps only target scope/UUID; explicit recovery performs no POST',async()=>{
 const f=fixture(),card=(await f.cards.detail('100',actor)).data,values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};let posts=0;
 const options={read:id=>f.service.context(id,actor),write:async(id,b)=>{posts++;return f.service.update(id,b,actor);},recover:(id,key)=>f.service.recover(id,key,actor),storage,actorId:17,requestId:()=>uuid(1)};
 let editor=createCustomerMasterEditor(options);editor.select(card);await editor.open();editor.edit('customerCode','000155');editor.edit('customerName','Normal yeni ad');f.modes.lostCommitAck=true;await editor.save();assert.equal(editor.state().status,'uncertain');assert.equal(posts,1);
 const serialized=[...values.values()][0];assert(!serialized.includes('copyId'));assert(!serialized.includes('sealHash'));assert(!serialized.includes('Normal yeni ad'));assert(!serialized.includes('payload'));
 f.modes.lostCommitAck=false;const current=(await f.cards.detail('100',actor)).data,before=f.snapshot();editor.dispose();editor=createCustomerMasterEditor(options);editor.select(current);await editor.open();assert.equal(editor.state().status,'uncertain');await editor.save();assert.equal(editor.state().status,'ready');assert.equal(posts,1);assert.deepEqual(f.snapshot(),before);assert.equal(values.size,0);
 const wrong={...editor.state().context,target:{...CUSTOMER_MASTER_NORMAL_TARGET,database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'}};assert.throws(()=>customerMasterCard(current,wrong));
});
test('normal contact summary preserves local name and exact currency accounts; viewer cannot obtain update context',async()=>{
 const f=fixture();const v=await f.service.update('100',await body(f),actor),card=(await f.cards.detail('100',actor)).data;
 const c={schemaVersion:'melisa-customer-contact-context.v1',customerId:'100',customerCode:'OFFLINE-100',customerName:'Örnek Müşteri',revision:'D'.repeat(64),contact:{phone:'009000000',city:'Ankara',country:'Türkiye'}};customerContactContext(c,card);const next=contactCardFromContext(customerMasterCard(card,v.context),c);assert.equal(next.customerName,card.customerName);assert.deepEqual(next.accounts,card.accounts);
 const viewer={...actor,permissions:['customer.view']};await f.cards.detail('100',viewer);await assert.rejects(f.service.context('100',viewer),{code:'AUTH_PERMISSION_DENIED'});await assert.rejects(f.service.context('100',{...actor,role:{...actor.role,id:99}}));
});
test('normal SQL requires source collation and actual scope/PK/FK/index shapes without weakening shared-copy SQL',()=>{
 assert.throws(()=>canonicalCustomerMasterDDL());assert.throws(()=>canonicalCustomerMasterDDL('Latin1; DROP TABLE dbo.customers;'));
 const ddl=canonicalCustomerMasterDDL('Turkish_CI_AS');assert.match(ddl,/customer_code nvarchar\(50\) COLLATE Turkish_CI_AS/);assert.match(ddl,/scope_key nvarchar\(128\) COLLATE Latin1_General_100_BIN2/);assert.doesNotMatch(ddl,/stage4_copy_manifest|copy_id|copyId/);assert.match(CUSTOMER_MASTER_DDL,/FOREIGN KEY\(copy_id\) REFERENCES dbo.stage4_copy_manifest/);
 assert.match(NORMAL_MASTER_FRAME_SQL,/CUSTOMER_CARD_TARGET_UNAVAILABLE/);assert.match(NORMAL_MASTER_FRAME_SQL,/usp_read_customer_cards/);assert.match(NORMAL_MASTER_FRAME_SQL,/p.collation_name=c.collation_name/);assert.match(NORMAL_MASTER_FRAME_SQL,/f.is_not_trusted=0/);assert.doesNotMatch(NORMAL_MASTER_FRAME_SQL,/usp_read_shared_customer_cards|stage4_copy_manifest/);assert(NORMAL_MASTER_UPDATE_SQL.indexOf('IF EXISTS(SELECT 1 FROM dbo.customer_master_requests_v1')<NORMAL_MASTER_UPDATE_SQL.indexOf('DECLARE @source'));assert.doesNotMatch(NORMAL_MASTER_UPDATE_SQL,/(?:INSERT|UPDATE|DELETE|MERGE)\s+(?:dbo\.)?(?:customers|party_currency_accounts|customer_movements)\b/i);
 assert.match(NORMAL_MASTER_SOURCE_SQL,/SELECT p.scope_key scopeKey/);assert.match(NORMAL_MASTER_UPDATE_SQL,/N'melisa-customer-master:'\+@scope_key/);for(const sql of [NORMAL_MASTER_UPDATE_SQL,NORMAL_MASTER_SOURCE_SQL])assert.doesNotMatch(sql,/CONVERT\(varchar\(36\),(?:p\.)?@?scope_key\)/);
});
