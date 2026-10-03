import test,{mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';

let routes,customers,assignments,ready,active,seen;
const cash=[{id:1,code:'1-PEŞİN $',name:'Peşin USD',currency:'USD'},{id:2,code:'2-PEŞİN TL',name:'Peşin TL',currency:'TRY'},{id:3,code:'3-PEŞİN €',name:'Peşin EUR',currency:'EUR'}];
class Request{
 input(key,_type,value){this[key]=value;return this;}
 async query(text){
  seen.push(text);assert.ok(!/\b(?:INSERT|DELETE|MERGE|EXEC|CREATE|ALTER|DROP|TRUNCATE)\b/i.test(text));
  if(text.includes('OBJECT_ID'))return {recordset:[{ready}]};
  if(text.includes('AS route_allowed')){
   assert.ok(!text.includes('FROM dbo.customers'));
   assert.match(text,/a\.customer_id=@routeCustomer/);assert.match(text,/dr\.terminal_device_id=@routeDevice/);
   const c=customers.find(c=>c.id===this.routeCustomer);
   return {recordset:[{route_allowed:active&&(this.routeCash||(assignments[this.routeDevice]||[]).includes(c?.routeId))?1:0}]};
  }
  if(text.includes('pilotCashId')){
   const c=customers.find(c=>c.id===this.pilotCashId);
   return {recordset:c?[{customer_code:c.code,currency_code:c.currency,is_active:1,is_deleted:0}]:[]};
  }
  assert.match(text,/d\.terminal_device_id=@routeDevice/);assert.match(text,/c\.is_active=1 AND c\.is_deleted=0/);
  const ids=assignments[this.routeDevice]||[];
  const allowed=routes.filter(r=>ids.includes(r.id));
  return {recordsets:[[{is_active:active}],allowed,customers.filter(c=>cash.some(x=>x.code===c.code)||allowed.some(r=>r.id===c.routeId))]};
 }
}
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>({request:()=>new Request()}),getSqlDriver:()=>({BigInt:0})}});
const {customerScopeSnapshot,nativeCustomerScope,assertNativeCustomerAccess,withNativeCustomerAccess,hasNativeCustomerAccess,lockNativeCustomerRoutes}=await import('./nativeCustomerRoutes.mjs');
const {assertPilotCashCustomer}=await import('./pilotCashPolicy.mjs');
beforeEach(()=>{
 process.env.NATIVE_CUSTOMER_ROUTES_ENABLED='true';process.env.MELISA_PILOT_RUNTIME='true';
 routes=[{id:11,code:'A',name:'Rota A'},{id:12,code:'B',name:'Rota B'}];
 customers=[...cash,{id:101,code:'C101',name:'Cari A',currency:'USD',routeId:11},{id:102,code:'C102',name:'Cari B',currency:'EUR',routeId:12}];
 assignments={1:[11],2:[12],3:[],4:[11,12]};ready=1;active=1;seen=[];
});

