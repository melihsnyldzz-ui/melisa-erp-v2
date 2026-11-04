import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import './business-5244-pty-evidence.test.mjs';
import './business-5244-pty-cleanup.test.mjs';
const dir=import.meta.dirname;
const q=value=>"'"+value.replaceAll("'","''")+"'";
const ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const tempParent=()=>fs.realpathSync.native(os.tmpdir());
function childTempEnvironment(parent,source=process.env){
 const kept=Object.fromEntries(Object.entries(source).filter(([key])=>!/^(TEMP|TMP)$/i.test(key)));
 return {...kept,TEMP:parent,TMP:parent};
}
test('only own child receives one canonical TEMP/TMP pair; mixed-case inherited aliases are removed',()=>{
 const inherited={Temp:'old-alias',TEMP:'other-alias',tMp:'third-alias',SystemRoot:'C:\\Windows',PATH:'unchanged'};
 const actual=childTempEnvironment('C:\\CanonicalTemp',inherited);
 assert.deepEqual(actual,{SystemRoot:'C:\\Windows',PATH:'unchanged',TEMP:'C:\\CanonicalTemp',TMP:'C:\\CanonicalTemp'});
 assert.equal(inherited.Temp,'old-alias');assert.equal(inherited.TEMP,'other-alias');
});
test('disposable native observer compiles in PS5 and rejects foreign roots, nonce, identities and absent observer',{skip:process.platform!=='win32',timeout:20000},()=>{
 const nonce=crypto.randomUUID().replaceAll('-','');
 const parent=tempParent(),root=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'b6-pty-unit-')));
 // No owner process is created by this test and no shared runtime is queried.
 const native=path.join(root,'native.cs');fs.copyFileSync(path.join(dir,'business-5244-pty-fixture-native.cs'),native,fs.constants.COPYFILE_EXCL);
 const script=String.raw`
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition ([IO.File]::ReadAllText(__NATIVE__))
$native=[Business5244PtyFixtureNative]
function Expect([scriptblock]$Action,[string]$Code){$caught=$null;try{&$Action}catch{$caught=$_.Exception.ToString()};if(!$caught-or!$caught.Contains($Code)){throw ('EXPECTED_'+$Code)} }
Expect { $native::Capture(1,'134380173928338500','C:\Sirket\ERP',__NONCE__) } 'TEMP_SCOPE_REQUIRED'
Expect { $native::Capture(1,'134380173928338500',[IO.Path]::GetTempPath(),'bad') } 'SCOPE_REQUIRED'
Expect { $native::ReadSignalOnce($null,__NONCE__) } 'OWNER_OBSERVER_REQUIRED'
$birth=$native::SelfBirth
if($birth-notmatch'\A[1-9][0-9]+\z'){throw 'SELF_BIRTH_INVALID'}
$methods=$native.GetMethods()|ForEach-Object Name
foreach($forbidden in @('Kill','Stop','Start','Terminate','Restore','Delete','Apply')){if($methods-ccontains$forbidden){throw 'SIDE_EFFECT_API'}}
[Console]::WriteLine('PTY_NATIVE_NEGATIVES_PASS')
`.replace('__NATIVE__',q(native)).replaceAll('__NONCE__',q(nonce));
 const file=path.join(root,'native-unit.ps1');fs.writeFileSync(file,script,{flag:'wx'});
 const result=cp.spawnSync(ps,['-NoLogo','-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout:15000,env:childTempEnvironment(parent)});
 assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr+'\n'+result.stdout);assert.match(result.stdout,/PTY_NATIVE_NEGATIVES_PASS/);
 // Evidence remains in this test's own temp root. Nothing is recursively removed.
});
test('PS5 fixture fails before any effect for bad source hash and duplicate once ownership',{skip:process.platform!=='win32',timeout:20000},()=>{
 const nonce=crypto.randomUUID().replaceAll('-','');
 const parent=tempParent(),proposed=path.join(parent,'b6-pty-fixture-'+nonce);fs.mkdirSync(proposed);const root=fs.realpathSync.native(proposed);
 for(const leaf of ['business-5244-pty-fixture.ps1','business-5244-pty-fixture-native.cs'])fs.copyFileSync(path.join(dir,leaf),path.join(root,leaf),fs.constants.COPYFILE_EXCL);
 const file=path.join(root,'business-5244-pty-fixture.ps1');
 const sourceHash=sha(fs.readFileSync(file)),nativeHash=sha(fs.readFileSync(path.join(root,'business-5244-pty-fixture-native.cs')));
 const run=hash=>cp.spawnSync(ps,['-NoLogo','-NoProfile','-NonInteractive','-File',file,'-Mode','Controller','-TempRoot',root,'-Nonce',nonce,'-SourceSha256',hash,'-NativeSha256',nativeHash],{encoding:'utf8',windowsHide:true,timeout:15000,env:childTempEnvironment(parent)});
 const bad=run('0'.repeat(64));assert.equal(bad.status,1,bad.stdout+bad.stderr);assert.match(bad.stderr,/PTY_FIXTURE_SOURCE_HASH/);assert.equal(fs.existsSync(path.join(root,'controller-once.json')),false);assert.equal(fs.existsSync(path.join(root,'controller-result.json')),false);
 const once=path.join(root,'controller-once.json');fs.writeFileSync(once,'OWNED_BY_FIRST_FIXTURE',{flag:'wx'});
 const duplicate=run(sourceHash);assert.equal(duplicate.status,1,duplicate.stdout+duplicate.stderr);assert.equal(fs.readFileSync(once,'utf8'),'OWNED_BY_FIRST_FIXTURE');assert.equal(fs.existsSync(path.join(root,'controller-result.json')),false,'a second controller must not publish a result for the first');
});
