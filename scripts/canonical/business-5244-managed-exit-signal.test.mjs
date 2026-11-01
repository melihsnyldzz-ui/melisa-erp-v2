import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import vm from 'node:vm';
const dir=import.meta.dirname,q=s=>"'"+s.replaceAll("'","''")+"'";
const ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
// Reuse the existing genuine observer/controller and disposable mutex fixture,
// without importing its tests or replacing the production stdin reader.
const source=fs.readFileSync(path.join(dir,'business-5244-readpair-install.test.mjs'),'utf8');
const a=source.indexOf('const activeFixture=String.raw`'),b=source.indexOf('const activeRun=',a);
const c=source.indexOf('const managedServer=String.raw`'),d=source.indexOf("win('disposable managed server",c);
assert(a>=0&&b>a&&c>b&&d>c);
const context={path,dir,q};vm.createContext(context);
vm.runInContext(source.slice(a,b)+source.slice(c,d)+';globalThis.fixture=managedFixture;',context);
const cooperative=String.raw`
Add-Type -TypeDefinition @'
public static class BenignManagedExit { public static void Schedule(System.Diagnostics.Process p,string signal){System.Threading.Tasks.Task.Run(()=>{var clock=System.Diagnostics.Stopwatch.StartNew();while(!System.IO.File.Exists(signal)){if(clock.ElapsedMilliseconds>10000)throw new System.Exception("BENIGN_READY_NOT_OBSERVED");System.Threading.Thread.Sleep(10);}p.StandardInput.WriteLine("quit");p.StandardInput.Flush();if(!p.WaitForExit(5000)||p.ExitCode!=0)throw new System.Exception("BENIGN_COOPERATIVE_EXIT_FAILED");System.Console.WriteLine("BENIGN_OWNER_EXITED");System.Console.Out.Flush();});} }
'@
`;
async function runCase(kind,expected,{timeout=20000}={}){
 const parent=fs.realpathSync.native(process.env.RUNNER_TEMP||os.tmpdir());
 const temp=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'b6-real-signal-')));
 try{
  const preparation=kind==='valid'?'[BenignManagedExit]::Schedule($server)':kind==='disposed'?'$script:ReadPairExitObservation.Dispose()':kind==='wrong-owner'?"$field=$script:ReadPairExitObservation.GetType().GetField('<TargetPid>k__BackingField',[Reflection.BindingFlags]'Instance,NonPublic');$field.SetValue($script:ReadPairExitObservation,([uint32]$control.TargetPid+1))":kind==='wrong-birth'?"$field=$script:ReadPairExitObservation.GetType().GetField('birth',[Reflection.BindingFlags]'Instance,NonPublic');$field.SetValue($script:ReadPairExitObservation,([long]$control.TargetBirth+1))":'';
  const spoof=kind==='foreign'?'$script:ReadPairExitObservation=[pscustomobject]@{TargetPid=$control.TargetPid;TargetBirth=$control.TargetBirth}':'';
  const afterReady=kind==='valid'?preparation.replace('[BenignManagedExit]::Schedule($server)',"[BenignManagedExit]::Schedule($server,(Join-Path $PSScriptRoot 'observed-ready'))"):preparation;
  const body=afterReady+spoof+String.raw`
$failure=$null;try{Invoke-B6ReadPairManagedOwnerExit}catch{$failure=$_.Exception.ToString()}
`+(expected==='SUCCESS'?String.raw`
if($failure-or!$control.CompletedStop-or!$server.HasExited-or$server.ExitCode-ne0-or$result.stopCalls-ne0-or$result.managedExitRequests-ne1){throw ('VALID_PRODUCTION_STDIN_FAILED '+$failure)}
$script:ReadPairExitObservation.ValidateExited();$control.ValidateCompletedStop();Complete-B6ReadPairActiveEntryHandoff
if((Get-B6ReadPairActiveHandoff).phase-cne'ExclusiveVerified'){throw 'NORMAL_MUTEX_HANDOFF_NOT_VERIFIED'}
`:String.raw`
if(!$failure-or!$failure.Contains('__EXPECTED__')-or$control.CompletedStop-or$server.HasExited-or$result.stopCalls-ne0){throw ('NEGATIVE_BASELINE_CHANGED '+$failure)}
`.replace('__EXPECTED__',expected))+(kind==='late'?String.raw`
[Console]::WriteLine('TIMEOUT_OBSERVED');[Console]::Out.Flush();[Threading.Thread]::Sleep(300)
$again=$null;try{Read-B6ReadPairManagedExitSignal|Out-Null}catch{$again=$_.Exception.ToString()};if(!$again-or!$again.Contains('B6_MANAGED_EXIT_SIGNAL_ALREADY_READ')-or$control.CompletedStop-or$server.HasExited){throw 'TIMED_OUT_READER_REUSED'}
`:'')+"[Console]::WriteLine('CASE_VERIFIED');[Console]::Out.Flush()";
  const script="$ErrorActionPreference='Stop';. "+q(path.join(dir,'install-business-5244-readpair.ps1'))+" -Library\nAdd-Type -TypeDefinition ([IO.File]::ReadAllText("+q(path.join(dir,'business-5244-web-native.cs'))+"))\n"+cooperative+context.fixture.replace('__BEFORE_HOLD__','').replace('__BODY__',body);
  assert(!script.includes('function Read-B6ReadPairManagedExitSignal'));
  const file=path.join(temp,'controller.ps1');fs.writeFileSync(file,script,{flag:'wx'});
  const start=Date.now();let stdout='',stderr='',sent=false,lateSent=false,quitRequested=false;
  const child=cp.spawn(ps,['-NoProfile','-NonInteractive','-File',file],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  const result=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{child.kill();reject(new Error('ISOLATED_CONTROLLER_TEST_TIMEOUT'));},timeout);
   child.on('error',reject);child.stdout.on('data',chunk=>{
    stdout+=chunk.toString();const ready=stdout.includes('"phase":"B6_MANAGED_EXIT_READY"');
    if(kind==='valid'&&ready&&!quitRequested){quitRequested=true;fs.writeFileSync(path.join(temp,'observed-ready'),'ready',{flag:'wx'});}
    if(kind==='late'&&!lateSent&&stdout.includes('TIMEOUT_OBSERVED')){lateSent=true;child.stdin.write('MANAGED_EXIT_OBSERVED\n');}
    if(!sent&&((kind==='valid'&&stdout.includes('BENIGN_OWNER_EXITED'))||(kind!=='valid'&&ready))){
     sent=true;
     if(kind==='missing'){child.stdin.end();}
     else if(kind==='late'){/* Real stdin remains open beyond the production bound. */}
     else{child.stdin.write((kind==='wrong'?'WRONG_SIGNAL':'MANAGED_EXIT_OBSERVED')+'\n');}
    }
   });child.stderr.on('data',x=>{stderr+=x.toString()});child.on('close',code=>{clearTimeout(timer);resolve({code,elapsed:Date.now()-start})});
  });
  assert.equal(result.code,0,stderr+'\n'+stdout);assert.match(stdout,/CASE_VERIFIED/);assert.match(stdout,/PASS\s*$/);
  if(kind==='late'){assert(lateSent,'actual late input delivered after timeout');assert(result.elapsed>=59000,'actual fixed timeout must elapse');assert(result.elapsed<85000,'reader must finish without timely caller input');}
 }finally{
  const full=fs.realpathSync.native(temp);assert.equal(path.dirname(full).toLowerCase(),parent.toLowerCase());assert(path.basename(full).startsWith('b6-real-signal-'));assert(!fs.lstatSync(full).isSymbolicLink());fs.rmSync(full,{recursive:true});
 }
}
for(const [kind,expected] of [['valid','SUCCESS'],['missing','B6_MANAGED_EXIT_SIGNAL_NOT_RECEIVED'],['wrong','B6_MANAGED_EXIT_SIGNAL_NOT_RECEIVED'],['early','RETIREMENT_EXIT_NOT_OBSERVED'],['foreign','B6_MANAGED_EXIT_ADMISSION_REQUIRED'],['disposed','RETIREMENT_EXIT_OBSERVER_CHANGED'],['wrong-owner','B6_MANAGED_EXIT_GENERATION_CHANGED'],['wrong-birth','B6_MANAGED_EXIT_GENERATION_CHANGED']]){
 test('production managed controller / real Console stdin: '+kind,{skip:process.platform!=='win32',timeout:25000},()=>runCase(kind,expected));
}
test('production fixed 60-second stdin bound rejects absent/late signal and cannot reopen its timed-out reader',{skip:process.platform!=='win32',timeout:90000},()=>runCase('late','B6_MANAGED_EXIT_SIGNAL_TIMEOUT',{timeout:85000}));