test('device routes include their customers and the same separate cash cards; no routes means cash only',async()=>{
 for(const [id,expected] of [[1,[1,2,3,101]],[2,[1,2,3,102]],[3,[1,2,3]],[4,[1,2,3,101,102]]]){
  const result=await nativeCustomerScope({terminalDeviceId:id});
  assert.deepEqual(result.customers.map(c=>c.id),expected);
  assert.ok(result.customers.filter(c=>c.isCash).every(c=>c.routeId===null));
  assert.match(result.customerScopeRevision,/^[a-f0-9]{64}$/);
 }
});
test('registered legacy device zero keeps its own route scope and transaction access checks',async()=>{
 assignments[0]=[11];
 const result=await nativeCustomerScope({terminalDeviceId:0});
 assert.deepEqual(result.customers.map(c=>c.id),[1,2,3,101]);
 assert.notEqual(result.customerScopeRevision,(await nativeCustomerScope({terminalDeviceId:1})).customerScopeRevision);
 await assertNativeCustomerAccess({id:101,customer_code:'C101',currency_code:'USD'},'USD',{terminalDeviceId:0},()=>new Request());
 await assert.rejects(assertNativeCustomerAccess({id:102,customer_code:'C102',currency_code:'EUR'},'EUR',{terminalDeviceId:0},()=>new Request()),{code:'NATIVE_CUSTOMER_ROUTE_DENIED'});
 assignments[0]=[];
 assert.deepEqual((await nativeCustomerScope({terminalDeviceId:0})).customers.map(c=>c.id),[1,2,3]);
 active=0;
 await assert.rejects(nativeCustomerScope({terminalDeviceId:0}),{code:'NATIVE_CUSTOMER_ROUTE_DENIED'});
});
test('zero-compatible device validation rejects missing, coerced and unsafe identifiers',async()=>{
 for(const id of [null,undefined,'', ' ',false,true,-1,0.5,Number.MAX_SAFE_INTEGER+1,{},[]]){
  await assert.rejects(nativeCustomerScope({terminalDeviceId:id}),{code:'NATIVE_ID_INVALID'});
 }
});
test('revision is stable across row order but changes with assignment, label, currency or device',()=>{
 const rows=customers.filter(c=>c.id!==102),base=customerScopeSnapshot(rows,[routes[0]],1);
 assert.equal(customerScopeSnapshot([...rows].reverse(),[routes[0]],1).customerScopeRevision,base.customerScopeRevision);
 assert.notEqual(customerScopeSnapshot(rows,[routes[0]],2).customerScopeRevision,base.customerScopeRevision);
 assert.notEqual(customerScopeSnapshot(cash,[],1).customerScopeRevision,base.customerScopeRevision);
 assert.notEqual(customerScopeSnapshot(rows,[{...routes[0],name:'Renamed'}],1).customerScopeRevision,base.customerScopeRevision);
 assert.notEqual(customerScopeSnapshot(rows.map(c=>c.id===101?{...c,currency:'TRY'}:c),[routes[0]],1).customerScopeRevision,base.customerScopeRevision);
});
test('bad cash currency, duplicate customer, unknown route and missing cash fail closed',()=>{
 for(const rows of [[...cash,{...cash[0]}],cash.map(c=>c.id===1?{...c,currency:'TRY'}:c),[...cash,customers[3]]]){
  assert.throws(()=>customerScopeSnapshot(rows,[],1),{code:'NATIVE_CUSTOMER_SCOPE_INVALID'});
 }
 assert.throws(()=>customerScopeSnapshot(cash.slice(1),[],1),{code:'NATIVE_CASH_CUSTOMER_UNAVAILABLE'});
});
test('missing schema and inactive device return explicit failure, never all customers',async()=>{
 ready=0;await assert.rejects(nativeCustomerScope({terminalDeviceId:1}),{code:'NATIVE_CUSTOMER_ROUTES_SCHEMA_REQUIRED'});
 assert.equal(seen.length,1);ready=1;active=0;
 await assert.rejects(nativeCustomerScope({terminalDeviceId:1}),{code:'NATIVE_CUSTOMER_ROUTE_DENIED'});
});
test('new sales recheck live assignment with transaction-held locks and reject removed membership',async()=>{
 const row={id:101,customer_code:'C101',currency_code:'USD'};
 await assertNativeCustomerAccess(row,'USD',{terminalDeviceId:1},()=>new Request());
 assert.match(seen.at(-1),/dbo\.customer_route_assignments a WITH\(HOLDLOCK\)/);
  assert.match(seen.at(-1),/dbo\.terminal_device_customer_routes dr WITH\(HOLDLOCK\)/);
 assignments[1]=[];
 await assert.rejects(assertNativeCustomerAccess(row,'USD',{terminalDeviceId:1},()=>new Request()),{code:'NATIVE_CUSTOMER_ROUTE_DENIED'});
 await assert.rejects(assertNativeCustomerAccess(row,'EUR',{terminalDeviceId:1},()=>new Request()),{code:'NATIVE_CUSTOMER_CHANGED'});
});
test('only a verified scoped grant widens the core customer guard, never another request/customer/currency',async()=>{
 const row={id:101,customer_code:'C101',currency_code:'USD'};
 assert.throws(()=>withNativeCustomerAccess({customerId:101,currency:'USD'},()=>{}),{code:'NATIVE_CUSTOMER_SCOPE_INVALID'});
 const grant=await assertNativeCustomerAccess(row,'USD',{terminalDeviceId:1},()=>new Request());
 await assert.rejects(assertPilotCashCustomer(new Request(),101,'USD'),{code:'PILOT_CASH_CUSTOMER_REQUIRED'});
 await withNativeCustomerAccess(grant,async()=>{
  await Promise.resolve();assert.equal(hasNativeCustomerAccess(101,'USD'),true);
  assert.equal(hasNativeCustomerAccess(102,'USD'),false);assert.equal(hasNativeCustomerAccess(101,'EUR'),false);
  await assertPilotCashCustomer(new Request(),101,'USD');
  await assert.rejects(assertPilotCashCustomer(new Request(),102,'EUR'),{code:'PILOT_CASH_CUSTOMER_REQUIRED'});
 });
 assert.equal(hasNativeCustomerAccess(101,'USD'),false);
});
test('disabled feature retains cash-only behavior and never queries route schema',async()=>{
 process.env.NATIVE_CUSTOMER_ROUTES_ENABLED='false';
 await assertNativeCustomerAccess({id:1,customer_code:'1-PEŞİN $',currency_code:'USD'},'USD',{},()=>new Request());
 await assert.rejects(assertNativeCustomerAccess({id:101,customer_code:'C101',currency_code:'USD'},'USD',{},()=>new Request()),{code:'NATIVE_CUSTOMER_CHANGED'});
 assert.equal(seen.length,0);
});

test('routing mutation lock is transaction owned, shared for sales and fails closed on timeout',async()=>{
 let value=0,reads=0;
 const factory=()=>({query:async text=>{reads++;assert.match(text,/@Resource=N'melisa-terminal-customer-routes-v1'/);assert.match(text,/@LockMode=N'Shared'/);assert.match(text,/@LockOwner=N'Transaction'/);return {recordset:[{route_lock_result:value}]};}});
 await lockNativeCustomerRoutes(factory);value=-1;
 await assert.rejects(lockNativeCustomerRoutes(factory),{code:'NATIVE_CUSTOMER_SCOPE_BUSY'});
 process.env.NATIVE_CUSTOMER_ROUTES_ENABLED='false';await lockNativeCustomerRoutes(factory);assert.equal(reads,2);
});
