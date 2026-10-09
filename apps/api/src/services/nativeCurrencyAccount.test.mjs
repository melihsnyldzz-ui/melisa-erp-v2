import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
let records,copyRuntime=null;
mock.module('../config/database.js',{namedExports:{getSqlDriver:()=>({BigInt:0}),getSqlPool:async()=>{throw Error('No new pool may be opened by a native adapter');},isCanonicalTest:()=>false,isIsolatedOperationCopyRuntime:()=>!!copyRuntime,getIsolatedOperationCopyConfig:()=>copyRuntime}});
mock.module('./auditService.js',{namedExports:{writeAuditLog:async()=>{}}});
const {verifyNativeCurrencyAccount,postNativeCurrencyAccount,postIsolatedCopyCurrencyMovement}=await import('./nativeCurrencyAccount.mjs');
const request=()=>({input(){return this;},query:async()=>({recordsets:records})});
function sample(currency='USD',cancelled=false){
 records=[[{linkedAccount:'16',linkedParty:'14',customer_id:'168',document_currency:currency,account_amount:0.44,accountId:'16',partyId:'14',accountCustomer:'168',accountCurrency:currency}],
 [{movement_type:'sales_invoice',accountId:'16',partyId:'14',effect:0.44,affects:true,currency_code:currency,customer_id:'168'},...(cancelled?[{movement_type:'sales_invoice_cancel',accountId:'16',partyId:'14',effect:-0.44,affects:true,currency_code:currency,customer_id:'168'}]:[])]];
}
for(const currency of ['USD','TRY','EUR'])test(currency+' linked sale and reversal are verified',async()=>{sample(currency);await verifyNativeCurrencyAccount(1,request,{required:true});sample(currency,true);await verifyNativeCurrencyAccount(1,request,{required:true,cancelled:true});});
test('missing, wrong customer/currency/account and duplicate ledger effects fail closed',async()=>{
 const corruptions=[()=>records[0][0].linkedAccount=null,()=>records[0][0].accountCustomer='169',()=>records[0][0].accountCurrency='EUR',()=>records[1][0].accountId='17',()=>records[1][0].effect=0,()=>records[1][0].affects=null,()=>records[1].push({...records[1][0]})];
 for(const corrupt of corruptions){sample();corrupt();await assert.rejects(verifyNativeCurrencyAccount(1,request,{required:true}),{code:'NATIVE_CURRENCY_EFFECT_UNVERIFIED'});}
});
test('old unlinked receipt remains readable; new unlinked receipt cannot claim success',async()=>{sample();records[0][0].linkedAccount=null;await verifyNativeCurrencyAccount(1,request);await assert.rejects(verifyNativeCurrencyAccount(1,request,{required:true}));});
test('currency posting cannot escape its native transaction',async()=>{await assert.rejects(postNativeCurrencyAccount(1,{},{}),{code:'NATIVE_ACCOUNT_TRANSACTION_REQUIRED'});});

