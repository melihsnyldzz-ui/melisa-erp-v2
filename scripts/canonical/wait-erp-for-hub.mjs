// Read-only readiness barrier before the existing pinned Hub watcher starts.
// It never starts/stops a process, changes a task or accesses application auth.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';
const PROFILES=Object.freeze([
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-da82fc6644c1-parent-probe.json',source:'da82fc6644c1d9dba0c10eaa861773534d43c288'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-5ce452b01ef2.json',source:'5ce452b01ef20fc84a09c52b78311db8eb1dd1d8'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-5bcd5ad136ff.json',source:'5bcd5ad136ff7ca35d623d436b8724cc491641be'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-5bcd5ad136ff-receipt-wait.json',source:'5bcd5ad136ff7ca35d623d436b8724cc491641be'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-bb8966c59a6c.json',source:'bb8966c59a6cfbdc1cc83472cb331e48b720a173'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-957f98773695.json',source:'957f98773695874ea3d101b7eb4816f9ea080880'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-89427492f27c.json',source:'89427492f27caf72c511a27262b55e73d782c407'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-94f2a75322a3.json',source:'94f2a75322a3daa695d38010a6f2c8ef23f6c17b'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-a7243dedf9ca.json',source:'a7243dedf9ca5d1ca1d5aa1cb3dffaee7c18a7e9'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-439b63db8376.json',source:'439b63db8376a6b9d3ac8baa625ed98367022623'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-439b63db8376-erp-candidate.json',source:'439b63db8376a6b9d3ac8baa625ed98367022623'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-439b63db8376-erp-candidate-native-ready.json',source:'439b63db8376a6b9d3ac8baa625ed98367022623'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-439b63db8376-erp-crm-node24-ready.json',source:'439b63db8376a6b9d3ac8baa625ed98367022623'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-439b63db8376-erp-crm-node24-hub-ready.json',source:'439b63db8376a6b9d3ac8baa625ed98367022623'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-e0e6c28.json',source:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-1a03157.json',source:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'}),
 Object.freeze({config:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-c88d7010f831.json',source:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'})
]);
const RECEIPTS='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\hub-web';
const FAILURE_CODES=new Set(['ERP_HUB_WAIT_REJECTED','ERP_HUB_WAIT_OBSERVATION','ERP_HUB_WAIT_OWNER','ERP_HUB_WAIT_IDENTITY','ERP_HUB_WAIT_PARENT','ERP_HUB_WAIT_CHANGED','ERP_HUB_WAIT_TIMEOUT','ERP_HUB_WAIT_HEALTH','ERP_HUB_WAIT_TARGET']);
const SHELL='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const check=(ok,code='ERP_HUB_WAIT_REJECTED')=>{if(!ok)fail(code);};
const samePath=(a,b)=>typeof a==='string'&&typeof b==='string'&&path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
export function assertErpHubProfile(configPath,crmSource){
 const profile=PROFILES.find(p=>p.config===configPath);
 check(profile&&profile.source===crmSource);return true;
}
export function erpHubFailureMetadata(configPath,configSha256,receiptPath,code){
 check(PROFILES.some(p=>p.config===configPath)&&typeof configSha256==='string'&&/^[a-f0-9]{64}$/.test(configSha256));
 check(typeof receiptPath==='string'&&path.win32.dirname(receiptPath)===RECEIPTS&&/^erp-prerequisites-[a-f0-9]{32}\.json$/.test(path.win32.basename(receiptPath)));
 return {path:receiptPath+'.failure.json',code:FAILURE_CODES.has(code)?code:'ERP_HUB_WAIT_REJECTED',configSha256};
}
function noReparse(p){for(let q=p;;q=path.dirname(q)){check(!fs.lstatSync(q).isSymbolicLink());if(q===path.dirname(q))break;}}
function readPinned(ref){noReparse(ref.path);const b=fs.readFileSync(ref.path);check(sha(b)===ref.sha256);return b;}
const identity=rows=>JSON.stringify(rows.map(r=>[r.pid,r.parentPid,r.creationTime,r.parentCreationTime,r.commandLine,r.parentCommandLine]).sort((a,b)=>a[0]-b[0]));
const receiptKeys=['run','pid','parentPid','parentCreationTime','creationTime','stage','sourceCommit','configSha256','copyId','actualT1'];
const nativeTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}0Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(Date.parse(value)).toISOString().slice(0,19)===value.slice(0,19);
function staleReceiptPending(row,r,stage,settings,matches){
 const pin=settings.components?.[stage.component];
 check(r&&Object.getPrototypeOf(r)===Object.prototype&&Reflect.ownKeys(r).length===receiptKeys.length&&receiptKeys.every(k=>Object.hasOwn(r,k)),'ERP_HUB_WAIT_IDENTITY');
 check(typeof r.run==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(r.run)&&Number.isSafeInteger(r.pid)&&r.pid>0&&Number.isSafeInteger(r.parentPid)&&r.parentPid>0&&nativeTime(r.creationTime)&&nativeTime(r.parentCreationTime)&&r.parentCreationTime<=r.creationTime,'ERP_HUB_WAIT_IDENTITY');
 check(pin&&r.stage===stage.name&&r.sourceCommit===pin.sourceCommit&&r.configSha256===pin.config.sha256&&r.copyId===settings.copyId&&r.actualT1===false,'ERP_HUB_WAIT_IDENTITY');
 // The supervisor publishes after its owned process probe, before health.
 // A newly bound child may therefore precede its fresh on-disk receipt.
 // A different, older child may belong to this exact live supervisor or an
 // older supervisor generation. Same-PID/different-birth reuse may not wait.
 const parentGeneration=row.parentPid===r.parentPid?row.parentCreationTime===r.parentCreationTime:r.parentCreationTime<row.parentCreationTime;
 check(nativeTime(row.creationTime)&&nativeTime(row.parentCreationTime)&&row.parentCreationTime<=row.creationTime&&row.pid!==r.pid&&r.creationTime<row.creationTime&&parentGeneration,'ERP_HUB_WAIT_IDENTITY');
 const candidate={...r,pid:row.pid,parentPid:row.parentPid,creationTime:row.creationTime,parentCreationTime:row.parentCreationTime};
 check(matches(row,candidate,stage,settings),'ERP_HUB_WAIT_IDENTITY');
 return true;
}

