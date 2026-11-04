import {getCanonicalBusinessSaleDefinitionHash} from './canonicalBusinessSessionContext.mjs';
import {purchasePriceBindingHash as hash,projectPurchasePriceExact8,selectRateQuote} from './purchasePriceSelectionModel.mjs';
import {createHash} from 'node:crypto';
import {CURRENT_PRICE_PURCHASE_SQL_PROOF} from './testProductPriceSqlProof.mjs';

const fail=(code,message,statusCode=409)=>{throw Object.assign(new Error(message),{code,statusCode});};
const DB='MELISA_ERP_SIRKET_TEST_20260929_01',SERVER='Semih\\MELISADEV',DATE='2026-10-04';
function fields(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail('TEST_CURRENT_PRICE_INPUT','Kapsam dışı alan gönderildi.',400);}
function positiveId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<1)fail('TEST_CURRENT_PRICE_ID','Geçerli kayıt kimliği gerekli.',400);return n;}
function permission(actor,key){if(Number(actor?.id)!==16||!actor.permissions?.includes(key))fail('TEST_CURRENT_PRICE_PERMISSION','Bu TEST işlemi için İlker ve ilgili izin gerekli.',403);}
function requestId(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value))fail('TEST_CURRENT_PRICE_REQUEST_ID','Geçerli yeniden deneme kimliği gerekli.',400);return value;}
function reason(value){if(typeof value!=='string'||value.trim().length<3||value.trim().length>500)fail('TEST_CURRENT_PRICE_REASON','Gerekçe 3–500 karakter olmalı.',400);return value.trim();}
const date=v=>v instanceof Date?v.toISOString().slice(0,10):String(v).slice(0,10);
const fixed=(v,n)=>{if(v===null||v===undefined||v===''||!['string','number'].includes(typeof v)||!Number.isFinite(Number(v)))fail('TEST_CURRENT_PRICE_DECIMAL_REQUIRED','Kayıtlı kesin tutar eksik veya geçersiz.',503);return typeof v==='string'&&new RegExp(`^-?\\d+\\.\\d{${n}}$`).test(v)?v:Number(v).toFixed(n);};
const fromUnits=(v,n)=>{const s=v.toString().padStart(n+1,'0');return s.slice(0,-n)+'.'+s.slice(-n);};
export function checkedFxNumber(exact,scale){if(typeof exact!=='string'||!new RegExp(`^(0|[1-9]\\d*)\\.\\d{${scale}}$`).test(exact)||BigInt(exact.replace('.',''))>BigInt(Number.MAX_SAFE_INTEGER)||!Number.isFinite(Number(exact))||Number(exact).toFixed(scale)!==exact)fail('TEST_CURRENT_PRICE_NUMBER_BOUNDARY','Native sayı hassasiyeti güvenle korunamıyor.');return Number(exact);}
function hex64(value,code){if(typeof value!=='string'||!/^[a-fA-F0-9]{64}$/.test(value))fail(code,'Kayıtlı hash kanıtı geçersiz.',503);return value.toLowerCase();}
const rate=r=>{if(!r)fail('TEST_CURRENT_PRICE_RATE_REQUIRED','Dondurulmuş kur kaydı eksik.',503);return {currency:r.currency,rateToTryExact8:r.rate_exact_text??fixed(r.rate_exact,8),source:r.source,sourceId:r.source_id,asOf:date(r.as_of),version:String(r.version),hash:hex64(r.hash,'TEST_CURRENT_PRICE_RATE_HASH')};};
function currentPriceProof(row){
 const changedAt=row.changed_at instanceof Date?row.changed_at.toISOString():String(row.changed_at??row.created_at),revision=row.revision;
 if(!['native_price_id','version_id'].every(key=>/^[1-9]\d*$/.test(String(row[key]))&&BigInt(row[key])<=9223372036854775807n)||typeof revision!=='string'||!/^[A-F0-9]{64}$/.test(revision)||String(row.actor_id)!=='16'||typeof row.reason!=='string'||row.reason.trim().length<3||!Number.isFinite(Date.parse(changedAt)))fail('TEST_CURRENT_PRICE_PROOF','Kayıtlı fiyat değişiklik kanıtı eksik.',503);
 return {source:'native-operational-price',productId:'301986',priceId:String(row.native_price_id),versionId:String(row.version_id),revision,actorId:'16',changedAt,reason:row.reason};
}
export function previewCurrentPriceSelection({selected,selection,quantity,date:documentDate,rates}){
 if(selection?.productId!=='301986'||selection.priceId!==String(selected.native_price_id)||selection.versionId!==String(selected.version_id)||selection.revision!==selected.revision)fail('TEST_CURRENT_PRICE_BINDING','Seçilen native fiyat kimliği/sürümü değişti.');
 const sourceProof=currentPriceProof(selected),priceExact=selected.price_exact_text??(selected.price_exact==null?null:fixed(selected.price_exact,8));
 if(selected.unit!=='ADET'||fixed(selected.unit_factor,8)!=='1.00000000'||!['TRY','USD','EUR'].includes(selected.currency)||priceExact!==null&&(typeof priceExact!=='string'||!/^(0|[1-9]\d{0,19})\.\d{8}$/.test(priceExact)))fail('TEST_CURRENT_PRICE_BINDING','Fiyat döviz/birim bağı doğrulanamadı.',503);
 const operationalUnit={productId:'301986',unit:'ADET',factorExact8:'1.00000000',source:'synthetic-copy-unit-evidence',hash:hex64(selected.unit_hash,'TEST_CURRENT_PRICE_UNIT_HASH')};
 const base={selection,quantity,date:documentDate,currency:selected.currency,accountCurrency:'TRY',sourceProof,operationalUnit,synthetic:true,targetProductId:301986,supplierId:13373,priceExact,writable:false,documentAmountExact4:null,accountAmountExact4:null,amountTryExact4:null,projection:null,nativePriceExact4:null,rates:null};
 if(priceExact===null)return {...base,blockedCode:'PRICE_UNKNOWN'};
 let projection;
 try{projection=projectPurchasePriceExact8(priceExact);}catch(error){if(error.code==='PURCHASE_PRICE_OVERFLOW')return {...base,blockedCode:'PRICE_OVERFLOW'};throw error;}
 const projected={...base,projection,nativePriceExact4:projection.nativePriceExact4};
 if(!Number.isInteger(quantity)||quantity<1||quantity>5)return {...projected,blockedCode:'QUANTITY_SCOPE'};
 if(projection.knownZero||BigInt(projection.nativePriceExact4.replace('.',''))===0n)return {...projected,blockedCode:'PRICE_ZERO'};
 if(!projection.nativeNumberBoundary.safe)return {...projected,blockedCode:'PRICE_NUMBER_BOUNDARY'};
 const document=rates.find(row=>row.currency===selected.currency),account=rates.find(row=>row.currency==='TRY');
 if(!document||!account)fail('TEST_CURRENT_PRICE_RATE_REQUIRED','Kayıtlı kur snapshotı eksik.',503);
 selectRateQuote({quote:document,expectedQuote:document,currency:selected.currency,documentDate});
 selectRateQuote({quote:account,expectedQuote:account,currency:'TRY',documentDate});
 checkedFxNumber(document.rateToTryExact8,8);checkedFxNumber(account.rateToTryExact8,8);
 const documentUnits=BigInt(projection.nativePriceExact4.replace('.',''))*BigInt(quantity),tryUnits=(documentUnits*BigInt(document.rateToTryExact8.replace('.',''))+50000000n)/100000000n;
 const documentAmountExact4=fromUnits(documentUnits,4),amountTryExact4=fromUnits(tryUnits,4);
 if(tryUnits<=0n||tryUnits>2000000n)return {...projected,documentAmountExact4,amountTryExact4,accountAmountExact4:amountTryExact4,rates:{document,account},blockedCode:'AMOUNT_SCOPE'};
 checkedFxNumber(documentAmountExact4,4);checkedFxNumber(amountTryExact4,4);
 return {...projected,documentAmountExact4,amountTryExact4,accountAmountExact4:amountTryExact4,rates:{document,account},writable:true,blockedCode:null};
}

