// SOURCE ONLY. A connector is registered only after a real TLS pool has
// authenticated as the dedicated writer and the v2 target identity is read on
// one physical transaction. The bootstrap/profile/grants are not installed.
import {createHash,X509Certificate} from 'node:crypto';
import {inspect} from 'node:util';
import sql from 'mssql';
import {DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL as DESKTOP_WRITE_PERMISSION_GUARD_SQL} from './desktopLifecyclePermissionPolicy.mjs';
import {DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL} from './desktopMasterV3Policy.mjs';
const PIN='dfb05698389659352709765a2109ed82bde543ca552a403e06df652b2cb004d5';
const LOGIN='melisa_desktop_test_writer_20261105';
const fail=()=>{throw Object.assign(Error('DESKTOP_WRITE_CONNECTOR_REJECTED'),{code:'DESKTOP_WRITE_CONNECTOR_REJECTED'});};
const registered=new WeakMap();
export const DESKTOP_WRITE_CONNECTOR_LIMITS=Object.freeze({sourceOnly:true,writerAccountInstalled:false,writableSchemaInstalled:false,
 certificateDerSha256:PIN,hostname:'SEMIH',trustServerCertificate:false,perConnectionExactDerGuardImplemented:false,
 requiresRuntimeDependencyPin:true,requiresPrivatePasswordProvider:true,realSqlVerified:false});

export function createDesktopWriteTlsConfig(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail();
 const d=Object.getOwnPropertyDescriptors(input),keys=Reflect.ownKeys(input),expected=['password','publicCertificatePem'];
 if(keys.length!==2||keys.some(k=>typeof k!=='string'||!expected.includes(k))||expected.some(k=>!d[k]||!d[k].enumerable||!Object.hasOwn(d[k],'value')))fail();
 const password=d.password.value,pem=d.publicCertificatePem.value;
 if(typeof password!=='string'||password.length<1||password.length>128||/[\0\r\n]/.test(password)||typeof pem!=='string'||pem.length>16384||!/^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END CERTIFICATE-----\r?\n?$/.test(pem))fail();
 let cert;try{cert=new X509Certificate(pem);}catch{fail();}const now=Date.now();
 if(createHash('sha256').update(cert.raw).digest('hex')!==PIN||!cert.checkHost('SEMIH',{subject:'never',wildcards:false,partialWildcards:false})||!Number.isFinite(Date.parse(cert.validFrom))||!Number.isFinite(Date.parse(cert.validTo))||now<Date.parse(cert.validFrom)||now>Date.parse(cert.validTo))fail();
 const config={server:'127.0.0.1',port:51433,database:'MELISA_ERP_DESKTOP_TEST_20261105',user:LOGIN,
  options:{encrypt:true,trustServerCertificate:false,serverName:'SEMIH',cryptoCredentialsDetails:{ca:[pem],minVersion:'TLSv1.2',maxVersion:'TLSv1.2'}},
  pool:{min:0,max:4,idleTimeoutMillis:30000},connectionTimeout:10000,requestTimeout:10000};
 Object.defineProperties(config,{password:{get:()=>password,enumerable:false},toJSON:{value:()=>({profile:'desktop-write-v2',password:'[REDACTED]'}),enumerable:false},
  [inspect.custom]:{value:()=>({profile:'desktop-write-v2',password:'[REDACTED]'}),enumerable:false}});
 return config;
}
const identitySql=`SET NOCOUNT ON;
IF DB_NAME() IS NULL OR DATALENGTH(DB_NAME())<>DATALENGTH(N'MELISA_ERP_DESKTOP_TEST_20261105') OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'MELISA_ERP_DESKTOP_TEST_20261105')
 OR CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'Semih\\MELISAERP')
 OR SUSER_SNAME() IS NULL OR DATALENGTH(SUSER_SNAME())<>DATALENGTH(N'${LOGIN}') OR CONVERT(varbinary(256),SUSER_SNAME())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR ORIGINAL_LOGIN() IS NULL OR DATALENGTH(ORIGINAL_LOGIN())<>DATALENGTH(N'${LOGIN}') OR CONVERT(varbinary(256),ORIGINAL_LOGIN())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR USER_NAME() IS NULL OR DATALENGTH(USER_NAME())<>DATALENGTH(N'${LOGIN}') OR CONVERT(varbinary(256),USER_NAME())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'TCP'
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),1)<>0 OR ISNULL(IS_ROLEMEMBER(N'db_owner'),1)<>0
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1')
 OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='eb2888c2-51cb-4570-a933-397cf7e62806' AND schema_version=2 AND actual_t1=0 AND external_operations=0 AND read_only=0)
 THROW 51995,'DESKTOP_WRITE_CONNECTOR_TARGET_REJECTED',1;
${DESKTOP_WRITE_PERMISSION_GUARD_SQL}
SELECT 1 AS ok;`;
export async function openDesktopWriteTlsConnector(input){return openConnector(input,false);}
export async function openDesktopMasterV3TlsConnector(input){return openConnector(input,true);}
async function openConnector(input,richCards){
 let pool;
 try{
  const config=createDesktopWriteTlsConfig(input);pool=new sql.ConnectionPool(config);
  Object.freeze(config.options.cryptoCredentialsDetails.ca);Object.freeze(config.options.cryptoCredentialsDetails);Object.freeze(config.options);Object.freeze(config.pool);Object.freeze(config);
  await pool.connect();const tx=new sql.Transaction(pool);let begun=false;
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;const statement=richCards?identitySql.replace('schema_version=2','schema_version=3').replace(DESKTOP_WRITE_PERMISSION_GUARD_SQL,DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL):identitySql;const result=await new sql.Request(tx).query(statement);if(!Array.isArray(result?.recordset)||result.recordset.length!==1||result.recordset[0].ok!==1)fail();await tx.commit();begun=false;}
  finally{if(begun)try{await tx.rollback();}catch{}}
  const profile=richCards?'desktop-master-v3':'desktop-write-v2';
  const connector=Object.freeze({profile,transport:'tedious-tls-ca-host'});registered.set(connector,{pool,config,profile});return connector;
 }catch{if(pool)try{await pool.close();}catch{}fail();}
}
export function getDesktopWritePool(connector){const e=registered.get(connector);if(!e||e.pool.config!==e.config||e.pool.connected!==true)fail();return e.pool;}
export function getDesktopWriteProfile(connector){getDesktopWritePool(connector);return registered.get(connector).profile;}
export async function closeDesktopWriteTlsConnector(connector){const e=registered.get(connector);if(!e)fail();registered.delete(connector);await e.pool.close();}
