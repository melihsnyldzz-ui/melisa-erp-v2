import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileEmptyV7PersonnelReadSql as read,compileEmptyV7PersonnelSql as compile,EMPTY_V7_PERSONNEL_BUSINESS_TABLES as tables,EMPTY_V7_PERSONNEL_LOCAL_MASTER_SETTLED_SQL as masterGuard,isSettledPersonnelMasterJournal as settled} from './empty-v7-personnel-sql.mjs';
import {localCustomerIdentity,localProductIdentity} from '../../apps/api/src/services/localMasterIdentity.mjs';
import {localSupplierIdentity} from '../../apps/api/src/services/localSupplierIdentity.mjs';
import {productRejectionRecord} from '../../apps/api/src/services/desktopProductRejection.mjs';
import {EMPTY_V7_PERSONNEL_ROSTER as people,EMPTY_V7_PERSONNEL_ROLES as roles,EMPTY_V7_PERSONNEL_ROSTER_SHA256 as rosterHash,EMPTY_V7_PERSONNEL_TARGET as target,EMPTY_V7_PERSONNEL_HASH_KEYS as keys,personnelPolicy,parsePersonnelObservation} from './empty-v7-personnel-core.mjs';
const version=n=>'0x'+n.toString(16).padStart(16,'0');
function masterFixture(operation='customer.create'){
 const requestId='33333333-3333-4333-8333-333333333333';let entity;
 if(operation==='product.create')entity=localProductIdentity({product:{id:'8',name:'Synthetic product'},units:[{id:'9',productId:'8',label:'ADET',factorExact8:'1.00000000',isMain:true}],prices:[{id:'10',productId:'8',type:'sale',unitId:'9',tier:null,currency:'TRY',priceExact8:'12.00000000'}]});
 else if(operation==='supplier.create')entity=localSupplierIdentity({supplier:{id:'11',entityId:'12',currency:'TRY'},entity:{id:'12',role:'supplier'},account:{id:'13',entityId:'12',customerId:null,supplierId:'11',currency:'TRY',currentBalanceExact8:'0.00000000'}});
 else entity=localCustomerIdentity({customer:{id:'2',entityId:'3',currency:'TRY'},entity:{id:'3',role:'customer'},accounts:[{id:'4',entityId:'3',customerId:'2',supplierId:null,currency:'TRY',currentBalanceExact8:'0.00000000'}]});
 return {requestId,operation,actorId:'1',payloadSha256:'a'.repeat(64),responseJson:JSON.stringify({requestId,operation,entity})};
}
test('local-master successful stored responses have no state and source-built customer/product/supplier projections are settled',()=>{
 for(const operation of ['customer.create','product.create','supplier.create']){const row=masterFixture(operation),response=JSON.parse(row.responseJson);assert.equal(Object.hasOwn(response,'state'),false);assert.deepEqual(Object.keys(response),['requestId','operation','entity']);assert.equal(settled(row),true);}
 for(const reason of ['PRODUCT_STOCK_CODE_IN_USE','PRODUCT_BARCODE_IN_USE','PRODUCT_BARCODE_DUPLICATE_INPUT']){const row=masterFixture('product.create');row.responseJson=JSON.stringify(productRejectionRecord(row.requestId,reason));assert.equal(settled(row),true);}
 assert.match(masterGuard,/CASE WHEN[\s\S]*THEN 1 ELSE 0 END<>1/);assert.match(masterGuard,/m\.payload_hash\)=32/);assert.match(masterGuard,/LOWER\(CONVERT\(varchar\(36\),m.request_id\)\)/);assert.match(masterGuard,/m\.operation/);assert.doesNotMatch(masterGuard,/\$\.state|current_balance/);assert.match(masterGuard,/dbo\.products nativeRow/);assert.match(masterGuard,/dbo\.customers nativeRow/);assert.match(masterGuard,/dbo\.suppliers nativeRow/);
 const sql=compile({mode:'rollback'}).sql;assert.ok(sql.indexOf(masterGuard)<sql.indexOf('INSERT dbo.roles('));
});
test('master-journal missing, malformed, unknown or unrelated identity is rejected instead of allowing every missing state',()=>{
 const changes=[r=>r.responseJson=null,r=>r.responseJson='{',r=>r.responseJson='null',r=>r.responseJson='{}',r=>r.actorId=null,r=>r.payloadSha256='',r=>r.operation='unrelated.operation',r=>r.responseJson=r.responseJson.replace(r.requestId,'44444444-4444-4444-8444-444444444444'),r=>r.responseJson=r.responseJson.replace('customer.create','product.create'),r=>{const v=JSON.parse(r.responseJson);v.state='UNKNOWN';r.responseJson=JSON.stringify(v);},r=>{const v=JSON.parse(r.responseJson);v.state='COMMITTED';r.responseJson=JSON.stringify(v);},r=>{const v=JSON.parse(r.responseJson);v.entity.id='0';r.responseJson=JSON.stringify(v);},r=>{const v=JSON.parse(r.responseJson);v.entity.kind='source';r.responseJson=JSON.stringify(v);},r=>{const v=JSON.parse(r.responseJson);v.entity.accounts[0].customerId='99';r.responseJson=JSON.stringify(v);},r=>{const v=JSON.parse(r.responseJson);delete v.entity.accounts;r.responseJson=JSON.stringify(v);},r=>r.responseJson=r.responseJson.replace('{','{"requestId":"'+r.requestId+'",')];
 for(const change of changes){const r=masterFixture();change(r);assert.equal(settled(r),false);}
 const r=masterFixture('product.create');for(const reason of ['UNKNOWN','CUSTOMER_ACCOUNT_EXISTS','PRODUCT_OTHER']){r.responseJson=JSON.stringify({kind:'desktop-product-rejection-v1',requestId:r.requestId,operation:r.operation,reason});assert.equal(settled(r),false);}
 const missingUnit=masterFixture('product.create'),v=JSON.parse(missingUnit.responseJson);v.entity.prices[0].unitId='99';missingUnit.responseJson=JSON.stringify(v);assert.equal(settled(missingUnit),false);
 const duplicateTuple=masterFixture('product.create'),d=JSON.parse(duplicateTuple.responseJson);d.entity.prices.push({...d.entity.prices[0],id:'88'});duplicateTuple.responseJson=JSON.stringify(d);assert.equal(settled(duplicateTuple),false);assert.match(masterGuard,/GROUP BY[^;]*HAVING COUNT\(\*\)>1/s);
 assert.match(masterGuard,/OPENJSON/);assert.match(masterGuard,/k\.\[type\] IN\(5\)/);assert.match(masterGuard,/k\.\[type\] IN\(4\)/);assert.match(masterGuard,/PRODUCT_BARCODE_DUPLICATE_INPUT/);assert.doesNotMatch(masterGuard,/CUSTOMER_ACCOUNT_EXISTS|N'UNKNOWN'|N'PENDING'/);
});
test('SQL JSON strings and canonical VARCHAR UUID/id/decimal projections share UTF16LE before exact binary comparison',()=>{
 for(const value of ['1','12.00000000','33333333-3333-4333-8333-333333333333']){assert.notDeepEqual(Buffer.from(value,'utf16le'),Buffer.from(value,'utf8'));assert.deepEqual(Buffer.from(String(value),'utf16le'),Buffer.from(String(value),'utf16le'));}
 assert.match(masterGuard,/CONVERT\(varbinary\(max\),CONVERT\(nvarchar\(max\),LOWER\(CONVERT\(varchar\(36\),m.request_id\)\)\)\)/);
 assert.match(masterGuard,/CONVERT\(varbinary\(max\),CONVERT\(nvarchar\(max\),CONVERT\(varchar\(20\),TRY_CONVERT\(bigint,/);
 assert.match(masterGuard,/CONVERT\(varbinary\(max\),CONVERT\(nvarchar\(max\),CONVERT\(varchar\(50\),TRY_CONVERT\(decimal\(28,8\),/);
 assert.doesNotMatch(masterGuard,/CONVERT\(varbinary\(max\),(?:JSON_VALUE|LOWER|CONVERT\(varchar|k\.\[key\])/);
});
function receipt(active=false){const users=people.map((p,i)=>{const r=roles.find(r=>r.key===p.role),j=roles.indexOf(r);return {key:p.key,username:p.username,userId:String(i+2),userVersion:version(i+100),roleId:String(j+2),roleVersion:version(j+200),roleCode:r.code,active};});return {version:1,state:active?'EMPTY_V7_PERSONNEL_ACTIVATED':'EMPTY_V7_PERSONNEL_CREATED_INACTIVE',target:{...target},rosterOperationId:'11111111-1111-4111-8111-111111111111',operationId:'22222222-2222-4222-8222-222222222222',rosterSha256:rosterHash,users,policy:{id:'3',version:version(400),sha256:createHash('sha256').update(personnelPolicy(users),'utf16le').digest('hex')},hashes:Object.fromEntries(keys.map(k=>[k,'a'.repeat(64)]))};}

test('SQL NULL for an empty personnel subquery is serialized as [] and the saved public DB9 row then passes the unchanged parser',()=>{
 // Public read-result SHA a6ec62941c11a2b3be49b12602332a4f3a457bb9e98b489ca0fa562ddf38ce4e.
 // Saved SQL result is preserved verbatim here; only identitiesJson is normalized in this test.
 const actualRow={
 "state": "EMPTY_V7_PERSONNEL_OBSERVED",
 "mode": "preflight",
 "rosterOperationId": "1c6f9175-276d-49eb-803b-23b6c4717a03",
 "operationId": "0ea2689f-ea0b-4ed9-9fc1-20deff001774",
 "rosterSha256": "b81f71c79a5722d7fa708295b040696c472e27fda50cfcd38c9ad5485b5d7dcb",
 "userCount": 1,
 "roleCount": 1,
 "permissionCount": 35,
 "identitiesJson": null,
 "policyId": null,
 "policyVersion": null,
 "policySha256": null,
 "metadataSha256": "26b6c65c8d8f6cc87d1f5c617f8ae28a6d6251e5457a3193058c5746cbad5311",
 "securitySha256": "781906cbf13e2c49dc9728a82c3cdc516cf6f4ef8e7ce7b4650bf55b61a2c855",
 "businessSha256": "926f79a842f6fb4fadfab0faa4772c9fd48d0539299b5f7d62522de8c45460a3",
 "adminSha256": "c500479ac9e895d9b7513849e55344d905d6cc5a2d75704160e0118b087fe5bb",
 "settingsSha256": "b3a4e0472ff1138eee12cd43904be0eca39656b350fda75de444280554771876",
 "auditSha256": "a4961d8f323fe17a60fe1485f2793a97ca26fe7263dedcebe1629d79f5a5bcc7",
 "pendingSha256": "f6e2495b9de416baae67d2e4cad42057b7538e5eb6c3b3078da519a2755d19b0",
 "businessFingerprintsJson": "[{\"name\":\"currency_rates\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"customer_movements\",\"count\":2,\"sha256\":\"9cac48f02e60fe404c2426ecc0fcbf7f477e9e7a8a8a8f3a7e0676d34c4db077\"},{\"name\":\"customers\",\"count\":1,\"sha256\":\"fff2c8104740206c4a5c15023bd3f7233f90d33d95b8f759fc6bfa497dccdffa\"},{\"name\":\"desktop_finance_requests\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"desktop_goods_purchase_links\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"desktop_goods_receipt_lines\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"desktop_goods_receipts\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"desktop_goods_requests\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"desktop_local_master_requests\",\"count\":4,\"sha256\":\"632c29e6cc0e2f940a3b32e84a3eb2e2671c3da52848cbf80219b167b5b3e8d0\"},{\"name\":\"desktop_local_price_units\",\"count\":2,\"sha256\":\"e164d6f2c517de3b7e09d26832d6dc63813d843010fc916a4f3f24404977599d\"},{\"name\":\"desktop_local_product_units\",\"count\":2,\"sha256\":\"a1ebbe4b6d2b603e010f0a1d8660966d6eefaa57a274fa3b6563266718c9392a\"},{\"name\":\"desktop_sale_carton_items\",\"count\":3,\"sha256\":\"8da4c82b0cb15a0cf53b714611f83c8011ccb896dd1e1ee3b12266a3f0dbac44\"},{\"name\":\"desktop_sale_cartons\",\"count\":2,\"sha256\":\"7956ffee3131d467b96a397a086a325d7c9fc61156e3e3963c6ee988558d616d\"},{\"name\":\"desktop_sale_request_resolutions\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"desktop_sale_reservations\",\"count\":3,\"sha256\":\"cdd9a4854df45db8cd12448751fb824a83db366dc6befcf1b5537b9aca9f289e\"},{\"name\":\"desktop_sale_workflow_requests\",\"count\":12,\"sha256\":\"556a9c7a21d65808cf8daf4349bd34ccb5f07203cef2295d90e5a8ca330e020f\"},{\"name\":\"desktop_sale_workflows\",\"count\":2,\"sha256\":\"4adf50e276fc73019f7c51d3e3cc3e9e0c2b2a58c7ecf7d325bc591e489c2960\"},{\"name\":\"finance_account_movements\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"party_currency_accounts\",\"count\":2,\"sha256\":\"c3a5ce89983c983b00c2317969e559668949f520e8b1b363c184c35f79c851a3\"},{\"name\":\"party_entities\",\"count\":2,\"sha256\":\"47419ef749bfd0177e8099f1b1b1ad1d9f029cfd40acb8d24a316e9f57eee802\"},{\"name\":\"product_barcodes\",\"count\":2,\"sha256\":\"a7d03ba1da0eedb5573bfd45db2a4b425d6405b5884cd6ec36b5f4cbbb2d3189\"},{\"name\":\"product_images\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"product_prices\",\"count\":2,\"sha256\":\"1a4845c7940c3e4b78c94f8691946f363060c33f2e3e5e609ce9e112b2dc7d5e\"},{\"name\":\"products\",\"count\":2,\"sha256\":\"7a1f94b3c453926b2793ca11e7f1703f88b2cc7c75f04f0b9a838b83b0558e2c\"},{\"name\":\"purchase_invoice_items\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"purchase_invoices\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"sales_invoice_items\",\"count\":3,\"sha256\":\"e21edc4581795d4dabbe95631d8d0f959bf3a0f2ed2e959a0fe921b803c16615\"},{\"name\":\"sales_invoices\",\"count\":2,\"sha256\":\"13b0e47b4439775522350f880f51e9cc1ed89ef1c59854c37ac78377f0c2d618\"},{\"name\":\"stock_movements\",\"count\":5,\"sha256\":\"8c42bffb8d2dc7b4de3ac53c75d0c42347c19433a3cc125405066b1f282579e1\"},{\"name\":\"supplier_movements\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"},{\"name\":\"suppliers\",\"count\":1,\"sha256\":\"aedc468e5cd6277e1a3a900c88f4088e9bd69bc25236194819d805280681e839\"},{\"name\":\"terminal_sync_queue\",\"count\":0,\"sha256\":\"5ee9173b1b564e61afd2359a897c180b5ea83875a91a28537df4202aad4b3aa7\"}]"
};
 assert.equal(actualRow.identitiesJson,null);
 assert.throws(()=>parsePersonnelObservation(actualRow),/INPUT_REJECTED/);
 const normalized={...actualRow,identitiesJson:actualRow.identitiesJson??'[]'};
 const observation=parsePersonnelObservation(normalized);
 assert.deepEqual(observation.counts,{users:1,roles:1,permissions:35});
 assert.deepEqual(observation.users,[]);assert.equal(observation.policy,null);
 assert.equal(observation.business.length,32);
 assert.deepEqual(observation.hashes,Object.fromEntries(keys.map(k=>[k,actualRow[k]])));
 assert.deepEqual(observation.business,JSON.parse(actualRow.businessFingerprintsJson));
 for(const field of Object.keys(actualRow))if(field!=='identitiesJson')assert.deepEqual(normalized[field],actualRow[field]);
 for(const plan of [read(),compile({mode:'rollback'}),compile({mode:'create-inactive'}),compile({mode:'activate',receipt:receipt()}),compile({mode:'deactivate',receipt:receipt(true)})])
  assert.match(plan.sql,/COALESCE\(\(SELECT p\.\[key\][\s\S]+?FOR JSON PATH,INCLUDE_NULL_VALUES\),N'\[\]'\) identitiesJson/);
 for(const invalid of [null,'null','', '{}'])assert.throws(()=>parsePersonnelObservation({...actualRow,identitiesJson:invalid}),/INPUT_REJECTED/);
});

test('read and mutation require the real DB9 Windows owner and caller SERIALIZABLE transaction; no transaction ownership or DCL',()=>{
 for(const plan of [read(),...['rollback','create-inactive'].map(mode=>compile({mode})),compile({mode:'activate',receipt:receipt()}),compile({mode:'deactivate',receipt:receipt(true)})]){
  const s=plan.sql;assert.match(s,/@@TRANCOUNT<>1/);assert.match(s,/transaction_isolation_level.*<>4/);assert.match(s,/SUSER_SID\(ORIGINAL_LOGIN\(\)\)<>@ownerSqlSid/);assert.match(s,/sysadmin/);assert.match(s,/Shared memory/);assert.match(s,/6d773db9-bd69-4906-b791-d63a490ab1f2/);assert.match(s,/287f689a-43bb-43dd-950b-adb615fcb20c/);assert.match(s,/502/);assert.match(s,/R1_OWNER_ROW/);
  assert.doesNotMatch(s,/\b(BEGIN|COMMIT|ROLLBACK)\s+(TRAN|TRANSACTION)\b/i);assert.doesNotMatch(s,/\b(GRANT|REVOKE|DENY|ALTER|DELETE|TRUNCATE|DBCC|RESEED)\b/i);assert.doesNotMatch(s,/c67f5317|eb2888c2|desktop_first_sale_operator|30002/);assert.equal(plan.executionAuthorized,false);assert.equal(plan.commitControlledByCaller,true);assert.equal(plan.sqlSha256,createHash('sha256').update(s).digest('hex'));
 }
 assert.doesNotMatch(read().sql,/WITH\(TABLOCKX|WITH\(UPDLOCK|INSERT dbo\.|UPDATE dbo\./);assert.equal(read().parameters.ownerSqlSid,'varbinary(85)');
});
test('creation is six private typed hashes, INSERT OUTPUT identities, initial ABSENT policy and exact inactive matrix',()=>{
 for(const mode of ['rollback','create-inactive']){const p=compile({mode}),s=p.sql;assert.equal(Object.keys(p.parameters).filter(k=>k.endsWith('CredentialHash')).length,6);assert.equal((s.match(/INSERT dbo.users\(/g)||[]).length,6);assert.equal((s.match(/INSERT dbo.roles\(/g)||[]).length,5);assert.equal((s.match(/INSERT dbo.permissions\(/g)||[]).length,5);assert.equal((s.match(/INSERT dbo.system_settings\(/g)||[]).length,1);assert.equal((s.match(/OUTPUT inserted.id INTO @out_/g)||[]).length,11);assert.doesNotMatch(s,/UPDATE dbo.system_settings|UPDATE dbo.users/);assert.match(s,/R1_INITIAL_ABSENCE/);assert.match(s,/R1_PRIVATE_FORMAT/);assert.match(s,/\$2b\$12\$/);assert.match(s,/@r_creditSetup,N'customer.edit',1,1,1,0,0/);assert.match(s,/@r_approval,N'sales.view',1,0,0,0,0/);assert.match(s,/@r_accounting,N'finance.collection',1,1,0,0,0/);assert.match(s,/COUNT\(DISTINCT permission_key\)/);for(const person of people){assert.equal(p.parameters[person.key+'CredentialHash'],'nvarchar(60)');assert.match(s,new RegExp('SET @'+person.key+'CredentialHash=NULL'));}}
});
test('native preservation hashes all32 permitted business tables, admin/settings/cash/marker/security without credential selection',()=>{
 const s=compile({mode:'rollback'}).sql;assert.equal(tables.length,32);assert.ok(!tables.includes('auth_refresh_tokens'));assert.match(s,/sys.index_columns/);assert.match(s,/WITHIN GROUP\(ORDER BY ic.key_ordinal\)/);assert.match(s,/COALESCE\(\(SELECT t\.\*/);assert.match(s,/count>1000/);assert.match(s,/CONVERT\(nvarchar\(100\),seed_value\)/);assert.doesNotMatch(s,/last_value|IDENT_CURRENT|token_hash|SELECT[^;]*password_hash|SELECT t\.\* FROM dbo\.\[auth_refresh_tokens\]/s);assert.doesNotMatch(read().sql,/password_hash|CredentialHash/);assert.match(s,/cashJson/);assert.match(s,/markerJson/);assert.match(s,/serverMembershipsJson/);
 for(const key of keys){assert.equal(compile({mode:'rollback'}).parameters['expected'+key[0].toUpperCase()+key.slice(1)],'binary(32)');assert.match(s,new RegExp('@after_'+key+'<>@before_'+key));}
 for(const name of tables)assert.ok(s.includes('SELECT t.* FROM dbo.['+name+']'));
});
test('before any persistent DML the locked baseline rejects open work, unknown journals, pending approvals and wrong invoices',()=>{
 const s=compile({mode:'create-inactive'}).sql,first=s.indexOf('INSERT dbo.roles(');for(const guard of ['R1_OWNER_LOCK','R1_ENABLED_TRIGGER','R1_PRESERVED_INVOICES','R1_OPEN_WORKFLOW','R1_UNKNOWN_COMMAND','R1_PENDING_APPROVAL','R1_BASELINE_securitySha256','R1_INITIAL_ABSENCE','R1_COLLISION','R1_PRIVATE_FORMAT']){assert.ok(s.indexOf(guard)>=0&&s.indexOf(guard)<first,guard);}assert.match(s,/id IN\(1,2\)/);assert.match(s,/COLLATE Latin1_General_100_BIN2/);
});
test('activation/deactivation use exact family, prior audit, all rowversions and policy CAS; no replacement or replay',()=>{
 for(const mode of ['activate','deactivate']){const r=receipt(mode==='deactivate'),p=compile({mode,receipt:r}),s=p.sql;assert.equal(Object.keys(p.parameters).filter(k=>k.endsWith('CredentialHash')).length,0);assert.equal(p.bindings.receiptFamily,r.rosterOperationId);assert.equal(p.bindings.receiptPolicyVersion,r.policy.version);assert.equal((s.match(/UPDATE dbo.users SET is_active=/g)||[]).length,6);assert.doesNotMatch(s,/INSERT dbo.users|INSERT dbo.roles|INSERT dbo.permissions|INSERT dbo.system_settings|UPDATE dbo.roles|UPDATE dbo.permissions|UPDATE dbo.system_settings/);assert.match(s,/R1_OPERATION_REPLAY/);assert.match(s,/R1_PHASE_ACTOR/);assert.match(s,/R1_POLICY_CAS/);for(const key of keys){assert.ok(s.includes('R1_RECEIPT_BASELINE_'+key));assert.ok(s.includes('0x'+r.hashes[key]));}for(const u of r.users){assert.equal(p.bindings['receiptUser_'+u.key],u.userId);assert.equal(p.bindings['receiptUserVersion_'+u.key],u.userVersion);}}
 assert.throws(()=>compile({mode:'activate',receipt:receipt(true)}));assert.throws(()=>compile({mode:'deactivate',receipt:receipt()}));assert.throws(()=>compile({mode:'create-inactive',receipt:receipt()}));assert.throws(()=>compile({mode:'grant-all'}));assert.throws(()=>compile({mode:'rollback',sql:'SELECT 1'}));
});
