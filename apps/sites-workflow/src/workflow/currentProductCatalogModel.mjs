// A dated TEST publication is distinct from the final frozen cutover contract.
const goal7='GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d';
export function currentProductCatalogVersion(v){
 if(v?.schemaVersion!=='melisa-product-completion-catalog-context.v1'||v.actualT1!==false||v.evidenceKind!=='DATED_TEST_PRODUCT_SCOPE'||!/^PRODUCT-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.runId??'')||!/^\d{4}-\d{2}-\d{2}$/.test(v.sourceAsOf??'')||!Number.isFinite(Date.parse(v.sourceAsOf))||!Number.isSafeInteger(v.productCount)||v.productCount<16671||!Number.isSafeInteger(v.priceCount)||v.priceCount<1)return false;
 if(!['sourceHash','planHash','bindingsHash','readerDefinitionHash','stockReaderDefinitionHash','openingDetailDefinitionHash','openingListDefinitionHash','snapshotHash'].every(k=>/^[a-f0-9]{64}$/i.test(v[k]??'')))return false;
 const expected=[{runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30'},{runId:goal7,sourceAsOf:'2026-10-07'},{runId:v.runId,sourceAsOf:v.sourceAsOf}];
 if(!Array.isArray(v.ancestry)||v.ancestry.length!==3||new Set(v.ancestry.map(a=>a.runId)).size!==3||!expected.every(a=>v.ancestry.some(b=>a.runId===b.runId&&a.sourceAsOf===b.sourceAsOf)))return false;
 if(Object.hasOwn(v,'readerRevision')&&![2,3].includes(v.readerRevision))return false;
 const suffix=v.runId.replaceAll('-','_').toLowerCase()+([2,3].includes(v.readerRevision)?'_r'+v.readerRevision:''),procedures={catalog:`dbo.usp_read_work_catalog_${suffix}`,stock:`dbo.usp_read_stock_products_${suffix}`,detail:`dbo.usp_get_source_version_prices_${suffix}`,list:`dbo.usp_list_source_version_products_${suffix}`};
 return !!v.procedures&&Object.keys(v.procedures).length===4&&Object.entries(procedures).every(([k,p])=>v.procedures[k]===p);
}
export const currentProductLineage=(r,v)=>currentProductCatalogVersion(v)&&r?.provenance?.kind==='accepted-opening'&&v.ancestry.some(a=>a.runId===r.provenance.runId&&a.sourceAsOf===r.provenance.sourceAsOf)&&/^(?:VEGA_CAPTURE_20260930_01|VEGA2026)\/F0102\/TBLSTOKLAR\/[1-9]\d*$/.test(r.provenance.sourceKey);
