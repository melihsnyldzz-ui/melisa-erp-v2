import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {selectedSaleFixture} from './businessSelectedSalePreview.test.mjs';
import {loadBusinessSelectedSaleStartup,validateBusinessSelectedSaleStartupPin} from './businessSelectedSaleStartup.mjs';
import {getRegisteredBusinessSelectedSaleRevision} from '../../../../scripts/canonical/shared-business-selected-sale-revision-bootstrap.mjs';
import {isolatedCopyHash} from './isolatedOperationCopyContext.mjs';
import {SUPPLIER_ITEM_QUARANTINE_BASE,prepareSupplierItemQuarantineRevision} from '../../../../scripts/canonical/shared-business-supplier-item-quarantine-revision.mjs';
import {SUPPLIER_ITEM_QUARANTINE_MODULES} from '../../../../scripts/canonical/shared-business-supplier-item-quarantine-parent-revision-sql.mjs';
import {OPERATION_QUARANTINE_BASE,prepareOperationQuarantineRevision} from '../../../../scripts/canonical/shared-business-operation-quarantine-revision.mjs';
import {OPERATION_QUARANTINE_MODULES} from '../../../../scripts/canonical/shared-business-operation-quarantine-parent-revision-sql.mjs';

function fixture(change=()=>{}){
 const copy=selectedSaleFixture().c,revisionHash='A'.repeat(64);
 const config={businessReadyRevision:{revisionHash:'B'.repeat(64)},businessReadyPerformanceRevision:{revisionHash:'C'.repeat(64)},businessEffectsPerformanceRevision:{revisionHash:'D'.repeat(64)},businessDailyRevision:{revisionHash:'E'.repeat(64)},businessDailyProfitRevision:{revisionHash:'F'.repeat(64)}};
 const input={schemaVersion:'melisa-selected-sale-startup-input.v1',copyId:copy.copyId,sealHash:copy.sealHash,base:config.businessReadyRevision,performance:config.businessReadyPerformanceRevision,effects:config.businessEffectsPerformanceRevision,daily:{revision:config.businessDailyRevision},profit:{revision:config.businessDailyProfitRevision},nativeCheck:null,schema:[{tableName:'synthetic',columnName:'id'}],selectedRevision:{revisionHash}};
 const detached=structuredClone(input);change(detached);const bytes=Buffer.from(JSON.stringify(detached));
 config.businessSelectedSaleStartup={path:'C:\\Sirket\\ERP\\runtime\\synthetic-selected-sale\\bootstrap.json',sha256:createHash('sha256').update(bytes).digest('hex'),revisionHash};
 return {copy,config,input:detached,bytes};
}
test('absent optional startup retains old boot and performs no private file read',()=>{
 const f=fixture();delete f.config.businessSelectedSaleStartup;
 assert.equal(loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile(){throw Error('unexpected read');}}),null);
});
test('pinned private input preserves exact copy and history but never registers a write grant',()=>{
 const f=fixture(),calls=[];
 assert.deepEqual(loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:p=>{calls.push(p);return f.bytes;}}),f.input);
 assert.equal(calls.length,1);assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);
});
test('private bytes, history, identity, revision and unknown fields fail before native proof',()=>{
 const f=fixture();assert.throws(()=>loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>Buffer.from('{}')}),{code:'SELECTED_STARTUP_BYTES'});
 for(const change of [i=>i.copyId='10000000-0000-4000-8000-000000000099',i=>i.sealHash='0'.repeat(64),i=>i.schema=[],i=>i.extra=true,i=>i.selectedRevision.revisionHash='0'.repeat(64),i=>i.daily.revision.revisionHash='0'.repeat(64)]){
  const changed=fixture(change);assert.throws(()=>loadBusinessSelectedSaleStartup(changed.config,changed.copy,{readFile:()=>changed.bytes}));assert.equal(getRegisteredBusinessSelectedSaleRevision(changed.copy),null);
 }
});
test('startup refuses external files, traversal, ambiguous pin and incompatible optional query plan',()=>{
 for(const file of ['C:\\Sirket\\ERP\\melisa-erp-v2\\profile.json','C:\\Sirket\\ERP\\runtime\\..\\backups\\profile.json','D:\\runtime\\profile.json','C:\\Sirket\\ERP\\runtime\\profile.env','\\\\server\\runtime\\profile.json']){
  const f=fixture();f.config.businessSelectedSaleStartup.path=file;assert.throws(()=>validateBusinessSelectedSaleStartupPin(f.config,f.copy));
 }
 for(const change of [c=>c.businessSelectedSaleStartup.extra=true,c=>c.businessReadinessQueryPlanRevision={},c=>delete c.businessDailyRevision]){const f=fixture();change(f.config);assert.throws(()=>validateBusinessSelectedSaleStartupPin(f.config,f.copy));}
});
function effectsFixture(change=()=>{}){const f=fixture(),overlay={schemaVersion:'melisa-business-selected-sale-effects-revision.v1',version:7,copyId:f.copy.copyId,baseSealHash:f.copy.sealHash,baseSelectedRevisionHash:f.config.businessSelectedSaleStartup.revisionHash,profileHash:isolatedCopyHash(f.copy),modules:Array.from({length:4},(_,i)=>({name:'synthetic'+i,beforeHash:'B'.repeat(64),afterHash:'C'.repeat(64)})),immutableTriggerHash:'D'.repeat(64),optimization:'SELECTED_MAX_IDS_ONCE',revisionHash:'E'.repeat(64)};Object.assign(f.input,{schemaVersion:'melisa-selected-sale-startup-input.v2',selectedEffectsRevision:overlay});change(f.input);f.bytes=Buffer.from(JSON.stringify(f.input));f.config.businessSelectedSaleStartup.sha256=createHash('sha256').update(f.bytes).digest('hex');return f;}
test('v2 optionally carries a separate v7 adjunct without changing the v6 config pin or earning registration',()=>{
 const f=effectsFixture();assert.deepEqual(loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>f.bytes}),f.input);assert.equal(f.config.businessSelectedSaleStartup.revisionHash,'A'.repeat(64));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);
 const absent=effectsFixture(i=>delete i.selectedEffectsRevision);assert.deepEqual(loadBusinessSelectedSaleStartup(absent.config,absent.copy,{readFile:()=>absent.bytes}),absent.input);
});
test('v1 never accepts the new adjunct; v2 unknown null wrong version source or parent rejects before proof',()=>{
 for(const change of [i=>i.schemaVersion='melisa-selected-sale-startup-input.v1',i=>i.schemaVersion='melisa-selected-sale-startup-input.v3',i=>i.extra=true,i=>i.selectedEffectsRevision=null,i=>i.selectedEffectsRevision.extra=true,i=>i.selectedEffectsRevision.version=6,i=>i.selectedEffectsRevision.copyId='wrong',i=>i.selectedEffectsRevision.baseSealHash='F'.repeat(64),i=>i.selectedEffectsRevision.baseSelectedRevisionHash='F'.repeat(64),i=>i.selectedEffectsRevision.profileHash='F'.repeat(64),i=>i.selectedEffectsRevision.modules.pop(),i=>i.selectedEffectsRevision.immutableTriggerHash='wrong']){const f=effectsFixture(change);assert.throws(()=>loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>f.bytes}));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);}
});
function parentFixture(change=()=>{}){const f=effectsFixture(),parent={schemaVersion:'melisa-business-selected-sale-parent-revision.v1',version:8,copyId:f.copy.copyId,baseSealHash:f.copy.sealHash,baseSelectedRevisionHash:f.config.businessSelectedSaleStartup.revisionHash,baseEffectsRevisionHash:f.input.selectedEffectsRevision.revisionHash,profileHash:isolatedCopyHash(f.copy),modules:Array.from({length:4},(_,i)=>({name:'synthetic-parent'+i,beforeHash:'B'.repeat(64),afterHash:'C'.repeat(64)})),immutableTriggerHash:'D'.repeat(64),repair:'CURRENT_PARENT_PINS',revisionHash:'E'.repeat(64)};Object.assign(f.input,{schemaVersion:'melisa-selected-sale-startup-input.v3',selectedParentRevision:parent});change(f.input);f.bytes=Buffer.from(JSON.stringify(f.input));f.config.businessSelectedSaleStartup.sha256=createHash('sha256').update(f.bytes).digest('hex');return f;}
test('v3 loads separately sealed v6 v7 and v8 without changing config pins or earning registration',()=>{
 const f=parentFixture();assert.deepEqual(loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>f.bytes}),f.input);assert.equal(f.config.businessSelectedSaleStartup.revisionHash,'A'.repeat(64));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);
});
test('v3 requires both adjuncts and exact parent identity, source seal, predecessor hash and shape',()=>{
 for(const change of [i=>i.schemaVersion='melisa-selected-sale-startup-input.v2',i=>delete i.selectedEffectsRevision,i=>delete i.selectedParentRevision,i=>i.selectedEffectsRevision=null,i=>i.selectedParentRevision=null,i=>i.selectedParentRevision.extra=true,i=>i.selectedParentRevision.version=7,i=>i.selectedParentRevision.copyId='wrong',i=>i.selectedParentRevision.baseSealHash='F'.repeat(64),i=>i.selectedParentRevision.baseSelectedRevisionHash='F'.repeat(64),i=>i.selectedParentRevision.baseEffectsRevisionHash='F'.repeat(64),i=>i.selectedParentRevision.profileHash='F'.repeat(64),i=>i.selectedParentRevision.modules.pop(),i=>i.selectedParentRevision.immutableTriggerHash='wrong',i=>i.selectedParentRevision.repair='GUARDS_REMOVED',i=>i.selectedEffectsRevision.optimization='GUARDS_REMOVED']){const f=parentFixture(change);assert.throws(()=>loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>f.bytes}));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);}
});

