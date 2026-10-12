// One-shot source qualification against the actual isolated TEST user. This
// never opens a port, launches a client, or changes a commercial SQL record.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire,registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import {semihSetupRoot,readSemihFirstLogin,checkSemihPrivatePath} from './semih-test-local-credential.mjs';
const runtime='C:/Sirket/ERP/releases/CANONICAL-COMPLETE-TEST-20261011-73f4b85';
const require=createRequire(runtime+'/apps/api/package.json');
const fail=()=>{throw Error('SEMIH_NORMAL_AUTH_PROOF_FAILED');};
const identityFile=path.join(semihSetupRoot,'erp-identity.json');
checkSemihPrivatePath(identityFile);const identitySHA=crypto.createHash('sha256').update(fs.readFileSync(identityFile)).digest('hex');
// Use the same pinned runtime's optional native driver, not an ad-hoc install.
const release=JSON.parse(fs.readFileSync(runtime+'/release-manifest.json','utf8'));
if(process.platform!=='win32'||release.sourceCommit!=='73f4b85597f2036e99c74efe22611a3b0ebedf43')fail();
const dependencyUrls=Object.fromEntries(['mssql','mssql/msnodesqlv8.js','bcrypt'].map(name=>[name,pathToFileURL(require.resolve(name)).href]));
registerHooks({resolve(specifier,context,next){return next(dependencyUrls[specifier]??specifier,context);}});
const config=JSON.parse(fs.readFileSync('C:/Sirket/ERP/runtime/terminal-completion-logon/operation-73f4b85597f2.json','utf8'));
const {validateSharedCopyBootstrap}=await import('../../apps/api/src/services/sharedCopyBootstrap.mjs');
const {context,topology}=validateSharedCopyBootstrap(config);
if(context.copyId!=='e16b70f0-4057-428b-9abc-6bbcaf35fe82'||context.target.database!=='MELISA_ERP_CRM_SHARED_TEST_20261009_02'||context.actualT1!==false)fail();
for(const key of Object.keys(process.env))if(/^(SQL_|VEGA_|WHATSAPP_|CRM_|JWT_|NATIVE_|TERMINAL_|MELISA_|SMTP_|EMAIL_|WORKER|SCHEDULE)/i.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'production',API_PORT:String(topology.apiPort),SQL_SERVER:config.server,SQL_DATABASE:config.database,SQL_USER:config.salesSqlUser,SQL_PASSWORD:config.salesSqlPassword,SQL_TRUSTED_CONNECTION:'false',SQL_READ_ONLY:'false',SQL_ENCRYPT:'false',SQL_TRUST_SERVER_CERTIFICATE:'true',JWT_ACCESS_SECRET:config.jwtAccessSecret,JWT_SECRET:config.jwtAccessSecret,JWT_REFRESH_SECRET:config.jwtRefreshSecret,MELISA_TEST_STATELESS_AUTH:'true',MELISA_LOCAL_PASSWORDLESS_LOGIN:'false',WHATSAPP_ENABLED:'false',SMTP_ENABLED:'false',NAKLIYAT_ENABLED:'false',MELISA_TEST_PROTECTED_SESSION_PATH:path.join(semihSetupRoot,'qualification-refresh-journal.json'),MELISA_TEST_SEMIH_IDENTITY_PATH:identityFile,MELISA_TEST_SEMIH_IDENTITY_SHA256:identitySHA});
const {registerIsolatedOperationCopyRuntime}=await import('../../apps/api/src/config/isolatedOperationCopyRuntime.mjs');
registerIsolatedOperationCopyRuntime(context,{database:context.target.database,server:context.target.server,user:context.target.login,port:topology.apiPort,readOnly:false,trustedConnection:false,externalProvidersDisabled:true});
const auth=await import('../../apps/api/src/services/authService.js');
const {getSqlPool}=await import('../../apps/api/src/config/database.js');
let pool,grant;const results={schemaVersion:'melisa-semih-normal-auth-proof.v1',sourceQualification:true,clientStarted:false,apiRuntimeActivated:false,commercialWrites:0};
try{
 pool=await getSqlPool();const target=(await pool.request().query("SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') databaseControl,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') liveDatabaseAccess,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess")).recordset[0];
 if(target.databaseName!==context.target.database||target.serverName!==context.target.server||['sysadmin','databaseControl','liveDatabaseAccess','originalDatabaseAccess'].some(k=>target[k]!==0))fail();
 const credentials=await readSemihFirstLogin(path.join(semihSetupRoot,'erp-first-login.dpapi'));
 grant=await auth.login({username:credentials.username,password:credentials.password},'MelisaSemihSourceQualification');
 const user=await auth.getUserById(grant.user.id),payload=auth.verifyAccessToken(grant.accessToken);
 auth.verifyNormalTestAccessSession(payload,user);
 if(String(user.id)!=='17'||user.username!==credentials.username||user.role.id!==2||user.role.code!=='admin'||!grant.refreshToken)fail();
 results.normalPasswordLogin=true;results.freshUser={id:String(user.id),username:user.username,role:user.role.code};
 const pair=await auth.confirmProtectedNormalSession(grant.accessToken,grant.refreshToken);
 if(pair.confirmed!==true||pair.expiresAt!==grant.expiresAt||String(pair.user.id)!=='17')fail();results.sameGrantPairConfirmed=true;
 try{await auth.confirmProtectedNormalSession(grant.accessToken,crypto.randomBytes(32).toString('base64url'));fail();}catch(error){if(error.code!=='AUTH_REFRESH_INVALID')throw error;results.unrelatedRefreshRejected=true;}
 const oldRefresh=grant.refreshToken;
 grant=await auth.refreshAccessToken(oldRefresh);results.refreshRotated=grant.refreshToken!==oldRefresh;
 try{await auth.refreshAccessToken(oldRefresh);fail();}catch(error){if(error.code!=='AUTH_REFRESH_INVALID')throw error;results.oldRefreshRejected=true;}
 try{await auth.refreshAccessToken(grant.refreshToken,{nativeTerminal:true});fail();}catch(error){if(error.code!=='AUTH_REFRESH_INVALID')throw error;results.nativeContextRejected=true;}
 const current=auth.verifyAccessToken(grant.accessToken),fresh=await auth.getUserById(grant.user.id);
 auth.verifyNormalTestAccessSession(current,fresh);
 await auth.logout(grant.refreshToken);results.logout=true;
 try{auth.verifyNormalTestAccessSession(current,fresh);fail();}catch(error){if(error.code!=='AUTH_REFRESH_INVALID')throw error;results.accessAfterLogoutRejected=true;}
 try{await auth.refreshAccessToken(grant.refreshToken);fail();}catch(error){if(error.code!=='AUTH_REFRESH_INVALID')throw error;results.refreshAfterLogoutRejected=true;}
 const file=path.join(semihSetupRoot,'normal-auth-proof-'+crypto.randomUUID()+'.json');checkSemihPrivatePath(file,{exists:false});fs.writeFileSync(file,JSON.stringify(results,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(results));
}catch{console.error('SEMIH_NORMAL_AUTH_PROOF_FAILED');process.exitCode=1;}
finally{if(grant?.refreshToken)try{await auth.logout(grant.refreshToken);}catch{}if(pool)await pool.close();}
