// Prepare private pinned files only. No service/task/SQL/network operation.
// Existing configs, releases and heartbeat files are never modified.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateCompletionSettings,completionCrmEnvironment,validateCurrentCrmHubPins,validateCompletionDependencyLock,assertCompletionNoReparse,completionTaskPlan} from './terminal-completion-logon.mjs';
const ERP='C:\\Sirket\\ERP',CRM='C:\\Sirket\\CRM',PRIVATE=ERP+'\\runtime\\terminal-completion-logon';
const DB='MELISA_ERP_CRM_SHARED_TEST_20261009_02',COPY='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
const APPROVED_PROOF_SHA='2794de9082768476a75b5d3836452b6a635ad49def4820785e5e4a5cdc6efde1';
const fail=code=>{throw Error('COMPLETION_PRIVATE_'+code);};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const bytes=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const parse=value=>JSON.parse(value.toString('utf8').replace(/^\ufeff/,''));
function absolute(value,root){if(typeof value!=='string')fail('PATH_REQUIRED');const resolved=path.win32.resolve(value);if(!/^[A-Za-z]:\\/.test(resolved)||/[\x00-\x1f"'`$%<>|?*]/.test(resolved)||value.split(/[\\/]/).some(part=>part==='.'||part==='..')||root&&!resolved.toLowerCase().startsWith(root.toLowerCase()+'\\'))fail('PATH_SCOPE');return resolved;}
function jsonSource(file,root){const target=absolute(file,root);assertCompletionNoReparse(target);const data=fs.readFileSync(target);return {path:target,bytes:data,sha256:sha(data),value:parse(data)};}
function filePin(file){const target=absolute(file);assertCompletionNoReparse(target);return {path:target,sha256:sha(fs.readFileSync(target))};}
function readPackage(directory,crm=false){
 const root=absolute(directory,crm?CRM+'\\releases':ERP+'\\releases'),source=jsonSource(path.win32.join(root,'release-manifest.json'),root),m=source.value;
 const commit=crm?m.source?.commit:m.sourceCommit;if(!/^[a-f0-9]{40}$/.test(commit)||!Array.isArray(m.files)||!m.files.length)fail('MANIFEST_IDENTITY');
 if(crm?path.win32.basename(root)!=='crm-shared-test-'+commit:!(m.database===DB||m.sharedTestCopy?.database===DB))fail('PACKAGE_DB_OR_NAME');
 const files=new Map();for(const item of m.files){if(typeof item.path!=='string'||/[\x00-\x1f"'`$%<>|?:*]/.test(item.path)||item.path.split(/[\\/]/).some(part=>!part||part==='.'||part==='..')||!/^[a-f0-9]{64}$/i.test(item.sha256))fail('MANIFEST_ENTRY');const target=absolute(path.win32.join(root,item.path),root);if(files.has(target.toLowerCase()))fail('MANIFEST_DUPLICATE');assertCompletionNoReparse(target);if(sha(fs.readFileSync(target))!==item.sha256.toLowerCase())fail('PACKAGE_DRIFT');files.set(target.toLowerCase(),item.sha256.toLowerCase());}
 return {root,commit,manifest:m,manifestSha256:source.sha256,files};
}
function dependencyLock(packageInfo,moduleRoot){
 const relativeRoot=moduleRoot+'/node_modules',root=path.win32.join(packageInfo.root,relativeRoot),files=[];
 const scan=dir=>{assertCompletionNoReparse(dir);for(const item of fs.readdirSync(dir,{withFileTypes:true})){const full=path.win32.join(dir,item.name);if(item.isSymbolicLink())fail('DEPENDENCY_REPARSE');if(item.isDirectory())scan(full);else if(item.isFile()){assertCompletionNoReparse(full);files.push({path:path.win32.relative(packageInfo.root,full).replaceAll('\\','/'),sha256:sha(fs.readFileSync(full))});}else fail('DEPENDENCY_TYPE');}};
 scan(root);files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 const lock={schemaVersion:1,sourceCommit:packageInfo.commit,packageRoot:packageInfo.root,files};validateCompletionDependencyLock(lock,{sourceCommit:packageInfo.commit,packageRoot:packageInfo.root},moduleRoot);return lock;
}
export function buildCompletionProjection({erp,native,crm,operation,nativeConfig,crmActivation,hubPin,node,ownerSid,baseline,catalogAccess,locks,existingFile=()=>null}){
 if(!/^S-1-5-21-(?:[1-9]\d*-){3}[1-9]\d*$/.test(ownerSid))fail('OWNER_REQUIRED');
 const c=operation.value,n=nativeConfig.value,old=crmActivation.value.environmentVariables;
 if(c.database!==DB||c.copyContext?.copyId!==COPY||c.host!=='127.0.0.1'||c.lanHost!=='192.168.1.46'||c.webPort!==5234||c.erpPort!==4184||c.nativePort!==4186||c.transport!==undefined||!c.businessSelectedSaleStartup||n.database!==DB||n.nativePort!==62704||n.crmOrderCurrentContext?.copyId!==COPY||n.crmOrderCurrentContext?.actualT1!==false||n.crmOrderCurrentContext?.externalOperations!==false||n.crmOrderCurrentContext?.stockEffect!==false||n.crmOrderCurrentContext?.ledgerEffect!==false)fail('SOURCE_SCOPE');
 if(!old||typeof old!=='object'||old.CRM_TEST_EXPECTED_DATABASE!==DB||old.CRM_TEST_PORT_BASE!=='62700'||old.CRM_ISOLATED_PREPARATION!=='true'||old.CRM_TEST_ERP_ORIGIN!=='http://127.0.0.1:4184'||old.CRM_TEST_LAN_ADDRESS!=='192.168.1.46'||!native.manifest.packageId)fail('CRM_ENV_SOURCE');
 const suffix=erp.commit.slice(0,12),files=new Map(),reusedFiles=[],outputs=new Set(),add=(name,content)=>{const target=path.win32.join(PRIVATE,name);if(outputs.has(target))fail('DUPLICATE_OUTPUT');outputs.add(target);const pin={path:target,sha256:sha(content)},existing=existingFile(target);if(existing!==null){if(!Buffer.isBuffer(existing)||!existing.equals(content))fail('OUTPUT_ALREADY_EXISTS');reusedFiles.push(pin);}else files.set(target,content);return pin;};
 const op=add('operation-'+suffix+'.json',operation.bytes),nc=add('native-order-'+suffix+'.json',nativeConfig.bytes);
 const pin={apiSourceCommit:erp.commit,crmSourceCommit:crm.commit,crmIndexSha256:hubPin.value.crmIndexSha256,crmHealthPath:PRIVATE+'\\crm-health-status.json',trainingFiles:hubPin.value.trainingFiles};
 const env={...old};
 // Preserve real directories/private credential references; no new identity.
 for(const key of ['CRM_BASELINE_ENV','CRM_ERP_CATALOG_ACCESS_PATH','CRM_TEST_RUNTIME_DIR','CRM_TEST_LOG_DIR'])env[key]=absolute(env[key]);
 Object.assign(env,{CRM_TEST_SOURCE_COMMIT:crm.commit,CRM_TEST_PACKAGE_ROOT:crm.root,CRM_TEST_PACKAGE_MANIFEST_SHA256:crm.manifestSha256,CRM_TEST_NATIVE_SOURCE_COMMIT:native.commit,CRM_TEST_NATIVE_PACKAGE_ID:native.manifest.packageId,CRM_PAID_AI_ENABLED:'false',CRM_AI_SALES_MODE:'off',WHATSAPP_SEND_ENABLED:'false',WHATSAPP_LIVE_SEND_APPROVED:'false',WAAPI_CHATWOOT_BRIDGE_ENABLED:'false',WAAPI_INCOMING_READER_ENABLED:'false',CRM_TEST_AUTOSTART_CONFIGURED:'true'});
 const caValue={sourceCommit:crm.commit,packageRoot:crm.root,packageManifestSha256:crm.manifestSha256,database:DB,actualT1:false,externalOperations:false,paidAi:false,whatsappSend:false,environmentVariables:env};
 const ca=add('crm-activation-'+suffix+'.json',bytes(caValue)),hp=add('hub-pin-'+suffix+'.json',bytes(pin));
 const hubStartup={PackageRoot:erp.root,SourceCommit:erp.commit,ManifestSha256:erp.manifestSha256,OperationConfigPath:op.path,HubConfigPath:hp.path,NodePath:node.path,NodeSha256:node.sha256,OwnerSid:ownerSid,RuntimeDir:PRIVATE+'\\hub-web'};
 const hs=add('hub-startup-'+suffix+'.json',bytes(hubStartup));
 const infos={erpApiNative:erp,nativeOrder:native,crm},dependencyLocks={};for(const name of ['erpApiNative','nativeOrder','crm'])dependencyLocks[name]=add(name+'-'+infos[name].commit.slice(0,12)+'-dependency-lock.json',bytes(locks[name]));
 const component=(info,config)=>({packageRoot:info.root,sourceCommit:info.commit,manifestSha256:info.manifestSha256,config});
 const settings={schemaVersion:1,ownerSid,actualT1:false,copyId:COPY,database:DB,lanAddress:'192.168.1.46',runtimeDirectory:PRIVATE,node,supervisor:{packageRoot:erp.root,sourceCommit:erp.commit,manifestSha256:erp.manifestSha256},components:{erpApiNative:component(erp,op),nativeOrder:component(native,nc),crm:component(crm,ca),hub:component(erp,hs)},privateSources:{operationConfig:op,nativeOrderConfig:nc,crmActivationConfig:ca,hubPinConfig:hp,hubStartupConfig:hs},dependencyLocks,crmPrivateFiles:{baseline,catalogAccess}};
 validateCompletionSettings(settings,ownerSid);completionCrmEnvironment(caValue,settings);validateCurrentCrmHubPins(pin,settings,caValue,crm.files.get(path.win32.join(crm.root,'apps','frontend','dist','client','index.html').toLowerCase()));
 const settingsPin=add('settings-'+suffix+'.json',bytes(settings));const plan=completionTaskPlan(settings,settingsPin,ownerSid);add('task-plan-'+suffix+'.json',bytes(plan));
 return {files,reusedFiles,settingsPin,hubStartupPin:hs,settings,plan};
}
function verifyPrivateDirectory(ownerSid){
 const created=!fs.existsSync(PRIVATE);if(created){fs.mkdirSync(PRIVATE,{recursive:true});assertCompletionNoReparse(PRIVATE);execFileSync('C:\\Windows\\System32\\icacls.exe',[PRIVATE,'/inheritance:r','/grant:r','*'+ownerSid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F'],{windowsHide:true,stdio:'pipe'});}else assertCompletionNoReparse(PRIVATE);
 // Fixed private path, fixed code. Existing directory permissions are inspected,
 // never changed. Secret bytes are written only after its access boundary passes.
 const command='$a=Get-Acl -LiteralPath "C:\\Sirket\\ERP\\runtime\\terminal-completion-logon";$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$owner=$a.GetOwner([Security.Principal.SecurityIdentifier]).Value;if($owner -ne $sid -or !$a.AreAccessRulesProtected){exit 2};foreach($r in $a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($r.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and $r.IdentityReference.Value -notin @($sid,"S-1-5-18","S-1-5-32-544")){exit 3}}';
 try{execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,stdio:'pipe'});}catch{fail('PRIVATE_ACL_REJECTED');}
}
export function prepareCompletionPrivate(options){
 if(process.platform!=='win32')fail('WINDOWS_REQUIRED');
 const node=filePin(options.node);if(node.path!==process.execPath)fail('EXACT_RUNNING_NODE_REQUIRED');
 const erp=readPackage(options.erpPackage),native=readPackage(options.nativePackage),crm=readPackage(options.crmPackage,true);
 const suffix=/^CANONICAL-COMPLETE-TEST-20261011-([a-f0-9]{7,12})$/.exec(path.win32.basename(erp.root))?.[1];
 if(!suffix||!erp.commit.startsWith(suffix)||!erp.manifest.baselineReproduced||erp.manifest.sharedTestCopy?.actualT1!==false)fail('NEW_COMPLETION_PACKAGE_REQUIRED');
 const required=['scripts/canonical/terminal-completion-logon.mjs','scripts/canonical/watch-terminal-completion-logon.ps1','scripts/canonical/hub-stack-process-probe.ps1','scripts/canonical/watch-hub-web.ps1','scripts/canonical/start-hub-web.ps1','apps/api/start-shared-test-copy.mjs','apps/api/start-shared-test-copy-web.mjs'];for(const file of required)if(!erp.files.has(path.win32.join(erp.root,file).toLowerCase()))fail('NEW_PACKAGE_ENTRY_REQUIRED');
 const operation=jsonSource(options.operationConfig,ERP+'\\runtime'),nativeConfig=jsonSource(options.nativeConfig,ERP),crmActivation=jsonSource(options.crmActivation,CRM+'\\runtime'),hubPin=jsonSource(options.hubPin,ERP);
 const proof=filePin(absolute(options.nativeProof,ERP+'\\evidence'));if(options.nativeProofSha256!==APPROVED_PROOF_SHA||proof.sha256!==APPROVED_PROOF_SHA)fail('APPROVED_NATIVE_PROOF_REQUIRED');
 const startup=operation.value.businessSelectedSaleStartup;if(!startup||filePin(absolute(startup.path,ERP+'\\runtime')).sha256!==String(startup.sha256).toLowerCase())fail('SELECTED_STARTUP_PIN');
 const oldEnv=crmActivation.value.environmentVariables;if(!oldEnv)fail('CRM_ENV_REQUIRED');const baseline=filePin(oldEnv.CRM_BASELINE_ENV),catalogAccess=filePin(oldEnv.CRM_ERP_CATALOG_ACCESS_PATH);
 const ownerSid=execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'}).trim();
 const locks={erpApiNative:dependencyLock(erp,'apps/api'),nativeOrder:dependencyLock(native,'apps/api'),crm:dependencyLock(crm,'apps/gateway')};
 const existingFile=file=>{if(!fs.existsSync(file))return null;assertCompletionNoReparse(file);return fs.readFileSync(file);};
 const projection=buildCompletionProjection({erp,native,crm,operation,nativeConfig,crmActivation,hubPin,node,ownerSid,baseline,catalogAccess,locks,existingFile});
 // No old output is overwritten, even after an interrupted previous preparation.
 for(const file of projection.files.keys())if(fs.existsSync(file))fail('OUTPUT_ALREADY_EXISTS');
 verifyPrivateDirectory(ownerSid);
 for(const [file,content] of projection.files){fs.writeFileSync(file,content,{flag:'wx',mode:0o600});assertCompletionNoReparse(file);if(sha(fs.readFileSync(file))!==sha(content))fail('OUTPUT_VERIFICATION');}
 return {prepared:true,installed:false,started:false,sqlWritten:false,settings:projection.settingsPin,hubStartup:projection.hubStartupPin,files:[...projection.files].map(([file,content])=>({path:file,sha256:sha(content)})),reusedFiles:projection.reusedFiles,sourceCommit:erp.commit,nativeSourceCommit:native.commit,crmSourceCommit:crm.commit,approvedNativeProofSha256:proof.sha256};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const names=['erp-package','operation-config','native-package','native-config','crm-package','crm-activation','hub-pin','node','native-proof','native-proof-sha256'],args=process.argv.slice(2),options={};
 try{if(args.length!==names.length*2)fail('ARGUMENTS_REQUIRED');for(let i=0;i<args.length;i+=2){const key=args[i].replace(/^--/,'');if(args[i]!==`--${key}`||!names.includes(key)||Object.hasOwn(options,key.replace(/-([a-z])/g,(_m,c)=>c.toUpperCase())))fail('ARGUMENTS_REJECTED');options[key.replace(/-([a-z])/g,(_m,c)=>c.toUpperCase())]=args[i+1];}process.stdout.write(JSON.stringify(prepareCompletionPrivate(options),null,2)+'\n');}
 catch(error){process.stderr.write((/^COMPLETION_PRIVATE_[A-Z_]+$/.test(error?.message??'')?error.message:'COMPLETION_PRIVATE_FAILED')+'\n');process.exitCode=1;}
}
