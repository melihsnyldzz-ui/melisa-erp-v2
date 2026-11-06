// Offline compiler for the first normal-auth/read-list installation only.
// No connection, SQL execution, credential, user, or commercial data creation.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export const EMPTY_LOCAL_DATABASE='MELISA_ERP_EMPTY_TEST_20261105';
export const EMPTY_LOCAL_ENVIRONMENT_ID='94a8324f-124a-49e4-ad70-be3232989f47';
export const EMPTY_LOCAL_SCHEMA_VERSION=1;
export const EMPTY_LOCAL_ROLE='empty_local_reader';
export const EMPTY_LOCAL_VIEW_PERMISSIONS=Object.freeze(['product.view','customer.view','supplier.view','dashboard.view']);

const directory='infra/sql/migrations/';
const entry=(name,sha256,mode,count,start)=>Object.freeze({path:directory+name,sha256,mode,count,start});
// SHA256 of UTF-8 source text with BOM removed and CRLF normalized to LF.
// Pin the complete source, including the legacy sections deliberately excluded.
const REVIEWED_SOURCE_SHA256=Object.freeze([
 'd358b2c5ea2832bdf79e577b9eead6663223bd7b22c52e24eec2c1a0270ae0a2',
 '0348c8087b903ec114dd2d42ec64cc9eec95936ebf748477d6b485daac3a2d44',
 'a542d87b6086c783db1d9c5a12b72b1dcb6336bb948dccd4c0f34b268b2ae44b',
 'd57ecfecfde728f922a2f163d6529a906841caffafc0458f4792bedd51755de8',
 '51031673efeee8f2f3404cc358778312fb53e32ff1f226840ce4fc0cbecd5f79',
 '2b04046d04d08a35024fda91de8abce72afce103d119e388df6a9ea77d9e7ea4',
 'fd5bea21942c8f8cb2816da19d3e542347d6259679b0deaf8a79b958f1eb703b',
 '51714cfdb7868dbd120003b2c9eacffbd59d75090c69900bfb5ac615bee27c13',
]);
export const EMPTY_LOCAL_SCHEMA_SOURCES=Object.freeze([
 entry('0001_melisa_erp_v2_initial_schema.sql',REVIEWED_SOURCE_SHA256[0],'initial',21,'CREATE TABLE dbo.roles ('),
 entry('0002_customer_movements.sql',REVIEWED_SOURCE_SHA256[1],'after-guard',1,"IF OBJECT_ID(N'dbo.customer_movements', N'U') IS NULL"),
 entry('0003_stock_movement_sales_snapshots.sql',REVIEWED_SOURCE_SHA256[2],'after-guard',3,"IF COL_LENGTH(N'dbo.stock_movements', N'unit_price') IS NULL"),
 entry('0004_supplier_movements.sql',REVIEWED_SOURCE_SHA256[3],'after-guard',1,"IF OBJECT_ID(N'dbo.supplier_movements', N'U') IS NULL"),
 entry('0005_average_cost_gross_profit.sql',REVIEWED_SOURCE_SHA256[4],'after-guard',4,"IF COL_LENGTH(N'dbo.products', N'average_cost_try') IS NULL"),
 entry('0006_auth_live_foundation.sql',REVIEWED_SOURCE_SHA256[5],'first-ddl',1,"IF OBJECT_ID(N'dbo.auth_refresh_tokens', N'U') IS NULL"),
 entry('0010_system_settings.sql',REVIEWED_SOURCE_SHA256[6],'first-ddl',1,"IF OBJECT_ID(N'dbo.system_settings', N'U') IS NULL"),
 entry('0011_purchase_discount_defaults.sql',REVIEWED_SOURCE_SHA256[7],'whole-ddl',1,"IF COL_LENGTH('dbo.products', 'purchase_discount_rate') IS NULL"),
]);

