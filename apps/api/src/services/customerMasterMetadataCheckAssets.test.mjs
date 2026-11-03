import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createCustomerMasterMetadataCheckAssets,validateCustomerMasterMetadataCheckAsset} from './customerMasterMetadataCheckAssets.mjs';
const path='apps/api/client-assets/customer-master-metadata-check.js',bytes=Buffer.from('/* fixed public client */'),sha256=createHash('sha256').update(bytes).digest('hex');
const fixture=()=>({customerMasterMetadataOverlay:{schemaVersion:'melisa-c06-metadata-api-overlay.v1',kind:'CUSTOMER_MASTER_METADATA_READ_ONLY',sourceCommit:'a'.repeat(40),masterWriterEnabled:false,actualT1:false,externalOperations:false,clientAsset:{path,sha256}},files:[{path,sha256}]});
test('only the startup-admitted public asset bytes are returned; later manifest edits cannot authorize replacements',()=>{
 const release=fixture();let current=bytes;const assets=createCustomerMasterMetadataCheckAssets(release,{readAsset:()=>current});
 const result=assets();assert.equal(result.script,bytes.toString());assert.match(result.html,/\/api\/customer-master-metadata-check\/client.mjs/);
 current=Buffer.from('/* replacement */');const changed=createHash('sha256').update(current).digest('hex');release.customerMasterMetadataOverlay.clientAsset.sha256=changed;release.files[0].sha256=changed;assert.throws(assets,/ASSET_UNAVAILABLE/);
 current=bytes;assert.equal(assets().script,bytes.toString());
});
test('wrong source, mode, path, hash, duplicate/missing file rows and oversized/empty assets fail closed',()=>{
 const edits=[m=>m.customerMasterMetadataOverlay.sourceCommit='bad',m=>m.customerMasterMetadataOverlay.kind='WRITER',m=>m.customerMasterMetadataOverlay.actualT1=true,m=>m.customerMasterMetadataOverlay.masterWriterEnabled=true,m=>m.customerMasterMetadataOverlay.externalOperations=true,m=>m.customerMasterMetadataOverlay.clientAsset.path='../secret',m=>m.files.push({...m.files[0]}),m=>m.files=[],m=>m.files[0].sha256='b'.repeat(64),m=>delete m.customerMasterMetadataOverlay];
 for(const edit of edits){const m=fixture();edit(m);assert.throws(()=>validateCustomerMasterMetadataCheckAsset(m,bytes),/ASSET_UNAVAILABLE/);}
 for(const b of [Buffer.alloc(0),Buffer.alloc(2*1024*1024+1),Buffer.from('changed'),bytes.toString()])assert.throws(()=>validateCustomerMasterMetadataCheckAsset(fixture(),b),/ASSET_UNAVAILABLE/);
 assert.throws(createCustomerMasterMetadataCheckAssets(undefined,{readAsset:()=>bytes}),/ASSET_UNAVAILABLE/);
});
