import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const adapter=fileURLToPath(new URL('./p03-pr54-current-b007-precut-new-recovery.ps1',import.meta.url));
const original=fileURLToPath(new URL('./p03-pr54-b264-new-owner-recovery.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const q=s=>"'"+s.replaceAll("'","''")+"'";
const windows={skip:process.platform!=='win32'};
function run(code){return execFileSync(shell,['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';try{& ([scriptblock]::Create([Console]::In.ReadToEnd()))}catch{[Console]::Error.WriteLine($_.Exception.Message);exit 1}"],{input:"Set-StrictMode -Version Latest\n"+code,encoding:'utf8',windowsHide:true,timeout:20000,stdio:['pipe','pipe','pipe']});}
const parse=file=>`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(${q(file)},[ref]$t,[ref]$e);if($e.Count){throw 'FIXTURE_PARSE'};`;
const cutFixtures=fs.readFileSync(new URL('./p03-pr54-current-b007-precut-cut.test.mjs',import.meta.url),'utf8');
function rawFixture(name){const marker='const '+name+'=String.raw`',start=cutFixtures.indexOf(marker);assert(start>=0);return cutFixtures.slice(start+marker.length,cutFixtures.indexOf('\n`;',start));}
test('new recovery is finite Current-only, requires pinned continuation, and leaves the historical adapters untouched',()=>{
 const text=fs.readFileSync(adapter,'utf8').replaceAll('\r\n','\n'),old=fs.readFileSync(original,'utf8').replaceAll('\r\n','\n');
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
test('recovery resume binds the unchanged452 claim and one-time pointer without postcut OLD-running or before-age requirements',windows,()=>{
 const extraction=`${parse(adapter)}foreach($name in @('Same-B264Value','CurrentB007ResumeStable','AssertCurrentB007RetryHistory','AssertCurrentB007ResumeBinding','Assert-CurrentB007Continuation')){$defs=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq$name},$true));if($defs.Count-ne1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($defs[0].Extent.Text))}`;
 const code=rawFixture('fixture')+'\n'+rawFixture('resumeFixture')+String.raw`
function Require-NewDrain($value,$code){if(-not$value){throw ('P03_NEW_DRAIN_'+$code)}}
function ReadPinned($path,$sha){return ,(ReadWorkerPin $path $sha)}
function Same-B264Value($a,$b){return ($a|ConvertTo-Json -Depth 18 -Compress)-ceq($b|ConvertTo-Json -Depth 18 -Compress)}
SetupResume;$PolicyGeneration='CurrentB007';Remove-Variable dir -ErrorAction SilentlyContinue
$oldClaim=$claim|ConvertTo-Json -Depth 30 -Compress;Assert-CurrentB007Continuation
$before.startedAt=[DateTime]::UtcNow.AddMinutes(-20).ToString('o');$before.observedAt=[DateTime]::UtcNow.AddMinutes(-19).ToString('o');$data[$context.retainedBeforeRef.path].observedAt=[DateTime]::UtcNow.AddMinutes(-30).ToString('o')
Assert-CurrentB007Continuation;if(($claim|ConvertTo-Json -Depth 30 -Compress)-cne$oldClaim){throw 'CLAIM_CHANGED'};'RESUME_POSTCUT_NO_OLD_CLOCK_OR_RUNNING_CHECK'
`;
 assert.match(run(extraction+'\n'+code),/RESUME_POSTCUT_NO_OLD_CLOCK_OR_RUNNING_CHECK/);
 for(const edit of ["$context.claimPath+='wrong'","$context.retainedBeforeRef.sha256='wrong'","$before.identities=@('changed')","$profile.tasks=@('changed')","$data.Remove((Join-Path $resumeDir 'resume-attempt.json'))","$resumeFiles+=,'successor-core-cut-completed.json'"]){
  const out=run(extraction+'\n'+rawFixture('fixture')+'\n'+rawFixture('resumeFixture')+'\nfunction Require-NewDrain($v,$c){if(-not$v){throw $c}}\nfunction ReadPinned($p,$s){return ,(ReadWorkerPin $p $s)}\nfunction Same-B264Value($a,$b){return ($a|ConvertTo-Json -Depth 18 -Compress)-ceq($b|ConvertTo-Json -Depth 18 -Compress)}\nSetupResume;$PolicyGeneration=\'CurrentB007\';'+edit+";try{Assert-CurrentB007Continuation;throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'REJECTED'}");assert.match(out,/REJECTED/);
 }
});
test('PS5 parses the full adapter and every existing native recovery function except claim binding and versioned source policy remains byte-identical',windows,()=>{
 const out=run(`${parse(original)}$allOld=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]},$false));foreach($name in @('Same974dShape','Assert974dContinuation','AssertB142Continuation')){if(@($allOld|Where-Object{$_.Name-ceq$name}).Count-ne1){throw 'CURRENT_METADATA_FUNCTION_MISSING'}};$old=@($allOld|Where-Object{$_.Name-cnotin@('Same974dShape','Assert974dContinuation','AssertB142Continuation')});${parse(adapter)}$fresh=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]},$false));if($fresh.Count-ne($old.Count+4)){throw 'FUNCTION_COUNT'};foreach($f in $old){$g=@($fresh|Where-Object{$_.Name-ceq$f.Name});if($g.Count-ne1){throw 'FUNCTION_MISSING'};if($f.Name-cnotin@('Assert-B264Claim','Get-B264RecoverySourcePolicy')-and$f.Extent.Text.Replace(\"\`r\`n\",\"\`n\")-cne$g[0].Extent.Text.Replace(\"\`r\`n\",\"\`n\")){throw ('FUNCTION_CHANGED_'+$f.Name)}};'PARSED_NATIVE_RECOVERY_UNCHANGED'`);
 assert.match(out,/PARSED_NATIVE_RECOVERY_UNCHANGED/);
});

test('fresh generation recovery pins the current observer while retained current and historical policies keep their exact original bytes',windows,()=>{
 const observer=fs.readFileSync(new URL('./p03-pr54-new-owner-observe.ps1',import.meta.url),'utf8').replaceAll('\r\n','\n'),sha=createHash('sha256').update(observer).digest('hex');
 const out=run(`${parse(original)}$d=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-cin@('Require-NewDrain','Get-B264RecoverySourcePolicy')},$true));foreach($def in $d){. ([scriptblock]::Create($def.Extent.Text))};$script:PolicyGeneration='CurrentB007';'OLD='+(Get-B264RecoverySourcePolicy).newObserverSha256;$script:GenerationClaimPath='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018\\p03-pr54-current-b007-generation-${'d'.repeat(64)}.lock.json';'FRESH='+(Get-B264RecoverySourcePolicy).newObserverSha256;$script:PolicyGeneration='LegacyB264';'LEGACY='+(Get-B264RecoverySourcePolicy).newObserverSha256`);
 assert.match(out,new RegExp('OLD=777bc48f04fbdd1a48b9cf92aea4deaed4e34a9004139a2b0e9e5eba094445c4[\\s\\S]*FRESH='+sha+'[\\s\\S]*LEGACY=1644e2d61653e41851698f1f8e98d873e0346dcf21cea6b243f7c4af66c00920'));
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
test('recovery fixed9d2 retry authenticates unchanged452 and both pointers without postcut OLD-running or before900 gate',windows,()=>{
 const extraction=`${parse(adapter)}foreach($name in @('Same-B264Value','CurrentB007ResumeStable','AssertCurrentB007RetryHistory','AssertCurrentB007ResumeBinding','Assert-CurrentB007Continuation')){$defs=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq$name},$true));if($defs.Count-ne1){throw 'FIXTURE_FUNCTION'};. ([scriptblock]::Create($defs[0].Extent.Text))}`;
 const fixtures=rawFixture('fixture')+'\n'+rawFixture('resumeFixture')+'\n'+rawFixture('retryFixture');
 const stubs='\nfunction Require-NewDrain($v,$c){if(-not$v){throw $c}}\nfunction ReadPinned($p,$s){return ,(ReadWorkerPin $p $s)}\nfunction Same-B264Value($a,$b){return ($a|ConvertTo-Json -Depth 25 -Compress)-ceq($b|ConvertTo-Json -Depth 25 -Compress)}\n';
 const positive=fixtures+stubs+"SetupRetry;$PolicyGeneration='CurrentB007';Remove-Variable dir -ErrorAction SilentlyContinue;Assert-CurrentB007Continuation;$before.startedAt=[DateTime]::UtcNow.AddMinutes(-20).ToString('o');$before.observedAt=[DateTime]::UtcNow.AddMinutes(-19).ToString('o');$data[$context.retainedBeforeRef.path].observedAt=[DateTime]::UtcNow.AddMinutes(-30).ToString('o');$data[(Join-Path $base ('MelisaERP-P03-before-'+$retryRun+'.json'))].observedAt=[DateTime]::UtcNow.AddMinutes(-25).ToString('o');Assert-CurrentB007Continuation;'RETRY_POSTCUT_NO_CLOCK_OR_OLD_RUNNING'";
 assert.match(run(extraction+'\n'+positive),/RETRY_POSTCUT_NO_CLOCK_OR_OLD_RUNNING/);
 for(const edit of ["$context.failureTailRef.sha256='wrong'","$data.Remove((Join-Path $retryDir 'resume-attempt.json'))","$retryFiles+=,'successor-core-cut-completed.json'","$data[(Join-Path $retryDir 'io-failure-diagnostic.json')].failureDiagnostic.reason='OTHER'","$hashes[(Join-Path $resumeDir 'resume-attempt.json')]='wrong'"]){
  const code=fixtures+stubs+"SetupRetry;$PolicyGeneration='CurrentB007';Remove-Variable dir -ErrorAction SilentlyContinue;"+edit+";try{Assert-CurrentB007Continuation;throw 'FIXTURE_ACCEPTED'}catch{if($_.Exception.Message-ceq'FIXTURE_ACCEPTED'){throw};'RETRY_REJECTED'}";
  assert.match(run(extraction+'\n'+code),/RETRY_REJECTED/);
 }
});
