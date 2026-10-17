import test from 'node:test';
import assert from 'node:assert/strict';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,isolatedCopyJSON,validateIsolatedOperationCopyContext} from './isolatedOperationCopyContext.mjs';
import {selectBusinessDailyProfile} from '../../../../scripts/canonical/shared-business-daily-revision-sql.mjs';
import {configureBusinessDailyRevision,BUSINESS_DAILY_REVISION_PROOF_SQL} from './businessDailyRevisionBootstrap.mjs';
import {businessDailyProfitReadSQL} from './businessDailyProfitRevision.mjs';
import {businessDailyNativeCheckReadSQL,BUSINESS_DAILY_NATIVE_CHECK_BEFORE} from './businessDailyNativeCheck.mjs';
import {BUSINESS_DAILY_HOME_CONTEXT_HASH,BUSINESS_DAILY_HOME_READ_PROOF_SQL} from './businessDailyHomeReadProof.mjs';
import {prepareBusinessSelectedSaleContextSQL} from '../../../../scripts/canonical/shared-business-selected-sale-preview-sql.mjs';
import {selectBusinessSalePreview,readBusinessSelectedSalePreviewContext,businessSelectedSalePreview,SELECTED_SALE_METADATA_SQL} from './businessSelectedSalePreview.mjs';
// Offline metadata and runtime witnesses; never a SQL connection or company data.
const sealed=body=>({...body,revisionHash:isolatedCopyHash(body)});
// Synthetic source identity, not an API credential. Keep the complete source
// tuple explicit while assembling the exact fixture value from its parts.
const stockSourceKey=id=>['VEGA2026','F0102TBLSTOKLAR',id].join('/');
function fixture(mutateRaw=()=>{}){
 const raw=structuredClone(businessInboundFixture().copy);
 for(const [kind,count,start] of [['customers',26,100],['suppliers',11,200]])raw[kind]=Array.from({length:count},(_,i)=>({...raw[kind][0],id:String(start+i),partyId:String(start+2000+i),accountId:String(start+1000+i),currency:'TRY',sourceKey:`VEGA2026/${kind==='customers'?'F0102':'F0103'}TBLCARI/${start+i}`,sourceKnown:true,accountIdentityVerified:true,sourceAccountWitnessCount:1,openingHumanAccepted:false,sourceWitnessHash:'E'.repeat(64)}));
 raw.financeAccounts=[{...raw.financeAccounts[0],id:'20043',currency:'TRY',type:'cash',active:true,startingBalanceVerified:true,openingHumanAccepted:false,baselineBalanceExact4:'100.0000'}];
  raw.products=[{...raw.products[0],id:'444',sourceKey:stockSourceKey('444'),stockCode:'OFFLINE-444',barcodes:['00444'],identityVerified:true,sourceKnown:true,supplierBindingKnown:true,supplierId:'200',purchaseCurrency:'TRY',purchaseInvoiceAccountId:'1200',purchasePriceExact8:'2.50000000',purchaseQuote:{verified:true},costExact4:'1.2500',stockUnitCostTryExact8:'1.25000000',stockExact3:'10.000',sourceWitnessHash:'E'.repeat(64),quotes:[{quoteId:'100',currency:'TRY',priceExact8:'3.00000000',type:'sale',mainUnit:true,verified:true,nativeRowHash:'F'.repeat(64),bindingHash:'E'.repeat(64),unitSourceId:null}]}];
 raw.currencyRates[1]={currency:'USD',rateExact8:'47.80000000',source:'dated-fixture',date:'2026-09-12',id:'2'};raw.customers.push({...raw.customers[0],accountId:'5100',currency:'USD'});raw.products[0].priceIds.push('101');raw.products[0].quotes.push({...raw.products[0].quotes[0],quoteId:'101',currency:'USD',priceExact8:'2.12345678'});
 mutateRaw(raw);const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const c=validateIsolatedOperationCopyContext(raw);
 const base=sealed({schemaVersion:'melisa-business-copy-ready-revision.v1',version:1,copyId:c.copyId,baseSealHash:c.sealHash,modules:[{name:c.sql.ready.name,beforeHash:c.sql.ready.hash,afterHash:'F'.repeat(64)}],immutableTriggerHash:'E'.repeat(64)});
 const performance=sealed({schemaVersion:'melisa-business-copy-ready-performance-revision.v1',version:2,copyId:c.copyId,baseSealHash:c.sealHash,baseReadyRevisionHash:base.revisionHash,modules:[{name:c.sql.ready.name,beforeHash:base.modules[0].afterHash,afterHash:'9'.repeat(64)}],immutableTriggerHash:'D'.repeat(64)});
 const residuals=[...c.customers.filter(p=>p.currency==='TRY').map(p=>({role:'customer',...p})),...c.suppliers.map(p=>({role:'supplier',...p}))].map((p,i)=>({role:p.role,id:p.id,accountId:p.accountId,currency:p.currency,residualExact8:i%2?'-0.00000001':'0.00000001',beforeHash:p.beforeHash,accountBeforeHash:p.accountBeforeHash,sourceWitnessHash:p.sourceWitnessHash}));
 const effects=sealed({schemaVersion:'melisa-business-copy-effects-performance-revision.v1',version:3,copyId:c.copyId,baseSealHash:c.sealHash,baseReadyRevisionHash:base.revisionHash,baseReadyPerformanceRevisionHash:performance.revisionHash,modules:[{name:c.sql.ready.name,beforeHash:performance.modules[0].afterHash,afterHash:'8'.repeat(64)},{name:c.sql.effects.name,beforeHash:c.sql.effects.hash,afterHash:'7'.repeat(64)}],baselineResiduals:residuals,baselineResidualsHash:isolatedCopyHash(residuals),immutableTriggerHash:'C'.repeat(64)});
 const names=['ready','context','begin','guard','effects'].map(k=>'dbo.usp_stage4_copy_'+k).concat(['context','begin','guard'].map(k=>'dbo.usp_business_daily_'+k));
 const selection={productIds:['444'],customerAccountId:'1100',supplierAccountId:'1200',financeAccountId:'20043',currency:'TRY'},daily=selectBusinessDailyProfile(c,selection);
 const modules=names.map((name,i)=>({name,beforeHash:i<5?effects.modules.find(m=>m.name===name)?.afterHash??Object.values(c.sql).find(m=>m.name===name)?.hash??'B'.repeat(64):null,afterHash:i===1?BUSINESS_DAILY_HOME_CONTEXT_HASH:String(i+1).repeat(64)}));
 const revision=sealed({schemaVersion:'melisa-business-copy-daily-revision.v1',version:4,copyId:c.copyId,baseSealHash:c.sealHash,baseEffectsRevisionHash:effects.revisionHash,modules,dailyScope:daily,dailyScopeHash:isolatedCopyHash(daily),immutableTriggerHash:'6'.repeat(64)});
 const current=name=>revision.modules.find(m=>m.name===name).afterHash;
 const historyRow=(r,m)=>({databaseName:c.target.database,copyId:c.copyId,version:r.version,baseSealHash:c.sealHash,manifestSealHash:c.sealHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,actualHash:current(m.name),baseManifestHash:c.sql[m.name===c.sql.ready.name?'ready':'effects'].hash,baseManifestRows:185,revisionHash:r.revisionHash,immutableTriggerHash:r.immutableTriggerHash,triggerDisabled:0});
 const proof=[ [historyRow(base,base.modules[0])], [{...historyRow(performance,performance.modules[0]),baseReadyRevisionHash:base.revisionHash}], effects.modules.map(m=>({...historyRow(effects,m),baseReadyRevisionHash:base.revisionHash,baseReadyPerformanceRevisionHash:performance.revisionHash,baselineResidualsHash:effects.baselineResidualsHash,baselineResidualsJSON:isolatedCopyJSON(residuals)})), revision.modules.map((m,i)=>({databaseName:c.target.database,copyId:c.copyId,version:4,baseSealHash:c.sealHash,baseEffectsRevisionHash:effects.revisionHash,manifestSealHash:c.sealHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,actualHash:m.afterHash,baseManifestHash:i<5?Object.values(c.sql).find(x=>x.name===m.name)?.hash??m.beforeHash:null,baseManifestRows:185,revisionHash:revision.revisionHash,dailyScopeHash:revision.dailyScopeHash,dailyProfileJSON:isolatedCopyJSON(daily),immutableTriggerHash:revision.immutableTriggerHash,triggerDisabled:0})) ];
 const nativeProof={recordsets:[[{databaseName:c.target.database,serverName:c.target.server,currentHash:BUSINESS_DAILY_NATIVE_CHECK_BEFORE,isDisabled:false,isNotTrusted:false,registryExists:false,triggerHash:null,triggerDisabled:1,helperExists:false}],[]]};
 const pool={request:()=>({query:async sql=>{if(sql===businessDailyNativeCheckReadSQL())return structuredClone(nativeProof);assert.equal(sql,BUSINESS_DAILY_REVISION_PROOF_SQL);return {recordsets:structuredClone(proof)};}})};
 return {c,base,performance,effects,revision,proof,pool};
}
export function selectedSaleFixture(mutateRaw=()=>{}){
 const f=fixture(mutateRaw),names=['dbo.usp_business_daily_guard','dbo.usp_stage4_copy_ready','dbo.usp_business_daily_context'];
 const v5=sealed({schemaVersion:'melisa-business-daily-profit-revision.v1',version:5,copyId:f.c.copyId,baseSealHash:f.c.sealHash,baseDailyRevisionHash:f.revision.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,modules:names.map((name,i)=>({name,beforeHash:f.revision.modules.find(m=>m.name===name).afterHash,afterHash:['A','B','C','D'][i].repeat(64)})),immutableTriggerHash:'E'.repeat(64)});
 const rows=v5.modules.map(m=>({copyId:f.c.copyId,name:m.name,revision:5,baseSealHash:f.c.sealHash,baseDailyRevisionHash:f.revision.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:v5.revisionHash,actualHash:m.afterHash,immutableTriggerHash:v5.immutableTriggerHash,triggerDisabled:0}));
 for(const group of f.proof)for(const r of group){const m=v5.modules.find(m=>m.name===r.name);if(m)r.actualHash=m.afterHash;}
 const pool={request:()=>({query:async sql=>sql===businessDailyProfitReadSQL()?{recordset:structuredClone(rows)}:sql===businessDailyNativeCheckReadSQL()?f.pool.request().query(sql):{recordsets:structuredClone(f.proof)}})};
 return {...f,v5,rows,pool};
}
function homeProof(f){
 return {recordsets:[[{databaseName:f.c.target.database,serverName:f.c.target.server,transactionCount:1,transactionState:1,copyLockMode:'Shared',isolationLevel:4,baseManifestRows:'185',contextHash:BUSINESS_DAILY_HOME_CONTEXT_HASH,readyHash:f.v5.modules.find(m=>m.name===f.c.sql.ready.name).afterHash,dailyTriggerHash:f.revision.immutableTriggerHash,dailyTriggerDisabled:0,profitTriggerHash:f.v5.immutableTriggerHash,profitTriggerDisabled:0}],
  [{copyId:f.c.copyId,sealHash:f.c.sealHash,backupSHA:f.c.backupSHA,sealed:true,profileHash:isolatedCopyHash(f.c)}],
  f.revision.modules.map(m=>({copyId:f.c.copyId,version:4,baseSealHash:f.c.sealHash,baseEffectsRevisionHash:f.revision.baseEffectsRevisionHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:f.revision.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,dailyProfileHash:f.revision.dailyScopeHash,actualHash:(f.v5.modules.find(p=>p.name===m.name)??m).afterHash})),
  f.v5.modules.map(m=>({copyId:f.c.copyId,version:5,baseSealHash:f.c.sealHash,baseDailyRevisionHash:f.revision.revisionHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:f.v5.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,actualHash:m.afterHash}))]};
}
export async function configureSelectedSaleFixture(f){
 await configureBusinessDailyRevision(f.c,f.base,f.performance,f.effects,f.revision,f.pool,f.v5);
 return f;
}
function harness(f,currency='USD',mutate=()=>{},productIds=['444'],actorId='16'){
 const copy=f.c,artifact=prepareBusinessSelectedSaleContextSQL(copy),selected=selectBusinessSalePreview(copy,{customerId:'100',currency,productIds}),actor={id:actorId,permissions:['sales.view','sales.create']};
 const c=copy.customers.find(p=>p.id===selected.customerId&&p.currency===currency),product=copy.products[0],origin={synthetic:false,operationOrigin:copy.operationOrigin};
 const nativeCustomer=Object.fromEntries(['id','accountId','partyId','sourceKey','sourceWitnessHash','currency'].map(k=>[k,c[k]]));
 const dto={meta:{schemaVersion:'melisa-selected-sale-context.v1',readOnly:true,date:copy.date,copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin},writable:false,revision:'a'.repeat(64),scope:{...origin,customer:{...nativeCustomer,...origin,writeEligible:true},accounts:[],products:copy.products.filter(p=>productIds.includes(p.id)).map(product=>({...origin,id:product.id,stockCode:product.stockCode,sourceKey:product.sourceKey,sourceWitnessHash:product.sourceWitnessHash,name:'Offline product',barcode:product.barcodes[0],unit:{label:'ADET',factorExact8:'1.00000000'},stockQuantityExact3:'10.000',costExact4:product.costExact4,writeEligible:true,prices:product.quotes.filter(q=>q.currency===currency).map(q=>({quoteId:q.quoteId,currency:q.currency,unitPriceExact8:q.priceExact8,source:{kind:'isolated-test-copy',copyId:copy.copyId,sealHash:copy.sealHash}}))}))},rate:copy.currencyRates.find(r=>r.currency===currency),policy:{basis:'SOURCE_BUSINESS_INVOICE_DOCUMENT_AMOUNT_PREVIEW_ONLY',currency,maxInvoiceAmountExact4:'20000.0000',maxItems:2,maxQuantityPerLine:5,existingWriterCurrency:'TRY',existingWriterMaxInvoiceAmountExact4:'500.0000',dailyScopeHash:artifact.dailyScopeHash,dailyRevisionHash:artifact.dailyRevisionHash}};
 const proof={...fixtureProof(copy),definitionHashes:{...artifact.parentHashes}};
 const row={context_json:JSON.stringify(dto),proof_json:JSON.stringify(proof),actor_json:JSON.stringify({id:actor.id,role:actorId==='15'?'isolated_test_sales':'isolated_test_ilker',active:true,permissions:actor.permissions}),sessionId:91,transactionId:'1001',readerDefinitionHash:artifact.definitionHash};
 const metadata={db:copy.target.database,server:copy.target.server,login:copy.target.login,databaseUser:copy.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0,sessionId:91,transactionId:'1001',transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Shared',readerDefinitionHash:artifact.definitionHash};
 const calls=[],inputs=[];let executed=false;
 const request=()=>({input(name,type,value){inputs.push({name,type,value});return this;},async query(sql){calls.push(sql);if(sql===SELECTED_SALE_METADATA_SQL){const m=structuredClone(metadata);mutate('metadata',m,{executed});return {recordset:[m]};}if(sql===BUSINESS_DAILY_HOME_READ_PROOF_SQL){const p=homeProof(f);mutate('home',p);return p;}return f.pool.request().query(sql);},async execute(name){calls.push(name);assert.equal(name,artifact.name);const r=structuredClone(row);mutate('execute',r);executed=true;return {recordset:[r]};}});
 const sql={UniqueIdentifier:'uuid',BigInt:'bigint',MAX:'max',NVarChar:n=>`nvarchar(${n})`};
 return {copy,artifact,selected,actor,metadata,row,calls,inputs,request,sql,read:()=>readBusinessSelectedSalePreviewContext({copy,artifact,selected,actor,sql,request})};
}
const input=(h,patch={})=>({customerId:h.selected.customerId,documentDate:h.copy.date,currency:h.selected.currency,items:h.selected.productIds.map(productId=>({productId,quoteId:h.copy.products.find(p=>p.id===productId).quotes.find(q=>q.currency===h.selected.currency).quoteId,quantityExact3:'1.000'})),...patch});
function sourceCopy(change){const raw=structuredClone(fixture().c);change(raw);const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);return validateIsolatedOperationCopyContext(raw);}