test('copied currency completion binds exact8 account effect and never adds a second scalar balance',async()=>{
 const {fixtureContext,fixtureIdentity,fixtureProof}=await import('./isolatedOperationCopyContext.test.mjs');
 const {validateIsolatedOperationCopyContext}=await import('./isolatedOperationCopyContext.mjs');
 const {withIsolatedOperationCopyScope}=await import('./isolatedOperationCopyScope.mjs');
 const copy=validateIsolatedOperationCopyContext(fixtureContext()),transaction={},calls=[];
 class Request{constructor(tx){assert.equal(tx,transaction);this.params={};}input(k,t,v){this.params[k]=v;return this;}async query(sql){calls.push({sql,params:this.params});return{recordset:[{accountId:'22',partyId:'21',movementId:'50',beforeBalance:'7395.28000001',effect:'-92.00000000',afterBalance:'7303.28000001'}]};}}
 const driver={Request,UniqueIdentifier:0,BigInt:0,NVarChar:()=>0,Decimal:(p,s)=>{assert.equal(p,28);assert.equal(s,8);return 0;}};
 await assert.rejects(postIsolatedCopyCurrencyMovement({role:'customer',partyId:'20',currency:'TRY',movementId:'50',effectExact8:'-92.00000000'},{transaction,sqlDriver:driver},{id:'16'}));
 await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction,write:true},async()=>{
  const post=await postIsolatedCopyCurrencyMovement({role:'customer',partyId:'20',currency:'TRY',movementId:'50',effectExact8:'-92.00000000'},{transaction,sqlDriver:driver},{id:'16'});
  assert.equal(post.afterBalance,'7303.28000001');
  await assert.rejects(postIsolatedCopyCurrencyMovement({role:'customer',partyId:'20',currency:'USD',movementId:'50',effectExact8:'-92.00000000'},{transaction,sqlDriver:driver},{id:'16'}));
 });
 assert.equal(calls.length,1);assert.equal(calls[0].params.effect,'-92.00000000');assert.equal(calls[0].params.copyDatabase,copy.target.database);
 assert.match(calls[0].sql,/DB_NAME\(\).*<>@copyDatabase/);
 assert.match(calls[0].sql,/transaction_id=CURRENT_TRANSACTION_ID\(\)/);
 assert.match(calls[0].sql,/UPDATE dbo.party_currency_accounts SET current_balance=current_balance\+@effect/);
 assert.doesNotMatch(calls[0].sql,/UPDATE dbo.customers SET balance/);
 assert.match(calls[0].sql,/N'sales_invoice',N'sales_invoice_cancel',N'collection'/);
});

test('shared supplier currency posting uses its registered transaction DB without borrowing the old copy or changing the main supplier balance',async()=>{
 const {sharedRevisionFixture}=await import('./isolatedOperationCopyRevision.test.mjs');
 const {fixtureIdentity,fixtureProof}=await import('./isolatedOperationCopyContext.test.mjs');
 const {withIsolatedOperationCopyScope}=await import('./isolatedOperationCopyScope.mjs');
 const copy=sharedRevisionFixture(),transaction={},calls=[];
 class Request{constructor(tx){assert.equal(tx,transaction);this.params={};}input(k,t,v){this.params[k]=v;return this;}async query(sql){calls.push({sql,params:this.params});return{recordset:[{accountId:copy.suppliers[0].accountId,partyId:copy.suppliers[0].partyId,movementId:'50',beforeBalance:'166600.00000000',effect:'75.00000000',afterBalance:'166675.00000000'}]};}}
 const driver={Request,UniqueIdentifier:0,BigInt:0,NVarChar:()=>0,Decimal:()=>0};
 await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction,write:true},async()=>{
  await postIsolatedCopyCurrencyMovement({role:'supplier',partyId:'10162',currency:'TRY',movementId:'50',effectExact8:'75.00000000'},{transaction,sqlDriver:driver},{id:'16'});
 });
 assert.equal(calls.length,1);assert.equal(calls[0].params.copyDatabase,'MELISA_ERP_CRM_SHARED_TEST_20261009_01');assert.equal(calls[0].params.account,copy.suppliers[0].accountId);assert.match(calls[0].sql,/actor_id=@actor/);assert.match(calls[0].sql,/m.created_at>=n.created_at/);assert.match(calls[0].sql,/ISOLATED_COPY_ACCOUNT_ALREADY_LINKED/);assert.doesNotMatch(calls[0].sql,/MELISA_ERP_STAGE04_COPY_TEST|UPDATE dbo.suppliers SET balance/);
 await assert.rejects(postIsolatedCopyCurrencyMovement({role:'supplier',partyId:'10162',currency:'TRY',movementId:'50',effectExact8:'75.00000000'},{transaction,sqlDriver:driver},{id:'16'}),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
});

