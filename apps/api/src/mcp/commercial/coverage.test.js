import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { createMcpApp } from '../../mcpReadOnlyServer.js';
import { authenticate, allowedTool, requestAccess, assertAdministrator } from './access.js';
import { dateRange } from './scope.js';
import { readMappedImage } from './images.js';
import { fieldPolicy } from './policy.js';
import { getBionicVegaTables } from '../../config/bionicVegaDatabase.js';
import { env } from '../../config/env.js';
import { inventoryHistoryAssessment } from './reports.js';

const admin='synthetic-administrator-key-01234567890123456789';
const customer='synthetic-customer-key-0123456789012345678901234';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');

test('dedicated stock table names follow configured company and period, not F0102 constants',()=>{
  const previous={...env.bionicVegaSql};
  try{env.bionicVegaSql.companyCode='F0103';env.bionicVegaSql.periodCode='D0006';
    assert.deepEqual(getBionicVegaTables(),{stocks:'F0103TBLSTOKLAR',units:'F0103TBLBIRIMLEREX',movements:'F0103D0006TBLSTOKHAREKETLERI'});
    env.bionicVegaSql.companyCode='';assert.throws(getBionicVegaTables,e=>e.code==='BIONIC_VEGA_SOURCE_INVALID');
  }finally{Object.assign(env.bionicVegaSql,previous);}
});
test('principal tokens are distinct and callers cannot choose administrator role',()=>{
  assert.equal(authenticate('Bearer '+customer,admin,customer),'customer');
  assert.equal(authenticate('Bearer '+admin,admin,customer),'administrator');
  assert.equal(authenticate('Bearer '+customer+'x',admin,customer),null);
  for(const name of ['query_dataset','get_product','get_product_costs','get_account_balance','get_sales_report','erp_readonly_health'])assert.equal(allowedTool('customer',name),false);
  assert.throws(()=>requestAccess.run({role:'customer'},assertAdministrator),e=>e.code==='ACCESS_DENIED');
  assert.throws(()=>createMcpApp({adminToken:admin,customerToken:admin,audit:()=>{}}));
});
test('report dates are explicit, calendar-valid, exclusive and bounded',()=>{
  assert.deepEqual(dateRange({dateFrom:'2026-01-01',dateTo:'2027-01-01'}),{dateFrom:'2026-01-01',dateTo:'2027-01-01',endExclusive:true});
  for(const dates of [{},{dateFrom:'2026-02-30',dateTo:'2026-03-03'},{dateFrom:'2026-03-03',dateTo:'2026-03-03'},{dateFrom:'2024-01-01',dateTo:'2026-01-01'}])assert.throws(()=>dateRange(dates),e=>e.code==='EXPLICIT_DATE_RANGE_REQUIRED_MAX_366_DAYS');
});

test('no-sales candidates never turn missing or recent history into confirmed unsold days',()=>{
  for(const row of [{first_recorded_movement:null,undated_movement_rows:null},{first_recorded_movement:'2026-07-01',undated_movement_rows:'0'},{first_recorded_movement:'2026-01-01',undated_movement_rows:'1'}]){
    const assessment=inventoryHistoryAssessment(row,'2026-06-09');
    assert.equal(assessment.status,'INSUFFICIENT_PRODUCT_HISTORY');
    assert.equal(assessment.confirmedDaysWithoutSales,null);
    assert.equal(assessment.completeHistoryVerified,false);
  }
  const older=inventoryHistoryAssessment({first_recorded_movement:'2026-01-01',undated_movement_rows:'0'},'2026-06-09');
  assert.equal(older.status,'OBSERVED_RECORDS_PRECEDE_WINDOW');
  assert.equal(older.completeHistoryVerified,false);assert.equal(older.confirmedDaysWithoutSales,null);
});
test('raw file paths cannot escape through generic dataset queries',()=>{
  for(const name of ['file_path','storage_key','image_url','FILEPATH'])assert.equal(fieldPolicy({name,dataType:'nvarchar'},{source:'melisa',family:'stock'}),null);
});

test('image bytes are read from the mapping root with path/type/size checks',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'melisa-mcp-image-test-'));
  try{
    await fs.writeFile(path.join(root,'sample.png'),png);
    const image=await readMappedImage('/uploads/vega-products/sample.png',root);
    assert.deepEqual(Buffer.from(image.data,'base64'),png);assert.equal(image.mimeType,'image/png');assert.equal(image.bytes,png.length);
    for(const p of ['../../secret.env','https://example.com/test.png','/uploads/vega-products/../sample.png','/uploads/vega-products/a%2f.png','C:\\secret.png'])await assert.rejects(readMappedImage(p,root),e=>e.code==='IMAGE_PATH_NOT_ALLOWED');
    await assert.rejects(readMappedImage('/uploads/vega-products/missing.png',root),e=>e.code==='IMAGE_FILE_NOT_FOUND');
    await fs.writeFile(path.join(root,'text.png'),'not an image');
    await assert.rejects(readMappedImage('/uploads/vega-products/text.png',root),e=>e.code==='IMAGE_FORMAT_UNSUPPORTED');
    await fs.writeFile(path.join(root,'big.png'),Buffer.alloc(3*1024*1024+1));
    await assert.rejects(readMappedImage('/uploads/vega-products/big.png',root),e=>e.code==='IMAGE_SIZE_NOT_ALLOWED');
  }finally{assert.ok(root.startsWith(path.join(os.tmpdir(),'melisa-mcp-image-test-')));await fs.rm(root,{recursive:true,force:true});}
});

