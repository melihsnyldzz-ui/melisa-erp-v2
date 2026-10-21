import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const adapter=fileURLToPath(new URL('./p03-pr54-current-b007-precut-new-recovery.ps1',import.meta.url));
const original=fileURLToPath(new URL('./p03-pr54-b264-new-owner-recovery.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const q=s=>"'"+s.replaceAll("'","''")+"'";
const windows={skip:process.platform!=='win32'};
function run(code){return execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$text=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($text))','utf16le').toString('base64')],{input:"$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest\n"+code,encoding:'utf8',windowsHide:true,timeout:20000,stdio:['pipe','pipe','pipe']});}
const parse=file=>`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(file)},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'};`;
test('new recovery is finite Current-only, requires pinned continuation, and leaves the historical adapters untouched',()=>{
 const text=fs.readFileSync(adapter,'utf8'),old=fs.readFileSync(original,'utf8');
 assert.match(text,/\[ValidateSet\('CurrentB007'\)\]\[string\]\$PolicyGeneration='CurrentB007'/);
 assert.match(text,/if\(\$PolicyGeneration -cne 'CurrentB007'\)/);
 assert.match(text,/\[Parameter\(Mandatory=\$true\)\]\[string\]\$ContinuationPath/);
 assert.match(text,/\[Parameter\(Mandatory=\$true\)\]\[ValidatePattern\('[^']+'\)\]\[string\]\$ContinuationSha256/);
 assert.match(text,/function Assert-B264Claim\{\n Assert-CurrentB007Continuation/);
 assert.match(text,/\$claimPath=Join-Path \$base .*p03-pr54-current-b007-continuation-of-cffba2988afcb49502ae73ddd797e966\.lock\.json/);
 assert.match(text,/requiresFrozenStopNewAndRollbackOld=\$true/);
 assert.match(text,/engineRecoveryExecuted=\$false/);
 assert(!old.includes('function Assert-CurrentB007Continuation'));
 assert(!old.includes('p03-pr54-current-b007-continuation-of-cffba2988afcb49502ae73ddd797e966.lock.json'));
});
test('PS5 parses the full adapter and every existing native recovery function except the claim binding remains byte-identical',windows,()=>{
 const out=run(`${parse(original)}$old=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]},$false));${parse(adapter)}$fresh=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]},$false));if($fresh.Count-ne($old.Count+1)){throw 'FUNCTION_COUNT'};foreach($f in $old){$g=@($fresh|Where-Object{$_.Name-ceq$f.Name});if($g.Count-ne1){throw 'FUNCTION_MISSING'};if($f.Name-cne'Assert-B264Claim'-and$f.Extent.Text.Replace(\"\`r\`n\",\"\`n\")-cne$g[0].Extent.Text.Replace(\"\`r\`n\",\"\`n\")){throw ('FUNCTION_CHANGED_'+$f.Name)}};'PARSED_NATIVE_RECOVERY_UNCHANGED'`);
 assert.match(out,/PARSED_NATIVE_RECOVERY_UNCHANGED/);
});
test('PS5 pure continuation guard accepts only own fresh context and pinned retained claim/failure tail; no worker dispatcher runs',windows,()=>{
 const code=String.raw`
foreach($name in @('Require-NewDrain','Assert-CurrentB007Continuation')){$defs=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq$name},$false));if($defs.Count-ne1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($defs[0].Extent.Text))}
$base='C:\Sirket\ERP\runtime\P03-OWNER-20261018';$script:PolicyGeneration='CurrentB007';$script:runId='a'*32
$ProfilePath=$base+'\MelisaERP-P03-profile-'+$runId+'.json';$BeforeImagePath=$base+'\MelisaERP-P03-before-'+$runId+'.json';$ProfileSha256='1'*64;$BeforeImageSha256='2'*64
$script:claimPath=$base+'\p03-pr54-current-b007-continuation-of-cffba2988afcb49502ae73ddd797e966.lock.json';$script:ContinuationPath=$base+'\MelisaERP-P03-transition-'+$runId+'\precut-continuation.json';$script:ContinuationSha256='3'*64
$originalPath=$ContinuationPath;$originalRun=$runId;$originalClaim=$claimPath
$retained=$base+'\p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json';$failure=$base+'\MelisaERP-P03-transition-cffba2988afcb49502ae73ddd797e966\event-0002.json'
$retainedSha='3493a3538f95b72a5fa23823748b6dd947a5111f5dc4ba9b15015d6a91b9c408';$failureSha='87b537deb4eca741203055c35efb13ad6531e556d8c77a875d1e45d128583d82'
$store=@{};$store[$retained]=$retainedSha;$store[$failure]=$failureSha;$store[$ProfilePath]=$ProfileSha256;$store[$BeforeImagePath]=$BeforeImageSha256
function Json([byte[]]$bytes){return [Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json}
function ReadPinned($path,$sha){$script:reads+=,$path;if($path-ceq$originalPath){if($sha-cne('3'*64)-or$script:bad-ceq'context'){throw 'FIXTURE_CONTEXT_HASH'};return ,[Text.Encoding]::UTF8.GetBytes(($script:context|ConvertTo-Json -Depth 20 -Compress))};if(-not$store.ContainsKey($path)-or$store[$path]-cne$sha-or$script:bad-ceq$path){throw 'FIXTURE_PIN_HASH'};return ,[Text.Encoding]::UTF8.GetBytes('{}')}
function Reset{$script:reads=@();$script:bad='';$script:PolicyGeneration='CurrentB007';$script:runId=$originalRun;$script:claimPath=$originalClaim;$script:ContinuationPath=$originalPath;$script:ContinuationSha256='3'*64;$script:context=[pscustomobject]@{schemaVersion='melisa-p03-current-b007-precut-continuation.v1';retainedClaimRef=[pscustomobject]@{path=$retained;sha256=$retainedSha};failureTailRef=[pscustomobject]@{path=$failure;sha256=$failureSha};profileRef=[pscustomobject]@{path=$ProfilePath;sha256=$ProfileSha256};beforeRef=[pscustomobject]@{path=$BeforeImagePath;sha256=$BeforeImageSha256};claimPath=$originalClaim}}
function Reject($name,[scriptblock]$body){Reset;&$body;try{Assert-CurrentB007Continuation;throw 'ACCEPTED'}catch{if($_.Exception.Message-ceq'ACCEPTED'){throw};'REJECTED='+$name}}
Reset;Assert-CurrentB007Continuation;if($reads.Count-ne5-or@($reads|Sort-Object -Unique).Count-ne5){throw 'PINS_NOT_READ'};'VALID_FRESH_CONTEXT_FIVE_PINS'
Reject 'policy' {$script:PolicyGeneration='LegacyB264'}
Reject 'old-run' {$script:runId='cffba2988afcb49502ae73ddd797e966'}
Reject 'foreign-context-path' {$script:ContinuationPath+='-other'}
Reject 'wrong-context-hash' {$script:ContinuationSha256='4'*64}
Reject 'schema' {$context.schemaVersion='foreign'}
Reject 'extra-field' {$context|Add-Member NoteProperty bypass $true}
Reject 'missing-field' {$context.PSObject.Properties.Remove('beforeRef')}
Reject 'old-claim-path' {$script:claimPath=$retained}
Reject 'context-claim' {$context.claimPath=$retained}
Reject 'retained-path' {$context.retainedClaimRef.path+='x'}
Reject 'retained-hash' {$context.retainedClaimRef.sha256='4'*64}
Reject 'tail-path' {$context.failureTailRef.path=$retained}
Reject 'tail-hash' {$context.failureTailRef.sha256='4'*64}
Reject 'profile' {$context.profileRef.sha256='4'*64}
Reject 'before' {$context.beforeRef.path=$ProfilePath}
Reject 'ref-extra' {$context.profileRef|Add-Member NoteProperty other 1}
Reject 'raw-retained-changed' {$script:bad=$retained}
Reject 'raw-tail-changed' {$script:bad=$failure}
Reject 'raw-profile-changed' {$script:bad=$ProfilePath}
Reject 'raw-before-changed' {$script:bad=$BeforeImagePath}
'NO_NATIVE_NO_DISPATCH'
`;
 const out=run(parse(adapter)+code);assert.match(out,/VALID_FRESH_CONTEXT_FIVE_PINS/);assert.equal((out.match(/REJECTED=/g)??[]).length,20);assert.match(out,/NO_NATIVE_NO_DISPATCH/);
});
