// Offline-only native request witnesses. No connection, mutation or scope setter.
import assert from 'node:assert/strict';
import {selectedSaleFixture,configureSelectedSaleFixture} from './businessSelectedSalePreview.test.mjs';
import {fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,isolatedCopyJSON} from './isolatedOperationCopyContext.mjs';
import {withIsolatedOperationCopyScope} from './isolatedOperationCopyScope.mjs';
import {selectBusinessSaleWriteIntent} from './businessSelectedSaleWriteIntent.mjs';
import {withBusinessSelectedSaleWriteScope,SELECTED_SALE_WRITE_METADATA_SQL} from './businessSelectedSaleWriteScope.mjs';
import {prepareBusinessSelectedSaleWriteScopeSQL} from '../../../../scripts/canonical/shared-business-selected-sale-write-scope-sql.mjs';

export async function selectedSaleWriteHarness({operation='sale_draft',invoiceId=operation==='sale_draft'?null:'500',currency='USD',mutate=()=>{}}={}){
 const f=await configureSelectedSaleFixture(selectedSaleFixture()),copy=f.c,transaction={},artifact=prepareBusinessSelectedSaleWriteScopeSQL(copy);
 const actor={id:'15',permissions:['sales.view','sales.create','sales.finalize','sales.cancel']};
 const selected=selectBusinessSaleWriteIntent(copy,{customerId:'100',currency,productIds:['444']});
 const requestId='12345678-1234-4234-8234-123456789012';
 const payload={copyId:copy.copyId,sealHash:copy.sealHash,operationOrigin:copy.operationOrigin,actorId:actor.id,operation,requestId,expectedRevision:'a'.repeat(64),businessCustomerId:selected.customerId,businessAccountId:selected.customerAccountId,businessCurrency:currency,businessProductIds:selected.productIds,sourceSelectionHash:selected.sourceSelectionHash,businessSelectedSalePolicyHash:selected.policyHash,...(invoiceId?{id:invoiceId}:{})};
 const intent={schemaVersion:'melisa-selected-sale-native-intent.v1',profileHash:isolatedCopyHash(copy),copyId:copy.copyId,sealHash:copy.sealHash,actorId:actor.id,operation,requestId,payloadHash:isolatedCopyHash(payload),customerId:selected.customerId,customerAccountId:selected.customerAccountId,partyId:selected.partyId,currency,productIds:selected.productIds,policyHash:selected.policyHash,sourceSelectionHash:selected.sourceSelectionHash,rateExact8:selected.rateExact8,maxInvoiceAmountExact4:selected.maxInvoiceAmountExact4,invoiceId,selectedRevision:'a'.repeat(64),...(invoiceId?{invoiceRevision:'a'.repeat(64)}:{})};
 const identity={db:copy.target.database,server:copy.target.server,login:copy.target.login,databaseUser:copy.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0};
 const proof={...fixtureProof(copy),definitionHashes:{...artifact.parentHashes}};
 const customer=copy.customers.find(c=>c.id===selected.customerId&&c.currency===currency);
 const dto={meta:{date:copy.date,operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash},revision:'a'.repeat(64),scope:{synthetic:false,operationOrigin:copy.operationOrigin,customer:{synthetic:false,operationOrigin:copy.operationOrigin,...Object.fromEntries(['id','accountId','partyId','currency','sourceKey','sourceWitnessHash'].map(k=>[k,customer[k]]))},products:copy.products.map(p=>({synthetic:false,operationOrigin:copy.operationOrigin,writeEligible:true,id:p.id,stockCode:p.stockCode,sourceKey:p.sourceKey,sourceWitnessHash:p.sourceWitnessHash,costExact4:p.costExact4,stockQuantityExact3:'10.000',unit:{label:p.unit,factorExact8:p.unitFactorExact8},prices:p.quotes.filter(q=>q.currency===currency).map(q=>({quoteId:q.quoteId,currency:q.currency,unitPriceExact8:q.priceExact8,source:{kind:'isolated-test-copy',copyId:copy.copyId,sealHash:copy.sealHash}}))}))},rate:copy.currencyRates.find(r=>r.currency===currency)};
 const nativeRow={sessionId:91,transactionId:'9007199254740993',readerDefinitionHash:artifact.definitionHash,proof_json:JSON.stringify(proof),actor_json:JSON.stringify({id:actor.id,role:copy.actors.find(a=>a.id==='15').role,active:true,permissions:actor.permissions}),context_json:JSON.stringify(dto),intent_json:JSON.stringify(intent),payload_json:isolatedCopyJSON(payload),payloadHash:isolatedCopyHash(payload)};
 const meta={...identity,sessionId:91,transactionId:nativeRow.transactionId,transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Exclusive',readerDefinitionHash:artifact.definitionHash};
 const calls=[];let count=0;
 const request=()=>({input(){return this;},async query(text){assert.equal(text,SELECTED_SALE_WRITE_METADATA_SQL);calls.push(text);const value=structuredClone(meta);mutate('metadata',value,++count);return {recordset:[value]};},async execute(name){assert.equal(name,artifact.name);calls.push(name);const value=structuredClone(nativeRow);mutate('execute',value);return {recordset:[value]};}});
 const sql={UniqueIdentifier:'uuid',BigInt:'bigint',NVarChar:n=>`nvarchar(${n})`};
 const options={copy,transaction,sql,request,artifact,actor,operation,requestId};
 return {...options,tx:transaction,selected,payload,intent,nativeRow,identity,proof,calls,withScope:fn=>withIsolatedOperationCopyScope({context:copy,transaction,identity,readProof:proof,write:true},()=>withBusinessSelectedSaleWriteScope(options,fn))};
}