test('shared invoice settlement and received-stock proof bind the same registered database and reject missing receipt effects',async()=>{
 const {insertIsolatedCopyInvoiceMovement,assertReceivedPurchaseContext}=await import('./invoiceDraftService.js');
 const {sharedRevisionFixture}=await import('./isolatedOperationCopyRevision.test.mjs');
 const {fixtureIdentity,fixtureProof}=await import('./isolatedOperationCopyContext.test.mjs');
 const {withIsolatedOperationCopyScope}=await import('./isolatedOperationCopyScope.mjs');
 const copy=sharedRevisionFixture(),transaction={},calls=[];let valid=1;
 class Request{constructor(tx){assert.equal(tx,transaction);this.params={};}input(k,t,v){this.params[k]=v;return this;}async query(query){calls.push({query,params:this.params});return{recordset:[{valid}]};}}
 const sql={Request,BigInt:0,UniqueIdentifier:0,NVarChar:()=>0,Decimal:()=>0,Date:0},context={stockAlreadyReceived:true,isolatedCopyReceived:true,transaction,isolatedOperationCopy:copy,sqlDriver:sql};
 const args={kind:'purchase',invoiceId:99,movementType:'purchase_invoice',snapshot:{documentCurrency:'TRY',accountCurrency:'TRY',documentRateToTry:1,accountRateToTry:1,documentAmount:75,accountAmount:75,amountTry:75},direction:1,actor:{id:'16'},partyId:'10162',documentDate:copy.date};
 copyRuntime=copy;
 try{
  await assert.rejects(insertIsolatedCopyInvoiceMovement(sql,transaction,args),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
  await assert.rejects(assertReceivedPurchaseContext(context,99),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
  await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction,write:true},async()=>{
   await insertIsolatedCopyInvoiceMovement(sql,transaction,args);assert.equal(calls.at(-1).params.copyMovementDatabase,copy.target.database);assert.equal(calls.at(-1).params.copyMovementParty,'10162');assert.equal(calls.at(-1).params.copyMovementOperation,'purchase_finalize');assert.match(calls.at(-1).query,/operation=@copyMovementOperation/);
   await assertReceivedPurchaseContext(context,99);const proof=calls.at(-1);assert.equal(proof.params.copyReceiptDatabase,copy.target.database);assert.equal(proof.params.supplier,'10162');assert.deepEqual([proof.params.copyReceiptProductA,proof.params.copyReceiptProductB],['29980','30003']);assert.match(proof.query,/@copyReceiptDatabase/);assert.match(proof.query,/m.quantity_in=g.quantity/);assert.match(proof.query,/stock_movements/);assert.match(proof.query,/\)\s*=1/);assert.doesNotMatch(proof.query,/MELISA_ERP_STAGE04_COPY_TEST|\bINSERT|\bUPDATE|\bDELETE/);
   valid=0;await assert.rejects(assertReceivedPurchaseContext(context,99),{code:'PURCHASE_RECEIPT_LINK_REQUIRED'});
   await assert.rejects(assertReceivedPurchaseContext({...context,isolatedOperationCopy:structuredClone(copy)},99),{code:'PURCHASE_RECEIPT_LINK_REQUIRED'});
  });
 }finally{copyRuntime=null;}
});

