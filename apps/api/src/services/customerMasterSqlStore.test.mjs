import test from 'node:test';
import assert from 'node:assert/strict';
import {customerMasterSqlFixture,identityActor as actor} from './customerMasterSql.test-fixture.mjs';
import {createCustomerMasterService} from './customerMasterService.mjs';
import {parseCustomerMaster} from './customerMasterModel.mjs';
import {customerCardDto} from './customerCardModel.mjs';
import {assembleCustomerCardRaw,CUSTOMER_CARD_PROC_HASH} from './customerCardReadStore.mjs';
import {bindCustomerMasterProjection,customerMasterIdentity} from './customerMasterProjection.mjs';
import {CUSTOMER_MASTER_DDL,MASTER_FRAME_SQL,MASTER_UPDATE_SQL,MASTER_RECOVERY_SQL} from './customerMasterSqlContract.mjs';
import {customerMasterCard,createCustomerMasterEditor,customerMasterHtml} from '../../../sites-workflow/src/workflow/workCustomerMaster.mjs';
import {customerContactContext,contactCardFromContext} from '../../../sites-workflow/src/workflow/workCustomerContact.mjs';
const uuid=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const body=async(f,id='100',n=1)=>({requestId:uuid(n),expectedRevision:(await f.service.context(id,actor)).revision,customerCode:'000'+id,customerName:'Yeni müşteri '+id,customerType:'wholesale'});
test('real reader/DTO/service/typed adapter preserves immutable identity and three exact currency ledgers',async()=>{
 const f=customerMasterSqlFixture(),before=f.snapshot(),card=(await f.cards.detail('100',actor)).data,b=await body(f);
 const result=await f.service.update('100',b,actor),after=(await f.cards.detail('100',actor)).data;
 assert.equal(result.context.schemaVersion,'melisa-customer-master-context.v2');assert.equal(after.customerCode,'000100');assert.equal(after.customerName,b.customerName);assert.equal(after.customerType,'wholesale');
 assert.equal(after.masterIdentity.customerCode,'OFFLINE-100');assert.deepEqual(after.accounts,card.accounts);assert.deepEqual(after.source,card.source);assert.deepEqual(after.quarantine,card.quarantine);assert.deepEqual(after.fields,card.fields);assert.deepEqual(f.snapshot().rows,before.rows);
 assert.deepEqual(after.accounts.map(a=>[a.currency,a.balanceExact]),[['TRY','-90.00000001'],['USD','7.12345678'],['EUR','0.00000000']]);assert.equal(f.snapshot().journal.length,1);assert.equal(f.snapshot().audit.length,1);
 const list=await f.cards.list({},actor);assert.equal(list.data[0].customerCode,'000100');assert.equal(list.data[1].customerCode,'OFFLINE-101');
});
test('contact binds original identity and saves summary without resetting local master or currency balances',async()=>{
 const f=customerMasterSqlFixture(),b=await body(f),result=await f.service.update('100',b,actor),card=(await f.cards.detail('100',actor)).data;
 const context={schemaVersion:'melisa-customer-contact-context.v1',customerId:'100',customerCode:'OFFLINE-100',customerName:'Örnek Müşteri',revision:'D'.repeat(64),contact:{phone:'00901234567',city:'Ankara',country:'Türkiye'}};
 assert.equal(customerContactContext(context,card),context);const next=contactCardFromContext(customerMasterCard(card,result.context),context);assert.equal(next.customerCode,b.customerCode);assert.equal(next.customerName,b.customerName);assert.equal(next.fields.city,'Ankara');assert.deepEqual(next.accounts,card.accounts);
 assert.throws(()=>customerContactContext({...context,customerCode:b.customerCode},card));assert.throws(()=>customerContactContext(context,{...card,masterIdentity:{...card.masterIdentity,customerId:'101'}}));
});
test('effective code/name search, literal special characters, original code alias, count and pagination agree',async()=>{
 const f=customerMasterSqlFixture();await f.service.update('100',{...await body(f),customerCode:'000%_[100',customerName:'Yeni Ad'},actor);
 for(const search of ['000%_[100','Yeni Ad','OFFLINE-100']){const result=await f.cards.list({search},actor);assert.equal(result.meta.total,1);assert.equal(result.data[0].id,'100');assert.equal(result.data[0].customerCode,'000%_[100');}
 assert.equal((await f.cards.list({search:'Örnek Müşteri'},actor)).meta.total,0);
 const first=await f.cards.list({limit:'1'},actor),next=await f.cards.list({limit:'1',page:'2'},actor),empty=await f.cards.list({limit:'1',page:'3'},actor);assert.equal(first.meta.total,2);assert.equal(next.meta.total,2);assert.deepEqual([first.data[0].id,next.data[0].id],['100','101']);assert.deepEqual(empty.data,[]);
});
test('verified absence preserves unknown/unmapped source cards, never creates master authority',async()=>{
 const f=customerMasterSqlFixture();f.change('100',r=>{r.sourceLinks=[];r.sourceParties=[];r.sourceAccounts=[];});const card=(await f.cards.detail('100',actor)).data;assert.equal(card.source.status,'unmapped');assert.equal(card.hasUnknownAccounts,true);assert.equal(card.masterIdentity,undefined);await assert.rejects(f.service.context('100',actor),{code:'CUSTOMER_MASTER_FORBIDDEN'});assert.equal(f.snapshot().local.length,0);
});
test('replay precedes contact CAS, new request after contact change is stale; GET recovery writes nothing',async()=>{
 const f=customerMasterSqlFixture(),b=await body(f);await f.service.update('100',b,actor);const fresh=await body(f,'100',2);
 f.change('100',r=>{r.customer.city='Ankara';r.customer.revision++;});const before=f.snapshot();assert.equal((await f.service.update('100',b,actor)).replayed,true);assert.equal((await f.service.recover('100',b.requestId,actor)).committed,true);assert.deepEqual(f.snapshot(),before);
 await assert.rejects(f.service.update('100',fresh,actor),{code:'CUSTOMER_MASTER_STALE'});assert.deepEqual(f.snapshot(),before);
});
test('same UUID different body/actor/customer rejected, and copy transplant proof fails closed',async()=>{
 const f=customerMasterSqlFixture(),b=await body(f);await f.service.update('100',b,actor);const before=f.snapshot();
 for(const [id,value,user] of [['100',{...b,customerName:'Other'},actor],['100',b,{...actor,id:18}],['101',b,actor]])await assert.rejects(f.service.update(id,value,user),{code:'CUSTOMER_MASTER_REQUEST_CONFLICT'});
 await assert.rejects(f.service.recover('100',b.requestId,{...actor,id:18}),{code:'CUSTOMER_MASTER_REQUEST_CONFLICT'});assert.deepEqual(f.snapshot(),before);
 f.tamper(s=>{s.local[0].copyId='22222222-2222-4222-8222-222222222222';});await assert.rejects(f.service.recover('100',b.requestId,actor),{code:'CUSTOMER_MASTER_REQUEST_CONFLICT'});
});
test('concurrent same UUID commits once, two writers on same revision conflict, unique code spans all local/native cards',async()=>{
 let f=customerMasterSqlFixture(),b=await body(f);const results=await Promise.all([f.service.update('100',b,actor),f.service.update('100',b,actor)]);assert.deepEqual(results.map(r=>r.replayed),[false,true]);assert.equal(f.snapshot().journal.length,1);
 f=customerMasterSqlFixture();b=await body(f);const r=await Promise.allSettled([f.service.update('100',b,actor),f.service.update('100',{...b,requestId:uuid(2),customerName:'Writer 2'},actor)]);assert.equal(r[0].status,'fulfilled');assert.equal(r[1].reason.code,'CUSTOMER_MASTER_STALE');
 const other=await body(f,'101',3);await assert.rejects(f.service.update('101',{...other,customerCode:'000100'},actor),{code:'CUSTOMER_MASTER_CODE_CONFLICT'});await assert.rejects(f.service.update('101',{...other,customerCode:'offline-100'},actor),{code:'CUSTOMER_MASTER_CODE_CONFLICT'});
});
test('projection journal and audit rollback together on statement or commit failure; same request remains usable',async()=>{
 for(const fault of ['journalFailure','auditFailure','commitFailure']){const f=customerMasterSqlFixture(),b=await body(f),before=f.snapshot();f.modes[fault]=true;await assert.rejects(f.service.update('100',b,actor),{code:'CUSTOMER_MASTER_UNAVAILABLE'});assert.deepEqual(f.snapshot(),before);f.modes[fault]=false;assert.equal((await f.service.recover('100',b.requestId,actor)).committed,false);await f.service.update('100',b,actor);assert.equal(f.snapshot().journal.length,1);}
});
test('commit ACK loss requires read-only GET recovery; no automatic retry or second effect',async()=>{
 const f=customerMasterSqlFixture(),b=await body(f);f.modes.lostCommitAck=true;await assert.rejects(f.service.update('100',b,actor));assert.equal(f.snapshot().journal.length,1);f.modes.lostCommitAck=false;const before=f.snapshot();assert.equal((await f.service.recover('100',b.requestId,actor)).committed,true);assert.deepEqual(f.snapshot(),before);assert.equal((await f.service.update('100',b,actor)).replayed,true);
});
test('reader/source/account/hold/actor/schema/adapter drift never silently falls back to successful source read',async()=>{
 for(const change of [r=>{r.sourceParties[0].code='WRONG';},r=>{r.nativeAccounts[0].partyEntityId='999';},r=>{r.nativeAccounts[0].ledgerBalanceExact='0.00000000';},r=>{r.sourceAccounts[0].balanceStatus='UNKNOWN';},r=>{r.quarantineHolds.push({reasons:['SYNTHETIC_HOLD']});}]){const f=customerMasterSqlFixture();await f.service.update('100',await body(f),actor);f.change('100',change);await assert.rejects(f.cards.detail('100',actor));assert.equal(f.snapshot().journal.length,1);}
 for(const frame of [{schemaValid:false},{transactionId:'0'},{roleId:999},{sourceReaderHash:'F'.repeat(64)}]){const f=customerMasterSqlFixture();if(frame.roleId)f.modes.frame={actorJson:JSON.stringify([{id:17,roleId:999,roleCode:'admin',canView:true,canUpdate:true}])};else f.modes.frame=frame;await assert.rejects(f.cards.detail('100',actor));}
 const f=customerMasterSqlFixture();await f.service.update('100',await body(f),actor);f.tamper(s=>{s.local[0].identityHash='F'.repeat(64);});await assert.rejects(f.cards.detail('100',actor));
});
test('server receipt cannot be cloned/mutated/transplanted, is inactive before commit and revoked on rollback',async()=>{
 const f=customerMasterSqlFixture(),raw=assembleCustomerCardRaw(structuredClone(f.snapshot().rows[0])),scope={copyId:f.copy.copyId,sealHash:f.copy.sealHash,customerId:'100'},hash=customerMasterIdentity(raw,scope,'customer').identityHash;
 const projection={...scope,identityHash:hash,customerCode:'000100',customerName:'Yeni',customerType:'retail',version:1};delete projection.sealHash;
 const receipt=bindCustomerMasterProjection(raw,{scope,baseType:'customer',projection,sourceRevision:'A'.repeat(64),transactionId:'123'});assert.throws(()=>customerCardDto(raw));receipt.commit();assert.equal(customerCardDto(raw).customerCode,'000100');assert.throws(()=>customerCardDto(structuredClone(raw)));raw.customer.city='changed';assert.throws(()=>customerCardDto(raw));receipt.revoke();assert.throws(()=>customerCardDto(raw));
 const leaked=assembleCustomerCardRaw(structuredClone(f.snapshot().rows[0]));f.modes.commitFailure=true;await assert.rejects(f.store.withCustomerMaster({customerId:'100',actor},s=>s.projectCard(leaked)));assert.throws(()=>customerCardDto(leaked));assert.throws(()=>customerCardDto({...leaked,masterProjection:{verified:true}}));
});
test('50 allowed, 51/80 rejected before adapter; typed sizes match source; normal form supports v2',async()=>{
 const f=customerMasterSqlFixture(),b=await body(f);for(const n of [51,80])assert.throws(()=>parseCustomerMaster('100',{...b,customerCode:'x'.repeat(n)}),{code:'CUSTOMER_VALIDATION_FAILED'});await f.service.update('100',{...b,customerCode:'0'.repeat(50)},actor);
 const storage=new Map(),editor=createCustomerMasterEditor({actorId:17,storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},read:id=>f.service.context(id,actor),write:(id,b)=>f.service.update(id,b,actor),recover:(id,k)=>f.service.recover(id,k,actor),requestId:()=>uuid(2)});
 editor.select((await f.cards.detail('100',actor)).data);await editor.open();assert.equal(editor.state().status,'ready');assert.match(customerMasterHtml(editor,{allowed:true}),/maxlength="50"/);editor.edit('customerCode','x'.repeat(51));assert.equal(editor.state().draft.customerCode,'0'.repeat(50));editor.edit('customerName','İkinci ad');await editor.save();assert.equal(editor.state().status,'ready');assert.equal((await f.cards.detail('100',actor)).data.customerName,'İkinci ad');editor.close();assert.equal(editor.state().status,'closed');
});
test('view-only may read verified projection, cannot edit; default service stays unavailable',async()=>{
 const f=customerMasterSqlFixture(),viewer={...actor,permissions:['customer.view']};await f.service.update('100',await body(f),actor);assert.equal((await f.cards.detail('100',viewer)).data.customerCode,'000100');await assert.rejects(f.service.context('100',viewer),{code:'AUTH_PERMISSION_DENIED'});await assert.rejects(createCustomerMasterService().context('100',actor),{code:'CUSTOMER_MASTER_UNAVAILABLE'});
});
test('source-only SQL contract pins schema/transaction/replay order and never updates native commercial tables',()=>{
 assert.equal(CUSTOMER_CARD_PROC_HASH,'7FE6BEE7728312D666FF3B68151CA60A08B84E4A6D5B33B36F300A48381E6C8E');
 assert.match(MASTER_FRAME_SQL,/collation_name=p.collation_name/);assert.match(MASTER_FRAME_SQL,/is_not_trusted=0/);assert.match(MASTER_FRAME_SQL,/sys.triggers/);assert.match(MASTER_FRAME_SQL,/is_primary_key=1/);assert.match(MASTER_UPDATE_SQL,/XACT_ABORT ON/);assert(MASTER_UPDATE_SQL.indexOf('IF EXISTS(SELECT 1 FROM dbo.customer_master_requests_v1')<MASTER_UPDATE_SQL.indexOf('DECLARE @source'));
 assert.match(MASTER_RECOVERY_SQL,/p.version>=r.committed_version/);for(const sql of [CUSTOMER_MASTER_DDL,MASTER_UPDATE_SQL])assert.doesNotMatch(sql,/(?:UPDATE|INSERT(?: INTO)?|DELETE FROM|ALTER TABLE|DROP TABLE)\s+dbo\.(?:customers|party_currency_accounts|customer_movements|users|permissions|roles)\b/i);
 assert.doesNotMatch(CUSTOMER_MASTER_DDL,/GRANT|CREATE DATABASE|EXECUTE|TRIGGER/i);
});
