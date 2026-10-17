// Structural contract only; SQL readers independently verify the sealed snapshot.
export const isFinalCatalogContext=v=>v?.schemaVersion==='melisa-final-catalog-context.v1';
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
export function validateFinalCatalogContext(v){
 const fail=()=>{throw Error('FINAL_CATALOG_CONTEXT_INVALID');};
 if(!isFinalCatalogContext(v)||!/^FINAL-(?:INVERSE-)?[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.runId??'')||!/^\d{4}-\d{2}-\d{2}$/.test(v.sourceAsOf??'')||v.productCount!==16671||!Number.isInteger(v.priceCount)||v.priceCount<=63774||!['FROZEN_SOURCE','SYNTHETIC_NATIVE_SQL'].includes(v.evidenceKind))fail();
 for(const k of ['sourceHash','planHash','bindingsHash','readerDefinitionHash','stockReaderDefinitionHash','openingDetailDefinitionHash','openingListDefinitionHash','snapshotHash'])if(!hex(v[k]))fail();
 if(v.partyBindingsHash!==undefined&&!hex(v.partyBindingsHash))fail();
 if(!Array.isArray(v.ancestry)||!v.ancestry.length||new Set(v.ancestry.map(a=>a.runId)).size!==v.ancestry.length)fail();
 for(const a of v.ancestry)if(!(a.runId==='VEGA-OPENING-TEST-20261004-06'&&a.sourceAsOf==='2026-09-30'||/^GOAL7-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(a.runId??'')&&a.sourceAsOf==='2026-10-07'||a.runId===v.runId&&a.sourceAsOf===v.sourceAsOf))fail();
 const suffix=v.runId.replaceAll('-','_').toLowerCase(),expected={catalog:`dbo.usp_read_work_catalog_${suffix}`,stock:`dbo.usp_read_stock_products_${suffix}`,detail:`dbo.usp_get_source_version_prices_${suffix}`,list:`dbo.usp_list_source_version_products_${suffix}`};
 if(!v.procedures||Object.keys(v.procedures).length!==4||Object.entries(expected).some(([k,name])=>v.procedures[k]!==name))fail();
 return Object.freeze({...v,ancestry:v.ancestry.map(a=>Object.freeze({...a})),procedures:Object.freeze({...expected})});
}
export function finalCatalogLineage(v,p){return isFinalCatalogContext(v)&&v.ancestry.some(a=>a.runId===p.runId&&a.sourceAsOf===p.sourceAsOf);}
