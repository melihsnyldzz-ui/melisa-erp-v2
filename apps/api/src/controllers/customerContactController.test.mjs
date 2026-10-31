import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,SourceTextModule,SyntheticModule} from 'node:vm';
import * as response from '../utils/response.js';

// Real controller/router source, with isolated service doubles only: no
// credentials, native registry, database, HTTP listener or trade effects.
async function load(path,dependencies){
 const context=createContext({}),modules=new Map();
 const module=new SourceTextModule(await readFile(new URL(path,import.meta.url),'utf8'),{context});
 await module.link(name=>{
  assert(Object.hasOwn(dependencies,name),'Unexpected dependency '+name);
  if(!modules.has(name))modules.set(name,new SyntheticModule(Object.keys(dependencies[name]),function(){for(const [key,value] of Object.entries(dependencies[name]))this.setExport(key,value);},{context}));
  return modules.get(name);
 });await module.evaluate();return module.namespace;
}
async function controller(service){
 const generic=()=>{throw Error('Generic customer CRUD must not be used for contact');};
 return load('./customerController.js',{
  '../services/customerService.js':Object.fromEntries(['changeCustomerPassive','createCustomer','ensureAndListCashCustomers','getCustomerDetail','getCustomersList','updateCustomer'].map(name=>[name,generic])),
  '../services/vegaCustomerClientService.js':{getVegaCustomersListFromWorker:generic},
  '../services/customerCardService.mjs':{customerCardService:{}},
  '../services/customerContactService.mjs':{customerContactService:service},
  '../utils/response.js':response,
 });
}
function res(){return {statusCode:200,status(value){this.statusCode=value;return this;},json(body){this.body=body;return body;}};}

test('actual contact controller forwards authenticated path/query/body without generic CRUD and preserves GET/plain POST/wrapper contract',async()=>{
 const actor={id:17},query={},body={requestId:'modeled'},context={customerId:'100',contact:{phone:'00123'}},result={context,replayed:true},calls=[];
 const api=await controller({context:async(...args)=>{calls.push(['GET',...args]);return context;},update:async(...args)=>{calls.push(['POST',...args]);return result;}});
 const request={params:{id:'100'},user:actor,query,body},get=res(),post=res();
 await api.getCustomerContact(request,get);await api.postCustomerContact(request,post);
 assert.deepEqual(calls,[['GET','100',actor,query],['POST','100',body,actor]]);
 assert.equal(get.body.data,context);assert.equal(post.body.data,result);assert.deepEqual(Object.keys(post.body.data),['context','replayed']);assert.equal(post.body.data.context.contact.phone,'00123');
});
test('actual contact controller exposes only finite codes/statuses and never raw native messages or status overrides',async()=>{
 const errors=[['CUSTOMER_ID_INVALID',400],['CUSTOMER_VALIDATION_FAILED',400],['AUTH_PERMISSION_DENIED',403],['CUSTOMER_CONTACT_FORBIDDEN',403],['CUSTOMER_CONTACT_SCOPE',403],['CUSTOMER_CONTACT_STALE',409],['CUSTOMER_CONTACT_REQUEST_CONFLICT',409],['CUSTOMER_CONTACT_SOURCE_CHANGED',409],['CUSTOMER_CONTACT_UNAVAILABLE',503],['CUSTOMER_CONTACT_UNAVAILABLE_PRIVATE',503],[undefined,503]];
 for(const [code,status] of errors){
  const error=Object.assign(Error('PRIVATE_SQL_CUSTOMER_PHONE'),{code,statusCode:200,number:52113});
  const api=await controller({context:async()=>{throw error;},update:async()=>{throw error;},recover:async()=>{throw error;}});
  for(const name of ['getCustomerContact','getCustomerContactRequest','postCustomerContact']){const reply=res();await api[name]({params:{id:'100'},user:{id:17},query:{},body:{}},reply);assert.equal(reply.statusCode,status);assert.equal(reply.body.success,false);assert.equal(reply.body.error.code,status===503?'CUSTOMER_CONTACT_UNAVAILABLE':code);assert(!JSON.stringify(reply.body).includes('PRIVATE_SQL'));}
 }
});
test('actual router requires normal auth and both existing permissions for contact; POST adds quarantine before its narrow handler',async()=>{
 const routes=[],auth=()=>{},handlerNames=['getCustomer','getCustomerCard','getCustomerCards','getCustomerContact','getCustomerContactRequest','postCustomerContact','getCustomers','getVegaCustomers','patchCustomerPassive','postCashCustomersEnsure','postCustomer','putCustomer'];
 const handlers=Object.fromEntries(handlerNames.map(name=>[name,()=>{}]));
 const permission=code=>Object.freeze({permission:code}),quarantine=kind=>Object.freeze({quarantine:kind});
 const router=Object.fromEntries(['get','post','put','patch'].map(method=>[method,(path,...middleware)=>routes.push({method,path,middleware})]));
 await load('../routes/customerRoutes.js',{
  '../services/operationQuarantineGate.mjs':{operationQuarantineGate:quarantine},express:{Router:()=>router},
  '../controllers/customerController.js':handlers,
  '../middleware/authMiddleware.js':{requireAuth:auth,requirePermission:permission,requireAnyPermission:permission},
 });
 const contact=routes.filter(route=>route.path==='/customers/:id/contact');assert.equal(contact.length,2);
 for(const route of contact){assert.equal(route.middleware[0],auth);assert.deepEqual(route.middleware.slice(1,3),[permission('customer.view'),permission('customer.edit')]);}
 const get=contact.find(route=>route.method==='get'),post=contact.find(route=>route.method==='post');
 assert.equal(get.middleware.length,4);assert.equal(get.middleware.at(-1),handlers.getCustomerContact);
 assert.equal(post.middleware.length,5);assert.deepEqual(post.middleware[3],quarantine('customer'));assert.equal(post.middleware.at(-1),handlers.postCustomerContact);
 const recovery=routes.find(route=>route.path==='/customers/:id/contact/requests/:requestId');assert.equal(recovery.method,'get');assert.deepEqual(recovery.middleware,[auth,permission('customer.view'),permission('customer.edit'),handlers.getCustomerContactRequest]);
 assert(routes.findIndex(route=>route.path==='/customers/:id/contact')<routes.findIndex(route=>route.path==='/customers/:id'));
});


test('recovery controller forwards only authenticated actor/path UUID/query',async()=>{const actor={id:17},query={},calls=[],expected={committed:true,context:{customerId:'100'}};const api=await controller({recover:async(...args)=>{calls.push(args);return expected;}}),reply=res();await api.getCustomerContactRequest({params:{id:'100',requestId:'11111111-1111-4111-8111-111111111111'},user:actor,query,body:{actorId:18}},reply);assert.deepEqual(calls,[['100','11111111-1111-4111-8111-111111111111',actor,query]]);assert.equal(reply.body.data,expected);});
