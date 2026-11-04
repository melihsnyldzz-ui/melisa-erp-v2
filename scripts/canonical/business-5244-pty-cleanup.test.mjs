import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import cp from 'node:child_process';import crypto from 'node:crypto';
import './business-5244-pty-client-evidence.test.mjs';
import './business-5244-pty-negative-cases.test.mjs';
const dir=import.meta.dirname,ps=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),quote=x=>"'"+x.replaceAll("'","''")+"'";
// A disposable artifact is written in its reviewed canonical LF form before
// the helper checks its exact byte pin. No live/raw artifact check is relaxed.
const nativeBytes=Buffer.from(fs.readFileSync(path.join(dir,'business-5244-pty-client-observer.cs'),'utf8').replaceAll('\r\n','\n'));
const nativeHash=hash(nativeBytes);
function ownRoot(){const parent=fs.realpathSync.native(os.tmpdir()),nonce=crypto.randomUUID().replaceAll('-',''),root=path.join(parent,'b6-pty-fixture-'+nonce);fs.mkdirSync(root);return {root:fs.realpathSync.native(root),nonce,parent};}
function env(parent){return {...Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^(TEMP|TMP)$/i.test(k))),TEMP:parent,TMP:parent};}
test('client cleanup observer compiles in PS5 and closed boundaries expose no control API',{skip:process.platform!=='win32',timeout:20000},()=>{
 const own=ownRoot(),native=path.join(own.root,'business-5244-pty-client-observer.cs');assert.equal(nativeHash,'3fd25e800e1359336b178a62d57d278831663915d21f33d0a31973eac048f791');fs.writeFileSync(native,nativeBytes,{flag:'wx'});
 const client=Buffer.from('[Console]::WriteLine("OWN_UNIT_CLIENT")\n');fs.writeFileSync(path.join(own.root,'client.ps1'),client,{flag:'wx'});
 const script=String.raw`
$ErrorActionPreference='Stop'
Add-Type -LiteralPath __NATIVE__
function Expect([scriptblock]$Action,[string]$Code){$caught=$null;try{&$Action}catch{$caught=$_.Exception.ToString()};if(!$caught-or!$caught.Contains($Code)){throw ('EXPECTED_'+$Code)}}
Expect { [Business5244PtyClientObserver]::CaptureKnownClient(1,'C:\Sirket\ERP',__NONCE__,__HASH__) } 'TEMP_SCOPE_REQUIRED'
Expect { [Business5244PtyClientObserver]::CaptureKnownClient(1,__ROOT__,__NONCE__,('0'*64)) } 'SOURCE_HASH_CHANGED'
Expect { [Business5244PtyClientObserver]::CaptureKnownClient($PID,__ROOT__,__NONCE__,__HASH__) } 'CLIENT_ARGV_REQUIRED'
$names=[Business5244PtyClientObserver].GetMethods()|ForEach-Object Name
foreach($name in @('Stop','Kill','Terminate','Start','Apply','Delete','WriteInput')){if($names-ccontains$name){throw 'CONTROL_API_EXPOSED'}}
[Console]::WriteLine('CLIENT_OBSERVER_CLOSED_NEGATIVES_PASS')
`.replace('__NATIVE__',quote(native)).replaceAll('__NONCE__',quote(own.nonce)).replaceAll('__ROOT__',quote(own.root)).replaceAll('__HASH__',quote(hash(client)));
 const file=path.join(own.root,'observer-unit.ps1');fs.writeFileSync(file,script,{flag:'wx'});
 const r=cp.spawnSync(ps,['-NoLogo','-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout:15000,env:env(own.parent)});
 assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr+r.stdout);assert.match(r.stdout,/CLIENT_OBSERVER_CLOSED_NEGATIVES_PASS/);
});
test('readback ownership failure never creates or replaces another observation receipt',{skip:process.platform!=='win32',timeout:20000},()=>{
 const target=ownRoot(),audit=ownRoot();fs.writeFileSync(path.join(audit.root,'business-5244-pty-client-observer.cs'),nativeBytes,{flag:'wx'});fs.copyFileSync(path.join(dir,'business-5244-pty-client-readback.ps1'),path.join(audit.root,'business-5244-pty-client-readback.ps1'),fs.constants.COPYFILE_EXCL);
 const file=path.join(audit.root,'business-5244-pty-client-readback.ps1');
 const run=sha=>cp.spawnSync(ps,['-NoLogo','-NoProfile','-NonInteractive','-File',file,'-ClientPid','1','-TempRoot',target.root,'-Nonce',target.nonce,'-ClientSha256','0'.repeat(64),'-ObserverSha256',sha,'-AuditRoot',audit.root,'-AuditNonce',audit.nonce],{encoding:'utf8',windowsHide:true,timeout:15000,env:env(audit.parent)});
 const bad=run('0'.repeat(64));assert.equal(bad.status,1);assert.match(bad.stderr,/PTY_CLIENT_READBACK_ARGUMENTS/);assert.equal(fs.existsSync(path.join(audit.root,'cleanup-1-once.json')),false);
 const once=path.join(audit.root,'cleanup-1-once.json');fs.writeFileSync(once,'FIRST_OWNER',{flag:'wx'});const duplicate=run(nativeHash);assert.equal(duplicate.status,1);assert.match(duplicate.stderr,/PTY_CLIENT_READBACK_UNKNOWN_FAILURE/);assert.doesNotMatch(duplicate.stderr,/PTY_CLIENT_READBACK_ARGUMENTS/);assert.equal(fs.readFileSync(once,'utf8'),'FIRST_OWNER');assert.equal(fs.existsSync(path.join(audit.root,'cleanup-1-result.json')),false);
});