test('v4 is explicit: older schemas, absent/extra source or adjunct and fabricated source bytes fail before native queries',()=>{
 for(const change of [i=>i.schemaVersion='melisa-selected-sale-startup-input.v4',i=>{i.supplierItemQuarantineRevision={};i.supplierItemQuarantineSource={};},i=>{i.schemaVersion='melisa-selected-sale-startup-input.v4';i.supplierItemQuarantineRevision={};},i=>{i.schemaVersion='melisa-selected-sale-startup-input.v4';i.supplierItemQuarantineSource={};},i=>{i.schemaVersion='melisa-selected-sale-startup-input.v4';i.supplierItemQuarantineRevision={};i.supplierItemQuarantineSource={name:SUPPLIER_ITEM_QUARANTINE_BASE.name,definition:'unverified',nativeHash:SUPPLIER_ITEM_QUARANTINE_BASE.definitionSha256.toUpperCase(),utf8Hash:SUPPLIER_ITEM_QUARANTINE_BASE.sourceUtf8Sha256.toUpperCase()};}]){const f=parentFixture(change);assert.throws(()=>loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>f.bytes}));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);}
});

const quarantinePrivatePath=process.env.MELISA_PRIVATE_SUPPLIER_ITEM_TRIGGER;
function quarantineStartupFixture(change=()=>{}){
 const f=parentFixture(),base=SUPPLIER_ITEM_QUARANTINE_BASE,definition=fs.readFileSync(quarantinePrivatePath,'utf8'),leaf=prepareSupplierItemQuarantineRevision(definition);
 f.input.selectedParentRevision.modules=SUPPLIER_ITEM_QUARANTINE_MODULES.slice(1).map(name=>({name,beforeHash:'C'.repeat(64),afterHash:'D'.repeat(64)}));
 const transformation={sourceUtf8Hash:base.sourceUtf8Sha256.toUpperCase(),beforeStatementHash:base.statementSha256.toUpperCase(),afterStatementHash:leaf.afterStatementHash.toUpperCase(),semanticDefinitionHash:leaf.afterHash.toUpperCase(),...Object.fromEntries(['prefixHash','suffixHash','productPredicateHash','invoicePredicateHash'].map(k=>[k,leaf.proof[k].toUpperCase()]))};
 const body={schemaVersion:'melisa-supplier-item-quarantine-parent-revision.v1',version:9,copyId:f.copy.copyId,baseSealHash:f.copy.sealHash,baseSelectedRevisionHash:f.config.businessSelectedSaleStartup.revisionHash,baseEffectsRevisionHash:f.input.selectedEffectsRevision.revisionHash,baseParentRevisionHash:f.input.selectedParentRevision.revisionHash,profileHash:isolatedCopyHash(f.copy),modules:SUPPLIER_ITEM_QUARANTINE_MODULES.map((name,i)=>({name,beforeHash:i===0?base.definitionSha256.toUpperCase():'D'.repeat(64),afterHash:'F'.repeat(64)})),immutableTriggerHash:'A'.repeat(64),optimization:'DISTINCT_AFFECTED_PRODUCT_AND_INVOICE',transformation};
 Object.assign(f.input,{schemaVersion:'melisa-selected-sale-startup-input.v4',supplierItemQuarantineSource:{name:base.name,definition,nativeHash:base.definitionSha256.toUpperCase(),utf8Hash:base.sourceUtf8Sha256.toUpperCase()},supplierItemQuarantineRevision:{...body,revisionHash:isolatedCopyHash(body)}});change(f.input);f.bytes=Buffer.from(JSON.stringify(f.input));f.config.businessSelectedSaleStartup.sha256=createHash('sha256').update(f.bytes).digest('hex');return f;
}
test('ROOT v4 loads pinned private leaf bytes and independent v9 descriptor without earning registration',{skip:!quarantinePrivatePath},()=>{
 const f=quarantineStartupFixture(),loaded=loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>f.bytes});assert.equal(isolatedCopyHash(loaded),isolatedCopyHash(f.input));assert.equal(loaded.supplierItemQuarantineRevision.version,9);assert.equal(f.config.businessSelectedSaleStartup.revisionHash,'A'.repeat(64));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);
});
test('ROOT v4 refuses changed native source, CRLF, wrong predecessor, extra field and coherent unknown scope',{skip:!quarantinePrivatePath},()=>{
 const changes=[i=>i.supplierItemQuarantineSource.definition+='\n',i=>i.supplierItemQuarantineSource.definition=i.supplierItemQuarantineSource.definition.replaceAll('\n','\r\n'),i=>i.supplierItemQuarantineSource.extra=true,i=>i.supplierItemQuarantineSource.name='dbo.other',i=>i.supplierItemQuarantineRevision.baseParentRevisionHash='F'.repeat(64),i=>i.supplierItemQuarantineRevision.modules[0].beforeHash='F'.repeat(64),i=>i.supplierItemQuarantineRevision.modules[1].name='dbo.products_guard',i=>i.supplierItemQuarantineRevision.modules.pop(),i=>i.supplierItemQuarantineRevision.optimization='SKIP_HOLDS',i=>i.supplierItemQuarantineRevision.transformation.prefixHash=null,i=>delete i.selectedParentRevision,i=>delete i.supplierItemQuarantineSource];
 for(const change of changes){const f=quarantineStartupFixture(change);assert.throws(()=>loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>f.bytes}));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);}
});

