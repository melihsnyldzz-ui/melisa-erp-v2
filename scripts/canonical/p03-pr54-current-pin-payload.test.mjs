import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {pr54CurrentStrictPinsPayloadProgram} from './p03-pr54-shared-owner-io.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const refs=n=>Array.from({length:n},(_,i)=>({path:String.raw`C:\fixture\pin-${String(i).padStart(3,'0')}.json`,sha256:'a'.repeat(64)}));
const source=fs.readFileSync(new URL('./p03-pr54-shared-owner-io.mjs',import.meta.url),'utf8');
test('postclaim current pins use one stdin payload; command contains only payload hash and legacy remains chunked',()=>{
 const bytes=Buffer.from(JSON.stringify(refs(128))),code=pr54CurrentStrictPinsPayloadProgram(sha(bytes));
 assert(code.length<16000);assert(!code.includes(bytes.toString('base64')));assert(!code.includes('C:\fixture'));assert.match(code,/\[Console\]::In\.ReadToEnd\(\)/);assert.match(code,/\$pins\.Count-gt128/);assert.doesNotMatch(code,/CreateNew|WriteAll|\.Write\(/);
 const current=source.slice(source.indexOf('export async function runPr54CurrentB007SharedOwnerTransition'));
 assert.match(current,/if\(precutB142Continuation&&claimRef&&refs\.length>0\)\{[\s\S]*?refs\.length<=128[\s\S]*?for\(const ref of refs\)pin\(ref\)[\s\S]*?psPayload\(pr54CurrentStrictPinsPayloadProgram\(hash\(bytes\)\),bytes,\{\.\.\.psTransport,expectedOutput:'VERIFIED'\}\);return;/);
 assert.match(current,/const width=8;\s*for\(let n=0;n<refs\.length;n\+=width\)/);
 for(const hash of ['', 'A'.repeat(64),'x'.repeat(64),'a'.repeat(63)])assert.throws(()=>pr54CurrentStrictPinsPayloadProgram(hash),/CURRENT_PINS_PAYLOAD_HASH/);
});
test('existing payload transport keeps CREATED default, explicitly admits VERIFIED, and rejects every other acknowledgement',async()=>{
 const declaration=source.match(/^async function psPayload\([^\n]+/m)[0],calls=[];
 let output='CREATED',stderr='',exitCode=0;
 const transport=vm.runInNewContext('('+declaration+')',{Buffer,Promise,shell:'fixed-shell',opts:{},need:(value,code)=>{if(!value)throw Error('P03_SHARED_'+code);},spawn:(exe,args,options)=>{
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.kill=()=>{};
  child.stdin.end=body=>{calls.push({exe,args,options,body});queueMicrotask(()=>{child.stdout.emit('data',output);if(stderr)child.stderr.emit('data',stderr);child.emit('close',exitCode);});};return child;
 }});
 const bytes=Buffer.from(JSON.stringify(refs(128))),code=pr54CurrentStrictPinsPayloadProgram(sha(bytes));
 await transport(code,bytes,{plainCommandOnly:true});assert.equal(calls.length,1);assert.equal(calls[0].args[2],'-Command');assert.equal(calls[0].args[3],code);assert.equal(calls[0].body,bytes.toString('base64'));assert(!calls[0].args.join(' ').includes(bytes.toString('base64')));
 output='VERIFIED';await transport(code,bytes,{plainCommandOnly:true,expectedOutput:'VERIFIED'});assert.equal(calls.length,2);
 for(const value of ['PASS','VERIFIED extra','CREATED','']){output=value;await assert.rejects(transport(code,bytes,{plainCommandOnly:true,expectedOutput:'VERIFIED'}),/^Error: P03_SHARED_WRITER_REJECTED$/);}
 output='VERIFIED';stderr='private-path secret';await assert.rejects(transport(code,bytes,{plainCommandOnly:true,expectedOutput:'VERIFIED'}),/^Error: P03_SHARED_WRITER_REJECTED$/);stderr='';exitCode=1;await assert.rejects(transport(code,bytes,{plainCommandOnly:true,expectedOutput:'VERIFIED'}),/WRITER_REJECTED/);
 const before=calls.length;for(const expectedOutput of ['PASS',null,false])await assert.rejects(transport(code,bytes,{expectedOutput}),/PAYLOAD_LIMIT/);assert.equal(calls.length,before);
});
const fixture=String.raw`
$global:mode='MODE';$global:aclReads=0;$global:hashReads=0
function Get-Item{param($LiteralPath,[switch]$Force);[pscustomobject]@{PSIsContainer=($global:mode-ceq'directory'-and$LiteralPath.EndsWith('.json'));Attributes=$(if(($global:mode-ceq'leaf-reparse'-and$LiteralPath.EndsWith('.json'))-or($global:mode-ceq'parent-reparse'-and$LiteralPath.EndsWith('fixture'))){[IO.FileAttributes]::ReparsePoint}else{[IO.FileAttributes]0})}}
function Get-Acl{
 param($LiteralPath);$global:aclReads++;$a=[pscustomobject]@{AreAccessRulesProtected=($global:mode-cne'inherited')}
 $a|Add-Member ScriptMethod GetOwner {param($type);[pscustomobject]@{Value=$(if($global:mode-ceq'owner'){'foreign'}else{'S-1-5-21-2170750028-1005938530-2568122015-1001'})}}
 $a|Add-Member ScriptMethod GetAccessRules {param($a,$b,$type);$rules=@('S-1-5-21-2170750028-1005938530-2568122015-1001','S-1-5-18'|ForEach-Object{[pscustomobject]@{IdentityReference=[pscustomobject]@{Value=$_};IsInherited=($global:mode-ceq'ace-inherited');AccessControlType=$(if($global:mode-ceq'deny'){'Deny'}else{'Allow'});FileSystemRights=$(if($global:mode-ceq'rights'){'Read'}else{'FullControl'})}});if($global:mode-ceq'ace-count'){return ,$rules[0]};return $rules};return $a
}
function Get-FileHash{param($LiteralPath,$Algorithm);$global:hashReads++;[pscustomobject]@{Hash=$(if($global:mode-ceq'hash'){'b'*64}else{'a'*64})}}
`;
function runProgram(bytes,{mode='ok',expectedCount=null,hash=sha(bytes)}={}){
 const program=pr54CurrentStrictPinsPayloadProgram(hash),after=expectedCount===null?'':`;if($global:aclReads-ne${expectedCount}-or$global:hashReads-ne${expectedCount}){throw 'CHECK_COUNTS'}`;
 return spawnSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-Command',`${program.slice(0,program.indexOf('$raw='))}${fixture.replace("'MODE'",`'${mode}'`)};${program.slice(program.indexOf('$raw='))}${after}`],{input:bytes.toString('base64'),encoding:'utf8',windowsHide:true,timeout:20000});
}
const windows={skip:process.platform!=='win32'};
test('real PS5 verifies all 128 synthetic references and repeats every fresh ACL/hash check',windows,()=>{
 const bytes=Buffer.from(JSON.stringify(refs(128)));
 for(let i=0;i<2;i++){const result=runProgram(bytes,{expectedCount:128});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'VERIFIED');}
 const single=runProgram(Buffer.from(JSON.stringify(refs(1))),{expectedCount:1});assert.equal(single.status,0,single.stderr);assert.equal(single.stdout.trim(),'VERIFIED');
 const drift=runProgram(bytes,{mode:'hash'});assert.notEqual(drift.status,0);assert(!drift.stdout.includes('VERIFIED'));
});
test('real PS5 rejects payload tamper, nonarrays/count/ref shapes and fresh path/ACL/hash failures',windows,()=>{
 const valid=Buffer.from(JSON.stringify(refs(1)));
 const tamper=runProgram(valid,{hash:'0'.repeat(64)});assert.notEqual(tamper.status,0);assert(!tamper.stdout.includes('VERIFIED'));
 for(const value of [null,{},[],refs(129),['text'],[[refs(1)[0]]],[{...refs(1)[0],extra:true}],[{path:'relative',sha256:'a'.repeat(64)}],[{...refs(1)[0],sha256:'bad'}]]){const result=runProgram(Buffer.from(JSON.stringify(value)));assert.notEqual(result.status,0);assert(!result.stdout.includes('VERIFIED'));if(Array.isArray(value)&&Array.isArray(value[0]))assert.match(result.stderr,/PINS_REF/);}
 for(const mode of ['directory','leaf-reparse','parent-reparse','inherited','owner','ace-inherited','ace-count','deny','rights','hash']){const result=runProgram(valid,{mode});assert.notEqual(result.status,0);assert(!result.stdout.includes('VERIFIED'));}
});