test('copy inbound native adapter avoids driver positional variables and preserves the original product supplier',async()=>{
 const {withIsolatedCopyPurchaseBatchContext}=await import('./testPurchaseService.mjs');
 const {fixtureContext,fixtureIdentity,fixtureProof}=await import('./isolatedOperationCopyContext.test.mjs');
 const {validateIsolatedOperationCopyContext,isolatedCopyHash,bindIsolatedCopyOperationDTO}=await import('./isolatedOperationCopyContext.mjs');
 const {withIsolatedOperationCopyScope}=await import('./isolatedOperationCopyScope.mjs');
 const raw=fixtureContext();raw.suppliers[0].currency='TRY';raw.products.push({...raw.products[0],id:'30003',sourceKey:['VEGA2026','F0102TBLSTOKLAR','14568'].join('/'),stockCode:'004 KÄ°NDO',priceIds:['101'],barcodes:['0004']});const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const copy=validateIsolatedOperationCopyContext(raw),origin={synthetic:false,operationOrigin:copy.operationOrigin};
 const context=bindIsolatedCopyOperationDTO(copy,{meta:{date:copy.date,operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash},scope:{...origin,supplier:{...origin,id:'30',currency:'TRY',code:'BABY HOOD',name:'BABY HOOD',balanceExact4:'166600.0000'},warehouse:{id:'1',label:'Mevcut depo'},products:copy.products.map((p,i)=>({...origin,id:p.id,stockCode:p.stockCode,unit:{label:'ADET',factorExact8:'1.00000000'},writeEligible:true,purchasePriceExact8:i?'85.00000000':'75.00000000'}))}});
 const transaction={},inputs=[];
 class Request{constructor(tx){assert.equal(tx,transaction);}input(k,t,v){assert.doesNotMatch(k,/^p\d+$/,'driver reserves positional @p1/@p2');inputs.push([k,v]);return this;}async query(sql){assert.match(sql,/@copyInboundProductA,@copyInboundProductB/);return{recordset:copy.products.map((p,i)=>({id:p.id,stock_code:p.stockCode,name:'ÃœrÃ¼n',unit:'ADET',current_stock_qty:i?21:153,average_cost_try:i?85:75,supplier_id:123}))};}}
 await withIsolatedOperationCopyScope({context:copy,transaction,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),write:false},async()=>{
  const result=await withIsolatedCopyPurchaseBatchContext({id:'16'},{context,nativeContext:{transaction,pool:{},sqlDriver:{Request,BigInt:0}}},async(ctx,d)=>d,{write:false});
  assert.equal(result.copyProducts[0].actual_supplier,123);assert.equal(result.s.supplier_id,'30');assert.equal(result.copyProducts[1].stock_code,'004 KÄ°NDO');
 });
 assert.deepEqual(inputs,[['copyInboundProductA',34765],['copyInboundProductB',30003]]);
});
test('received copy purchase accepts only sealed supplier/products while preserving different master supplier and original strict behavior',async()=>{
 const {assertPurchaseItemsBelongToSupplier}=await import('./invoiceDraftService.js');
 const {fixtureContext,fixtureIdentity,fixtureProof}=await import('./isolatedOperationCopyContext.test.mjs');
 const {validateIsolatedOperationCopyContext,isolatedCopyHash}=await import('./isolatedOperationCopyContext.mjs');
 const {withIsolatedOperationCopyScope}=await import('./isolatedOperationCopyScope.mjs');
 const raw=fixtureContext();raw.suppliers[0].currency='TRY';const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const copy=validateIsolatedOperationCopyContext(raw),tx={};
 const card={id:34765,stock_code:'0161 MOLLY',supplier_id:123,is_active:true},sql={Request:class{constructor(t){assert.equal(t,tx);}input(){return this;}async query(){return{recordset:[{...card}]};}}};
 const items=[{productId:34765}];
 await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,30,items),{code:'PURCHASE_PRODUCT_SUPPLIER_MISMATCH'});
 copyRuntime=copy;
 try{
  await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,30,items),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
  await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:true},async()=>{
   await assertPurchaseItemsBelongToSupplier(sql,tx,30,items);assert.equal(card.supplier_id,123);
   await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,31,items),{code:'PURCHASE_PRODUCT_SUPPLIER_MISMATCH'});
   await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,30,[{productId:34765},{productId:99}]),{code:'PURCHASE_PRODUCT_SUPPLIER_MISMATCH'});
   card.stock_code='161';await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,30,items),{code:'PURCHASE_PRODUCT_SUPPLIER_MISMATCH'});card.stock_code='0161 MOLLY';
   card.is_active=false;await assert.rejects(assertPurchaseItemsBelongToSupplier(sql,tx,30,items),{code:'PURCHASE_PRODUCT_INACTIVE'});
  });
 }finally{copyRuntime=null;}
});
test('copy sale/purchase finalize and cancellation insert immutable settlement once and stamp only verifies',async()=>{
 const {insertIsolatedCopyInvoiceMovement,stampInvoiceMovement}=await import('./invoiceDraftService.js');
 const {fixtureContext,fixtureIdentity,fixtureProof}=await import('./isolatedOperationCopyContext.test.mjs');
 const {validateIsolatedOperationCopyContext,isolatedCopyHash}=await import('./isolatedOperationCopyContext.mjs');
 const {withIsolatedOperationCopyScope}=await import('./isolatedOperationCopyScope.mjs');
 const raw=fixtureContext();raw.suppliers[0].currency='TRY';const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const copy=validateIsolatedOperationCopyContext(raw),tx={},calls=[];let missingStamp=false;
 class Request{constructor(t){assert.equal(t,tx);this.params={};}input(k,t,v){this.params[k]=v;return this;}async query(query){calls.push({query,params:this.params});return{recordset:missingStamp?[]:[{id:'90'}]};}}
 const sql={Request,UniqueIdentifier:0,BigInt:0,NVarChar:()=>0,Decimal:(precision,scale)=>{assert.equal(precision,18);assert.equal(scale,4);return 0;},Date:0};
 const snapshot={documentCurrency:'TRY',accountCurrency:'TRY',documentRateToTry:1,accountRateToTry:1,documentAmount:160,accountAmount:160,amountTry:160};
 const args={kind:'purchase',invoiceId:25096,movementType:'purchase_invoice',snapshot,direction:1,actor:{id:'16'},partyId:'30',documentDate:copy.date};
 assert.equal(await insertIsolatedCopyInvoiceMovement(sql,tx,args),false);assert.equal(calls.length,0);
 copyRuntime=copy;
 try{
  await assert.rejects(insertIsolatedCopyInvoiceMovement(sql,tx,args),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
  await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:true},async()=>{
   for(const kind of ['sales','purchase'])for(const direction of [1,-1]){
    const movementType=(kind==='sales'?'sales_invoice':'purchase_invoice')+(direction===-1?'_cancel':''),partyId=kind==='sales'?'20':'30';
    await insertIsolatedCopyInvoiceMovement(sql,tx,{...args,kind,direction,movementType,partyId});
    const inserted=calls.at(-1);assert.match(inserted.query,new RegExp('INSERT dbo.'+(kind==='sales'?'customer':'supplier')+'_movements'));
    assert.match(inserted.query,/created_by,account_currency,account_amount,document_exchange_rate_snapshot,account_exchange_rate_snapshot,amount_try/);
    assert.match(inserted.query,/actor_id=@copyMovementActor AND operation=@copyMovementOperation/);assert.match(inserted.query,/status=N'/);
    assert.equal(inserted.params.copyMovementActor,'16');assert.equal(inserted.params.copyMovementAmount,'160.0000');assert.equal(inserted.params.copyMovementEffect,direction===1?'160.0000':'-160.0000');assert.equal(inserted.params.copyMovementDate,copy.date);
    assert.equal(inserted.params.copyMovementDatabase,copy.target.database);assert.match(inserted.query,/<>@copyMovementDatabase/);
    await stampInvoiceMovement(sql,tx,kind,args.invoiceId,movementType,snapshot,direction,args.actor);
    assert.doesNotMatch(calls.at(-1).query,/\bUPDATE|INSERT|DELETE\b/);assert.match(calls.at(-1).query,/m.account_amount=@copyStampAmount/);assert.match(calls.at(-1).query,/m.created_by=@copyStampActor/);assert.match(calls.at(-1).query,/m.created_at>=n.created_at/);
   }
   await insertIsolatedCopyInvoiceMovement(sql,tx,{...args,documentDate:new Date(copy.date+'T00:00:00.000Z')});
   assert.equal(calls.at(-1).params.copyMovementDate,copy.date,'SQL DATE object binds the same sealed calendar date');
   for(const documentDate of [new Date('2026-10-09T00:00:00.000Z'),new Date('invalid'),new Date(copy.date+'T01:00:00.000Z'),copy.date+'T00:00:00.000Z','2026-02-30']){
    const before=calls.length;await assert.rejects(insertIsolatedCopyInvoiceMovement(sql,tx,{...args,documentDate}),{code:'ISOLATED_COPY_INVOICE_MOVEMENT_SCOPE'});assert.equal(calls.length,before);
   }
   for(const patch of [{actor:{id:'1'}},{partyId:'31'},{documentDate:'2026-10-09'},{direction:0},{snapshot:{...snapshot,accountCurrency:'USD'}},{snapshot:{...snapshot,accountRateToTry:2}},{snapshot:{...snapshot,accountAmount:161}},{snapshot:{...snapshot,documentAmount:1.00001,accountAmount:1.00001,amountTry:1.00001}},{snapshot:null}]){
    const before=calls.length;await assert.rejects(insertIsolatedCopyInvoiceMovement(sql,tx,{...args,...patch}),{code:'ISOLATED_COPY_INVOICE_MOVEMENT_SCOPE'});assert.equal(calls.length,before);
   }
   missingStamp=true;await assert.rejects(stampInvoiceMovement(sql,tx,'purchase',25096,'purchase_invoice',snapshot,1,args.actor),{code:'INVOICE_MOVEMENT_SNAPSHOT_AMBIGUOUS'});
  });
 }finally{copyRuntime=null;}
});

