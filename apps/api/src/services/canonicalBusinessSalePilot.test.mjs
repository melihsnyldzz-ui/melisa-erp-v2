import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// The production policy runs unchanged in a VM with a SELECT-only request
// double. This fixture cannot register a production transaction or contact SQL.
const source=fs.readFileSync(new URL('./pilotCashPolicy.mjs',import.meta.url),'utf8')
 .replace(/^import[^\n]*\n/gm,'').replaceAll('export ','');
const defaultProducts=()=>[
 {productId:'12',quantityExact3:'2.000',unitPriceExact4:'2.1235'},
 {productId:'13',quantityExact3:'1.000',unitPriceExact4:'3.0000'}
];
const lines=()=>[{productId:12,quantity:2,unitPrice:2.1235},{productId:13,quantity:1,unitPrice:3}];

function fixture({canonical=true,products=defaultProducts(),stocks={},legacyNight=false,isolated=false,foreignTransaction=false,pilot=true}={}){
 const transaction={},otherTransaction={},calls=[],lookups=[],legacyScopes=[];
 const proof=Object.freeze({actorId:'17',products:Object.freeze(products.map(p=>Object.freeze({...p})))});
 const rows=new Map(products.map(p=>[Number(p.productId),{current_stock_qty:3,unit:'ADET'}]));
 for(const [key,changes]of Object.entries(stocks))rows.set(Number(key),changes===null?null:{...(rows.get(Number(key))??{}),...changes});
 const request=()=>({parent:foreignTransaction?otherTransaction:transaction,params:{},input(name,_type,value){this.params[name]=value;return this;},async query(sql){
  assert.match(sql,/^SELECT /);assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|EXEC|MERGE|ALTER|CREATE|DROP)\b/);
  calls.push({sql,params:{...this.params},parent:this.parent});
  // The fake legacy database returns no row for an unproved legacy selector.
  const legacy=sql.includes('LEGACY_ELIGIBILITY');
  const row=legacy?null:rows.get(this.params.pilotProductId);
  return {recordset:row?[row]:[]};
 }});
 const sandbox={
  process:{env:{MELISA_PILOT_RUNTIME:pilot?'true':'false'}},
  getSqlDriver:()=>({BigInt:'bigint'}),
  getCanonicalBusinessSaleTransaction:tx=>{lookups.push(tx);return canonical&&tx===transaction?proof:null;},
  pilotProductScopeSql:alias=>{legacyScopes.push(alias);return '1=0 /* LEGACY_ELIGIBILITY */';},
  isWorkNightProduct:()=>legacyNight,
  isIsolatedCopyProduct:()=>isolated,
  isIsolatedCopyCustomer:()=>false,
  isDailyWebCustomerScope:()=>false,
  assertDailyWebCustomer:()=>{throw Error('No customer query belongs to these product tests');},
  hasNativeCustomerAccess:()=>false
 };
 vm.createContext(sandbox);vm.runInContext(source+'\n;globalThis.policy=assertPilotSaleProducts;',sandbox);
 return {run:(items=lines(),options={})=>sandbox.policy(request,items,options),transaction,proof,rows,calls,lookups,legacyScopes};
}

