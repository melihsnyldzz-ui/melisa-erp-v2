import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildP03PhysicalProfile,deriveP03CandidateRules,validateP03ProtectedSqlService,P03_SQL_SERVICE_CAPTURE_PS} from './p03-physical-profile-create.mjs';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(){
 const ownerSid='S-1-5-21-2170750028-1005938530-2568122015-1001',database='MELISA_ERP_CRM_SHARED_TEST_20261009_02',copyId='fixture-copy';
 const component=(packageRoot,sourceCommit,manifestSha256)=>({packageRoot,sourceCommit,manifestSha256,config:{path:'C:\\Sirket\\ERP\\runtime\\fixture.json',sha256:'c'.repeat(64)}});
 const erp=component('C:\\Sirket\\ERP\\releases\\e59','e59e07abf7ae2567cdc2adb93811fe29e0032fe5','2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7');
 const crm=component('C:\\Sirket\\CRM\\releases\\6bc','6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83');
 const supervisor=component('C:\\Sirket\\ERP\\releases\\13b','13bdf75a032ae8f694354a2e57b6ed382aec2f17','195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624');
 const newSettings={ownerSid,database,copyId,actualT1:false,node:{path:'C:\\tools\\node.exe',sha256:'d'.repeat(64)},runtimeDirectory:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon',supervisor,components:{erpApiNative:erp,nativeOrder:erp,crm,hub:erp},privateSources:{operationConfig:erp.config,hubPinConfig:erp.config}};
 const oldSettings=structuredClone(newSettings);oldSettings.components.erpApiNative=component('C:\\Sirket\\ERP\\releases\\old','f'.repeat(40),'e'.repeat(64));
 const tasks=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'].map(name=>({name,state:'Running',xml:'<Task><Actions><Exec><Command>powershell.exe</Command><Arguments>old</Arguments><WorkingDirectory>old</WorkingDirectory></Exec></Actions></Task>'}));
 const now=Date.now();const observedAt=new Date(now).toISOString();
 const identities=Object.fromEntries(['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'].map((role,index)=>[role,{pid:40+index,parentPid:role==='coreSupervisor'?1:30,ownerSid,nodePath:'C:\\tools\\node.exe',commandLine:'node fixture '+role,creationTime:observedAt,...(role==='coreSupervisor'?{}:{parentCreationTime:role==='hub'?null:observedAt})}]));
 return {oldObservation:{schemaVersion:'melisa-p03-owner-observation.v2',ownerSid,database,actualT1:false,hubLineage:'WATCHER_RUNNING_PARENT_EXITED_UNPROVEN',oldConfig:{sha256:'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96'},copyId,observedAt,identities,tasks},extras:{observedAt,tasks,oldWatchers:[{role:'terminalWatcher',pid:1,ownerSid,creationTime:observedAt},{role:'hubWatcher',pid:2,ownerSid,creationTime:observedAt}],protectedProcesses:[{name:'sqlservr.exe',pid:99}]},oldSettings,newSettings,newSettingsRef:{path:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json',sha256:'b'.repeat(64)},businessDigest:{path:'C:\\fixture.json',sha256:'a'.repeat(64)},runId:'1'.repeat(32),now,shellSha256:'d'.repeat(64)};
}
test('builder binds both envelopes to the same before-image raw bytes and normalizes supervisor bindings',()=>{
 const input=fixture(),result=buildP03PhysicalProfile(input);
 const beforeBytes=Buffer.from(result.before.bytesBase64,'base64'),before=JSON.parse(beforeBytes),profile=JSON.parse(Buffer.from(result.profile.bytesBase64,'base64'));
 assert.equal(hash(beforeBytes),profile.beforeImage.sha256);assert.equal(result.summary.beforeImage.path,profile.beforeImage.path);
 assert.deepEqual(before.identities.coreSupervisor.bindings,[]);assert.equal(profile.candidateRules.length,10);assert.equal(profile.candidateRules.find(x=>x.role==='coreSupervisor').receipt,null);
 assert.equal(before.newConfig.sha256,input.newSettingsRef.sha256);assert.equal(result.summary.runtimeMutation,false);
 assert.equal(profile.stopper.path,'C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\MelisaERP-P03-stopper-'+input.runId+'.ps1');
 assert.equal(profile.stopper.sha256,'79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d');
});
test('builder rejects an ERP manifest from another candidate',()=>{
 const input=fixture();input.newSettings.components.erpApiNative.manifestSha256='0'.repeat(64);
 assert.throws(()=>buildP03PhysicalProfile(input),/ERP_EXACT/);
});
test('builder rejects another full commit sharing the accepted prefix',()=>{
 const input=fixture();input.newSettings.components.erpApiNative.sourceCommit='e59e07abf7ae'+'0'.repeat(28);assert.throws(()=>buildP03PhysicalProfile(input),/ERP_EXACT/);
});
test('builder rejects incomplete old-role capture and missing CORE parent birth',()=>{
 const input=fixture();input.oldObservation.identities={coreSupervisor:input.oldObservation.identities.coreSupervisor};assert.throws(()=>buildP03PhysicalProfile(input),/OLD_IDENTITY_ROLES/);
 const missing=fixture();delete missing.oldObservation.identities.erpApi.parentCreationTime;assert.throws(()=>buildP03PhysicalProfile(missing),/OLD_PARENT_BIRTH/);
});
test('builder rejects task drift and stale observations',()=>{
 const input=fixture();input.extras=structuredClone(input.extras);input.extras.tasks[0].xml+='changed';assert.throws(()=>buildP03PhysicalProfile(input),/TASK_DRIFT/);
 const stale=fixture();stale.now+=60001;assert.throws(()=>buildP03PhysicalProfile(stale),/STALE/);
});
test('rules preserve actual CORE receipt schema and derive CRM arguments without a fabricated config argument',()=>{
 const input=fixture();const rules=deriveP03CandidateRules(input.newSettings,input.newSettingsRef);
 const crm=rules.find(x=>x.role==='crmServer');assert.equal(crm.receipt.schemaVersion,null);assert.equal(crm.receipt.exactKeys.length,10);assert.ok(!crm.commandLine.includes(crm.config.path));
});
test('protected writer parses without execution', {skip:process.platform!=='win32'},()=>{
 const source=fileURLToPath(new URL('./p03-physical-profile-create.ps1',import.meta.url));
 const code="$errors=$null;$tokens=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('"+source.replaceAll("'","''")+"',[ref]$tokens,[ref]$errors);if($errors.Count){throw 'PARSE_ERROR'};'PARSE_OK'";
 assert.equal(execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{encoding:'utf8'}).trim(),'PARSE_OK');
});
test('typed SQL protection preserves service/process linkage without manufacturing SID or executable fields',()=>{
 const value={kind:'ProtectedSqlService',name:'sqlservr.exe',pid:6180,creationTime:'2026-10-18T10:00:00Z',service:{name:'MSSQL$MELISADEV',processId:6180,state:'Running',startName:'NT Service\\MSSQL$MELISADEV',pathName:'sqlservr.exe -sMELISADEV'},sql:{serverName:'Semih\\MELISADEV',databaseName:'master',processId:6180}};
 assert.equal(validateP03ProtectedSqlService(value),value);
 assert.throws(()=>validateP03ProtectedSqlService({...value,ownerSid:'invented'}),/SQL_PROTECTED_SCHEMA/);
 assert.throws(()=>validateP03ProtectedSqlService({...value,sql:{...value.sql,processId:9}}),/SQL_PROTECTED_IDENTITY/);
 assert.throws(()=>validateP03ProtectedSqlService({...value,service:{...value.service,name:'MSSQL$OTHER'}}),/SQL_PROTECTED_SERVICE/);
});
test('typed SQL capture source parses without executing SQL', {skip:process.platform!=='win32'},()=>{
 const encoded=Buffer.from(P03_SQL_SERVICE_CAPTURE_PS).toString('base64');
 const code="$errors=$null;$tokens=$null;$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+encoded+"'));[void][System.Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'PARSE_ERROR'};'PARSE_OK'";
 assert.equal(execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{encoding:'utf8'}).trim(),'PARSE_OK');
});
test('protected writer rejects execution of the inherited original stopper before creating any files', {skip:process.platform!=='win32'},()=>{
 const runId='f'.repeat(32),root='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018',beforePath=root+'\\MelisaERP-P03-before-'+runId+'.json';
 const before=Buffer.from(JSON.stringify({schemaVersion:'melisa-p03-owner-observation.v3',runId,ownerSid:'S-1-5-21-2170750028-1005938530-2568122015-1001',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',actualT1:false,observedAt:new Date().toISOString()}));
 const profile=Buffer.from(JSON.stringify({schemaVersion:'melisa-p03-physical-profile.v1',beforeImage:{path:beforePath,sha256:hash(before)},journalDirectory:root+'\\MelisaERP-P03-recovery-'+runId,stopper:{path:'C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014\\stop-exact-observed-process.ps1',sha256:'79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'}}));
 const request={runId,before:{bytesBase64:before.toString('base64'),sha256:hash(before)},profile:{bytesBase64:profile.toString('base64'),sha256:hash(profile)},stopper:{bytesBase64:Buffer.alloc(200).toString('base64'),sha256:'79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'}};
 const source=fileURLToPath(new URL('./p03-physical-profile-create.ps1',import.meta.url));
 assert.throws(()=>execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-File',source],{input:JSON.stringify(request),encoding:'utf8',stdio:['pipe','pipe','pipe']}),error=>/P03_CREATE_STOPPER_SCOPE|P03_CREATE_OWNER/.test(error.stderr));
});
