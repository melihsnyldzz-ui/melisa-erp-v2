import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileCanonicalBusinessSaleOwnerSQL as compile,compileCanonicalBusinessSaleOwnerFromFrozenBefore as frozen,canonicalBusinessSaleInvoiceRevisionSQL as invoiceRevision,CANONICAL_BUSINESS_SALE_OWNER as O,CANONICAL_BUSINESS_SALE_REQUIRED_NATIVE_COLUMNS as columns,canonicalBusinessSaleTypedEncoding as encode,canonicalBusinessSaleTypedHash as hash,canonicalBusinessSaleOwnerProfileHash as profileHash,CANONICAL_BUSINESS_SALE_NATIVE_HASH_SQL as hashes} from './canonical-business-sale-owner-sql.mjs';
function fixture(){return {before:{identityJson:{databaseName:O.database,serverName:O.server},columnsJson:Object.entries(columns).flatMap(([tableName,cols])=>cols.map(columnName=>({schemaName:'dbo',tableName,columnName}))),modulesJson:[{schemaName:'dbo',name:O.reader.slice(4),definitionHash:O.readerHash}]},profile:{date:'2026-10-28',roleCode:O.roleCode,permissionHash:'A'.repeat(64),beforeMetadataHash:'B'.repeat(64),captureHash:'C'.repeat(64),catalogReaderHash:O.readerHash,products:[{productId:'101',sourceHash:'D'.repeat(64),unitSourceId:'1',factorExact8:'1.00000000',costKnown:true}],accounts:[{accountId:'201',customerId:'301',partyEntityId:'401',currency:'TRY',sourceHash:'E'.repeat(64)}],quotes:[{quoteId:'501',productId:'101',sourceHash:'F'.repeat(64)}],rates:[]},effectsPins:{guardHash:'1'.repeat(64),effectsHash:'2'.repeat(64),pcaGuardHash:'3'.repeat(64),projectionHash:'4'.repeat(64),projectionGuardHash:'5'.repeat(64),legacyReadyHash:'6'.repeat(64),legacyGoal8Hash:'7'.repeat(64)}};}
const module=(r,n)=>r.modules.find(m=>m.name===O[n]).definition;
const rejects=(fn,code)=>assert.throws(fn,e=>e.code===code);