test('canonical exact product set locks in sorted order and retains verified quantity/price without legacy eligibility fallback',async()=>{
 const f=fixture(),input=lines().reverse(),before=JSON.stringify(input);await f.run(input,{consume:true});
 assert.equal(JSON.stringify(input),before);assert.deepEqual(f.calls.map(c=>c.params.pilotProductId),[12,13]);assert.equal(f.legacyScopes.length,0);assert(f.calls.every(c=>c.parent===f.transaction));
 for(const {sql}of f.calls){assert.match(sql,/WITH\(UPDLOCK,HOLDLOCK\)/);assert.match(sql,/p\.is_active=1 AND p\.is_deleted=0/);assert.match(sql,/AND p\.id=@pilotProductId/);}
});
test('foreign products, quantity drift and native4 price drift reject before the first product read',async()=>{
 for(const mutate of [x=>{x[0].productId=1;},x=>{x[0].quantity=3;},x=>{x[0].unitPrice=2.1236;}]){
  const f=fixture(),input=lines();mutate(input);await assert.rejects(f.run(input,{consume:true}),{code:'PILOT_PRODUCT_OUT_OF_SCOPE',statusCode:409});assert.equal(f.calls.length,0);
 }
});
test('partial selection, duplicate lines and duplicated aliases cannot satisfy the canonical product set',async()=>{
 const cases=[lines().slice(0,1),[{productId:12,quantity:1,unitPrice:2.1235},{productId:'12',quantity:1,unitPrice:2.1235}], [...lines(),{productId:12,quantity:2,unitPrice:2.1235}]];
 for(const items of cases){const f=fixture();await assert.rejects(f.run(items),{code:'PILOT_PRODUCT_OUT_OF_SCOPE'});assert.equal(f.calls.length,0);}
});
test('empty canonical selection is invalid before transaction lookup or SQL',async()=>{
 const f=fixture();await assert.rejects(f.run([]),{code:'PILOT_LINE_INVALID'});assert.equal(f.calls.length,0);assert.equal(f.lookups.length,0);
});
test('zero, negative, fractional, nonfinite quantity and nonpositive/unknown price fail closed before reads',async()=>{
 for(const [field,values]of [['quantity',[0,-1,1.5,NaN,Infinity]],['unitPrice',[0,-1,null,NaN,Infinity,'unknown']]]){
  for(const value of values){const f=fixture(),items=lines();items[0][field]=value;await assert.rejects(f.run(items),{code:'PILOT_LINE_INVALID'});assert.equal(f.calls.length,0);}
 }
});
test('missing product and non-main-unit source rows cannot become canonical pilot products',async()=>{
 for(const row of [null,{current_stock_qty:10,unit:'KOLI'},{current_stock_qty:10,unit:null}]){
  const f=fixture({stocks:{12:row}});await assert.rejects(f.run(lines(),{consume:true}),{code:'PILOT_PRODUCT_OUT_OF_SCOPE'});assert.equal(f.calls.length,1);
 }
});
test('unknown and nonfinite stock rejects even without consuming stock',async()=>{
 for(const value of [null,undefined,NaN,Infinity,'unknown']){
  const f=fixture({stocks:{12:{current_stock_qty:value}}});await assert.rejects(f.run(lines(),{consume:false}),{code:'PILOT_STOCK_UNKNOWN'});assert.equal(f.calls.length,1);
 }
});
test('canonical insufficient stock cannot borrow the legacy negative-stock allowance',async()=>{
 for(const stock of [0,-3,1.99999999])for(const allowNegativeStock of [false,true]){
  const f=fixture({stocks:{12:{current_stock_qty:stock}}});await assert.rejects(f.run(lines(),{consume:true,allowNegativeStock}),{code:'PILOT_STOCK_INSUFFICIENT'});assert.equal(f.calls.length,1);
 }
});
test('canonical consume ignores caller-supplied previousItems stock credit',async()=>{
 const f=fixture({stocks:{12:{current_stock_qty:1}}});await assert.rejects(f.run(lines(),{consume:true,allowNegativeStock:true,previousItems:[{productId:12,quantity:100}]}),{code:'PILOT_STOCK_INSUFFICIENT'});assert.equal(f.calls.length,1);
});
test('exact stock equality is sufficient and a decimal string source stock remains numeric',async()=>{
 const f=fixture({stocks:{12:{current_stock_qty:'2.000'},13:{current_stock_qty:1}}});await f.run(lines(),{consume:true,allowNegativeStock:false});assert.equal(f.calls.length,2);
});
test('the same product claims on another transaction receive the legacy eligibility filter, never canonical authority',async()=>{
 const f=fixture({foreignTransaction:true});await assert.rejects(f.run(lines(),{consume:true}),{code:'PILOT_PRODUCT_OUT_OF_SCOPE'});assert.equal(f.legacyScopes.length,1);assert.match(f.calls[0].sql,/LEGACY_ELIGIBILITY/);assert.notEqual(f.calls[0].parent,f.transaction);
});
test('caller JSON flags cannot create the missing registered canonical product scope',async()=>{
 const f=fixture({canonical:false}),items=lines().map(item=>({...item,canonical:true,nativeProof:{actorId:'17'},operationOrigin:'CANONICAL_TEST_BUSINESS_SALE'}));await assert.rejects(f.run(items,{consume:true,allowNegativeStock:true}),{code:'PILOT_PRODUCT_OUT_OF_SCOPE'});assert.equal(f.legacyScopes.length,1);assert.match(f.calls[0].sql,/LEGACY_ELIGIBILITY/);
});
test('legacy work-night and isolated product scopes preserve their existing negative-stock permission',async()=>{
 for(const legacy of [{legacyNight:true},{isolated:true}]){
  const f=fixture({canonical:false,...legacy,stocks:{12:{current_stock_qty:0}}});await f.run(lines(),{consume:true,allowNegativeStock:true});assert.equal(f.calls.length,2);
  const blocked=fixture({canonical:false,...legacy,stocks:{12:{current_stock_qty:0}}});await assert.rejects(blocked.run(lines(),{consume:true,allowNegativeStock:false}),{code:'PILOT_STOCK_INSUFFICIENT'});
 }
});
test('legacy previousItems restoration credit stays available outside canonical scope',async()=>{
 const f=fixture({canonical:false,legacyNight:true,stocks:{12:{current_stock_qty:1}}});await f.run(lines(),{consume:true,allowNegativeStock:false,previousItems:[{productId:12,quantity:1}]});assert.equal(f.calls.length,2);
});
test('an inactive legacy pilot runtime retains its pre-existing no-query behavior',async()=>{
 const f=fixture({canonical:false,pilot:false});await f.run(lines(),{consume:true});assert.equal(f.calls.length,0);assert.equal(f.lookups.length,0);
});
