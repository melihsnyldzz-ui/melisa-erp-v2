import {purchasePriceBindingHash as hash,selectPurchasePrice,calculatePurchasePriceSettlement,projectPurchasePriceExact8} from './purchasePriceSelectionModel.mjs';

const fail=(code,message,statusCode=409)=>{throw Object.assign(new Error(message),{code,statusCode});};
const DB='MELISA_ERP_SIRKET_TEST_20260929_01',SERVER='Semih\\MELISADEV',DATE='2026-10-04';
function fields(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail('TEST_FX_INPUT','Kapsam dışı alan gönderildi.',400);}
function positiveId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<1)fail('TEST_FX_ID','Geçerli kayıt kimliği gerekli.',400);return n;}
function permission(actor,key){if(Number(actor?.id)!==16||!actor.permissions?.includes(key))fail('TEST_FX_PERMISSION','Bu TEST işlemi için İlker ve ilgili izin gerekli.',403);}
function requestId(value){if(typeof value!=='string'||!/^[A-Za-z0-9-]{16,64}$/.test(value))fail('TEST_FX_REQUEST_ID','Geçerli yeniden deneme kimliği gerekli.',400);return value;}
function reason(value){if(typeof value!=='string'||value.trim().length<3||value.trim().length>500)fail('TEST_FX_REASON','Gerekçe 3–500 karakter olmalı.',400);return value.trim();}
const date=v=>v instanceof Date?v.toISOString().slice(0,10):String(v).slice(0,10);
const fixed=(v,n)=>{if(v===null||v===undefined||v===''||!['string','number'].includes(typeof v)||!Number.isFinite(Number(v)))fail('TEST_FX_DECIMAL_REQUIRED','Kayıtlı kesin tutar eksik veya geçersiz.',503);return typeof v==='string'&&new RegExp(`^-?\\d+\\.\\d{${n}}$`).test(v)?v:Number(v).toFixed(n);};
const fromUnits=(v,n)=>{const s=v.toString().padStart(n+1,'0');return s.slice(0,-n)+'.'+s.slice(-n);};
export function checkedFxNumber(exact,scale){if(typeof exact!=='string'||!new RegExp(`^(0|[1-9]\\d*)\\.\\d{${scale}}$`).test(exact)||BigInt(exact.replace('.',''))>BigInt(Number.MAX_SAFE_INTEGER)||!Number.isFinite(Number(exact))||Number(exact).toFixed(scale)!==exact)fail('TEST_FX_NUMBER_BOUNDARY','Native sayı hassasiyeti güvenle korunamıyor.');return Number(exact);}
function hex64(value,code){if(typeof value!=='string'||!/^[a-fA-F0-9]{64}$/.test(value))fail(code,'Kayıtlı hash kanıtı geçersiz.',503);return value.toLowerCase();}
const rate=r=>{if(!r)fail('TEST_FX_RATE_REQUIRED','Dondurulmuş kur kaydı eksik.',503);return {currency:r.currency,rateToTryExact8:r.rate_exact_text??fixed(r.rate_exact,8),source:r.source,sourceId:r.source_id,asOf:date(r.as_of),version:String(r.version),hash:hex64(r.hash,'TEST_FX_RATE_HASH')};};
const selection=s=>({productId:String(s.origin_product_id),priceId:String(s.origin_price_id),productSourceKey:s.origin_product_source_key,priceSourceKey:s.origin_price_source_key,runId:s.run_id,sourceHash:s.source_hash,planHash:s.plan_hash,type:'purchase',unitSourceId:null,tier:0,currency:s.currency,priceExact:s.price_exact_text??fixed(s.price_exact,8)});
const proof=s=>({productId:String(s.origin_product_id),priceId:String(s.origin_price_id),productSourceKey:s.origin_product_source_key,priceSourceKey:s.origin_price_source_key,mainUnitSourceId:String(s.main_unit_source_id),runId:s.run_id,sourceHash:s.source_hash,planHash:s.plan_hash,bindingsHash:s.bindings_hash,sourceAsOf:date(s.source_as_of),readOnly:true,sourceFreshLive:false,cutoverAccepted:false});

