// Exact local empty installation; no legacy TEST, production or synthetic authority.
export const EMPTY_LOCAL_PROFILE=Object.freeze({
  id:'empty-local-20261105',database:'MELISA_ERP_EMPTY_TEST_20261105',
  login:'melisa_empty_test_read_20261105',serverName:'Semih\\MELISADEV',
  environmentId:'94a8324f-124a-49e4-ad70-be3232989f47',host:'127.0.0.1',
  sqlPort:1433,apiPort:4294,webPort:5294,
});
const required=Object.freeze({
  MELISA_EMPTY_LOCAL:'20261105',NODE_ENV:'production',APP_NAME:'melisa-empty-local',
  API_PORT:'4294',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',
  SQL_DATABASE:EMPTY_LOCAL_PROFILE.database,SQL_USER:EMPTY_LOCAL_PROFILE.login,
  SQL_TRUSTED_CONNECTION:'false',SQL_READ_ONLY:'true',SQL_ENCRYPT:'true',
  SQL_TRUST_SERVER_CERTIFICATE:'false',MELISA_TEST_STATELESS_AUTH:'true',
  MELISA_LOCAL_PASSWORDLESS_LOGIN:'false',WHATSAPP_ENABLED:'false',
  NAKLIYAT_ENABLED:'false',SMTP_ENABLED:'false',EMAIL_ENABLED:'false',
  WORKERS_ENABLED:'false',SCHEDULER_ENABLED:'false',MELISA_INVOICE_EXPORT_ENABLED:'false',
  TERMINAL_RECEIPT_PRINT_ENABLED:'false',TERMINAL_RECEIPT_PRINT_MODE:'disabled',
  CORS_ORIGINS:'http://127.0.0.1:5294',JWT_ACCESS_EXPIRES_IN:'30m',
  RATE_LIMIT_ENABLED:'true',RATE_LIMIT_WINDOW_MS:'60000',RATE_LIMIT_MAX:'120',
  REQUEST_BODY_LIMIT:'16kb',
});
function rejected(){return Object.assign(new Error('Empty local profile rejected'),{code:'EMPTY_LOCAL_PROFILE_REJECTED',statusCode:503});}
function need(value){if(!value)throw rejected();}
export function buildEmptyLocalEnvironment(secrets,inherited={}){
  need(secrets&&Object.getPrototypeOf(secrets)===Object.prototype&&Object.keys(secrets).sort().join(',')==='jwtAccessSecret,jwtRefreshSecret,sqlPassword');
  need(typeof secrets.sqlPassword==='string'&&secrets.sqlPassword.length>0&&secrets.sqlPassword.length<=1024);
  for(const key of ['jwtAccessSecret','jwtRefreshSecret'])need(typeof secrets[key]==='string'&&secrets[key].length>=32&&secrets[key].length<=256);
  need(secrets.jwtAccessSecret!==secrets.jwtRefreshSecret);
  const result={};
  for(const [key,value]of Object.entries(inherited))if(/^(SystemRoot|windir|Path|TEMP|TMP|COMSPEC)$/i.test(key)&&typeof value==='string')result[key]=value;
  return {...result,...required,SQL_PASSWORD:secrets.sqlPassword,JWT_ACCESS_SECRET:secrets.jwtAccessSecret,JWT_REFRESH_SECRET:secrets.jwtRefreshSecret};
}
export function assertEmptyLocalEnvironment(environment=process.env){
  for(const [key,value]of Object.entries(required))need(environment[key]===value);
  need(typeof environment.SQL_PASSWORD==='string'&&environment.SQL_PASSWORD.length>0);
  need(typeof environment.JWT_ACCESS_SECRET==='string'&&environment.JWT_ACCESS_SECRET.length>=32&&typeof environment.JWT_REFRESH_SECRET==='string'&&environment.JWT_REFRESH_SECRET.length>=32&&environment.JWT_ACCESS_SECRET!==environment.JWT_REFRESH_SECRET);
  const allowed=new Set([...Object.keys(required),'SQL_PASSWORD','JWT_ACCESS_SECRET','JWT_REFRESH_SECRET']);
  for(const [key,value]of Object.entries(environment))if(value&&!allowed.has(key)&&/^(SQL_|VEGA_|MELISA_|JWT_|NATIVE_|TERMINAL_|PILOT_|CRM_|OPENAI_|WHATSAPP_|NAKLIYAT_|SMTP_|MAIL_|EMAIL_|WORKER|SCHEDULE|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NODE_OPTIONS|NODE_PATH)/i.test(key))throw rejected();
}
export const EMPTY_LOCAL_IDENTITY_SQL=`
SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,
 ORIGINAL_LOGIN() loginName,USER_NAME() databaseUser,
 IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') databaseControl,
 (SELECT COUNT(*) FROM (
   SELECT permission_name FROM sys.fn_my_permissions(NULL,'DATABASE')
   UNION ALL
   SELECT p.permission_name FROM sys.schemas s
   CROSS APPLY sys.fn_my_permissions(QUOTENAME(s.name),'SCHEMA') p
   WHERE s.name NOT IN(N'sys',N'INFORMATION_SCHEMA')
   UNION ALL
   SELECT p.permission_name FROM sys.objects o
   CROSS APPLY sys.fn_my_permissions(QUOTENAME(SCHEMA_NAME(o.schema_id))+N'.'+QUOTENAME(o.name),'OBJECT') p
   WHERE o.is_ms_shipped=0 AND o.type IN(N'U',N'V',N'P',N'PC',N'FN',N'IF',N'TF',N'FS',N'FT',N'AF',N'SQ')
 ) effective WHERE permission_name IN(N'INSERT',N'UPDATE',N'DELETE',N'EXECUTE',N'CONTROL',N'TAKE OWNERSHIP',N'IMPERSONATE',N'BACKUP DATABASE',N'BACKUP LOG')
   OR permission_name LIKE N'ALTER%' OR permission_name LIKE N'CREATE%') mutationPermissionCount,
 (SELECT COUNT(*) FROM sys.databases WHERE database_id>4 AND name<>DB_NAME() AND HAS_DBACCESS(name)=1) otherUserDatabaseAccess,
 (SELECT CASE WHEN SUM(row_count)=0 THEN CONVERT(int,0) ELSE CONVERT(int,1) END FROM (
   SELECT COUNT_BIG(*) row_count FROM dbo.products
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.product_barcodes
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.product_images
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.customers
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.suppliers
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.terminal_devices
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.currency_rates
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.sales_invoices
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.sales_invoice_items
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.purchase_invoices
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.purchase_invoice_items
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.stock_movements
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.catalogs
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.catalog_items
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.terminal_sync_queue
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.customer_movements
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.supplier_movements
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.system_settings
   UNION ALL SELECT COUNT_BIG(*) FROM dbo.auth_refresh_tokens
 ) business) businessRows,
 (SELECT COUNT(*) FROM dbo.empty_local_installation) markerCount,
 (SELECT CONVERT(varchar(36),environment_id) FROM dbo.empty_local_installation WHERE id=1) environmentId,
 (SELECT schema_version FROM dbo.empty_local_installation WHERE id=1) schemaVersion,
 (SELECT CONVERT(int,actual_t1) FROM dbo.empty_local_installation WHERE id=1) actualT1,
 (SELECT CONVERT(int,external_operations) FROM dbo.empty_local_installation WHERE id=1) externalOperations,
 (SELECT CONVERT(int,read_only) FROM dbo.empty_local_installation WHERE id=1) readOnly;
`;
export function assertEmptyLocalIdentity(identity){
  need(identity?.databaseName===EMPTY_LOCAL_PROFILE.database&&identity.serverName===EMPTY_LOCAL_PROFILE.serverName&&identity.loginName===EMPTY_LOCAL_PROFILE.login&&identity.databaseUser===EMPTY_LOCAL_PROFILE.login);
  need(identity.sysadmin===0&&identity.databaseControl===0&&identity.mutationPermissionCount===0&&identity.otherUserDatabaseAccess===0&&identity.businessRows===0);
  need(identity.markerCount===1&&identity.environmentId?.toLowerCase()===EMPTY_LOCAL_PROFILE.environmentId&&identity.schemaVersion===1&&identity.actualT1===0&&identity.externalOperations===0&&identity.readOnly===1);
  return identity;
}
export function assertEmptyLocalSqlConfiguration(configuration){
  need(configuration?.port===4294&&configuration.sql?.enabled===true&&configuration.sql.server==='127.0.0.1'&&configuration.sql.port===1433&&configuration.sql.database===EMPTY_LOCAL_PROFILE.database&&configuration.sql.user===EMPTY_LOCAL_PROFILE.login&&configuration.sql.readOnly===true&&configuration.sql.trustedConnection===false&&configuration.sql.encrypt===true&&configuration.sql.trustServerCertificate===false);
}
let registered=null;
export function registerEmptyLocalContext(identity,environment=process.env){
  need(registered===null);assertEmptyLocalEnvironment(environment);assertEmptyLocalIdentity(identity);
  registered=Object.freeze({profile:EMPTY_LOCAL_PROFILE.id,environment:'EMPTY_LOCAL_TEST',environmentId:EMPTY_LOCAL_PROFILE.environmentId,readOnly:true,actualT1:false,externalOperations:false});
  return registered;
}
export function getEmptyLocalContext(){return registered;}
export function assertEmptyLocalUser(user){
  const permissions=['customer.view','dashboard.view','product.view','supplier.view'];
  need(user?.username==='kurulum'&&user.role?.code==='empty_local_reader'&&user.isAdmin!==true&&user.testAdminSession!==true&&user.isActive!==false);
  need(Array.isArray(user.permissions)&&user.permissions.length===permissions.length&&[...user.permissions].sort().every((permission,index)=>permission===permissions[index]));
  return user;
}
export function assertRegisteredEmptyLocalContext(environment=process.env){
  need(registered!==null);assertEmptyLocalEnvironment(environment);return registered;
}
const reads=new Set(['/api/auth/me','/api/products','/api/products/options','/api/customers','/api/suppliers','/api/dashboard/summary','/api/dashboard/alerts']);
export function emptyLocalRequestAllowed(method,requestPath){
  return typeof requestPath==='string'&&(method==='POST'&&requestPath==='/api/auth/login'||method==='GET'&&(requestPath==='/api/health'||reads.has(requestPath)));
}