const reject=code=>{throw new Error(code);};
const normalize=source=>{
 if(typeof source!=='string')reject('EMPTY_LOCAL_SCHEMA_SOURCE_REQUIRED');
 const text=source.replace(/^\uFEFF/,'').replaceAll('\r\n','\n');
 if(text.includes('\r')||text.includes('\0'))reject('EMPTY_LOCAL_SCHEMA_SOURCE_ENCODING');
 return text;
};
const digest=source=>createHash('sha256').update(source,'utf8').digest('hex');
function assertTarget(targetDatabase){
 if(targetDatabase!==EMPTY_LOCAL_DATABASE)reject('EMPTY_LOCAL_SCHEMA_TARGET_REJECTED');
}
export function emptyLocalSchemaTargetGuard(targetDatabase=EMPTY_LOCAL_DATABASE){
 assertTarget(targetDatabase);
 return `IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${EMPTY_LOCAL_DATABASE}' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV'\n    THROW 51994, 'EMPTY_LOCAL_SCHEMA_TARGET_REJECTED', 1;`;
}
export function readEmptyLocalSchemaSources(){
 return Object.fromEntries(EMPTY_LOCAL_SCHEMA_SOURCES.map(({path})=>[path,readFileSync(new URL('../../'+path,import.meta.url),'utf8')]));
}
const splitBatches=text=>text.split(/^GO[ \t]*$/m).map(s=>s.trim()).filter(Boolean);
function assertDdl(sql){
 // A second independent boundary after the exact source hashes and sentinels.
 const body=sql.replace(/\/\*[\s\S]*?\*\//g,'').replace(/--[^\n]*/g,'');
 if(!/^(?:CREATE TABLE dbo\.|CREATE (?:UNIQUE )?INDEX [A-Za-z_][A-Za-z0-9_]*\s+ON dbo\.|IF (?:OBJECT_ID|COL_LENGTH)\()/i.test(body.trim())
   ||/\b(?:INSERT|MERGE|UPDATE|DELETE|DROP|TRUNCATE|EXEC(?:UTE)?|USE|GRANT|DENY|REVOKE|DBCC|BACKUP|RESTORE|OPENROWSET|OPENQUERY)\b/i.test(body)
   ||/\b(?:CREATE|ALTER)\s+(?:DATABASE|LOGIN|USER|PROCEDURE|TRIGGER|FUNCTION|VIEW|ASSEMBLY|SERVER)\b/i.test(body)
   ||/\b(?:BEGIN|COMMIT|ROLLBACK)\s+TRANSACTION\b|\bMELISA_ERP_V2\b|\bGO\b/i.test(body))reject('EMPTY_LOCAL_SCHEMA_DDL_REJECTED');
}
function extract(entry,source){
 let text=source;
 if(entry.mode==='initial'){
  const position=text.indexOf(entry.start);
  if(position<0||position!==text.lastIndexOf(entry.start))reject('EMPTY_LOCAL_SCHEMA_SENTINEL_REJECTED');
  text=text.slice(position);
 }else if(entry.mode!=='whole-ddl'){
  const parts=splitBatches(text);
  if(!parts[0]?.startsWith("IF DB_NAME() <> N'MELISA_ERP_V2'"))reject('EMPTY_LOCAL_SCHEMA_SENTINEL_REJECTED');
  if(entry.mode==='first-ddl'){
   if(parts.length<3||!parts[2].startsWith('MERGE dbo.'))reject('EMPTY_LOCAL_SCHEMA_SENTINEL_REJECTED');
   text=parts[1];
  }else text=parts.slice(1).join('\nGO\n');
 }
 const batches=splitBatches(text);
 if(batches.length!==entry.count||!batches[0]?.startsWith(entry.start))reject('EMPTY_LOCAL_SCHEMA_SENTINEL_REJECTED');
 batches.forEach(assertDdl);
 return batches;
}

// Reviewed first-install extension: the normal product list always joins its
// main supplier, while the initial foundation predates that nullable relation.
// Installed after suppliers exists; creates no supplier or product records.
const productSupplier=`IF COL_LENGTH(N'dbo.products', N'supplier_id') IS NULL
BEGIN
    ALTER TABLE dbo.products ADD supplier_id BIGINT NULL;
    ALTER TABLE dbo.products ADD CONSTRAINT FK_empty_local_products_supplier
        FOREIGN KEY(supplier_id) REFERENCES dbo.suppliers(id);
    CREATE INDEX IX_empty_local_products_supplier ON dbo.products(supplier_id);
END;`;

const marker=`CREATE TABLE dbo.empty_local_installation (
    id tinyint NOT NULL CONSTRAINT PK_empty_local_installation PRIMARY KEY CONSTRAINT CK_empty_local_installation_id CHECK(id=1),
    environment_id uniqueidentifier NOT NULL CONSTRAINT UQ_empty_local_installation_environment UNIQUE,
    schema_version int NOT NULL CONSTRAINT CK_empty_local_installation_version CHECK(schema_version=1),
    actual_t1 bit NOT NULL CONSTRAINT CK_empty_local_installation_t1 CHECK(actual_t1=0),
    external_operations bit NOT NULL CONSTRAINT CK_empty_local_installation_external CHECK(external_operations=0),
    read_only bit NOT NULL CONSTRAINT CK_empty_local_installation_readonly CHECK(read_only=1),
    created_at datetime2 NOT NULL CONSTRAINT DF_empty_local_installation_created DEFAULT SYSUTCDATETIME()
);`;

export function compileEmptyLocalSchema({sources=readEmptyLocalSchemaSources(),targetDatabase=EMPTY_LOCAL_DATABASE}={}){
 assertTarget(targetDatabase);
 if(!sources||typeof sources!=='object'||Array.isArray(sources)
   ||Object.keys(sources).length!==EMPTY_LOCAL_SCHEMA_SOURCES.length
   ||EMPTY_LOCAL_SCHEMA_SOURCES.some(e=>!Object.hasOwn(sources,e.path)))reject('EMPTY_LOCAL_SCHEMA_ALLOWLIST_REJECTED');
 // Verify the entire allowlist before extracting even its first batch. A
 // changed later source must not be obscured by an earlier extraction error.
 const verified=new Map();
 for(const entry of EMPTY_LOCAL_SCHEMA_SOURCES){
  const text=normalize(sources[entry.path]);
  if(digest(text)!==entry.sha256)reject('EMPTY_LOCAL_SCHEMA_SOURCE_HASH_REJECTED');
  verified.set(entry.path,text);
 }
 const guard=emptyLocalSchemaTargetGuard(targetDatabase),batches=[];
 for(const entry of EMPTY_LOCAL_SCHEMA_SOURCES){
  extract(entry,verified.get(entry.path)).forEach((sql,index)=>batches.push(Object.freeze({source:entry.path,index,sql:guard+'\n'+sql})));
 }
 assertDdl(productSupplier);
 batches.push(Object.freeze({source:'empty-local-product-supplier-v1',index:0,sql:guard+'\n'+productSupplier}));
 assertDdl(marker);
 batches.push(Object.freeze({source:'empty-local-installation-marker-v1',index:0,sql:guard+'\n'+marker}));
 return Object.freeze({scope:'normal-auth-read-lists-v1',schemaVersion:EMPTY_LOCAL_SCHEMA_VERSION,
  database:EMPTY_LOCAL_DATABASE,environmentId:EMPTY_LOCAL_ENVIRONMENT_ID,batches:Object.freeze(batches),
  sources:Object.freeze(EMPTY_LOCAL_SCHEMA_SOURCES.map(({path,sha256})=>Object.freeze({path,sha256}))),
  extensions:Object.freeze([Object.freeze({id:'empty-local-product-supplier-v1',sha256:digest(productSupplier)}),Object.freeze({id:'empty-local-installation-marker-v1',sha256:digest(marker)})])});
}

// Reference rows only. The root installer owns the transaction, marker INSERT,
// protected credential handling, and the normal managed-user core invocation.
// Existing roles are rejected rather than adopted, reset, or upgraded.
export function buildEmptyLocalReferenceSql({targetDatabase=EMPTY_LOCAL_DATABASE}={}){
 assertTarget(targetDatabase);
 return `${emptyLocalSchemaTargetGuard(targetDatabase)}
IF NOT EXISTS(SELECT 1 FROM dbo.empty_local_installation WHERE id=1 AND environment_id='${EMPTY_LOCAL_ENVIRONMENT_ID}' AND schema_version=1 AND actual_t1=0 AND external_operations=0 AND read_only=1)
    THROW 51994, 'EMPTY_LOCAL_REFERENCE_MARKER_REJECTED', 1;
IF EXISTS(SELECT 1 FROM dbo.roles WHERE code=N'${EMPTY_LOCAL_ROLE}')
    THROW 51994, 'EMPTY_LOCAL_REFERENCE_ROLE_EXISTS', 1;
DECLARE @role TABLE(id bigint NOT NULL);
INSERT dbo.roles(code,name,description,is_system_role,is_active)
OUTPUT inserted.id INTO @role(id)
VALUES(N'${EMPTY_LOCAL_ROLE}',N'Yerel kurulum okuyucusu',N'Normal giriş ve boş yerel listeler',1,1);
INSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve)
SELECT r.id,p.permission_key,1,0,0,0,0 FROM @role r CROSS JOIN (VALUES
    (N'product.view'),(N'customer.view'),(N'supplier.view'),(N'dashboard.view')
) p(permission_key);
SELECT id AS roleId,N'${EMPTY_LOCAL_ROLE}' AS roleCode FROM @role;`;
}
