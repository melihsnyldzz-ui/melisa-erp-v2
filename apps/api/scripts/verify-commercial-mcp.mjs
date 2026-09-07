import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Explicit opt-in, SELECT-only live acceptance. Report only check outcomes,
// counts and scope, never rows, customer identifiers, arguments or credentials.
const target=new URL(process.env.MCP_READ_ONLY_VERIFY_URL||'http://127.0.0.1:4115/mcp');
if(process.env.MCP_READ_ONLY_LIVE_TESTS!=='true'||!['127.0.0.1','localhost'].includes(target.hostname)||target.protocol!=='http:'||target.pathname!=='/mcp'||target.username||target.password||target.search||target.hash)throw new Error('Explicit opt-in and a local MCP review URL are required');
const token=process.env.MCP_READ_ONLY_TOKEN;
if(!token)throw new Error('MCP_READ_ONLY_TOKEN is required');
const range={dateFrom:process.env.MCP_READ_ONLY_VERIFY_DATE_FROM,dateTo:process.env.MCP_READ_ONLY_VERIFY_DATE_TO};
if(!range.dateFrom||!range.dateTo)throw new Error('Explicit verification date range is required');
const checks=[];
const report={readAt:new Date().toISOString(),source:null,dateRange:{...range,endExclusive:true},checks};
async function rpc(name,args={}) {
 const response=await fetch(target,{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}),signal:AbortSignal.timeout(95000)});
 assert.equal(response.status,200);const result=(await response.json()).result;assert.ok(result);
 return result;
}
async function check(label,name,args={},expectedError) {
 const start=Date.now();
 try{
   const r=await rpc(name,args),v=r.structuredContent;
   assert.ok(v&&Object.hasOwn(v,'source')&&Object.hasOwn(v,'company')&&Object.hasOwn(v,'period')&&v.readAt&&v.scope);
   if(expectedError){assert.equal(r.isError,true);assert.equal(v.code,expectedError);checks.push({label,status:'PASS_CONTROL',code:v.code,durationMs:Date.now()-start});return null;}
   assert.equal(r.isError,false);checks.push({label,status:Array.isArray(v.items)&&!v.items.length?'LIVE_EMPTY':'PASS_LIVE_READ',rows:v.items?.length??v.lines?.length??null,durationMs:Date.now()-start});
   return v;
 }catch(e){checks.push({label,status:'FAIL',code:e.code||'ASSERTION_OR_READ_FAILED',durationMs:Date.now()-start});return null;}
}
const health=await check('Legacy health','erp_readonly_health');
if(health){report.source={database:health.databaseName,company:health.companyCode,period:health.periodCode,readOnlyAccountVerified:health.readOnlyAccountVerified};}
await check('Legacy count','get_stock_count');
const search=await check('Legacy search','search_products',{limit:2});
if(search?.items?.[0])await check('Legacy exact product','get_product',{stockCode:search.items[0].stockCode});
const inventory=await check('Commercial scope inventory','get_commercial_inventory');
const company=health?.companyCode,period=health?.periodCode;
if(company&&period){
 const active=await check('Movement source sample','query_dataset',{dataset:`vega.dbo.${company}${period}TBLSTOKHAREKETLERI`,fields:['STOKNO'],limit:1});
 const stockId=active?.items?.[0]?.STOKNO;
 const q=await check('Stock quantities page 1','get_stock_quantities',{limit:2});
 if(q?.hasMore){await check('Stock quantities page 2','get_stock_quantities',{limit:2,cursor:q.nextCursor});await check('Tampered cursor','get_stock_quantities',{limit:2,cursor:q.nextCursor+'a'},'INVALID_OR_EXPIRED_CURSOR');}
 if(stockId){
  await check('Units/barcodes','get_product_units',{stockId,limit:2});
  for(const kind of ['serial_numbers','series_1','series_2'])await check(kind,'get_product_variants',{stockId,kind,limit:2});
  await check('Stock movement dates','get_stock_movements',{stockId,...range,limit:2});
  await check('Price and currency slots','get_product_prices',{stockId,limit:2});
  const cost=await check('Raw cost fields only','get_product_costs',{stockId,...range,limit:2});
  if(cost)checks.push({label:'Verified profit',status:'UNSUPPORTED',code:cost.profitStatus});
 }
 const accounts=await check('Accounts without contact fields','list_accounts',{limit:2}),accountId=accounts?.items?.[0]?.IND;
 if(accountId){await check('Account ledger/due dates','get_account_ledger',{accountId,...range,limit:2});await check('Currency balance effect','get_account_balance',{accountId,...range});}
 for(const kind of ['sale_stock_exit','purchase_stock_entry','sales_invoice','purchase_invoice']){
  const docCompany=kind==='purchase_invoice'?process.env.MCP_READ_ONLY_VERIFY_PURCHASE_COMPANY:kind==='sales_invoice'?process.env.MCP_READ_ONLY_VERIFY_INVOICE_COMPANY:company;
  if(!docCompany){checks.push({label:kind,status:'NOT_TESTED',code:'EXPLICIT_COMPANY_REQUIRED'});continue;}
  const doc=await check(kind,'list_commercial_documents',{...range,kind,company:docCompany,period,limit:1});
  if(doc?.items?.[0]&&kind.endsWith('invoice'))await check(kind+' lines','get_document',{dataset:doc.dataset,key:{IND:doc.items[0].IND},limit:2});
 }
 await check('Sales returns filter','list_commercial_documents',{...range,kind:'purchase_stock_entry',returns:true,limit:2});
 for(const dimension of ['product','brand','customer','country']){
  const first=await check(dimension+' sales report','get_sales_report',{...range,dimension,limit:2});
  if(first?.hasMore)await check(dimension+' report page 2','get_sales_report',{...range,dimension,limit:2,cursor:first.nextCursor});
 }
 for(const kind of ['no_sales','decreasing','below_recorded_threshold'])await check(kind,'get_inventory_report',{...range,kind,limit:2});
 const catalog=await check('Customer-safe catalog','search_catalog',{limit:2});
 if(catalog?.items?.[0]){
   const image=await rpc('get_product_image',{stockCode:catalog.items[0].STOKKODU});
   if(image.isError)checks.push({label:'Mapped live image delivery',status:'BLOCKED',code:image.structuredContent?.code});
   else {const content=image.content.find(c=>c.type==='image');checks.push({label:'Mapped live image delivery',status:content?.data?'PASS_LIVE_IMAGE':'FAIL',bytes:content?.data?Buffer.from(content.data,'base64').length:null});}
 }
 await check('Unknown company','get_stock_quantities',{company:'F9999'},'COMPANY_NOT_ALLOWED');
 await check('SQL argument refused','query_dataset',{dataset:`vega.dbo.${company}TBLSTOKLAR`,sql:'SELECT 1'},'INVALID_ARGUMENTS');
 await check('Dates required','get_stock_movements',{},'EXPLICIT_DATE_RANGE_REQUIRED_MAX_366_DAYS');
}
report.summary=Object.fromEntries([...new Set(checks.map(c=>c.status))].map(s=>[s,checks.filter(c=>c.status===s).length]));
report.completeLiveAcceptance=!checks.some(c=>['FAIL','BLOCKED','NOT_TESTED','UNSUPPORTED'].includes(c.status));
if(process.env.MCP_READ_ONLY_VERIFY_REPORT){const file=path.resolve(process.env.MCP_READ_ONLY_VERIFY_REPORT);fs.writeFileSync(file,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
else if(!report.completeLiveAcceptance)process.exitCode=2;