async function defaultRuntime(){
 const database=await import('../config/database.js');if(!database.isCanonicalTest())fail('TEST_FX_ENVIRONMENT','Yalnız kanonik izole TEST kullanılabilir.',503);
 const [native,opening,quarantine,audit,scope]=await Promise.all([import('./invoiceDraftService.js'),import('./openingPriceService.js'),import('./operationQuarantineService.js'),import('./auditService.js'),import('./testSalesScope.mjs')]);
 return {pool:await database.getSqlPool(),sql:database.getSqlDriver(),native,readOpening:id=>opening.openingPriceService.detail(String(id)),assertQuarantine:quarantine.assertOperationQuarantineAllowed,quarantineContext:quarantine.quarantineTransactionContext,audit:audit.writeAuditLog,withMutation:scope.withTestSalesMutation};
}

// The injectable runtime supports orchestration tests; production executes the
// same SQL and shared native purchase writer in one serializable transaction.
export function createTestPurchaseFxService({runtime=defaultRuntime}={}){
 async function atomic(actor,required,write,fn){
  permission(actor,required);permission(actor,'purchase.view');permission(actor,'product.view');const r=await runtime();
  const run=async()=>{const tx=new r.sql.Transaction(r.pool);await tx.begin(r.sql.ISOLATION_LEVEL.SERIALIZABLE);
   const c={...r,tx,actor,req:()=>new r.sql.Request(tx),nativeContext:{pool:r.pool,sqlDriver:r.sql,transaction:tx,stockAlreadyReceived:true,testPurchaseFxReceived:true}};
   try{
    const identity=(await c.req().query("SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,CONVERT(char(10),GETDATE(),23) today")).recordset[0];
    if(identity?.db!==DB||identity?.server!==SERVER)fail('TEST_FX_IDENTITY','TEST sunucu/veritabanı kimliği eşleşmiyor.',503);
    if(write)await c.req().query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51071,'TEST_FX_LOCK_TIMEOUT',1;");
    c.scope=(await c.req().query("SELECT s.*,p.stock_code,p.name product_name,p.current_stock_qty,p.average_cost_try,CONVERT(varchar(50),p.average_cost_try) average_cost_try_text,p.unit product_unit,p.supplier_id product_supplier,t.name supplier_name,t.currency_code supplier_currency,CONVERT(varchar(50),CONVERT(decimal(18,4),t.balance)) supplier_balance_text FROM dbo.test_purchase_fx_scope s JOIN dbo.products p ON p.id=s.product_id JOIN dbo.suppliers t ON t.id=s.supplier_id WHERE s.id=1")).recordset[0];
    const s=c.scope;if(!s||Number(s.product_id)!==301986||Number(s.supplier_id)!==13373||Number(s.product_supplier)!==13373||s.supplier_currency!=='TRY'||s.unit!=='ADET'||s.product_unit!=='ADET'||Number(s.unit_factor)!==1||date(s.document_date)!==DATE||Number(s.max_quantity)!==5||Number(s.max_amount_try)!==200||s.warehouse!=='TEST-DAILY-WH')fail('TEST_FX_SCOPE','Sentetik alış kapsamı değişti.',503);
    await r.assertQuarantine([{entity:'product',nativeId:301986},{entity:'supplier',nativeId:13373}],r.quarantineContext(r.sql,tx));
    // Owner procedure verifies its companion manifest and returns exact text.
    const frozen=await c.req().execute('dbo.usp_get_test_purchase_fx_context');
    c.sources=frozen.recordsets?.[2];c.rates=frozen.recordsets?.[1];
    if(!Array.isArray(c.sources)||!Array.isArray(c.rates))fail('TEST_FX_SNAPSHOT','Dondurulmuş kaynak kanıtı okunamıyor.',503);
    if(c.sources.length!==2||c.rates.length!==3)fail('TEST_FX_SNAPSHOT','Dondurulmuş fiyat/kur dilimi eksik.',503);
    const value=await fn(c);await tx.commit();return value;
   }catch(e){try{await tx.rollback();}catch{}throw e;}
  };return write?r.withMutation(run):run();
 }
 async function unitEvidence(c,selected){
  const rows=(await c.req().input('product_id',c.sql.BigInt,selected.productId).execute('dbo.usp_get_test_purchase_fx_unit_evidence')).recordset;
  const matches=rows.filter(r=>String(r.origin_price_id)===selected.priceId&&r.currency===selected.currency);
  const row=matches[0];
  if(matches.length!==1||row.unit_status!=='VERIFIED_ADET_FACTOR_1'||row.unit!=='ADET'||fixed(row.unit_factor,8)!=='1.00000000'||String(row.origin_product_id)!==selected.productId||row.origin_product_source_key!==selected.productSourceKey||row.origin_price_source_key!==selected.priceSourceKey||row.price_exact!==selected.priceExact||row.run_id!==selected.runId||row.source_hash!==selected.sourceHash||row.plan_hash!==selected.planHash)fail('TEST_FX_UNIT_PROOF','Kaynak operasyon birimi/fiyat bağı doğrulanamadı.');
  return {unit:{productId:selected.productId,mainUnitSourceId:String(row.main_unit_source_id),unit:'ADET',factorExact8:'1.00000000',source:'accepted-opening-unit-evidence',sourceKey:row.origin_product_source_key,version:row.run_id,hash:hex64(row.product_binding_hash,'TEST_FX_UNIT_HASH')},row};
 }
 async function preview(c,input){
  fields(input,['selection','quantity','date','rateVersion']);
  if(!Number.isInteger(input.quantity)||input.quantity<1||input.quantity>5||input.date!==DATE||input.rateVersion!=='1')fail('TEST_FX_PREVIEW_SCOPE','Miktar 1–5 ve açık 4 Ekim kur sürümü 1 gerekli.');
  positiveId(input.selection?.productId);
  const read=await c.readOpening(input.selection.productId);if(!read.data.accepted)fail('TEST_FX_SOURCE','Kabul edilmiş kaynak fiyatı gerekli.');
  const copy=c.sources.find(s=>hash(selection(s))===hash(input.selection));
  const meta=read.meta;
  const expectedSource={source:'accepted-native-opening-prices',runId:meta.runId,sourceHash:meta.sourceHash,planHash:meta.planHash,sourceAsOf:date(meta.sourceAsOf),readOnly:true,sourceFreshLive:false,cutoverAccepted:false};
  const evidence=await unitEvidence(c,input.selection),unit=evidence.unit;
  const priceContext={selection:input.selection,product:read.data,prices:read.data.prices,source:expectedSource,expectedSource,unitEvidence:unit,expectedUnitEvidence:unit};
  // The model deliberately accepts only its narrow product shape.
  priceContext.product={productId:read.data.productId,productSourceKey:read.data.productSourceKey,mainUnitSourceId:read.data.mainUnitSourceId};
  const chosen=selectPurchasePrice(priceContext);
  if(!['USD','EUR'].includes(chosen.currency))fail('TEST_FX_CURRENCY','Bu dilimde USD veya EUR alış fiyatı gerekli.');
  const document=rate(c.rates.find(r=>r.currency===chosen.currency)),account=rate(c.rates.find(r=>r.currency==='TRY'));
  const amounts=calculatePurchasePriceSettlement({priceContext,quantityExact3:input.quantity.toFixed(3),documentCurrency:chosen.currency,accountCurrency:'TRY',documentRateQuote:document,accountRateQuote:account,expectedDocumentRateQuote:document,expectedAccountRateQuote:account,documentDate:input.date});
  checkedFxNumber(document.rateToTryExact8,8);checkedFxNumber(account.rateToTryExact8,8);checkedFxNumber(amounts.quantityExact3,3);
  if(!chosen.nativeNumberBoundary.safe||Object.values(amounts.nativeNumberBoundary).some(b=>!b.safe))fail('TEST_FX_NUMBER_BOUNDARY','Native fiş tutarı güvenle aktarılamıyor.');
  if(copy&&(unit.mainUnitSourceId!==String(copy.main_unit_source_id)||unit.hash!==hex64(copy.product_binding_hash,'TEST_FX_UNIT_HASH')||evidence.row.price_binding_hash!==copy.price_binding_hash||evidence.row.native_price_row_hash!==copy.native_price_row_hash||chosen.nativePriceExact4!==(copy.native_price_text??fixed(copy.native_price,4))))fail('TEST_FX_COPY_DRIFT','TEST fiyat kopyası kaynak bağıyla eşleşmiyor.');
  const sourceProof=copy?proof(copy):{productId:read.data.productId,priceId:chosen.priceId,productSourceKey:read.data.productSourceKey,priceSourceKey:input.selection.priceSourceKey,mainUnitSourceId:unit.mainUnitSourceId,...expectedSource};
  const result={selection:input.selection,quantity:input.quantity,date:input.date,currency:chosen.currency,accountCurrency:'TRY',projection:{priceExact:chosen.priceExact,nativePriceExact4:chosen.nativePriceExact4,roundingDeltaExact8:chosen.roundingDeltaExact8,roundingRequired:chosen.roundingRequired},documentAmountExact4:amounts.documentAmountExact4,accountAmountExact4:amounts.accountAmountExact4,amountTryExact4:amounts.amountTryExact4,rates:{document,account},sourceProof,operationalUnit:unit,writable:Boolean(copy)&&BigInt(amounts.amountTryExact4.replace('.',''))>0n&&BigInt(amounts.amountTryExact4.replace('.',''))<=2000000n,copyQuoteId:copy?.currency??null,synthetic:true,targetProductId:301986,supplierId:13373};
  return {...result,previewHash:hash(result)};
 }
 async function journal(c,input,operation,fn){
  requestId(input.requestId);const digest=hash({operation,input});
  const old=(await c.req().input('id',c.sql.NVarChar(64),input.requestId).query('SELECT * FROM dbo.test_purchase_fx_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=@id')).recordset[0];
  if(old){if(Number(old.actor_id)!==16||old.operation!==operation||old.payload_hash!==digest)fail('TEST_FX_REPLAY_CONFLICT','Yeniden deneme farklı içerik veya işlem taşıyor.');return {...JSON.parse(old.response_json),replayed:true};}
  const count=(await c.req().query('SELECT COUNT(*) n FROM dbo.test_purchase_fx_requests WITH(UPDLOCK,HOLDLOCK)')).recordset[0].n;
  if(Number(count)>=50)fail('TEST_FX_LIMIT','Bu TEST diliminin 50 işlem sınırı doldu.');
  const value=await fn();await c.req().input('id',c.sql.NVarChar(64),input.requestId).input('actor',c.sql.BigInt,16).input('op',c.sql.NVarChar(30),operation).input('hash',c.sql.Char(64),digest).input('entity',c.sql.BigInt,value.id).input('json',c.sql.NVarChar(c.sql.MAX),JSON.stringify(value)).query('INSERT dbo.test_purchase_fx_requests(request_id,actor_id,operation,payload_hash,entity_id,response_json)VALUES(@id,@actor,@op,@hash,@entity,@json)');return {...value,replayed:false};
 }
 async function intent(c,id,byInvoice=false){const row=(await c.req().input('id',c.sql.BigInt,positiveId(id)).query(`SELECT *,CONVERT(varchar(50),price_exact) price_exact_text,CONVERT(varchar(50),native_price) native_price_text FROM dbo.test_purchase_fx_intents WITH(UPDLOCK,HOLDLOCK) WHERE ${byInvoice?'invoice_id':'receipt_id'}=@id`)).recordset[0];if(!row)fail('TEST_FX_NOT_FOUND','Bu TEST kaydı bulunamadı.',404);return row;}
 function dto(c,t){
  const s=c.sources.find(s=>s.currency===t.currency);if(!s||hash(selection(s))!==hash(selection(t)))fail('TEST_FX_COPY_DRIFT','Kayıtlı kaynak kopyası değişti.');
  const dr=c.rates.find(r=>Number(r.id)===Number(t.document_rate_id)),ar=c.rates.find(r=>Number(r.id)===Number(t.account_rate_id));
  if(!dr||!ar||fixed(t.document_rate,8)!==rate(dr).rateToTryExact8||fixed(t.account_rate,8)!==rate(ar).rateToTryExact8)fail('TEST_FX_RATE_DRIFT','Kayıtlı kur bağı değişti.');
  const projection=projectPurchasePriceExact8(selection(t).priceExact);if(projection.nativePriceExact4!==(t.native_price_text??fixed(t.native_price,4)))fail('TEST_FX_PRICE_DRIFT','Kayıtlı fiyat projeksiyonu değişti.');
  const quantity=checkedFxNumber(fixed(t.quantity,3),3);
  if(!Number.isInteger(quantity)||quantity<1||quantity>5)fail('TEST_FX_QUANTITY_DRIFT','Kayıtlı fiziksel miktar kapsam dışı.');
  const documentUnits=BigInt(projection.nativePriceExact4.replace('.',''))*BigInt(quantity),tryUnits=(documentUnits*BigInt(rate(dr).rateToTryExact8.replace('.',''))+50000000n)/100000000n;
  if(fixed(t.document_total,4)!==fromUnits(documentUnits,4)||fixed(t.account_total,4)!==fromUnits(tryUnits,4)||fixed(t.amount_try,4)!==fromUnits(tryUnits,4))fail('TEST_FX_TOTAL_DRIFT','Kayıtlı tutar fiyat/miktar/kur bağıyla eşleşmiyor.');
  return {id:Number(t.invoice_id??t.receipt_id),intentId:Number(t.id),receiptId:Number(t.receipt_id),status:t.status,number:t.document_no,date:date(t.document_date),currency:t.currency,accountCurrency:'TRY',quantity:Number(t.quantity),previewHash:t.payload_hash,documentAmountExact4:fixed(t.document_total,4),accountAmountExact4:fixed(t.account_total,4),amountTryExact4:fixed(t.amount_try,4),priceExact:projection.priceExact,nativePriceExact4:projection.nativePriceExact4,projection,rates:{document:rate(dr),account:rate(ar)},sourceProof:proof(s),operationalUnit:{productId:String(s.origin_product_id),mainUnitSourceId:String(s.main_unit_source_id),unit:'ADET',factorExact8:'1.00000000',source:'accepted-opening-unit-evidence',sourceKey:s.origin_product_source_key,version:s.run_id,hash:hex64(s.product_binding_hash,'TEST_FX_UNIT_HASH')}};
 }
 async function detail(c,t){const value=dto(c,t);if(t.invoice_id){
  const invoice=await c.native.getPurchaseDraft(t.invoice_id,c.nativeContext),item=invoice.items?.[0];
  if(Number(invoice.id)!==Number(t.invoice_id)||invoice.documentNo!==t.document_no||date(invoice.documentDate)!==date(t.document_date)||Number(invoice.supplierId)!==13373||invoice.documentCurrency!==t.currency||invoice.accountCurrency!=='TRY'||fixed(invoice.exchangeRate,8)!==fixed(t.document_rate,8)||fixed(invoice.accountExchangeRate,8)!==fixed(t.account_rate,8)||fixed(invoice.grandTotal,4)!==value.documentAmountExact4||fixed(invoice.accountAmount,4)!==value.accountAmountExact4||fixed(invoice.amountTry,4)!==value.amountTryExact4||invoice.items?.length!==1||Number(item?.productId)!==301986||fixed(item?.quantity,3)!==fixed(t.quantity,3)||item?.currency!==t.currency||fixed(item?.purchasePrice,4)!==value.nativePriceExact4||Number(item?.lineDiscountRate)!==0)fail('TEST_FX_NATIVE_DRIFT','Kayıtlı native fatura kaynak toplam/kur/satır bağıyla eşleşmiyor.');
  value.invoice=invoice;value.status=invoice.status.toLowerCase();
 }return value;}
 async function audit(c,action,_id,value,reason){await c.audit(c.req(),{actor:c.actor,action,entityType:'test_daily_draft',entityId:positiveId(value.receiptId),afterSnapshot:value,reason:reason??null});}
 return {
  context:actor=>atomic(actor,'purchase.view',false,async c=>{
   const rows=(await c.req().query('SELECT t.*,CONVERT(varchar(50),t.price_exact) price_exact_text,CONVERT(varchar(50),t.native_price) native_price_text,g.state receipt_state,p.status invoice_status FROM dbo.test_purchase_fx_intents t LEFT JOIN dbo.test_daily_drafts g ON g.id=t.receipt_id LEFT JOIN dbo.purchase_invoices p ON p.id=t.invoice_id ORDER BY t.id')).recordset;
   return {environment:'ISOLATED_TEST',fixture:{productId:301986,supplierId:13373,stockCode:c.scope.stock_code,name:c.scope.product_name,supplierName:c.scope.supplier_name,supplierCurrency:'TRY',supplierBalanceExact4:fixed(c.scope.supplier_balance_text,4),currentAverageCostTryExact4:fixed(c.scope.average_cost_try_text,4),unit:'ADET',factorExact8:'1.00000000',warehouse:'TEST-DAILY-WH',date:DATE,maxQuantity:5,maxAmountTryExact4:'200.0000',currentStock:Number(c.scope.current_stock_qty),maxStock:40},sourceChoices:c.sources.map(s=>({selection:selection(s),copyQuoteId:s.currency,currency:s.currency,sourceProof:proof(s)})),rates:c.rates.map(rate),receipts:rows.map(t=>({...dto(c,t),id:Number(t.receipt_id),state:t.receipt_state})),invoiceDrafts:rows.filter(t=>t.invoice_id).map(t=>({...dto(c,t),status:t.invoice_status}))};
  }),
  preview:(input,actor)=>atomic(actor,'purchase.view',false,c=>preview(c,input)),
  createReceipt:(input,actor)=>atomic(actor,'goods.create',true,c=>journal(c,input,'quote_create',async()=>{
   permission(actor,'purchase.view');fields(input,['requestId','selection','quantity','date','rateVersion','previewHash']);
   const p=await preview(c,{selection:input.selection,quantity:input.quantity,date:input.date,rateVersion:input.rateVersion});
   if(!p.writable||p.previewHash!==input.previewHash)fail('TEST_FX_PREVIEW_CHANGED','Yazılabilir TEST kopyası ve güncel önizleme gerekli.');
   const number='TDAY-FXQ-'+hash(input.requestId).slice(0,20),q=c.sql;
   const t=(await c.req().input('request',q.NVarChar(64),input.requestId).input('currency',q.NVarChar(3),p.currency).input('quantity',q.Decimal(18,3),p.quantity).input('hash',q.Char(64),p.previewHash).input('number',q.NVarChar(30),number).query(`INSERT dbo.test_purchase_fx_intents(request_id,actor_id,status,origin_product_id,origin_price_id,origin_product_source_key,origin_price_source_key,run_id,source_hash,plan_hash,bindings_hash,source_as_of,price_exact,native_price,currency,quantity,document_rate_id,account_rate_id,document_rate,account_rate,document_total,account_total,amount_try,payload_hash,document_no,document_date,unit,unit_factor)
    SELECT @request,16,N'quoted',s.origin_product_id,s.origin_price_id,s.origin_product_source_key,s.origin_price_source_key,s.run_id,s.source_hash,s.plan_hash,s.bindings_hash,s.source_as_of,s.price_exact,s.native_price,s.currency,@quantity,d.id,a.id,d.rate_exact,a.rate_exact,ROUND(s.native_price*@quantity,4),ROUND(s.native_price*@quantity*d.rate_exact/a.rate_exact,4),ROUND(s.native_price*@quantity*d.rate_exact,4),@hash,@number,sc.document_date,N'ADET',1 FROM dbo.test_purchase_fx_sources s JOIN dbo.test_purchase_fx_rates d ON d.currency=s.currency JOIN dbo.test_purchase_fx_rates a ON a.currency=N'TRY' CROSS JOIN dbo.test_purchase_fx_scope sc WHERE s.currency=@currency AND sc.id=1;SELECT CAST(SCOPE_IDENTITY() AS bigint) id;`)).recordset[0];
   const unitCost=fromUnits((BigInt(p.amountTryExact4.replace('.',''))+BigInt(p.quantity)/2n)/BigInt(p.quantity),4);
   const payload={marker:'C03FX',intentId:Number(t.id),quantity:p.quantity,unit:'ADET',unitFactor:1,warehouse:'TEST-DAILY-WH',date:DATE,unitCostTry:checkedFxNumber(unitCost,4),amountTry:checkedFxNumber(p.amountTryExact4,4)};
   const g=(await c.req().input('payload',q.NVarChar(q.MAX),JSON.stringify(payload)).query("INSERT dbo.test_daily_drafts(flow,kind,state,payload_json,created_by)VALUES(N'purchase',N'goods',N'pending',@payload,16);SELECT CAST(SCOPE_IDENTITY() AS bigint) id;")).recordset[0];
   await c.req().input('intent',q.BigInt,t.id).input('receipt',q.BigInt,g.id).query('UPDATE dbo.test_purchase_fx_intents SET receipt_id=@receipt WHERE id=@intent');
   const value={...dto(c,await intent(c,g.id)),state:'pending'};
   if(value.documentAmountExact4!==p.documentAmountExact4||value.accountAmountExact4!==p.accountAmountExact4||value.amountTryExact4!==p.amountTryExact4)fail('TEST_FX_TOTAL_DRIFT','Kalıcı SQL tutarı yetkili önizlemeyle eşleşmiyor.');
   await audit(c,'test_fx_receipt_created',g.id,value);return value;
  })),
  decideReceipt:(id,input,actor,approve)=>atomic(actor,approve?'goods.approve':'goods.reject',true,c=>journal(c,{...input,id:positiveId(id)},approve?'receipt_accept':'receipt_reject',async()=>{
   permission(actor,'purchase.view');fields(input,['requestId','reason']);if(!approve)reason(input.reason);const t=await intent(c,id);if(t.status!=='quoted')fail('TEST_FX_RECEIPT_STATE','Yalnız bekleyen kabul kararı verilebilir.');
   const q=c.sql;
   if(approve){
    if(Number(c.scope.current_stock_qty)<0||Number(c.scope.current_stock_qty)+Number(t.quantity)>40||!(Number(c.scope.average_cost_try)>0))fail('TEST_FX_STOCK_BOUND','TEST stok miktarı 40 sınırını aşıyor veya maliyet bilinmiyor.');
    await c.req().input('id',q.BigInt,t.id).query(`UPDATE t SET status=N'receiving',stock_before=p.current_stock_qty,cost_before=p.average_cost_try,stock_after=p.current_stock_qty+t.quantity,cost_after=ROUND((p.current_stock_qty*p.average_cost_try+t.amount_try)/(p.current_stock_qty+t.quantity),4) FROM dbo.test_purchase_fx_intents t JOIN dbo.products p ON p.id=301986 WHERE t.id=@id AND t.status=N'quoted';IF EXISTS(SELECT 1 FROM dbo.test_purchase_fx_intents WHERE id=@id AND (cost_after<=0 OR cost_after>200 OR stock_after>40)) THROW 51070,'TEST_FX_COST_BOUND',1;`);
   }
   await c.req().input('id',q.BigInt,positiveId(id)).input('state',q.NVarChar(20),approve?'approved':'rejected').input('reason',q.NVarChar(500),approve?(input.reason??null):reason(input.reason)).query('UPDATE dbo.test_daily_drafts SET state=@state,decided_by=16,reason=@reason WHERE id=@id AND state=N\'pending\'');
   if(approve)await c.req().input('id',q.BigInt,t.id).query(`UPDATE p SET current_stock_qty=t.stock_after,average_cost_try=t.cost_after FROM dbo.products p JOIN dbo.test_purchase_fx_intents t ON p.id=301986 WHERE t.id=@id;
    INSERT dbo.stock_movements(product_id,movement_type,source_type,source_id,quantity_in,quantity_out,quantity_net,unit_cost_try,average_cost_try_after,document_date,supplier_id,created_by,unit_price,currency_code,amount_try,warehouse_name,source_warehouse)
    SELECT 301986,N'in',N'goods_receipt',receipt_id,quantity,0,quantity,ROUND(amount_try/quantity,4),cost_after,document_date,13373,16,ROUND(amount_try/quantity,4),N'TRY',amount_try,N'TEST-DAILY-WH',N'TEST-DAILY-WH' FROM dbo.test_purchase_fx_intents WHERE id=@id;
    UPDATE dbo.test_purchase_fx_intents SET status=N'received' WHERE id=@id;`);
   else await c.req().input('id',q.BigInt,t.id).query("UPDATE dbo.test_purchase_fx_intents SET status=N'rejected' WHERE id=@id");
   const value={...dto(c,await intent(c,id)),state:approve?'approved':'rejected'};await audit(c,approve?'test_fx_receipt_approved':'test_fx_receipt_rejected',positiveId(id),value,input.reason);return value;
  })),
  createDraft:(input,actor)=>atomic(actor,'purchase.create',true,c=>journal(c,input,'draft_create',async()=>{
   permission(actor,'purchase.view');fields(input,['requestId','receiptId','previewHash']);const t=await intent(c,input.receiptId);
   if(t.status!=='received'||t.invoice_id||t.payload_hash!==input.previewHash)fail('TEST_FX_DRAFT_STATE','Onaylı, kullanılmamış aynı kabul önizlemesi gerekli.');dto(c,t);
   const payload={documentNo:t.document_no,documentDate:date(t.document_date),supplierId:13373,supplierName:c.scope.supplier_name,supplierCurrency:'TRY',documentCurrency:t.currency,exchangeRate:checkedFxNumber(fixed(t.document_rate,8),8),accountExchangeRate:checkedFxNumber(fixed(t.account_rate,8),8),invoiceDiscountRate:0,description:`C03FX TEST kabul #${t.receipt_id}`,items:[{productId:301986,stockCode:c.scope.stock_code,productName:c.scope.product_name,quantity:checkedFxNumber(fixed(t.quantity,3),3),currency:t.currency,purchasePrice:checkedFxNumber(t.native_price_text??fixed(t.native_price,4),4),lineDiscountRate:0,stockEffect:'goods_receipt_already_posted'}]};
   const normalized=c.native.normalizePurchasePayload(payload);if(fixed(normalized.grandTotal,4)!==fixed(t.document_total,4))fail('TEST_FX_NATIVE_TOTAL','Native fatura toplamı kaynak hesapla eşleşmiyor.');
   await c.req().input('id',c.sql.BigInt,t.id).query("UPDATE dbo.test_purchase_fx_intents SET status=N'registered' WHERE id=@id");
   const invoice=await c.native.createPurchaseDraft(payload,actor,c.nativeContext);
   await c.req().input('id',c.sql.BigInt,t.id).input('invoice',c.sql.BigInt,invoice.id).query("UPDATE dbo.test_purchase_fx_intents SET invoice_id=@invoice,status=N'linked' WHERE id=@id");
   const value=await detail(c,await intent(c,invoice.id,true));await audit(c,'test_fx_draft_created',invoice.id,value);return value;
  })),
  getDraft:(id,actor)=>atomic(actor,'purchase.view',false,async c=>detail(c,await intent(c,id,true))),
  finalizeDraft:(id,input,actor)=>atomic(actor,'purchase.finalize',true,c=>journal(c,{...input,id:positiveId(id)},'draft_finalize',async()=>{
   permission(actor,'purchase.view');fields(input,['requestId']);const t=await intent(c,id,true);if(t.status!=='linked')fail('TEST_FX_DRAFT_STATE','Aktif bağlı TEST taslağı gerekli.');
   const before=await detail(c,t);if(before.status!=='draft')fail('TEST_FX_DRAFT_STATE','Yalnız taslak fatura kesinleştirilebilir.');
   await c.native.finalizePurchaseInvoice(id,actor,c.nativeContext);const value=await detail(c,t);await audit(c,'test_fx_draft_finalized',positiveId(id),value);return value;
  })),
  cancelDraft:(id,input,actor)=>atomic(actor,'purchase.cancel',true,c=>journal(c,{...input,id:positiveId(id)},'draft_cancel',async()=>{
   permission(actor,'purchase.view');fields(input,['requestId','reason']);const cancelReason=reason(input.reason),t=await intent(c,id,true);if(t.status!=='linked')fail('TEST_FX_DRAFT_STATE','Aktif bağlı TEST faturası gerekli.');
   const before=await detail(c,t);
   if(before.status==='draft')await c.req().input('id',c.sql.BigInt,positiveId(id)).input('reason',c.sql.NVarChar(500),cancelReason).query("UPDATE dbo.purchase_invoices SET status=N'cancelled',cancel_reason=@reason,cancelled_at=SYSUTCDATETIME(),updated_by=16,updated_at=SYSUTCDATETIME() WHERE id=@id AND status=N'draft'");
   else if(before.status==='finalized')await c.native.cancelPurchaseInvoice(id,{...input,reason:cancelReason},actor,c.nativeContext);
   else fail('TEST_FX_DRAFT_STATE','Fatura zaten iptal edilmiş.');
   await c.req().input('id',c.sql.BigInt,t.id).query("UPDATE dbo.test_purchase_fx_intents SET status=N'cancelled' WHERE id=@id");
   const value=await detail(c,await intent(c,id,true));await audit(c,'test_fx_draft_cancelled',positiveId(id),value,input.reason);return value;
  })),
 };
}
export const testPurchaseFxService=createTestPurchaseFxService();
