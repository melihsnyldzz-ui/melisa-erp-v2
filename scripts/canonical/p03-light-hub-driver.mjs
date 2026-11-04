import fs from 'node:fs';import path from 'node:path';import {spawn,spawnSync} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {HUB_CSP} from '../../apps/api/src/services/melisaHubReadiness.mjs';
import {buildLightHubRehearsal,lightSha,lightNoReparse} from './p03-light-hub-builder.mjs';
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const need=(v,c)=>{if(!v)throw Error('P03_LIGHT_'+c);};
// Import only the six existing protected CreateNew/fsync functions. No task,
// SQL, clone or top-level rehearsal dispatcher runs during publication.
export function publishLightFiles(plan,files,initial=false){
 lightNoReparse(plan.stagingHelper.path);need(lightSha(fs.readFileSync(plan.stagingHelper.path))===plan.stagingHelper.sha256,'STAGING_HELPER_PIN');
 const command=String.raw`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
$r=[Console]::In.ReadToEnd()|ConvertFrom-Json
if($r.root-cnotmatch'\AC:\\Sirket\\ERP\\rehearsal\\ERP-LIGHT-REHEARSAL-20261019-1253\\run-[a-f0-9]{32}\z'){throw 'P03_LIGHT_PUBLICATION_ROOT'}
if((Get-FileHash -LiteralPath $r.helper.path -Algorithm SHA256).Hash.ToLowerInvariant()-cne$r.helper.sha256){throw 'P03_LIGHT_HELPER_HASH'}
$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($r.helper.path,[ref]$t,[ref]$e);if($e.Count){throw 'P03_LIGHT_HELPER_PARSE'}
$wanted=@('Need','Hash','NoReparse','FileSecurity','DirectoryNew','WriteNew');$defs=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-in$wanted},$false));if($defs.Count-ne6){throw 'P03_LIGHT_HELPER_FUNCTIONS'}
foreach($d in $defs){. ([scriptblock]::Create($d.Extent.Text))}
$owner='S-1-5-21-2170750028-1005938530-2568122015-1001';if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value-cne$owner){throw 'P03_LIGHT_OWNER'}
$base='C:\Sirket\ERP\rehearsal\ERP-LIGHT-REHEARSAL-20261019-1253';NoReparse $base
if($r.initial){if(Test-Path -LiteralPath $r.root){throw 'P03_LIGHT_EXISTS'};if(-not(Test-Path -LiteralPath $base)){DirectoryNew $base};DirectoryNew $r.root}
foreach($f in $r.files){$p=[IO.Path]::GetFullPath((Join-Path $r.root $f.relative));if(-not$p.StartsWith($r.root+'\',[StringComparison]::Ordinal)-or$f.relative-match'\.\.|:'){throw 'P03_LIGHT_PUBLICATION_ESCAPE'}
$dirs=@();for($q=[IO.Path]::GetDirectoryName($p);$q-cne$r.root;$q=[IO.Path]::GetDirectoryName($q)){$dirs+=,$q};[array]::Reverse($dirs);foreach($d in $dirs){if(-not(Test-Path -LiteralPath $d)){DirectoryNew $d}}
[void](WriteNew $p ([Convert]::FromBase64String($f.base64)))}
'P03_LIGHT_PUBLISHED'`;
 const wire={root:plan.runRoot,helper:plan.stagingHelper,initial,files:files.map(f=>({relative:f.relative,base64:Buffer.from(f.data).toString('base64')}))};
 const run=spawnSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{input:JSON.stringify(wire),encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:65536});
 need(run.status===0&&run.stdout.trim()==='P03_LIGHT_PUBLISHED','PUBLICATION');
}
function portFree(){const r=spawnSync(shell,['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';if(@(Get-NetTCPConnection -State Listen -LocalPort 5354 -ErrorAction SilentlyContinue).Count){exit 1};'FREE'"],{windowsHide:true,encoding:'utf8',timeout:10000});need(r.status===0&&r.stdout.trim()==='FREE','PORT_OWNED');}
export async function closeLightChild(child){
 if(child.exitCode!==null){need(child.exitCode===0,'CHILD_EXIT');return;}
 const done=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('P03_LIGHT_CLEANUP_UNCONFIRMED')),25000);child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('P03_LIGHT_CHILD_FAILED'));});});
 child.stdin.end('P03_LIGHT_CLOSE\n');await done;
}
function start(plan,artifact){
 portFree();const starter=path.join(plan.runRoot,'start-hub-web.ps1');need(lightSha(fs.readFileSync(starter))===plan.commonStarterSha256,'COMMON_STARTER_PIN');
 const child=spawn(shell,['-NoProfile','-NonInteractive','-File',starter,'-StartupConfigPath',artifact.startupPath,'-Action','Start','-LightRehearsal'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 const diagnostic={stderr:'',truncated:false};child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>{const left=65536-Buffer.byteLength(diagnostic.stderr);if(left<=0){diagnostic.truncated=true;return;}const bytes=Buffer.from(chunk);diagnostic.stderr+=bytes.subarray(0,left).toString('utf8');if(bytes.length>left)diagnostic.truncated=true;});const closed=new Promise(resolve=>child.once('close',resolve));
 const ready=new Promise((resolve,reject)=>{let data='';const timer=setTimeout(()=>reject(Error('P03_LIGHT_LAUNCH_TIMEOUT')),20000);child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{data+=chunk;if(data.length>16384){clearTimeout(timer);reject(Error('P03_LIGHT_OUTPUT_SIZE'));return;}if(data.includes('\n')){clearTimeout(timer);try{const row=JSON.parse(data.trim());need(row.event==='P03_LIGHT_READY'&&row.applicationSource===artifact.applicationSource&&row.launcherSource===artifact.launcherSource&&row.generation===artifact.generation&&row.sqlFree===true&&row.dailyFlowReady===false&&row.identity.pid===row.pid&&row.identity.parentPid===child.pid,'READY_BINDING');resolve(row);}catch{reject(Error('P03_LIGHT_READY_BINDING'));}}});child.once('error',()=>{clearTimeout(timer);reject(Error('P03_LIGHT_LAUNCH'));});child.once('exit',()=>{clearTimeout(timer);reject(Error('P03_LIGHT_EARLY_EXIT'));});});
 return {child,ready,diagnostic,closed};
}
// Undici may replace a caller-supplied Host header. This one negative probe
// uses HTTP/1 directly, with no URL/destination/body or redirect selector.
export function readLightForeignHostStatus(requestImpl=httpRequest){
 return new Promise((resolve,reject)=>{
  let req,finished=false;
  const finish=(error,status)=>{if(finished)return;finished=true;clearTimeout(deadline);if(error){req?.destroy();reject(error);}else resolve(status);};
  const deadline=setTimeout(()=>finish(Error('P03_LIGHT_HOST_PROBE_TIMEOUT')),3000);
  try{
   req=requestImpl({protocol:'http:',hostname:'127.0.0.1',port:5354,path:'/melisa-hub/',method:'GET',headers:{Host:'foreign:5354',Connection:'close'},agent:false,maxHeaderSize:8192},response=>{
    let size=0;
    response.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size>4096)finish(Error('P03_LIGHT_HOST_PROBE_SIZE'));});
    response.on('end',()=>{if(!Number.isInteger(response.statusCode)||response.statusCode<100||response.statusCode>599)finish(Error('P03_LIGHT_HOST_PROBE_STATUS'));else finish(null,response.statusCode);});
    response.on('error',()=>finish(Error('P03_LIGHT_HOST_PROBE_RESPONSE')));
    response.on('aborted',()=>finish(Error('P03_LIGHT_HOST_PROBE_RESPONSE')));
   });
   req.on('error',()=>finish(Error('P03_LIGHT_HOST_PROBE_REQUEST')));
   req.setTimeout(3000,()=>finish(Error('P03_LIGHT_HOST_PROBE_TIMEOUT')));
   req.end();
  }catch{finish(Error('P03_LIGHT_HOST_PROBE_REQUEST'));}
 });
}
async function checkHttp(plan,artifact){
 const get=async(url,init={})=>fetch('http://127.0.0.1:5354'+url,{...init,redirect:'manual',signal:AbortSignal.timeout(3000)});
 const health=await get('/test-health');need(health.status===200,'HEALTH');const h=await health.json();need(h.environment==='P03_LIGHT_REHEARSAL'&&h.sqlFree===true&&h.applicationSource===artifact.applicationSource&&h.launcherSource===artifact.launcherSource&&h.dailyFlowReady===false,'HEALTH_IDENTITY');
 const html=await get('/melisa-hub/'),raw=Buffer.from(await html.arrayBuffer());const source=plan.outputs.find(f=>f.relative.startsWith(artifact.generation+'/')&&f.relative.endsWith('/web/melisa-hub/index.html'));need(html.status===200&&lightSha(raw)===lightSha(source.data),'REAL_HTML');
 for(const name of ['hub.css','hub.mjs','catalog.mjs']){const response=await get('/melisa-hub/'+name),content=Buffer.from(await response.arrayBuffer()),pin=plan.outputs.find(f=>f.relative.startsWith(artifact.generation+'/')&&f.relative.endsWith('/web/melisa-hub/'+name));need(response.status===200&&lightSha(content)===lightSha(pin.data),'REAL_STATIC');}
 need(html.headers.get('content-security-policy')===HUB_CSP&&html.headers.get('x-content-type-options')==='nosniff'&&html.headers.get('cache-control')==='no-store','RESPONSE_POLICY');
 need((await get('/melisa-hub/',{method:'HEAD'})).status===200,'HEAD');need((await readLightForeignHostStatus())===403,'HOST_DENIED');need((await get('/melisa-hub/',{headers:{origin:'http://foreign:5354'}})).status===403,'ORIGIN_DENIED');
 const status=await get('/melisa-hub/status.json'),s=await status.json();need(status.status===200&&Object.values(s.services).every(v=>v.state==='unknown'),'NO_FALSE_READINESS');
 const config=await get('/melisa-hub/config.json'),c=await config.json();need(config.status===200&&!c.erp.enabled&&!c.crm.enabled&&!c.test125.enabled&&!c.live.enabled,'NO_CAPABILITIES');
 need((await get('/melisa-hub/status.json',{method:'POST'})).status===405,'POST_DENIED');need((await get('/melisa-hub/status.json',{headers:{'x-forwarded-for':'127.0.0.1'}})).status===403,'FORWARDED_DENIED');
 need((await get('/__p03-light/synthetic/products')).status===403,'SYNTHETIC_ROLE_DENIED');
 for(const [kind,count] of [['customers',1],['suppliers',1],['products',2]]){const r=await get('/__p03-light/synthetic/'+kind,{headers:{'x-p03-role':'reader'}});const body=await r.json();need(r.status===200&&body.synthetic===true&&body.rows.length===count,'SYNTHETIC_READ');}
 return {htmlSha256:lightSha(raw),readChecks:17,normalActorVerified:false};
}
export async function runLightHubRehearsal(request){
 need(process.platform==='win32','PLATFORM');const plan=buildLightHubRehearsal(request);portFree();publishLightFiles(plan,plan.outputs,true);
 let active=null;const runs=[],attempts=[];let failure=null,cleanupConfirmed=false;
 try{for(const generation of ['old','new','old']){const artifact=plan.artifacts.find(a=>a.generation===generation);active=start(plan,artifact);const attempt={generation,launcherPid:active.child.pid,diagnostic:active.diagnostic,startupVerified:false,httpVerified:false};attempts.push(attempt);const ready=await active.ready;attempt.ready={identity:ready.identity,applicationSource:ready.applicationSource,launcherSource:ready.launcherSource,generation:ready.generation};attempt.startupVerified=true;const http=await checkHttp(plan,artifact);attempt.httpVerified=true;runs.push({generation,applicationSource:artifact.applicationSource,launcherSource:artifact.launcherSource,identity:ready.identity,...http});await closeLightChild(active.child);await active.closed;active=null;portFree();}cleanupConfirmed=true;}catch(error){failure=/^P03_LIGHT_[A-Z_]+$/.test(error?.message)?error.message:'P03_LIGHT_UNCLASSIFIED';if(active){try{await closeLightChild(active.child);await active.closed;active=null;portFree();cleanupConfirmed=true;}catch{cleanupConfirmed=false;}}}
 const proof={schemaVersion:'melisa-p03-light-hub-proof.v1',completed:failure===null,failedCode:failure,reportedCodes:attempts.flatMap(a=>a.diagnostic.stderr.match(/\b(?:P03_LIGHT_|HUB_)[A-Z_]{1,80}\b/g)??[]).slice(-16),attempts,runs,cleanupConfirmed,sqlFree:true,sqlCalls:0,sharedFullLaunchTested:false,sharedRuntimeChanged:false,normalActorVerified:false,dailyFlowReady:false,humanAcceptance:false,launcherSource:plan.launcherSource,dependencies:plan.dependencies,observedAt:new Date().toISOString()};
 publishLightFiles(plan,[{relative:'proof.json',data:Buffer.from(JSON.stringify(proof))}]);need(proof.completed&&cleanupConfirmed,'REHEARSAL_FAILED_RETAIN_ARTIFACTS');return {status:'LIGHT_HUB_OLD_NEW_OLD_VERIFIED',proofPath:path.win32.join(plan.runRoot,'proof.json'),runs:runs.length,sqlCalls:0,sharedRuntimeChanged:false,normalActorVerified:false,dailyFlowReady:false};
}
