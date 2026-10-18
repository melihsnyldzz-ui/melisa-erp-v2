import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';

const OWNER='S-1-5-21-2170750028-1005938530-2568122015-1001';
const DB='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
const SHELL='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const OLD='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-439b63db8376-erp-crm-node24-hub-ready.json';
const OLD_SHA='be8ee1864339d487506558335f382d9369a2c51b51703ccb4501afd48e4bcb96';
const COLLECTOR='C:\\Sirket\\ERP\\reports\\p03-owner-inspect-20261017.mjs';
const COLLECTOR_SHA='bb7469010862e9704ce23ca168a591b866e0b646ec548115ea3f2b15c300064c';
const NEW='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json';
const TASKS=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
const ROLES=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
const ROOT='C:\\Users\\Xaser\\AppData\\Local';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const need=(x,code)=>{if(!x)throw Error('P03_PROFILE_CREATE_'+code);};
const win=x=>path.win32.normalize(x);
const encode=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const xml=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const quote=x=>/[\s"]/u.test(x)?'"'+x.replaceAll('"','\\"')+'"':x;
const command=xs=>xs.map(quote).join(' ');
function pin(ref){
 need(ref&&/^[a-f0-9]{64}$/.test(ref.sha256),'PIN_FORMAT');
 const stat=fs.lstatSync(ref.path);need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&fs.realpathSync.native(ref.path).toLowerCase()===path.resolve(ref.path).toLowerCase(),'PIN_FILE');
 const bytes=fs.readFileSync(ref.path);need(hash(bytes)===ref.sha256,'PIN_HASH');return bytes;
}
function scope(settings){need(settings.ownerSid===OWNER&&settings.database===DB&&settings.actualT1===false,'SETTINGS_SCOPE');}
export function deriveP03CandidateRules(settings,ref){
 scope(settings);
 const defs=[['erpNative','erpApiNative','apps/api/start-shared-test-copy.mjs','native'],['erpApi','erpApiNative','apps/api/start-shared-test-copy.mjs','erp'],['crmNativeOrder','nativeOrder','apps/api/start-crm-order-test.mjs','--shared-current-test'],['crmCatalog','crm','deploy/test-erp-catalog.mjs'],['crmOrders','crm','deploy/test-erp-orders.mjs'],['crmServer','crm','deploy/test-server.mjs']];
 const fields={schema:null,pid:'pid',parentPid:'parentPid',birth:'creationTime',parentBirth:'parentCreationTime',sourceCommit:'sourceCommit',configSha256:'configSha256',copyId:'copyId',actualT1:'actualT1'};
 const exactKeys=['run','pid','parentPid','parentCreationTime','creationTime','stage','sourceCommit','configSha256','copyId','actualT1'];
 const rows=defs.map(([role,key,entry,mode])=>{
  const component=settings.components[key];const argv=[settings.node.path,'--no-maglev',path.win32.join(component.packageRoot,entry),...(key==='crm'?[]:[mode,component.config.path])];
  return {role,nodePath:settings.node.path,commandLine:command(argv),packageRoot:component.packageRoot,sourceCommit:component.sourceCommit,config:component.config,receipt:{path:path.win32.join(settings.runtimeDirectory,role+'.json'),schemaVersion:null,exactKeys,fields}};
 });
 const sup=settings.supervisor;
 rows.push({role:'coreSupervisor',nodePath:settings.node.path,commandLine:command([settings.node.path,'--no-maglev',path.win32.join(sup.packageRoot,'scripts/canonical/terminal-completion-logon.mjs'),'--config',ref.path,'--sha256',ref.sha256,'--owner-sid',OWNER,'--action','Start']),packageRoot:sup.packageRoot,sourceCommit:sup.sourceCommit,config:ref,receipt:null});
 rows.push({role:'hub',nodePath:settings.node.path,commandLine:command([settings.node.path,path.win32.join(settings.components.hub.packageRoot,'apps/api/start-shared-test-copy-web.mjs'),settings.privateSources.operationConfig.path]),packageRoot:settings.components.hub.packageRoot,sourceCommit:settings.components.hub.sourceCommit,config:settings.privateSources.operationConfig,receipt:null});
 for(const [index,role] of ['terminalWatcher','hubWatcher'].entries()){
  const leaf=index===0?'watch-terminal-completion-logon.ps1':'watch-hub-after-erp.ps1';
  const args=`-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "${path.win32.join(sup.packageRoot,'scripts/canonical',leaf)}" -StartupConfigPath "${ref.path}" -StartupConfigSha256 ${ref.sha256}`;
  rows.push({role,taskName:TASKS[index],nodePath:SHELL,commandLine:`"${SHELL}" ${args}`,packageRoot:sup.packageRoot,sourceCommit:sup.sourceCommit,config:ref,receipt:null});
 }
 return rows;
}
export function buildP03PhysicalProfile({oldObservation,extras,oldSettings,newSettings,newSettingsRef,businessDigest,runId,now=Date.now(),shellSha256}){
 need(/^[a-f0-9]{32}$/.test(runId),'RUN');scope(oldSettings);scope(newSettings);
 need(oldObservation.schemaVersion==='melisa-p03-owner-observation.v2'&&oldObservation.ownerSid===OWNER&&oldObservation.database===DB&&oldObservation.actualT1===false&&oldObservation.oldConfig.sha256===OLD_SHA&&oldObservation.copyId===newSettings.copyId&&oldSettings.copyId===newSettings.copyId,'OLD_SCOPE');
 const erp=newSettings.components.erpApiNative,crm=newSettings.components.crm,sup=newSettings.supervisor;
 need(erp.sourceCommit==='e59e07abf7ae2567cdc2adb93811fe29e0032fe5'&&erp.manifestSha256==='2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7','ERP_EXACT');
 need(crm.sourceCommit==='6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'&&crm.manifestSha256==='e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83','CRM_EXACT');
 need(sup.sourceCommit==='13bdf75a032ae8f694354a2e57b6ed382aec2f17'&&sup.manifestSha256==='195249d89202e4a86f3abe9c71f6ff7ee89dad0315184e0b657995a8c0cca624','SUPERVISOR_EXACT');
 need(newSettingsRef.path===NEW&&/^[a-f0-9]{64}$/.test(newSettingsRef.sha256)&&/^[a-f0-9]{64}$/.test(shellSha256),'REFS');
 need(now-Date.parse(oldObservation.observedAt)>=0&&now-Date.parse(oldObservation.observedAt)<60000&&now-Date.parse(extras.observedAt)>=0&&now-Date.parse(extras.observedAt)<60000,'STALE');
 need(extras.tasks.length===2&&extras.oldWatchers.length===2&&extras.protectedProcesses.length>0&&extras.protectedProcesses.some(x=>x.name==='sqlservr.exe'),'EXTRAS');
 need(TASKS.every(name=>extras.tasks.some(x=>x.name===name&&x.xml===oldObservation.tasks.find(y=>y.name===name)?.xml)),'TASK_DRIFT');
 need(oldObservation.identities&&Object.keys(oldObservation.identities).sort().join('|')===[...ROLES].sort().join('|'),'OLD_IDENTITY_ROLES');
 const oldIdentities=structuredClone(oldObservation.identities),pids=new Set();
 for(const [role,row] of Object.entries(oldIdentities)){
  need(Number.isSafeInteger(row.pid)&&row.pid>0&&!pids.has(row.pid)&&Number.isSafeInteger(row.parentPid)&&row.parentPid>0&&row.parentPid!==row.pid&&row.ownerSid===OWNER&&typeof row.nodePath==='string'&&row.nodePath.length>0&&typeof row.commandLine==='string'&&row.commandLine.length>0&&Number.isFinite(Date.parse(row.creationTime))&&Date.parse(row.creationTime)<=Date.parse(oldObservation.observedAt),'OLD_IDENTITY_SCHEMA');pids.add(row.pid);
  if(role==='coreSupervisor'){
   const watcher=extras.oldWatchers.filter(x=>x.role==='terminalWatcher'&&x.pid===row.parentPid&&x.ownerSid===OWNER);
   need(watcher.length===1&&Number.isFinite(Date.parse(watcher[0].creationTime))&&Date.parse(watcher[0].creationTime)<=Date.parse(row.creationTime),'OLD_SUPERVISOR_PARENT');
   row.parentCreationTime=watcher[0].creationTime;row.parentBirthProvenance='CAPTURED_COM_WATCHER';
  }else if(role==='hub'&&(row.parentCreationTime===null||row.parentCreationTime===undefined)){
   need(oldObservation.hubLineage==='WATCHER_RUNNING_PARENT_EXITED_UNPROVEN','OLD_HUB_PARENT_MARKER');row.parentCreationTime=null;row.parentBirthProvenance='UNPROVEN_ONLY_FOR_OLD_HUB';
  }else{
   need(Number.isFinite(Date.parse(row.parentCreationTime))&&Date.parse(row.parentCreationTime)<=Date.parse(row.creationTime),'OLD_PARENT_BIRTH');row.parentBirthProvenance='CAPTURED_OS_PARENT';
  }
  row.bindings??=[];
 }
 const plan={targets:ROLES,oldSettingsSha256:OLD_SHA,newSettingsSha256:newSettingsRef.sha256};plan.digest=hash(Buffer.from(JSON.stringify(plan)));
 const before={...oldObservation,schemaVersion:'melisa-p03-owner-observation.v3',runId,newConfig:newSettingsRef,plan,profile:{erpSource:erp.sourceCommit,erpManifest:erp.manifestSha256,crmSource:crm.sourceCommit,crmManifest:crm.manifestSha256,supervisorSource:sup.sourceCommit,supervisorManifest:sup.manifestSha256}};
 before.identities=oldIdentities;
 const beforeBytes=encode(before),beforeRef={path:path.win32.join(ROOT,'MelisaERP-P03-before-'+runId+'.json'),sha256:hash(beforeBytes)};
 const candidateRules=deriveP03CandidateRules(newSettings,newSettingsRef);
 const tasks=oldObservation.tasks.map((row,index)=>{
  const leaf=index===0?'watch-terminal-completion-logon.ps1':'watch-hub-after-erp.ps1';
  const args=`-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "${path.win32.join(sup.packageRoot,'scripts/canonical',leaf)}" -StartupConfigPath "${newSettingsRef.path}" -StartupConfigSha256 ${newSettingsRef.sha256}`;
  const newXml=row.xml.replace(/<Arguments>[\s\S]*?<\/Arguments>/,`<Arguments>${xml(args)}</Arguments>`).replace(/<WorkingDirectory>[\s\S]*?<\/WorkingDirectory>/,`<WorkingDirectory>${xml(sup.packageRoot)}</WorkingDirectory>`);
  need(newXml!==row.xml&&newXml.replace(/<Actions\b[^>]*>[\s\S]*?<\/Actions>/,'<Actions/>')===row.xml.replace(/<Actions\b[^>]*>[\s\S]*?<\/Actions>/,'<Actions/>'),'TASK_METADATA');
  return {name:row.name,oldXml:row.xml,oldXmlSha256:hash(Buffer.from(row.xml)),newXmlSha256:hash(Buffer.from(newXml)),newXml};
 });
 const packages=new Map();
 for(const settings of [oldSettings,newSettings])for(const c of [...Object.values(settings.components),settings.supervisor]){
  const root=win(c.packageRoot),row={root,sourceCommit:c.sourceCommit,manifestPath:path.win32.join(root,'release-manifest.json'),manifestSha256:c.manifestSha256};
  if(packages.has(root.toLowerCase()))need(JSON.stringify(packages.get(root.toLowerCase()))===JSON.stringify(row),'PACKAGE_CONFLICT');packages.set(root.toLowerCase(),row);
 }
 const profile={schemaVersion:'melisa-p03-physical-profile.v1',ownerSid:OWNER,database:DB,beforeImage:beforeRef,oldSettings:{path:OLD,sha256:OLD_SHA},newSettings:newSettingsRef,packages:[...packages.values()],stopper:{path:'C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014\\stop-exact-observed-process.ps1',sha256:'79a3f760d17cf805845042f544f8a42110a41f6dde754858661803d5523d292d'},tasks,candidateRules,oldWatchers:extras.oldWatchers,protectedProcesses:extras.protectedProcesses,businessDigest,journalDirectory:path.win32.join(ROOT,'MelisaERP-P03-recovery-'+runId),shell:{path:SHELL,sha256:shellSha256},health:[4184,4186].map(port=>({url:`http://127.0.0.1:${port}/test-health`,databasePath:'databaseName',sourcePath:'sourceCommit',expectedSource:oldSettings.components.erpApiNative.sourceCommit}))};
 const profileBytes=encode(profile);
 return {runId,before:{bytesBase64:beforeBytes.toString('base64'),sha256:beforeRef.sha256},profile:{bytesBase64:profileBytes.toString('base64'),sha256:hash(profileBytes)},summary:{runId,beforeImage:beforeRef,profile:{path:path.win32.join(ROOT,'MelisaERP-P03-profile-'+runId+'.json'),sha256:hash(profileBytes)},journalDirectory:profile.journalDirectory,candidateSources:{erp:erp.sourceCommit,crm:crm.sourceCommit,supervisor:sup.sourceCommit},runtimeMutation:false}};
}
function ps(code){return execFileSync(SHELL,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{windowsHide:true,timeout:60000,maxBuffer:4*1024*1024,encoding:'utf8'}).trim();}
async function main(){
 const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help'){process.stdout.write('Default DryRun: --new-settings-path PATH --new-settings-sha256 SHA --business-digest-path PATH --business-digest-sha256 SHA [--mode DryRun|Create]\n');return;}
 need(args.length===8||args.length===10,'ARGUMENTS');const flags=new Map();for(let i=0;i<args.length;i+=2){need(['--new-settings-path','--new-settings-sha256','--business-digest-path','--business-digest-sha256','--mode'].includes(args[i])&&!flags.has(args[i]),'FLAG');flags.set(args[i],args[i+1]);}
 const mode=flags.get('--mode')??'DryRun';need(['DryRun','Create'].includes(mode),'MODE');need(process.platform==='win32','PLATFORM');
 const newSettingsRef={path:win(flags.get('--new-settings-path')),sha256:flags.get('--new-settings-sha256')};need(newSettingsRef.path===NEW,'NEW_PATH');
 const oldSettings=JSON.parse(pin({path:OLD,sha256:OLD_SHA})),newSettings=JSON.parse(pin(newSettingsRef));
 const businessDigest={path:win(flags.get('--business-digest-path')),sha256:flags.get('--business-digest-sha256')};pin(businessDigest);
 pin({path:COLLECTOR,sha256:COLLECTOR_SHA});const {captureP03OwnerObservation}=await import(pathToFileURL(COLLECTOR).href);
 const first=await captureP03OwnerObservation();
 const extras=JSON.parse(ps(`$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;$names=@('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web');$s=New-Object -ComObject Schedule.Service;$s.Connect();$folder=$s.GetFolder('\\');$runs=$s.GetRunningTasks(1);$tasks=@();$watch=@();foreach($name in $names){$t=$folder.GetTask($name);if([int]$t.State -ne 4){throw 'TASK_NOT_RUNNING'};$tasks+=,[ordered]@{name=$name;xml=[string]$t.Xml};$found=@();for($i=1;$i -le $runs.Count;$i++){$r=$runs.Item($i);if($r.Name -ceq $name){$found+=,$r}};if($found.Count -ne 1){throw 'TASK_INSTANCE'};$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$found[0].EnginePID);$o=Invoke-CimMethod $p -MethodName GetOwnerSid;if($o.ReturnValue -ne 0){throw 'WATCHER_OWNER'};$watch+=,[ordered]@{role=$(if($name -ceq $names[0]){'terminalWatcher'}else{'hubWatcher'});pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;nodePath=$p.ExecutablePath;ownerSid=$o.Sid;commandLine=$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o');bindings=@()}};$ids=@(Get-NetTCPConnection -State Listen|Where-Object LocalPort -in 4144,4146,5194|ForEach-Object OwningProcess);$ids+=@(Get-CimInstance Win32_Process -Filter "Name='sqlservr.exe'"|ForEach-Object ProcessId);$protected=@();foreach($id in @($ids|Sort-Object -Unique)){$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$id);$o=Invoke-CimMethod $p -MethodName GetOwnerSid;if($o.ReturnValue -ne 0){throw 'PROTECTED_OWNER'};$protected+=,[ordered]@{name=$p.Name;pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;nodePath=$p.ExecutablePath;ownerSid=$o.Sid;commandLine=$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o');bindings=@()}};[ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');tasks=$tasks;oldWatchers=$watch;protectedProcesses=$protected}|ConvertTo-Json -Depth 12 -Compress`));
 const last=await captureP03OwnerObservation();need(JSON.stringify(first.identities)===JSON.stringify(last.identities)&&JSON.stringify(first.tasks)===JSON.stringify(last.tasks),'OBSERVATION_DRIFT');
 const request=buildP03PhysicalProfile({oldObservation:last,extras,oldSettings,newSettings,newSettingsRef,businessDigest,runId:crypto.randomBytes(16).toString('hex'),shellSha256:hash(fs.readFileSync(SHELL))});
 if(mode==='DryRun'){process.stdout.write(JSON.stringify({status:'DRY_RUN_ONLY',...request.summary,created:false},null,2)+'\n');return;}
 const writer=fileURLToPath(new URL('./p03-physical-profile-create.ps1',import.meta.url));
 const result=execFileSync(SHELL,['-NoProfile','-NonInteractive','-File',writer],{windowsHide:true,input:JSON.stringify(request),timeout:30000,maxBuffer:1024*1024,encoding:'utf8'});
 process.stdout.write(result);
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){main().catch(error=>{process.stderr.write(/^P03_PROFILE_CREATE_[A-Z_]+$/.test(error?.message)?error.message+'\n':'P03_PROFILE_CREATE_REJECTED\n');process.exitCode=1;});}
