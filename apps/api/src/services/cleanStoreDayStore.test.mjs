import test from 'node:test';import assert from 'node:assert/strict';
import {cleanRecordedInvoiceBasis} from './cleanStoreDayStore.mjs';
const row=()=>({invoiceId:'4',supplierId:'1',receiptId:'3',documentCurrency:'TRY',documentExchangeRateExact8:'1.00000000',accountCurrency:'TRY',accountExchangeRateExact8:'1.00000000',accountAmountExact4:'120.0000',amountTryExact4:'120.0000',totalExact4:'120.0000',linkCount:1,itemCount:1,receiptState:'accepted'});
test('clean purchase read uses the stored invoice currency snapshot and one accepted native receipt',()=>{
 const actual=cleanRecordedInvoiceBasis(row());assert.equal(actual.source,'stored-native-invoice');assert.equal(actual.accountAmountExact4,'120.0000');assert.equal(Object.hasOwn(actual,'totalExact4'),false);
 for(const patch of [{supplierId:'2'},{linkCount:2},{itemCount:0},{receiptState:'pending'},{accountCurrency:'USD'},{documentExchangeRateExact8:'1.00000001'},{amountTryExact4:'119.9999'},{accountAmountExact4:null}])assert.throws(()=>cleanRecordedInvoiceBasis({...row(),...patch}));
});

import {cleanSalesReadContext,cleanSalesInvoiceList} from './cleanStoreDayStore.mjs';
import {cleanCustomerCard} from './cleanCustomerCards.mjs';
import {tradeContext,tradeSelection} from '../../../sites-workflow/src/workflow/workTradeModel.mjs';
import {validateCustomerCard} from '../../../sites-workflow/src/workflow/testCustomersModel.mjs';

