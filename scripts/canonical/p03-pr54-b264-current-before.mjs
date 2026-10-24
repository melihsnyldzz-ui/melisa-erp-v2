// Preliminary read-only observation for today's Windows/SQL lifetime.
// This is not physical admission, a claim, or transition authority.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {nativeArgumentTokens} from './hub-stack-driver.mjs';
import {PR54_B264_REFS} from './p03-pr54-owner-successor.mjs';
import {deriveP03CandidateRules,P03_SQL_SERVICE_CAPTURE_PS,validateP03ProtectedSqlService} from './p03-physical-profile-create.mjs';
const owner='S-1-5-21-2170750028-1005938530-2568122015-1001';
const database='MELISA_ERP_CRM_SHARED_TEST_20261009_02',copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
const oldRef=Object.freeze({path:String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-e59e07abf7ae.json`,sha256:'ad3f93b3ecc5d7bf8b542661c6e70c43e650f5b3614e9c76739faa2eb609b071'});
const hash=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const need=(v,c)=>{if(!v)throw Error('P03_B264_BEFORE_'+c);};
const names=['Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web'];
const roles=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','coreSupervisor'];
function read(ref){const s=fs.lstatSync(ref.path);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=16777216,'FILE');const b=fs.readFileSync(ref.path);need(hash(b)===ref.sha256,'PIN');return b;}
function executeReadOnly(code){return new Promise((resolve,reject)=>{
 const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
 const child=execFile(shell,['-NoProfile','-NonInteractive','-Command','& ([scriptblock]::Create([Console]::In.ReadToEnd()))'],{windowsHide:true,timeout:180000,maxBuffer:8*1024*1024,env:{...process.env,PSModulePath:String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\Modules`}},(error,stdout,stderr)=>{
  if(error||stderr){const safe=[...String(stderr??'').matchAll(/\bP03_[A-Z0-9_]{1,100}\b/g)].at(-1)?.[0];reject(Error(safe??(error?.killed?'P03_B264_BEFORE_TIMEOUT':'P03_B264_BEFORE_EXEC_FAILED')));}else resolve({stdout,stderr});
 });child.stdin.on('error',()=>{});child.stdin.end(code);
});}
export function validatePr54B264CurrentBeforeFrames(first,last,settings,now=Date.now()){
 need(settings?.ownerSid===owner&&settings.database===database&&settings.copyId===copyId&&settings.actualT1===false,'SCOPE');
 const expected=deriveP03CandidateRules(settings,oldRef);
 for(const f of [first,last]){
  need(f?.schemaVersion==='melisa-p03-b264-preliminary-owner-frame.v1'&&f.transitionAuthority===false&&Number.isFinite(Date.parse(f.observedAt))&&now-Date.parse(f.observedAt)>=0&&now-Date.parse(f.observedAt)<60000,'FRAME');
  need(Array.isArray(f.processes)&&f.processes.length===10&&new Set(f.processes.map(p=>p.role)).size===10&&new Set(f.processes.map(p=>p.pid)).size===10,'ROLES');
  for(const r of expected){const p=f.processes.find(p=>p.role===r.role);need(p&&p.ownerSid===owner&&p.nodePath===r.nodePath&&same(nativeArgumentTokens(p.commandLine),nativeArgumentTokens(r.commandLine))&&Number.isSafeInteger(p.pid)&&p.pid>0&&Number.isSafeInteger(p.parentPid)&&Number.isFinite(Date.parse(p.creationTime))&&Date.parse(p.creationTime)<=Date.parse(f.observedAt)&&Array.isArray(p.bindings),'IDENTITY');}
  need(f.tasks?.length===2&&f.instances?.length===2&&names.every((name,n)=>{const t=f.tasks.find(t=>t.name===name),i=f.instances.filter(i=>i.name===name),w=f.processes.find(p=>p.role===(n?'hubWatcher':'terminalWatcher'));return t?.state==='Running'&&typeof t.xml==='string'&&t.xml.length>0&&i.length===1&&i[0].enginePid===w.pid&&i[0].state===4&&i[0].path==='\\'+name&&typeof i[0].instanceGuid==='string'&&i[0].instanceGuid.length>0;}),'TASKS');
  need(f.protectedProcesses?.length>0&&f.protectedProcesses.filter(p=>p.kind==='ProtectedSqlService').length===1,'PROTECTED');
  for(const p of f.protectedProcesses)if(p.kind==='ProtectedSqlService')validateP03ProtectedSqlService(p);
  const core=f.processes.find(p=>p.role==='coreSupervisor'),watcher=f.processes.find(p=>p.role==='terminalWatcher');
  need(core.parentPid===watcher.pid&&Date.parse(core.creationTime)>=Date.parse(watcher.creationTime),'CORE_PARENT');
  for(const p of f.processes.filter(p=>!p.role.endsWith('Watcher')&&!['hub','coreSupervisor'].includes(p.role)))need(p.parentPid===core.pid&&p.parentCreationTime===core.creationTime&&Date.parse(p.creationTime)>=Date.parse(core.creationTime),'CHILD_PARENT');
 }
 need(Date.parse(last.observedAt)>=Date.parse(first.observedAt),'ORDER');
 for(const key of ['processes','tasks','instances','protectedProcesses'])need(same(first[key],last[key]),'DRIFT');
 const identities=Object.fromEntries(roles.map(role=>[role,last.processes.find(p=>p.role===role)]));
 return {oldSettings:settings,oldObservation:{schemaVersion:'melisa-p03-owner-observation.v2',startedAt:first.observedAt,observedAt:last.observedAt,hubLineage:identities.hub.parentCreationTime===null?'WATCHER_RUNNING_PARENT_EXITED_UNPROVEN':'CAPTURED_OS_PARENT',ownerSid:owner,database,copyId,actualT1:false,oldConfig:oldRef,oldSupervisor:{root:settings.supervisor.packageRoot,manifest:settings.supervisor.manifestSha256},identities,tasks:last.tasks},extras:{observedAt:last.observedAt,tasks:last.tasks,oldWatchers:last.processes.filter(p=>p.role.endsWith('Watcher')),protectedProcesses:last.protectedProcesses},sourceProof:{schemaVersion:'melisa-p03-b264-preliminary-owner-proof.v1',firstObservedAt:first.observedAt,observedAt:last.observedAt,engineRef:PR54_B264_REFS.engine,transitionAuthority:false,physicalAdmissionRequired:true,claimCreated:false,applyExecuted:false}};
}
// Source is held and hash/ACL checked in PowerShell before importing only
// function definitions. The frozen engine dispatcher is never invoked.
export function pr54B264CurrentBeforeProgram(settings){
 const rules=deriveP03CandidateRules(settings,oldRef),payload=Buffer.from(JSON.stringify({engine:PR54_B264_REFS.engine,settings:oldRef,rules})).toString('base64');
 return String.raw`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
$env:PSModulePath=Join-Path $PSHOME 'Modules';foreach($n in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$n+'\'+$n+'.psd1')) -ErrorAction Stop}
$owner='${owner}';if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value-cne$owner){throw 'P03_B264_BEFORE_OWNER'}
$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json
for($p=$v.engine.path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'P03_B264_BEFORE_REPARSE'}}
$a=Get-Acl -LiteralPath $v.engine.path;$aces=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));if(-not$a.AreAccessRulesProtected-or$a.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne$owner-or$aces.Count-ne2){throw 'P03_B264_BEFORE_ACL'}
foreach($sid in @($owner,'S-1-5-18')){if(@($aces|Where-Object{$_.IdentityReference.Value-ceq$sid-and-not$_.IsInherited-and$_.AccessControlType-eq'Allow'-and$_.FileSystemRights-eq'FullControl'}).Count-ne1){throw 'P03_B264_BEFORE_ACL'}}
$held=[IO.File]::Open($v.engine.path,'Open','Read','Read')
try{
 $m=[IO.MemoryStream]::new();$held.CopyTo($m);$b=$m.ToArray();$h=[BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($b)).Replace('-','').ToLowerInvariant();if($h-cne$v.engine.sha256){throw 'P03_B264_BEFORE_ENGINE'}
 $t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseInput([Text.UTF8Encoding]::new($false,$true).GetString($b),[ref]$t,[ref]$e);if($e.Count){throw 'P03_B264_BEFORE_PARSE'}
 foreach($n in @('Need','NoReparse','Protected','ReadPinned','Json','Hash','Tokens')){$d=@($ast.FindAll({param($x)$x-is[Management.Automation.Language.FunctionDefinitionAst]-and$x.Name-ceq$n},$false));if($d.Count-ne1){throw 'P03_B264_BEFORE_FUNCTION'};. ([scriptblock]::Create($d[0].Extent.Text))}
 [void](ReadPinned $v.settings.path $v.settings.sha256)
 ${P03_SQL_SERVICE_CAPTURE_PS}
 function Frame{
  [void](ReadPinned $v.settings.path $v.settings.sha256)
  $all=@(Get-CimInstance Win32_Process -ErrorAction Stop);$listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop);$selected=@()
  foreach($r in $v.rules){$matches=@($all|Where-Object{$_.ExecutablePath-ceq$r.nodePath-and((Tokens $_.CommandLine)|ConvertTo-Json -Compress)-ceq((Tokens $r.commandLine)|ConvertTo-Json -Compress)})
   Need ($matches.Count-eq1) 'B264_CURRENT_ROLE';$p=$matches[0];$o=Invoke-CimMethod $p -MethodName GetOwnerSid -ErrorAction Stop;Need ($o.ReturnValue-eq0-and$o.Sid-ceq$owner) 'B264_CURRENT_OWNER'
   $parent=@($all|Where-Object{$_.ProcessId-eq$p.ParentProcessId});$parentBirth=$null;if($parent.Count-eq1){$parentBirth=$parent[0].CreationDate.ToUniversalTime().ToString('o')}else{Need ($r.role-ceq'hub') 'B264_CURRENT_PARENT'}
   $selected+=,[ordered]@{role=$r.role;pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;nodePath=[string]$p.ExecutablePath;ownerSid=$owner;commandLine=[string]$p.CommandLine;creationTime=$p.CreationDate.ToUniversalTime().ToString('o');parentCreationTime=$parentBirth;bindings=@($listeners|Where-Object{$_.OwningProcess-eq$p.ProcessId}|Sort-Object LocalPort,LocalAddress|ForEach-Object{[ordered]@{port=[int]$_.LocalPort;address=[string]$_.LocalAddress}})}
  }
  $s=New-Object -ComObject Schedule.Service;$s.Connect();$f=$s.GetFolder('\');$running=$s.GetRunningTasks(1);$tasks=@();$instances=@()
  foreach($name in @('Melisa-Terminal-Completion-Logon','Melisa-Hub-TEST-Web')){$task=$f.GetTask($name);Need ([int]$task.State-eq4) 'B264_CURRENT_TASK';$tasks+=,[ordered]@{name=$name;state='Running';xml=[string]$task.Xml};for($i=1;$i-le$running.Count;$i++){$x=$running.Item($i);if($x.Name-ceq$name){$instances+=,[ordered]@{name=$name;enginePid=[int]$x.EnginePID;instanceGuid=[string]$x.InstanceGuid;state=[int]$x.State;path=[string]$x.Path}}}}
  $protected=@();$ids=@($listeners|Where-Object{$_.LocalPort-in@(4144,4146,5194)}|ForEach-Object{$_.OwningProcess})+@($all|Where-Object{$_.Name-ceq'sqlservr.exe'}|ForEach-Object{$_.ProcessId})
  foreach($id in @($ids|Sort-Object -Unique)){$p=@($all|Where-Object{$_.ProcessId-eq$id});Need ($p.Count-eq1) 'B264_CURRENT_PROTECTED';if($p[0].Name-ceq'sqlservr.exe'){$protected+=,(Get-P03ProtectedSqlService $p[0])}else{$o=Invoke-CimMethod $p[0] -MethodName GetOwnerSid -ErrorAction Stop;Need ($o.ReturnValue-eq0) 'B264_CURRENT_PROTECTED_OWNER';$protected+=,[ordered]@{name=$p[0].Name;pid=[int]$p[0].ProcessId;parentPid=[int]$p[0].ParentProcessId;nodePath=[string]$p[0].ExecutablePath;ownerSid=[string]$o.Sid;commandLine=[string]$p[0].CommandLine;creationTime=$p[0].CreationDate.ToUniversalTime().ToString('o');bindings=@()}}}
  return [ordered]@{schemaVersion='melisa-p03-b264-preliminary-owner-frame.v1';observedAt=[DateTime]::UtcNow.ToString('o');processes=$selected;tasks=$tasks;instances=$instances;protectedProcesses=$protected;transitionAuthority=$false}
 }
 $first=Frame;$last=Frame;[ordered]@{first=$first;last=$last}|ConvertTo-Json -Depth 20 -Compress
}finally{$held.Dispose()}`;
}
export async function capturePr54B264CurrentOwner(...args){
 need(args.length===0&&process.platform==='win32','MODE');const raw=read(oldRef),settings=JSON.parse(raw);read(PR54_B264_REFS.engine);
 const result=await executeReadOnly(pr54B264CurrentBeforeProgram(settings));
 need(!result.stderr,'STDERR');
 need(read(oldRef).equals(raw),'SETTINGS_CHANGED');const {first,last}=JSON.parse(result.stdout);
 return validatePr54B264CurrentBeforeFrames(first,last,settings);
}
