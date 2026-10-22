// Explicit synthetic installation. It cannot adopt a legacy TEST or business DB.
export const CLEAN_DATABASE='MELISA_ERP_CLEAN_TEST_20261022';
export const CLEAN_LOGIN='melisa_clean_test_app_20261022';
export const CLEAN_ENVIRONMENT_ID='e662fd94-d797-4b3b-938a-d143ad758b67';
export const CLEAN_IDENTITY_SQL=`SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,ORIGINAL_LOGIN() loginName,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') databaseControl,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,(SELECT COUNT(*) FROM sys.databases WHERE name<>DB_NAME() AND (UPPER(name) LIKE '%PROD%' OR UPPER(name) LIKE '%LIVE%' OR UPPER(name) LIKE '%SHARED%') AND HAS_DBACCESS(name)=1) liveDatabaseAccess,(SELECT CONVERT(varchar(36),environment_id) FROM dbo.clean_test_environment WHERE id=1 AND synthetic=1 AND actual_t1=0 AND external_operations=0) environmentId`;
let registered=null;
const fail=()=>{throw Object.assign(new Error('Clean synthetic identity rejected'),{code:'CLEAN_TEST_IDENTITY_REJECTED',statusCode:503});};
export function assertCleanEnvironment(environment=process.env){
 if(environment.MELISA_CLEAN_TEST!=='20261022'||environment.SQL_SERVER!=='127.0.0.1'||String(environment.SQL_PORT)!=='1433'||environment.SQL_DATABASE!==CLEAN_DATABASE||environment.SQL_USER!==CLEAN_LOGIN||environment.SQL_READ_ONLY!=='false'||environment.SQL_TRUSTED_CONNECTION==='true'||!['4194','4196'].includes(String(environment.API_PORT))||Object.keys(environment).some(k=>/^(VEGA_SQL_|OPENAI_API_KEY|WHATSAPP_API_KEY)/.test(k)&&environment[k]))fail();
}
export function assertCleanIdentity(identity){
 if(identity?.databaseName!==CLEAN_DATABASE||identity.serverName!=='Semih\\MELISADEV'||identity.loginName!==CLEAN_LOGIN||identity.databaseUser!==CLEAN_LOGIN||identity.sysadmin!==0||identity.databaseControl!==0||identity.originalDatabaseAccess!==0||identity.liveDatabaseAccess!==0||identity.environmentId?.toLowerCase()!==CLEAN_ENVIRONMENT_ID)fail();return identity;
}
export function registerCleanContext(identity,environment=process.env){if(registered)fail();assertCleanEnvironment(environment);assertCleanIdentity(identity);registered=Object.freeze({environment:'CLEAN_SYNTHETIC_TEST',environmentId:CLEAN_ENVIRONMENT_ID,database:CLEAN_DATABASE,crmOrigin:'http://127.0.0.1:62801',synthetic:true,actualT1:false,externalOperations:false});return registered;}
export function getCleanContext(){return registered;}
export function assertRegisteredCleanContext(){if(!registered)fail();assertCleanEnvironment();return registered;}