test('typed native hash framing uses UTF16 bytes, explicit NULL, empty and trailing-space distinctions',()=>{
 assert.equal(encode([null,'','A','A ','😀']),'-1:;0:;2:A;4:A ;4:😀;');
 assert.notEqual(hash([null]),hash(['']));assert.notEqual(hash(['A']),hash(['A ']));
 const wire=encode(['Kaynak','0161',null]);assert.equal(hash(['Kaynak','0161',null]),createHash('sha256').update(wire,'utf16le').digest('hex').toUpperCase());
 assert.match(hashes.product,/DATALENGTH/);assert.doesNotMatch(hashes.product,/current_stock_qty/);assert.doesNotMatch(hashes.account,/current_balance/);
 assert.match(hashes.quote,/decimal\(28,8\)/);assert.match(hashes.product,/decimal\(18,4\)/);rejects(()=>encode([undefined]),'B6_OWNER_TYPED_VALUE');
});
test('generated permission snapshot avoids the RTM ordered-aggregate wrapper failure without changing its hash contract',()=>{
 const ready=module(compile(fixture()),'ready');
 assert.match(ready,/HASHBYTES\('SHA2_256',ISNULL\(STRING_AGG\(CONVERT\(nvarchar\(max\),/);
 assert.doesNotMatch(ready,/COALESCE\(STRING_AGG/);
 assert.match(ready,/WITHIN GROUP\(ORDER BY p\.permission_key COLLATE Latin1_General_100_BIN2\),N''\)\),2\) FROM dbo\.permissions p WHERE p\.role_id=17/);
 for(const field of ['permission_key','can_view','can_create','can_update','can_delete','can_approve'])assert(ready.includes('DATALENGTH(CONVERT(nvarchar(max),p.'+field+'))'));
 assert(ready.includes("(SELECT COUNT(*) FROM dbo.permissions WHERE role_id=17)<>36"));
 assert(ready.includes("B6_OWNER_PERMISSIONS"));assert(ready.includes("B6_OWNER_TARGET"));
});
test('owner compiler emits sealed-table/procedure SQL and exact prepared permissions, not an installer or replacement journal',()=>{
 const r=compile(fixture());assert.equal(r.installable,false);assert.equal(r.status,'COHERENT_MIGRATION_REQUIRED');
 assert.equal(r.tables.length,6);assert.equal(r.modules.length,10);assert.equal(r.requiresEffectsCompiler,true);assert.equal(r.requiresImmutableSuccessorProjection,true);
 for(const k of ['businessWrites','legacyManifestWrites','journalReplacement','permissionsApplied','broadPermissionGrants','nativePermissionChanges'])assert.equal(r[k],0);assert.equal(r.grants,11);assert.equal(r.executeGrants,4);assert.equal(r.viewDefinitionGrants,7);
 assert(r.tables.some(s=>s.includes('phase_json nvarchar(max) NOT NULL')));assert(r.tables[0].includes('pca_guard_hash char(64) NOT NULL'));
 assert(!r.seedSQL.includes('__READY_HASH_LITERAL__'));assert(r.seedSQL.includes(profileHash(fixture().profile)));
 assert.doesNotMatch([...r.tables,r.seedSQL,...r.modules.map(m=>m.definition)].join('\n'),/\bGRANT\b|CREATE TABLE dbo\.work_trade_requests|DISABLE TRIGGER|UPDATE dbo\.(?:products|customers|party_currency_accounts)/i);
 for(const m of r.modules)assert.equal(m.definitionHash,createHash('sha256').update(m.definition,'utf16le').digest('hex').toUpperCase());
 assert(Object.isFrozen(r)&&Object.isFrozen(r.modules)&&r.modules.every(Object.isFrozen));
 assert.equal(r.permissionSQL.filter(s=>s.startsWith('GRANT EXECUTE')).length,4);assert.equal(r.permissionSQL.filter(s=>s.startsWith('GRANT VIEW DEFINITION')).length,7);assert.equal(r.permissionSQL.filter(s=>s.startsWith('DENY SELECT,INSERT,UPDATE,DELETE')).length,6);assert(r.permissionSQL.every(s=>s.includes('['+O.login+']')));
 for(const n of [O.ready,O.resolve,'dbo.usp_canonical_business_sale_guard_v1'])assert(!r.permissionSQL.some(s=>s.startsWith('GRANT')&&s.includes('::'+n+' ')));
});
test('replay verifies actor, operation, exact raw body/hash before native source price/stock resolution',()=>{
 const b=module(compile(fixture()),'begin');const read=b.indexOf('FROM dbo.work_trade_requests WITH(UPDLOCK,HOLDLOCK)'),replay=b.indexOf('REPLAY_CONFLICT'),ret=b.indexOf('RETURN; END;'),resolve=b.indexOf('EXEC '+O.resolve);
 assert(read>=0&&read<replay&&replay<ret&&ret<resolve);assert.match(b,/CONVERT\(varbinary\(max\),@oldBody\)<>CONVERT\(varbinary\(max\),@payload_json\)/);
 assert.match(b,/HASHBYTES\('SHA2_256',@payload_json\)/);assert.match(b,/CAST\(1 AS bit\) replayed,@response response_json/);
 assert.match(b,/request_id=@request_id/);assert.doesNotMatch(b,/INSERT dbo\.work_trade_requests/);
});
test('begin resolves owner-source context in the same transaction, independently recomputes previews and retains unmodified raw JSON',()=>{
 const r=compile(fixture()),b=module(r,'begin'),resolve=module(r,'resolve');
 assert.match(b,/LockMode=N'Exclusive'.*LockOwner=N'Transaction'/);assert.match(b,/STALE_PREVIEW/);assert.match(b,/JSON_MODIFY\(@proof,'\$\.context',JSON_QUERY\(@context\)\)/);
 assert.match(b,/VALUES\(@@SPID,CURRENT_TRANSACTION_ID\(\),@request_id,@actor_id,@operation,@bodyHash,@payload_json,@proof,@before,@invoice,N'ISSUED',N'\{\}'\)/);
 assert.doesNotMatch(b,/SET @payload_json|JSON_MODIFY\(@payload_json/);assert.match(resolve,/CANONICAL_PREVIEW_V1/);assert.match(resolve,/SET @preview=LOWER/);assert.match(resolve,/SET @revision=LOWER/);
 assert.match(resolve,/price4=ROUND\(q.price,4\),line4=i.quantity\*ROUND\(q.price,4\)/);assert.match(resolve,/@try=ROUND\(@total\*@rate,4\)/);
 assert.match(resolve,/@total>500 OR @try<=0 OR @try>500/);
});
test('owner context uses exact native provenance, holds, date-bound FX, account precision and supported unit',()=>{
 const sql=module(compile(fixture()),'resolve');assert.match(sql,/a.current_balance IS NOT NULL/);assert.match(sql,/@balance decimal\(28,8\)/);assert.match(sql,/a.supplier_id IS NULL/);
 assert.match(sql,/p.unit COLLATE Latin1_General_100_BIN2=N'ADET'/);assert.match(sql,/q.price_type COLLATE Latin1_General_100_BIN2=N'sale'/);
 assert.match(sql,/q.source_unit_id=s.unit_source_id/);assert.match(sql,/p.average_cost_try IS NOT NULL/);assert.match(sql,/operation_quarantine_holds/);
 assert.match(sql,/r.rate_date<=@date ORDER BY r.rate_date DESC,r.id DESC/);assert.match(sql,/IF @currency=N'TRY' SELECT @rate=1/);assert.match(sql,/RATE_SOURCE/);
 for(const name of ['source_record_key','migration_run_id','source_payload_hash'])assert(sql.includes(name));
 assert.match(sql,/nativeExpected/);assert.match(sql,/nativePreviewHash/);assert.match(sql,/CAST\(0 AS bit\) write/);assert.doesNotMatch(module(compile(fixture()),'context'),/INSERT|UPDATE|DELETE/);
});

test('selected items require exactly one native JSON array and retain the one-or-two row limit',()=>{
 const resolve=module(compile(fixture()),'resolve');
 const guard="IF (SELECT COUNT(*) FROM OPENJSON(@selection_json) WHERE [key] COLLATE Latin1_General_100_BIN2=N'items' AND [type]=4)<>1 OR (SELECT COUNT(*) FROM OPENJSON(@selection_json,'$.items')) NOT BETWEEN 1 AND 2 THROW 51917,'B6_OWNER_ITEM_COUNT',1;";
 assert(resolve.includes(guard));assert.doesNotMatch(resolve,/NOT LIKE N'\[%\]'/);
 assert(resolve.indexOf(guard)>resolve.indexOf('B6_OWNER_SELECTION_TYPES'));
 assert(resolve.indexOf(guard)<resolve.indexOf('B6_OWNER_ITEM_KEYS'));
 assert(resolve.indexOf(guard)<resolve.indexOf('INSERT @items'));
 for(const retained of ['B6_OWNER_IDENTITY','B6_OWNER_TRANSACTION','B6_OWNER_ACCOUNT_SOURCE','B6_OWNER_RATE_SOURCE','B6_OWNER_PRODUCT_SOURCE','B6_OWNER_HOLD','B6_OWNER_TOTAL_LIMIT','B6_OWNER_ITEM_VALUES'])assert(resolve.includes(retained)||module(compile(fixture()),'ready').includes(retained));
 // SQL execution of empty/scalar/object/missing/three-item negatives and the
 // valid one/two arrays belongs to the separate restricted SELECT canary.
});
test('assert is intermediate same-session/transaction authority, not final effect acceptance',()=>{
 const a=module(compile(fixture()),'assert');assert.match(a,/APPLOCK_MODE/);assert.match(a,/transaction_id=CURRENT_TRANSACTION_ID\(\)/);assert.match(a,/request_id=@request_id AND actor_id=@actor_id AND operation=@operation/);
 assert.match(a,/JSON_VALUE\(@proof,'\$\.invoiceId'\)/);assert.match(a,/JSON_VALUE\(@proof,'\$\.bodyHash'\)/);assert.match(a,/SELECT @proof proof_json/);assert.doesNotMatch(a,/UPDATE|INSERT|DELETE|SET phase|EXEC dbo\.usp_canonical_business_sale_effects/);
 const ready=module(compile(fixture()),'ready');assert.match(ready,/ISNULL\(@actor_id,-1\)<>17/);assert.match(ready,/transaction_isolation_level=4/);assert.match(ready,/r.is_active=1/);assert.match(ready,/can_approve/);assert.match(ready,/pca_guard_hash/);
});
test('full before-image captures selected rows, outside sets and finance/FX unchanged baselines without rounding balances',()=>{
 const b=module(compile(fixture()),'begin');for(const name of ['customers','party_currency_accounts','products','sales_invoices','sales_invoice_items','stock_movements','customer_movements','audit_logs','work_sales_links','work_trade_requests'])assert(b.includes(' '+name));
 for(const name of ['finance_accounts','finance_account_movements','currency_rates'])assert(b.includes('FROM dbo.'+name+' ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES'));
 assert.match(b,/\) rows/);assert.match(b,/\) totals/);assert.match(b,/\) frozen/);assert.match(b,/\) outside/);assert.match(b,/NOT EXISTS\(SELECT 1 WHERE/);
 assert.match(b,/CONVERT\(varchar\(18\),v.row_version,1\)/);assert.match(b,/CANONICAL_INVOICE_V1/);assert.doesNotMatch(b,/entity_type=N'product'/);
});
test('profile/schema failures reject instead of guessing missing native identity, units, costs, rate or reader',()=>{
 let f=fixture();f.before.identityJson.databaseName='LIVE';rejects(()=>compile(f),'B6_OWNER_TARGET');
 f=fixture();f.before.columnsJson.pop();rejects(()=>compile(f),'B6_OWNER_NATIVE_COLUMN_REQUIRED');
 f=fixture();f.before.columnsJson[0].schemaName='fixture';rejects(()=>compile(f),'B6_OWNER_DBO_SCHEMA');
 f=fixture();f.profile.products[0].costKnown=false;rejects(()=>compile(f),'B6_OWNER_PRODUCT');
 f=fixture();f.profile.products[0].factorExact8='12.00000000';rejects(()=>compile(f),'B6_OWNER_PRODUCT');
 f=fixture();f.profile.accounts[0].currency='USD';rejects(()=>compile(f),'B6_OWNER_RATE_REQUIRED');
 f=fixture();f.before.modulesJson[0].definitionHash='0'.repeat(64);rejects(()=>compile(f),'B6_OWNER_CATALOG_READER_PIN');
 f=fixture();f.profile.date='2026-13-01';rejects(()=>compile(f),'B6_OWNER_PROFILE_PIN');
 f=fixture();delete f.effectsPins.pcaGuardHash;rejects(()=>compile(f),'B6_OWNER_EFFECT_PINS');
});
test('profile seal is deterministic, domain separated, tuple order canonical and source sensitive',()=>{
 const f=fixture(),h=profileHash(f.profile);assert.equal(h,compile(f).profileHash);const p=structuredClone(f.profile);p.accounts[0].accountId='202';assert.notEqual(profileHash(p),h);
 p.accounts.push({...p.accounts[0],accountId:'203'});const h2=profileHash(p);p.accounts.reverse();assert.equal(profileHash(p),h2);assert.notEqual(h2,h);
 f.profile.products.push(f.profile.products[0]);rejects(()=>compile(f),'B6_OWNER_PROFILE_DUPLICATE');
});
test('DONE intents remain audit records while pooled sessions may issue another request without granting DONE writer authority',()=>{
 const r=compile(fixture()),table=r.tables.find(s=>s.startsWith('CREATE TABLE '+O.intents)),a=module(r,'assert'),b=module(r,'begin');
 assert.match(table,/request_id uniqueidentifier NOT NULL PRIMARY KEY/);assert.doesNotMatch(table,/session_id int NOT NULL PRIMARY KEY/);
 assert.match(r.indexes[0],/UNIQUE INDEX .*\(session_id\) WHERE phase<>N'DONE'/);assert.match(b,/session_id=@@SPID AND phase<>N'DONE'/);
 assert(r.intentPhases.includes('DRAFT_CANCELLED'));const active=a.match(/IF @phase NOT IN\(([^)]*)\)/)[1];for(const p of ['DONE','EFFECTS_VERIFIED','JOURNALED'])assert(!active.includes("N'"+p+"'"));
 const completed=a.slice(a.indexOf('IF @completed=1 BEGIN'),a.indexOf('RETURN; END;')+12);assert.match(completed,/COMPLETED_JOURNAL/);assert.match(completed,/responseHash/);assert.doesNotMatch(completed,/SELECT @proof proof_json/);
});
test('canonical body provenance is server-bound, strict shape and NULL-safe without reserializing the body',()=>{
 const b=module(compile(fixture()),'begin');for(const k of ['canonicalBusinessSaleProfileHash','operationOrigin','testProfile'])assert(b.includes("JSON_VALUE(@payload_json,'$."+k+"')"));
 assert.match(b,/B6-CANONICAL-BUSINESS-SALE-V1/);assert.match(b,/COUNT\(\*\) FROM OPENJSON\(@payload_json\)\)<>13/);assert.match(b,/sale_cancel' THEN 9 ELSE 8/);
 assert.match(b,/ISNULL\(JSON_VALUE\(@payload_json,'\$\.actorId'\),' '\)|ISNULL\(JSON_VALUE\(@payload_json,'\$\.actorId'\),''\)/);
 assert.doesNotMatch(b,/JSON_MODIFY\(@payload_json/);const resolve=module(compile(fixture()),'resolve');assert.match(resolve,/ITEM_CANONICAL/);assert.match(resolve,/SELECTION_CANONICAL/);assert.match(resolve,/COLLATE Latin1_General_100_BIN2 NOT IN/);
});
test('historical cancellation derives original prices/cost/rate from issued creation proof, not a current-price resolver or availability check',()=>{
 const b=module(compile(fixture()),'begin'),start=b.indexOf("IF @operation<>N'sale_cancel' BEGIN"),historical=b.slice(b.indexOf('ELSE BEGIN\nIF ISNULL(ISJSON(@creationNative)',start),b.indexOf("IF @operation=N'sale_draft' BEGIN IF ISNULL",start));
 assert(start>0&&historical.length>0);assert.match(b,/nativeCreationProofJSON nvarchar\(max\)/);assert.match(historical,/CREATION_OWNER_PROOF/);assert.match(historical,/CREATION_ACCOUNT_SNAPSHOT/);assert.match(historical,/CREATION_PRODUCT_SNAPSHOT/);
 assert.match(historical,/i\.average_cost_try_snapshot=x\.cost4/);assert.match(historical,/v\.exchange_rate_snapshot=TRY_CONVERT/);assert.match(historical,/operation_quarantine_holds/);
 assert.doesNotMatch(historical,/EXEC dbo\.usp_canonical_business_sale_resolve|p\.average_cost_try|q\.price>|current_stock_qty>=|FROM dbo\.currency_rates/);
 assert.match(historical,/p\.current_stock_qty IS NOT NULL/);assert.match(b,/STALE_INVOICE/);
});
test('legacy closure mode is internal only and does not require a Semih session; public canonical routes explicitly choose strict mode',()=>{
 const r=compile(fixture()),ready=module(r,'ready');assert.match(ready,/@legacy bit=0/);assert.match(ready,/IF @legacy=0 BEGIN/);assert.match(ready,/IF @legacy=0 AND/);
 assert.match(ready,/legacy_ready_hash/);assert.match(ready,/legacy_goal8_hash/);assert.match(ready,/fn_canonical_business_sale_original_definition_v1/);
 for(const n of ['context','begin','assert','resolve']){const s=module(r,n);assert(s.includes('@legacy=0'));assert(s.includes('READY_DEFINITION'));}
 assert(!r.permissionSQL.some(s=>s.startsWith('GRANT')&&s.includes(O.ready)));assert.match(ready,/role_id=17\)<>36/);
});
test('invoice readback uses the identical exported exact typed rowversion/creation/profile revision expression',()=>{
 const r=compile(fixture()),expression=invoiceRevision({profileHash:r.profileHash});assert(module(r,'begin').includes(expression));
 assert.match(expression,/CONVERT\(varchar\(18\),v.row_version,1\)/);assert.match(expression,/HASHBYTES\('SHA2_256',@creation\)/);assert(expression.startsWith('LOWER('));
 const read=invoiceRevision({profileHash:r.profileHash,invoiceAlias:'i',creationPayload:'j.payload_json'});assert(read.includes('i.row_version')&&read.includes('j.payload_json'));
 rejects(()=>invoiceRevision({profileHash:r.profileHash,creationPayload:'j.payload_json);DELETE x'}),'B6_OWNER_INVOICE_REVISION_ARGS');
});
test('frozen-before entrypoint refuses substituted metadata; owner role cannot be changed by a profile',()=>{
 rejects(()=>frozen({beforeMetadataJSON:'{}'}),'B6_OWNER_FROZEN_NATIVE_BYTES');
 const f=fixture();f.profile.roleCode='another_role';rejects(()=>compile(f),'B6_OWNER_PROFILE_PIN');
});
test('native quote gates admit exact sale and exclude purchase, purchase_local and the disproved sales spelling',()=>{
 // This is an emitted-predicate contract test, not a SQL execution claim.
 const r=compile(fixture()),install=r.seedSQL,resolve=module(r,'resolve'),historical=module(r,'begin');
 for(const [sql,operator] of [[install,'<>'],[resolve,'='],[historical,'=']]){
  const gate=/q\.price_type COLLATE Latin1_General_100_BIN2(<>|=)N'([^']+)'/.exec(sql);assert(gate);assert.equal(gate[1],operator);assert.equal(gate[2],'sale');
  for(const type of ['sale','purchase','purchase_local','sales','SALE']){
   const predicate=gate[1]==='='?type===gate[2]:type!==gate[2];
   assert.equal(predicate,operator==='='?type==='sale':type!=='sale');
  }
 }
 assert.doesNotMatch([install,resolve,historical].join('\n'),/q\.price_type(?: COLLATE Latin1_General_100_BIN2)?(?:<>|=)N'sales'/);
 assert.match(hashes.quote,/q\.price_type/); // Hashes retain the actual native field value.
});
