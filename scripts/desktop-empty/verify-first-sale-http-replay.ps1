$ErrorActionPreference='Stop';$source='C:\Users\Xaser\Desktop\ERP\kaynak';$connection=$null;$secret=$null
. (Join-Path $source 'scripts\desktop-empty\first-sale-runner-common.ps1')
try{
 $expected=Invoke-FirstSaleNode @('scripts/desktop-empty/verify-first-sale-http-replay.mjs','--hash') $null;if($expected -cnotmatch '^[a-f0-9]{64}$'){throw 'HASH_REJECTED'}
 $connection=Open-FirstSaleAdmin
 $query="IF DB_ID()<>5 OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))<>N'Semih\MELISAERP' OR CONVERT(int,SERVERPROPERTY('ProcessID'))<>5240 OR SUSER_SID()<>SUSER_SID(N'SEMIH\Xaser') OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=5 AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1') THROW 51995,'TARGET_REJECTED',1;SELECT LOWER(CONVERT(varchar(64),payload_hash,2)) FROM dbo.desktop_sale_workflow_requests WHERE request_id='62f30223-56e9-4152-94e3-90a693293703' AND invoice_id=5 AND actor_id=30002 AND operation='DISPATCH';"
 if([string](Read-FirstSaleScalar $connection $query) -cne $expected){throw 'ORIGINAL_BODY_HASH_REJECTED'};$connection.Dispose();$connection=$null
 $secret=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes('C:\Users\Xaser\Desktop\ERP\kurulum\melisa-desktop-test-operator.dpapi'),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $result=Invoke-FirstSaleNode @('scripts/desktop-empty/verify-first-sale-http-replay.mjs') $secret;if($result -cne 'FIRST_SALE_EXACT_HTTP_REPLAY_TWICE_VERIFIED'){throw 'RESULT_REJECTED'}
 $record=@{state=$result;time=[DateTime]::UtcNow.ToString('o');invoiceId='5';originalRequestId='62f30223-56e9-4152-94e3-90a693293703';bodyHash=$expected;replays=2;guiReplay=$false};Write-FirstSaleNew 'C:\Users\Xaser\Desktop\ERP\kurulum\first-sale-http-replay.json' $record;[Console]::WriteLine($result)
}finally{if($secret){[Security.Cryptography.CryptographicOperations]::ZeroMemory($secret)};if($connection){$connection.Dispose()}}
