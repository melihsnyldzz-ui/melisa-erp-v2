param([Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$out=[IO.Path]::GetFullPath($OutputPath)
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if($out.StartsWith($repo+'\',[StringComparison]::OrdinalIgnoreCase)-or(Test-Path -LiteralPath $out)){throw 'SUPPLIER_CONTACT_CAPTURE_PRIVATE_NEW_OUTPUT_REQUIRED'}
if(-not(Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($out)))){throw 'SUPPLIER_CONTACT_CAPTURE_OUTPUT_PARENT_REQUIRED'}
$moduleURI=([uri](Join-Path $PSScriptRoot 'shared-business-supplier-contact-capture.mjs')).AbsoluteUri
$code="import {supplierContactCaptureQueries} from '$moduleURI';process.stdout.write(JSON.stringify(supplierContactCaptureQueries()));"
$queries=(& node --input-type=module -e $code)|ConvertFrom-Json
if($LASTEXITCODE-ne 0){throw 'SUPPLIER_CONTACT_CAPTURE_QUERY_COMPILER'}
$cn=[Data.SqlClient.SqlConnection]::new('Server=Semih\MELISADEV;Database=MELISA_ERP_CRM_SHARED_TEST_20261009_02;Integrated Security=True;Encrypt=False;Application Name=SUPPLIER-CONTACT-METADATA-SELECT')
function Rows([string]$sql){
 if($sql-match '(?i)\b(INSERT|UPDATE|DELETE|MERGE|EXEC|ALTER|CREATE|DROP|TRUNCATE|BACKUP|RESTORE|DBCC)\b'){throw 'SUPPLIER_CONTACT_CAPTURE_SELECT_ONLY'}
 $cmd=$cn.CreateCommand();$cmd.CommandTimeout=120;$cmd.CommandText=$sql;$r=$cmd.ExecuteReader();$rows=[Collections.Generic.List[object]]::new()
 try{while($r.Read()){$row=[ordered]@{};for($i=0;$i-lt$r.FieldCount;$i++){$row[$r.GetName($i)]=if($r.IsDBNull($i)){$null}else{$r.GetValue($i)}};$rows.Add([pscustomobject]$row)}}finally{$r.Close();$cmd.Dispose()};return $rows.ToArray()
}
function Identity {
 $rows=@(Rows $queries.identity)
 if($rows.Count-ne 1-or$rows[0].server-cne 'Semih\MELISADEV'-or$rows[0].database-cne 'MELISA_ERP_CRM_SHARED_TEST_20261009_02'-or$rows[0].openTransactions-ne 0-or$rows[0].canViewDefinition-ne 1){throw 'SUPPLIER_CONTACT_CAPTURE_IDENTITY'}
 return $rows[0]
}
try{
 $cn.Open();$identity=Identity
 $capture=[ordered]@{schemaVersion='melisa-supplier-contact-metadata-capture.v1';readOnly=$true;businessWrites=0;capturedAt=[DateTime]::UtcNow.ToString('o');identity=$identity}
 $names=@('columns','indexes','checks','foreignKeys','modules','dependencies')
 foreach($name in $names){$capture[$name]=@(Rows $queries.$name)}
 if($capture.columns.Count-eq 0-or$capture.modules.Count-eq 0-or@($capture.modules|Where-Object {$null-eq $_.definition-or$null-eq $_.definitionHash}).Count-ne 0){throw 'SUPPLIER_CONTACT_CAPTURE_METADATA_INCOMPLETE'}
 # Repeat only metadata, rejecting observed concurrent DDL drift. This is not
 # a database snapshot or native writer activation/registration proof.
 foreach($name in $names){$again=@(Rows $queries.$name);if(($again|ConvertTo-Json -Depth 20 -Compress)-cne($capture[$name]|ConvertTo-Json -Depth 20 -Compress)){throw 'SUPPLIER_CONTACT_CAPTURE_METADATA_CHANGED'}}
 $end=Identity;if($end.sessionId-ne $identity.sessionId){throw 'SUPPLIER_CONTACT_CAPTURE_SESSION_CHANGED'}
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($capture|ConvertTo-Json -Depth 30))
 # CreateNew also prevents a race from overwriting pre-existing evidence.
 $stream=[IO.File]::Open($out,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
 @{captured=$true;businessWrites=0;columns=$capture.columns.Count;modules=$capture.modules.Count;containsBusinessRows=$false;nativeActivated=$false}|ConvertTo-Json -Compress
}finally{$cn.Dispose()}

