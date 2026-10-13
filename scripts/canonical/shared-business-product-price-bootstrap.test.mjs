import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSaleFixture} from '../../apps/api/src/services/businessSelectedSalePreview.test.mjs';
import {isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {buildBusinessProductPriceRevision} from './shared-business-product-price-revision-sql.mjs';
import {BUSINESS_PRICE_COPY_ID, BUSINESS_PRICE_TABLES,BUSINESS_PRICE_IMMUTABLE} from './shared-business-product-price-revision-contract.mjs';
import {BUSINESS_PRODUCT_PRICE_METADATA_SQL,validateBusinessProductPriceNativeProof,configureBusinessProductPriceRevision,getRegisteredBusinessProductPriceRevision,verifyBusinessProductPriceRevision} from './shared-business-product-price-bootstrap.mjs';

function nativeType(type){
  const m=type.match(/^(\w+)(?:\(([^)]+)\))?$/),name=m[1],extra=m[2];
  if(name==='decimal')return {typeName:name,maxLength:13,precision:28,scale:8};
  if(name==='datetime2')return {typeName:name,maxLength:8,precision:27,scale:7};
  if(['nvarchar','varchar','char'].includes(name))return {typeName:name,maxLength:extra==='max'?-1:Number(extra)*(name==='nvarchar'?2:1),precision:0,scale:0};
  return {typeName:name,maxLength:name==='bigint'?8:name==='int'?4:16,precision:name==='bigint'?19:name==='int'?10:0,scale:0};
}
export function businessPriceNativeFixture(){
  const {c:copy}=selectedSaleFixture(raw=>{raw.copyId=BUSINESS_PRICE_COPY_ID;});
  const body={version:11,copyId:copy.copyId,baseSealHash:copy.sealHash,modules:[{name:copy.sql.ready.name,afterHash:'B'.repeat(64)}]};
  const bundle=buildBusinessProductPriceRevision({copyContext:copy,baseRevision:{...body,revisionHash:isolatedCopyHash(body)}});
  const recordsets=[[],[],[],[],[],[]];
  for(const name of [...bundle.objects.map(o=>o.name),...BUSINESS_PRICE_TABLES]){
    const module=bundle.objects.find(o=>o.name===name),afterHash=module?.afterHash??'C'.repeat(64);
    recordsets[0].push({copyId:copy.copyId,name,kind:module?'MODULE':'SCHEMA',revision:12,baseSealHash:copy.sealHash,baseRevisionHash:bundle.baseRevisionHash,profileHash:bundle.profileHash,afterHash,revisionHash:bundle.revision.revisionHash,actualHash:afterHash,immutableTriggerHash:bundle.revision.immutableTriggerHash,triggerDisabled:0});
  }
  for(const schema of bundle.schemaDescriptors){
    schema.columns.forEach((c,i)=>recordsets[1].push({tableName:schema.name,ordinal:i+1,columnName:c.name,...nativeType(c.type),nullable:c.nullable,identityColumn:c.identity,defaultDefinition:c.defaultDefinition===null?null:`(${c.defaultDefinition})`}));
    schema.keys.forEach((k,i)=>recordsets[2].push({tableName:schema.name,indexId:i+1,isUnique:true,isPrimary:k.primary,uniqueConstraint:!k.primary,disabled:false,indexType:i===0?1:2,hasFilter:false,filterDefinition:null,columnsJson:JSON.stringify(k.columns.map((columnName,j)=>({columnName,keyOrdinal:j+1,descendingKey:false,included:false})))}));
    schema.foreignKeys.forEach((f,i)=>recordsets[3].push({tableName:schema.name,foreignKeyId:i+1,referencedTable:f.table,disabled:false,notTrusted:false,onDelete:0,onUpdate:0,columnsJson:JSON.stringify(f.columns.map((columnName,j)=>({columnName,referencedColumn:f.referencedColumns[j]})))}));
    schema.checks.forEach(definition=>recordsets[4].push({tableName:schema.name,definition:`(${definition})`,disabled:false,notTrusted:false}));
    recordsets[5].push({tableName:schema.name,triggerName:schema.trigger,disabled:false,insteadOfTrigger:false,eventsJson:JSON.stringify(['DELETE','INSERT','UPDATE'].map(eventName=>({eventName}))),definitionHash:schema.trigger===BUSINESS_PRICE_IMMUTABLE?bundle.revision.immutableTriggerHash:bundle.objects.find(o=>o.name===schema.trigger).afterHash});
  }
  return {copy,bundle,result:{recordsets}};
}
test('canonical finite native shape verifies without minting a registration',()=>{
  const {copy,bundle,result}=businessPriceNativeFixture();
  assert.equal(validateBusinessProductPriceNativeProof(copy,bundle,result),true);
  assert.equal(getRegisteredBusinessProductPriceRevision(copy),null);
});
test('altered native schema cannot hide behind internally consistent registry hashes',()=>{
  const changes=[r=>r.recordsets[1][0].nullable=true,r=>r.recordsets[1].push({...r.recordsets[1][0],columnName:'extra'}),r=>r.recordsets[2][0].disabled=true,r=>r.recordsets[2][0].columnsJson='[{"columnName":"quote_id","keyOrdinal":1,"descendingKey":false,"included":false}]',r=>r.recordsets[3][0].notTrusted=true,r=>r.recordsets[3][0].onDelete=1,r=>r.recordsets[4][0].definition='actor_id=15',r=>r.recordsets[5][0].disabled=true,r=>r.recordsets[5][0].tableName='dbo.products',r=>r.recordsets[5][0].eventsJson='[{"eventName":"INSERT"}]'];
  for(const change of changes){const {copy,bundle,result}=businessPriceNativeFixture();change(result);assert.throws(()=>validateBusinessProductPriceNativeProof(copy,bundle,result));assert.equal(getRegisteredBusinessProductPriceRevision(copy),null);}
});
test('copied registry names, changed predecessor and disabled immutable seals are refused',()=>{
  const changes=[r=>r.recordsets[0][0].copyId='00000000-0000-4000-8000-000000000000',r=>r.recordsets[0][0].baseRevisionHash='D'.repeat(64),r=>r.recordsets[0][0].actualHash='D'.repeat(64),r=>r.recordsets[0][0].kind='SCHEMA',r=>r.recordsets[0][0].triggerDisabled=true,r=>r.recordsets[0][1]=structuredClone(r.recordsets[0][0]),r=>r.recordsets.push([])];
  for(const change of changes){const {copy,bundle,result}=businessPriceNativeFixture();change(result);assert.throws(()=>validateBusinessProductPriceNativeProof(copy,bundle,result));}
});
test('duplicate native constraints cannot replace a missing required constraint',()=>{
  const {copy,bundle,result}=businessPriceNativeFixture();
  const duplicate=structuredClone(result);duplicate.recordsets[2][1]=structuredClone(duplicate.recordsets[2][0]);
  assert.throws(()=>validateBusinessProductPriceNativeProof(copy,bundle,duplicate));
  const fkDuplicate=structuredClone(result);fkDuplicate.recordsets[3][1]=structuredClone(fkDuplicate.recordsets[3][0]);
  assert.throws(()=>validateBusinessProductPriceNativeProof(copy,bundle,fkDuplicate));
});
test('HTTP objects and canonical source descriptors alone never authorize reads or writes',async()=>{
  const {copy,bundle}=businessPriceNativeFixture(),calls=[];
  await assert.rejects(()=>configureBusinessProductPriceRevision(copy,bundle.revision,{query:async q=>{calls.push(q);return {};}}),{code:'BUSINESS_PRICE_REGISTERED_V11_REQUIRED'});
  assert.deepEqual(calls,[]);assert.equal(getRegisteredBusinessProductPriceRevision(copy),null);
  await assert.rejects(()=>verifyBusinessProductPriceRevision(copy,{query:async()=>({})},{write:true}),{code:'BUSINESS_PRICE_REGISTERED_CAPABILITY'});
  assert.match(BUSINESS_PRODUCT_PRICE_METADATA_SQL,/HAS_PERMS_BY_NAME\(t.name,'OBJECT','INSERT'\)=0/);
  assert.match(BUSINESS_PRODUCT_PRICE_METADATA_SQL,/proofDefinitionHash/);
  assert.doesNotMatch(BUSINESS_PRODUCT_PRICE_METADATA_SQL,/WITH EXECUTE AS OWNER/);
});
