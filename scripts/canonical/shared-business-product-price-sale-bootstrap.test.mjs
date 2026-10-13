import test from 'node:test';
import assert from 'node:assert/strict';
import {productPriceSaleCompilerFixture} from './shared-business-product-price-sale-sql.test.mjs';
import {BUSINESS_PRICE_SALE_LINK_GUARD,BUSINESS_PRICE_SALE_REGISTRY} from './shared-business-product-price-sale-sql.mjs';
import {BUSINESS_PRODUCT_PRICE_SALE_METADATA_SQL,validateBusinessProductPriceSaleMetadata,validateBusinessProductPriceSaleNativeProof,configureBusinessProductPriceSaleRevision,getRegisteredBusinessProductPriceSaleRevision,verifyBusinessProductPriceSaleRevision} from './shared-business-product-price-sale-bootstrap.mjs';

async function fixture(){
 const f=await productPriceSaleCompilerFixture(),{copy,bundle}=f;
 const frame={db:copy.target.database,server:copy.target.server,login:copy.target.login,databaseUser:copy.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0,sessionId:91,transactionId:'1001',transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Shared',privateAccess:0,contextExecute:1,beginExecute:1,intentExecute:1,historyExecute:1,assertExecute:1,proofExecute:1,proofViewDefinition:1,proofDefinitionHash:bundle.proofArtifact.definitionHash};
 const rows=bundle.objects.map((o,i)=>({copyId:copy.copyId,name:o.name,revision:13,baseSealHash:copy.sealHash,basePriceRevisionHash:bundle.revision.basePriceRevisionHash,baseSelectedRevisionHash:bundle.revision.baseSelectedRevisionHash,profileHash:bundle.revision.profileHash,afterHash:o.afterHash,revisionHash:bundle.revision.revisionHash,actualHash:o.afterHash,immutableTriggerHash:bundle.revision.immutableTriggerHash,triggerDisabled:0,objectId:900+i,objectType:o.name===BUSINESS_PRICE_SALE_LINK_GUARD?'TR':'P',parentName:o.name===BUSINESS_PRICE_SALE_LINK_GUARD?'dbo.work_sales_links':null,moduleDisabled:false,insteadOfTrigger:false,sessionId:91,transactionId:'1001',immutableParentName:BUSINESS_PRICE_SALE_REGISTRY}));
 rows.forEach(r=>Object.assign(r,{registrySchemaValid:true,immutableTriggerObjectId:920,immutableTriggerType:'TR',immutableInsteadOfTrigger:false,immutableEventCount:3}));
 return {...f,frame,result:{recordsets:[rows]}};
}

test('finite native consumer proof checks types, parents, frames and hashes without minting registration',async()=>{
 const {copy,bundle,frame,result}=await fixture();
 assert.equal(validateBusinessProductPriceSaleMetadata(copy,bundle,{recordset:[frame]}),frame);
 assert.equal(validateBusinessProductPriceSaleNativeProof(copy,bundle,result,frame),true);
 assert.equal(getRegisteredBusinessProductPriceSaleRevision(copy),null);
 assert.match(BUSINESS_PRODUCT_PRICE_SALE_METADATA_SQL,/OBJECT_DEFINITION\(OBJECT_ID\(N'dbo\.usp_business_product_price_sale_proof_v1',N'P'\)\)/);
 assert.match(bundle.grantSQL,/GRANT VIEW DEFINITION ON OBJECT::dbo\.usp_business_product_price_sale_proof_v1/);
 assert.match(bundle.grantVerifySQL,/PROOF_VIEW_GRANT/);
 assert.doesNotMatch(bundle.grantSQL,/GRANT VIEW DEFINITION TO|GRANT SELECT/);
});

test('owner self reported proof cannot override restricted actual proof body or private access',async()=>{
 const changes=[m=>m.proofDefinitionHash='F'.repeat(64),m=>m.proofDefinitionHash=null,m=>m.proofViewDefinition=0,m=>m.privateAccess=1,m=>m.proofExecute=0,m=>m.beginExecute=0,m=>m.sysadmin=1,m=>m.originalDatabaseAccess=1,m=>m.transactionId=1001,m=>m.isolationLevel=2,m=>m.copyLockMode='NoLock',m=>m.extra='hidden'];
 for(const change of changes){const {copy,bundle,frame}=await fixture();change(frame);assert.throws(()=>validateBusinessProductPriceSaleMetadata(copy,bundle,{recordset:[frame]}));assert.equal(getRegisteredBusinessProductPriceSaleRevision(copy),null);}
 const {copy,bundle,frame}=await fixture();assert.throws(()=>validateBusinessProductPriceSaleMetadata(copy,bundle,{recordset:[frame]},{write:true}));frame.copyLockMode='Exclusive';assert.equal(validateBusinessProductPriceSaleMetadata(copy,bundle,{recordset:[frame]},{write:true}),frame);
});

test('coherent owner rows still fail wrong parent, source, module, disabled or mixed transaction evidence',async()=>{
 const changes=[r=>r.recordsets[0].pop(),r=>r.recordsets[0].push({...r.recordsets[0][0]}),r=>r.recordsets[0][0].actualHash='E'.repeat(64),r=>r.recordsets[0][0].basePriceRevisionHash='E'.repeat(64),r=>r.recordsets[0][0].baseSelectedRevisionHash='E'.repeat(64),r=>r.recordsets[0][0].immutableParentName='dbo.products',r=>r.recordsets[0][0].triggerDisabled=true,r=>r.recordsets[0][0].objectType='TR',r=>r.recordsets[0][0].objectId=null,r=>r.recordsets[0][1].objectId=r.recordsets[0][0].objectId,r=>r.recordsets[0][0].sessionId=92,r=>r.recordsets[0][0].transactionId='1002',r=>r.recordsets[0][0].unknown=true,r=>r.recordsets[0].find(x=>x.name===BUSINESS_PRICE_SALE_LINK_GUARD).parentName='dbo.product_prices',r=>r.recordsets[0].find(x=>x.name===BUSINESS_PRICE_SALE_LINK_GUARD).moduleDisabled=true,r=>r.recordsets[0].find(x=>x.name===BUSINESS_PRICE_SALE_LINK_GUARD).insteadOfTrigger=true];
 changes.push(r=>r.recordsets[0][0].registrySchemaValid=false,r=>r.recordsets[0][0].immutableTriggerObjectId=null,r=>r.recordsets[0][0].immutableTriggerObjectId=r.recordsets[0][0].objectId,r=>r.recordsets[0][0].immutableTriggerType='P',r=>r.recordsets[0][0].immutableInsteadOfTrigger=true,r=>r.recordsets[0][0].immutableEventCount=2,r=>r.recordsets[0][0].immutableTriggerObjectId=921);
 for(const change of changes){const {copy,bundle,frame,result}=await fixture();change(result);assert.throws(()=>validateBusinessProductPriceSaleNativeProof(copy,bundle,result,frame));assert.equal(getRegisteredBusinessProductPriceSaleRevision(copy),null);}
});

test('compiler output and booleans cannot register a consumer without earned metadata plus v11 native parents',async()=>{
 const {copy,bundle,args}=await fixture();let reads=0;
 const request={query:async()=>{reads++;throw Error('unexpected native query');}};
 await assert.rejects(()=>configureBusinessProductPriceSaleRevision(copy,bundle.revision,request,{selectedBaseInput:args.selectedBaseInput}),{code:'PRICE_SALE_REGISTERED_PARENTS_REQUIRED'});
 await assert.rejects(()=>verifyBusinessProductPriceSaleRevision(copy,request),{code:'PRICE_SALE_REGISTERED_CAPABILITY'});
 assert.equal(reads,0);assert.equal(getRegisteredBusinessProductPriceSaleRevision(copy),null);assert.equal(getRegisteredBusinessProductPriceSaleRevision(structuredClone(copy)),null);
});
