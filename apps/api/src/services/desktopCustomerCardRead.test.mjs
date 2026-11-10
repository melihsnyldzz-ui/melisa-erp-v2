import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopWriteListService} from './desktopWriteListService.mjs';import {isDesktopCustomerCard} from '../../../../packages/shared/src/desktopCustomerCard.mjs';import {customerCardFixture} from './test-fixtures/desktopCustomerCard.fixture.mjs';
function setup({allow=true,target=true,missing=false,change=()=>{},richCards=true}={}){
 const card=customerCardFixture(),calls=[];change(card);let committed=0,rolled=0;
 class Transaction{async begin(){calls.push('begin');}async commit(){committed++;}async rollback(){rolled++;}}
 class Request{constructor(tx){this.tx=tx;this.params={};}input(k,_t,v){this.params[k]=v;return this;}async query(q){calls.push({q,params:this.params,tx:this.tx});

  if(q.includes('FROM dbo.customers c WITH(HOLDLOCK)')){const {accounts,lastSale,salesHistoryAvailable,...header}=card;return {recordset:missing?[]:[header]};}
  if(q.includes('FROM dbo.party_currency_accounts WITH(HOLDLOCK)')){const recordset=card.accounts;Object.defineProperty(recordset,'columns',{value:{id:{type:'varchar'}}});return {recordset};}
  if(q.includes('FROM dbo.sales_invoices i WITH(HOLDLOCK)'))return {recordset:card.lastSale?[card.lastSale]:[]};throw Error('unexpected readonly SQL');}}
 const sql={Transaction,Request,NVarChar:()=>null,Int:{},ISOLATION_LEVEL:{SERIALIZABLE:4}},service=createDesktopWriteListService({pool:{},sql,richCards,verifySession:async context=>{calls.push(context);return allow&&target;}});return {card,calls,service,get committed(){return committed;},get rolled(){return rolled;}};
}
test('customer, every account and latest completed sale belong to one selected verified snapshot',async()=>{
 const x=setup(),card=await x.service.readCustomer('30002','3',{includeSales:true});assert.equal(isDesktopCustomerCard(card,'3'),true);assert.deepEqual(card,x.card);assert.equal(card.phone,'0055500011');assert.equal(x.committed,1);assert.deepEqual(x.calls.find(c=>c?.permission).permission,['customer.view','sales.view']);
 const queries=x.calls.filter(c=>c?.q);assert.equal(new Set(queries.map(c=>c.tx)).size,1);assert.ok(queries.every(c=>c.params.customerId==='3'));assert.match(queries.find(c=>c.q.includes('FROM dbo.customers c WITH(HOLDLOCK)')).q,/e\.role=N'customer'/);assert.match(queries.find(c=>c.q.includes('TOP(1)')).q,/i\.status=N'finalized' AND w\.state='COMPLETED'/);assert.ok(queries.every(c=>!/^\s*(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP)\b/.test(c.q)));
 const latest=queries.find(c=>c.q.includes('TOP(1)'));assert.match(latest.q,/i.created_by=TRY_CONVERT\(bigint,@actorId\)/);assert.equal(latest.params.actorId,'30002');
});
test('customer view without sales view never queries or returns a sale',async()=>{const x=setup(),c=await x.service.readCustomer('7','3');assert.equal(c.salesHistoryAvailable,false);assert.equal(c.lastSale,null);assert.equal(x.calls.find(c=>c?.permission).permission,'customer.view');assert.equal(x.calls.some(c=>c?.q?.includes('FROM dbo.sales_invoices')),false);});
test('foreign parents, duplicate accounts, untrusted or unknown balances roll back instead of leaking another account',async()=>{
 for(const change of [c=>{c.id='4';},c=>{c.accounts[0].customerId='4';},c=>{c.accounts[0].entityId='5';},c=>{c.accounts[0].supplierId='1';},c=>{c.accounts.push({...c.accounts[0],id:'5'});},c=>{c.accounts[0].balanceExact8=null;},c=>{c.accounts[0].balanceStatus='unknown';},c=>{c.accounts[0].balanceExact8='177.00000000';},c=>{c.lastSale.customerId='4';},c=>{c.lastSale.documentDate='2026-02-30';}]){const x=setup({change});await assert.rejects(x.service.readCustomer('7','3',{includeSales:true}));assert.equal(x.committed,0);assert.equal(x.rolled,1);}
 for(const options of [{allow:false},{target:false}]){const x=setup(options);await assert.rejects(x.service.readCustomer('7','3'));assert.equal(x.calls.some(c=>c?.q?.includes('FROM dbo.customers c')),false);assert.equal(x.rolled,1);}
 const missing=setup({missing:true});assert.equal(await missing.service.readCustomer('7','3'),null);assert.equal(missing.committed,1);const old=setup({richCards:false});await assert.rejects(old.service.readCustomer('7','3'));assert.equal(old.calls.length,0);
});
test('separate currency accounts are not combined and the exact main balance remains linked',()=>{const c=customerCardFixture();c.accounts.push({...c.accounts[0],id:'5',currency:'USD',balanceExact8:'3.25000000'});assert.equal(isDesktopCustomerCard(c,'3'),true);c.accounts[1].balanceExact8='0';assert.equal(isDesktopCustomerCard(c,'3'),false);});

test('fresh card preserves empty nullable contact fields without weakening bounds',async()=>{const x=setup({change:c=>{c.phone='';c.city='';c.country='';}});const c=await x.service.readCustomer('7','3');assert.equal(c.phone,'');assert.equal(c.city,'');assert.equal(c.country,'');assert.ok(isDesktopCustomerCard(c,'3'));assert.equal(isDesktopCustomerCard({...c,phone:'x'.repeat(51)},'3'),false);assert.equal(isDesktopCustomerCard({...c,city:0},'3'),false);assert.equal(isDesktopCustomerCard({...c,extra:1},'3'),false);});
