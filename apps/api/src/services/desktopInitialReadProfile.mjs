// First-login adapter only, not a database connector, credential provider,
// route, or writable ERP. SQL must be executed by a separately provided
// authenticated, encrypted, pinned physical connection.
const SERVER='Semih\\MELISAERP',DATABASE='MELISA_ERP_DESKTOP_TEST_20261105';
const LOGIN='melisa_desktop_test_app_20261105',ENV='eb2888c2-51cb-4570-a933-397cf7e62806';
const ROLE='empty_local_reader',USERNAME='kurulum';
const permissions=Object.freeze(['customer.view','dashboard.view','product.view','supplier.view']);
const tables=Object.freeze(['audit_logs','auth_refresh_tokens','catalog_items','catalogs','currency_rates','customer_movements','customers',
 'desktop_empty_installation','party_currency_accounts','party_entities','permissions','product_barcodes','product_images','product_prices','products',
 'purchase_invoice_items','purchase_invoices','roles','sales_invoice_items','sales_invoices','stock_movements','supplier_movements','suppliers',
 'system_settings','terminal_devices','terminal_sync_queue','users']);
const business=tables.filter(t=>!['desktop_empty_installation','roles','permissions','users','audit_logs'].includes(t));
const reject=()=>{throw Object.assign(new Error('DESKTOP_INITIAL_READ_REJECTED'),{code:'DESKTOP_INITIAL_READ_REJECTED'});};
function record(v,keys){
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))reject();
 const d=Object.getOwnPropertyDescriptors(v),own=Reflect.ownKeys(v);
 if(own.length!==keys.length||keys.some(k=>!Object.hasOwn(d,k)||!Object.hasOwn(d[k],'value')||!d[k].enumerable)
  ||own.some(k=>typeof k!=='string'||!keys.includes(k)))reject();
 return Object.fromEntries(keys.map(k=>[k,d[k].value]));
}
export const DESKTOP_INITIAL_READ_LIMITS=Object.freeze({credentialProviderImplemented:false,connectionOpenerImplemented:false,
 verifiesCertificate:false,requiresPinnedTlsConnector:true,requiresSamePhysicalConnection:true,
 authenticatesPassword:false,requiresNormalCryptographicLogin:true,readOnly:true,salesWritesEnabled:false,
 fullAdminProfileReady:false,fullErpReady:false,otherDatabaseVisibilityProven:false});

const selectValues=tables.map(t=>`(N'${t}')`).join(',');
const businessChecks=business.map(t=>`EXISTS(SELECT 1 FROM dbo.[${t}])`).join(' OR ');
// No row contents, password hashes, bearer tokens, or commercial values are
// returned. Effective DML and EXECUTE are checked at DB/schema/object level.
export const DESKTOP_INITIAL_READ_IDENTITY_SQL=`SET NOCOUNT ON;
SELECT CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,DB_NAME() databaseName,
 SUSER_SNAME() loginName,ORIGINAL_LOGIN() originalLogin,USER_NAME() databaseUser,
 CONNECTIONPROPERTY('net_transport') transport,CONNECTIONPROPERTY('auth_scheme') authScheme,
 ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),-1) sysadmin,ISNULL(IS_ROLEMEMBER(N'db_owner'),-1) dbOwner,
 ISNULL(HAS_PERMS_BY_NAME(NULL,NULL,'CONTROL SERVER'),-1) controlServer,
 ISNULL(HAS_PERMS_BY_NAME(NULL,NULL,'ALTER ANY LOGIN'),-1) alterAnyLogin,
 ISNULL(HAS_PERMS_BY_NAME(NULL,NULL,'IMPERSONATE ANY LOGIN'),-1) impersonateAnyLogin,
 ISNULL(HAS_PERMS_BY_NAME(NULL,NULL,'ALTER ANY DATABASE'),-1) alterAnyDatabase,
 ISNULL(HAS_PERMS_BY_NAME(NULL,'DATABASE','CONTROL'),-1) databaseControl,
 (SELECT COUNT(*) FROM (SELECT permission_name FROM sys.fn_my_permissions(NULL,'DATABASE')
  UNION ALL SELECT x.permission_name FROM sys.schemas s CROSS APPLY sys.fn_my_permissions(QUOTENAME(s.name),'SCHEMA') x WHERE s.name NOT IN(N'sys',N'INFORMATION_SCHEMA')
  UNION ALL SELECT x.permission_name FROM sys.objects o CROSS APPLY sys.fn_my_permissions(QUOTENAME(SCHEMA_NAME(o.schema_id))+N'.'+QUOTENAME(o.name),'OBJECT') x
   WHERE o.is_ms_shipped=0 AND o.type IN(N'U',N'V',N'P',N'PC',N'FN',N'IF',N'TF',N'FS',N'FT',N'AF',N'SQ')) p
  WHERE permission_name IN(N'INSERT',N'UPDATE',N'DELETE',N'EXECUTE',N'CONTROL',N'TAKE OWNERSHIP',N'IMPERSONATE',N'BACKUP DATABASE',N'BACKUP LOG')
   OR permission_name LIKE N'ALTER%' OR permission_name LIKE N'CREATE%') mutationPermissionCount,
 (SELECT COUNT(*) FROM (VALUES ${selectValues}) t(name) WHERE ISNULL(HAS_PERMS_BY_NAME(N'dbo.'+QUOTENAME(t.name),'OBJECT','SELECT'),0)=1) selectedTableCount,
 CASE WHEN ${businessChecks} THEN 1 ELSE 0 END businessRows,
 (SELECT COUNT(*) FROM dbo.desktop_empty_installation) markerCount,
 (SELECT CONVERT(varchar(36),environment_id) FROM dbo.desktop_empty_installation WHERE id=1) environmentId,
 (SELECT schema_version FROM dbo.desktop_empty_installation WHERE id=1) schemaVersion,
 (SELECT CONVERT(int,read_only) FROM dbo.desktop_empty_installation WHERE id=1) readOnly,
 (SELECT CONVERT(int,actual_t1) FROM dbo.desktop_empty_installation WHERE id=1) actualT1,
 (SELECT CONVERT(int,external_operations) FROM dbo.desktop_empty_installation WHERE id=1) externalOperations;`;
