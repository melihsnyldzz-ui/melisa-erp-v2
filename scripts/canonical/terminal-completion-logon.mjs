// Source only. A same-user logon task may run this pinned DB02 core supervisor.
// The existing accepted Hub web task remains the sole owner of LAN web5234.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {coldSqlProbe,nativeArgumentTokens} from './hub-stack-driver.mjs';
import {assertCrm06PreparedActorReceipt,CRM06_BASELINE_PATH,CRM06_ACTOR_AUDIT_PATH} from './crm06-owner-projection.mjs';
import {assertCrm06StaffRefreshSuccessor,crm06StaffSuccessorParentRefs,crm06StaffSuccessorProfileForPath} from './crm06-staff-refresh-successor.mjs';
import {inspectCrm06StaffJournalPhysical,assertCrm06StaffJournalPhysicalEvidence,CRM06_STAFF_JOURNAL_PATH,crm06StaffJournalExcludedPaths} from './crm06-staff-journal-preflight.mjs';
const runFile=promisify(execFile), hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const DB='MELISA_ERP_CRM_SHARED_TEST_20261009_02', COPY='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
const ERP='C:\\Sirket\\ERP', CRM='C:\\Sirket\\CRM', RUNTIME=ERP+'\\runtime';
const reject=code=>{throw Error('TERMINAL_LOGON_'+code);};
// Error metadata is kept separately from driver errors: never serialize messages,
// command lines, output, SQL text, parameters, paths or stacks.
const completionDiagnostics=new WeakMap();
const diagnosticStages=new Set(['erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer','hub','supervisor']);
const diagnosticPhases=new Set(['processProbe','health','CRM','hub','monitor']);
const diagnosticTypes=new Set(['Error','TypeError','SyntaxError','TimeoutError','AbortError']);
const diagnosticCodes=new Set(['ETIMEDOUT','ETIMEOUT','ECONNREFUSED','ECONNRESET','EPIPE','ENOENT','EACCES','EPERM','ABORT_ERR','ERR_CHILD_PROCESS_STDIO_MAXBUFFER']);
const processProbeExecDiagnostics=new WeakMap();
const processProbeOutcomes=new Set(['EXEC_KILLED','EXEC_EXIT_NONZERO','EXEC_PROCESS_DISAPPEARED_REPORTED','EXEC_ERROR']);
const processProbeSignals=new Set(['SIGTERM','SIGKILL','SIGINT','SIGBREAK']);
const observationUnverified=new WeakSet();
const osProbePhases=new Set(['NETTCP','CHILD_CIM','CHILD_MANAGED','PARENT_CIM','CHILD_OWNER','PARENT_OWNER','CREATION','SERIALIZE']);
const osProbeCategories=new Set(['NotSpecified','ObjectNotFound','PermissionDenied','InvalidOperation','InvalidArgument','InvalidData','ResourceUnavailable','OperationStopped','OtherCategory']);
const osProbeTypes=new Set(['RuntimeException','CimException','CimJobException','ItemNotFoundException','MethodInvocationException','PropertyNotFoundException','ArgumentException','InvalidOperationException','Win32Exception','OtherError']);
export function parseCompletionOsProbeFailure(stderr){
 if(typeof stderr!=='string'||stderr.length>128*1024)return null;
 const prefix='HUB_STACK_OS_PROBE_FAILURE ',all=stderr.split(/\r?\n/).filter(line=>line!==''),lines=all.filter(line=>line.startsWith(prefix));if(lines.length!==1||all.some(line=>!line.startsWith(prefix)&&line!=='HUB_STACK_OS_PROCESS_DISAPPEARED')||all.filter(line=>line==='HUB_STACK_OS_PROCESS_DISAPPEARED').length>1)return null;
 try{const payload=lines[0].slice(prefix.length),value=JSON.parse(payload),keys=Object.keys(value).sort().join(',');if(JSON.stringify(value)!==payload)return null;
  if(!value||Array.isArray(value)||!['errorCategory,errorType,nativeHResult,phase,schemaVersion','errorCategory,errorType,finiteReturnValue,nativeHResult,phase,schemaVersion'].includes(keys)||value.schemaVersion!=='melisa-hub-stack-os-probe-failure.v1'||!osProbePhases.has(value.phase)||!osProbeCategories.has(value.errorCategory)||!osProbeTypes.has(value.errorType)||!Number.isInteger(value.nativeHResult)||value.nativeHResult< -2147483648||value.nativeHResult>2147483647||'finiteReturnValue'in value&&(!Number.isInteger(value.finiteReturnValue)||value.finiteReturnValue<0||value.finiteReturnValue>65535))return null;
  return {schemaVersion:value.schemaVersion,phase:value.phase,errorCategory:value.errorCategory,errorType:value.errorType,nativeHResult:value.nativeHResult,...('finiteReturnValue'in value?{finiteReturnValue:value.finiteReturnValue}:{})};
 }catch{return null;}
}
function safeProcessProbeExec(value){
 if(!value||!processProbeOutcomes.has(value.outcome))return null;
 const result={outcome:value.outcome};
 if(typeof value.killed==='boolean')result.killed=value.killed;
 if(processProbeSignals.has(value.signal))result.signal=value.signal;
 if(Number.isSafeInteger(value.exitCode)&&value.exitCode>=0&&value.exitCode<=2147483647)result.exitCode=value.exitCode;
 if(Number.isSafeInteger(value.elapsedMs)&&value.elapsedMs>=0&&value.elapsedMs<=60000)result.elapsedMs=value.elapsedMs;
 const osProbe=parseCompletionOsProbeFailure('HUB_STACK_OS_PROBE_FAILURE '+JSON.stringify(value.osProbe));if(osProbe)result.osProbe=osProbe;
 return result;
}
export function classifyCompletionProcessExecFailure(error,elapsedMs){
 // Only the pinned probe's finite OS-disappearance token is inspected in memory.
 // Its stderr, command, message, output and stack are never copied to a receipt.
 try{const disappeared=typeof error?.stderr==='string'&&error.stderr.length<=128*1024&&/(?:^|[^A-Z0-9_])HUB_STACK_OS_PROCESS_DISAPPEARED(?:$|[^A-Z0-9_])/.test(error.stderr);
 const numericExit=Number.isSafeInteger(error?.code)&&error.code>0&&error.code<=2147483647;
 const outcome=error?.killed===true?'EXEC_KILLED':disappeared?'EXEC_PROCESS_DISAPPEARED_REPORTED':numericExit?'EXEC_EXIT_NONZERO':'EXEC_ERROR';
 return safeProcessProbeExec({outcome,killed:error?.killed,signal:error?.signal,exitCode:error?.code,elapsedMs,osProbe:parseCompletionOsProbeFailure(error?.stderr)});}catch{return safeProcessProbeExec({outcome:'EXEC_ERROR',elapsedMs});}
}
function retryableCompletionObservation(error){
 try{const exec=processProbeExecDiagnostics.get(error),disappeared=typeof error?.stderr==='string'&&error.stderr.length<=128*1024&&error.stderr.split(/\r?\n/).includes('HUB_STACK_OS_PROCESS_DISAPPEARED');
  if(exec?.osProbe)return disappeared&&exec.osProbe.phase==='CHILD_CIM'&&(exec.osProbe.errorCategory==='ObjectNotFound'||exec.osProbe.errorCategory==='OperationStopped'&&exec.osProbe.errorType==='RuntimeException'&&exec.osProbe.nativeHResult===-2146233087);
  if(typeof error?.stderr==='string'&&error.stderr.includes('HUB_STACK_OS_PROBE_FAILURE'))return false;
  return exec?.outcome==='EXEC_KILLED'||['ETIMEDOUT','ETIMEOUT','ABORT_ERR'].includes(error?.code)||disappeared&&error.stderr.split(/\r?\n/).filter(line=>line!=='').length===1;
 }catch{return false;}
}
export async function completionObserveProcess(work,{delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 for(let attempt=0;attempt<3;attempt++){try{return await work();}catch(error){if(attempt<2&&retryableCompletionObservation(error)){await delay(250);continue;}if(error&&typeof error==='object')observationUnverified.add(error);throw error;}}
}
export async function completionWaitOwnedExit(child,{observe,receipt,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 for(let tick=0;child.exitCode===null&&child.signalCode==null&&tick<20;tick++)await delay(250);
 if(child.exitCode===null&&child.signalCode==null)return false;
 const rows=await observe();return Array.isArray(rows)&&rows.every(row=>Number.isInteger(row?.pid)&&row.pid>0)&&!rows.some(row=>row.pid===receipt.pid);
}
export async function completionStopOwnedChild(item,{stage,receipt,observe,matches,verifyPins,forget,delay}){
 if(!item||item.stage!==stage||item.receipt.pid!==receipt.pid)return false;
 const child=item.child;if(item.spawnFailed&&!Number.isInteger(child.pid)){forget();return true;}
 const alive=()=>child.exitCode===null&&child.signalCode==null;
 if(alive()){
  if(!item.verified)return false;
  const rows=await observe(child.pid);if(rows.length!==1||!matches(rows[0],item.receipt))return false;
  verifyPins();if(!child.kill()&&alive())return false;
 }
 if(!Number.isInteger(item.receipt.pid)||item.receipt.pid<1)return false;
 const exited=await completionWaitOwnedExit(child,{observe:()=>observe(),receipt:item.receipt,delay});if(exited)forget();return exited;
}
export async function completionStartOwnedChild({stage,pin,parentPid,matches,spawnOwned,releaseSpawnLogs,observe,writeReceipt,register,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),run=crypto.randomUUID()}){
 let child;try{child=spawnOwned();}catch(error){try{releaseSpawnLogs?.();}catch{}throw error;}
 const pending={stage,child,receipt:{run,pid:child.pid,stage:stage.name},verified:false,spawnFailed:false};register(pending);
 // Descriptor release may throw after Windows has already created the process. Retain ownership first.
 try{await new Promise((resolve,rejectSpawn)=>{child.once('spawn',resolve);child.once('error',()=>{pending.spawnFailed=true;rejectSpawn(Error('TERMINAL_LOGON_SPAWN_FAILED'));});});}finally{releaseSpawnLogs?.();}
 pending.receipt.pid=child.pid;
 for(let tick=0;tick<80;tick++){
  const rows=await observe(stage,child.pid);if(rows.length===1){const row=rows[0],receipt={run,pid:child.pid,parentPid,parentCreationTime:row.parentCreationTime,creationTime:row.creationTime,stage:stage.name,sourceCommit:pin.sourceCommit,configSha256:pin.config.sha256,copyId:COPY,actualT1:false};
   if(matches(row,receipt)){pending.receipt=receipt;pending.verified=true;await writeReceipt(receipt);return receipt;}
  }
  if(child.exitCode!==null||child.signalCode!=null)reject('SPAWN_EXITED');await delay(250);
 }
 reject('SPAWN_UNVERIFIED');
}
export async function completionProcessProbeExec(work,{now=()=>performance.now()}={}){
 const started=now();try{return await work();}catch(error){
  if(error&&typeof error==='object')processProbeExecDiagnostics.set(error,classifyCompletionProcessExecFailure(error,Math.floor(now()-started)));
  throw error;
 }
}
function safeCompletionDiagnostic(value){
 if(!value||!diagnosticStages.has(value.stage)||!diagnosticPhases.has(value.phase)||!diagnosticTypes.has(value.errorType)&&value.errorType!=='OtherError'||!diagnosticCodes.has(value.staticCode)&&value.staticCode!=='UNCLASSIFIED')return null;
 const safe={stage:value.stage,phase:value.phase,errorType:value.errorType,staticCode:value.staticCode};
 const processExec=value.phase==='processProbe'?safeProcessProbeExec(value.processExec):null;
 return {...safe,...(processExec?{processExec}: {})};
}
export function completionFailureDiagnostic(error){return error&&typeof error==='object'?safeCompletionDiagnostic(completionDiagnostics.get(error)):null;}
export async function completionDiagnosticProbe(stage,phase,work){
 if(!diagnosticStages.has(stage)||!diagnosticPhases.has(phase))throw Error('TERMINAL_LOGON_DIAGNOSTIC_SCOPE');
 try{return await work();}catch(error){if(error&&typeof error==='object'&&!completionDiagnostics.has(error))completionDiagnostics.set(error,{stage,phase,errorType:diagnosticTypes.has(error.name)?error.name:'OtherError',staticCode:diagnosticCodes.has(error.code)?error.code:'UNCLASSIFIED',...(phase==='processProbe'&&processProbeExecDiagnostics.has(error)?{processExec:processProbeExecDiagnostics.get(error)}:{})});throw error;}
}
// Passive diagnostics only: uncaughtExceptionMonitor observes without handling.
export function installCompletionExitRecorder(settings,{events=process,fileSystem=fs,uuid=crypto.randomUUID,now=()=>new Date().toISOString(),checkPath=noReparse}={}){
 if(settings.runtimeDirectory!==RUNTIME+'\\terminal-completion-logon'||!/^[a-f0-9]{40}$/.test(settings.supervisor?.sourceCommit)||!Number.isSafeInteger(events.pid)||events.pid<=0)reject('EXIT_RECORDER_SCOPE');
 const directory=settings.runtimeDirectory,sourceCommit=settings.supervisor.sourceCommit;
 const run=uuid();if(typeof run!=='string'||!/^[0-9a-f-]{36}$/i.test(run))reject('EXIT_RECORDER_SCOPE');
 const types=new Set(['Error','TypeError','SyntaxError','RangeError','ReferenceError','EvalError','URIError','AggregateError','TimeoutError','AbortError']);
 let uncaught=null,observed=false,exited=false;
 const persist=(kind,body)=>{let fd;try{checkPath(directory);const target=path.join(directory,'supervisor-'+kind+'-'+events.pid+'-'+run+'.json');fd=fileSystem.openSync(target,'wx',0o600);fileSystem.writeFileSync(fd,JSON.stringify({schemaVersion:'melisa-terminal-completion-exit.v1',kind,sourceCommit,pid:events.pid,recordedAt:now(),...body}));fileSystem.fsyncSync(fd);return true;}catch{return false;}finally{if(fd!==undefined)try{fileSystem.closeSync(fd);}catch{}}};
 const monitor=(error,origin)=>{if(observed)return;observed=true;try{uncaught={errorType:types.has(error?.name)?error.name:'OtherError',staticCode:diagnosticCodes.has(error?.code)?error.code:'UNCLASSIFIED',origin:['uncaughtException','unhandledRejection'].includes(origin)?origin:'OTHER_ORIGIN'};persist('uncaught',uncaught);}catch{uncaught={errorType:'OtherError',staticCode:'UNCLASSIFIED',origin:'OTHER_ORIGIN'};}};
 const exit=code=>{if(exited)return;exited=true;persist('exit',{exitCode:Number.isSafeInteger(code)&&code>=0&&code<=2147483647?code:null,...(uncaught?{uncaught}:{})});};
 events.on('uncaughtExceptionMonitor',monitor);events.on('exit',exit);
 return {dispose(){events.removeListener('uncaughtExceptionMonitor',monitor);events.removeListener('exit',exit);}};
}
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const sha=value=>{if(typeof value!=='string'||!/^[a-f0-9]{64}$/i.test(value))reject('SHA_REQUIRED');return value.toLowerCase();};
function fields(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))reject('FIELDS_REJECTED');}
function windowsPath(value,root){if(typeof value!=='string'||!/^[A-Za-z]:\\/.test(value)||/[\x00-\x1f\x7f"'/%`$<>|?*]/.test(value)||value.slice(2).includes(':')||path.win32.normalize(value)!==value||value.endsWith('\\')||value.slice(3).split('\\').some(part=>!part||part==='.'||part==='..'||/[. ]$/.test(part)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))||root&&!value.toLowerCase().startsWith(root.toLowerCase()+'\\'))reject('PATH_REJECTED');return value;}
function ref(value,root=RUNTIME){fields(value,['path','sha256']);windowsPath(value.path,root);sha(value.sha256);return value;}
function packagePin(value,root,withConfig=true){fields(value,['packageRoot','sourceCommit','manifestSha256',...(withConfig?['config']:[])]);windowsPath(value.packageRoot,root+'\\releases');if(!/^[a-f0-9]{40}$/.test(value.sourceCommit))reject('SOURCE_REQUIRED');sha(value.manifestSha256);if(withConfig)ref(value.config);return value;}
export const COMPLETION_CORE_STAGES=Object.freeze([
 {name:'erpNative',component:'erpApiNative',ports:[4186],entry:'apps/api/start-shared-test-copy.mjs',mode:'native'},
 {name:'erpApi',component:'erpApiNative',ports:[4184],entry:'apps/api/start-shared-test-copy.mjs',mode:'erp'},
 {name:'crmNativeOrder',component:'nativeOrder',ports:[62704],entry:'apps/api/start-crm-order-test.mjs',mode:'--shared-current-test'},
 {name:'crmCatalog',component:'crm',ports:[62702],entry:'deploy/test-erp-catalog.mjs'},
 {name:'crmOrders',component:'crm',ports:[62703],entry:'deploy/test-erp-orders.mjs'},
 {name:'crmServer',component:'crm',ports:[62700,62701],entry:'deploy/test-server.mjs'},
].map(value=>Object.freeze({...value,ports:Object.freeze(value.ports)})));
export function validateCompletionSettings(settings,ownerSid){
 fields(settings,['schemaVersion','ownerSid','actualT1','copyId','database','lanAddress','runtimeDirectory','node','supervisor','components','privateSources','dependencyLocks','crmPrivateFiles']);
 if(settings.schemaVersion!==1||settings.actualT1!==false||settings.copyId!==COPY||settings.database!==DB||settings.lanAddress!=='192.168.1.46')reject('TARGET_REJECTED');
 if(!/^S-1-5-21-(?:[1-9]\d*-){3}[1-9]\d*$/.test(settings.ownerSid)||settings.ownerSid!==ownerSid)reject('OWNER_REJECTED');
 if(settings.runtimeDirectory!==RUNTIME+'\\terminal-completion-logon')reject('RUNTIME_REJECTED');
 fields(settings.node,['path','sha256']);windowsPath(settings.node.path);if(path.win32.basename(settings.node.path).toLowerCase()!=='node.exe'||[ERP+'\\releases',CRM+'\\releases',RUNTIME].some(root=>settings.node.path.toLowerCase().startsWith(root.toLowerCase()+'\\')))reject('NODE_REJECTED');sha(settings.node.sha256);
 packagePin(settings.supervisor,ERP,false);fields(settings.components,['erpApiNative','nativeOrder','crm','hub']);
 for(const name of ['erpApiNative','nativeOrder','crm','hub'])packagePin(settings.components[name],name==='crm'?CRM:ERP);
 fields(settings.privateSources,['operationConfig','nativeOrderConfig','crmActivationConfig','hubPinConfig','hubStartupConfig']);for(const value of Object.values(settings.privateSources))ref(value);
 for(const [component,source] of [['erpApiNative','operationConfig'],['nativeOrder','nativeOrderConfig'],['crm','crmActivationConfig']])if(!equal(settings.components[component].config.path,settings.privateSources[source].path)||!equal(settings.components[component].config.sha256,settings.privateSources[source].sha256))reject('CONFIG_LINK_REJECTED');
 if(!equal(settings.components.hub.config.path,settings.privateSources.hubStartupConfig.path)||!equal(settings.components.hub.config.sha256,settings.privateSources.hubStartupConfig.sha256))reject('HUB_CONFIG_LINK_REJECTED');
 fields(settings.dependencyLocks,['erpApiNative','nativeOrder','crm']);for(const name of ['erpApiNative','nativeOrder','crm']){ref(settings.dependencyLocks[name],settings.runtimeDirectory);const receipt=settings.crmPrivateFiles?.crm06StaffSuccessor,profile=receipt?crm06StaffSuccessorProfileForPath(settings.components.crm.sourceCommit,receipt.path):null,expected=name==='crm'&&profile?profile.dependencyLockPath:name==='erpApiNative'&&(profile?.profileVariant==='erp-candidate-native-ready'||profile?.profileVariant==='erp-crm-node24-ready')?profile.erpDependencyLockPath:path.win32.join(settings.runtimeDirectory,name+'-'+settings.components[name].sourceCommit.slice(0,12)+'-dependency-lock.json');if(!equal(settings.dependencyLocks[name].path,expected))reject('LOCK_SCOPE_REJECTED');}
 const crm06=Object.hasOwn(settings.crmPrivateFiles,'crm06Actors'),staffSuccessor=Object.hasOwn(settings.crmPrivateFiles,'crm06StaffSuccessor');fields(settings.crmPrivateFiles,crm06?['baseline','catalogAccess','crm06Actors',...(staffSuccessor?['crm06StaffSuccessor']:[])]:['baseline','catalogAccess']);if(crm06&&(settings.crmPrivateFiles.baseline.path!==CRM06_BASELINE_PATH||settings.crmPrivateFiles.crm06Actors.path!==CRM06_ACTOR_AUDIT_PATH)||!crm06&&settings.crmPrivateFiles.baseline.path===CRM06_BASELINE_PATH||staffSuccessor&&(!crm06||settings.crmPrivateFiles.crm06StaffSuccessor.path!==crm06StaffSuccessorProfileForPath(settings.components.crm.sourceCommit,settings.crmPrivateFiles.crm06StaffSuccessor.path).successorPath))reject('CRM06_PRIVATE_SCOPE_REJECTED');for(const value of Object.values(settings.crmPrivateFiles)){ref(value,null);if([ERP+'\\releases',CRM+'\\releases'].some(root=>value.path.toLowerCase().startsWith(root.toLowerCase()+'\\')))reject('PRIVATE_PACKAGE_OVERLAP');}
 if(staffSuccessor){const profile=crm06StaffSuccessorProfileForPath(settings.components.crm.sourceCommit,settings.crmPrivateFiles.crm06StaffSuccessor.path);if(settings.components.crm.config.path!==profile.nextPaths.activation||settings.privateSources.crmActivationConfig.path!==profile.nextPaths.activation||settings.privateSources.hubPinConfig.path!==profile.nextPaths.hubPin||settings.privateSources.hubStartupConfig.path!==profile.nextPaths.hubStartup||settings.components.hub.config.path!==profile.nextPaths.hubStartup||settings.dependencyLocks.crm.path!==profile.dependencyLockPath)reject('CRM06_PRIVATE_SCOPE_REJECTED');}
 return settings;
}
const CRM_KEYS=['CRM_TEST_PORT_BASE','CRM_ISOLATED_PREPARATION','CRM_TEST_ERP_ORIGIN','CRM_TEST_EXPECTED_DATABASE','CRM_PAID_AI_ENABLED','CRM_AI_SALES_MODE','WHATSAPP_SEND_ENABLED','WHATSAPP_LIVE_SEND_APPROVED','WAAPI_CHATWOOT_BRIDGE_ENABLED','WAAPI_INCOMING_READER_ENABLED','CRM_TEST_LAN_ADDRESS','CRM_TEST_RUNTIME_DIR','CRM_TEST_LOG_DIR','CRM_TEST_NATIVE_SOURCE_COMMIT','CRM_TEST_NATIVE_PACKAGE_ID','CRM_TEST_SOURCE_COMMIT','CRM_TEST_PACKAGE_ROOT','CRM_TEST_PACKAGE_MANIFEST_SHA256','CRM_BASELINE_ENV','CRM_ERP_CATALOG_ACCESS_PATH','CRM_TEST_TERMINAL_PERSONNEL_USERNAME','CRM_TEST_AUTOSTART_CONFIGURED','CRM_NORMAL_REFRESH_ENABLED','CRM_NORMAL_REFRESH_JOURNAL_PATH','CRM_NORMAL_REFRESH_USER_ID','CRM_SEMIH_TEST_CONTINUE_ENABLED','CRM_SEMIH_TEST_AGENT_ID','CRM_SEMIH_TEST_REFRESH_JOURNAL_PATH','CRM_CUSTOMER_PRODUCT_REQUEST_ENABLED','CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS','CRM_CUSTOMER_PRODUCT_REQUEST_STORE_FILE','CRM_CUSTOMER_PRODUCT_REQUEST_REFRESH_JOURNAL_PATH','CRM_ASSIGNED_STAFF_REFRESH_ENABLED','CRM_ASSIGNED_STAFF_REFRESH_USER_ID','CRM_ASSIGNED_STAFF_REFRESH_JOURNAL_PATH'];
export function completionCrmEnvironment(config,settings,baseline={}){
 fields(config,['sourceCommit','packageRoot','packageManifestSha256','database','actualT1','externalOperations','paidAi','whatsappSend','environmentVariables']);const pin=settings.components.crm,vars=config.environmentVariables;
 if(config.sourceCommit!==pin.sourceCommit||!equal(config.packageRoot,pin.packageRoot)||!equal(config.packageManifestSha256,pin.manifestSha256)||config.database!==DB||config.actualT1!==false||config.externalOperations!==false||config.paidAi!==false||config.whatsappSend!==false||!vars||Object.getPrototypeOf(vars)!==Object.prototype||Object.keys(vars).some(key=>!CRM_KEYS.includes(key))||Object.values(vars).some(value=>typeof value!=='string'))reject('CRM_CONFIG_REJECTED');
 const exact={CRM_TEST_PORT_BASE:'62700',CRM_ISOLATED_PREPARATION:'true',CRM_TEST_ERP_ORIGIN:'http://127.0.0.1:4184',CRM_TEST_EXPECTED_DATABASE:DB,CRM_TEST_LAN_ADDRESS:'192.168.1.46',CRM_TEST_SOURCE_COMMIT:pin.sourceCommit,CRM_TEST_PACKAGE_ROOT:pin.packageRoot,CRM_TEST_PACKAGE_MANIFEST_SHA256:pin.manifestSha256,CRM_TEST_NATIVE_SOURCE_COMMIT:settings.components.nativeOrder.sourceCommit,CRM_BASELINE_ENV:settings.crmPrivateFiles.baseline.path,CRM_ERP_CATALOG_ACCESS_PATH:settings.crmPrivateFiles.catalogAccess.path};
 if(Object.entries(exact).some(([key,value])=>vars[key]!==value))reject('CRM_ENV_REJECTED');
 windowsPath(vars.CRM_TEST_RUNTIME_DIR,CRM+'\\runtime');windowsPath(vars.CRM_TEST_LOG_DIR,CRM+'\\logs');
 if(!['','crm-ahmet'].includes(vars.CRM_TEST_TERMINAL_PERSONNEL_USERNAME??''))reject('CRM_ACTOR_REJECTED');
 const semihKeys=['CRM_SEMIH_TEST_CONTINUE_ENABLED','CRM_SEMIH_TEST_AGENT_ID','CRM_SEMIH_TEST_REFRESH_JOURNAL_PATH'];
 const semih=semihKeys.some(key=>Object.hasOwn(vars,key));
 const crm06=Object.hasOwn(settings.crmPrivateFiles,'crm06Actors');if(crm06&&(vars.CRM_BASELINE_ENV!==CRM06_BASELINE_PATH||settings.crmPrivateFiles.crm06Actors.path!==CRM06_ACTOR_AUDIT_PATH||semih))reject('CRM06_PRIVATE_SCOPE_REJECTED');
 if(semih&&(vars.CRM_SEMIH_TEST_CONTINUE_ENABLED!=='true'||vars.CRM_SEMIH_TEST_AGENT_ID!=='2'||vars.CRM_SEMIH_TEST_REFRESH_JOURNAL_PATH!==CRM+'\\runtime\\SEMIH-TEST-20261012\\refresh-journal.json'||vars.CRM_BASELINE_ENV!==CRM+'\\runtime\\SEMIH-TEST-20261012\\semih-test-baseline-v3.env'||vars.CRM_NORMAL_REFRESH_ENABLED!=='true'))reject('CRM_SEMIH_REFRESH_REJECTED');
 const refresh=['CRM_NORMAL_REFRESH_ENABLED','CRM_NORMAL_REFRESH_JOURNAL_PATH','CRM_NORMAL_REFRESH_USER_ID'];
 if(refresh.some(key=>Object.hasOwn(vars,key))){
  // One existing dedicated normal TEST account may retain its own session.
  // No other actor, runtime, provider or database can opt into this feature.
  if(vars.CRM_NORMAL_REFRESH_ENABLED!=='true'||vars.CRM_NORMAL_REFRESH_USER_ID!=='crm-agent-test-20261011'||vars.CRM_NORMAL_REFRESH_JOURNAL_PATH!==CRM+'\\runtime\\ERP-COMPLETION01-20261011\\protected-normal-sessions\\refresh-journal.json'||vars.CRM_BASELINE_ENV!==(semih?CRM+'\\runtime\\SEMIH-TEST-20261012\\semih-test-baseline-v3.env':crm06?CRM06_BASELINE_PATH:CRM+'\\runtime\\ERP-COMPLETION01-20261011\\normal-agent-test-baseline.env'))reject('CRM_NORMAL_REFRESH_REJECTED');
 }
 // Admit only the already approved normal issuer and its separate request files.
 // This metadata cannot select another account or enable proof/provider modes.
 const requestKeys=['CRM_CUSTOMER_PRODUCT_REQUEST_ENABLED','CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS','CRM_CUSTOMER_PRODUCT_REQUEST_STORE_FILE','CRM_CUSTOMER_PRODUCT_REQUEST_REFRESH_JOURNAL_PATH'];
 if(requestKeys.some(key=>Object.hasOwn(vars,key))){
  const requestRoot=CRM+'\\runtime\\CUSTOMER-PRODUCT-REQUEST-SHARED-20261013';
  if(semih||vars.CRM_CUSTOMER_PRODUCT_REQUEST_ENABLED!=='true'||vars.CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS!==(crm06?'["crm-patron","crm-crm06-manager-test-20261014"]':'["crm-patron"]')||vars.CRM_CUSTOMER_PRODUCT_REQUEST_STORE_FILE!==requestRoot+'\\customer-product-requests.json'||vars.CRM_CUSTOMER_PRODUCT_REQUEST_REFRESH_JOURNAL_PATH!==requestRoot+'\\request-issuer-refresh.json')reject('CRM_CUSTOMER_REQUEST_REJECTED');
 }
 // Source preparation only: the original immutable actor receipt still rejects
 // extended activation objects until a separately verified successor is supplied.
 const assignedStaffKeys=['CRM_ASSIGNED_STAFF_REFRESH_ENABLED','CRM_ASSIGNED_STAFF_REFRESH_USER_ID','CRM_ASSIGNED_STAFF_REFRESH_JOURNAL_PATH'];
 if(assignedStaffKeys.some(key=>Object.hasOwn(vars,key))){
  if(!crm06||semih||vars.CRM_NORMAL_REFRESH_ENABLED!=='true'||vars.CRM_CUSTOMER_PRODUCT_REQUEST_ENABLED!=='true'||vars.CRM_ASSIGNED_STAFF_REFRESH_ENABLED!=='true'||vars.CRM_ASSIGNED_STAFF_REFRESH_USER_ID!=='crm-crm06-staff-test-20261014'||vars.CRM_ASSIGNED_STAFF_REFRESH_JOURNAL_PATH!==CRM+'\\runtime\\CRM06-TEST-ACTORS-20261014\\assigned-staff-refresh.json'||['CRM_PAID_AI_ENABLED','WHATSAPP_SEND_ENABLED','WHATSAPP_LIVE_SEND_APPROVED','WAAPI_CHATWOOT_BRIDGE_ENABLED','WAAPI_INCOMING_READER_ENABLED'].some(key=>vars[key]!=='false')||vars.CRM_AI_SALES_MODE!=='off')reject('CRM_ASSIGNED_STAFF_REFRESH_REJECTED');
 }
 // No baseline provider/token/NODE_OPTIONS inheritance; ordinary existing own-account login.
 const safe=Object.fromEntries(['SystemRoot','WINDIR','PATH','TEMP','TMP','COMSPEC','PATHEXT','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','USERNAME','USERDOMAIN','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS'].filter(key=>typeof baseline[key]==='string').map(key=>[key,baseline[key]]));
 return {...safe,...vars,CRM_PAID_AI_ENABLED:'false',CRM_AI_SALES_MODE:'off',WHATSAPP_SEND_ENABLED:'false',WHATSAPP_LIVE_SEND_APPROVED:'false',WAAPI_CHATWOOT_BRIDGE_ENABLED:'false',WAAPI_INCOMING_READER_ENABLED:'false',CRM_TEST_AUTOSTART_CONFIGURED:'true'};
}
// Win32_Process CreationDate carries six fractional digits; ToString('o')
// pads its seventh digit with zero. Process.StartTime retains 100ns ticks.
// Preserve the exact CIM receipt and compare only the shared microsecond;
// never round Date.parse to milliseconds or accept another microsecond.
export function completionCreationPrecisionMatches(cim,managed){
 const valid=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/.test(value))return false;const timestamp=Date.parse(value.slice(0,19)+'.000Z');return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,19)===value.slice(0,19);};
 return valid(cim)&&valid(managed)&&cim.at(-2)==='0'&&cim.slice(0,-2)===managed.slice(0,-2);
}
export const COMPLETION_NODE_FLAGS=Object.freeze(['--no-maglev']);
export function completionSupervisorFlagsMatch(flags){return Array.isArray(flags)&&flags.length===1&&flags[0]===COMPLETION_NODE_FLAGS[0];}
export function completionNodeArguments(stage,settings){
 const pin=settings.components[stage.component];
 return [...COMPLETION_NODE_FLAGS,path.win32.join(pin.packageRoot,stage.entry),...(stage.component==='crm'?[]:[...(stage.mode?[stage.mode]:[]),pin.config.path])];
}
export function completionProcessMatches(row,receipt,stage,settings){
 const pin=settings.components[stage.component],entry=path.win32.join(pin.packageRoot,stage.entry),parent=path.win32.join(settings.supervisor.packageRoot,'scripts','canonical','terminal-completion-logon.mjs');
 const args=[settings.node.path,...completionNodeArguments(stage,settings)];const actual=nativeArgumentTokens(row?.commandLine);
 if(!receipt||!row||!Number.isInteger(row.pid)||row.pid<1||row.pid!==receipt.pid||row.parentPid!==receipt.parentPid||row.ownerSid!==settings.ownerSid||row.parentOwnerSid!==settings.ownerSid||!equal(row.nodePath,settings.node.path)||!equal(row.parentNodePath,settings.node.path)||row.creationTime!==receipt.creationTime||!completionCreationPrecisionMatches(row.creationTime,row.managedCreationTime)||row.parentCreationTime!==receipt.parentCreationTime||!Number.isFinite(Date.parse(receipt.creationTime))||!Number.isFinite(Date.parse(receipt.parentCreationTime))||receipt.stage!==stage.name||receipt.sourceCommit!==pin.sourceCommit||receipt.configSha256!==pin.config.sha256||receipt.copyId!==COPY||receipt.actualT1!==false||nativeArgumentTokens(row.parentCommandLine)[0]!==settings.node.path||nativeArgumentTokens(row.parentCommandLine)[1]!==COMPLETION_NODE_FLAGS[0]||nativeArgumentTokens(row.parentCommandLine)[2]!==parent||actual.length!==args.length||actual.some((arg,index)=>!equal(arg,args[index])))return false;
 const bindings=row.bindings??[];return bindings.length>0&&bindings.every(item=>stage.ports.includes(item.port)&&['127.0.0.1','192.168.1.46'].includes(item.address))&&stage.ports.every(port=>bindings.some(item=>item.port===port&&item.address==='127.0.0.1'))&&(stage.name!=='crmServer'||bindings.some(item=>item.port===62700&&item.address==='192.168.1.46'))&&(stage.name!=='erpApi'||bindings.some(item=>item.port===4184&&item.address==='192.168.1.46'));
}
// Preserved CRM222 has no /test-health. Never turn its 404 into success.
// Endpoint guard responses prove listener/authorization policy only; they do
// not prove authenticated catalog/order functionality or human acceptance.
export async function verifyCurrentCrmReadiness(stage,hubPin,fetchImpl=fetch){
 const get=async(port,route,maxBytes)=>{
  const response=await fetchImpl(`http://127.0.0.1:${port}${route}`,{method:'GET',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(4000)});
  const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>maxBytes)reject('CRM_RESPONSE_SIZE');chunks.push(Buffer.from(chunk));}
  return {status:response.status,bytes:Buffer.concat(chunks)};
 };
 if(stage.name==='crmServer'){
  const index=await get(62700,'/',1048576);if(index.status!==200||hash(index.bytes)!==hubPin.crmIndexSha256)reject('CRM_INDEX_REJECTED');
  const response=await get(62701,'/health',65536);if(response.status!==200)reject('CRM_GATEWAY_HEALTH_STATUS');
  const body=JSON.parse(response.bytes),h=body.data;
  if(body.success!==true||body.meta?.source!=='whatsapp-crm-health'||h?.status!=='ok'||h.authMode!=='crm-local'||h.provider!=='disabled-preparation'||['providerConnected','sendReady','bridgeReady','translationEnabled','sendEnabled'].some(key=>h[key]!==false))reject('CRM_GATEWAY_HEALTH_REJECTED');
  return {ready:true,stage:stage.name,proof:'PINNED_INDEX_AND_SAFE_EXISTING_GATEWAY_HEALTH',authenticatedOperationsVerified:false};
 }
 const contract={crmCatalog:{port:62702,path:'/api/crm-catalog/products?limit=1',code:'CURRENT_CRM_SESSION_REQUIRED'},crmOrders:{port:62703,path:'/crm/erp/drafts',code:'CRM_SESSION_REQUIRED'}}[stage.name];
 if(!contract)reject('CRM_STAGE_REJECTED');const response=await get(contract.port,contract.path,65536),body=JSON.parse(response.bytes);
 if(response.status!==401||body.success!==false||body.error?.code!==contract.code)reject('CRM_AUTH_GUARD_REJECTED');
 return {ready:true,stage:stage.name,proof:'EXISTING_ENDPOINT_DENIES_UNAUTHENTICATED_READ',authenticatedOperationsVerified:false};
}
export function validateCurrentCrmHubPins(hubPin,settings,crm,indexHash){
 fields(hubPin,['apiSourceCommit','crmSourceCommit','crmIndexSha256','crmHealthPath','trainingFiles']);
 const pin=settings.components.crm,expectedHealth=path.win32.join(RUNTIME,'terminal-completion-logon','crm-health-status.json');
 if(hubPin.apiSourceCommit!==settings.components.erpApiNative.sourceCommit||hubPin.crmSourceCommit!==pin.sourceCommit||path.win32.basename(pin.packageRoot)!=='crm-shared-test-'+pin.sourceCommit||!equal(hubPin.crmIndexSha256,indexHash)||!equal(hubPin.crmHealthPath,expectedHealth))reject('CRM_HUB_PIN_REJECTED');
 windowsPath(expectedHealth,settings.runtimeDirectory);return expectedHealth;
}
export function completionCrmHealthReceipt(settings,tracked,{state='running',now=Date.now()}={}){
 const find=name=>tracked.find(item=>item.stage.name===name)?.receipt;
 const ready=state==='running'&&COMPLETION_CORE_STAGES.every(stage=>Number.isInteger(find(stage.name)?.pid)&&find(stage.name).pid>0);
 return {version:1,environment:'CANONICAL_TEST',sourceCommit:settings.components.crm.sourceCommit,packageId:'crm-shared-test-'+settings.components.crm.sourceCommit,packageManifestSha256:settings.components.crm.manifestSha256,copyId:COPY,database:DB,actualT1:false,observedAt:new Date(now).toISOString(),startup:{taskName:'Melisa-Terminal-Completion-Logon',configured:true,supervisorPid:process.pid,state:ready?'running':state==='stopping'?'stopping':'degraded'},services:Object.fromEntries([['server','crmServer'],['catalog','crmCatalog'],['orders','crmOrders']].map(([name,stage])=>[name,{state:ready?'running':'unverified',pid:find(stage)?.pid??0}])),dependencies:{erp:{state:ready?'ready':'unverified'},native:{state:ready?'ready':'unverified'}},readinessProof:'PINNED_PROCESS_MANIFEST_CONFIG; SAFE_GATEWAY_HEALTH; EXISTING_UNAUTHENTICATED_GUARDS; ERP_NATIVE_IDENTITY',authenticatedOperationsVerified:false,humanAccepted:false};
}
export async function completionAttempt(settings,driver){
 const started=[],tracked=[];let quarantined=false;
 try{await driver.verify();await driver.sqlReady();for(const stage of COMPLETION_CORE_STAGES){const observed=await driver.inspect(stage);let receipt;if(observed.length){receipt=await driver.receipt(stage);if(observed.length!==1||!completionProcessMatches(observed[0],receipt,stage,settings))reject('FOREIGN_PORT_OWNER');}else{receipt=await driver.start(stage);started.push({stage,receipt});}await driver.ready(stage,receipt);tracked.push({stage,receipt});}await driver.publish?.(tracked,'running');await driver.hubReady();await completionDiagnosticProbe('supervisor','monitor',()=>driver.monitor(tracked));reject('CHILD_EXITED');}
 catch(error){if(error&&typeof error==='object'&&observationUnverified.has(error)){
  // Unknown OS observation is neither health nor child-loss proof. Preserve the resident owner and every held child.
  quarantined=true;try{await driver.publish?.(tracked,'degraded');}catch{}
  try{await driver.failure?.('OBSERVATION_QUARANTINED',[],completionFailureDiagnostic(error));}catch{}
  if(typeof driver.quarantine!=='function')reject('OBSERVATION_QUARANTINED');
  try{await driver.quarantine();}finally{reject('OBSERVATION_QUARANTINED');}
 }throw error;}
 finally{if(!quarantined){try{await driver.publish?.(tracked,'degraded');}finally{const survivors=[],owned=new Map();for(const item of [...started,...(driver.pendingOwned?.()??[])])owned.set(item.receipt.run??item.stage.name,item);for(const item of [...owned.values()].reverse()){try{if(!await driver.stop(item.stage,item.receipt))survivors.push(item.stage.name);}catch{survivors.push(item.stage.name);}}if(survivors.length){await driver.failure?.('CLEANUP_UNVERIFIED',survivors);reject('CLEANUP_UNVERIFIED');}}}}
}
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function completionTaskPlan(settings,configRef,ownerSid){
 validateCompletionSettings(settings,ownerSid);ref(configRef);const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',entry=path.win32.join(settings.supervisor.packageRoot,'scripts','canonical','watch-terminal-completion-logon.ps1');
 const argumentsText=`-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "${entry}" -StartupConfigPath "${configRef.path}" -StartupConfigSha256 ${configRef.sha256}`;
 return {installed:false,actualLogonTested:false,taskName:'Melisa-Terminal-Completion-Logon',ownerSid,logonType:'InteractiveToken',runLevel:'LeastPrivilege',hubTaskPreserved:'Melisa-Hub-TEST-Web',protected:['TEST125','5194','4144','4146','Vega','LIVE'],execute:shell,arguments:argumentsText,xml:`<?xml version="1.0" encoding="UTF-16"?><Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><RegistrationInfo><Description>DB02 terminal core; source ${xml(settings.supervisor.sourceCommit)}</Description></RegistrationInfo><Triggers><LogonTrigger><Enabled>true</Enabled><UserId>${xml(ownerSid)}</UserId></LogonTrigger></Triggers><Principals><Principal id="Owner"><UserId>${xml(ownerSid)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><Enabled>true</Enabled></Settings><Actions Context="Owner"><Exec><Command>${xml(shell)}</Command><Arguments>${xml(argumentsText)}</Arguments><WorkingDirectory>${xml(settings.supervisor.packageRoot)}</WorkingDirectory></Exec></Actions></Task>`};
}
export function assertCompletionNoReparse(file,lstat=fs.lstatSync){let current=file;while(current.length>3){if(lstat(current).isSymbolicLink())reject('REPARSE_REJECTED');current=path.win32.dirname(current);}}
const noReparse=assertCompletionNoReparse;
function readPinned(pin){noReparse(pin.path);const bytes=fs.readFileSync(pin.path);if(hash(bytes)!==pin.sha256.toLowerCase())reject('FILE_PIN_REJECTED');return bytes;}
function json(pin){return JSON.parse(readPinned(pin).toString('utf8').replace(/^\ufeff/,''));}
async function verifyCrm06StaffSuccessorRuntime(settings,{baseline,activation,hubPin,hubStartup}){
 const profile=crm06StaffSuccessorProfileForPath(settings.components.crm.sourceCommit,settings.crmPrivateFiles.crm06StaffSuccessor.path),variant=profile.profileVariant?{profileVariant:profile.profileVariant}:{},excludedPaths=crm06StaffJournalExcludedPaths(profile.source,profile.profileVariant);
 const receipt=json(settings.crmPrivateFiles.crm06StaffSuccessor),refs=crm06StaffSuccessorParentRefs(receipt),parentSettings=json(refs.settingsRef);
 validateCompletionSettings(parentSettings,settings.ownerSid);
 assertCrm06StaffRefreshSuccessor({baseline,parentActivation:json(refs.activationRef),parentAudit:json(settings.crmPrivateFiles.crm06Actors),parentSettings,parentHubPin:json(parentSettings.privateSources.hubPinConfig),parentHubStartup:json(parentSettings.privateSources.hubStartupConfig),currentActivation:activation,currentSettings:settings,currentHubPin:hubPin,currentHubStartup:hubStartup,receipt,ownerSid:settings.ownerSid});
 const options={path:CRM06_STAFF_JOURNAL_PATH,ownerSid:settings.ownerSid,excludedPaths,source:profile.source,...variant};
 const preparation=assertCrm06StaffJournalPhysicalEvidence(json({path:profile.journalEvidencePath,sha256:receipt.prepared.journalEvidenceSha256}),options);
 if(preparation.status!=='READY')reject('CRM06_STAFF_JOURNAL_NOT_READY');
 // Metadata is mutable after an ordinary refresh/atomic rename. Inspect actual
 // current identity/ACL anew; never treat the immutable preparation as a grant.
 const current=await inspectCrm06StaffJournalPhysical({ownerSid:settings.ownerSid,excludedPaths,source:profile.source,...variant});
 if(current.status!=='READY')reject('CRM06_STAFF_JOURNAL_NOT_READY');
}
// CRM's packaged server requires the exact build toolchain. Check it in the
// common verify/Probe phase, before SQL readiness or any child can be started.
export function assertCompletionCrmPackageToolchain(manifest,runtime={nodeVersion:process.version,platform:process.platform,arch:process.arch}){
 try{
  const build=Object.getOwnPropertyDescriptor(manifest,'build');if(!build||!Object.hasOwn(build,'value'))reject('CRM_PACKAGE_TOOLCHAIN_REJECTED');
  const tuple=value=>{if(!value||Object.getPrototypeOf(value)!==Object.prototype)reject('CRM_PACKAGE_TOOLCHAIN_REJECTED');const result=['nodeVersion','platform','arch'].map(key=>{const item=Object.getOwnPropertyDescriptor(value,key);if(!item||!Object.hasOwn(item,'value')||typeof item.value!=='string')reject('CRM_PACKAGE_TOOLCHAIN_REJECTED');return item.value;});if(!/^v\d+\.\d+\.\d+$/.test(result[0])||!['win32','linux','darwin'].includes(result[1])||!['x64','arm64'].includes(result[2]))reject('CRM_PACKAGE_TOOLCHAIN_REJECTED');return result;};
  const expected=tuple(runtime);if(tuple(build.value).some((value,index)=>value!==expected[index]))reject('CRM_PACKAGE_TOOLCHAIN_REJECTED');return true;
 }catch{reject('CRM_PACKAGE_TOOLCHAIN_REJECTED');}
}
function verifyPackage(pin,crm=false){const manifest=json({path:path.join(pin.packageRoot,'release-manifest.json'),sha256:pin.manifestSha256});if((crm?manifest.source?.commit:manifest.sourceCommit)!==pin.sourceCommit||!Array.isArray(manifest.files)||!manifest.files.length)reject('PACKAGE_PIN_REJECTED');if(crm)assertCompletionCrmPackageToolchain(manifest);const files=new Map();for(const item of manifest.files){if(typeof item.path!=='string'||/[\x00-\x1f"'`$%<>|?:*]/.test(item.path)||item.path.split(/[\\/]/).some(part=>!part||part==='.'||part==='..'))reject('MANIFEST_PATH_REJECTED');const file=path.resolve(pin.packageRoot,item.path);windowsPath(file,pin.packageRoot);if(files.has(file.toLowerCase()))reject('MANIFEST_DUPLICATE');readPinned({path:file,sha256:item.sha256});files.set(file.toLowerCase(),item.sha256);}return files;}
export function validateCompletionDependencyLock(value,packagePin,moduleRoot){
 if(value.schemaVersion!==1||value.sourceCommit!==packagePin.sourceCommit||!equal(value.packageRoot,packagePin.packageRoot)||!Array.isArray(value.files)||!value.files.length)reject('DEPENDENCY_LOCK_REJECTED');
 const files=[],seen=new Set();for(const item of value.files){
  if(typeof item.path!=='string'||!item.path.startsWith(moduleRoot+'/node_modules/')||item.path.includes('\\')||item.path.split('/').some(part=>!part||part==='.'||part==='..')||/[\x00-\x1f"'`$%<>|?:*]/.test(item.path))reject('DEPENDENCY_PATH_REJECTED');
  const file=path.win32.resolve(packagePin.packageRoot,item.path);windowsPath(file,packagePin.packageRoot);sha(item.sha256);
  if(seen.has(file.toLowerCase()))reject('DEPENDENCY_DUPLICATE');seen.add(file.toLowerCase());files.push({path:file,sha256:item.sha256});
 }return files;
}
function verifyLock(pin,packagePin,moduleRoot){const files=validateCompletionDependencyLock(json(pin),packagePin,moduleRoot),expected=new Set();for(const item of files){readPinned(item);expected.add(item.path.toLowerCase());}const observed=new Set();const scan=dir=>{noReparse(dir);for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isSymbolicLink())reject('DEPENDENCY_REPARSE');if(item.isDirectory())scan(file);else if(item.isFile())observed.add(file.toLowerCase());else reject('DEPENDENCY_TYPE');}};scan(path.join(packagePin.packageRoot,moduleRoot,'node_modules'));if(expected.size!==observed.size||[...observed].some(file=>!expected.has(file)))reject('DEPENDENCY_DRIFT');}
export async function createCompletionDriver(settings){
 const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',probe=path.join(settings.supervisor.packageRoot,'scripts','canonical','hub-stack-process-probe.ps1');let operation,native,crm,hubPin,hubStartup,crmHealthPath;const held=new Map(),entries=new Map();let exitRecorderInstalled=false;
 const inspect=async(stage,pid)=>completionDiagnosticProbe(stage.name??'hub','processProbe',()=>completionObserveProcess(async()=>{const args=['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',probe,'-Ports',stage.ports.join(',')];if(pid)args.push('-ProcessId',String(pid));const {stdout}=await completionProcessProbeExec(()=>runFile(shell,args,{windowsHide:true,timeout:10000,maxBuffer:128*1024}));const rows=JSON.parse(stdout.replace(/^\ufeff/,''));if(!Array.isArray(rows))reject('PROCESS_PROBE_REJECTED');return rows;}));
 const receiptPath=stage=>path.join(settings.runtimeDirectory,stage.name+'.json');
 const getHealth=async(port,stage)=>completionDiagnosticProbe(stage,'health',async()=>{const response=await fetch(`http://127.0.0.1:${port}/test-health`,{redirect:'error',credentials:'omit',signal:AbortSignal.timeout(4000)});if(response.status!==200)reject('HEALTH_STATUS');const bytes=await response.text();if(bytes.length>65536)reject('HEALTH_SIZE');return JSON.parse(bytes);});
 const driver={inspect,
  async verify(){if(process.platform!=='win32'||!equal(process.execPath,settings.node.path)||!completionSupervisorFlagsMatch(process.execArgv))reject('HOST_REJECTED');const {stdout}=await runFile(shell,['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,timeout:10000});validateCompletionSettings(settings,stdout.trim());readPinned({path:settings.node.path,sha256:settings.node.sha256});const own=verifyPackage(settings.supervisor);if(!own.has(fileURLToPath(import.meta.url).toLowerCase())||!own.has(probe.toLowerCase()))reject('SUPERVISOR_ENTRY_PIN');let crmIndexHash;for(const [name,pin] of Object.entries(settings.components)){const files=verifyPackage(pin,name==='crm');if(name==='crm')crmIndexHash=files.get(path.join(pin.packageRoot,'apps','frontend','dist','client','index.html').toLowerCase());readPinned(pin.config);for(const stage of COMPLETION_CORE_STAGES.filter(stage=>stage.component===name)){const entry=path.join(pin.packageRoot,stage.entry),entryHash=files.get(entry.toLowerCase());if(!entryHash)reject('ENTRY_NOT_PINNED');entries.set(stage.name,entryHash);}}for(const name of ['erpApiNative','nativeOrder','crm'])verifyLock(settings.dependencyLocks[name],settings.components[name],name==='crm'?'apps/gateway':'apps/api');for(const source of Object.values(settings.privateSources))readPinned(source);for(const source of Object.values(settings.crmPrivateFiles))readPinned(source);operation=json(settings.privateSources.operationConfig);native=json(settings.privateSources.nativeOrderConfig);crm=json(settings.privateSources.crmActivationConfig);hubPin=json(settings.privateSources.hubPinConfig);hubStartup=json(settings.privateSources.hubStartupConfig);if(operation.database!==DB||operation.copyContext?.copyId!==COPY||operation.erpPort!==4184||operation.nativePort!==4186||operation.webPort!==5234||operation.host!=='127.0.0.1'||operation.lanHost!=='192.168.1.46'||operation.transport!==undefined||native.database!==DB||native.nativePort!==62704||native.crmOrderCurrentContext?.copyId!==COPY||native.crmOrderCurrentContext?.actualT1!==false||native.crmOrderCurrentContext?.externalOperations!==false||native.crmOrderCurrentContext?.stockEffect!==false||native.crmOrderCurrentContext?.ledgerEffect!==false)reject('PRIVATE_SCOPE_REJECTED');if(Object.hasOwn(settings.crmPrivateFiles,'crm06Actors')){const require=createRequire(path.join(settings.components.crm.packageRoot,'apps','gateway','package.json'));const baseline=require('dotenv').parse(readPinned(settings.crmPrivateFiles.baseline));if(Object.hasOwn(settings.crmPrivateFiles,'crm06StaffSuccessor')){await verifyCrm06StaffSuccessorRuntime(settings,{baseline,activation:crm,hubPin,hubStartup});}else{assertCrm06PreparedActorReceipt({baseline,activation:crm,receipt:json(settings.crmPrivateFiles.crm06Actors)});}}completionCrmEnvironment(crm,settings,process.env);crmHealthPath=validateCurrentCrmHubPins(hubPin,settings,crm,crmIndexHash);if(hubPin.apiSourceCommit!==settings.components.erpApiNative.sourceCommit||hubPin.crmSourceCommit!==settings.components.crm.sourceCommit||hubStartup.PackageRoot!==settings.components.hub.packageRoot||hubStartup.SourceCommit!==settings.components.hub.sourceCommit||hubStartup.ManifestSha256!==settings.components.hub.manifestSha256||hubStartup.OperationConfigPath!==settings.privateSources.operationConfig.path||hubStartup.HubConfigPath!==settings.privateSources.hubPinConfig.path||hubStartup.NodePath!==settings.node.path||!equal(hubStartup.NodeSha256,settings.node.sha256)||hubStartup.OwnerSid!==settings.ownerSid)reject('HUB_LINK_REJECTED');if(!exitRecorderInstalled&&process.argv[1]&&equal(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){installCompletionExitRecorder(settings);exitRecorderInstalled=true;}},
  async sqlReady(){const require=createRequire(path.join(settings.components.erpApiNative.packageRoot,'apps','api','package.json'));return coldSqlProbe(operation,require('mssql'));},
  async receipt(stage){try{return JSON.parse(fs.readFileSync(receiptPath(stage),'utf8'));}catch{return null;}},
  async start(stage){
   fs.mkdirSync(settings.runtimeDirectory,{recursive:true});noReparse(settings.runtimeDirectory);
   const pin=settings.components[stage.component],entry=path.join(pin.packageRoot,stage.entry),env=stage.component==='crm'?completionCrmEnvironment(crm,settings,process.env):Object.fromEntries(['SystemRoot','WINDIR','PATH','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC','PATHEXT'].filter(key=>typeof process.env[key]==='string').map(key=>[key,process.env[key]]));const args=completionNodeArguments(stage,settings);readPinned({path:entry,sha256:entries.get(stage.name)});readPinned(pin.config);
   const run=crypto.randomUUID(),out=fs.openSync(path.join(settings.runtimeDirectory,stage.name+'-'+run+'.out.log'),'wx'),err=fs.openSync(path.join(settings.runtimeDirectory,stage.name+'-'+run+'.err.log'),'wx');
   return completionStartOwnedChild({stage,pin,parentPid:process.pid,run,matches:(row,receipt)=>completionProcessMatches(row,receipt,stage,settings),observe:inspect,writeReceipt:receipt=>fs.writeFileSync(receiptPath(stage),JSON.stringify(receipt)),register:pending=>held.set(run,pending),spawnOwned:()=>spawn(settings.node.path,args,{env,cwd:stage.component==='crm'?pin.packageRoot:path.join(pin.packageRoot,'apps','api'),windowsHide:true,stdio:['ignore',out,err]}),releaseSpawnLogs:()=>{try{fs.closeSync(out);}finally{fs.closeSync(err);}}});
  },
  pendingOwned(){return [...held.values()].map(item=>({stage:item.stage,receipt:item.receipt}));},
  // No automatic recovery after an unverified observation. An authorized activation must replace this resident supervisor.
  async quarantine(){for(;;)await new Promise(resolve=>setTimeout(resolve,15000));},
  async ready(stage,receipt){return completionDiagnosticProbe(stage.name,'health',async()=>{await completionDiagnosticProbe(stage.name,'processProbe',async()=>{const rows=await inspect(stage);if(rows.length!==1||!completionProcessMatches(rows[0],receipt,stage,settings))reject('PROCESS_DRIFT');});if(stage.component==='crm'){await completionDiagnosticProbe(stage.name,'CRM',()=>verifyCurrentCrmReadiness(stage,hubPin));return;}const health=await getHealth(stage.ports[0],stage.name);if(health.ok!==true||health.sourceCommit!==settings.components[stage.component].sourceCommit||health.copyId!==COPY||(health.databaseName??health.database)!==DB||health.actualT1!==false||health.environment!=='ISOLATED_TEST_COPY'||health.externalOperations!==false||health.automaticJobs!==false||['erpNative','erpApi'].includes(stage.name)&&['sysadmin','databaseControl','liveDatabaseAccess','originalDatabaseAccess'].some(key=>health[key]!==0))reject('HEALTH_IDENTITY');});},
  async hubReady(){return completionDiagnosticProbe('hub','hub',async()=>{const stage={ports:[5234]},entry=path.win32.join(settings.components.hub.packageRoot,'apps','api','start-shared-test-copy-web.mjs');for(let tick=0;tick<60;tick++){const rows=await inspect(stage);if(rows.length){if(rows.length!==1||rows[0].ownerSid!==settings.ownerSid||!equal(rows[0].nodePath,settings.node.path)||!nativeArgumentTokens(rows[0].commandLine).includes(entry)||!nativeArgumentTokens(rows[0].commandLine).includes(settings.privateSources.operationConfig.path)||!rows[0].bindings.some(row=>row.address==='192.168.1.46'&&row.port===5234)||rows[0].bindings.some(row=>!['127.0.0.1','192.168.1.46'].includes(row.address)))reject('HUB_OWNER_REJECTED');const health=await getHealth(5234,'hub');if(health.ok===true&&health.sourceCommit===settings.components.hub.sourceCommit&&health.copyId===COPY&&(health.databaseName??health.database)===DB&&health.actualT1===false)return;}await new Promise(resolve=>setTimeout(resolve,1000));}reject('HUB_TASK_NOT_READY');});},
  async monitor(tracked){for(;;){for(const item of tracked)await driver.ready(item.stage,item.receipt);await driver.publish(tracked,'running');await driver.hubReady();await new Promise(resolve=>setTimeout(resolve,15000));}},
  async publish(tracked,state){if(!crmHealthPath)return;const directory=path.dirname(crmHealthPath);fs.mkdirSync(directory,{recursive:true});noReparse(directory);if(fs.existsSync(crmHealthPath))noReparse(crmHealthPath);const temporary=crmHealthPath+'.'+process.pid+'.tmp';fs.writeFileSync(temporary,JSON.stringify(completionCrmHealthReceipt(settings,tracked,{state})),{flag:'wx'});fs.renameSync(temporary,crmHealthPath);},
  async stop(stage,receipt){
   const item=held.get(receipt.run),child=item?.child;return completionStopOwnedChild(item,{stage,receipt,observe:pid=>inspect(stage,pid),matches:(row,original)=>completionProcessMatches(row,original,stage,settings),verifyPins:()=>{readPinned({path:child.spawnargs[2],sha256:entries.get(stage.name)});readPinned(settings.components[stage.component].config);},forget:()=>held.delete(receipt.run)});
  },
  async failure(code,survivors=[],diagnostic){fs.mkdirSync(settings.runtimeDirectory,{recursive:true});noReparse(settings.runtimeDirectory);fs.writeFileSync(path.join(settings.runtimeDirectory,'failure.json'),JSON.stringify({code,stages:survivors,...(safeCompletionDiagnostic(diagnostic)?{diagnostic:safeCompletionDiagnostic(diagnostic)}:{}),sourceCommit:settings.supervisor.sourceCommit,actualT1:false,checkedAt:new Date().toISOString()}));}
 };return driver;
}
export async function runCompletionLogon({configPath,configSha256,ownerSid,action='Probe',driverFactory=createCompletionDriver,loadSettings=json,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 ref({path:configPath,sha256:configSha256});const settings=validateCompletionSettings(loadSettings({path:configPath,sha256:configSha256}),ownerSid);if(driverFactory===createCompletionDriver&&!equal(fileURLToPath(import.meta.url),path.win32.join(settings.supervisor.packageRoot,'scripts','canonical','terminal-completion-logon.mjs')))reject('EXECUTION_PACKAGE_REJECTED');if(!['Probe','Start'].includes(action))reject('ACTION_REJECTED');const driver=await driverFactory(settings);if(action==='Probe'){await driver.verify();await driver.sqlReady();return {pinsAndReadonlySqlVerified:true,installed:false,actualLogonTested:false,hubTaskPreserved:true};}for(let attempt=0;attempt<=3;attempt++){try{await completionAttempt(settings,driver);reject('UNEXPECTED_RETURN');}catch(error){const code=/^TERMINAL_LOGON_[A-Z_]+$/.test(error?.message??'')?error.message:'TERMINAL_LOGON_ATTEMPT_FAILED';await driver.failure?.(code,[],completionFailureDiagnostic(error));if(['TERMINAL_LOGON_CLEANUP_UNVERIFIED','TERMINAL_LOGON_OBSERVATION_QUARANTINED'].includes(code)||attempt===3)throw Error(code);await delay(60000);}}}
if(process.argv[1]&&equal(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){const args=process.argv.slice(2),keys=['--config','--sha256','--owner-sid','--action'];try{if(args.length!==8||keys.some((key,i)=>args[i*2]!==key))reject('ARGUMENTS_REJECTED');const result=await runCompletionLogon({configPath:args[1],configSha256:args[3],ownerSid:args[5],action:args[7]});if(result)process.stdout.write(JSON.stringify(result)+'\n');}catch(error){process.stderr.write((/^TERMINAL_LOGON_[A-Z_]+$/.test(error?.message??'')?error.message:'TERMINAL_LOGON_FAILED')+'\n');process.exitCode=1;}}
