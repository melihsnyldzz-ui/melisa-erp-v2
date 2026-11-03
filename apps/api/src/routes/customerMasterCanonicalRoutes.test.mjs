import test from 'node:test';
import assert from 'node:assert/strict';
import {createCustomerMasterCanonicalRoutes} from './customerMasterCanonicalRoutes.mjs';
import {createCanonicalCustomerMasterBinding} from '../services/customerMasterCanonicalBinding.mjs';
import {customerMasterSqlFixture,identityActor as actor} from '../services/customerMasterSql.test-fixture.mjs';

const uuid='11111111-1111-4111-8111-111111111111';
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
const route=(router,path,method)=>router.stack.find(layer=>layer.route?.path===path&&layer.route.methods[method]).route.stack;
// Exercise the real post-auth middleware and handler with a synthetic actor.
// This helper never executes the production router or opens a listener.
async function dispatch(stack,req){const res=response();let i=1,error;const next=e=>{if(e){error=e;return;}return stack[i++].handle(req,res,next);};await next();if(error)throw error;return res;}
test('unmounted canonical router keeps normal authentication and exact route/permission surface',async()=>{
 const f=customerMasterSqlFixture({normal:true}),binding=await createCanonicalCustomerMasterBinding(f.normalOptions),router=createCustomerMasterCanonicalRoutes(binding);
 assert.deepEqual(router.stack.map(l=>[l.route.path,Object.keys(l.route.methods)[0]]),[['/customer-cards','get'],['/customers/:id/card','get'],['/customers/:id/master/requests/:requestId','get'],['/customers/:id/master','get'],['/customers/:id/master','post']]);
 const stack=route(router,'/customers/:id/master','post');let denied;await stack[0].handle({get:()=>''},response(),e=>{denied=e;});assert.equal(denied?.code,'AUTH_TOKEN_REQUIRED');
 for(const permissions of [[],['customer.view'],['customer.edit']])await assert.rejects(dispatch(stack,{user:{...actor,permissions},params:{id:'100'},body:{}}),{code:'AUTH_PERMISSION_DENIED'});
 assert.equal(f.snapshot().journal.length,0);assert.throws(()=>createCustomerMasterCanonicalRoutes({service:{},cards:{}}),/CUSTOMER_MASTER_UNAVAILABLE/);
});
test('synthetic binding reads an edited card with its original accounts and replays exactly once',async()=>{
 const f=customerMasterSqlFixture({normal:true}),binding=await createCanonicalCustomerMasterBinding(f.normalOptions),router=createCustomerMasterCanonicalRoutes(binding);
 const card=route(router,'/customers/:id/card','get'),master=route(router,'/customers/:id/master','get'),save=route(router,'/customers/:id/master','post');
 const req={user:actor,params:{id:'100'},query:{},body:{}};
 const before=await dispatch(card,req),context=await dispatch(master,req);
 const data=context.body.data;req.body={requestId:uuid,expectedRevision:data.revision,customerCode:'000100',customerName:'Sentetik örnek',customerType:'wholesale'};
 assert.equal((await dispatch(save,req)).statusCode,200);assert.equal((await dispatch(save,req)).statusCode,200);
 const after=await dispatch(card,req);assert.equal(after.body.data.customerCode,'000100');assert.equal(after.body.data.customerName,'Sentetik örnek');assert.deepEqual(after.body.data.accounts,before.body.data.accounts);assert.equal(f.snapshot().journal.length,1);assert.equal(f.snapshot().audit.length,1);
});
test('schema or target failure remains closed for both projection and edit; no fallback or write',async()=>{
 for(const frame of [{schemaValid:false},{db:'OTHER'},{actorJson:'[]'}]){const f=customerMasterSqlFixture({normal:true}),binding=await createCanonicalCustomerMasterBinding(f.normalOptions),router=createCustomerMasterCanonicalRoutes(binding),before=f.snapshot();f.modes.frame=frame;
  for(const [path,method] of [['/customers/:id/card','get'],['/customers/:id/master','get'],['/customers/:id/master','post']]){const result=await dispatch(route(router,path,method),{user:actor,params:{id:'100'},query:{},body:{requestId:uuid,expectedRevision:'A'.repeat(64),customerCode:'000100',customerName:'İsim',customerType:'customer'}});assert.notEqual(result.statusCode,200);}
  assert.deepEqual(f.snapshot(),before);
 }
});