export function assertErpHubHealth(h,settings,stage){
 check(h?.ok===true&&h.sourceCommit===settings.components[stage.component].sourceCommit&&h.copyId===settings.copyId&&(h.databaseName??h.database)===settings.database&&h.actualT1===false&&h.environment==='ISOLATED_TEST_COPY'&&h.externalOperations===false&&h.automaticJobs===false&&['sysadmin','databaseControl','liveDatabaseAccess','originalDatabaseAccess'].every(key=>h[key]===0),'ERP_HUB_WAIT_TARGET');
 return true;
}

export async function waitForErpBeforeHub({settings,stages,probe,receipt,matches,ready,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 check(Array.isArray(stages)&&stages.length===2&&stages[0].name==='erpNative'&&stages[1].name==='erpApi');
 const deadline=now()+600000;
 const observe=async()=>{
  const rows=await probe();check(Array.isArray(rows)&&rows.length<=2,'ERP_HUB_WAIT_OBSERVATION');
  check(rows.every(r=>r.ownerSid===settings.ownerSid&&samePath(r.nodePath,settings.node.path)&&Array.isArray(r.bindings)&&r.bindings.length>0&&r.bindings.every(b=>[4184,4186].includes(b.port))),'ERP_HUB_WAIT_OWNER');
  if(rows.length!==2||!stages.every(s=>rows.some(r=>r.bindings.some(b=>s.ports.includes(b.port)))))return null;
  const linked=[];let pending=false;
  for(const stage of stages){const found=rows.filter(r=>r.bindings.some(b=>stage.ports.includes(b.port)));check(found.length===1,'ERP_HUB_WAIT_OBSERVATION');const r=await receipt(stage);if(!r)return null;if(!matches(found[0],r,stage,settings)){staleReceiptPending(found[0],r,stage,settings,matches);pending=true;}linked.push(r);}
  if(pending)return null;
  check(linked[0].parentPid===linked[1].parentPid&&linked[0].parentCreationTime===linked[1].parentCreationTime,'ERP_HUB_WAIT_PARENT');
  return {rows,linked};
 };
 while(now()<deadline){
  const first=await observe();
  if(first&&await ready(stages[0])&&await ready(stages[1])){
   const second=await observe();check(second&&identity(second.rows)===identity(first.rows),'ERP_HUB_WAIT_CHANGED');check(now()<deadline,'ERP_HUB_WAIT_TIMEOUT');
   return {schemaVersion:'melisa-erp-hub-prerequisites.v1',readyAt:new Date(now()).toISOString(),ready:true,coreSupervisorPid:second.linked[0].parentPid,coreSupervisorCreationTime:second.linked[0].parentCreationTime,erpNativePid:second.rows.find(r=>r.bindings.some(b=>b.port===4186)).pid,erpApiPid:second.rows.find(r=>r.bindings.some(b=>b.port===4184)).pid};
  }
  await sleep(1000);
 }
 fail('ERP_HUB_WAIT_TIMEOUT');
}

export async function runErpHubBarrier({configPath,configSha256,ownerSid,receiptPath}){
 check(process.platform==='win32'&&PROFILES.some(p=>p.config===configPath)&&/^[a-f0-9]{64}$/.test(configSha256)&&/^S-1-5-21-(?:[1-9]\d*-){3}[1-9]\d*$/.test(ownerSid));
 check(path.win32.dirname(receiptPath)===RECEIPTS&&/^erp-prerequisites-[a-f0-9]{32}\.json$/.test(path.win32.basename(receiptPath)));
 check(process.execArgv.length===1&&process.execArgv[0]==='--no-maglev');
 const settings=JSON.parse(readPinned({path:configPath,sha256:configSha256}));
 assertErpHubProfile(configPath,settings.components.crm.sourceCommit);
 check(settings.ownerSid===ownerSid&&settings.actualT1===false&&settings.copyId==='e16b70f0-4057-428b-9abc-6bbcaf35fe82'&&settings.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_02');
 check(samePath(process.execPath,settings.node.path)&&samePath(fileURLToPath(import.meta.url),path.win32.join(settings.supervisor.packageRoot,'scripts','canonical','wait-erp-for-hub.mjs')));
 readPinned(settings.node);const manifest=JSON.parse(readPinned({path:path.win32.join(settings.supervisor.packageRoot,'release-manifest.json'),sha256:settings.supervisor.manifestSha256}));check(manifest.sourceCommit===settings.supervisor.sourceCommit&&manifest.packageRole==='SUPERVISOR_ONLY'&&manifest.applicationDeployment===false&&Array.isArray(manifest.files));
 for(const file of manifest.files){check(/^scripts\/canonical\/[-_a-zA-Z0-9./]+$/.test(file.path)&&!file.path.includes('..')&&/^[a-f0-9]{64}$/.test(file.sha256));readPinned({path:path.win32.join(settings.supervisor.packageRoot,file.path),sha256:file.sha256});}
 const required=['terminal-completion-logon.mjs','hub-stack-process-probe.ps1','wait-erp-for-hub.mjs','watch-hub-after-erp.ps1'];for(const name of required)check(manifest.files.some(f=>f.path==='scripts/canonical/'+name));
 const core=await import(pathToFileURL(path.win32.join(settings.supervisor.packageRoot,'scripts','canonical','terminal-completion-logon.mjs')));core.validateCompletionSettings(settings,ownerSid);
 const run=promisify(execFile),options={windowsHide:true,timeout:20000,maxBuffer:131072,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}};
 const caller=await run(SHELL,['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],options);check(!caller.stderr&&caller.stdout.trim()===ownerSid);
 const stages=core.COMPLETION_CORE_STAGES.slice(0,2);
 const result=await waitForErpBeforeHub({settings,stages,matches:core.completionProcessMatches,
  probe:async()=>{const r=await run(SHELL,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',path.win32.join(settings.supervisor.packageRoot,'scripts','canonical','hub-stack-process-probe.ps1'),'-Ports','4184,4186'],options);check(!r.stderr);return JSON.parse(r.stdout);},
  receipt:async stage=>{try{const p=path.win32.join(settings.runtimeDirectory,stage.name+'.json');noReparse(p);return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  ready:async stage=>{let response;try{response=await fetch('http://127.0.0.1:'+stage.ports[0]+'/test-health',{redirect:'error',signal:AbortSignal.timeout(5000)});}catch{return false;}if(response.status!==200){check([404,503].includes(response.status),'ERP_HUB_WAIT_HEALTH');return false;}return assertErpHubHealth(await response.json(),settings,stage);}
 });
 // Recheck immutable outer pins immediately before releasing the barrier.
 readPinned({path:configPath,sha256:configSha256});readPinned(settings.node);noReparse(RECEIPTS);
 const receiptValue={...result,supervisorSource:settings.supervisor.sourceCommit,configSha256,copyId:settings.copyId,actualT1:false,helperPid:process.pid,watcherPid:process.ppid,businessWrites:0};
 const fd=fs.openSync(receiptPath,'wx');try{fs.writeFileSync(fd,JSON.stringify(receiptValue,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}return receiptValue;
}
if(process.argv[1]&&samePath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
 const args=process.argv.slice(2);try{check(args.length===8&&args[0]==='--config'&&args[2]==='--sha256'&&args[4]==='--owner-sid'&&args[6]==='--receipt');await runErpHubBarrier({configPath:args[1],configSha256:args[3],ownerSid:args[5],receiptPath:args[7]});console.log('ERP_HUB_PREREQUISITES_READY');}catch(e){const code=FAILURE_CODES.has(e.code)?e.code:'ERP_HUB_WAIT_REJECTED';try{const metadata=erpHubFailureMetadata(args[1],args[3],args[7],code);noReparse(RECEIPTS);const fd=fs.openSync(metadata.path,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify({schemaVersion:'melisa-erp-hub-prerequisites-failure.v1',code:metadata.code,configSha256:metadata.configSha256,recordedAt:new Date().toISOString(),helperPid:process.pid,watcherPid:process.ppid,businessWrites:0})+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}catch{}console.error(code);process.exitCode=1;}
}
