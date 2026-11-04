import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

test('fast ancestor walk retains leaf, missing-path and ancestor reparse rejection', {skip:process.platform!=='win32'},()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'melisa-ancestor-'));
 const helper=fileURLToPath(new URL('./fast-no-reparse-path.ps1',import.meta.url));
 const script=String.raw`
$ErrorActionPreference='Stop'
. $env:MELISA_PATH_CHECK_HELPER
function B5Fail([string]$code){throw $code}
$root=$env:MELISA_PATH_CHECK_FIXTURE
[IO.Directory]::CreateDirectory((Join-Path $root 'real'))|Out-Null
[IO.File]::WriteAllText((Join-Path $root 'real\sample.txt'),'fixture')
New-Item -ItemType Junction -Path (Join-Path $root 'linked') -Target (Join-Path $root 'real')|Out-Null
$cases=@(@('real\sample.txt',$true),@('real\missing.txt',$true),@('missing\nested.txt',$true),@('linked',$false),@('linked\sample.txt',$false),@('linked\missing.txt',$false))
foreach($case in $cases){
 $full=Join-Path $root $case[0];$old=$true
 for($entry=$full;$entry;$entry=[IO.Path]::GetDirectoryName($entry)){if((Test-Path -LiteralPath $entry) -and ((Get-Item -LiteralPath $entry).Attributes -band [IO.FileAttributes]::ReparsePoint)){$old=$false;break}}
 if($old -ne $case[1] -or [MelisaAncestorAttributes]::NoReparse($full) -ne $old){throw 'ANCESTOR_CHECK_MISMATCH'}
 $rejected=$false;try{Assert-B5NoReparse $full}catch{if($_.Exception.Message -cne 'B5_REPARSE'){throw};$rejected=$true}
 if($rejected -eq $case[1]){throw 'ANCESTOR_WRAPPER_MISMATCH'}
}
'SIX_CASES_PASS'
`;
 try{
  const run=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:30000,env:{...process.env,MELISA_PATH_CHECK_HELPER:helper,MELISA_PATH_CHECK_FIXTURE:root}});
  assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/SIX_CASES_PASS/);
 }finally{
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));
  fs.rmSync(root,{recursive:true,force:true});
 }
});
