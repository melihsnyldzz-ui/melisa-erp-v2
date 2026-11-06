// SOURCE ONLY. This is the exact least-privilege v2 master-card writer
// contract, not an installer or grant script. Every opener/transaction checks
// effective permissions on its current physical SQL connection.
export const DESKTOP_WRITE_PERMISSION_LIMITS=Object.freeze({sourceOnly:true,grantInstalled:false,realSqlVerified:false,
 scope:'customer-and-product-master-only',salesEnabled:false,publicServerViewAnyDatabaseAllowed:true,requiresDatabaseViewDefinition:true});
const readTables=['desktop_empty_installation','users','roles','permissions','customers','party_entities','party_currency_accounts',
 'products','desktop_local_product_units','product_barcodes','product_prices','desktop_local_price_units','audit_logs','desktop_local_master_requests','suppliers'];
const insertTables=['customers','party_entities','party_currency_accounts','products','desktop_local_product_units',
 'product_barcodes','product_prices','desktop_local_price_units','audit_logs','desktop_local_master_requests'];
export const DESKTOP_WRITE_OBJECT_PERMISSION_MANIFEST=Object.freeze([
 ...readTables.map(name=>Object.freeze({schema:'dbo',name,permission:'SELECT',column:null})),
 ...insertTables.map(name=>Object.freeze({schema:'dbo',name,permission:'INSERT',column:null})),
 Object.freeze({schema:'dbo',name:'customers',permission:'UPDATE',column:'party_entity_id'}),
]);
const quote=value=>`N'${value.replaceAll("'","''")}'`;
export function compileDesktopWritePermissionGuard(manifest){
if(!Array.isArray(manifest)||!manifest.length||manifest.some(x=>x.schema!=='dbo'||typeof x.name!=='string'||!/^[a-z_]+$/.test(x.name)||!['SELECT','INSERT','UPDATE','DELETE'].includes(x.permission)||x.column!==null&&(x.permission!=='UPDATE'||typeof x.column!=='string'||!/^[a-z_]+$/.test(x.column))))throw Error('DESKTOP_PERMISSION_MANIFEST_REJECTED');
const values=manifest.map(x=>`(${quote(x.schema)},${quote(x.name)},${quote(x.permission)},${x.column===null?'NULL':quote(x.column)})`).join(',');
const allowed=`(VALUES ${values}) allowed(schema_name,object_name,permission_name,column_name)`;
const exact=(a,b)=>`DATALENGTH(${a})=DATALENGTH(${b}) AND CONVERT(varbinary(256),${a})=CONVERT(varbinary(256),${b})`;

// fn_my_permissions emits both table and column rows for a table-level grant.
// For a table-level SELECT/INSERT, any emitted column rows are acceptable ONLY
// when that same object+right is in the manifest and full object permission
// was separately confirmed. Customer UPDATE is strictly the named column;
// object-level or other-column UPDATE is not allowed. All other effective
// permissions on user objects, user schemas, database and server are rejected.
return `
IF ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),1)<>0 OR ISNULL(IS_SRVROLEMEMBER(N'securityadmin'),1)<>0
 OR ISNULL(IS_SRVROLEMEMBER(N'serveradmin'),1)<>0 OR ISNULL(IS_SRVROLEMEMBER(N'setupadmin'),1)<>0
 OR ISNULL(IS_SRVROLEMEMBER(N'processadmin'),1)<>0 OR ISNULL(IS_SRVROLEMEMBER(N'diskadmin'),1)<>0
 OR ISNULL(IS_SRVROLEMEMBER(N'dbcreator'),1)<>0 OR ISNULL(IS_SRVROLEMEMBER(N'bulkadmin'),1)<>0
 OR ISNULL(IS_ROLEMEMBER(N'db_owner'),1)<>0 OR ISNULL(IS_ROLEMEMBER(N'db_securityadmin'),1)<>0
 OR ISNULL(IS_ROLEMEMBER(N'db_accessadmin'),1)<>0 OR ISNULL(IS_ROLEMEMBER(N'db_ddladmin'),1)<>0
 OR ISNULL(IS_ROLEMEMBER(N'db_datawriter'),1)<>0 OR ISNULL(IS_ROLEMEMBER(N'db_datareader'),1)<>0
 OR ISNULL(IS_ROLEMEMBER(N'db_backupoperator'),1)<>0
 THROW 51995,'DESKTOP_WRITE_ROLE_REJECTED',1;
IF EXISTS(SELECT 1 FROM sys.fn_my_permissions(NULL,'SERVER') WHERE permission_name NOT IN(N'CONNECT SQL',N'VIEW ANY DATABASE'))
 OR ISNULL(HAS_PERMS_BY_NAME(NULL,NULL,N'CONNECT SQL'),0)<>1
 OR ISNULL(HAS_PERMS_BY_NAME(NULL,NULL,N'VIEW ANY DATABASE'),0)<>1
 OR EXISTS(SELECT 1 FROM sys.fn_my_permissions(NULL,'DATABASE') WHERE permission_name NOT IN(N'CONNECT',N'VIEW DEFINITION',N'VIEW SECURITY DEFINITION',N'VIEW PERFORMANCE DEFINITION',N'VIEW ANY COLUMN ENCRYPTION KEY DEFINITION',N'VIEW ANY COLUMN MASTER KEY DEFINITION'))
 OR ISNULL(HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE',N'CONNECT'),0)<>1
 OR ISNULL(HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE',N'VIEW DEFINITION'),0)<>1
 THROW 51995,'DESKTOP_WRITE_BROAD_PERMISSION_REJECTED',1;
-- Rechecked on every writer admission/transaction. A database that becomes
-- online/reachable later must not silently gain access through guest/PUBLIC.
IF EXISTS(SELECT 1 FROM sys.databases WHERE database_id>4 AND database_id<>DB_ID() AND ISNULL(HAS_DBACCESS(name),1)<>0)
 THROW 51995,'DESKTOP_WRITE_OTHER_DATABASE_ACCESS_REJECTED',1;
-- VIEW DEFINITION is a prerequisite: without complete database metadata,
-- enumerating principals or objects could silently miss granted authority.
IF EXISTS(SELECT 1 FROM sys.database_principals dp
 WHERE dp.type IN(N'S',N'U',N'G',N'E',N'X',N'C',N'K') AND dp.name<>USER_NAME()
 AND ISNULL(HAS_PERMS_BY_NAME(QUOTENAME(dp.name),'USER',N'IMPERSONATE'),1)<>0)
 THROW 51995,'DESKTOP_WRITE_USER_IMPERSONATE_REJECTED',1;
IF EXISTS(SELECT 1 FROM sys.schemas s CROSS APPLY sys.fn_my_permissions(QUOTENAME(s.name),'SCHEMA') p WHERE s.name NOT IN(N'sys',N'INFORMATION_SCHEMA') AND p.permission_name NOT IN(N'VIEW DEFINITION',N'VIEW SECURITY DEFINITION',N'VIEW PERFORMANCE DEFINITION'))
 THROW 51995,'DESKTOP_WRITE_SCHEMA_PERMISSION_REJECTED',1;
IF EXISTS(SELECT 1 FROM ${allowed} WHERE NOT EXISTS(
 SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
 WHERE ${exact('s.name','allowed.schema_name')} AND ${exact('t.name','allowed.object_name')}
 AND ((allowed.column_name IS NULL AND ISNULL(HAS_PERMS_BY_NAME(QUOTENAME(s.name)+N'.'+QUOTENAME(t.name),'OBJECT',allowed.permission_name),0)=1)
 OR (allowed.column_name IS NOT NULL AND ISNULL(HAS_PERMS_BY_NAME(QUOTENAME(s.name)+N'.'+QUOTENAME(t.name),'OBJECT',allowed.permission_name,allowed.column_name,'COLUMN'),0)=1))))
 THROW 51995,'DESKTOP_WRITE_REQUIRED_PERMISSION_MISSING',1;
IF EXISTS(SELECT 1 FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id
 CROSS APPLY sys.fn_my_permissions(QUOTENAME(s.name)+N'.'+QUOTENAME(o.name),'OBJECT') p
 WHERE o.is_ms_shipped=0 AND o.type IN(N'U',N'V',N'P',N'PC',N'FN',N'IF',N'TF',N'FS',N'FT',N'AF',N'SQ',N'SO')
 AND p.permission_name NOT IN(N'VIEW DEFINITION',N'VIEW SECURITY DEFINITION',N'VIEW PERFORMANCE DEFINITION')
 AND NOT EXISTS(SELECT 1 FROM ${allowed} WHERE ${exact('s.name','allowed.schema_name')} AND ${exact('o.name','allowed.object_name')}
 AND ${exact('p.permission_name','allowed.permission_name')}
 AND (allowed.column_name IS NULL OR (${exact('p.subentity_name','allowed.column_name')}))))
 THROW 51995,'DESKTOP_WRITE_OBJECT_PERMISSION_REJECTED',1;`;
}
export const DESKTOP_WRITE_PERMISSION_GUARD_SQL=compileDesktopWritePermissionGuard(DESKTOP_WRITE_OBJECT_PERMISSION_MANIFEST);