const rowKeys=['serverName','databaseName','loginName','originalLogin','databaseUser','transport','authScheme',
 'sysadmin','dbOwner','controlServer','alterAnyLogin','impersonateAnyLogin','alterAnyDatabase','databaseControl','mutationPermissionCount','selectedTableCount','businessRows','markerCount','environmentId',
 'schemaVersion','readOnly','actualT1','externalOperations'];
export function assertDesktopInitialReadIdentity(input){
 const r=record(input,rowKeys);
 if(r.serverName!==SERVER||r.databaseName!==DATABASE||r.loginName!==LOGIN||r.originalLogin!==LOGIN||r.databaseUser!==LOGIN
  ||r.transport!=='TCP'||r.authScheme!=='SQL'||r.sysadmin!==0||r.dbOwner!==0||r.controlServer!==0
  ||r.alterAnyLogin!==0||r.impersonateAnyLogin!==0||r.alterAnyDatabase!==0||r.databaseControl!==0
  ||r.mutationPermissionCount!==0||r.selectedTableCount!==tables.length||r.businessRows!==0||r.markerCount!==1
  ||typeof r.environmentId!=='string'||r.environmentId.toLowerCase()!==ENV||r.schemaVersion!==1||r.readOnly!==1||r.actualT1!==0||r.externalOperations!==0)reject();
 return true;
}

// The caller obtains these fields only after the existing normal bcrypt auth
// succeeds and after re-reading the active role/current permissions. They are
// data checks, never a password verification or a write authorization.
export function assertDesktopInitialReadUser(input){
 const u=record(input,['id','username','userActive','roleCode','roleActive','permissions']);
 if(typeof u.id!=='string'||!/^[1-9]\d*$/.test(u.id)||BigInt(u.id)>9223372036854775807n||u.username!==USERNAME
  ||u.userActive!==true||u.roleCode!==ROLE||u.roleActive!==true||!Array.isArray(u.permissions)
  ||u.permissions.length!==permissions.length||!u.permissions.every(v=>typeof v==='string')
  ||[...u.permissions].sort().some((v,i)=>v!==permissions[i]))reject();
 return true;
}
// Caller must ensure the same checkout is used by every query. This helper does
// not turn a pool into a pinned session and cannot validate certificate trust.
export async function withDesktopInitialReadSession(connection,work){
 if(!connection||typeof connection.promises?.query!=='function'||typeof work!=='function')reject();
 let result;
 try{result=await connection.promises.query(DESKTOP_INITIAL_READ_IDENTITY_SQL);}catch{reject();}
 if(!Array.isArray(result?.first)||result.first.length!==1)reject();
 assertDesktopInitialReadIdentity(result.first[0]);
 return work(connection);
}
