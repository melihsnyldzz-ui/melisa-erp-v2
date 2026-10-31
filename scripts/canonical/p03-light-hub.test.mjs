import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {EventEmitter} from 'node:events';
import {validateLightPackageManifest,LIGHT_NEW,LIGHT_OLD} from './p03-light-hub-builder.mjs';import {closeLightChild,readLightForeignHostStatus} from './p03-light-hub-driver.mjs';import {parseP03RehearsalMode} from './p03-rehearsal-harness.mjs';
const root=new URL('./',import.meta.url),read=n=>fs.readFileSync(new URL(n,root),'utf8'),shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const ps=code=>{const r=spawnSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$text=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($text))','utf16le').toString('base64')],{input:"$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest\n"+code,encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(r.status,0,r.stderr);return r.stdout;};
function manifest(){return {schemaVersion:'melisa-p03-light-hub-package.v1',environment:'P03_LIGHT_REHEARSAL',sourceCommit:LIGHT_NEW.source,launcherSource:'b'.repeat(40),generation:'new',sqlFree:true,port:5354,actualT1:false,childConfigSha256:'c'.repeat(64),files:['app/melisaHubReadiness.mjs','launcher/sharedCopyWebApplication.mjs','launcher/start-hub-light-rehearsal.ps1','launcher/p03-light-hub-child.mjs',...['index.html','hub.css','hub.mjs','catalog.mjs'].map(n=>'web/melisa-hub/'+n)].map(path=>({path,sha256:'d'.repeat(64)}))};}
test('finite Light mode is explicit; old harness modes and closed package profiles remain separate',()=>{assert.equal(parseP03RehearsalMode([]),'DryRun');assert.equal(parseP03RehearsalMode(['--Run']),'Run');assert.equal(parseP03RehearsalMode(['--LightHubRun']),'LightHubRun');assert.throws(()=>parseP03RehearsalMode(['--LightHubRun','--port','5234']));assert.equal(validateLightPackageManifest(manifest()),true);for(const mutate of [m=>m.port=5234,m=>m.environment='ISOLATED_TEST_COPY',m=>m.sharedTestCopy={},m=>m.actualT1=true,m=>m.files.pop(),m=>m.files.push(m.files[0]),m=>m.sourceCommit=LIGHT_OLD.source]){const m=manifest();mutate(m);assert.throws(()=>validateLightPackageManifest(m));}});
test('actual common PowerShell manifest gate accepts canonical Light shape but denies Shared/cross-source/extra fields',{skip:process.platform!=='win32'},()=>{const s=read('start-hub-web.ps1'),a=s.indexOf("if($LightRehearsal){if((@($m."),b=s.indexOf('foreach($file in $m.files)',a);assert.ok(a>0&&b>a);const encoded=Buffer.from(JSON.stringify(manifest())).toString('base64');const out=ps(`$base=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json
function Get-FileHash{param($LiteralPath,$Algorithm) [pscustomobject]@{Hash=('c'*64)}}
$LightRehearsal=$true;$c=[pscustomobject]@{SourceCommit='${LIGHT_NEW.source}';OperationConfigPath='unused'}
$m=$base
${s.slice(a,b)}
'LIGHT_ACCEPTED'
$m|Add-Member NoteProperty sharedTestCopy @{};try{${s.slice(a,b)};throw 'SHOULD_REJECT'}catch{if($_.Exception.Message-cne'HUB_LIGHT_RELEASE_SCOPE_REJECTED'){throw};'CROSS_REJECTED'}
`);assert.match(out,/LIGHT_ACCEPTED/);assert.match(out,/CROSS_REJECTED/);assert.match(s,/LightRehearsal-and\(\$Watch-or\$PSBoundParameters/);});
test('actual Light child ownership finally closes on timeout, malformed readiness, identity drift and foreign binding without PID kill',{skip:process.platform!=='win32'},()=>{const file=new URL('./start-hub-light-rehearsal.ps1',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1').replaceAll("'","''");assert.doesNotMatch(read('start-hub-light-rehearsal.ps1'),/\.Kill\(|Stop-Process|Stop-ScheduledTask/);const out=ps(`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'}
foreach($d in @($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-in@('Need-Light','Invoke-LightOwnedChild')},$false))){. ([scriptblock]::Create($d.Extent.Text))}
function Read-LightCloseCommand{return 'P03_LIGHT_CLOSE'}
function Get-CimInstance{param($ClassName,$Filter) return [pscustomobject]@{ParentProcessId=$(if($script:mode-ceq'identity'){999}else{$PID});ExecutablePath='C:\\fixture\\node.exe';CommandLine='"C:\\fixture\\node.exe" fixed';CreationDate=$script:birth}}
function Invoke-CimMethod{param($InputObject,$MethodName) return [pscustomobject]@{ReturnValue=0;Sid='fixture-owner'}}
function Get-NetTCPConnection{param($State,$LocalPort) return [pscustomobject]@{OwningProcess=$(if($script:mode-ceq'binding'){999}else{1234});LocalAddress='127.0.0.1'}}
function Start-LightOwnedChild($psi){return $script:child}
foreach($mode in @('valid','timeout','malformed','identity','binding')){
 $script:mode=$mode;$script:closed=0;$script:birth=[DateTime]::UtcNow
 $ready=[ordered]@{event='P03_LIGHT_READY';pid=1234;port=5354;applicationSource='source';environment='P03_LIGHT_REHEARSAL'}|ConvertTo-Json -Compress
 $task=[pscustomobject]@{Result=$(if($mode-ceq'malformed'){'not-json'}else{$ready})};$task|Add-Member ScriptMethod Wait {param($ms) return $script:mode-cne'timeout'}
 $stdout=[pscustomobject]@{Task=$task};$stdout|Add-Member ScriptMethod ReadLineAsync {return $this.Task}
 $stdin=[pscustomobject]@{};$stdin|Add-Member ScriptMethod Write {param($text) if($text-cne('P03_LIGHT_CLOSE'+[char]10)){throw 'CLOSE_LITERAL'}};$stdin|Add-Member ScriptMethod Close {$script:closed++;$script:child.HasExited=$true}
 $script:child=[pscustomobject]@{Id=1234;HasExited=$false;StartTime=$birth;ExitCode=0;StandardOutput=$stdout;StandardInput=$stdin};$child|Add-Member ScriptMethod WaitForExit {param($ms) return $this.HasExited};$child|Add-Member ScriptMethod Dispose {}
 $psi=[pscustomobject]@{Arguments='fixed'};$c=[pscustomobject]@{SourceCommit='source';NodePath='C:\\fixture\\node.exe';OwnerSid='fixture-owner';NodeSha256='pin'}
 $failed=$false;try{Invoke-LightOwnedChild $psi $c|Out-Null}catch{$failed=$true}
 if($closed-ne1-or-not$child.HasExited-or($mode-ceq'valid'-and$failed)-or($mode-cne'valid'-and-not$failed)){throw ('CASE_'+$mode)}
 'CLEANED='+$mode
}`);for(const c of ['valid','timeout','malformed','identity','binding'])assert.match(out,new RegExp('CLEANED='+c));});
test('driver graceful close uses only returned parent stdin and requires successful exit',async()=>{for(const code of [0,1]){const child=new EventEmitter();child.exitCode=null;let command='';child.stdin={end:s=>{command=s;queueMicrotask(()=>child.emit('exit',code));}};if(code===0)await closeLightChild(child);else await assert.rejects(closeLightChild(child),/CHILD_FAILED/);assert.equal(command,'P03_LIGHT_CLOSE\n');}});
test('Light source closure is SQL-free and separates application provenance from launcher; all four actual assets are checked',()=>{const child=read('p03-light-hub-child.mjs'),driver=read('p03-light-hub-driver.mjs'),builder=read('p03-light-hub-builder.mjs');assert.match(child,/createHubMiddleware\(\{root:[^\n]+pin:null/);assert.match(child,/OUTBOUND_DENIED/);assert.doesNotMatch(child,/mssql|sqlserver|sharedCopyBootstrap|initializePersistentTerminalSupport/);assert.match(builder,/sourceFile\(pkg,'apps\/api\/src\/services\/melisaHubReadiness.mjs'\)/);for(const n of ['hub.css','hub.mjs','catalog.mjs'])assert.ok(driver.includes(n));assert.match(driver,/normalActorVerified:false/);assert.match(driver,/sharedFullLaunchTested:false/);});

test('actual child close parser accepts only bounded LF or CRLF protocol; unknown and empty EOF fail',()=>{const s=read('p03-light-hub-child.mjs'),body=s.match(/function lightCloseCode\(text\)\{([^}]+)\}/)[1],parse=Function('text',body);assert.equal(parse('P03_LIGHT_CLOSE\n'),0);assert.equal(parse('P03_LIGHT_CLOSE\r\n'),0);for(const s of ['', 'other\n','P03_LIGHT_CLOSE','P03_LIGHT_CLOSE\nother','P03_LIGHT_CLOSE \n'])assert.equal(parse(s),1);});

test('foreign Host probe sends its literal HTTP header to the fixed loopback destination and never follows redirects',async()=>{
 for(const status of [403,302]){let calls=0,options,timeout;
  const result=await readLightForeignHostStatus((opts,receive)=>{calls++;options=opts;const req=new EventEmitter();req.destroy=()=>{};req.setTimeout=ms=>{timeout=ms;};req.end=()=>queueMicrotask(()=>{const response=new EventEmitter();response.statusCode=status;response.headers={location:'http://foreign.invalid/'};receive(response);response.emit('data',Buffer.from('Forbidden'));response.emit('end');});return req;});
  assert.equal(result,status);assert.equal(calls,1);assert.equal(timeout,3000);assert.deepEqual(options,{protocol:'http:',hostname:'127.0.0.1',port:5354,path:'/melisa-hub/',method:'GET',headers:{Host:'foreign:5354',Connection:'close'},agent:false,maxHeaderSize:8192});
 }
});
test('foreign Host transport fails closed on socket timeout, oversized body and request errors',async()=>{
 for(const mode of ['timeout','size','request']){let destroyed=0;
  await assert.rejects(readLightForeignHostStatus((_opts,receive)=>{const req=new EventEmitter();let timeout;req.setTimeout=(_ms,fn)=>{timeout=fn;};req.destroy=()=>{destroyed++;};req.end=()=>queueMicrotask(()=>{if(mode==='timeout'){timeout();return;}if(mode==='request'){req.emit('error',Error('not persisted'));return;}const response=new EventEmitter();response.statusCode=403;receive(response);response.emit('data',Buffer.alloc(4097));response.emit('end');});return req;}),new RegExp(mode==='timeout'?'HOST_PROBE_TIMEOUT':mode==='size'?'HOST_PROBE_SIZE':'HOST_PROBE_REQUEST'));
  assert.equal(destroyed,1);
 }
});
test('ready identity is retained before HTTP checks without marking the incomplete phase passed',()=>{const s=read('p03-light-hub-driver.mjs');const ready=s.indexOf('const ready=await active.ready;attempt.ready=');const checks=s.indexOf('const http=await checkHttp(plan,artifact)',ready);const verified=s.indexOf('attempt.httpVerified=true',checks);assert.ok(ready>0&&checks>ready&&verified>checks);assert.match(s,/startupVerified:false,httpVerified:false/);assert.match(s,/readLightForeignHostStatus\(\)\)===403,'HOST_DENIED'/);assert.doesNotMatch(s,/headers:\{host:'foreign:5354'\}/);});
