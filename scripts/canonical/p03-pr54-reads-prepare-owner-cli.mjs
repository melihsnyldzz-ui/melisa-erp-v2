import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';

import {verifyPr53CompletePackageInventory} from './p03-pr53-package-inventory.mjs';
import {preparePr54ReadOwnerProfile,preparePr54B264OwnerProfile,prepareCurrentB007OwnerProfile} from './p03-pr53-ci-owner-preparation.mjs';
import {validateCompletionDependencyLock} from './terminal-completion-logon.mjs';
const require=createRequire(import.meta.url),repo=path.resolve(import.meta.dirname,'../..');
const writerEnvironment={...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'};
const stage=name=>console.error(JSON.stringify({stage:name}));
async function main(){
if(process.argv.length>4||!['--DryRun','--PrepareNew',undefined].includes(process.argv[2])||process.argv[3]!==undefined&&!['--B264','--CurrentB007'].includes(process.argv[3]))throw Error('MODE_REJECTED');
const b264=process.argv[3]==='--B264';
const currentB007=process.argv[3]==='--CurrentB007';
const prepareNew=process.argv[2]==='--PrepareNew';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
if(execFileSync('git',['remote','get-url','origin'],{cwd:repo,encoding:'utf8'}).trim()!=='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git'||execFileSync('git',['remote','get-url','--push','origin'],{cwd:repo,encoding:'utf8'}).trim()!=='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git'||execFileSync('git',['branch','--show-current'],{cwd:repo,encoding:'utf8'}).trim()!=='codex/erp-p03-pr53-candidate-20261018')throw Error('SOURCE_REPO_REJECTED');
const currentHead=execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve(import.meta.dirname,'../..'),encoding:'utf8'}).trim(),supervisorSource=currentB007?'da5b394919941f73b9d7098f146fffd362c2a955':currentHead;if(!/^[a-f0-9]{40}$/.test(currentHead)||execFileSync('git',['status','--porcelain'],{cwd:path.resolve(import.meta.dirname,'../..'),encoding:'utf8'}).trim())throw Error('CLEAN_SOURCE_REQUIRED');
const supervisorRoot='C:/Sirket/ERP/releases/CANONICAL-CRM06-SUPERVISOR-TEST-'+(b264||currentB007?'20261020':'20261019')+'-'+supervisorSource.slice(0,12);
if(fs.realpathSync.native(supervisorRoot).toLowerCase()!==path.resolve(supervisorRoot).toLowerCase())throw Error('SUPERVISOR_ROOT_REPARSE');
const manifestBytes=fs.readFileSync(path.join(supervisorRoot,'release-manifest.json'));
const supervisorManifest=sha(manifestBytes);
const manifest=JSON.parse(manifestBytes);
if(currentB007&&(supervisorManifest!=='b7b4fd27f8658e2e43cf699fcebdaf5a58209ebed07391cd4185490aa0dae0bf'||manifest.files?.length!==408))throw Error('CURRENT_SUPERVISOR_CHANGED');
if(manifest.sourceCommit!==supervisorSource||manifest.packageRole!=='SUPERVISOR_ONLY'||manifest.applicationDeployment!==false||manifest.writes!==false||manifest.files.length!==execFileSync('git',['ls-tree','-r','--name-only',supervisorSource,'scripts/canonical'],{cwd:repo,encoding:'utf8'}).trim().split(/\r?\n/).length)throw Error('SUPERVISOR_ROLE_CHANGED');
const seen=new Set();for(const row of manifest.files){if(!/^scripts\/canonical\/[-_a-zA-Z0-9./]+$/.test(row.path)||row.path.includes('..')||seen.has(row.path.toLowerCase()))throw Error('SUPERVISOR_PATH_CHANGED');seen.add(row.path.toLowerCase());const file=path.join(supervisorRoot,row.path),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase()||sha(fs.readFileSync(file))!==row.sha256||sha(execFileSync('git',['show',supervisorSource+':'+row.path],{cwd:repo,maxBuffer:8*1024*1024}))!==row.sha256)throw Error('SUPERVISOR_FILE_CHANGED');}
let observed=0;function scan(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())throw Error('SUPERVISOR_REPARSE');if(item.isDirectory())scan(file);else if(item.isFile()){const relative=path.relative(supervisorRoot,file).replaceAll('\\','/');if(relative!=='release-manifest.json'&&!seen.has(relative.toLowerCase()))throw Error('SUPERVISOR_EXTRA');if(relative!=='release-manifest.json')observed++;}else throw Error('SUPERVISOR_SPECIAL');}}scan(supervisorRoot);if(observed!==seen.size)throw Error('SUPERVISOR_INVENTORY_CHANGED');
stage('SUPERVISOR_VERIFIED');
const sealed=await import(pathToFileURL(path.join(supervisorRoot,'scripts/canonical/crm06-staff-refresh-successor.mjs')).href);
const actors=await import(pathToFileURL(path.join(supervisorRoot,'scripts/canonical/crm06-owner-projection.mjs')).href);
const {buildCrm06StaffRefreshSuccessor,assertCrm06StaffRefreshSuccessor,CRM06_STAFF_PARENT_SETTINGS_PATH,CRM06_STAFF_PARENT_ACTIVATION_PATH,crm06StaffSuccessorProfile}=sealed;
const {CRM06_BASELINE_PATH,CRM06_ACTOR_AUDIT_PATH}=actors;
const readPinned=ref=>{if(!ref||typeof ref.path!=='string'||!fs.existsSync(ref.path))throw Error('PIN_MISSING');const bytes=fs.readFileSync(ref.path);if(sha(bytes)!==ref.sha256)throw Error('PIN_CHANGED');return bytes;};
const jsonPinned=ref=>JSON.parse(readPinned(ref).toString('utf8').replace(/^\uFEFF/,''));
const source=currentB007?'d1e4425206249e38445fb103e03601f86baa84ec':'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',variant=currentB007?'erp-crm-current-20261020':b264?'erp-crm-pr54-b264-20261020':'erp-crm-pr54-reads-20261019',ownerSid=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'}).trim();
const profile=crm06StaffSuccessorProfile(source,variant),root='C:/Sirket/ERP/runtime/terminal-completion-logon';
const installed={path:path.join(root,'settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json'),sha256:'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'};
jsonPinned(installed);
const erpPin=currentB007?sealed.CRM06_STAFF_CURRENT_ERP_PACKAGE:{packageRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a',sourceCommit:'01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2',manifestSha256:'8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'};
const crmPin=currentB007?sealed.CRM06_STAFF_CURRENT_CRM_PACKAGE:{packageRoot:'C:\\Sirket\\CRM\\releases\\crm-shared-test-6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',sourceCommit:source,manifestSha256:'e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'};
const supervisorPin={packageRoot:supervisorRoot.replaceAll('/','\\'),sourceCommit:supervisorSource,manifestSha256:supervisorManifest};
for(const pin of [erpPin,crmPin,supervisorPin])readPinned({path:path.win32.join(pin.packageRoot,'release-manifest.json'),sha256:pin.manifestSha256});
const erpManifest=JSON.parse(readPinned({path:path.win32.join(erpPin.packageRoot,'release-manifest.json'),sha256:erpPin.manifestSha256}));
if(currentB007&&(erpManifest.sourceCommit!==erpPin.sourceCommit||erpManifest.files?.length!==2123||execFileSync('git',['rev-parse',erpPin.sourceCommit+'^{tree}'],{cwd:repo,encoding:'utf8'}).trim()!=='f9420b46dc5859c49034d1e8bbcffd20648b2822'))throw Error('ERP_PACKAGE_CHANGED');
if(!currentB007&&(erpManifest.sourceCommit!==erpPin.sourceCommit||erpManifest.files.length!==2089))throw Error('ERP_PACKAGE_CHANGED');
const erpSeen=new Set();for(const row of erpManifest.files){if(typeof row.path!=='string'||row.path.includes('..')||erpSeen.has(row.path.toLowerCase()))throw Error('ERP_PATH_CHANGED');erpSeen.add(row.path.toLowerCase());const file=path.join(erpPin.packageRoot,row.path),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase()||sha(fs.readFileSync(file))!==row.sha256)throw Error('ERP_FILE_CHANGED');}
const erpObserved=[];
function scanErp(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())throw Error('ERP_INVENTORY_REPARSE');if(entry.isDirectory()){scanErp(file);continue;}if(!entry.isFile()||stat.nlink!==1)throw Error('ERP_INVENTORY_PHYSICAL');erpObserved.push({path:path.relative(erpPin.packageRoot,file).replaceAll('\\','/'),sha256:sha(fs.readFileSync(file))});}}
scanErp(erpPin.packageRoot);const erpCompleteInventory=verifyPr53CompletePackageInventory(erpManifest,erpObserved);
if(erpObserved.find(x=>x.path==='release-manifest.json')?.sha256!==erpPin.manifestSha256)throw Error('ERP_MANIFEST_RACE');
const crmManifest=JSON.parse(readPinned({path:path.win32.join(crmPin.packageRoot,'release-manifest.json'),sha256:crmPin.manifestSha256}));
if(crmManifest.source?.commit!==crmPin.sourceCommit||crmManifest.source?.tree!==(currentB007?'ce0e2a95a2d9897aedbd021d79a5c6a5e0371d19':'714f198561fb47d1e1c7308c274c117dba40367b')||crmManifest.files.length!==2292)throw Error('CRM_SOURCE_CHANGED');
if(currentB007){
 const nodePin=sealed.CRM06_STAFF_ERP_CANDIDATE_NODE_RUNTIME;
 if(process.platform!=='win32'||process.arch!=='x64'||process.version!=='v24.19.0'||path.resolve(process.execPath).toLowerCase()!==path.resolve(nodePin.path).toLowerCase())throw Error('CURRENT_NODE_CHANGED');
 readPinned(nodePin);const toolchain=await import(pathToFileURL(path.join(supervisorRoot,'scripts/canonical/terminal-completion-logon.mjs')).href);toolchain.assertCompletionCrmPackageToolchain(crmManifest);
 if(crmManifest.files.find(row=>row.path==='apps/frontend/dist/client/index.html')?.sha256!==sealed.CRM06_STAFF_CURRENT_CRM_INDEX)throw Error('CURRENT_CRM_INDEX_CHANGED');
}
if(fs.realpathSync.native(crmPin.packageRoot).toLowerCase()!==path.resolve(crmPin.packageRoot).toLowerCase())throw Error('CRM_ROOT_REPARSE');
const crmSeen=new Set();for(const row of crmManifest.files){if(typeof row.path!=='string'||row.path.includes('..')||crmSeen.has(row.path.toLowerCase()))throw Error('CRM_PATH_CHANGED');crmSeen.add(row.path.toLowerCase());const file=path.join(crmPin.packageRoot,row.path),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase()||sha(fs.readFileSync(file))!==row.sha256)throw Error('CRM_FILE_CHANGED');}
let crmObserved=0;function scanCrm(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())throw Error('CRM_REPARSE');if(item.isDirectory())scanCrm(file);else if(item.isFile()){const relative=path.relative(crmPin.packageRoot,file).replaceAll('\\','/');if(relative!=='release-manifest.json'&&!crmSeen.has(relative.toLowerCase()))throw Error('CRM_EXTRA');if(relative!=='release-manifest.json')crmObserved++;}else throw Error('CRM_SPECIAL');}}scanCrm(crmPin.packageRoot);if(crmObserved!==crmSeen.size)throw Error('CRM_INVENTORY_CHANGED');
stage('PACKAGES_VERIFIED');
const dotenv=require(path.win32.join(crmPin.packageRoot,'apps/gateway/node_modules/dotenv/lib/main.js'));
const installedSettings=jsonPinned(installed),installedReceipt=jsonPinned(installedSettings.crmPrivateFiles.crm06StaffSuccessor);
const parentSettingsRef=installedReceipt.parent?.settingsRef;
if(parentSettingsRef?.path!==CRM06_STAFF_PARENT_SETTINGS_PATH)throw Error('PARENT_PIN_CHANGED');
const parentSettingsBytes=readPinned(parentSettingsRef),parentSettings=JSON.parse(parentSettingsBytes.toString('utf8').replace(/^\uFEFF/,''));
const parentActivation=jsonPinned(parentSettings.privateSources.crmActivationConfig);
if(parentSettings.privateSources.crmActivationConfig.path!==CRM06_STAFF_PARENT_ACTIVATION_PATH)throw Error('PARENT_ACTIVATION_CHANGED');
const baselineRef=parentSettings.crmPrivateFiles.baseline,auditRef=parentSettings.crmPrivateFiles.crm06Actors;
if(baselineRef.path!==CRM06_BASELINE_PATH||auditRef.path!==CRM06_ACTOR_AUDIT_PATH)throw Error('PARENT_ACTORS_CHANGED');
const baseline=Object.fromEntries(Object.entries(dotenv.parse(readPinned(baselineRef))));
const parentAudit=jsonPinned(auditRef),parentHubPin=jsonPinned(parentSettings.privateSources.hubPinConfig),parentHubStartup=jsonPinned(parentSettings.privateSources.hubStartupConfig);
let crmDependencyLockRef={path:profile.dependencyLockPath,sha256:'4f6e35ba06223b18c394fa2b6f16b7311cac9a561c7d210c1de2db1ef67e1b06'};

