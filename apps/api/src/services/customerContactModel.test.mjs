import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {maskPhone} from './queryHelpers.js';
import {CUSTOMER_CONTACT_LIMITS,parseCustomerContactId,assertCustomerContactActor,parseCustomerContact} from './customerContactModel.mjs';

const body=()=>({requestId:'ABCDEF01-2345-4678-9ABC-DEF012345678',expectedRevision:'ab'.repeat(32),phone:'0016100000000',city:'İstanbul',country:'Türkiye'});
const invalid={code:'CUSTOMER_VALIDATION_FAILED',statusCode:400};

test('contact preparation preserves exact strings and nullable fields without changing input or source identity',()=>{
 const input=Object.freeze(body()),before=JSON.stringify(input),result=parseCustomerContact('34765',input);
 assert.equal(result.customerId,'34765');assert.equal(result.phone,'0016100000000');assert.equal(result.city,'İstanbul');assert.equal(result.country,'Türkiye');assert.equal(JSON.stringify(input),before);assert(Object.isFrozen(result));
 assert.deepEqual(Object.keys(JSON.parse(result.payloadJson)),['customerId','requestId','expectedRevision','phone','city','country']);
 for(const field of ['phone','city','country']){const result=parseCustomerContact('34765',{...body(),[field]:null});assert.equal(result[field],null);assert.equal(JSON.parse(result.payloadJson)[field],null);}
});

test('canonical ID remains an exact positive SQL bigint string, including beyond JS integer precision',()=>{
 for(const id of ['1','9007199254740993','9223372036854775807']){assert.equal(parseCustomerContactId(id),id);assert.equal(parseCustomerContact(id,body()).customerId,id);}
 for(const id of [1,9007199254740993,1n,null,undefined,'0','01','-1','1.0','1e3',' 1','1 ','9223372036854775808','99999999999999999999','١'])assert.throws(()=>parseCustomerContact(id,body()),{code:'CUSTOMER_ID_INVALID',statusCode:400});
});

test('only current expanded permission strings admit editing; role names and aliases confer no permission',()=>{
 const actor=Object.freeze({id:15,role:Object.freeze({code:'sales'}),permissions:Object.freeze(['customer.view','customer.edit'])});assert.doesNotThrow(()=>assertCustomerContactActor(actor));
 for(const permissions of [undefined,null,{},new Set(['customer.view','customer.edit']),['customer.view'],['customer.edit'],['customer.update','customer.view'],['customers.manage'],[{key:'customer.view'},{key:'customer.edit'}],['customer.view','customer.edit',{}]])assert.throws(()=>assertCustomerContactActor({id:16,role:{code:'admin'},permissions}),{code:'AUTH_PERMISSION_DENIED',statusCode:403});
 assert.throws(()=>assertCustomerContactActor({role:'admin',isAdmin:true}),{code:'AUTH_PERMISSION_DENIED',statusCode:403});
});

test('editing requires the actual auth DTO safe numeric actor ID without coercion or a hardcoded test actor',()=>{
 for(const id of [1,15,16,23,Number.MAX_SAFE_INTEGER])assert.doesNotThrow(()=>assertCustomerContactActor({id,permissions:['customer.view','customer.edit']}));
 for(const id of [undefined,null,0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'15',15n,{}])assert.throws(()=>assertCustomerContactActor({id,permissions:['customer.view','customer.edit']}),{code:'AUTH_PERMISSION_DENIED',statusCode:403});
 for(const actor of [null,undefined,[],{permissions:['customer.view','customer.edit']}])assert.throws(()=>assertCustomerContactActor(actor),{code:'AUTH_PERMISSION_DENIED',statusCode:403});
});

test('fixed body order and token case produce deterministic UTF16 journal input, bound to the customer ID',()=>{
 const a=parseCustomerContact('1',body()),raw=body(),b=parseCustomerContact('1',{country:raw.country,city:raw.city,phone:raw.phone,expectedRevision:raw.expectedRevision.toUpperCase(),requestId:raw.requestId.toLowerCase()});
 assert.deepEqual(a,b);assert.equal(a.requestId,raw.requestId.toLowerCase());assert.equal(a.expectedRevision,raw.expectedRevision.toUpperCase());assert.equal(a.payloadHash,createHash('sha256').update(a.payloadJson,'utf16le').digest('hex').toUpperCase());
 assert.notEqual(a.payloadHash,parseCustomerContact('2',raw).payloadHash);assert.notEqual(a.payloadHash,parseCustomerContact('1',{...raw,phone:raw.phone+'1'}).payloadHash);
});