if(import.meta.filename===process.argv[1]){
test('SOURCE sale selector needs no purchase quote, supplier selection or cash account',()=>{
 const copy=sourceCopy(raw=>{raw.products[0].purchaseQuote=null;raw.products[0].purchasePriceExact8=null;});
 const selected=selectBusinessSalePreview(copy,{customerId:'100',currency:'USD',productIds:['444']});
 assert.equal(selected.customerAccountId,'5100');assert.equal(copy.financeAccounts.some(p=>p.currency==='USD'),false);
 assert.equal('financeAccountId' in selected,false);assert.equal('supplierId' in selected,false);assert(Object.isFrozen(selected));
 assert.throws(()=>selectBusinessSalePreview(structuredClone(copy),{customerId:'100',currency:'USD',productIds:['444']}),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
 for(const patch of [{currency:'LL'},{customerId:'591'},{productIds:['444','444']},{productIds:['999']},{productIds:[]},{productIds:['444','445','446']},{financeAccountId:'20043'},{sourceSelectionHash:'E'.repeat(64)}])assert.throws(()=>selectBusinessSalePreview(copy,{customerId:'100',currency:'USD',productIds:['444'],...patch}));
});
test('selector rejects unknown customer, cost, quote witness and missing FX without fallback',()=>{
 for(const change of [r=>r.customers.find(p=>p.currency==='USD').sourceAccountWitnessCount=2,r=>r.products[0].sourceKnown=false,r=>r.products[0].costExact4='0.0000',r=>r.products[0].quotes.find(q=>q.currency==='USD').nativeRowHash=null,r=>r.products[0].quotes.find(q=>q.currency==='USD').mainUnit=false,r=>r.products[0].quotes.push({...r.products[0].quotes[1]}),r=>r.currencyRates=r.currencyRates.filter(p=>p.currency!=='USD')]){
  assert.throws(()=>selectBusinessSalePreview(sourceCopy(change),{customerId:'100',currency:'USD',productIds:['444']}));
 }
});
test('fresh bound USD context preserves native rounding/FX and removes cost before public DTO',async()=>{
 const f=await configureSelectedSaleFixture(selectedSaleFixture()),h=harness(f),context=await h.read();
 assert.equal('costExact4' in context.scope.products[0],false);assert.equal('balanceExact4' in context.scope.customer,false);
 const preview=businessSelectedSalePreview(input(h),context,h.actor);
 assert.equal(preview.items[0].unitPriceExact8,'2.12345678');assert.equal(preview.items[0].unitPriceExact4,'2.1235');assert.equal(preview.grandTotalExact4,'2.1235');assert.equal(preview.amountTryExact4,'101.5033');assert.equal(preview.settlement.accountId,'5100');
 assert.equal(preview.writable,false);assert.equal(preview.writeAuthorized,false);assert.equal(preview.policy.maxInvoiceAmountExact4,'20000.0000');assert.equal(preview.policy.existingWriterMaxInvoiceAmountExact4,'500.0000');assert.equal(context.meta.date,'2026-10-09');
 assert.equal(h.calls.filter(c=>c===h.artifact.name).length,1);assert.equal(h.inputs.some(p=>p.name==='finance_account_id'),false);
 assert.throws(()=>businessSelectedSalePreview(input(h),structuredClone(context),h.actor),{code:'SELECTED_SALE_BOUND_PREVIEW_REQUIRED'});
 assert.throws(()=>{context.scope.products[0].prices[0].unitPriceExact8='1.00000000';},TypeError);
});
test('native reader/parent/profile/actor/rate/quote/stock drifts fail before preview binding',async()=>{
 const f=await configureSelectedSaleFixture(selectedSaleFixture());
 const edits=[(stage,row)=>{if(stage==='metadata')row.readerDefinitionHash='E'.repeat(64);},(stage,row)=>{if(stage==='home')row.recordsets[1][0].profileHash='E'.repeat(64);},(stage,row)=>{if(stage==='execute')row.readerDefinitionHash='E'.repeat(64);},(stage,row)=>{if(stage==='execute')row.sessionId=92;},(stage,row)=>{if(stage==='execute'){const p=JSON.parse(row.actor_json);p.permissions=[];row.actor_json=JSON.stringify(p);}},...( ['accountId','partyId','sourceKey','sourceWitnessHash'].map(key=>(stage,row)=>{if(stage==='execute'){const dto=JSON.parse(row.context_json);dto.scope.customer[key]='999';row.context_json=JSON.stringify(dto);}})),(stage,row)=>{if(stage==='execute'){const dto=JSON.parse(row.context_json);dto.rate.rateExact8='48.00000000';row.context_json=JSON.stringify(dto);}},(stage,row)=>{if(stage==='execute'){const dto=JSON.parse(row.context_json);dto.scope.products[0].prices[0].unitPriceExact8='1.00000000';row.context_json=JSON.stringify(dto);}},(stage,row)=>{if(stage==='execute'){const dto=JSON.parse(row.context_json);dto.scope.products[0].costExact4='0.0000';row.context_json=JSON.stringify(dto);}},(stage,row)=>{if(stage==='execute'){const dto=JSON.parse(row.context_json);dto.scope.products[0].stockQuantityExact3='0.9999';row.context_json=JSON.stringify(dto);}}];
 for(const edit of edits)await assert.rejects(harness(f,'USD',edit).read());
});
test('pool request, write transaction/lock, caller proof and mismatched selection remain rejected',async()=>{
 const f=await configureSelectedSaleFixture(selectedSaleFixture());
 for(const patch of [{copyLockMode:'Exclusive'},{transactionCount:0},{isolationLevel:2},{transactionState:-1},{live:1},{control:1}])await assert.rejects(harness(f,'USD',(stage,row)=>{if(stage==='metadata')Object.assign(row,patch);}).read());
 await assert.rejects(harness(f,'USD',(stage,row,{executed}={})=>{if(stage==='metadata'&&executed)row.transactionId='1002';}).read());
 const h=harness(f),context=await h.read();
 await assert.rejects(readBusinessSelectedSalePreviewContext({...h,selected:structuredClone(h.selected)}));
 await assert.rejects(readBusinessSelectedSalePreviewContext({...h,artifact:structuredClone(h.artifact)}));
 for(const patch of [{currency:'TRY'},{customerId:'101'},{documentDate:'2026-10-11'},{items:[{productId:'444',quoteId:'101',quantityExact3:'6.000'}]},{items:[{productId:'444',quoteId:'101',quantityExact3:'1.500'}]}])assert.throws(()=>businessSelectedSalePreview(input(h,patch),context,h.actor));
 for(const actor of [{...h.actor,id:'15'},{...h.actor,permissions:[]}])assert.throws(()=>businessSelectedSalePreview(input(h),context,actor));
});
test('native current stock limits quantities and exact document cap is not TRY exposure',async()=>{
 const f=await configureSelectedSaleFixture(selectedSaleFixture(r=>{r.products[0].quotes.find(q=>q.currency==='USD').priceExact8='600.00000000';})),h=harness(f),context=await h.read();
 const p=businessSelectedSalePreview(input(h),context,h.actor);assert.equal(p.grandTotalExact4,'600.0000');assert.equal(p.amountTryExact4,'28680.0000');assert.equal(p.writable,false);
 const little=harness(f,'USD',(stage,row)=>{if(stage==='execute'){const d=JSON.parse(row.context_json);d.scope.products[0].stockQuantityExact3='0.999';row.context_json=JSON.stringify(d);}}),small=await little.read();assert.throws(()=>businessSelectedSalePreview(input(little),small,little.actor),{code:'WORK_STOCK_OR_PRICE'});
 const big=await configureSelectedSaleFixture(selectedSaleFixture(r=>{r.products[0].quotes.find(q=>q.currency==='USD').priceExact8='20000.00005000';})),b=harness(big),bc=await b.read();assert.throws(()=>businessSelectedSalePreview(input(b),bc,b.actor),{code:'WORK_TOTAL_LIMIT'});
});
test('actor15 can preview two exact full-profile products while old v4 stays one-product TRY',async()=>{
 const f=await configureSelectedSaleFixture(selectedSaleFixture(r=>{
   const p=structuredClone(r.products[0]);Object.assign(p,{id:'445',stockCode:'OFFLINE-445',sourceKey:stockSourceKey('445'),barcodes:['00445'],priceIds:['102','103'],purchaseQuote:null,purchasePriceExact8:null});p.quotes=p.quotes.map((q,i)=>({...q,quoteId:p.priceIds[i]}));r.products.push(p);
 }));
 assert.equal(f.revision.dailyScope.products.length,1);assert.equal(f.revision.dailyScope.currency,'TRY');assert.equal(f.revision.dailyScope.limits.maxInvoiceAmountExact4,'500.0000');
 const h=harness(f,'USD',()=>{},['444','445'],'15'),context=await h.read(),preview=businessSelectedSalePreview(input(h),context,h.actor);
 assert.equal(context.scope.products.length,2);assert.equal(context.scope.accounts.length,0);assert.equal('balanceExact4' in context.scope.customer,false);assert(context.scope.products.every(p=>!('costExact4' in p)));
 assert.equal(preview.grandTotalExact4,'4.2470');assert.equal(preview.amountTryExact4,'203.0066');assert.equal(preview.writable,false);assert.equal(preview.settlement.accountId,'5100');
 assert.throws(()=>businessSelectedSalePreview({...input(h),items:input(h).items.slice(0,1)},context,h.actor),{code:'SELECTED_SALE_EXACT_SELECTION'});
});
}
