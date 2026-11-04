import {isFinalCatalogContext,validateFinalCatalogContext,finalCatalogLineage} from './finalCatalogContext.mjs';

const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const priorRun='GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d';
const openingRun='VEGA-OPENING-TEST-20261004-06';
export const isCurrentProductCatalogContext=v=>v?.schemaVersion==='melisa-product-completion-catalog-context.v1';
export function validateCurrentProductCatalogContext(v){
 const fail=()=>{throw Error('CURRENT_PRODUCT_CATALOG_CONTEXT_INVALID');};
 if(!validProductCatalogContext(v))fail();
 if(!isCurrentProductCatalogContext(v)||!/^PRODUCT-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.runId??'')||!/^\d{4}-\d{2}-\d{2}$/.test(v.sourceAsOf??'')||!Number.isFinite(Date.parse(v.sourceAsOf))||v.actualT1!==false||v.evidenceKind!=='DATED_TEST_PRODUCT_SCOPE'||!Number.isSafeInteger(v.productCount)||v.productCount<16671||!Number.isSafeInteger(v.priceCount)||v.priceCount<1)fail();
 for(const k of ['sourceHash','planHash','bindingsHash','readerDefinitionHash','stockReaderDefinitionHash','openingDetailDefinitionHash','openingListDefinitionHash','snapshotHash'])if(!hex(v[k]))fail();
 if(!Array.isArray(v.ancestry)||(!Object.hasOwn(v,'lineageRevision')&&v.ancestry.length!==3)||new Set(v.ancestry.map(a=>a.runId)).size!==v.ancestry.length)fail();
 const expectedAncestry=[{runId:openingRun,sourceAsOf:'2026-09-30'},{runId:priorRun,sourceAsOf:'2026-10-07'},{runId:v.runId,sourceAsOf:v.sourceAsOf}];
 if(expectedAncestry.some(e=>!v.ancestry.some(a=>a.runId===e.runId&&a.sourceAsOf===e.sourceAsOf)))fail();
 if(Object.hasOwn(v,'readerRevision')&&![2,3].includes(v.readerRevision))fail();
 const suffix=v.runId.replaceAll('-','_').toLowerCase()+([2,3].includes(v.readerRevision)?'_r'+v.readerRevision:'');
 const procedures={catalog:`dbo.usp_read_work_catalog_${suffix}`,stock:`dbo.usp_read_stock_products_${suffix}`,detail:`dbo.usp_get_source_version_prices_${suffix}`,list:`dbo.usp_list_source_version_products_${suffix}`};
 if(!v.procedures||Object.keys(v.procedures).length!==4||Object.entries(procedures).some(([k,name])=>v.procedures[k]!==name))fail();
 return Object.freeze({...v,...(v.lineageRevision===2?{previousSourceVersion:validateCurrentProductCatalogContext(v.previousSourceVersion)}:{}),ancestry:Object.freeze(v.ancestry.map(a=>Object.freeze({...a}))),procedures:Object.freeze(procedures)});
}
export const isBoundCatalogContext=v=>isFinalCatalogContext(v)||isCurrentProductCatalogContext(v);
export function validateBoundCatalogContext(v){return isCurrentProductCatalogContext(v)?validateCurrentProductCatalogContext(v):validateFinalCatalogContext(v);}
export function boundCatalogLineage(v,p){return isCurrentProductCatalogContext(v)?v.ancestry.some(a=>a.runId===p.runId&&a.sourceAsOf===p.sourceAsOf):finalCatalogLineage(v,p);}

// Shared browser/server structural contract, not SQL admission or a writer.
const opening={runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30'};
const goal7={runId:'GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d',sourceAsOf:'2026-10-07'};
export function validProductCatalogContext(v,depth=0){
 if(depth>16||v?.schemaVersion!=='melisa-product-completion-catalog-context.v1'||v.actualT1!==false||v.evidenceKind!=='DATED_TEST_PRODUCT_SCOPE'||!/^PRODUCT-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.runId??'')||!/^\d{4}-\d{2}-\d{2}$/.test(v.sourceAsOf??'')||!Number.isFinite(Date.parse(v.sourceAsOf))||!Number.isSafeInteger(v.productCount)||v.productCount<16671||!Number.isSafeInteger(v.priceCount)||v.priceCount<1)return false;
 if(!['sourceHash','planHash','bindingsHash','readerDefinitionHash','stockReaderDefinitionHash','openingDetailDefinitionHash','openingListDefinitionHash','snapshotHash'].every(k=>hex(v[k])))return false;
 if(Object.hasOwn(v,'readerRevision')&&![2,3].includes(v.readerRevision))return false;
 const suffix=v.runId.replaceAll('-','_').toLowerCase()+([2,3].includes(v.readerRevision)?'_r'+v.readerRevision:''),procedures={catalog:`dbo.usp_read_work_catalog_${suffix}`,stock:`dbo.usp_read_stock_products_${suffix}`,detail:`dbo.usp_get_source_version_prices_${suffix}`,list:`dbo.usp_list_source_version_products_${suffix}`};
 if(!v.procedures||Object.keys(v.procedures).length!==4||!Object.entries(procedures).every(([k,p])=>v.procedures[k]===p))return false;
 let expected=[opening,goal7,{runId:v.runId,sourceAsOf:v.sourceAsOf}];
 if(Object.hasOwn(v,'lineageRevision')){
  if(v.lineageRevision!==2||!hex(v.previousVersionHash)||!validProductCatalogContext(v.previousSourceVersion,depth+1))return false;
  const previous=v.previousSourceVersion;
  if(v.sourceAsOf<previous.sourceAsOf||v.productCount<previous.productCount||previous.ancestry.some(a=>a.runId===v.runId))return false;
  expected=[...previous.ancestry,{runId:v.runId,sourceAsOf:v.sourceAsOf}];
 }
 return Array.isArray(v.ancestry)&&v.ancestry.length===expected.length&&new Set(v.ancestry.map(a=>a?.runId)).size===expected.length&&expected.every(a=>v.ancestry.some(b=>a.runId===b?.runId&&a.sourceAsOf===b?.sourceAsOf));
}
export function nextProductCatalogAncestry(previous,current){
 if(previous?.schemaVersion!=='melisa-product-completion-catalog-context.v1')return {ancestry:[{...opening},{...goal7},{...current}]};
 if(!validProductCatalogContext(previous)||previous.ancestry.length>=19||current.sourceAsOf<previous.sourceAsOf||previous.ancestry.some(a=>a.runId===current.runId))throw Error('PRODUCT_PREVIOUS_CATALOG_LINEAGE');
 return {lineageRevision:2,ancestry:[...previous.ancestry.map(a=>({...a})),{...current}]};
}