test('null, empty and absent values remain distinct; every field must be explicitly supplied',()=>{
 for(const field of ['phone','city','country']){
  const empty=parseCustomerContact('1',{...body(),[field]:''}),cleared=parseCustomerContact('1',{...body(),[field]:null});assert.equal(empty[field],'');assert.notEqual(empty.payloadHash,cleared.payloadHash);
  const absent=body();delete absent[field];assert.throws(()=>parseCustomerContact('1',absent),invalid);
  for(const value of [undefined,0,false,{},[]])assert.throws(()=>parseCustomerContact('1',{...body(),[field]:value}),invalid);
 }
});

test('field sizes fit source DDL and SQL UTF16 length without truncation or numeric phone conversion',()=>{
 assert.deepEqual(CUSTOMER_CONTACT_LIMITS,{phone:40,city:100,country:100});
 for(const [field,max] of Object.entries(CUSTOMER_CONTACT_LIMITS)){
  assert.equal(parseCustomerContact('1',{...body(),[field]:'0'.repeat(max)})[field],'0'.repeat(max));assert.throws(()=>parseCustomerContact('1',{...body(),[field]:'0'.repeat(max+1)}),invalid);
 }
 assert.equal(parseCustomerContact('1',{...body(),city:'🌿'.repeat(50)}).city.length,100);assert.throws(()=>parseCustomerContact('1',{...body(),city:'🌿'.repeat(51)}),invalid);
});

test('control characters and the actual masked-phone representation are rejected',()=>{
 for(const field of ['phone','city','country'])for(const control of ['\u0000','\n','\r','\t','\u001f','\u007f','\u0085','\u009f'])assert.throws(()=>parseCustomerContact('1',{...body(),[field]:'a'+control+'b'}),invalid);
 for(const phone of [maskPhone('0016100000000'),maskPhone('1234'),'****','12*3'])assert.throws(()=>parseCustomerContact('1',{...body(),phone}),invalid);
});

test('identity, currency, account, financial, quarantine and authorization fields cannot enter the contact payload',()=>{
 for(const extra of ['customerId','customerCode','customerName','customerType','currency','currencyCode','accountId','accounts','partyEntityId','balance','currentBalance','isActive','isPassive','hold','quarantine','sourceRecordKey','migrationRunId','sourcePayloadHash','actorId','permissions','copyId'])assert.throws(()=>parseCustomerContact('1',{...body(),[extra]:'changed'}),invalid);
});

test('request UUID and optimistic revision must be complete exact tokens; malformed concurrency input is not repaired',()=>{
 for(const requestId of [null,1,'','abcdef01-2345-0678-9abc-def012345678','abcdef01-2345-4678-7abc-def012345678',body().requestId+' ',body().requestId.replaceAll('-','')])assert.throws(()=>parseCustomerContact('1',{...body(),requestId}),invalid);
 for(const expectedRevision of [null,1,'','a'.repeat(63),'a'.repeat(65),'g'.repeat(64),' '+body().expectedRevision])assert.throws(()=>parseCustomerContact('1',{...body(),expectedRevision}),invalid);
});

test('only plain own data properties are accepted; hidden, inherited, symbolic or getter fields cannot be serialized',()=>{
 for(const raw of [null,[],body().phone,Object.create(body()),Object.assign(Object.create({unexpected:true}),body())])assert.throws(()=>parseCustomerContact('1',raw),invalid);
 const nullPrototype=Object.assign(Object.create(null),body());assert.equal(parseCustomerContact('1',nullPrototype).phone,body().phone);
 const symbol=body();symbol[Symbol('extra')]=1;assert.throws(()=>parseCustomerContact('1',symbol),invalid);
 const hidden=body();Object.defineProperty(hidden,'extra',{value:1});assert.throws(()=>parseCustomerContact('1',hidden),invalid);
 let reads=0;const getter=body();Object.defineProperty(getter,'phone',{get(){reads++;return '123';},enumerable:true});assert.throws(()=>parseCustomerContact('1',getter),invalid);assert.equal(reads,0);
 const inaccessible=new Proxy(body(),{ownKeys(){throw Error('Blocked object');}});assert.throws(()=>parseCustomerContact('1',inaccessible),invalid);
});