async function defaultRuntime(){
 const database=await import('../config/database.js');if(!database.isCanonicalTest())fail('TEST_CURRENT_PRICE_ENVIRONMENT','Yalnız kanonik izole TEST kullanılabilir.',503);
 const [native,quarantine,audit,scope]=await Promise.all([import('./invoiceDraftService.js'),import('./operationQuarantineService.js'),import('./auditService.js'),import('./testSalesScope.mjs')]);
 return {pool:await database.getSqlPool(),sql:database.getSqlDriver(),native,assertQuarantine:quarantine.assertOperationQuarantineAllowed,quarantineContext:quarantine.quarantineTransactionContext,audit:audit.writeAuditLog,withMutation:scope.withTestSalesMutation};
}

// The injectable runtime supports orchestration tests; production executes the
// same SQL and shared native purchase writer in one serializable transaction.
export function createTestCurrentPricePurchaseService({runtime=defaultRuntime}={}){
 async function atomic(actor,required,write,fn){
  permission(actor,required);permission(actor,'purchase.view');permission(actor,'product.view');const r=await runtime();
  const run=async()=>{const tx=new r.sql.Transaction(r.pool);await tx.begin(r.sql.ISOLATION_LEVEL.SERIALIZABLE);
   const c={...r,tx,actor,req:()=>new r.sql.Request(tx),nativeContext:{pool:r.pool,sqlDriver:r.sql,transaction:tx,stockAlreadyReceived:true,testC09Received:true}};
   try{
    const identity=(await c.req().query("SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,CONVERT(char(10),GETDATE(),23) today")).recordset[0];
    if(identity?.db!==DB||identity?.server!==SERVER)fail('TEST_CURRENT_PRICE_IDENTITY','TEST sunucu/veritabanı kimliği eşleşmiyor.',503);
    if(write)await c.req().query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51071,'TEST_CURRENT_PRICE_LOCK_TIMEOUT',1;");
    c.scope=(await c.req().query("SELECT s.*,p.stock_code,p.name product_name,p.current_stock_qty,p.average_cost_try,CONVERT(varchar(50),p.average_cost_try) average_cost_try_text,p.unit product_unit,p.supplier_id product_supplier,t.name supplier_name,t.currency_code supplier_currency,CONVERT(varchar(50),CONVERT(decimal(18,4),t.balance)) supplier_balance_text FROM dbo.test_purchase_fx_scope s JOIN dbo.products p ON p.id=s.product_id JOIN dbo.suppliers t ON t.id=s.supplier_id WHERE s.id=1")).recordset[0];
    const s=c.scope;if(!s||Number(s.product_id)!==301986||Number(s.supplier_id)!==13373||Number(s.product_supplier)!==13373||s.supplier_currency!=='TRY'||s.unit!=='ADET'||s.product_unit!=='ADET'||Number(s.unit_factor)!==1||date(s.document_date)!==DATE||Number(s.max_quantity)!==5||Number(s.max_amount_try)!==200||s.warehouse!=='TEST-DAILY-WH')fail('TEST_CURRENT_PRICE_SCOPE','Sentetik alış kapsamı değişti.',503);
    await r.assertQuarantine([{entity:'product',nativeId:301986},{entity:'supplier',nativeId:13373}],r.quarantineContext(r.sql,tx));
    // Owner procedure verifies its companion manifest and returns exact text.
    const frozen=await c.req().input('actor_id',c.sql.BigInt,16).execute('dbo.usp_get_test_current_price_purchase_context');
    if(frozen.recordsets?.[0]?.length!==1||Object.entries({...CURRENT_PRICE_PURCHASE_SQL_PROOF,consumerGetterHash:getCanonicalBusinessSaleDefinitionHash('dbo.usp_get_test_current_price_purchase_context',CURRENT_PRICE_PURCHASE_SQL_PROOF.consumerGetterHash),consumerAssertHash:getCanonicalBusinessSaleDefinitionHash('dbo.usp_assert_test_current_price_purchase_received',CURRENT_PRICE_PURCHASE_SQL_PROOF.consumerAssertHash)}).some(([key,expected])=>frozen.recordsets[0][0][key]!==expected))fail('TEST_CURRENT_PRICE_SQL_DRIFT','TEST alış okuyucusunun SQL tanımı doğrulanamadı.',503);
    c.choices=frozen.recordsets?.[2];c.rates=frozen.recordsets?.[1];
    c.scope.unit_hash=frozen.recordsets?.[0]?.[0]?.unit_hash;
    hex64(c.scope.unit_hash,'TEST_CURRENT_PRICE_UNIT_HASH');
    if(!Array.isArray(c.choices)||!Array.isArray(c.rates))fail('TEST_CURRENT_PRICE_SNAPSHOT','Dondurulmuş kaynak kanıtı okunamıyor.',503);
    if(c.rates.length!==3)fail('TEST_CURRENT_PRICE_SNAPSHOT','Dondurulmuş fiyat/kur dilimi eksik.',503);
    const value=await fn(c);await tx.commit();return value;
   }catch(e){try{await tx.rollback();}catch{}
    const numbers=[e?.number,e?.originalError?.info?.number,...(e?.precedingErrors??[]).map(error=>error.number)];
    if(numbers.includes(51098))fail('TEST_CURRENT_PRICE_STALE','Fiyat değişti. Güncel fiyatı yükleyip yeniden önizleyin.',409);
    if(numbers.includes(51099))fail('TEST_CURRENT_PRICE_REPLAY_CONFLICT','Bu istek kimliği başka bir işleme ait.',409);
    if(numbers.some(number=>number>=51090&&number<=51097))fail('TEST_CURRENT_PRICE_UNAVAILABLE','TEST fiyat işleminin kaynak ve kayıt korumaları doğrulanamadı.',503);
    throw e;
   }
  };return write?r.withMutation(run):run();
 }
 async function preview(c,input){
  fields(input,['selection','quantity','date','rateVersion']);
  if(input.date!==DATE||input.rateVersion!=='1')fail('TEST_CURRENT_PRICE_PREVIEW_SCOPE','Açık 4 Ekim kur sürümü 1 gerekli.');
  fields(input.selection,['productId','priceId','versionId','revision']);
  if(Object.keys(input.selection).length!==4||input.selection.productId!=='301986'||!['priceId','versionId'].every(k=>typeof input.selection[k]==='string'&&/^[1-9]\d*$/.test(input.selection[k])&&BigInt(input.selection[k])<=9223372036854775807n)||typeof input.selection.revision!=='string'||!/^[A-F0-9]{64}$/.test(input.selection.revision))fail('TEST_CURRENT_PRICE_SELECTION','Geçerli kayıtlı fiyat sürümü gerekli.',400);
  const matches=c.choices.filter(s=>String(s.native_price_id)===input.selection.priceId&&String(s.version_id)===input.selection.versionId&&s.revision===input.selection.revision);
  if(matches.length!==1)fail('TEST_CURRENT_PRICE_STALE','Fiyat değişti. Güncel fiyatı yükleyip yeniden önizleyin.');
  const selected=matches[0],result=previewCurrentPriceSelection({selected,selection:input.selection,quantity:input.quantity,date:input.date,rates:c.rates.map(rate)});
  return {...result,previewHash:hash(result)};
 }
 async function journal(c,input,operation,fn){
  requestId(input.requestId);const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
  const payloadJson=JSON.stringify(stable({operation,input})),digest=createHash('sha256').update(payloadJson,'utf16le').digest('hex').toUpperCase();
  const old=(await c.req().input('id',c.sql.UniqueIdentifier,input.requestId).query('SELECT * FROM dbo.test_current_price_purchase_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=@id')).recordset[0];
  if(old){if(Number(old.actor_id)!==16||old.operation!==operation||old.payload_hash!==digest||old.payload_json!==payloadJson)fail('TEST_CURRENT_PRICE_REPLAY_CONFLICT','Yeniden deneme farklı içerik veya işlem taşıyor.');return {...JSON.parse(old.response_json),replayed:true};}
  const count=(await c.req().query('SELECT COUNT(*) n FROM dbo.test_current_price_purchase_requests WITH(UPDLOCK,HOLDLOCK)')).recordset[0].n;
  if(Number(count)>=100)fail('TEST_CURRENT_PRICE_LIMIT','Bu TEST diliminin 100 işlem sınırı doldu.');
  const value=await fn();await c.req().input('id',c.sql.UniqueIdentifier,input.requestId).input('actor',c.sql.BigInt,16).input('op',c.sql.NVarChar(30),operation).input('hash',c.sql.Char(64),digest).input('payload',c.sql.NVarChar(c.sql.MAX),payloadJson).input('entity',c.sql.BigInt,value.id).input('json',c.sql.NVarChar(c.sql.MAX),JSON.stringify(value)).query('INSERT dbo.test_current_price_purchase_requests(request_id,actor_id,operation,payload_json,payload_hash,entity_id,response_json)VALUES(@id,@actor,@op,@payload,@hash,@entity,@json)');return {...value,replayed:false};
 }
 async function intent(c,id,byInvoice=false){const row=(await c.req().input('id',c.sql.BigInt,positiveId(id)).query(`SELECT t.*,v.reason price_reason,CONVERT(varchar(24),v.created_at,126)+N'Z' price_changed_at,CONVERT(varchar(50),t.price_exact) price_exact_text,CONVERT(varchar(50),t.native_price) native_price_text FROM dbo.test_current_price_purchase_intents t WITH(UPDLOCK,HOLDLOCK) JOIN dbo.test_product_price_versions v ON v.id=t.version_id WHERE ${byInvoice?'invoice_id':'receipt_id'}=@id`)).recordset[0];if(!row)fail('TEST_CURRENT_PRICE_NOT_FOUND','Bu TEST kaydı bulunamadı.',404);return row;}
 function dto(c,t){
  // Historical immutable version, never the mutable current price pointer.
  const selected={native_price_id:t.native_price_id,price_id:t.price_id,version_id:t.version_id,revision:t.before_revision,price_exact_text:t.price_exact_text,price_exact:t.price_exact,currency:t.currency,unit:'ADET',unit_factor:'1.00000000',unit_hash:c.scope.unit_hash,source:'native-operational-price',actor_id:16,reason:t.price_reason,changed_at:t.price_changed_at};
  const selection={productId:'301986',priceId:String(t.native_price_id),versionId:String(t.version_id),revision:t.before_revision};
  const rates=c.rates.filter(r=>Number(r.id)===Number(t.document_rate_id)||Number(r.id)===Number(t.account_rate_id)).map(rate);
  const value=previewCurrentPriceSelection({selected,selection,quantity:checkedFxNumber(fixed(t.quantity,3),3),date:date(t.document_date),rates});
  if(value.nativePriceExact4!==(t.native_price_text??fixed(t.native_price,4))||value.documentAmountExact4!==fixed(t.document_total,4)||value.accountAmountExact4!==fixed(t.account_total,4)||value.amountTryExact4!==fixed(t.amount_try,4)||value.rates.document.rateToTryExact8!==fixed(t.document_rate,8)||value.rates.account.rateToTryExact8!==fixed(t.account_rate,8))fail('TEST_CURRENT_PRICE_SNAPSHOT_DRIFT','Kayıtlı fiyat sürümü/tutar/kur snapshotı eşleşmiyor.');
  return {...value,id:Number(t.invoice_id??t.receipt_id),intentId:Number(t.id),receiptId:Number(t.receipt_id),invoiceId:t.invoice_id===null?null:Number(t.invoice_id),status:t.status,number:t.document_no,previewHash:t.payload_hash};
 }
 async function detail(c,t){const value=dto(c,t);if(t.invoice_id){
  const invoice=await c.native.getPurchaseDraft(t.invoice_id,c.nativeContext),item=invoice.items?.[0];
  if(Number(invoice.id)!==Number(t.invoice_id)||invoice.documentNo!==t.document_no||date(invoice.documentDate)!==date(t.document_date)||Number(invoice.supplierId)!==13373||invoice.documentCurrency!==t.currency||invoice.accountCurrency!=='TRY'||fixed(invoice.exchangeRate,8)!==fixed(t.document_rate,8)||fixed(invoice.accountExchangeRate,8)!==fixed(t.account_rate,8)||fixed(invoice.grandTotal,4)!==value.documentAmountExact4||fixed(invoice.accountAmount,4)!==value.accountAmountExact4||fixed(invoice.amountTry,4)!==value.amountTryExact4||invoice.items?.length!==1||Number(item?.productId)!==301986||fixed(item?.quantity,3)!==fixed(t.quantity,3)||item?.currency!==t.currency||fixed(item?.purchasePrice,4)!==value.nativePriceExact4||Number(item?.lineDiscountRate)!==0)fail('TEST_CURRENT_PRICE_NATIVE_DRIFT','Kayıtlı native fatura kaynak toplam/kur/satır bağıyla eşleşmiyor.');
  value.invoice=invoice;value.status=invoice.status.toLowerCase();
 }return value;}
 async function audit(c,action,_id,value,reason){const draft=action.startsWith('test_current_price_draft_');await c.audit(c.req(),{actor:c.actor,action,entityType:draft?'purchase_invoice':'test_daily_draft',entityId:positiveId(draft?value.invoiceId:value.receiptId),afterSnapshot:value,reason:reason??null});}
 async function assertPostedDebt(c,t,cancelled){
  const proof=(await c.req().input('invoice',c.sql.BigInt,positiveId(t.invoice_id)).input('amount',c.sql.Decimal(18,4),fixed(t.account_total,4))
   .input('currency',c.sql.NVarChar(3),t.currency).input('documentRate',c.sql.Decimal(18,8),fixed(t.document_rate,8)).query(`
   SELECT CONVERT(bit,CASE WHEN
    (SELECT COUNT(*) FROM dbo.supplier_movements WHERE purchase_invoice_id=@invoice)=${cancelled?2:1}
    AND EXISTS(SELECT 1 FROM dbo.supplier_movements WHERE purchase_invoice_id=@invoice AND supplier_id=13373 AND movement_type=N'purchase_invoice' AND account_currency=N'TRY' AND account_amount=@amount AND balance_effect=@amount AND currency_code=@currency AND document_exchange_rate_snapshot=@documentRate AND account_exchange_rate_snapshot=1 AND amount_try=@amount)
    ${cancelled?"AND EXISTS(SELECT 1 FROM dbo.supplier_movements WHERE purchase_invoice_id=@invoice AND supplier_id=13373 AND movement_type=N'purchase_invoice_cancel' AND account_currency=N'TRY' AND account_amount=@amount AND balance_effect=-@amount AND currency_code=@currency AND document_exchange_rate_snapshot=@documentRate AND account_exchange_rate_snapshot=1 AND amount_try=@amount)":''}
    AND (SELECT COALESCE(SUM(balance_effect),0) FROM dbo.supplier_movements WHERE purchase_invoice_id=@invoice)=${cancelled?'0':'@amount'}
    AND EXISTS(SELECT 1 FROM dbo.suppliers s WHERE s.id=13373 AND s.balance=(SELECT COALESCE(SUM(CASE WHEN ISNULL(affects_balance,1)=1 THEN COALESCE(balance_effect_exact,balance_effect) ELSE 0 END),0) FROM dbo.supplier_movements WHERE supplier_id=13373 AND COALESCE(account_currency,currency_code)=N'TRY'))
    THEN 1 ELSE 0 END) currentPricePostingValid;`)).recordset?.[0];
  if(proof?.currentPricePostingValid!==true&&proof?.currentPricePostingValid!==1)fail('TEST_CURRENT_PRICE_POSTING_DRIFT','Alış borcu veya ters hareket fiyat/kur snapshotıyla eşleşmiyor.');
 }
 return {
  context:actor=>atomic(actor,'purchase.view',false,async c=>{
   const rows=(await c.req().query("SELECT t.*,v.reason price_reason,CONVERT(varchar(24),v.created_at,126)+N'Z' price_changed_at,CONVERT(varchar(50),t.price_exact) price_exact_text,CONVERT(varchar(50),t.native_price) native_price_text,g.state receipt_state,p.status invoice_status FROM dbo.test_current_price_purchase_intents t JOIN dbo.test_product_price_versions v ON v.id=t.version_id LEFT JOIN dbo.test_daily_drafts g ON g.id=t.receipt_id LEFT JOIN dbo.purchase_invoices p ON p.id=t.invoice_id ORDER BY t.id")).recordset;
   return {environment:'ISOLATED_TEST',fixture:{productId:301986,supplierId:13373,stockCode:c.scope.stock_code,name:c.scope.product_name,supplierName:c.scope.supplier_name,supplierCurrency:'TRY',supplierBalanceExact4:fixed(c.scope.supplier_balance_text,4),currentAverageCostTryExact4:fixed(c.scope.average_cost_try_text,4),unit:'ADET',factorExact8:'1.00000000',warehouse:'TEST-DAILY-WH',date:DATE,maxQuantity:5,maxAmountTryExact4:'200.0000',currentStock:Number(c.scope.current_stock_qty),maxStock:40},quotes:c.choices.map(s=>({selection:{productId:'301986',priceId:String(s.native_price_id),versionId:String(s.version_id),revision:s.revision},currency:s.currency,priceExact:s.price_exact_text??(s.price_exact==null?null:fixed(s.price_exact,8)),sourceProof:currentPriceProof(s)})),rates:c.rates.map(rate),receipts:rows.map(t=>({...dto(c,t),id:Number(t.receipt_id),state:t.receipt_state})),invoiceDrafts:rows.filter(t=>t.invoice_id).map(t=>({...dto(c,t),status:t.invoice_status}))};
  }),
  preview:(input,actor)=>atomic(actor,'purchase.view',false,c=>preview(c,input)),
  createReceipt:(input,actor)=>atomic(actor,'goods.create',true,c=>journal(c,input,'quote_create',async()=>{
   permission(actor,'purchase.view');fields(input,['requestId','selection','quantity','date','rateVersion','previewHash']);
   const p=await preview(c,{selection:input.selection,quantity:input.quantity,date:input.date,rateVersion:input.rateVersion});
   if(!p.writable||p.previewHash!==input.previewHash)fail('TEST_CURRENT_PRICE_PREVIEW_CHANGED','Yazılabilir TEST kopyası ve güncel önizleme gerekli.');
   const number='TDAY-C09-'+hash(input.requestId).slice(0,20),q=c.sql;
   const t=(await c.req().input('request',q.UniqueIdentifier,input.requestId).input('native',q.BigInt,p.selection.priceId).input('version',q.BigInt,p.selection.versionId).input('revision',q.Char(64),p.selection.revision).input('quantity',q.Decimal(18,3),p.quantity).input('hash',q.Char(64),p.previewHash).input('number',q.NVarChar(30),number).query(`INSERT dbo.test_current_price_purchase_intents(request_id,actor_id,status,price_id,version_id,native_price_id,before_revision,price_exact,native_price,currency,quantity,document_rate_id,account_rate_id,document_rate,account_rate,document_total,account_total,amount_try,payload_hash,document_no,document_date,unit,unit_factor)
    SELECT @request,16,N'quoted',s.id,v.id,s.native_price_id,@revision,v.price_exact,ROUND(v.price_exact,4),s.currency,@quantity,d.id,a.id,d.rate_exact,a.rate_exact,ROUND(v.price_exact,4)*@quantity,ROUND(ROUND(v.price_exact,4)*@quantity*d.rate_exact/a.rate_exact,4),ROUND(ROUND(v.price_exact,4)*@quantity*d.rate_exact,4),@hash,@number,sc.document_date,N'ADET',1 FROM dbo.test_product_price_current s JOIN dbo.test_product_price_versions v ON v.id=s.version_id AND v.price_id=s.id JOIN dbo.test_purchase_fx_rates d ON d.currency=s.currency JOIN dbo.test_purchase_fx_rates a ON a.currency=N'TRY' CROSS JOIN dbo.test_purchase_fx_scope sc WHERE s.native_price_id=@native AND s.version_id=@version AND s.product_id=301986 AND s.type=N'purchase' AND s.unit_id IS NULL AND s.tier=0 AND sc.id=1;IF @@ROWCOUNT<>1 THROW 51098,'TEST_PRODUCT_PRICE_STALE',1;SELECT CAST(SCOPE_IDENTITY() AS bigint) id;`)).recordset[0];
   const unitCost=fromUnits((BigInt(p.amountTryExact4.replace('.',''))+BigInt(p.quantity)/2n)/BigInt(p.quantity),4);
   const payload={marker:'C09PRICE',intentId:Number(t.id),quantity:p.quantity,unit:'ADET',unitFactor:1,warehouse:'TEST-DAILY-WH',date:DATE,unitCostTry:checkedFxNumber(unitCost,4),amountTry:checkedFxNumber(p.amountTryExact4,4)};
   const g=(await c.req().input('payload',q.NVarChar(q.MAX),JSON.stringify(payload)).query("INSERT dbo.test_daily_drafts(flow,kind,state,payload_json,created_by)VALUES(N'purchase',N'goods',N'pending',@payload,16);SELECT CAST(SCOPE_IDENTITY() AS bigint) id;")).recordset[0];
   await c.req().input('intent',q.BigInt,t.id).input('receipt',q.BigInt,g.id).query('UPDATE dbo.test_current_price_purchase_intents SET receipt_id=@receipt WHERE id=@intent');
   const value={...dto(c,await intent(c,g.id)),state:'pending'};
   if(value.documentAmountExact4!==p.documentAmountExact4||value.accountAmountExact4!==p.accountAmountExact4||value.amountTryExact4!==p.amountTryExact4)fail('TEST_CURRENT_PRICE_TOTAL_DRIFT','Kalıcı SQL tutarı yetkili önizlemeyle eşleşmiyor.');
   await audit(c,'test_current_price_receipt_created',g.id,value);return value;
  })),
  decideReceipt:(id,input,actor,approve)=>atomic(actor,approve?'goods.approve':'goods.reject',true,c=>journal(c,{...input,id:positiveId(id)},approve?'receipt_accept':'receipt_reject',async()=>{
   permission(actor,'purchase.view');fields(input,['requestId','reason']);if(!approve||input.reason!==undefined)reason(input.reason);const t=await intent(c,id);if(t.status!=='quoted')fail('TEST_CURRENT_PRICE_RECEIPT_STATE','Yalnız bekleyen kabul kararı verilebilir.');
   const q=c.sql;
   if(approve){
    if(Number(c.scope.current_stock_qty)<0||Number(c.scope.current_stock_qty)+Number(t.quantity)>40||!(Number(c.scope.average_cost_try)>0))fail('TEST_CURRENT_PRICE_STOCK_BOUND','TEST stok miktarı 40 sınırını aşıyor veya maliyet bilinmiyor.');
    await c.req().input('id',q.BigInt,t.id).query(`UPDATE t SET status=N'receiving',stock_before=p.current_stock_qty,cost_before=p.average_cost_try,stock_after=p.current_stock_qty+t.quantity,cost_after=ROUND((p.current_stock_qty*p.average_cost_try+t.amount_try)/(p.current_stock_qty+t.quantity),4) FROM dbo.test_current_price_purchase_intents t JOIN dbo.products p ON p.id=301986 WHERE t.id=@id AND t.status=N'quoted';IF EXISTS(SELECT 1 FROM dbo.test_current_price_purchase_intents WHERE id=@id AND (cost_after<=0 OR cost_after>200 OR stock_after>40)) THROW 51070,'TEST_CURRENT_PRICE_COST_BOUND',1;`);
   }
   await c.req().input('id',q.BigInt,positiveId(id)).input('state',q.NVarChar(20),approve?'approved':'rejected').input('reason',q.NVarChar(500),approve?(input.reason??null):reason(input.reason)).query('UPDATE dbo.test_daily_drafts SET state=@state,decided_by=16,reason=@reason WHERE id=@id AND state=N\'pending\'');
   if(approve)await c.req().input('id',q.BigInt,t.id).query(`UPDATE p SET current_stock_qty=t.stock_after,average_cost_try=t.cost_after FROM dbo.products p JOIN dbo.test_current_price_purchase_intents t ON p.id=301986 WHERE t.id=@id;
    INSERT dbo.stock_movements(product_id,movement_type,source_type,source_id,quantity_in,quantity_out,quantity_net,unit_cost_try,average_cost_try_after,document_date,supplier_id,created_by,unit_price,currency_code,amount_try,warehouse_name,source_warehouse)
    SELECT 301986,N'in',N'goods_receipt',receipt_id,quantity,0,quantity,ROUND(amount_try/quantity,4),cost_after,document_date,13373,16,ROUND(amount_try/quantity,4),N'TRY',amount_try,N'TEST-DAILY-WH',N'TEST-DAILY-WH' FROM dbo.test_current_price_purchase_intents WHERE id=@id;
    UPDATE dbo.test_current_price_purchase_intents SET status=N'received' WHERE id=@id;`);
   else await c.req().input('id',q.BigInt,t.id).query("UPDATE dbo.test_current_price_purchase_intents SET status=N'rejected' WHERE id=@id");
   const value={...dto(c,await intent(c,id)),state:approve?'approved':'rejected'};await audit(c,approve?'test_current_price_receipt_approved':'test_current_price_receipt_rejected',positiveId(id),value,input.reason);return value;
  })),
  createDraft:(input,actor)=>atomic(actor,'purchase.create',true,c=>journal(c,input,'draft_create',async()=>{
   permission(actor,'purchase.view');fields(input,['requestId','receiptId','previewHash']);const t=await intent(c,input.receiptId);
   if(t.status!=='received'||t.invoice_id||t.payload_hash!==input.previewHash)fail('TEST_CURRENT_PRICE_DRAFT_STATE','Onaylı, kullanılmamış aynı kabul önizlemesi gerekli.');dto(c,t);
   const payload={documentNo:t.document_no,documentDate:date(t.document_date),supplierId:13373,supplierName:c.scope.supplier_name,supplierCurrency:'TRY',documentCurrency:t.currency,exchangeRate:checkedFxNumber(fixed(t.document_rate,8),8),accountExchangeRate:checkedFxNumber(fixed(t.account_rate,8),8),invoiceDiscountRate:0,description:`C09PRICE TEST kabul #${t.receipt_id}`,items:[{productId:301986,stockCode:c.scope.stock_code,productName:c.scope.product_name,quantity:checkedFxNumber(fixed(t.quantity,3),3),currency:t.currency,purchasePrice:checkedFxNumber(t.native_price_text??fixed(t.native_price,4),4),lineDiscountRate:0,stockEffect:'goods_receipt_already_posted'}]};
   const normalized=c.native.normalizePurchasePayload(payload);if(fixed(normalized.grandTotal,4)!==fixed(t.document_total,4))fail('TEST_CURRENT_PRICE_NATIVE_TOTAL','Native fatura toplamı kaynak hesapla eşleşmiyor.');
   await c.req().input('id',c.sql.BigInt,t.id).query("UPDATE dbo.test_current_price_purchase_intents SET status=N'registered' WHERE id=@id");
   const invoice=await c.native.createPurchaseDraft(payload,actor,c.nativeContext);
   await c.req().input('id',c.sql.BigInt,t.id).input('invoice',c.sql.BigInt,invoice.id).query("UPDATE dbo.test_current_price_purchase_intents SET invoice_id=@invoice,status=N'linked' WHERE id=@id");
   const value=await detail(c,await intent(c,invoice.id,true));await audit(c,'test_current_price_draft_created',invoice.id,value);return value;
  })),
  getDraft:(id,actor)=>atomic(actor,'purchase.view',false,async c=>detail(c,await intent(c,id,true))),
  finalizeDraft:(id,input,actor)=>atomic(actor,'purchase.finalize',true,c=>journal(c,{...input,id:positiveId(id)},'draft_finalize',async()=>{
   permission(actor,'purchase.view');fields(input,['requestId']);const t=await intent(c,id,true);if(t.status!=='linked')fail('TEST_CURRENT_PRICE_DRAFT_STATE','Aktif bağlı TEST taslağı gerekli.');
   const before=await detail(c,t);if(before.status!=='draft')fail('TEST_CURRENT_PRICE_DRAFT_STATE','Yalnız taslak fatura kesinleştirilebilir.');
   await c.native.finalizePurchaseInvoice(id,actor,c.nativeContext);await assertPostedDebt(c,t,false);const value=await detail(c,t);await audit(c,'test_current_price_draft_finalized',positiveId(id),value);return value;
  })),
  cancelDraft:(id,input,actor)=>atomic(actor,'purchase.cancel',true,c=>journal(c,{...input,id:positiveId(id)},'draft_cancel',async()=>{
   permission(actor,'purchase.view');fields(input,['requestId','reason']);const cancelReason=reason(input.reason),t=await intent(c,id,true);if(t.status!=='linked')fail('TEST_CURRENT_PRICE_DRAFT_STATE','Aktif bağlı TEST faturası gerekli.');
   const before=await detail(c,t);
   if(before.status==='draft')await c.req().input('id',c.sql.BigInt,positiveId(id)).input('reason',c.sql.NVarChar(500),cancelReason).query("UPDATE dbo.purchase_invoices SET status=N'cancelled',cancel_reason=@reason,cancelled_at=SYSUTCDATETIME(),updated_by=16,updated_at=SYSUTCDATETIME() WHERE id=@id AND status=N'draft'");
   else if(before.status==='finalized'){await c.native.cancelPurchaseInvoice(id,{...input,reason:cancelReason},actor,c.nativeContext);await assertPostedDebt(c,t,true);}
   else fail('TEST_CURRENT_PRICE_DRAFT_STATE','Fatura zaten iptal edilmiş.');
   await c.req().input('id',c.sql.BigInt,t.id).query("UPDATE dbo.test_current_price_purchase_intents SET status=N'cancelled' WHERE id=@id");
   const value=await detail(c,await intent(c,id,true));await audit(c,'test_current_price_draft_cancelled',positiveId(id),value,input.reason);return value;
  })),
 };
}
export const testCurrentPricePurchaseService=createTestCurrentPricePurchaseService();