test('copy count GET uses full ready hold proof in the registered read transaction; write cannot claim read proof',async()=>{
 const {assertIsolatedCopyCountReadReady}=await import('./testDailyService.mjs');
 const {fixtureContext,fixtureIdentity,fixtureProof}=await import('./isolatedOperationCopyContext.test.mjs');
 const {validateIsolatedOperationCopyContext}=await import('./isolatedOperationCopyContext.mjs');
 const {withIsolatedOperationCopyScope}=await import('./isolatedOperationCopyScope.mjs');
 const copy=validateIsolatedOperationCopyContext(fixtureContext()),tx={},calls=[];let held=false;
 const c={copyContext:copy,copyReadOnly:true,transaction:tx,sqlDriver:{UniqueIdentifier:0},req(){const params={};return{input(k,t,v){params[k]=v;return this;},async execute(name){calls.push({name,params});assert.equal(name,'dbo.usp_stage4_copy_ready');assert.equal(params.copy_id,copy.copyId);if(held)throw Object.assign(new Error('STAGE4_PRODUCT_SCOPE_DRIFT'),{number:51904});return{recordset:[]};}}}};
 await assert.rejects(assertIsolatedCopyCountReadReady(c),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});assert.equal(calls.length,0);
 await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:false},async()=>{
  await assertIsolatedCopyCountReadReady(c);assert.equal(calls.length,1);
  await assert.rejects(assertIsolatedCopyCountReadReady({...c,copyReadOnly:false}),{code:'ISOLATED_COPY_COUNT_READ_TRANSACTION'});assert.equal(calls.length,1);
  held=true;await assert.rejects(assertIsolatedCopyCountReadReady(c),{number:51904});assert.equal(calls.length,2);
 });
 await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:true},async()=>{
  await assert.rejects(assertIsolatedCopyCountReadReady(c),{code:'ISOLATED_COPY_COUNT_READ_TRANSACTION'});assert.equal(calls.length,2);
 });
});
