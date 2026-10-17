// Source-only P03 predicate. The caller must capture COM and CIM independently;
// this module neither reads nor changes Task Scheduler, processes, or runtime.
const CODE='P03_TASK_IDENTITY_REJECTED';
const SHA=/^[a-f0-9]{64}$/;
const GUID=/^\{?[a-f0-9]{8}-[a-f0-9]{4}-[1-8a-f][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\}?$/i;
const SID=/^S-1-\d+(?:-\d+)+$/;
const SUPERVISOR_ROOT='C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261017-c4010efa8ff6';
const SETTINGS='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-6bc82e6fe972-erp-e0e6c28.json';
const SETTINGS_SHA='201a159b9b51058896d25961c5292d1d8e22cc3a76024958b4c324de07896e35';
const SHELL='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const PIN=Object.freeze({packageRoot:SUPERVISOR_ROOT,sourceCommit:'c4010efa8ff6b49f3e342032c98611a26c41cfaf',manifestSha256:'4fecac939834ee66266472bfc2d0d4ede3c475292971183da6e58de006c58590'});
const TASKS=Object.freeze({
 'Melisa-Terminal-Completion-Logon':Object.freeze({script:'watch-terminal-completion-logon.ps1'}),
 'Melisa-Hub-TEST-Web':Object.freeze({script:'watch-hub-after-erp.ps1'})
});
function reject(){const error=new Error(CODE);error.code=CODE;throw error;}
function object(value){if(!value||typeof value!=='object'||Array.isArray(value))reject();return value;}
function exact(a,b){if(typeof a!=='string'||!a||a!==b)reject();}
function time(value){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value))reject();const n=Date.parse(value);if(!Number.isFinite(n))reject();return n;}
function pid(value){if(!Number.isSafeInteger(value)||value<=0)reject();return value;}
function sha(value){if(typeof value!=='string'||!SHA.test(value))reject();return value;}
function guid(value){if(typeof value!=='string'||!GUID.test(value))reject();return value.toLowerCase().replace(/[{}]/g,'');}
function taskKey(value){const task=object(value);if(typeof task.path!=='string'||!/^\\[^\\]+$/.test(task.path))reject();if(typeof task.name!=='string'||!task.name||task.name.includes('\\')||task.path!==`\\${task.name}`)reject();return task.path;}
function action(value){const a=object(value);for(const key of ['execute','arguments','workingDirectory']){if(typeof a[key]!=='string'||!a[key])reject();}return a;}
function pin(value){const p=object(value);for(const key of ['packageRoot','sourceCommit','manifestSha256']){if(typeof p[key]!=='string'||!p[key])reject();}if(!/^[a-f0-9]{40}$/.test(p.sourceCommit)||!SHA.test(p.manifestSha256))reject();return p;}

/**
 * Validate two captured NEW scheduled-task instances against an explicit before image.
 * All observations are plain serializable records from an external trusted collector.
 * A true result is CONDITIONAL_CONSISTENCY only, never OS/Apply/physical proof.
 */
