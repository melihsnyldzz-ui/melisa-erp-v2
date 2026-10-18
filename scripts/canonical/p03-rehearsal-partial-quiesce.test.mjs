import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {parseP03PartialQuiesceArgs} from './p03-rehearsal-partial-quiesce.mjs';
const source=fs.readFileSync(new URL('./p03-rehearsal-partial-quiesce.ps1',import.meta.url),'utf8');
test('real Win32 argv parsing accepts cosmetic quote difference only and empty auxiliary result remains empty',{skip:process.platform!=='win32'},()=>{
 const type=source.match(/^Add-Type[^\r\n]+/m)[0],fn=source.match(/^function SameRuleArguments[^\r\n]+/m)[0];
 const cmd=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
 function Need($v,$code){if(-not$v){throw $code}}
 ${type}
 ${fn}
 $quoted='"C:\\pinned\\node.exe" --no-maglev "C:\\fixture\\app.mjs" --role erpNative --generation new'
 $actual='C:\\pinned\\node.exe --no-maglev C:\\fixture\\app.mjs --role erpNative --generation new'
 Need (SameRuleArguments $actual $quoted) 'QUOTE_POSITIVE'
 Need (-not(SameRuleArguments ($actual+' foreign') $quoted)) 'EXTRA_NEGATIVE'
 Need (-not(SameRuleArguments ($actual.Replace('erpNative','coreSupervisor')) $quoted)) 'ROLE_NEGATIVE'
 function AdmitPartial{$found=@();return ,$found}
 $finalAux=AdmitPartial;Need ($finalAux.Count-eq0) 'EMPTY_RESULT'
 'ARGV_AND_EMPTY_PASS'`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(cmd,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/ARGV_AND_EMPTY_PASS/);assert.match(source,/\$finalAux=AdmitPartial;Need \(\$finalAux.Count-eq0\)/);assert.match(source,/\$candidate.environment-ceq'P03_REHEARSAL'/);
});
test('partial cleanup requires four finite pins and defaults to read only',()=>{const args=['--run-id','a'.repeat(32),'--profile-sha256','b'.repeat(64),'--before-sha256','c'.repeat(64),'--candidate-sha256','d'.repeat(64)];assert.equal(parseP03PartialQuiesceArgs(args).mode,'DryRun');assert.equal(parseP03PartialQuiesceArgs([...args,'--mode','Quiesce']).mode,'Quiesce');for(const extra of [['--port','4184'],['--task','shared'],['--mode','Run']])assert.throws(()=>parseP03PartialQuiesceArgs([...args,...extra]));const bad=[...args];bad[7]='x';assert.throws(()=>parseP03PartialQuiesceArgs(bad));});
test('reviewed helper AST pin matches source and no candidate or auxiliary is blindly stopped',()=>{const helper=fs.readFileSync(new URL('./p03-rehearsal-quiesce.ps1',import.meta.url));assert.ok(source.includes(crypto.createHash('sha256').update(helper).digest('hex')));assert.match(source,/\$captured.Count-le3/);assert.match(source,/Identity \$p \$expected/);assert.match(source,/'AUX_DRIFT'/);assert.match(source,/c86146188b78e484f32cc29e2331689659943b47689a85570342044f499938ac/);assert.match(source,/Get-AuthenticodeSignature/);assert.match(source,/'NATURAL_EXIT_REQUIRED'/);assert.match(source,/\$held=\[IO.File\]::Open/);assert.ok(source.indexOf("SaveIntent 'partial-quiesce-intent.json'")<source.indexOf('foreach($role in $roles)'));assert.match(source,/'DELETE_CAS';\$folder.DeleteTask/);assert.doesNotMatch(source,/StopNew|RollbackOld|\.Stop\(|Stop-Process|Remove-Item|taskkill/);});
test('WindowsPS parses partial cleanup without executing its body',{skip:process.platform!=='win32'},()=>{const file=fileURLToPath(new URL('./p03-rehearsal-partial-quiesce.ps1',import.meta.url)).replaceAll("'","''");const cmd=`$tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$tokens,[ref]$errors);if($errors.Count){exit 1};'PARSE_PASS'`;const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(cmd,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PARSE_PASS/);});