test('B4 invoice listing preserves the original receipt and applies pagination and currency per invoice',()=>{
 const invoices=[{id:'1',customerId:'1',currency:'TRY'},{id:'2',customerId:'2',currency:'TRY'}];
 assert.deepEqual(cleanSalesInvoiceList(invoices).data,invoices);
 assert.deepEqual(cleanSalesInvoiceList(invoices,{customerId:'2',currency:'TRY'}).data,[invoices[1]]);
 assert.deepEqual(cleanSalesInvoiceList(invoices,{limit:'1',page:'2'}).data,[invoices[1]]);
 assert.equal(cleanSalesInvoiceList(invoices,{customerId:'2',currency:'USD'}).meta.total,0);
});
test('clean sale reader enables existing receipt navigation but cannot manufacture a sale selection',()=>{const c={meta:{date:'2026-10-22',timeZone:'Europe/Istanbul',source:'native-test',environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67'},scope:{customer:{id:'1',code:'C1',name:'Örnek',currency:'TRY',balanceExact4:'0.0000',synthetic:true,writeEligible:true},accounts:[]},capabilities:{canCollect:true}};const v=cleanSalesReadContext(c);assert.equal(tradeContext(v),v);assert.throws(()=>tradeContext({...v,capabilities:{...v.capabilities,canCreate:true}}));assert.throws(()=>tradeSelection({customerId:'1',documentDate:'2026-10-22',currency:'TRY',items:[{productId:'1'}]},v));const invoice={id:'1',customerId:'1',currency:'TRY'};assert.equal(cleanSalesInvoiceList(invoice).data.length,1);assert.equal(cleanSalesInvoiceList(invoice,{customerId:'2',currency:'TRY'}).data.length,0);assert.equal(cleanSalesInvoiceList(invoice,{page:'2'}).data.length,0);assert.throws(()=>cleanSalesInvoiceList(invoice,{customerId:'1'}));});
test('clean customer reads distinguish native synthetic ledger proof from Vega and unknown balances',()=>{const r={id:1,code:'C1',name:'Örnek',active:true,currency:'TRY',balance:'0.00000000',ledger:'0.00000000',foreignMovements:0,held:0},c=cleanCustomerCard(r);assert.equal(validateCustomerCard(c,{detail:true}),c);assert.equal(c.source.status,'synthetic');assert.equal(c.accounts[0].accountId,null);assert.equal(c.accounts[0].balanceExact,'0.00000000');for(const patch of [{ledger:'1.00000000'},{foreignMovements:1},{held:1},{currency:'LL'}])assert.equal(cleanCustomerCard({...r,...patch}).accounts[0].balanceExact,null);});

import {createCleanStoreDayStore} from './cleanStoreDayStore.mjs';
import {registerCleanContext,CLEAN_IDENTITY_SQL} from './cleanSyntheticContext.mjs';
import {CLEAN_FINANCE_REHEARSAL,CLEAN_FINANCE_FX_CASES} from './cleanFinanceRehearsalModel.mjs';
import {workHash} from './workSalesModel.mjs';

// Same injected Request/Transaction clean identity fixture as cleanStoreDayReady;
// only the finite B4 native rows are added. No driver, socket or database exists.
function reversalReaderFixture({profile=CLEAN_FINANCE_REHEARSAL,active=false,patch={},fieldsPatch={},duplicate=false,absent=false}={}){
 const identity={databaseName:'MELISA_ERP_CLEAN_TEST_20261022',serverName:'Semih\\MELISADEV',loginName:'melisa_clean_test_app_20261022',databaseUser:'melisa_clean_test_app_20261022',sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67'};
 const fields={id:'20015',createdBy:'20',invoiceId:profile.invoiceId,accountId:profile.accountId,amountExact4:'50.1250',currency:profile.currency,documentDate:'2026-10-22',status:active?'active':'cancelled',createdAt:'2026-10-22 12:00:00',...fieldsPatch};
 const proof={reversalLinkCount:active?'0':'1',reversalId:active?null:'20016',reversalAccountId:active?null:profile.accountId,reversalAmountExact4:active?null:'50.1250',reversalCurrency:active?null:profile.currency,reversalDocumentDate:active?null:'2026-10-22',reversalCreatedAt:active?null:'2026-10-22 12:30:00',reversalInvoiceId:active?null:profile.invoiceId,reversalCustomerId:active?null:profile.customerId,reversalSourceId:active?null:'20015',reversalMovementType:active?null:'collection_cancel',reversalDirection:active?null:'out',reversalSalesInvoiceId:active?null:profile.invoiceId,reversalFinanceAmountExact4:active?null:'50.1250',reversalFinanceCurrency:active?null:profile.currency,reversalFinanceDocumentDate:active?null:'2026-10-22',...patch};
 const events=[],queries=[],actor={id:20,username:'ornek-finans',role:{id:25,code:'clean_test_finance'},permissions:['finance.view','customer.view','supplier.view','sales.view','finance.collection']};
 const account=n=>({id:String(n),code:n===1?'ORNEK-TRY-20261022':'B4-K-'+n,name:'Yapay hesap '+n,type:'cash',currency:n===3?'USD':n===4?'EUR':'TRY',openingBalanceExact4:'0.0000',balanceExact4:'500.0000'});
 const customer=n=>({id:String(n),code:'YAPAY-M-'+n,name:'Yapay müşteri '+n,currency:account(n).currency,balanceExact4:'200.0000'});
 const pool={request:()=>({query:async text=>{assert.equal(text,CLEAN_IDENTITY_SQL);events.push('identity');return {recordset:[identity]};}})};
 class Transaction{async begin(level){assert.equal(level,4);events.push('begin');}async commit(){events.push('commit');}async rollback(){events.push('rollback');}}
 class Request{
  constructor(tx,options){assert.ok(tx instanceof Transaction);this.options=options;this.parameters={};}
  input(k,_type,value){this.parameters[k]=value;return this;}
  async execute(name){assert.ok(['dbo.usp_clean_store_day_ready','dbo.usp_clean_finance_b4_ready','dbo.usp_clean_finance_b4_fx_ready'].includes(name));events.push(name);return {};}
  async query(text){
   queries.push(text);assert.doesNotMatch(text,/\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP)\b/i);
   if(text.includes('sp_getapplock'))return {};
   if(text.includes('SELECT u.id,u.username'))return {recordsets:[[{id:20,username:actor.username,roleId:25,code:actor.role.code}],actor.permissions.map(permission_key=>({permission_key})),[{id:'1',stockCode:'0007 MELISA',name:'Yapay ürün',stockQuantityExact3:'21.000',barcode:'0000000000007'}],[{...customer(1),code:'YAPAY-T-1'}]]};
   if(text.includes('FROM dbo.customers WHERE id=1 AND is_active=1'))return {recordsets:[[customer(1)],[account(1)]]};
   if(text.includes('SELECT operation,response_json'))return {recordset:[]};
   if(text.includes('SELECT CONVERT(varchar(20),id) id,customer_code')){const n=Number(/FROM dbo.customers WHERE id=(\d+)/.exec(text)[1]);return {recordsets:[[customer(n)],[{...customer(n),code:'YAPAY-T-'+n}],[account(n)]]};}
   if(text.includes('FROM dbo.supplier_movements m JOIN dbo.purchase_invoices'))return {recordset:[]};
   if(text.includes('FROM dbo.purchase_invoices i JOIN dbo.test_purchase_batch_links'))return {recordset:[{id:'4',number:'YAPAY-4',status:'finalized',documentDate:'2026-10-22',documentCurrency:'TRY',accountCurrency:'TRY',documentAmountExact4:'120.0000',accountAmountExact4:'120.0000'}]};
   if(text.includes('FROM dbo.work_collection_links l JOIN dbo.customer_movements m')){
    if(absent||this.parameters.id!==fields.id||!text.includes('m.customer_id='+profile.customerId+' '))return {recordset:[]};
    // Model SQL projection: fields absent from SELECT cannot magically appear.
    const row={...fields,...Object.fromEntries(Object.entries(proof).filter(([key])=>new RegExp('\\b'+key+'\\b').test(text)))};
    return {recordset:duplicate?[row,{...row}]:[row]};
   }
   assert.fail('Unrecognized offline query; do not connect a real database');
  }
 }
 const store=createCleanStoreDayStore({dependencies:async()=>({getSqlPool:async()=>pool,getSqlDriver:()=>({Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},NVarChar:()=>null,BigInt:null,Bit:null})})});
 return {identity,events,queries,fields,proof,read:(actorPatch={})=>store.readFinance({...actor,...actorPatch},c=>c.collection(fields.id))};
}

test('B5 normal clean collection reader returns linked reversal evidence without writes',async t=>{
 const values={MELISA_CLEAN_TEST:'20261022',MELISA_CLEAN_STORE_DAY:'20261022',MELISA_CLEAN_FINANCE:'20261022',MELISA_CLEAN_FINANCE_B4:'20261023',MELISA_CLEAN_FINANCE_CASH:'20261023',MELISA_CLEAN_FINANCE_FX:'20261023',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_DATABASE:'MELISA_ERP_CLEAN_TEST_20261022',SQL_USER:'melisa_clean_test_app_20261022',SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false',API_PORT:'4194'},previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));Object.assign(process.env,values);
 try{
  registerCleanContext(reversalReaderFixture().identity);
  for(const profile of [CLEAN_FINANCE_REHEARSAL,...CLEAN_FINANCE_FX_CASES])await t.test(profile.currency+' exposes the exact native reversal and preserves original amount',async()=>{
   const f=reversalReaderFixture({profile}),r=await f.read();
   for(const k of ['reversalId','reversalAccountId','reversalAmountExact4','reversalCurrency','reversalDocumentDate','reversalCreatedAt'])assert.equal(r[k],f.proof[k],k);
   assert.equal(r.amountExact4,f.fields.amountExact4);assert.equal(r.status,'cancelled');assert.match(r.revision,/^[a-f0-9]{64}$/);assert.equal(f.events.at(-1),'commit');
   assert.deepEqual(Object.keys(r).filter(k=>k.startsWith('reversal')).sort(),['reversalId','reversalAccountId','reversalAmountExact4','reversalCurrency','reversalDocumentDate','reversalCreatedAt'].sort());
   const query=f.queries.find(q=>q.includes('reversalLinkCount'));assert.doesNotMatch(query,/TOP\s*\(/i);assert.match(query,/COUNT_BIG\(\*\).*WHERE x.original_id=m.id/s);assert.match(query,/LEFT JOIN dbo.customer_movements r ON r.id=rl.movement_id/);assert.match(query,/rf.party_type=N'customer' AND rf.source_type=N'collection_cancel'/);assert.match(query,/WHERE rl.original_id=m.id/);
  });
  for(const profile of [CLEAN_FINANCE_REHEARSAL,...CLEAN_FINANCE_FX_CASES])await t.test(profile.currency+' active collection keeps its complete old DTO and revision',async()=>{
   const f=reversalReaderFixture({profile,active:true}),before=JSON.stringify(f.fields),r=await f.read();assert.deepEqual(r,{...f.fields,revision:workHash(f.fields)});assert.equal(JSON.stringify(f.fields),before);assert.equal(f.events.at(-1),'commit');
  });
  const invalid=[
   {reversalLinkCount:null},{reversalLinkCount:'0'},{reversalLinkCount:'2'},
   {reversalId:null},{reversalId:'20015'},{reversalId:'0'},
   {reversalAccountId:null},{reversalAccountId:'999'},
   {reversalAmountExact4:null},{reversalAmountExact4:'50.1251'},{reversalCurrency:'USD'},
   {reversalDocumentDate:null},{reversalDocumentDate:'2026-02-30'},
   {reversalCreatedAt:null},{reversalCreatedAt:'2026-10-22 24:30:00'},{reversalCreatedAt:'2026-02-30 12:30:00'},
   {reversalInvoiceId:'999'},{reversalCustomerId:'999'},{reversalSourceId:'999'},
   {reversalMovementType:'payment_cancel'},{reversalDirection:'in'},{reversalSalesInvoiceId:null},{reversalSalesInvoiceId:'999'},
   {reversalFinanceAmountExact4:null},{reversalFinanceAmountExact4:'50.1251'},{reversalFinanceCurrency:'USD'},{reversalFinanceDocumentDate:'2026-10-21'},
  ];
  for(const patch of invalid)await t.test('rejects missing or conflicting '+JSON.stringify(patch),async()=>{
   const f=reversalReaderFixture({patch});await assert.rejects(f.read,{code:'INBOUND_UNAVAILABLE',statusCode:503});assert.equal(f.events.at(-1),'rollback');assert.ok(!f.events.includes('commit'));
  });
  await t.test('duplicate joined reversals reject instead of selecting a first row',async()=>{const f=reversalReaderFixture({duplicate:true});await assert.rejects(f.read,{code:'INBOUND_UNAVAILABLE'});assert.equal(f.events.at(-1),'rollback');});
  await t.test('missing original collection retains the normal not-found result',async()=>{const f=reversalReaderFixture({absent:true});await assert.rejects(f.read,{code:'WORK_COLLECTION_NOT_FOUND',statusCode:404});assert.equal(f.events.at(-1),'rollback');});
  for(const patch of [{reversalId:'20016'},{reversalLinkCount:'1'}])await t.test('active state cannot conceal stray reversal evidence '+JSON.stringify(patch),async()=>{const f=reversalReaderFixture({active:true,patch});await assert.rejects(f.read,{code:'INBOUND_UNAVAILABLE'});assert.equal(f.events.at(-1),'rollback');});
  for(const fieldsPatch of [{amountExact4:'0.0000'},{amountExact4:'-50.1250'},{currency:'USD'},{invoiceId:'999'},{accountId:'999'}])await t.test('rejects a changed original source '+JSON.stringify(fieldsPatch),async()=>{const f=reversalReaderFixture({fieldsPatch});await assert.rejects(f.read,{code:'INBOUND_UNAVAILABLE'});});
  await t.test('exact four-place amount is preserved without Number or rounding',async()=>{const exact='99999999999999.9999',f=reversalReaderFixture({fieldsPatch:{amountExact4:exact},patch:{reversalAmountExact4:exact,reversalFinanceAmountExact4:exact}}),r=await f.read();assert.equal(r.amountExact4,exact);assert.equal(r.reversalAmountExact4,exact);});
  await t.test('rejects a valid but wrong permitted day on the original collection',async()=>{const f=reversalReaderFixture({fieldsPatch:{documentDate:'2026-10-21'}});await assert.rejects(f.read,{code:'INBOUND_UNAVAILABLE'});assert.equal(f.events.at(-1),'rollback');});
  await t.test('rejects a matching valid but wrong permitted day on both reversal ledgers',async()=>{const f=reversalReaderFixture({patch:{reversalDocumentDate:'2026-10-21',reversalFinanceDocumentDate:'2026-10-21'}});await assert.rejects(f.read,{code:'INBOUND_UNAVAILABLE'});assert.equal(f.events.at(-1),'rollback');});
  await t.test('creation timestamp is source evidence and is not forced to the document day',async()=>{const at='2026-10-25 01:30:00',f=reversalReaderFixture({patch:{reversalCreatedAt:at}}),r=await f.read();assert.equal(r.reversalCreatedAt,at);assert.equal(r.reversalDocumentDate,CLEAN_FINANCE_REHEARSAL.date);});
  await t.test('normal actor permission intersection still denies before the callback',async()=>{const f=reversalReaderFixture();await assert.rejects(()=>f.read({permissions:['customer.view','supplier.view']}),{code:'CLEAN_COLLECTION_FORBIDDEN'});assert.ok(!f.queries.some(q=>q.includes('reversalLinkCount')));assert.equal(f.events.at(-1),'rollback');});
  await t.test('foreign target remains denied before any injected connection',async()=>{const f=reversalReaderFixture();process.env.API_PORT='4144';try{await assert.rejects(f.read,{code:'CLEAN_TEST_IDENTITY_REJECTED'});assert.deepEqual(f.events,[]);}finally{process.env.API_PORT='4194';}});
 }finally{for(const [k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
