import test from 'node:test';
import assert from 'node:assert/strict';
import {validProductCatalogContext} from './product-catalog-lineage.mjs';
import {productCompletionContext} from './product-completion-plan.mjs';
import {validateCurrentProductCatalogContext,boundCatalogLineage} from '../../apps/api/src/services/currentProductCatalogContext.mjs';
import {currentProductCatalogVersion,currentProductLineage} from '../../apps/sites-workflow/src/workflow/currentProductCatalogModel.mjs';
import {catalogProductDto} from '../../apps/api/src/services/catalogModel.mjs';
import {catalogEnvelope} from '../../apps/sites-workflow/src/workflow/workCatalogModel.mjs';

const run=n=>`PRODUCT-00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const h='a'.repeat(64);
function context(n,previous){
 const v=productCompletionContext({runId:run(n),sourceAsOf:`2026-10-${String(n+7).padStart(2,'0')}`,sourceHash:h,planHash:h,previousVersion:{context:previous??{runId:'GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d'},products:[],prices:[],records:[]},productCount:16743,priceCount:64333,bindingsHash:h});
 for(const field of ['readerDefinitionHash','stockReaderDefinitionHash','openingDetailDefinitionHash','openingListDefinitionHash'])v[field]=h;
 return v;
}
test('second and third dated product batches retain all prior native lineage in both normal readers',()=>{
 const first=context(1),before=JSON.stringify(first),second=context(2,first),third=context(3,second);
 assert.equal(JSON.stringify(first),before);assert.equal(Object.hasOwn(first,'lineageRevision'),false);
 assert.equal(second.lineageRevision,2);assert.equal(second.ancestry.length,4);assert.equal(third.ancestry.length,5);
 for(const c of [first,second,third]){
  assert.equal(validProductCatalogContext(c),true);assert.equal(currentProductCatalogVersion(c),true);assert.deepEqual(validateCurrentProductCatalogContext(c).ancestry,c.ancestry);
  for(const a of c.ancestry){assert.equal(boundCatalogLineage(c,a),true);assert.equal(currentProductLineage({provenance:{...a,kind:'accepted-opening',sourceKey:'VEGA2026/F0102/TBLSTOKLAR/41'}},c),true);}
 }
});
test('extra ancestors without the additive revision stay rejected; unknown or rebased parents cannot enter a new publication',()=>{
 const first=context(1),second=context(2,first);
 for(const mutate of [c=>{delete c.lineageRevision;},c=>{c.lineageRevision=3;},c=>{delete c.previousSourceVersion;},c=>{c.previousVersionHash='bad';},c=>{c.ancestry[2].sourceAsOf='2026-10-01';},c=>{c.previousSourceVersion.readerDefinitionHash='bad';},c=>{c.previousSourceVersion.procedures.catalog='dbo.fake';},c=>{c.sourceAsOf='2026-10-01';},c=>{c.productCount=16700;},c=>{c.ancestry.push({runId:run(9),sourceAsOf:'2026-10-20'});}]){
  const c=structuredClone(second);mutate(c);assert.equal(currentProductCatalogVersion(c),false);assert.throws(()=>validateCurrentProductCatalogContext(c));
 }
 const bad=structuredClone(first);bad.readerDefinitionHash='bad';assert.throws(()=>context(2,bad),/PRODUCT_PREVIOUS_CATALOG_LINEAGE/);
 assert.throws(()=>context(1,first),/PRODUCT_PREVIOUS_CATALOG_LINEAGE/);
});
test('cyclic previous contexts fail closed with bounded traversal',()=>{
 const c=context(2,context(1));c.previousSourceVersion=c;
 assert.equal(validProductCatalogContext(c),false);assert.equal(currentProductCatalogVersion(c),false);assert.throws(()=>validateCurrentProductCatalogContext(c));
});
test('normal API DTO and normal green catalog envelope preserve an untouched older batch under a new dated version',()=>{
 const first=context(1),next=context(2,first),validated=validateCurrentProductCatalogContext(next);
 assert(Object.isFrozen(validated.previousSourceVersion));assert(Object.isFrozen(validated.previousSourceVersion.ancestry));
 const source='VEGA2026/F0102/TBLSTOKLAR/41';
 const raw={id:'41',stockCode:'0007 ÖRNEK',displayCode:'0007',productName:'TAKIM',classification:{brand:'ÖRNEK',productType:'TAKIM',sourceName:'TAKIM',verified:true},isActive:true,stockQuantityExact:'4.00000000',unit:{label:'ADET',sourceId:'71',factorExact8:'1.00000000',verified:true},barcodes:[{id:'51',value:'000041',isPrimary:true,sourceKey:source+'/BARCODE/71'}],imageUrl:null,provenance:{kind:'accepted-opening',sourceKey:source,runId:first.runId,sourceAsOf:first.sourceAsOf,verified:true,mediaSourceKey:null,mediaRunId:null},hold:{blocked:false,reasons:[]},salePrices:[],photo:{status:'missing',url:null,sourceKey:null,verified:false}};
 const dto=catalogProductDto(raw,{sourceVersion:next});assert.equal(dto.provenance.runId,first.runId);
 const envelope={success:true,data:[dto],meta:{schemaVersion:'melisa-catalog.v1',readOnly:true,currentVersion:next,sourceAsOf:next.sourceAsOf,readAt:'2026-10-27T01:00:00.000Z',freshLive:false,total:1,page:1,limit:50,totalPages:1,canViewSalesPrices:false,filters:{brands:['ÖRNEK'],productTypes:['TAKIM']},scopeCounts:{acceptedOpening:next.productCount,quarantinedSource:54,syntheticTest:0}}};
 assert.equal(catalogEnvelope(envelope).data[0].displayCode,'0007');
 const foreign=structuredClone(envelope);foreign.data[0].provenance.runId=run(9);assert.throws(()=>catalogEnvelope(foreign));
});
