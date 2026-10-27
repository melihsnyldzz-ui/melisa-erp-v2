import test from 'node:test';import assert from 'node:assert/strict';
import {TEST125_CATALOG_PACKAGE as P,addCatalogLineageDiagnostic,validateTest125Base} from './prepare-test125-catalog-package.mjs';
test('passive derivative pins real TEST125 and two source modules only',()=>{
 assert.equal(P.baseManifest.length,64);assert.equal(P.overlays.length,2);assert.equal(P.database,'MELISA_ERP_SIRKET_TEST_20260929_01');assert.notEqual(P.base,P.destination);
});
test('exact logger insertion preserves all other bytes and cannot repeat or match unknown template',()=>{
 const before=Buffer.from('prefix\r\nPRODUCT_NOT_FOUND PRODUCT_STOCK_CODE_DUPLICATE\r\nsuffix'),after=addCatalogLineageDiagnostic(before);
 assert.equal(after.toString().replace(' PRODUCT_PREVIOUS_CATALOG_LINEAGE',''),before.toString());assert.throws(()=>addCatalogLineageDiagnostic(after),/LOGGER_TEMPLATE/);assert.throws(()=>addCatalogLineageDiagnostic(Buffer.from('unknown')),/LOGGER_TEMPLATE/);
});
test('wrong package source, database, write scope or manifest digest reject before preparation',()=>{
 const m={sourceCommit:P.baseCommit,packageId:'CANONICAL-TEST-'+P.baseCommit.slice(0,12),database:P.database,apiPort:4144,nativePort:4146,webPort:5194,writes:true,nativeWrites:false,writeScope:'existing-named-test-records',baselineReproduced:true,files:[{path:'apps/api/a.mjs',sha256:'a'.repeat(64)}]};validateTest125Base(m,P.baseManifest);
 for(const k of ['sourceCommit','database','apiPort','writeScope'])assert.throws(()=>validateTest125Base({...m,[k]:'foreign'},P.baseManifest),/BASE_IDENTITY/);
 assert.throws(()=>validateTest125Base(m,'b'.repeat(64)),/BASE_IDENTITY/);assert.throws(()=>validateTest125Base({...m,files:[{path:'../escape',sha256:'a'.repeat(64)}]},P.baseManifest),/BASE_FILES/);
});
