import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const windows={skip:process.platform!=='win32'},shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
// Current protected helper copies use exact Git LF payloads; an auto-CRLF
// checkout is source text, not the materialized immutable control copy.
const leaf=name=>fileURLToPath(new URL('./'+name,import.meta.url)),q=v=>"'"+v.replaceAll("'","''")+"'",sha=name=>crypto.createHash('sha256').update(readFileSync(leaf(name),'utf8').replaceAll('\r\n','\n')).digest('hex');
const engineSha='b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f',helperSha='e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5';
// The diagnostic revision is deliberately NOT admitted by normal control copies.
const observerMaterializedSha='8260a0d0fc8c378b68c1c7a6303b085cc265a6045c004f9b81586d5a99e617b1';
test('diagnostic observer differs from the still-pinned normal revision only by error-only predicates',()=>{
 const source=readFileSync(leaf('p03-physical-recovery-observe.ps1'),'utf8').replaceAll('\r\n','\n');
 assert.equal(sha('p03-physical-recovery-observe.ps1'),"93736f1dd8ecb9b8cf5ba7609162fbf4005e13e60bd7721e02e098dcdecba454");
 const lines=source.split('\n'),start=lines.findIndex(x=>x===' # Failure-only diagnostics for the SAME raw CIM row; never an identity or authority.');
 assert(start>=0);assert(lines[start+1].startsWith(' if(-not ('));assert(lines[start+2].includes('MELISA_NATIVE_RO_PREDICATES='));assert.equal(lines[start+3],' }');
 lines.splice(start,4);for(const marker of ['  # Diagnostic row snapshot before the SAME owner query; never a new source read.','   # Diagnostic child scope preserves the original catch ErrorRecord and rejection.']){const index=lines.indexOf(marker);assert(index>=0);assert(lines[index+1].includes(marker.startsWith('  # Diagnostic row')?'$consoleBefore=':'MELISA_NATIVE_RO_ROW='));lines.splice(index,2);}assert.equal(crypto.createHash('sha256').update(lines.join('\n')).digest('hex'),observerMaterializedSha);
});
function ps(code){return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))','utf16le').toString('base64')],{input:"$ErrorActionPreference='Stop';Set-StrictMode -Version Latest\n"+code,encoding:'utf8',windowsHide:true,timeout:20000,stdio:['pipe','pipe','pipe']});}
const extract=(name,file)=>`$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(leaf(file))},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'};$d=@($a.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq ${q(name)}},$false));if($d.Count-ne1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($d[0].Extent.Text));`;
test('CurrentB007 helper closure binds literal Git LF payloads while retaining all legacy source pins',windows,()=>{
 const newRecovery=readFileSync(leaf('p03-pr54-b264-new-owner-recovery.ps1'),'utf8'),newObserver=readFileSync(leaf('p03-pr54-new-owner-observe.ps1'),'utf8');
 for(const [file,consumer]of [['p03-pr54-successor-core-drain.ps1',newObserver],['p03-physical-recovery-observe.ps1',newObserver],['p03-physical-recovery-observe.ps1',newRecovery],['p03-pr54-new-owner-observe.ps1',newRecovery],['p03-pr54-new-owner-empty-recovery.ps1',newRecovery]])assert(consumer.includes(file==='p03-physical-recovery-observe.ps1'?observerMaterializedSha:sha(file)),file);
 for(const oldPin of ['b7ba34e3b13899874f0ea3d5cd168682f81fd946ca7d42db586d8a95ff4efa22','5e1f89bd24ba7b1a2c8738cab3f2f29d4ec44ade96b62127d9f1367efd6143f9','a742992d20b5eb44f2092249077cf785a5176525c6d498dd300873b0bfaa7f4a'])assert(newRecovery.includes(oldPin));
 const definitions=extract('Require-NewDrain','p03-pr54-b264-new-owner-recovery.ps1')+extract('Get-B264RecoverySourcePolicy','p03-pr54-b264-new-owner-recovery.ps1');
 const legacy=ps(definitions+"$PolicyGeneration='CurrentB007';Get-B264RecoverySourcePolicy|ConvertTo-Json -Compress");assert.deepEqual(JSON.parse(legacy),{newObserverSha256:'777bc48f04fbdd1a48b9cf92aea4deaed4e34a9004139a2b0e9e5eba094445c4',observerSha256:observerMaterializedSha});
 const fresh=ps(definitions+"$PolicyGeneration='CurrentB007';$GenerationClaimPath='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\p03-pr54-current-b007-generation-"+'a'.repeat(64)+".lock.json';Get-B264RecoverySourcePolicy|ConvertTo-Json -Compress");assert.deepEqual(JSON.parse(fresh),{newObserverSha256:sha('p03-pr54-new-owner-observe.ps1'),observerSha256:observerMaterializedSha});
});
test('CurrentB007 pre-IO guards execute only AST conditions and reject aliases, crossed engine and mutation modes',windows,()=>{
 const base=String.raw`C:\Sirket\ERP\runtime\P03-OWNER-20261018`,control=base+'\\MelisaERP-P03-current-b007-control-'+ 'a'.repeat(12),transition=base+'\\MelisaERP-P03-transition-'+ 'b'.repeat(32),cases=[];
 for(const [file,policy]of [['p03-pr54-successor-core-drain.ps1','CurrentB007InspectOnly'],['p03-physical-recovery-observe.ps1','CurrentB007InspectOnly'],['p03-pr54-b264-old-owner-cut.ps1','CurrentB007InspectOnly'],['p03-pr54-new-owner-observe.ps1','CurrentB007ObserveOnly']]){
  const input={PolicyGeneration:policy,Mode:file.includes('new-owner-observe')?'Observe':'Inspect',Environment:'Shared',Purpose:'Physical',ProfilePath:'fixture-profile',ProfileSha256:'a'.repeat(64),EnginePath:(file.includes('new-owner-observe')?transition:control)+'\\p03-physical-rollback-lifetime-v2.ps1',EngineSha256:engineSha,RecoveryHelperPath:'fixture-helper',RecoveryHelperSha256:helperSha,DrainerPath:'fixture-drainer',DrainerSha256:sha('p03-pr54-successor-core-drain.ps1'),SourceObserverSha256:observerMaterializedSha};
  const mutations=[v=>v.PolicyGeneration=v.PolicyGeneration.toLowerCase(),v=>v.EngineSha256='99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def',v=>v.EnginePath=v.EnginePath.replace('lifetime-v2','other'),v=>v.RecoveryHelperSha256='0'.repeat(64)];if(!file.includes('successor-core-drain'))mutations.push(v=>v.DrainerSha256='0'.repeat(64));
  if(file.includes('new-owner-observe'))mutations.push(v=>v.SourceObserverSha256=sha('p03-physical-recovery-observe.ps1'));
  cases.push({file,value:input,accepted:true});for(const mutate of mutations){const value=structuredClone(input);mutate(value);cases.push({file,value,accepted:false});}
  if(!file.includes('old-owner-cut')){const value=structuredClone(input);if(file.includes('physical-recovery-observe'))value.Environment='Rehearsal';else value.Mode='Capture';cases.push({file,value,accepted:false});}
 }
 const payload=Buffer.from(JSON.stringify(cases)).toString('base64'),dir=fileURLToPath(new URL('.',import.meta.url));
 const out=ps(`$cases=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json;$results=@(foreach($case in $cases){$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile((Join-Path ${q(dir)} $case.file),[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'};$text=@();foreach($statement in $a.EndBlock.Statements){if($statement.Extent.Text.StartsWith('Set-StrictMode ')){break};$text+=,$statement.Extent.Text};$policy=[scriptblock]::Create(($text -join [Environment]::NewLine));try{& {param($value,$policy)$PSBoundParameters=@{};foreach($property in $value.PSObject.Properties){Set-Variable -Name $property.Name -Value $property.Value};& $policy} $case.value $policy|Out-Null;$true}catch{$false}});ConvertTo-Json -InputObject $results -Compress`);
 assert.deepEqual(JSON.parse(out),cases.map(c=>c.accepted));
});
test('CurrentB007 OLD-cut Inspect accepts control or its own frozen engine while Drain and foreign runs stay exact',windows,()=>{
 const file=leaf('p03-pr54-b264-old-owner-cut.ps1'),out=ps(`$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile(${q(file)},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'};$f=@($a.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq 'B264CutAuthority'},$false));$gate=@($f[0].Body.EndBlock.Statements|Where-Object{$_.Extent.Text.Contains("'CURRENT_B007_ENGINE_RUN'")});if($gate.Count-ne1){throw 'FIXTURE_GATE'};$policy=[scriptblock]::Create($gate[0].Extent.Text)
function Need($condition,$code){if(-not $condition){throw ('FIXTURE_'+$code)}};$base='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018';$dir=Join-Path $base ('MelisaERP-P03-transition-'+('a'*32));$PolicyGeneration='CurrentB007InspectOnly';$control=Join-Path $base ('MelisaERP-P03-current-b007-control-'+('b'*12)+'\\p03-physical-rollback-lifetime-v2.ps1');$frozen=Join-Path $dir 'p03-physical-rollback-lifetime-v2.ps1';$foreign=$frozen.Replace(('a'*32),('c'*32));$results=@(foreach($case in @(@('Inspect',$control),@('Inspect',$frozen),@('Drain',$frozen),@('Inspect',$foreign),@('Drain',$foreign),@('Drain',$control))){$Mode=$case[0];$EnginePath=$case[1];try{& $policy;$true}catch{$false}});ConvertTo-Json -InputObject $results -Compress`);
 assert.deepEqual(JSON.parse(out),[true,true,true,false,false,false]);
});