export function assertP03CandidateTaskProof(input){
 const x=object(input),beforeImage=object(x.beforeImage),expected=object(x.expected),observed=object(x.observed);
 const before=time(beforeImage.capturedAt),captured=time(observed.capturedAt);
 if(captured<=before||observed.runningTaskCollection!=='Schedule.Service.GetRunningTasks(1)')reject();
 if(!SID.test(expected.ownerSid)||!Array.isArray(expected.tasks)||expected.tasks.length!==2)reject();
 if(!Array.isArray(beforeImage.oldWatchers)||beforeImage.oldWatchers.length!==2)reject();
 const oldByName=new Map(),oldPids=new Set();
 for(const watcher of beforeImage.oldWatchers){
  object(watcher);
  if(!Object.hasOwn(TASKS,watcher.name)||oldByName.has(watcher.name))reject();
  pid(watcher.pid);if(oldPids.has(watcher.pid)||time(watcher.creationTime)>before)reject();
  oldByName.set(watcher.name,watcher);oldPids.add(watcher.pid);
 }
 if(oldByName.size!==Object.keys(TASKS).length)reject();
 // The external collector must enumerate every process whose command matches
 // either P03 watcher script, not merely look up the two COM engine PIDs.
 if(observed.processInventoryScope!=='CIM.Win32_Process.AllP03WatcherCommands')reject();
 if(!Array.isArray(observed.runningTasks)||!Array.isArray(observed.registeredTasks)||!Array.isArray(observed.processes)||observed.processes.length!==2)reject();
 const service=object(observed.scheduleService),serviceProcess=object(observed.scheduleServiceProcess);
 exact(service.name,'Schedule');exact(service.state,'Running');exact(service.startName,'LocalSystem');pid(service.processId);
 if(service.processId!==serviceProcess.processId)reject();
 exact(expected.scheduleServiceExecutablePath,'C:\\Windows\\System32\\svchost.exe');
 exact(serviceProcess.executablePath,expected.scheduleServiceExecutablePath);
 exact(serviceProcess.commandLine,expected.scheduleServiceCommandLine);
 const ownerResult=object(serviceProcess.ownerResult);
 if(ownerResult.code===0){exact(ownerResult.sid,'S-1-5-18');}
 else if(ownerResult.code===2){if(ownerResult.sid!==null||ownerResult.marker!=='UNAVAILABLE_ACCESS_DENIED')reject();}
 else reject();
 if(time(serviceProcess.creationTime)>before)reject();
 const keys=new Set(),enginePids=new Set(),instanceGuids=new Set();
 for(const e of expected.tasks){
  const key=taskKey(e),ea=action(e.action),ep=pin(e.supervisorPin);
  if(keys.has(key))reject();keys.add(key);sha(e.settingsSha256);pid(e.oldEnginePid);
  if(typeof e.currentAction!=='string'||!e.currentAction)reject();
  if(typeof e.watcherExecutablePath!=='string'||!e.watcherExecutablePath||typeof e.watcherCommandLine!=='string'||!e.watcherCommandLine)reject();
  if(typeof e.name!=='string'||!e.name.startsWith('Melisa-'))reject();
  if(!Object.hasOwn(TASKS,e.name))reject();
  if(e.oldEnginePid!==oldByName.get(e.name)?.pid)reject();
  const script=SUPERVISOR_ROOT+'\\scripts\\canonical\\'+TASKS[e.name].script;
  exact(e.currentAction,SHELL);exact(e.watcherExecutablePath,SHELL);
  exact(e.watcherCommandLine,`"${SHELL}" ${ea.arguments}`);
  exact(ea.execute,SHELL);exact(ea.workingDirectory,SUPERVISOR_ROOT);
  exact(ea.arguments,`-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "${script}" -StartupConfigPath "${SETTINGS}" -StartupConfigSha256 ${SETTINGS_SHA}`);
  exact(e.settingsSha256,SETTINGS_SHA);
  for(const field of ['packageRoot','sourceCommit','manifestSha256'])exact(ep[field],PIN[field]);
  const runs=observed.runningTasks.filter(r=>object(r).path===key),regs=observed.registeredTasks.filter(r=>object(r).path===key);
  if(runs.length!==1||regs.length!==1)reject();
  const run=runs[0],reg=regs[0];
  exact(run.name,e.name);exact(run.currentAction,e.currentAction);
  if(run.state!==4||reg.state!==4)reject(); // TASK_STATE_RUNNING
  pid(run.enginePID);const instance=guid(run.instanceGuid);
  if(oldPids.has(run.enginePID)||enginePids.has(run.enginePID)||instanceGuids.has(instance))reject();
  enginePids.add(run.enginePID);instanceGuids.add(instance);
  exact(reg.name,e.name);exact(reg.path,key);exact(reg.ownerSid,expected.ownerSid);
  const ra=action(reg.action);for(const field of ['execute','arguments','workingDirectory'])exact(ra[field],ea[field]);
  exact(reg.settingsSha256,e.settingsSha256);const rp=pin(reg.supervisorPin);
  for(const field of ['packageRoot','sourceCommit','manifestSha256'])exact(rp[field],ep[field]);
  const last=time(reg.taskInfoLastRunTime);
  const matches=observed.processes.filter(p=>object(p).processId===run.enginePID);
  if(matches.length!==1)reject();const process=matches[0],birth=time(process.creationTime);
  if(birth<=before||birth>captured||last<=before||last>captured||last>birth)reject();
  exact(process.ownerSid,expected.ownerSid);
  exact(process.executablePath,e.watcherExecutablePath);
  exact(process.commandLine,e.watcherCommandLine);
  if(process.parentProcessId!==service.processId)reject();
 }
 if(oldPids.size!==2||[...enginePids].some(id=>oldPids.has(id)))reject();
 const inventoryPids=new Set(observed.processes.map(p=>pid(object(p).processId)));
 if(inventoryPids.size!==2||[...inventoryPids].some(id=>!enginePids.has(id)))reject();
 // A foreign running task with a target name/path, or a duplicate process ID,
 // would make the two-instance claim ambiguous.
 for(const run of observed.runningTasks){
  object(run);if(keys.has(run.path)&&!enginePids.has(run.enginePID))reject();
 }
 return Object.freeze({status:'CONDITIONAL_CONSISTENCY',taskCount:2,enginePids:[...enginePids],instanceGuids:[...instanceGuids]});
}
