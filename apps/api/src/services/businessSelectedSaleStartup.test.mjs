import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {selectedSaleFixture} from './businessSelectedSalePreview.test.mjs';
import {loadBusinessSelectedSaleStartup,validateBusinessSelectedSaleStartupPin} from './businessSelectedSaleStartup.mjs';
import {getRegisteredBusinessSelectedSaleRevision} from '../../../../scripts/canonical/shared-business-selected-sale-revision-bootstrap.mjs';
import {isolatedCopyHash} from './isolatedOperationCopyContext.mjs';

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
