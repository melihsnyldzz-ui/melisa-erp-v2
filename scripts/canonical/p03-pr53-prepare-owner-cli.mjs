import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

import {verifyPr53CompletePackageInventory} from './p03-pr53-package-inventory.mjs';
import {preparePr53OwnerProfile} from './p03-pr53-owner-preparation.mjs';
import {validateCompletionDependencyLock} from './terminal-completion-logon.mjs';
const require=createRequire(import.meta.url);
async function main(){
if(process.argv.length>3||!['--DryRun','--PrepareNew',undefined].includes(process.argv[2]))throw Error('MODE_REJECTED');
const prepareNew=process.argv[2]==='--PrepareNew';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const supervisorRoot='C:/Sirket/ERP/releases/CANONICAL-CRM06-SUPERVISOR-TEST-20261018-8f1167229c8d',supervisorManifest='bfb65fabcbd8eac606c7cf9572337759e53140f6701da0c58c7134b9cc0aa892';
if(fs.realpathSync.native(supervisorRoot).toLowerCase()!==path.resolve(supervisorRoot).toLowerCase())throw Error('SUPERVISOR_ROOT_REPARSE');
const manifestBytes=fs.readFileSync(path.join(supervisorRoot,'release-manifest.json'));
if(sha(manifestBytes)!==supervisorManifest)throw Error('SUPERVISOR_MANIFEST_CHANGED');
const manifest=JSON.parse(manifestBytes);
if(manifest.sourceCommit!=='8f1167229c8d9c10844fc8e1be533487180d2071'||manifest.packageRole!=='SUPERVISOR_ONLY'||manifest.applicationDeployment!==false||manifest.writes!==false||manifest.files.length!==310)throw Error('SUPERVISOR_ROLE_CHANGED');
const seen=new Set();for(const row of manifest.files){if(!/^scripts\/canonical\/[-_a-zA-Z0-9./]+$/.test(row.path)||row.path.includes('..')||seen.has(row.path.toLowerCase()))throw Error('SUPERVISOR_PATH_CHANGED');seen.add(row.path.toLowerCase());const file=path.join(supervisorRoot,row.path),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase()||sha(fs.readFileSync(file))!==row.sha256)throw Error('SUPERVISOR_FILE_CHANGED');}
let observed=0;function scan(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())throw Error('SUPERVISOR_REPARSE');if(item.isDirectory())scan(file);else if(item.isFile()){const relative=path.relative(supervisorRoot,file).replaceAll('\\','/');if(relative!=='release-manifest.json'&&!seen.has(relative.toLowerCase()))throw Error('SUPERVISOR_EXTRA');if(relative!=='release-manifest.json')observed++;}else throw Error('SUPERVISOR_SPECIAL');}}scan(supervisorRoot);if(observed!==seen.size)throw Error('SUPERVISOR_INVENTORY_CHANGED');
const sealed=await import(pathToFileURL(path.join(supervisorRoot,'scripts/canonical/crm06-staff-refresh-successor.mjs')).href);
const actors=await import(pathToFileURL(path.join(supervisorRoot,'scripts/canonical/crm06-owner-projection.mjs')).href);
const {buildCrm06StaffRefreshSuccessor,assertCrm06StaffRefreshSuccessor,CRM06_STAFF_PARENT_SETTINGS_PATH,CRM06_STAFF_PARENT_ACTIVATION_PATH,crm06StaffSuccessorProfile}=sealed;
const {CRM06_BASELINE_PATH,CRM06_ACTOR_AUDIT_PATH}=actors;
const readPinned=ref=>{if(!ref||typeof ref.path!=='string'||!fs.existsSync(ref.path))throw Error('PIN_MISSING');const bytes=fs.readFileSync(ref.path);if(sha(bytes)!==ref.sha256)throw Error('PIN_CHANGED');return bytes;};
const jsonPinned=ref=>JSON.parse(readPinned(ref).toString('utf8').replace(/^\uFEFF/,''));
const source='6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',variant='erp-crm-pr53-20261018',ownerSid=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'}).trim();
const profile=crm06StaffSuccessorProfile(source,variant),root='C:/Sirket/ERP/runtime/terminal-completion-logon';
const installed={path:path.join(root,'settings-crm06-staff-439b63db8376-erp-crm-node24-hub-ready.json'),sha256:'be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96'};
jsonPinned(installed);
const erpPin={packageRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-COMPLETE-TEST-20261018-c88d7010f831',sourceCommit:'c88d7010f8318b088c73201585a254f8975c650d',manifestSha256:'72cde5c7e2a51aab283f3b66bbb0a921360296f01f343bbc32cc7b904a4a0640'};
const crmPin={packageRoot:'C:\\Sirket\\CRM\\releases\\crm-shared-test-6bc82e6fe9726261ef1d0171d97e5d9da9f5398a',sourceCommit:source,manifestSha256:'e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'};
const supervisorPin={packageRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-8f1167229c8d',sourceCommit:'8f1167229c8d9c10844fc8e1be533487180d2071',manifestSha256:'bfb65fabcbd8eac606c7cf9572337759e53140f6701da0c58c7134b9cc0aa892'};
for(const pin of [erpPin,crmPin,supervisorPin])readPinned({path:path.win32.join(pin.packageRoot,'release-manifest.json'),sha256:pin.manifestSha256});
const erpManifest=JSON.parse(readPinned({path:path.win32.join(erpPin.packageRoot,'release-manifest.json'),sha256:erpPin.manifestSha256}));
if(erpManifest.sourceCommit!==erpPin.sourceCommit||erpManifest.files.length!==2036)throw Error('ERP_PACKAGE_CHANGED');
const erpSeen=new Set();for(const row of erpManifest.files){if(typeof row.path!=='string'||row.path.includes('..')||erpSeen.has(row.path.toLowerCase()))throw Error('ERP_PATH_CHANGED');erpSeen.add(row.path.toLowerCase());const file=path.join(erpPin.packageRoot,row.path),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase()||sha(fs.readFileSync(file))!==row.sha256)throw Error('ERP_FILE_CHANGED');}
const erpObserved=[];
function scanErp(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())throw Error('ERP_INVENTORY_REPARSE');if(entry.isDirectory()){scanErp(file);continue;}if(!entry.isFile()||stat.nlink!==1)throw Error('ERP_INVENTORY_PHYSICAL');erpObserved.push({path:path.relative(erpPin.packageRoot,file).replaceAll('\\','/'),sha256:sha(fs.readFileSync(file))});}}
scanErp(erpPin.packageRoot);const erpCompleteInventory=verifyPr53CompletePackageInventory(erpManifest,erpObserved);
if(erpObserved.find(x=>x.path==='release-manifest.json')?.sha256!==erpPin.manifestSha256)throw Error('ERP_MANIFEST_RACE');
const crmManifest=JSON.parse(readPinned({path:path.win32.join(crmPin.packageRoot,'release-manifest.json'),sha256:crmPin.manifestSha256}));
if(crmManifest.source?.commit!==crmPin.sourceCommit||crmManifest.source?.tree!=='714f198561fb47d1e1c7308c274c117dba40367b'||crmManifest.files.length!==2292)throw Error('CRM_SOURCE_CHANGED');
if(fs.realpathSync.native(crmPin.packageRoot).toLowerCase()!==path.resolve(crmPin.packageRoot).toLowerCase())throw Error('CRM_ROOT_REPARSE');
const crmSeen=new Set();for(const row of crmManifest.files){if(typeof row.path!=='string'||row.path.includes('..')||crmSeen.has(row.path.toLowerCase()))throw Error('CRM_PATH_CHANGED');crmSeen.add(row.path.toLowerCase());const file=path.join(crmPin.packageRoot,row.path),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase()||sha(fs.readFileSync(file))!==row.sha256)throw Error('CRM_FILE_CHANGED');}
let crmObserved=0;function scanCrm(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())throw Error('CRM_REPARSE');if(item.isDirectory())scanCrm(file);else if(item.isFile()){const relative=path.relative(crmPin.packageRoot,file).replaceAll('\\','/');if(relative!=='release-manifest.json'&&!crmSeen.has(relative.toLowerCase()))throw Error('CRM_EXTRA');if(relative!=='release-manifest.json')crmObserved++;}else throw Error('CRM_SPECIAL');}}scanCrm(crmPin.packageRoot);if(crmObserved!==crmSeen.size)throw Error('CRM_INVENTORY_CHANGED');
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
const crmDependencyLockRef={path:profile.dependencyLockPath,sha256:'4f6e35ba06223b18c394fa2b6f16b7311cac9a561c7d210c1de2db1ef67e1b06'};

