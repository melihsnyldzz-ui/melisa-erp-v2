import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import {buildCompletionProjection} from './prepare-terminal-completion-private.mjs';
const erp='C:\\Sirket\\ERP',crm='C:\\Sirket\\CRM',runtime=erp+'\\runtime\\terminal-completion-logon',source='b'.repeat(40),hash='a'.repeat(64),db='MELISA_ERP_CRM_SHARED_TEST_20261009_02',copy='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
const bytes=value=>Buffer.from(JSON.stringify(value));
function fixture(){
 const packageRoot=erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261011-bbbbbbb';
 const info=(root,manifest={})=>({root,commit:source,manifestSha256:hash,manifest,files:new Map()});
 const crmInfo=info(crm+'\\releases\\crm-shared-test-'+source);crmInfo.files.set(path.win32.join(crmInfo.root,'apps/frontend/dist/client/index.html').toLowerCase(),hash);
 const operation={value:{database:db,copyContext:{copyId:copy},host:'127.0.0.1',lanHost:'192.168.1.46',webPort:5234,erpPort:4184,nativePort:4186,businessSelectedSaleStartup:{path:erp+'\\runtime\\existing-proof.json',sha256:hash}},bytes:Buffer.from('exact operation bytes')};
 const nativeConfig={value:{database:db,nativePort:62704,crmOrderCurrentContext:{copyId:copy,actualT1:false,externalOperations:false,stockEffect:false,ledgerEffect:false}},bytes:Buffer.from('exact native bytes')};
 const baseline={path:crm+'\\runtime\\accepted.env',sha256:hash},catalogAccess={path:crm+'\\runtime\\accepted-access.json',sha256:hash};
 const environmentVariables={CRM_TEST_EXPECTED_DATABASE:db,CRM_TEST_PORT_BASE:'62700',CRM_ISOLATED_PREPARATION:'true',CRM_TEST_ERP_ORIGIN:'http://127.0.0.1:4184',CRM_TEST_LAN_ADDRESS:'192.168.1.46',CRM_BASELINE_ENV:baseline.path.replaceAll('\\','/'),CRM_ERP_CATALOG_ACCESS_PATH:catalogAccess.path,CRM_TEST_RUNTIME_DIR:crm+'/runtime/existing',CRM_TEST_LOG_DIR:crm+'/logs/existing',CRM_TEST_TERMINAL_PERSONNEL_USERNAME:'crm-ahmet'};
 return {erp:info(packageRoot),native:info(erp+'\\releases\\accepted-native',{packageId:'accepted-native'}),crm:crmInfo,operation,nativeConfig,crmActivation:{value:{environmentVariables}},hubPin:{value:{crmIndexSha256:hash,trainingFiles:{'accepted.png':hash}}},node:{path:'C:\\Program Files\\nodejs\\node.exe',sha256:hash},ownerSid:'S-1-5-21-123-456-789-1001',baseline,catalogAccess,locks:{erpApiNative:{synthetic:true},nativeOrder:{synthetic:true},crm:{synthetic:true}}};
}
test('private projection preserves source bytes and yields exact isolated settings, five-key pin and nine-key Hub startup',()=>{
 const input=fixture(),before=JSON.stringify(input),result=buildCompletionProjection(input);
 assert.equal(result.files.size,10);assert.equal(JSON.stringify(input),before);
 assert.deepEqual(result.files.get(result.settings.privateSources.operationConfig.path),input.operation.bytes);
 assert.deepEqual(result.files.get(result.settings.privateSources.nativeOrderConfig.path),input.nativeConfig.bytes);
 for(const [target,data] of result.files){assert.equal(path.win32.dirname(target),runtime);assert.ok(Buffer.isBuffer(data));}
 const pin=JSON.parse(result.files.get(result.settings.privateSources.hubPinConfig.path));assert.equal(Object.keys(pin).length,5);assert.equal(pin.crmHealthPath,runtime+'\\crm-health-status.json');assert.deepEqual(pin.trainingFiles,input.hubPin.value.trainingFiles);
 const startup=JSON.parse(result.files.get(result.hubStartupPin.path));assert.equal(Object.keys(startup).length,9);assert.equal(startup.RuntimeDir,runtime+'\\hub-web');
 const config=JSON.parse(result.files.get(result.settings.privateSources.crmActivationConfig.path));assert.equal(config.environmentVariables.CRM_BASELINE_ENV,input.baseline.path);assert.equal(config.environmentVariables.CRM_TEST_LAN_ADDRESS,'192.168.1.46');assert.equal(config.environmentVariables.WHATSAPP_SEND_ENABLED,'false');assert.equal(config.environmentVariables.CRM_PAID_AI_ENABLED,'false');
 assert.equal(result.settingsPin.sha256,crypto.createHash('sha256').update(result.files.get(result.settingsPin.path)).digest('hex'));assert.equal(result.plan.installed,false);
});
test('projection rejects changed scope, missing source identity, broad env or changed existing CRM actor',()=>{
 for(const mutate of [x=>x.operation.value.database='LIVE',x=>x.operation.value.lanHost='0.0.0.0',x=>x.nativeConfig.value.crmOrderCurrentContext.stockEffect=true,x=>x.native.manifest.packageId='',x=>x.crmActivation.value.environmentVariables.PRIVATE_TOKEN='fixture',x=>x.crmActivation.value.environmentVariables.CRM_TEST_TERMINAL_PERSONNEL_USERNAME='admin',x=>x.hubPin.value.crmIndexSha256='c'.repeat(64)]){const input=fixture();mutate(input);assert.throws(()=>buildCompletionProjection(input));}
});
test('identical existing private bytes are reused without entering the write map; changed bytes fail closed',()=>{
 const first=buildCompletionProjection(fixture()),existing=first.files;
 const again=buildCompletionProjection({...fixture(),existingFile:target=>existing.get(target)??null});
 assert.equal(again.files.size,0);assert.equal(again.reusedFiles.length,10);assert.deepEqual(again.settingsPin,first.settingsPin);
 assert.throws(()=>buildCompletionProjection({...fixture(),existingFile:()=>Buffer.from('different private bytes')}),/OUTPUT_ALREADY_EXISTS/);
});
test('a newer ERP candidate preserves old private outputs and reuses exact unchanged native and CRM source locks',()=>{
 const first=buildCompletionProjection(fixture()),existing=new Map(first.files),next=fixture();
 next.erp={...next.erp,commit:'c'.repeat(40),root:erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261011-ccccccc'};
 const result=buildCompletionProjection({...next,existingFile:target=>existing.get(target)??null});
 assert.equal(result.files.size,8);assert.equal(result.reusedFiles.length,2);
 for(const name of ['nativeOrder','crm'])assert.deepEqual(result.settings.dependencyLocks[name],first.settings.dependencyLocks[name]);
 assert.equal(result.settings.dependencyLocks.erpApiNative.path,runtime+'\\erpApiNative-cccccccccccc-dependency-lock.json');
 for(const target of result.files.keys())assert.equal(existing.has(target),false);
 assert.equal(existing.size,10);
});
