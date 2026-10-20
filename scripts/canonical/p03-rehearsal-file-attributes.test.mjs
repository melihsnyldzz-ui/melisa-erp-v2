import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseP03RehearsalMode,p03RehearsalSourceRequest,P03_FILE_ATTRIBUTES_V1_ENGINE,P03_FAILURE_RECORD_V1_ENGINE,P03_B264_V2_ENGINE} from './p03-rehearsal-harness.mjs';
test('fresh-attributes rehearsal selects only exact new bytes; old frozen modes retain their pins',()=>{
 for(const mode of ['DryRun','Run'])assert.equal(parseP03RehearsalMode(['--FileAttributesV1'+mode]),'FileAttributesV1'+mode);
 for(const args of [['--FileAttributesV1'],['--fileattributesv1run'],['--FileAttributesV1Run','--engine'],['--FileAttributesV1Run-extra']])assert.throws(()=>parseP03RehearsalMode(args));
 const native=fs.readFileSync(new URL('./p03-physical-rollback-lifetime-v2.ps1',import.meta.url),'utf8'),candidate=Buffer.from(native.replaceAll('\r\n','\n'));
 assert.equal(crypto.createHash('sha256').update(candidate).digest('hex'),P03_FILE_ATTRIBUTES_V1_ENGINE.sha256);
 const historical=Buffer.from(candidate.toString().replace('{Need (([IO.File]::GetAttributes($part) -band','{$item=Get-Item -LiteralPath $part -Force;Need (($item.Attributes -band'));
 assert.equal(crypto.createHash('sha256').update(historical).digest('hex'),P03_FAILURE_RECORD_V1_ENGINE.sha256);
 let bytes=candidate;const reads=[];
 const context={path:path.win32,crypto,Buffer,P03_FILE_ATTRIBUTES_V1_ENGINE,P03_FAILURE_RECORD_V1_ENGINE,P03_B264_V2_ENGINE,fs:{lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false,nlink:1}),readFileSync:p=>{reads.push(p);if(p===P03_FILE_ATTRIBUTES_V1_ENGINE.path)return bytes;if(p===P03_FAILURE_RECORD_V1_ENGINE.path)return historical;return Buffer.from('fixture:'+path.win32.basename(p));}}};
 const make=vm.runInNewContext('('+p03RehearsalSourceRequest.toString()+')',context),dir=String.raw`C:\synthetic\scripts\canonical`;
 for(const mode of ['DryRun','Run']){reads.length=0;const r=JSON.parse(JSON.stringify(make(dir,'FileAttributesV1'+mode)));assert.equal(r.mode,mode);assert.equal(r.engineGeneration,'FileAttributesV1');assert.deepEqual(r.engine,P03_FILE_ATTRIBUTES_V1_ENGINE);assert.equal(reads.filter(p=>p===P03_FILE_ATTRIBUTES_V1_ENGINE.path).length,1);assert(!reads.includes(P03_FAILURE_RECORD_V1_ENGINE.path));assert.deepEqual(JSON.parse(JSON.stringify(make(dir,'FailureRecordV1'+mode))).engine,P03_FAILURE_RECORD_V1_ENGINE);}
 for(const bad of [historical,Buffer.from('changed'),Buffer.from(candidate.toString().replaceAll('\n','\r\n'))]){bytes=bad;assert.throws(()=>make(dir,'FileAttributesV1Run'),/P03_REHEARSAL_FILE_ATTRIBUTES_ENGINE/);}
});
test('actual PS5 new-generation request gate rejects foreign tuple and unknown fields before dispatch',{skip:process.platform!=='win32'},()=>{
 const file=fileURLToPath(new URL('./p03-rehearsal-driver.ps1',import.meta.url)).replaceAll("'","''");
 const body=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$e);if($e.Count){throw 'PARSE'};foreach($n in @('Need','AssertRehearsalEngineRequest')){$f=@($ast.FindAll({param($x)$x-is[Management.Automation.Language.FunctionDefinitionAst]-and$x.Name-ceq$n},$true));if($f.Count-ne1){throw 'FUNCTION'};. ([scriptblock]::Create($f[0].Extent.Text))};function Req{[pscustomobject]@{engineGeneration='FileAttributesV1';engine=[pscustomobject]@{path='${P03_FILE_ATTRIBUTES_V1_ENGINE.path}';sha256='${P03_FILE_ATTRIBUTES_V1_ENGINE.sha256}'}}};$r=Req;AssertRehearsalEngineRequest $r 'FileAttributesV1';'VALID';foreach($k in @('path','hash','generation','fields','historical','selector')){$r=Req;$g='FileAttributesV1';switch($k){path{$r.engine.path=$r.engine.path.ToUpperInvariant()}hash{$r.engine.sha256='f'*64}generation{$r.engineGeneration='fileattributesv1'}fields{$r.engine|Add-Member NoteProperty bypass $true}historical{$r.engine.path='${P03_FAILURE_RECORD_V1_ENGINE.path}';$r.engine.sha256='${P03_FAILURE_RECORD_V1_ENGINE.sha256}'}selector{$g='FailureRecordV1'}};try{AssertRehearsalEngineRequest $r $g;throw 'ACCEPTED'}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw};'REJECTED'}};'NO_DISPATCH'`;
 const r=spawnSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(body,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\Modules`}});
 assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');assert.match(r.stdout,/VALID/);assert.match(r.stdout,/NO_DISPATCH/);assert.equal((r.stdout.match(/REJECTED/g)??[]).length,6);
});
