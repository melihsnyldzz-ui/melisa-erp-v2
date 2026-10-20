import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('./p03-physical-rollback-lifetime-v2.ps1',import.meta.url));
const shell=String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
const q=s=>"'"+s.replaceAll("'","''")+"'";
test('NoReparse uses fresh native attributes with the identical ancestor walk and no cache or provider enumeration',()=>{
 const s=readFileSync(source,'utf8'),line=s.split(/\r?\n/).find(x=>x.startsWith('function NoReparse('));
 assert.match(line,/for\(\$part=\[IO\.Path\]::GetFullPath\(\$path\);\$part;\$part=\[IO\.Path\]::GetDirectoryName\(\$part\)\)/);
 assert.match(line,/\[IO\.File\]::GetAttributes\(\$part\)/);assert.match(line,/\[IO\.FileAttributes\]::ReparsePoint/);
 assert.doesNotMatch(line,/Get-Item|catch|Cache|TTL/i);
});
test('PS5 native C paths match the provider baseline for literals, missing paths, attributes and reparse points; measured ancestor benchmark',{skip:process.platform!=='win32'},()=>{
 const root=mkdtempSync(join(tmpdir(),'melisa-noreparse-'));
 assert.match(root,/^C:\\/i);
 const longLeaf=join(root,...Array(24).fill('long-segment'),'leaf.txt');mkdirSync(join(longLeaf,'..'),{recursive:true});writeFileSync(longLeaf,'fixture');
 try{
 const code=String.raw`
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
function Need($c,$code){if(-not$c){throw ('P03_PHYSICAL_'+$code)}}
function Baseline([string]$path){for($part=[IO.Path]::GetFullPath($path);$part;$part=[IO.Path]::GetDirectoryName($part)){$item=Get-Item -LiteralPath $part -Force;Need (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'REPARSE'}}
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile(SOURCE,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'PARSE'}
$f=@($ast.FindAll({param($a)$a-is[Management.Automation.Language.FunctionDefinitionAst]-and$a.Name-ceq'NoReparse'},$true));if($f.Count-ne1){throw 'FUNCTION'};. ([scriptblock]::Create($f[0].Extent.Text))
$root=ROOT;$deep=Join-Path $root 'one\two\three';[void][IO.Directory]::CreateDirectory($deep)
$leaf=Join-Path $deep 'ü[01]þ.txt';[IO.File]::WriteAllText($leaf,'fixture')
function Result($fn,$path){try{&$fn $path;return 'ACCEPT'}catch{return 'REJECT'}}
$cases=@(@('literal',$leaf,'ACCEPT'),@('directory',$deep,'ACCEPT'),@('root',[IO.Path]::GetPathRoot($root),'ACCEPT'),@('missing-leaf',(Join-Path $deep 'absent'),'REJECT'),@('missing-ancestor',(Join-Path $deep 'absent\file'),'REJECT'))
$hidden=Join-Path $root 'hidden-system.txt';[IO.File]::WriteAllText($hidden,'fixture');[IO.File]::SetAttributes($hidden,([IO.FileAttributes]::Hidden-bor[IO.FileAttributes]::System));$cases+=,@('hidden-system',$hidden,'ACCEPT')
$target=Join-Path $root 'target';[void][IO.Directory]::CreateDirectory($target);[IO.File]::WriteAllText((Join-Path $target 'child.txt'),'fixture')
$junction=Join-Path $root 'junction';New-Item -ItemType Junction -Path $junction -Target $target|Out-Null
$cases+=,@('junction',$junction,'REJECT');$cases+=,@('junction-ancestor',(Join-Path $junction 'child.txt'),'REJECT')
$brokenTarget=Join-Path $root 'broken-target';[void][IO.Directory]::CreateDirectory($brokenTarget);$broken=Join-Path $root 'broken';New-Item -ItemType Junction -Path $broken -Target $brokenTarget|Out-Null;[IO.Directory]::Delete($brokenTarget);$cases+=,@('broken-junction',$broken,'REJECT')
$symbolic=Join-Path $root 'symlink'
try{New-Item -ItemType SymbolicLink -Path $symbolic -Target $target|Out-Null;$cases+=,@('directory-symlink',$symbolic,'REJECT');$cases+=,@('symlink-ancestor',(Join-Path $symbolic 'child.txt'),'REJECT')}catch{'OPTIONAL_SYMLINK_UNAVAILABLE'}
$long=$root;while($long.Length-lt290){$long=Join-Path $long 'missing-long-segment'};$cases+=,@('PS5-long-missing',$long,'REJECT');$cases+=,@('PS5-long-existing',LONGLEAF,'ACCEPT')
foreach($c in $cases){$a=Result Baseline $c[1];$b=Result NoReparse $c[1];if($a-cne$b-or$b-cne$c[2]){throw ('DIFFERENT_'+$c[0]+'_'+$a+'_'+$b)};'CASE='+$c[0]+':'+$b}
# Isolated denied-attributes fixture: restore its exact ACL even if either path fails.
$denied=Join-Path $root 'denied.txt';[IO.File]::WriteAllText($denied,'fixture');$original=[IO.File]::GetAccessControl($denied)
try{$acl=[IO.File]::GetAccessControl($denied);$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$ace=[Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::ReadAttributes,[Security.AccessControl.AccessControlType]::Deny);$acl.AddAccessRule($ace);[IO.File]::SetAccessControl($denied,$acl)
 $a=Result Baseline $denied;$b=Result NoReparse $denied;if($a-cne$b){throw ('DIFFERENT_ACL_'+$a+'_'+$b)};'ACL='+$a
}finally{[IO.File]::SetAccessControl($denied,$original)}
# Warmup and alternating rounds: no runtime payload or external path is scanned.
Baseline $leaf;NoReparse $leaf;$base=0.0;$next=0.0;$n=300
foreach($round in 1..3){$watch=[Diagnostics.Stopwatch]::StartNew();foreach($i in 1..$n){Baseline $leaf};$watch.Stop();$base+=$watch.Elapsed.TotalMilliseconds;$watch.Restart();foreach($i in 1..$n){NoReparse $leaf};$watch.Stop();$next+=$watch.Elapsed.TotalMilliseconds}
'BENCHMARK baselineMs='+[Math]::Round($base,3)+' nativeMs='+[Math]::Round($next,3)+' iterations='+($n*3)
`.replace('SOURCE',q(source)).replace('ROOT',q(root)).replace('LONGLEAF',q(longLeaf));
 const out=execFileSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$code=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($code))','utf16le').toString('base64')],{input:code,encoding:'utf8',windowsHide:true,timeout:60000});
 assert.match(out,/CASE=literal:ACCEPT/);assert.match(out,/CASE=broken-junction:REJECT/);assert.match(out,/ACL=/);assert.match(out,/BENCHMARK /);console.log(out.trim());
 }finally{assert.ok(root.startsWith(join(tmpdir(),'melisa-noreparse-')));rmSync(root,{recursive:true,force:true});}
});
