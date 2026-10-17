param()
$ErrorActionPreference='Stop'
$taskRoot='C:\Sirket\ERP\evidence\ERP-CRM-EXPAND-20261009\private\crm'
$taskShared='C:\Sirket\ERP\runtime\ERP-CRM-EXPAND-20261009\shared-copy-config.json'
$taskAllow=Join-Path $taskRoot 'approved-conversations.json'
$taskInput=Join-Path $taskRoot 'current-native-input.json'
$taskQuery=Join-Path $taskRoot 'current-native-query.sql'
$taskBundle=Join-Path $taskRoot 'current-native-bundle.json'
foreach($taskFile in @($taskInput,$taskQuery,$taskBundle)){if(Test-Path -LiteralPath $taskFile){throw 'CRM_BUSINESS_CAPTURE_NEW_OUTPUT_REQUIRED'}}
$taskConfig=Get-Content -LiteralPath $taskShared -Raw|ConvertFrom-Json -AsHashtable -Depth 100
$taskSnapshot=Get-Content -LiteralPath $taskAllow -Raw|ConvertFrom-Json -AsHashtable -Depth 100
if($taskConfig.database-cne'MELISA_ERP_CRM_SHARED_TEST_20261009_02'-or$taskSnapshot.entries.Count-lt1-or$taskSnapshot.entries.Count-gt2000){throw 'CRM_BUSINESS_CAPTURE_SCOPE'}
$taskBody=@{catalog=$taskConfig.goal7SourceVersion;copy=@{copyId=$taskConfig.copyContext.copyId;backupSHA=$taskConfig.copyContext.backupSHA;target=$taskConfig.copyContext.target};approvedConversations=$taskSnapshot.entries}
[IO.File]::WriteAllText($taskInput,($taskBody|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
$taskConfig=$null
& node (Join-Path $PSScriptRoot 'capture-crm-order-current-context.mjs') extended-query $taskInput $taskQuery
if($LASTEXITCODE-ne0){throw 'CRM_BUSINESS_QUERY_COMPILER'}
$taskCn=[Data.SqlClient.SqlConnection]::new('Server=Semih\MELISADEV;Database=MELISA_ERP_CRM_SHARED_TEST_20261009_02;Integrated Security=True;Encrypt=False;Application Name=CRM-BUSINESS-CAPTURE')
try{
 $taskCn.Open();$taskCmd=$taskCn.CreateCommand();$taskCmd.CommandTimeout=900;$taskCmd.CommandText=[IO.File]::ReadAllText($taskQuery)
 $taskReader=$taskCmd.ExecuteReader();$taskSets=[Collections.Generic.List[object]]::new()
 try{do{$taskRows=[Collections.Generic.List[object]]::new();while($taskReader.Read()){$taskRow=[ordered]@{};for($taskColumn=0;$taskColumn-lt$taskReader.FieldCount;$taskColumn++){$taskRow[$taskReader.GetName($taskColumn)]=if($taskReader.IsDBNull($taskColumn)){$null}else{$taskReader.GetValue($taskColumn)}};$taskRows.Add($taskRow)};if($taskReader.FieldCount-gt0){$taskSets.Add($taskRows.ToArray())}}while($taskReader.NextResult())}finally{$taskReader.Close();$taskCmd.Dispose()}
 if($taskSets.Count-ne4){throw 'CRM_BUSINESS_CAPTURE_RESULT_SETS'}
 $taskBody.proof=$taskSets.ToArray();[IO.File]::WriteAllText($taskInput,($taskBody|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
}finally{$taskCn.Dispose()}
& node (Join-Path $PSScriptRoot 'capture-crm-order-current-context.mjs') extended-capture $taskInput $taskBundle
if($LASTEXITCODE-ne0){throw 'CRM_BUSINESS_CONTEXT_COMPILER'}
foreach($taskFile in @($taskInput,$taskQuery,$taskBundle)){
 $taskACL=Get-Acl -LiteralPath $taskFile;$taskACL.SetAccessRuleProtection($true,$false)
 foreach($taskAccount in @([Security.Principal.WindowsIdentity]::GetCurrent().Name,'NT AUTHORITY\SYSTEM')){$taskACL.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($taskAccount,'FullControl','Allow'))}
 Set-Acl -LiteralPath $taskFile -AclObject $taskACL
}
@{captured=$true;target='MELISA_ERP_CRM_SHARED_TEST_20261009_02';conversations=$taskSnapshot.entries.Count;businessWrites=0;secretsPrinted=0}|ConvertTo-Json -Compress
