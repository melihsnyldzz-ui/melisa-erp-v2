import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from './party-currency-readonly-plan.mjs';
import {sqlJsonHash} from './goal7-test-delta.mjs';
import {RECOVERY_TARGET,RECOVERY_PARENTS,RECOVERY_NEGATIVE_STOCK_POLICY,assertRecoveryIdentity,recoverySQLScalar,recoveryInverseDecision,recoveryMutations,recoveryNativeGuardBranch,recoveryJournalGuardSql,verifyRecoveryPlan,createCommittedBatchRecoveryStore,executeRecoveryTypedMutations,buildCommittedBatchRecoveryPlan} from './committed-batch-recovery.mjs';
const h='a'.repeat(64),requestId='f651d9eb-8ea4-493a-909d-e0b99bc8ef28';
const seal=body=>({...body,planHash:hash(body)});
function plan(){return seal({schemaVersion:'melisa-committed-batch-recovery-plan.v1',mode:'SOURCE_ONLY_COMPENSATION_NATIVE_HISTORY_RETAINED',actualT1:false,negativeStockPolicy:RECOVERY_NEGATIVE_STOCK_POLICY,target:RECOVERY_TARGET,requestId,runId:'RECOVERY-'+requestId,actorId:'16',businessDate:'2026-10-09',backup:{sha256:h,copyOnly:true,checksum:true,verifyOnlyPassed:true,verifiedRestore:true,activeOverwrite:false,server:RECOVERY_TARGET.server,sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',restoredDatabase:RECOVERY_TARGET.database},parents:{productRun:RECOVERY_PARENTS.productRun,productPlanHash:RECOVERY_PARENTS.productPlanHash,productReceiptHash:h,productReceiptSqlHash:h,financeId:RECOVERY_PARENTS.financeId,financePlanHash:RECOVERY_PARENTS.financePlanHash,financeReceiptHash:RECOVERY_PARENTS.financeReceiptHash,financeReceiptSqlHash:h,previousProjectionHash:h},stock:Array.from({length:343},(_,i)=>({key:'stock/'+(i+1),nativeId:String(i+1),kind:'stock',delta:'2.00000000',batchBefore:'10.00000000',batchAfter:'12.00000000',movementId:String(10000+i),movementHash:h,original:{fields:{product_id:String(i+1),movement_type:'adjustment',source_type:'stock_adjustment',quantity_net:'2.000',affects_inventory:true}}})),accounts:Array.from({length:59},(_,i)=>({key:'account/'+(i+1),nativeId:String(i+1),kind:'account',delta:'0.12345678',batchBefore:'10.00000000',batchAfter:'10.12345678',role:'supplier',currency:i%2?'USD':'TRY',mainCurrency:'TRY',partyId:String(i+1000),partyEntityId:String(i+2000),movementId:String(i+3000),movementHash:h})),prices:Array.from({length:47},(_,i)=>({key:'price/'+(i+1),nativeId:String(i+1),kind:'price',before:'1.00000000',after:'2.00000000',afterHash:h})),masters:[],logicalWithdrawal:{products:Array.from({length:72},(_,i)=>String(1000+i)),barcodes:Array.from({length:109},(_,i)=>String(2000+i)),prices:Array.from({length:319},(_,i)=>String(3000+i)),aliases:Array.from({length:72},(_,i)=>String(4000+i)),physicalDelete:false,nativeHistoryRetained:true},preserved:{financeNoops:224,mirrorRepairs:157,precisionWidening:true,previous16:true,blocked770:true,costPurchaseMedia:true,rolesAndHolds:true,immutableParents:true}});}
const state=(row,value,extra={})=>{const beforeJSON=JSON.stringify({id:Number(row.nativeId),current_stock_qty:value,price:value,balance:value,brand:'CONCEPT',name:'original'});return{id:row.nativeId,beforeJSON,witness:sqlJsonHash(beforeJSON),value,ledger:value,holds:0,links:1,ledgerMissing:0,unit:'ADET',unitCost:'1.0000',localProofHash:h,localDeltaAfterBatch:'3.00000000',...extra};};
test('only dedicated inverse clone is writable; original/stage4/recovery/server/admin mismatch rejected',()=>{
 assertRecoveryIdentity({...RECOVERY_TARGET,admin:1});
 for(const database of ['MELISA_ERP_SIRKET_TEST_20260929_01','MELISA_ERP_STAGE04_COPY_TEST_20261008_01','MELISA_ERP_STAGE04_RECOVERY_TEST_20261008_01','MELISA_ERP_PROD_CANDIDATE_20260917_01'])assert.throws(()=>assertRecoveryIdentity({...RECOVERY_TARGET,database,admin:1}),/WRONG_TARGET/);
 assert.throws(()=>assertRecoveryIdentity({...RECOVERY_TARGET,admin:0}),/WRONG_TARGET/);assert.throws(()=>assertRecoveryIdentity({...RECOVERY_TARGET,server:'Other',admin:1}),/WRONG_TARGET/);
});
test('SQL decimal tokens preserve 8 digits beyond Number precision and unknown remains unknown',()=>{
 assert.equal(recoverySQLScalar('{"current_balance":94973.14657758,"source_payload_json":"{\\"current_balance\\":1}"}','current_balance'),'94973.14657758');
 assert.equal(recoverySQLScalar('{"current_balance":99999999999999999999.99999999}','current_balance'),'99999999999999999999.99999999');
 assert.equal(recoverySQLScalar('{"current_balance":null}','current_balance'),null);assert.throws(()=>recoverySQLScalar('{}','current_balance'));
});
test('stock inverse retains committed later +/- contribution; negative and precision risk are affected-only deferrals',()=>{
 const row=plan().stock[0];assert.equal(recoveryInverseDecision(row,state(row,'15.00000000')).after,'13.00000000');
 assert.equal(recoveryInverseDecision(row,state(row,'11.00000000',{localDeltaAfterBatch:'-1.00000000'})).after,'9.00000000');
 const negative={...row,delta:'20.00000000',batchBefore:'0.00000000',batchAfter:'20.00000000'};assert.equal(recoveryInverseDecision(negative,state(negative,'19.00000000',{localDeltaAfterBatch:'-1.00000000'})).reason,'NEGATIVE_OR_UNREPRESENTABLE_STOCK');
 assert.throws(()=>recoveryInverseDecision(row,state(row,'15.00000000',{localDeltaAfterBatch:'2.00000000'})),/LATER_EFFECT_ATTRIBUTION/);
 assert.throws(()=>recoveryInverseDecision(row,state(row,'15.00000000',{ledger:'14.00000000'})),/NATIVE_CLOSURE/);
});
test('isolated recovery may restore an exact sealed historical negative quantity and preserves later positive contribution',()=>{
 const beforeJSON='{"id":1,"current_stock_qty":-5.000}',row={...plan().stock[0],batchBefore:'-5.00000000',batchAfter:'2.00000000',delta:'7.00000000',historicalNegativeProof:{kind:'SEALED_PRODUCT_BEFOREIMAGE',productPlanHash:RECOVERY_PARENTS.productPlanHash,productId:'1',beforeJSON,beforeHash:sqlJsonHash(beforeJSON)}};
 assert.equal(recoveryInverseDecision(row,state(row,'2.00000000',{localDeltaAfterBatch:'0.00000000'})).after,'-5.00000000');
 assert.equal(recoveryInverseDecision(row,state(row,'3.00000000',{localDeltaAfterBatch:'1.00000000'})).after,'-4.00000000');
 const p=plan(),{planHash,...body}=p;verifyRecoveryPlan(seal({...body,stock:body.stock.map((r,i)=>i===0?row:r)}));
});
test('new negative, worsened historical negative, missing/foreign/corrupt before-image and sub-milliquantity all defer',()=>{
 const beforeJSON='{"id":1,"current_stock_qty":-5.000}',row={...plan().stock[0],batchBefore:'-5.00000000',batchAfter:'2.00000000',delta:'7.00000000',historicalNegativeProof:{kind:'SEALED_PRODUCT_BEFOREIMAGE',productPlanHash:RECOVERY_PARENTS.productPlanHash,productId:'1',beforeJSON,beforeHash:sqlJsonHash(beforeJSON)}};
 assert.equal(recoveryInverseDecision(row,state(row,'1.00000000',{localDeltaAfterBatch:'-1.00000000'})).action,'DEFER');
 assert.equal(recoveryInverseDecision(row,state(row,'2.00000001',{localDeltaAfterBatch:'0.00000001'})).action,'DEFER');
 for(const proof of [null,{...row.historicalNegativeProof,productId:'2'},{...row.historicalNegativeProof,beforeHash:h},{...row.historicalNegativeProof,productPlanHash:h}])assert.equal(recoveryInverseDecision({...row,historicalNegativeProof:proof},state(row,'2.00000000',{localDeltaAfterBatch:'0.00000000'})).action,'DEFER');
 const p=plan(),{planHash,...body}=p;assert.throws(()=>verifyRecoveryPlan(seal({...body,stock:body.stock.map((r,i)=>i===0?{...row,historicalNegativeProof:null}:r)})),/HISTORICAL_NEGATIVE_POLICY/);
 assert.throws(()=>verifyRecoveryPlan(seal({...body,negativeStockPolicy:'UNRESTRICTED'})),/HISTORICAL_NEGATIVE_POLICY/);
});
test('account inverse preserves exact8 later delta, own currency and main scalar; unknown/held/account spoof rejects',()=>{
 const row=plan().accounts[0],s=state(row,'13.12345678',{role:row.role,currency:row.currency,partyId:row.partyId,partyEntityId:row.partyEntityId,mainCurrency:row.mainCurrency,scalar:'13.12345678'});
 const d=recoveryInverseDecision(row,s);assert.equal(d.after,'13.00000000');const m=recoveryMutations(plan(),row,s,d);assert.equal(m[1].fields.balance_effect_exact,'-0.12345678');assert.equal(m[1].fields.balance_effect,'-0.1235');assert.equal(m[1].fields.account_amount,'0.1235');assert.equal(m[2].fields.balance,'13.00000000');
 for(const patch of [{currency:'EUR'},{partyId:'9'},{role:'customer'},{holds:1},{links:2},{ledgerMissing:1},{scalar:'13.12000000'},{localProofHash:null}])assert.throws(()=>recoveryInverseDecision(row,{...s,...patch}));
 const fx=plan().accounts[1],f={...s,id:fx.nativeId,beforeJSON:JSON.stringify({id:Number(fx.nativeId)}),currency:'USD',partyId:fx.partyId,partyEntityId:fx.partyEntityId};f.witness=sqlJsonHash(f.beforeJSON);assert.equal(recoveryMutations(plan(),fx,f,recoveryInverseDecision(fx,f)).filter(e=>e.table==='suppliers').length,0);
});
test('later price edit refuses restore; master fields use individual three-way CAS without clobbering changed field',()=>{
 const row=plan().prices[0],s=state(row,'2.00000000');row.afterHash=s.witness;assert.equal(recoveryInverseDecision(row,s).after,'1.00000000');assert.equal(recoveryInverseDecision(row,{...s,value:'3.00000000'}).reason,'LATER_MANUAL_PRICE_CHANGE');assert.throws(()=>recoveryInverseDecision(row,{...s,witness:h,beforeJSON:'{}'}),/NATIVE_WITNESS/);
});
test('master CAS restores only matching fields and keeps later native modifications/stock intact',()=>{
 const row={kind:'master',nativeId:'1',fields:{brand:{before:'OLD',after:'CONCEPT'},name:{before:'oldname',after:'batchname'}}},s=state(row,'99.00000000');
 const d=recoveryInverseDecision(row,s);assert.deepEqual(d.fields,{brand:'OLD'});assert.deepEqual(d.conflicts,['name']);assert.deepEqual(recoveryMutations(plan(),row,s,d)[0].fields,{brand:'OLD'});assert(!Object.hasOwn(d.fields,'current_stock_qty'));
});
test('fixed counts, immutable plan hash and false actualT1 prevent scope drift; insert native history stays retained',()=>{
 const p=plan();verifyRecoveryPlan(p);assert.throws(()=>verifyRecoveryPlan({...p,actualT1:true}),/PLAN_HASH_SCOPE/);assert.throws(()=>verifyRecoveryPlan(seal({...p,planHash:undefined,stock:p.stock.slice(1)})),/PLAN_HASH_SCOPE/);
 assert.equal(p.logicalWithdrawal.physicalDelete,false);assert.equal(p.logicalWithdrawal.products.length,72);assert.equal(p.logicalWithdrawal.prices.length,319);assert.equal(p.logicalWithdrawal.barcodes.length,109);
 assert.throws(()=>buildCommittedBatchRecoveryPlan({identity:{...RECOVERY_TARGET,admin:1},requestId,actorId:'16',businessDate:'2026-10-09',backup:{}}),/RESTORED_BACKUP/);
});
test('rehashing cannot replace fixed parents, restoration evidence, aliases or unique kind/identity scopes',()=>{
 const p=plan(),rehash=patch=>{const {planHash,...body}=p;return seal({...body,...patch});};
 for(const patch of [{parents:{...p.parents,financeReceiptHash:'b'.repeat(64)}},{parents:{...p.parents,productRun:'PRODUCT-other'}},{backup:{...p.backup,verifiedRestore:false}},{backup:{...p.backup,restoredDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01'}},{logicalWithdrawal:{...p.logicalWithdrawal,aliases:p.logicalWithdrawal.aliases.slice(1)}},{logicalWithdrawal:{...p.logicalWithdrawal,barcodes:p.logicalWithdrawal.barcodes.map(()=> '1')}},{stock:p.stock.map((r,i)=>i===1?{...r,nativeId:'1'}:r)},{accounts:p.accounts.map((r,i)=>i===1?{...r,kind:'stock'}:r)}])assert.throws(()=>verifyRecoveryPlan(rehash(patch)));
});
test('native guards require exact clone/parent/session/current TX/typed full-row permits; no disable/delete or wildcard',()=>{
 const sql=recoveryNativeGuardBranch('products',[{name:'id',type:'bigint',is_identity:true},{name:'brand',type:'nvarchar',max_length:100},{name:'current_stock_qty',type:'decimal',precision:18,scale:3},{name:'created_at',type:'datetime2'}],plan());
 for(const required of [RECOVERY_TARGET.database,'#recovery_intent','#recovery_rows','#recovery_guard_hashes','CURRENT_TRANSACTION_ID()','erp_recovery.batch_plans','RECOVERY_DELETE_FORBIDDEN','RECOVERY_ROW_OUTSIDE_PLAN','RECOVERY_GUARD_DRIFT','j.before_hash IS NULL','ISJSON(j.after_json)','RECOVERY_PERMIT_SHAPE','GROUP BY [key] HAVING COUNT(*)<>1','EXCEPT SELECT v.[brand]'])assert(sql.includes(required));
 assert(!sql.includes('DISABLE TRIGGER'));assert(!sql.includes('MELISA_ERP_SIRKET_TEST_20260929_01'));assert.throws(()=>recoveryNativeGuardBranch('product_barcodes',[],plan()),/GUARD_TABLE/);
 assert.match(recoveryJournalGuardSql('logical_projection'),/EXISTS\(SELECT 1 FROM deleted\)/);
});
test('owner-context guard may pin immutable engine ORIGINAL_LOGIN while outer writer retains actual sysadmin/SID proof',()=>{
 const p=plan(),authority={schemaVersion:'melisa-stage5-native-writer-authority.v1',planHash:p.planHash,target:RECOVERY_TARGET,login:'TEST\\RecoveryReviewer',sid:'0x010500000000000515000000',admin:1},columns=[{name:'id',type:'bigint',is_identity:true},{name:'price',type:'decimal',precision:18,scale:4}];
 const sql=recoveryNativeGuardBranch('product_prices',columns,p,authority);assert(sql.includes("ORIGINAL_LOGIN()<>N'TEST\\RecoveryReviewer'"));assert(!sql.includes('IS_SRVROLEMEMBER'));assert(sql.includes('erp_recovery.batch_plans'));assert(sql.includes('p.transaction_id=CURRENT_TRANSACTION_ID()'));
 for(const patch of [{sid:'0x00'},{admin:0},{planHash:h},{target:{...RECOVERY_TARGET,database:'MELISA_ERP_SIRKET_TEST_20260929_01'}},{login:''}])assert.throws(()=>recoveryNativeGuardBranch('product_prices',columns,p,{...authority,...patch}),/NATIVE_WRITER_AUTHORITY/);
});
test('typed writer detects CAS/decimal loss before any native DML and prohibits native-card INSERT or deletes',async()=>{
 const schema=[{table:'product_prices',name:'id',type:'bigint',is_identity:true},{table:'product_prices',name:'price',type:'decimal',precision:18,scale:4,is_nullable:false}];let writes=0;
 const q=async op=>{if(op==='recovery-update'||op==='recovery-insert')writes++;return[];};
 await assert.rejects(()=>executeRecoveryTypedMutations({q,schema,mutations:[{table:'product_prices',id:'1',beforeHash:h,fields:{price:'1.12345678'}}]}),/PRECISION_LOSS/);
 await assert.rejects(()=>executeRecoveryTypedMutations({q,schema,mutations:[{table:'product_prices',id:'1',beforeHash:h,fields:{price:'1.0000'}}]}),/TYPED_CAS/);
 await assert.rejects(()=>executeRecoveryTypedMutations({q,schema:[{table:'products',name:'brand',type:'nvarchar',max_length:100,is_nullable:true}],mutations:[{table:'products',id:null,fields:{brand:'X'}}]}),/INSERT_HISTORY_ONLY/);assert.equal(writes,0);
});
function driverFixture({fault=null,prior=null,bodyConflict=false}={}){const log=[],native=[];let committed=0,rolledBack=0;const driver={
 async transaction(options,fn){assert.equal(options.isolation,'SERIALIZABLE');const before=native.length;try{const result=await fn({query:async(sql,params,meta)=>{log.push(meta.operation);if(meta.operation==='identity')return[{...RECOVERY_TARGET,admin:1}];if(meta.operation==='receipt')return prior?[{plan_hash:bodyConflict?'b'.repeat(64):prior.planHash,parent_hash:prior.parentHash,receipt_json:JSON.stringify(prior),receipt_hash:prior.receiptHash}]:[];if(meta.operation==='receipt-write'){native.push('receipt');if(fault==='receipt')throw Error('SQL_FAULT_BEFORE_COMMIT');}return[];}});if(fault==='commit')throw Error('FAULT_BEFORE_COMMIT');committed++;return result;}catch(e){native.splice(before);rolledBack++;throw e;}},
 verifyPause:async()=>true,verifyParents:async()=>true,prepareNativeGuards:async()=>{log.push('guard');},protectedProof:async()=>({preserved:h}),verifyLocalProof:async({stage})=>stage==='before'?{verified:true,hash:h,origin:'SYNTHETIC_RECOVERY_REHEARSAL'}:true,publishWithdrawal:async({plan:p})=>({hash:h,counts:{products:p.logicalWithdrawal.products.length,prices:p.logicalWithdrawal.prices.length,barcodes:p.logicalWithdrawal.barcodes.length}}),verifyPublication:async()=>true,verifyEffects:async()=>true,
 readState:async({row})=>{if(row.kind==='price')return state(row,'9.00000000');if(row.kind==='stock')return state(row,'15.00000000');return state(row,'13.12345678',{role:row.role,currency:row.currency,partyId:row.partyId,partyEntityId:row.partyEntityId,mainCurrency:row.mainCurrency,scalar:'13.12345678',partyWitness:h});},
 applyMutations:async({mutations})=>{log.push('write');native.push(...mutations);return mutations.map((m,i)=>{const afterJSON=JSON.stringify({id:i+1,...m.fields});return{...m,id:String(i+1),afterJSON,afterHash:sqlJsonHash(afterJSON)};});}};
 return{driver,log,native,counts:()=>({committed,rolledBack})};}
const approval=p=>({schemaVersion:'melisa-isolated-committed-recovery-approval.v1',planHash:p.planHash,requestId:p.requestId,target:p.target,backupSHA:p.backup.sha256,parentHash:hash(p.parents),actorId:p.actorId,testOnly:true});
test('all343/59 fixed compensation plus47 CAS deferrals; guards precede writes; rollback leaves no receipt/effect',async()=>{
 const p=plan(),fixture=driverFixture(),receipt=await createCommittedBatchRecoveryStore(fixture.driver).apply(p,approval(p));assert.equal(receipt.effects.length,402);assert.equal(receipt.deferred.length,47);assert.equal(receipt.physicalDeletes,0);assert.equal(receipt.publication.counts.products,72);assert(fixture.log.indexOf('guard')<fixture.log.indexOf('write'));assert.deepEqual(fixture.counts(),{committed:1,rolledBack:0});
 for(const fault of ['receipt','commit']){const f=driverFixture({fault});await assert.rejects(()=>createCommittedBatchRecoveryStore(f.driver).apply(p,approval(p)));assert.equal(f.native.length,0);assert.deepEqual(f.counts(),{committed:0,rolledBack:1});}
});
test('same UUID verifies actual native/local/publication evidence before no-op; changed body rejected',async()=>{
 const p=plan(),original=driverFixture(),receipt=await createCommittedBatchRecoveryStore(original.driver).apply(p,approval(p)),f=driverFixture({prior:receipt});const replay=await createCommittedBatchRecoveryStore(f.driver).apply(p,approval(p));assert.equal(replay.status,'REPLAY_NOOP');assert.equal(replay.newEffects,0);assert(!f.log.includes('write'));
 const bad=driverFixture({prior:receipt,bodyConflict:true});await assert.rejects(()=>createCommittedBatchRecoveryStore(bad.driver).apply(p,approval(p)),/UUID_BODY_CONFLICT/);
 const missing=driverFixture({prior:receipt});missing.driver.verifyEffects=async()=>false;await assert.rejects(()=>createCommittedBatchRecoveryStore(missing.driver).apply(p,approval(p)),/REPLAY_NATIVE_PROOF/);
});
