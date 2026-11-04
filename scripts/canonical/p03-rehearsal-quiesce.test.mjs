import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parseP03QuiesceArgs} from './p03-rehearsal-quiesce.mjs';
const source=fs.readFileSync(new URL('./p03-rehearsal-quiesce.ps1',import.meta.url),'utf8');
const args=['--run-id','a'.repeat(32),'--profile-sha256','b'.repeat(64),'--before-sha256','c'.repeat(64)];
test('quiesce requires exact envelope pins and defaults to read only',()=>{
 assert.equal(parseP03QuiesceArgs(args).mode,'DryRun');assert.equal(parseP03QuiesceArgs([...args,'--mode','Quiesce']).mode,'Quiesce');
 for(const extra of [['--port','4184'],['--task','Melisa-Hub-TEST-Web'],['--root','C:\\Sirket\\ERP\\runtime'],['--mode','Apply']])assert.throws(()=>parseP03QuiesceArgs([...args,...extra]));
 for(const i of [1,3,5]){const changed=[...args];changed[i]='../'+changed[i];assert.throws(()=>parseP03QuiesceArgs(changed));}
});
test('quiesce durable intent precedes exact COM stop and covers captured watchers',()=>{
 assert.ok(source.indexOf("if($Mode-ceq'DryRun')")<source.indexOf("SaveIntent 'quiesce-intent.json'"));
 assert.ok(source.indexOf("SaveIntent 'quiesce-intent.json'")<source.indexOf('$instance.Stop()'));
 assert.match(source,/foreach\(\$role in \$roles\)\{ProtectedUnchanged/);assert.match(source,/foreach\(\$watcher in \$profile.oldWatchers\)\{ProtectedUnchanged/);
 assert.equal((source.match(/Need \(Identity \$current \$expected\) 'PID_REUSED'/g)??[]).length,2);
 assert.match(source,/\$stopperHandle=\[IO.File\]::Open/);assert.match(source,/'STOPPER_HELD_HASH'/);
 assert.match(source,/'DELETE_TASK_CAS';\$folder.DeleteTask\(\$entry.name,0\)/);
 assert.match(source,/FileMode\]::CreateNew/);assert.match(source,/\.Flush\(\$true\)/);
 assert.doesNotMatch(source,/Remove-Item|Stop-Process|taskkill|DROP DATABASE|ALTER DATABASE|DELETE FROM/i);
});
test('Windows PowerShell parses complete source and actual identity function rejects identity drift without OS operations',{skip:process.platform!=='win32'},()=>{
 const definition=source.match(/function Identity\([^\n]+/)[0];
 const script=`$ErrorActionPreference='Stop';$tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseInput([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(source).toString('base64')}')),[ref]$tokens,[ref]$errors);if($errors.Count){throw 'PARSE'}
 ${definition}
 function Invoke-CimMethod {param($p,$MethodName,$ErrorAction);@{ReturnValue=0;Sid=$p.Sid}}
 $e=[pscustomobject]@{pid=111;parentPid=112;nodePath='C:\\pinned\\node.exe';ownerSid='S-1-5-18';commandLine='exact argv';creationTime='2026-10-18T10:00:00.1234567Z'}
 function Fresh {[pscustomobject]@{ProcessId=111;ParentProcessId=112;ExecutablePath='C:\\pinned\\node.exe';Sid='S-1-5-18';CommandLine='exact argv';CreationDate=[DateTime]::Parse('2026-10-18T10:00:00.1234567Z')}}
 if(-not(Identity (Fresh) $e)){throw 'POSITIVE'}
 foreach($field in @('ProcessId','ParentProcessId','ExecutablePath','Sid','CommandLine','CreationDate')){$p=Fresh;switch($field){ProcessId{$p.ProcessId=113}ParentProcessId{$p.ParentProcessId=114}ExecutablePath{$p.ExecutablePath='foreign'}Sid{$p.Sid='S-1-5-19'}CommandLine{$p.CommandLine='foreign'}CreationDate{$p.CreationDate=$p.CreationDate.AddTicks(1)}};if(Identity $p $e){throw ('DRIFT_'+$field)}}
 if(Identity $null $e){throw 'ABSENT'};'IDENTITY_NEGATIVES_PASS'`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command','-'],{input:script,encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/IDENTITY_NEGATIVES_PASS/);
});
