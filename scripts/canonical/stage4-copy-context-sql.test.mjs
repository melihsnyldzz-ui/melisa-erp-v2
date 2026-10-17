import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stage4ContextSQL,stage4ContextHash} from './stage4-copy-context-sql.mjs';
import {COPY_DB,COPY_LOGIN,SOURCE_DB} from './stage4-copy-sql.mjs';

const sql=stage4ContextSQL();
test('context is a deterministic offline SELECT procedure pinned to the isolated copy',()=>{
 assert.equal(sql,stage4ContextSQL());
 assert.match(sql,/^CREATE PROCEDURE dbo\.usp_stage4_copy_context @copy_id uniqueidentifier,@actor_id bigint,@domain nvarchar\(20\) WITH EXECUTE AS OWNER/);
 assert.ok(sql.includes(`DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${COPY_DB}'`));
 assert.ok(sql.includes(`ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'${COPY_LOGIN}'`));
 assert.ok(sql.includes(`HAS_DBACCESS(N'${SOURCE_DB}')<>0`));
 assert.match(sql,/EXEC dbo\.usp_stage4_copy_ready @copy_id;/);
 const tokens=sql.replace(/N?'(?:''|[^'])*'/g,"''").replace(/@[A-Za-z_][A-Za-z0-9_]*/g,'@value');
 assert.doesNotMatch(tokens,/\b(?:UPDATE|DELETE|MERGE|TRUNCATE|ALTER|DROP|RESTORE|BACKUP)\b/i);
 assert.match(sql,/INSERT @permissions SELECT DISTINCT permission_key/);
 assert.doesNotMatch(sql,/\bINSERT\s+(?:INTO\s+)?(?:dbo|erp_migration)\./i);
});
test('missing or unknown schema, origin, seal, domain and actor fail closed',()=>{
 for(const [path,expected] of [['schemaVersion','melisa-stage4-isolated-operation-copy.v1'],['operationOrigin','ISOLATED_TEST_COPY'],['actualT1','false'],['target.database',COPY_DB],['date','2026-10-08']]){
  assert.ok(sql.includes(`ISNULL(JSON_VALUE(@p,'$.${path}'),N'')<>N'${expected}'`));
 }
 assert.match(sql,/ISNULL\(ISJSON\(@p\),0\)<>1/);
 assert.match(sql,/ISNULL\(JSON_VALUE\(@p,'\$\.sealHash'\),N''\)<>@seal/);
 assert.match(sql,/@domain IS NULL OR @domain COLLATE Latin1_General_100_BIN2 NOT IN\(N'trade',N'inbound',N'payment',N'daily'\)/);
 assert.match(sql,/@actor_id NOT IN\(15,16\) OR @actor_id IS NULL/);
 assert.match(sql,/STAGE4_CONTEXT_PROFILE/);
});
test('permissions are current native rows with an exact captured full-row hash and real active role',()=>{
 assert.match(sql,/SELECT p\.\* FROM dbo\.permissions p WHERE p\.role_id=@nativeRole ORDER BY p\.id FOR JSON PATH,INCLUDE_NULL_VALUES/);
 assert.match(sql,/s\.permissionsRowsHash=CONVERT\(varchar\(64\),HASHBYTES\('SHA2_256',@permissionRows\),2\)/);
 assert.match(sql,/s\.nativeRoleId=u\.role_id AND s\.nativeRoleCode=r\.code AND s\.role=r\.code/);
 assert.match(sql,/u\.is_active=1 AND r\.code=CASE @actor_id WHEN 15 THEN N'isolated_test_sales' ELSE N'isolated_test_ilker' END/);
 assert.match(sql,/WHERE role_id=@nativeRole AND can_view=1/);
 assert.match(sql,/@actor_id<>16 OR \(SELECT COUNT\(\*\) FROM @permissions WHERE permission_key IN\(N'finance\.view',N'supplier\.view'\)\)<>2/);
 assert.doesNotMatch(sql,/testAdminSession|admin_override|N'admin'/);
});
test('all four current procedure hashes are checked and returned rather than copied from a profile',()=>{
 for(const key of ['ready','context','begin','effects']){
  assert.ok(sql.includes(`OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_${key}'))`));
  assert.ok(sql.includes(`ISNULL(JSON_VALUE(@p,'$.sql.${key}.hash'),'')<>@${key==='context'?'contextHash':key}`));
 }
 assert.match(sql,/@ready IS NULL OR @contextHash IS NULL OR @begin IS NULL OR @effects IS NULL/);
 assert.match(sql,/\) proof_json,@actorJSON actor_json,@context context_json;/);
 assert.equal(stage4ContextHash(),createHash('sha256').update(sql,'utf16le').digest('hex').toUpperCase());
 const tampered=sql.replace("'STAGE4_CONTEXT_PERMISSION_DRIFT'","'IGNORED'");
 assert.notEqual(stage4ContextHash(),createHash('sha256').update(tampered,'utf16le').digest('hex').toUpperCase());
});
test('prices and source identities are selected by sealed IDs and current native equality, with TRY and finite scope gates',()=>{
 assert.match(sql,/v\.id=TRY_CONVERT\(bigint,x\.value\).*v\.product_id=s\.id AND v\.price_type=N'sale' AND v\.currency_code=N'TRY' AND v\.price=TRY_CONVERT\(decimal\(28,8\),s\.salePriceExact8\)/s);
 assert.match(sql,/TRY_CONVERT\(decimal\(28,8\),s\.purchasePriceExact8\) IS NULL/);
 assert.match(sql,/\(SELECT COUNT\(\*\) FROM OPENJSON\(@p,'\$\.products'\)\)<>2/);
 assert.match(sql,/ISNULL\(c\.source_record_key,N''\) COLLATE Latin1_General_100_BIN2<>s\.sourceKey COLLATE Latin1_General_100_BIN2/);
 assert.match(sql,/currency IS NULL OR currency<>N'TRY'/);
 assert.match(sql,/STAGE4_CONTEXT_PRICE_DRIFT/);
 assert.match(sql,/STAGE4_CONTEXT_PARTY_DRIFT/);
 assert.match(sql,/b\.barcode COLLATE Latin1_General_100_BIN2/);
 assert.doesNotMatch(sql,/CONVERT\([^)]*,b\.barcode\)|TRY_CONVERT\([^)]*,b\.barcode\)/);
});
test('balance and stock DTO projections reread native copy authority, preserving exact8 internally',()=>{
 assert.match(sql,/CONVERT\(decimal\(28,3\),p\.current_stock_qty\)/);
 assert.match(sql,/CONVERT\(decimal\(28,4\),a\.current_balance\)/);
 assert.match(sql,/CONVERT\(decimal\(28,8\),a\.current_balance\)\) balanceExact8/);
 assert.match(sql,/openingOrigin/);
 assert.match(sql,/CAST\(0 AS bit\) openingVerified,N'UNKNOWN' openingOrigin,CAST\(1 AS bit\) startingBalanceVerified/);
 assert.match(sql,/CONVERT\(decimal\(28,4\),s\.baselineBalanceExact4\)\) startingBalanceExact4/);
 assert.match(sql,/a\.opening_balance<>TRY_CONVERT\(decimal\(28,4\),s\.openingBalanceExact4\)/);
 assert.doesNotMatch(sql,/c\.current_balance/);
 assert.match(sql,/CAST\(0 AS bit\) synthetic/);
 assert.doesNotMatch(sql,/CAST\(1 AS bit\) synthetic|N'synthetic-test'/);
});
test('payment ownership uses same-copy committed journals, native FKs and actual effect components',()=>{
 assert.match(sql,/r\.copy_id=@copy_id AND r\.operation IN\(N'payment',N'payment_cancel'\)/);
 assert.match(sql,/m\.id=TRY_CONVERT\(bigint,JSON_VALUE\(r\.response_json,'\$\.payment\.id'\)\)/);
 assert.match(sql,/e\.copy_id=r\.copy_id AND e\.request_id=r\.request_id AND e\.entity='supplier' AND e\.native_id=m\.id/);
 assert.match(sql,/f\.party_type=N'supplier' AND f\.party_movement_id=m\.id AND f\.source_type=m\.movement_type/);
 assert.match(sql,/cancel\.operation=N'payment_cancel' AND cancel\.original_id=m\.id/);
 assert.match(sql,/N'work-stage4-copy-batch-receipt'/);
 assert.doesNotMatch(sql,/work_finops_scope|work_supplier_payment_requests|work-goal8-batch-receipt|work-finops-physical-receipt/);
 assert.match(sql,/FOR JSON PATH,INCLUDE_NULL_VALUES\)\) invoices/);
});
test('purchase invoices require original item/receipt links, this copy marker and verified finalize journal',()=>{
 assert.match(sql,/i\.id=l\.invoice_item_id AND i\.purchase_invoice_id=v\.id/);
 assert.match(sql,/g\.id=l\.receipt_line_id AND g\.product_id=i\.product_id/);
 assert.match(sql,/b\.supplier_id=v\.supplier_id AND b\.note LIKE @marker\+N'%'/);
 assert.match(sql,/r\.copy_id=@copy_id AND r\.operation=N'purchase_finalize'/);
 assert.match(sql,/HAVING COUNT\(DISTINCT g\.batch_id\)=1 AND COUNT\(\*\)=\(SELECT COUNT\(\*\) FROM dbo\.purchase_invoice_items z WHERE z\.purchase_invoice_id=v\.id\)/);
 assert.match(sql,/v\.account_amount-v\.paid-v\.returned/);
 assert.match(sql,/warehouse\.id/);
 assert.match(sql,/warehouse\.code/);
 assert.match(sql,/warehouse\.label/);
});