const erpFiles=[],depSeen=new Set();
function dependencies(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())throw Error('DEPENDENCY_REPARSE');if(entry.isDirectory()){dependencies(file);continue;}if(!entry.isFile()||stat.nlink!==1)throw Error('DEPENDENCY_PHYSICAL');const relative=path.relative(erpPin.packageRoot,file).replaceAll('\\','/');if(!relative.startsWith('apps/api/node_modules/')||depSeen.has(relative.toLowerCase()))throw Error('DEPENDENCY_PATH');depSeen.add(relative.toLowerCase());erpFiles.push({path:relative,sha256:sha(fs.readFileSync(file))});}}
dependencies(path.join(erpPin.packageRoot,'apps/api/node_modules'));erpFiles.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
if(sha(Buffer.from(JSON.stringify(erpFiles,null,2)+'\n'))!==erpCompleteInventory.dependencyInventories.find(x=>x.prefix==='apps/api/node_modules/').inventorySha256)throw Error('ERP_DEPENDENCY_RACE');
const erpDependencyLock={schemaVersion:1,sourceCommit:erpPin.sourceCommit,packageRoot:erpPin.packageRoot,files:erpFiles};validateCompletionDependencyLock(erpDependencyLock,erpPin,'apps/api');
const erpDependencyLockRef={path:profile.erpDependencyLockPath,sha256:sha(Buffer.from(JSON.stringify(erpDependencyLock,null,2)+'\n'))};
let crmDependencyLock;
if(currentB007){
 const files=crmManifest.files.filter(row=>row.path.startsWith('apps/gateway/node_modules/')).map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 crmDependencyLock={schemaVersion:1,sourceCommit:crmPin.sourceCommit,packageRoot:crmPin.packageRoot,files};
 crmDependencyLockRef={path:profile.dependencyLockPath,sha256:sha(Buffer.from(JSON.stringify(crmDependencyLock,null,2)+'\n'))};
}else crmDependencyLock=jsonPinned(crmDependencyLockRef);
validateCompletionDependencyLock(crmDependencyLock,crmPin,'apps/gateway');
// Independently compare every CRM dependency and the complete inventory.
const crmDependencyPaths=new Set(crmDependencyLock.files.map(row=>row.path.toLowerCase()));let crmDependencyCount=0;
function crmDependencies(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())throw Error('CRM_DEPENDENCY_REPARSE');if(entry.isDirectory()){crmDependencies(file);continue;}if(!entry.isFile()||stat.nlink!==1)throw Error('CRM_DEPENDENCY_PHYSICAL');const relative=path.relative(crmPin.packageRoot,file).replaceAll('\\','/'),row=crmDependencyLock.files.find(x=>x.path===relative);if(!crmDependencyPaths.has(relative.toLowerCase())||!row||sha(fs.readFileSync(file))!==row.sha256)throw Error('CRM_DEPENDENCY_CHANGED');crmDependencyCount++;}}
crmDependencies(path.join(crmPin.packageRoot,'apps/gateway/node_modules'));if(crmDependencyCount!==crmDependencyPaths.size)throw Error('CRM_DEPENDENCY_INVENTORY');
stage('DEPENDENCIES_VERIFIED');
const journal=await import(pathToFileURL(path.join(supervisorRoot,'scripts/canonical/crm06-staff-journal-preflight.mjs')).href);
const evidence=await journal.inspectCrm06StaffJournalPhysical({ownerSid,source,profileVariant:variant,excludedPaths:journal.crm06StaffJournalExcludedPaths(source,variant)});
if(evidence.status!=='READY'||evidence.references.length!==journal.crm06StaffJournalExcludedPaths(source,variant).length)throw Error('JOURNAL_NOT_READY');
stage('JOURNAL_VERIFIED');
const evidenceRef={path:profile.journalEvidencePath,sha256:sha(Buffer.from(JSON.stringify(evidence,null,2)+'\n'))};
const parentInputs={baseline,parentActivation,parentAudit,parentSettings,parentSettingsRef,parentHubPin,parentHubStartup,ownerSid};
const prepared=(currentB007?prepareCurrentB007OwnerProfile:b264?preparePr54B264OwnerProfile:preparePr54ReadOwnerProfile)({parentInputs,erpDependencyLockRef,erpDependencyLock,crmDependencyLockRef,crmDependencyLock,journalEvidenceRef:evidenceRef,journalEvidence:evidence,supervisorPin});
const outputs=[['activation',prepared.activation,prepared.activationRef],['hubPin',prepared.hubPin,prepared.hubPinRef],['hubStartup',prepared.hubStartup,prepared.hubStartupRef],['settings',prepared.settings,prepared.settingsRef],['receipt',prepared.receipt,prepared.receiptRef]];
for(const [name,value,ref] of outputs){const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');if(sha(bytes)!==ref.sha256)throw Error('OUTPUT_HASH_DRIFT:'+name);}

const reusedErpDependency=(b264||currentB007)&&fs.existsSync(erpDependencyLockRef.path);
if(reusedErpDependency)readPinned(erpDependencyLockRef);
const pending=[...(currentB007?[['crmDependencyLock',crmDependencyLock,crmDependencyLockRef]]:[]),...(reusedErpDependency?[]:[['erpDependencyLock',erpDependencyLock,erpDependencyLockRef]]),['journalEvidence',evidence,evidenceRef],...outputs];
for(const [name,value,ref] of pending){if(fs.existsSync(ref.path))throw Error('NEW_TARGET_EXISTS:'+name);if(sha(Buffer.from(JSON.stringify(value,null,2)+'\n'))!==ref.sha256)throw Error('OUTPUT_HASH_DRIFT:'+name);}
stage('OUTPUTS_PREPARED');
if(prepareNew){
 for(const port of [4184,4186,5234]){const response=await fetch('http://127.0.0.1:'+port+'/test-health',{signal:AbortSignal.timeout(15000)}),h=await response.json();if(!response.ok||h.actualT1!==false||h.databaseName!=='MELISA_ERP_CRM_SHARED_TEST_20261009_02'||h.copyId!=='e16b70f0-4057-428b-9abc-6bbcaf35fe82'||h.sourceCommit!=='e59e07abf7ae2567cdc2adb93811fe29e0032fe5')throw Error('CURRENT_RUNTIME_CHANGED');}

 jsonPinned(installed);jsonPinned(installedSettings.crmPrivateFiles.crm06StaffSuccessor);readPinned(parentSettingsRef);
 for(const [name,value,ref] of pending){const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n'),template=name==='receipt'||name==='journalEvidence'?installedSettings.crmPrivateFiles.crm06StaffSuccessor.path:installed.path;
 let result;try{const child=spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(import.meta.dirname,'p03-pr54-reads-protected-create.ps1'),'-Target',ref.path,'-Template',template,'-ExpectedSha256',ref.sha256,...(currentB007?['-Generation','CurrentB007']:b264?['-Generation','B264']:[])],{input:bytes,windowsHide:true,timeout:30000,maxBuffer:4096,env:writerEnvironment});if(child.status!==0||child.error||String(child.stderr??'').trim()){if(String(child.stderr??'').includes('P03_BUILTIN_MODULE_IMPORT_FAILED'))throw Error('P03_BUILTIN_MODULE_IMPORT_FAILED');throw Error('P03_PROTECTED_WRITER_EXEC_FAILED');}result=child.stdout.toString('utf8').trim();}catch(error){if(error?.message==='P03_BUILTIN_MODULE_IMPORT_FAILED'||String(error?.stderr??'').includes('P03_BUILTIN_MODULE_IMPORT_FAILED'))throw Error('P03_BUILTIN_MODULE_IMPORT_FAILED');throw Error('P03_PROTECTED_WRITER_EXEC_FAILED');}
 if(result!=='CREATED_PROTECTED '+ref.sha256||sha(fs.readFileSync(ref.path))!==ref.sha256)throw Error('PROTECTED_WRITE_FAILED:'+name);
 stage('CREATED_'+name);
 }
}
console.log(JSON.stringify({status:prepareNew?'PREPARED_INACTIVE':'DRY_RUN_READY',installed:false,profileVariant:variant,reusedErpDependency,erpCompleteInventory,outputs:pending.map(([name,,ref])=>({name,path:ref.path,sha256:ref.sha256})),rollbackCurrentSettingsSha256:installed.sha256}));
}
main().catch(error=>{console.error(JSON.stringify({status:'PREPARATION_FAILED_PARTIAL_FILES_RETAINED',reason:/^[A-Z_]+(?::[A-Za-z]+)?$/.test(error?.message??'')?error.message:'PRIVATE_DETAIL_WITHHELD'}));process.exitCode=1;});