const operationPrivatePath=process.env.MELISA_PRIVATE_OPERATION_QUARANTINE_ASSERT;
function operationStartupFixture(change=()=>{}){
 const f=quarantineStartupFixture(),base=OPERATION_QUARANTINE_BASE,definition=fs.readFileSync(operationPrivatePath,'utf8'),leaf=prepareOperationQuarantineRevision(definition,{copyId:f.copy.copyId}),transformation={sourceUtf8Hash:base.sourceUtf8Sha256.toUpperCase(),semanticDefinitionHash:leaf.afterHash.toUpperCase(),...Object.fromEntries(['expectedBeforeHash','expectedAfterHash','prefixHash','suffixHash'].map(k=>[k,leaf.proof[k].toUpperCase()]))};
 const body={schemaVersion:'melisa-operation-quarantine-parent-revision.v1',version:10,copyId:f.copy.copyId,baseSealHash:f.copy.sealHash,baseSelectedRevisionHash:f.input.selectedRevision.revisionHash,baseEffectsRevisionHash:f.input.selectedEffectsRevision.revisionHash,baseParentRevisionHash:f.input.selectedParentRevision.revisionHash,baseSupplierItemQuarantineRevisionHash:f.input.supplierItemQuarantineRevision.revisionHash,profileHash:isolatedCopyHash(f.copy),modules:OPERATION_QUARANTINE_MODULES.map((name,i)=>({name,beforeHash:i===0?base.definitionSha256.toUpperCase():f.input.supplierItemQuarantineRevision.modules.find(m=>m.name===name).afterHash,afterHash:'B'.repeat(64)})),immutableTriggerHash:'C'.repeat(64),repair:'NESTED_RESOLVER_CURRENT_MODULE_PINS',transformation};Object.assign(f.input,{schemaVersion:'melisa-selected-sale-startup-input.v5',operationQuarantineSource:{name:base.name,definition,nativeHash:base.definitionSha256.toUpperCase(),utf8Hash:base.sourceUtf8Sha256.toUpperCase()},operationQuarantineRevision:{...body,revisionHash:isolatedCopyHash(body)}});change(f.input);f.bytes=Buffer.from(JSON.stringify(f.input));f.config.businessSelectedSaleStartup.sha256=createHash('sha256').update(f.bytes).digest('hex');return f;
}
test('v5 never accepts omitted, extra or fabricated source pairs in older input formats',()=>{
 for(const change of [i=>i.schemaVersion='melisa-selected-sale-startup-input.v5',i=>{i.operationQuarantineRevision={};i.operationQuarantineSource={};},i=>{i.schemaVersion='melisa-selected-sale-startup-input.v5';i.operationQuarantineRevision={};}]){const f=parentFixture(change);assert.throws(()=>loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>f.bytes}));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);}
});