const erpFiles=[],depSeen=new Set();
function dependencies(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())throw Error('DEPENDENCY_REPARSE');if(entry.isDirectory()){dependencies(file);continue;}if(!entry.isFile()||stat.nlink!==1)throw Error('DEPENDENCY_PHYSICAL');const relative=path.relative(erpPin.packageRoot,file).replaceAll('\\','/');if(!relative.startsWith('apps/api/node_modules/')||depSeen.has(relative.toLowerCase()))throw Error('DEPENDENCY_PATH');depSeen.add(relative.toLowerCase());erpFiles.push({path:relative,sha256:sha(fs.readFileSync(file))});}}
dependencies(path.join(erpPin.packageRoot,'apps/api/node_modules'));erpFiles.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
if(sha(Buffer.from(JSON.stringify(erpFiles,null,2)+'\n'))!==erpCompleteInventory.dependencyInventories.find(x=>x.prefix==='apps/api/node_modules/').inventorySha256)throw Error('ERP_DEPENDENCY_RACE');
const erpDependencyLock={schemaVersion:1,sourceCommit:erpPin.sourceCommit,packageRoot:erpPin.packageRoot,files:erpFiles};validateCompletionDependencyLock(erpDependencyLock,erpPin,'apps/api');
const erpDependencyLockRef={path:profile.erpDependencyLockPath,sha256:sha(Buffer.from(JSON.stringify(erpDependencyLock,null,2)+'\n'))};
const crmDependencyLock=jsonPinned(crmDependencyLockRef);validateCompletionDependencyLock(crmDependencyLock,crmPin,'apps/gateway');
// Independently compare every CRM dependency and the complete inventory.
const crmDependencyPaths=new Set(crmDependencyLock.files.map(row=>row.path.toLowerCase()));let crmDependencyCount=0;
function crmDependencies(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||fs.realpathSync.native(file).toLowerCase()!==path.resolve(file).toLowerCase())throw Error('CRM_DEPENDENCY_REPARSE');if(entry.isDirectory()){crmDependencies(file);continue;}if(!entry.isFile()||stat.nlink!==1)throw Error('CRM_DEPENDENCY_PHYSICAL');const relative=path.relative(crmPin.packageRoot,file).replaceAll('\\','/'),row=crmDependencyLock.files.find(x=>x.path===relative);if(!crmDependencyPaths.has(relative.toLowerCase())||!row||sha(fs.readFileSync(file))!==row.sha256)throw Error('CRM_DEPENDENCY_CHANGED');crmDependencyCount++;}}
crmDependencies(path.join(crmPin.packageRoot,'apps/gateway/node_modules'));if(crmDependencyCount!==crmDependencyPaths.size)throw Error('CRM_DEPENDENCY_INVENTORY');
const journal=await import(pathToFileURL(path.join(supervisorRoot,'scripts/canonical/crm06-staff-journal-preflight.mjs')).href);
const evidence=await journal.inspectCrm06StaffJournalPhysical({ownerSid,source,profileVariant:variant,excludedPaths:journal.crm06StaffJournalExcludedPaths(source,variant)});
if(evidence.status!=='READY'||evidence.references.length!==28)throw Error('JOURNAL_NOT_READY');
const evidenceRef={path:profile.journalEvidencePath,sha256:sha(Buffer.from(JSON.stringify(evidence,null,2)+'\n'))};
const parentInputs={baseline,parentActivation,parentAudit,parentSettings,parentSettingsRef,parentHubPin,parentHubStartup,ownerSid};
const prepared=preparePr53OwnerProfile({parentInputs,erpDependencyLockRef,erpDependencyLock,crmDependencyLockRef,crmDependencyLock,journalEvidenceRef:evidenceRef,journalEvidence:evidence});
const outputs=[['activation',prepared.activation,prepared.activationRef],['hubPin',prepared.hubPin,prepared.hubPinRef],['hubStartup',prepared.hubStartup,prepared.hubStartupRef],['settings',prepared.settings,prepared.settingsRef],['receipt',prepared.receipt,prepared.receiptRef]];
for(const [name,value,ref] of outputs){const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');if(sha(bytes)!==ref.sha256)throw Error('OUTPUT_HASH_DRIFT:'+name);}

const pending=[['erpDependencyLock',erpDependencyLock,erpDependencyLockRef],['journalEvidence',evidence,evidenceRef],...outputs];
for(const [name,value,ref] of pending){if(fs.existsSync(ref.path))throw Error('NEW_TARGET_EXISTS:'+name);if(sha(Buffer.from(JSON.stringify(value,null,2)+'\n'))!==ref.sha256)throw Error('OUTPUT_HASH_DRIFT:'+name);}
if(prepareNew){
 jsonPinned(installed);jsonPinned(installedSettings.crmPrivateFiles.crm06StaffSuccessor);readPinned(parentSettingsRef);
 for(const [name,value,ref] of pending){const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n'),template=name==='receipt'||name==='journalEvidence'?installedSettings.crmPrivateFiles.crm06StaffSuccessor.path:installed.path;
 const result=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(import.meta.dirname,'p03-pr53-protected-create.ps1'),'-Target',ref.path,'-Template',template,'-ExpectedSha256',ref.sha256],{input:bytes,windowsHide:true,timeout:30000,maxBuffer:4096}).toString('utf8').trim();
 if(result!=='CREATED_PROTECTED '+ref.sha256||sha(fs.readFileSync(ref.path))!==ref.sha256)throw Error('PROTECTED_WRITE_FAILED:'+name);
 }
}
console.log(JSON.stringify({status:prepareNew?'PREPARED_INACTIVE':'DRY_RUN_READY',installed:false,erpCompleteInventory,outputs:pending.map(([name,,ref])=>({name,path:ref.path,sha256:ref.sha256})),rollbackCurrentSettingsSha256:installed.sha256}));
}
main().catch(error=>{console.error(JSON.stringify({status:'PREPARATION_FAILED_PARTIAL_FILES_RETAINED',reason:/^[A-Z_]+(?::[A-Za-z]+)?$/.test(error?.message??'')?error.message:'PRIVATE_DETAIL_WITHHELD'}));process.exitCode=1;});
