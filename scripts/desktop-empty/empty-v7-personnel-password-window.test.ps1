# Source/AST and in-memory byte-reader tests only. No GUI, DPAPI, files created,
# credential input, OS probe, SQL connection or operational script body.
$ErrorActionPreference='Stop'
$file=Join-Path $PSScriptRoot 'empty-v7-personnel-password-window.ps1'
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors)
if(@($errors).Count){throw 'PASSWORD_WINDOW_PARSE_FAILED'}
$strings=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.StringConstantExpressionAst]},$true)|Where-Object {$_.Value.Contains('public static class PersonnelPasswordWindowNative')})
if($strings.Count-ne1){throw 'PASSWORD_READER_SOURCE_UNIQUE'}
Add-Type -TypeDefinition $strings[0].Value
foreach($size in @(0,1,1024,8192)){
 $bytes=[byte[]]::new($size);for($i=0;$i-lt$size;$i++){$bytes[$i]=[byte]($i%251)}
 $s=[IO.MemoryStream]::new($bytes,$false);try{$output=[PersonnelPasswordWindowNative]::ReadBounded($s,8192).GetAwaiter().GetResult();if($output.Length-ne$size-or-not[System.Linq.Enumerable]::SequenceEqual([byte[]]$bytes,[byte[]]$output)){throw 'PASSWORD_READER_CONTENT'};[Security.Cryptography.CryptographicOperations]::ZeroMemory($output)}finally{$s.Dispose();[Security.Cryptography.CryptographicOperations]::ZeroMemory($bytes)}
}
$bytes=[byte[]]::new(8193);$s=[IO.MemoryStream]::new($bytes,$false);$rejected=$false
try{try{$null=[PersonnelPasswordWindowNative]::ReadBounded($s,8192).GetAwaiter().GetResult()}catch{$rejected=$true};if(-not$rejected){throw 'PASSWORD_READER_OVERFLOW_ACCEPTED'}}finally{$s.Dispose();[Security.Cryptography.CryptographicOperations]::ZeroMemory($bytes)}
$text=[IO.File]::ReadAllText($file)
foreach($require in @('UseSystemPasswordChar=$true','[IO.FileMode]::CreateNew','DataProtectionScope]::CurrentUser','origin=''HUMAN_ENTRY''','sharedTestPassword=$true','Array.Clear(storage,0,storage.Length)','Array.Clear(b,0,b.Length)')){if(-not$text.Contains($require)){throw 'PASSWORD_WINDOW_BOUNDARY_MISSING'}}
[pscustomobject]@{state='PASSWORD_WINDOW_SOURCE_AND_MEMORY_READER_PASS';parseErrors=0;readerCases=5;GUI=$false;DPAPI=$false;SQL=$false;operationalBodyExecuted=$false}|ConvertTo-Json -Compress