test('v6 requires exact paired stock source/revision with all V10 predecessors; old formats never consume new fields',()=>{
 for(const change of [i=>i.schemaVersion='melisa-selected-sale-startup-input.v6',i=>{i.stockPredicateRevision={};i.stockPredicateSource={};},i=>{i.schemaVersion='melisa-selected-sale-startup-input.v6';i.stockPredicateRevision={};},i=>{i.schemaVersion='melisa-selected-sale-startup-input.v6';i.stockPredicateSource={};},i=>{i.schemaVersion='melisa-selected-sale-startup-input.v6';i.stockPredicateRevision={};i.stockPredicateSource={};i.operationQuarantineRevision={};i.operationQuarantineSource={};}]){const f=parentFixture(change);assert.throws(()=>loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>f.bytes}));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);}
});
test('ROOT v5 carries all sealed predecessor receipts and exact original assert bytes but does not earn native registration',{skip:!quarantinePrivatePath||!operationPrivatePath},()=>{
 const f=operationStartupFixture(),loaded=loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>f.bytes});assert.equal(isolatedCopyHash(loaded),isolatedCopyHash(f.input));assert.equal(loaded.operationQuarantineRevision.version,10);assert.equal(loaded.supplierItemQuarantineRevision.version,9);assert.equal(f.config.businessSelectedSaleStartup.revisionHash,'A'.repeat(64));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);
});
test('ROOT v5 rejects changed assert bytes, missing v9, wrong predecessor and extra/current unknown module scope',{skip:!quarantinePrivatePath||!operationPrivatePath},()=>{
 for(const change of [i=>i.operationQuarantineSource.definition+='\n',i=>i.operationQuarantineSource.definition=i.operationQuarantineSource.definition.replaceAll('\n','\r\n'),i=>i.operationQuarantineSource.extra=true,i=>i.operationQuarantineSource.name='dbo.other',i=>delete i.supplierItemQuarantineRevision,i=>i.operationQuarantineRevision.baseSupplierItemQuarantineRevisionHash='F'.repeat(64),i=>i.operationQuarantineRevision.modules[0].beforeHash='F'.repeat(64),i=>i.operationQuarantineRevision.modules[1].name='dbo.unknown',i=>i.operationQuarantineRevision.modules.pop(),i=>i.operationQuarantineRevision.extra=true,i=>i.operationQuarantineRevision.transformation.sourceUtf8Hash='F'.repeat(64),i=>i.schemaVersion='melisa-selected-sale-startup-input.v4']){const f=operationStartupFixture(change);assert.throws(()=>loadBusinessSelectedSaleStartup(f.config,f.copy,{readFile:()=>f.bytes}));assert.equal(getRegisteredBusinessSelectedSaleRevision(f.copy),null);}
});