test('HTTP transport enforces role boundaries and sends real image content with metadata',async()=>{
  const events=[];let calls=0;
  const app=createMcpApp({adminToken:admin,customerToken:customer,audit:e=>events.push(e),handlers:{
    get_stock_count:async()=>({stockCodeCount:3,rowCount:3}),
    search_products:async()=>[{stockCode:'SYNTHETIC'}],
    get_product:async()=>({stockCode:'SYNTHETIC'}),
    erp_readonly_health:async()=>({readOnlyAccountVerified:true}),
    get_account_balance:async()=>{calls++;return {items:[]};},
    search_catalog:async()=>({items:[{STOKKODU:'SYNTHETIC'}]}),
    get_product_image:async()=>({image:{mimeType:'image/png',bytes:png.length},mcpImage:{type:'image',mimeType:'image/png',data:png.toString('base64')}}),
  }});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const url=`http://127.0.0.1:${server.address().port}/mcp`;
  const post=async(token,method,params={},headers={})=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const call=async(token,name,args={})=>(await post(token,'tools/call',{name,arguments:args})).json();
  try{
    assert.equal((await post(null,'tools/list')).status,401);
    assert.equal((await post(admin,'tools/list',{}, {Origin:'https://foreign.invalid'})).status,403);
    const list=(await(await post(customer,'tools/list')).json()).result.tools.map(t=>t.name).sort();
    assert.deepEqual(list,['get_product_image','search_catalog']);
    const denied=await call(customer,'get_account_balance',{role:'administrator'});
    assert.equal(denied.result.structuredContent.code,'ACCESS_DENIED');assert.equal(calls,0);
    const generic=await call(customer,'query_dataset',{dataset:'melisa.dbo.suppliers',includePersonalData:true});assert.equal(generic.result.isError,true);
    const image=(await call(customer,'get_product_image',{stockCode:'SYNTHETIC'})).result;
    assert.deepEqual(Buffer.from(image.content.find(c=>c.type==='image').data,'base64'),png);
    assert.equal(image.structuredContent.mcpImage,undefined);assert.ok(image.structuredContent.readAt);
    for(const tool of ['get_stock_count','search_products','get_product','erp_readonly_health']){
      const r=(await call(admin,tool,tool==='get_product'?{stockCode:'SYNTHETIC'}:{})).result;
      assert.equal(r.isError,false);assert.ok(r.structuredContent.scope&&r.structuredContent.readAt);
      if(tool==='search_products')assert.ok(Array.isArray(r.structuredContent.items));
    }
    assert.equal((await call(admin,'execute_sql',{sql:'DELETE FROM products'})).result.structuredContent.code,'UNKNOWN_TOOL');
    assert.equal((await fetch(url.replace('/mcp','/write'),{method:'POST',headers:{Authorization:'Bearer '+admin}})).status,404);
    const log=JSON.stringify(events);assert.ok(!log.includes('SYNTHETIC')&&!log.includes(customer)&&!log.includes(admin));
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('HTTP rejects concurrent excess calls, oversized bodies and malformed JSON',async()=>{
  const pending=[];
  const app=createMcpApp({adminToken:admin,customerToken:'',audit:()=>{},handlers:{get_stock_quantities:()=>new Promise(resolve=>pending.push(resolve))}});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const url=`http://127.0.0.1:${server.address().port}/mcp`,headers={Authorization:'Bearer '+admin,'content-type':'application/json'};
  const call=()=>fetch(url,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_stock_quantities',arguments:{}}})});
  let first,second;
  try{
    first=call();second=call();
    for(let i=0;i<100&&pending.length<2;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(pending.length,2);
    assert.equal((await(await call()).json()).result.structuredContent.code,'QUERY_CONCURRENCY_LIMIT');
    assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({value:'x'.repeat(66000)})})).status,413);
    assert.equal((await fetch(url,{method:'POST',headers,body:'{'})).status,400);
  }finally{
    pending.forEach(resolve=>resolve({items:[]}));await Promise.allSettled([first,second]);
    await new Promise(resolve=>server.close(resolve));
  }
});
