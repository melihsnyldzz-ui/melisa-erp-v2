import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCurrentProductCatalogContext,validateBoundCatalogContext,boundCatalogLineage} from './currentProductCatalogContext.mjs';
const runId='PRODUCT-a6090360-2739-41e6-8b98-cedecb78bf0d';
function context(){const suffix=runId.replaceAll('-','_').toLowerCase();return {schemaVersion:'melisa-product-completion-catalog-context.v1',runId,sourceAsOf:'2026-10-08',actualT1:false,evidenceKind:'DATED_TEST_PRODUCT_SCOPE',productCount:16674,priceCount:64018,sourceHash:'a'.repeat(64),planHash:'b'.repeat(64),bindingsHash:'c'.repeat(64),readerDefinitionHash:'d'.repeat(64),stockReaderDefinitionHash:'e'.repeat(64),openingDetailDefinitionHash:'f'.repeat(64),openingListDefinitionHash:'1'.repeat(64),snapshotHash:'2'.repeat(64),ancestry:[{runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30'},{runId:'GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d',sourceAsOf:'2026-10-07'},{runId,sourceAsOf:'2026-10-08'}],procedures:{catalog:`dbo.usp_read_work_catalog_${suffix}`,stock:`dbo.usp_read_stock_products_${suffix}`,detail:`dbo.usp_get_source_version_prices_${suffix}`,list:`dbo.usp_list_source_version_products_${suffix}`}};}
test('dated product scope preserves old source lineage and never claims final T1',()=>{const c=validateCurrentProductCatalogContext(context());assert.equal(c.actualT1,false);assert.equal(c.productCount,16674);for(const a of c.ancestry)assert.equal(boundCatalogLineage(c,a),true);assert.equal(boundCatalogLineage(c,{runId:c.runId,sourceAsOf:'2026-09-30'}),false);});
test('wrong reader names, missing proof or rebased ancestry fail closed',()=>{for(const modify of [c=>c.procedures.catalog='dbo.usp_read_work_catalog_goal7',c=>c.readerDefinitionHash='bad',c=>c.ancestry[1].sourceAsOf='2026-09-30',c=>c.ancestry.pop(),c=>c.actualT1=true,c=>c.evidenceKind='FROZEN_SOURCE',c=>c.productCount=16670]){const c=context();modify(c);assert.throws(()=>validateCurrentProductCatalogContext(c));}});
test('new dated TEST scope does not loosen old final context validation',()=>{const c=context();c.schemaVersion='melisa-final-catalog-context.v1';assert.throws(()=>validateBoundCatalogContext(c));});
test('optional reader revision two accepts only the four exact additive r2 names',()=>{
 const old=context(),validated=validateCurrentProductCatalogContext(old);assert.equal(Object.hasOwn(validated,'readerRevision'),false);assert.deepEqual(validated.procedures,old.procedures);
 const revised={...old,readerRevision:2,procedures:Object.fromEntries(Object.entries(old.procedures).map(([k,p])=>[k,p+'_r2']))};
 assert.equal(validateCurrentProductCatalogContext(revised).readerRevision,2);assert.deepEqual(validateCurrentProductCatalogContext(revised).ancestry,old.ancestry);
 for(const revision of [undefined,null,0,1,3,'2',true])assert.throws(()=>validateCurrentProductCatalogContext({...revised,readerRevision:revision}));
 assert.throws(()=>validateCurrentProductCatalogContext({...old,readerRevision:2}));
 assert.throws(()=>validateCurrentProductCatalogContext({...revised,readerRevision:undefined}));
 for(const k of Object.keys(old.procedures)){const bad={...revised,procedures:{...revised.procedures,[k]:old.procedures[k]}};assert.throws(()=>validateCurrentProductCatalogContext(bad));}
});
test('revision three requires exact r3 names and does not reinterpret r1 or r2 contexts',()=>{
 const old=context(),revised={...old,readerRevision:3,procedures:Object.fromEntries(Object.entries(old.procedures).map(([k,p])=>[k,p+'_r3']))};
 assert.equal(validateCurrentProductCatalogContext(revised).readerRevision,3);
 for(const revision of [undefined,null,0,1,4,'3',true])assert.throws(()=>validateCurrentProductCatalogContext({...revised,readerRevision:revision}));
 for(const kind of Object.keys(old.procedures))for(const suffix of ['', '_r2'])assert.throws(()=>validateCurrentProductCatalogContext({...revised,procedures:{...revised.procedures,[kind]:old.procedures[kind]+suffix}}));
 for(const key of ['readerDefinitionHash','stockReaderDefinitionHash','openingDetailDefinitionHash','openingListDefinitionHash'])assert.throws(()=>validateCurrentProductCatalogContext({...revised,[key]:'bad'}));
 assert.equal(Object.hasOwn(validateCurrentProductCatalogContext(old),'readerRevision'),false);
});
