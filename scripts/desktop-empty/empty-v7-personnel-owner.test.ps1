# Parse definitions and exercise only the in-memory bounded pipe reader.
# No operational body, CIM, file ACL, DPAPI, SQL, owner lock or child invocation.
$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot 'empty-v7-personnel-owner.ps1';$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$errors)
if(@($errors).Count){throw 'PERSONNEL_OWNER_SYNTAX'}
$local=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'empty-v7-personnel-local.mjs'));$template=[regex]::Match($local,'return String\.raw`(?<body>[^`]+)`;')
if(-not$template.Success){throw 'PERSONNEL_PROBE_TEMPLATE'}
$probe=$template.Groups['body'].Value.Replace('${nodePid}','123').Replace('${ownerPid}','456').Replace('${ROOT}','C:/Users/Xaser/Desktop/ERP')
if($probe.Contains('${')){throw 'PERSONNEL_PROBE_INTERPOLATION'}
$probeTokens=$null;$probeErrors=$null;[void][Management.Automation.Language.Parser]::ParseInput($probe,[ref]$probeTokens,[ref]$probeErrors);if(@($probeErrors).Count){throw 'PERSONNEL_PROBE_SYNTAX'}
$commands=@($ast.FindAll({param($n)$n-is[Management.Automation.Language.CommandAst]-and$n.GetCommandName()-ceq'Add-Type'},$true));if($commands.Count-ne1){throw 'PERSONNEL_READER_SELECTION'}
. ([scriptblock]::Create($commands[0].Extent.Text))
foreach($limit in @(4096,2048)){
 $stream=[IO.MemoryStream]::new([byte[]]::new($limit));try{if([EmptyV7PersonnelBoundedReader]::Read($stream,$limit).GetAwaiter().GetResult().Length-ne$limit){throw 'PERSONNEL_READER_EXACT'}}finally{$stream.Dispose()}
 $stream=[IO.MemoryStream]::new([byte[]]::new($limit+1));$rejected=$false;try{[void][EmptyV7PersonnelBoundedReader]::Read($stream,$limit).GetAwaiter().GetResult()}catch{$rejected=$true}finally{$stream.Dispose()};if(-not$rejected){throw 'PERSONNEL_READER_OVERFLOW'}
}
[pscustomobject]@{state='PERSONNEL_OWNER_PURE_TESTS_PASS';syntaxErrors=0;observationProbeSyntaxErrors=0;readerLimits=@(4096,2048);operationalBodyExecuted=$false;observationExecuted=$false}|ConvertTo-Json -Compress
