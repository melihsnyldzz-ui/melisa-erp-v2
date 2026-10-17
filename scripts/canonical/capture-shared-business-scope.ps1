param(
 [ValidateSet('MELISA_ERP_SIRKET_TEST_20260929_01','MELISA_ERP_CRM_SHARED_TEST_20261009_01','MELISA_ERP_CRM_SHARED_TEST_20261009_02')][string]$Database='MELISA_ERP_CRM_SHARED_TEST_20261009_01',
 [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference='Stop'
$out=[IO.Path]::GetFullPath($OutputPath)
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if($out.StartsWith($repo+'\',[StringComparison]::OrdinalIgnoreCase)-or(Test-Path -LiteralPath $out)){throw 'BUSINESS_CAPTURE_PRIVATE_NEW_OUTPUT_REQUIRED'}
if(-not(Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($out)))){throw 'BUSINESS_CAPTURE_OUTPUT_PARENT_REQUIRED'}
# This imported module is a pure query compiler. It never imports SQL drivers or
# private configs. Credentials are Windows-integrated and never serialized.
$moduleURI=([uri](Join-Path $PSScriptRoot 'shared-business-scope.mjs')).AbsoluteUri
$code="import {businessScopeCaptureQueries} from '$moduleURI';process.stdout.write(JSON.stringify(businessScopeCaptureQueries()));"
$queries=(& node --input-type=module -e $code)|ConvertFrom-Json -AsHashtable
if($LASTEXITCODE-ne 0){throw 'BUSINESS_CAPTURE_QUERY_COMPILER'}
$cn=[Data.SqlClient.SqlConnection]::new("Server=Semih\MELISADEV;Database=$Database;Integrated Security=True;Encrypt=False;Application Name=ERP-CRM-BUSINESS-SCOPE-SELECT")
function Rows([string]$sql){
 if($sql-match '(?i)\b(INSERT|UPDATE|DELETE|MERGE|EXEC|ALTER|CREATE|DROP|TRUNCATE|BACKUP|RESTORE|DBCC)\b'){throw 'BUSINESS_CAPTURE_SELECT_ONLY'}
 $cmd=$cn.CreateCommand();$cmd.CommandTimeout=900;$cmd.CommandText=$sql;$r=$cmd.ExecuteReader();$rows=[Collections.Generic.List[object]]::new()
 try{while($r.Read()){$row=[ordered]@{};for($i=0;$i-lt$r.FieldCount;$i++){$row[$r.GetName($i)]=if($r.IsDBNull($i)){$null}else{$r.GetValue($i)}};$rows.Add([pscustomobject]$row)}}finally{$r.Close();$cmd.Dispose()};return $rows.ToArray()
}
try{
 $cn.Open();$identity=@(Rows $queries.identity)
 if($identity.Count-ne 1-or$identity[0].server-cne 'Semih\MELISADEV'-or$identity[0].database-cne $Database-or$identity[0].openTransactions-ne 0){throw 'BUSINESS_CAPTURE_IDENTITY'}
 $capture=[ordered]@{schemaVersion='melisa-shared-business-capture.v1';businessWrites=0;capturedAt=[DateTime]::UtcNow.ToString('o');identity=$identity}
 foreach($name in @('manifest','products','prices','barcodes','customers','suppliers','holds','personnel','actors','financeAccounts','rates','protectedCounts')){$capture[$name]=@(Rows $queries[$name])}
 $end=@(Rows $queries.identity);if($end[0].openTransactions-ne 0-or$end[0].database-cne $Database){throw 'BUSINESS_CAPTURE_END_IDENTITY'}
 [IO.File]::WriteAllText($out,($capture|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
 @{captured=$true;database=$Database;businessWrites=0;products=$capture.products.Count;prices=$capture.prices.Count;holds=$capture.holds.Count;secretsSaved=$false}|ConvertTo-Json -Compress
}finally{$cn.Dispose()}
