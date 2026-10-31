param(
  [Parameter(Mandatory=$true)][string]$RuntimeConfig,
  [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')][string]$RequestId
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$connection=$null
$transaction=$null
$readBudget=$null
$stage='configuration'
function Read-Rows([string]$query, [hashtable]$parameters=@{}) {
  $command=$connection.CreateCommand()
  $reader=$null
  try {
    if($readBudget -and $readBudget.ElapsedMilliseconds -gt 1500){throw 'DIAGNOSTIC_READ_BUDGET_EXCEEDED'}
    $command.CommandTimeout=1
    if($transaction){$command.Transaction=$transaction}
    $command.CommandText=$query
    foreach($key in $parameters.Keys) {
      $value=$parameters[$key]
      $type=if($value -is [Guid]){[Data.SqlDbType]::UniqueIdentifier}else{[Data.SqlDbType]::BigInt}
      $null=$command.Parameters.Add($key,$type)
      $command.Parameters[$key].Value=$value
    }
    $reader=$command.ExecuteReader()
    $table=[Data.DataTable]::new()
    $table.Load($reader)
    return ,@(foreach($row in $table.Rows){
      $result=[ordered]@{}
      foreach($column in $table.Columns){$value=$row[$column.ColumnName];$result[$column.ColumnName]=if($value -is [DBNull]){$null}else{$value}}
      [pscustomobject]$result
    })
  } finally {if($reader){$reader.Dispose()};$command.Dispose()}
}
try {
  $config=Get-Content -LiteralPath $RuntimeConfig -Raw | ConvertFrom-Json
  if([Environment]::MachineName -ine 'SEMIH' -or $config.database -cne 'MELISA_ERP_SIRKET_TEST_20260929_01' -or $config.server -cne '127.0.0.1' -or [int]$config.sqlPort -ne 1433 -or $config.sqlUser -cne 'melisa_sirket_test_20260929_01') {throw 'DIAGNOSTIC_TARGET_REJECTED'}
  $builder=[Data.SqlClient.SqlConnectionStringBuilder]::new()
  # The installed SQL certificate names Semih, not 127.0.0.1. Keep TLS and
  # certificate verification enabled, and verify SQL identity after connecting.
  $builder['Data Source']='tcp:Semih,1433'
  $builder['Initial Catalog']=$config.database
  $builder['User ID']=$config.sqlUser
  $builder['Password']=$config.sqlPassword
  $builder['Encrypt']=$true
  $builder['TrustServerCertificate']=$false
  $builder['Connect Timeout']=5
  $builder['Application Name']='MelisaMcpReadOnlyDiagnostics'
  $connection=[Data.SqlClient.SqlConnection]::new($builder.ConnectionString)
  $stage='connection'
  $connection.Open()
  $stage='identity'
  $identityRows=Read-Rows @"
SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,
 ORIGINAL_LOGIN() loginName,IS_SRVROLEMEMBER('sysadmin') sysadmin,
 HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') databaseControl,
 (SELECT COUNT(*) FROM fn_my_permissions(NULL,'DATABASE') WHERE permission_name IN('ALTER','CONTROL','CREATE TABLE','CREATE PROCEDURE','ALTER ANY USER','ALTER ANY ROLE')) elevatedPermissions;
"@
  if($identityRows.Count -ne 1){throw 'DIAGNOSTIC_READER_IDENTITY_REJECTED'}
  $identity=$identityRows[0]
  if($identity.databaseName -cne $config.database -or $identity.serverName -cne 'Semih\MELISADEV' -or $identity.loginName -cne $config.sqlUser -or $identity.sysadmin -ne 0 -or $identity.databaseControl -ne 0 -or $identity.elevatedPermissions -ne 0){throw 'DIAGNOSTIC_READER_IDENTITY_REJECTED'}
  $stage='permissions'
  $permissions=Read-Rows @"
SELECT v.objectName,HAS_PERMS_BY_NAME(v.objectName,'OBJECT','SELECT') canRead,
 HAS_PERMS_BY_NAME(v.objectName,'OBJECT','INSERT') canInsert,
 HAS_PERMS_BY_NAME(v.objectName,'OBJECT','UPDATE') canUpdate,
 HAS_PERMS_BY_NAME(v.objectName,'OBJECT','DELETE') canDelete
FROM (VALUES ('dbo.work_trade_requests'),('dbo.work_sales_links'),('dbo.sales_invoices'),
 ('dbo.sales_invoice_items'),('dbo.stock_movements'),('dbo.customer_movements'),('dbo.party_currency_accounts')) v(objectName);
"@
  foreach($permission in $permissions){if($permission.canInsert -ne 0 -or $permission.canUpdate -ne 0 -or $permission.canDelete -ne 0){throw 'DIAGNOSTIC_READER_WRITABLE'}}
  $output=[ordered]@{readAtUtc=[DateTime]::UtcNow.ToString('o');readOnly=$true;identity=$identity;permissions=$permissions}
  if($RequestId){
    $stage='request'
    foreach($permission in $permissions){if($permission.canRead -ne 1){throw 'DIAGNOSTIC_SELECT_UNAVAILABLE'}}
    # A single bounded serializable read covers journal, invoice and all effects.
    # Do not alter shared database isolation settings or read dirty rows. Yield
    # quickly to an active writer; lock contention is UNKNOWN, never success.
    $settings=$connection.CreateCommand()
    try{$settings.CommandText='SET LOCK_TIMEOUT 500;';$null=$settings.ExecuteNonQuery()}finally{$settings.Dispose()}
    $transaction=$connection.BeginTransaction([Data.IsolationLevel]::Serializable)
    $readBudget=[Diagnostics.Stopwatch]::StartNew()
    $output.consistency='serializable-bounded-read'
    $params=@{'@requestId'=[Guid]::Parse($RequestId)}
    $journal=Read-Rows @"
SELECT operation,CONVERT(varchar(20),actor_id) actorId,
 CONVERT(varchar(20),TRY_CONVERT(bigint,JSON_VALUE(response_json,'$.invoice.id'))) invoiceId,
 JSON_VALUE(response_json,'$.invoice.status') recordedStatus
FROM dbo.work_trade_requests WHERE request_id=@requestId;
"@ $params
    # A missing journal does not establish rollback or authorize another POST.
    $ids=@($journal | ForEach-Object invoiceId | Where-Object { $null -ne $_ } | Sort-Object -Unique)
    $output.requestId=$RequestId.ToLowerInvariant()
    $output.journal=$journal
    $output.invoices=@()
    if($ids.Count -gt 1){throw 'DIAGNOSTIC_REQUEST_LINK_CONFLICT'}
    foreach($invoiceId in $ids){
      $p=@{'@invoiceId'=[long]$invoiceId}
      $headers=Read-Rows @"
SELECT CONVERT(varchar(20),id) invoiceId,LOWER(status) status,
 CONVERT(varchar(20),customer_id) customerId,CONVERT(varchar(20),party_currency_account_id) accountId,
 document_currency currency,CONVERT(varchar(80),CONVERT(decimal(28,8),grand_total)) totalExact,
 CONVERT(varchar(18),row_version,1) revision
FROM dbo.sales_invoices WHERE id=@invoiceId;
"@ $p
      if($headers.Count -ne 1){throw 'DIAGNOSTIC_INVOICE_MISSING'}
      $creation=Read-Rows @"
SELECT TOP(2) CONVERT(bit,CASE WHEN l.actor_id=17 AND i.created_by=17 AND j.actor_id=17 AND j.operation=N'sale_draft'
 AND TRY_CONVERT(bigint,JSON_VALUE(j.response_json,'$.invoice.id'))=i.id
 AND JSON_VALUE(j.response_json,'$.requestId')=CONVERT(varchar(36),l.request_id)
 AND JSON_VALUE(j.response_json,'$.invoice.status')=N'draft'
 AND JSON_VALUE(l.preview_json,'$.testProfile')=N'B6-CANONICAL-BUSINESS-SALE-V1'
 AND JSON_VALUE(l.preview_json,'$.operationOrigin')=N'CANONICAL_TEST_BUSINESS_SALE'
 AND TRY_CONVERT(bigint,JSON_VALUE(l.preview_json,'$.selection.customerId'))=i.customer_id
 AND TRY_CONVERT(bigint,JSON_VALUE(l.preview_json,'$.selection.customerAccountId'))=i.party_currency_account_id
 AND JSON_VALUE(l.preview_json,'$.selection.currency')=i.document_currency
 AND LEN(JSON_VALUE(l.preview_json,'$.canonicalBusinessSaleProfileHash'))=64
 AND JSON_VALUE(p.proof,'$.profileHash')=JSON_VALUE(l.preview_json,'$.canonicalBusinessSaleProfileHash')
 AND JSON_VALUE(p.proof,'$.actorId')=N'17' AND JSON_VALUE(p.proof,'$.operation')=N'sale_draft'
 AND JSON_VALUE(p.proof,'$.requestId')=CONVERT(varchar(36),l.request_id)
 AND TRY_CONVERT(bigint,JSON_VALUE(p.proof,'$.customerId'))=i.customer_id
 AND TRY_CONVERT(bigint,JSON_VALUE(p.proof,'$.accountId'))=i.party_currency_account_id
 AND TRY_CONVERT(bigint,JSON_VALUE(p.proof,'$.partyEntityId'))=i.party_entity_id
 AND JSON_VALUE(p.proof,'$.currency')=i.document_currency THEN 1 ELSE 0 END) verified
FROM dbo.work_sales_links l JOIN dbo.sales_invoices i ON i.id=l.invoice_id
LEFT JOIN dbo.work_trade_requests j ON j.request_id=l.request_id
OUTER APPLY OPENJSON(l.preview_json) WITH(proof nvarchar(max) '$.nativeCreationProofJSON') p
WHERE l.invoice_id=@invoiceId;
"@ $p
      $items=Read-Rows @"
SELECT TOP(201) CONVERT(varchar(20),product_id) productId,COUNT_BIG(*) rowCount,
 CONVERT(varchar(80),SUM(CONVERT(decimal(28,8),quantity))) quantityExact
FROM dbo.sales_invoice_items WHERE sales_invoice_id=@invoiceId GROUP BY product_id;
"@ $p
      $stock=Read-Rows @"
SELECT TOP(401) CONVERT(varchar(20),product_id) productId,movement_type kind,affects_inventory affectsInventory,COUNT_BIG(*) rowCount,
 CONVERT(varchar(80),SUM(CONVERT(decimal(28,8),quantity_net))) quantityExact
FROM dbo.stock_movements WHERE source_type=N'sales_invoice' AND source_id=@invoiceId GROUP BY product_id,movement_type,affects_inventory;
"@ $p
      $ledger=Read-Rows @"
SELECT TOP(21) movement_type kind,CONVERT(varchar(20),customer_id) customerId,
 CONVERT(varchar(20),party_currency_account_id) accountId,currency_code currency,affects_balance affectsBalance,
 COUNT_BIG(*) rowCount,CONVERT(varchar(80),SUM(CONVERT(decimal(28,8),balance_effect_exact))) amountExact
FROM dbo.customer_movements WHERE sales_invoice_id=@invoiceId
GROUP BY movement_type,customer_id,party_currency_account_id,currency_code,affects_balance;
"@ $p
      $account=Read-Rows @"
SELECT CONVERT(varchar(20),a.id) accountId,CONVERT(varchar(20),a.customer_id) customerId,a.currency_code currency
FROM dbo.party_currency_accounts a JOIN dbo.sales_invoices i ON i.party_currency_account_id=a.id WHERE i.id=@invoiceId;
"@ $p
      $after=Read-Rows 'SELECT CONVERT(varchar(18),row_version,1) revision FROM dbo.sales_invoices WHERE id=@invoiceId;' $p
      if($after.Count -ne 1 -or $headers[0].revision -cne $after[0].revision){throw 'DIAGNOSTIC_SALE_CHANGED_DURING_READ'}
      if($items.Count -gt 200 -or $stock.Count -gt 400 -or $ledger.Count -gt 20){throw 'DIAGNOSTIC_RESULT_LIMIT'}
      $output.invoices+=@{header=$headers[0];creation=$creation;items=$items;stock=$stock;ledger=$ledger;account=$account}
    }
    $transaction.Commit()
    $transaction.Dispose()
    $transaction=$null
  }
  $output | ConvertTo-Json -Depth 8 -Compress
} catch {
  $message=$_.Exception.Message
  $code=if($message -cmatch '^DIAGNOSTIC_[A-Z_]+$'){$message}elseif($message -match '(?i)certificate|SSL|TLS|sertifika'){'DIAGNOSTIC_TLS_VALIDATION_FAILED'}else{'DIAGNOSTIC_SQL_READ_FAILED'}
  [ordered]@{error=$code;stage=$stage;errorType=$_.Exception.GetType().Name;line=$_.InvocationInfo.ScriptLineNumber;readOnly=$true;readAtUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress
  exit 1
} finally {if($transaction){$transaction.Dispose()};if($connection){$connection.Dispose()}}
