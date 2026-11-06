import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 EMPTY_LOCAL_PROFILE,EMPTY_LOCAL_IDENTITY_SQL,buildEmptyLocalEnvironment,
 assertEmptyLocalEnvironment,assertEmptyLocalIdentity,assertEmptyLocalSqlConfiguration,assertEmptyLocalUser,emptyLocalSqlOptions,
 getEmptyLocalContext,registerEmptyLocalContext,assertRegisteredEmptyLocalContext,
 emptyLocalRequestAllowed,
} from './emptyLocalContext.mjs';
const secrets=()=>({sqlPassword:'test-only-password',jwtAccessSecret:'A'.repeat(48),jwtRefreshSecret:'B'.repeat(48)});
const environment=()=>buildEmptyLocalEnvironment(secrets());
const identity=()=>({
 databaseName:EMPTY_LOCAL_PROFILE.database,serverName:EMPTY_LOCAL_PROFILE.serverName,
 loginName:EMPTY_LOCAL_PROFILE.login,databaseUser:EMPTY_LOCAL_PROFILE.login,
 sysadmin:0,databaseControl:0,mutationPermissionCount:0,otherUserDatabaseAccess:0,businessRows:0,markerCount:1,
 environmentId:EMPTY_LOCAL_PROFILE.environmentId,schemaVersion:1,actualT1:0,externalOperations:0,readOnly:1,
});
test('exact environment discards inherited business credentials, runtime flags and process options',()=>{
 const inherited={Path:'C:\\Windows',SystemRoot:'C:\\Windows',TEMP:'C:\\Temp',
 SQL_DATABASE:'production',SQL_PASSWORD:'never-retain',VEGA_SQL_PASSWORD:'never-retain',
 MELISA_CANONICAL_TEST:'true',MELISA_CLEAN_TEST:'20261022',NODE_OPTIONS:'--require danger',
 HTTP_PROXY:'http://invalid',OPENAI_API_KEY:'never-retain',JWT_SECRET:'never-retain'};
 const before={...inherited},result=buildEmptyLocalEnvironment(secrets(),inherited);
 assert.deepEqual(inherited,before);assert.equal(result.Path,inherited.Path);
 assert.equal(result.SQL_DATABASE,EMPTY_LOCAL_PROFILE.database);assert.equal(result.SQL_READ_ONLY,'true');
 assert.equal(result.SQL_HOST_NAME_IN_CERTIFICATE,'SEMIH');
 for(const key of ['VEGA_SQL_PASSWORD','MELISA_CANONICAL_TEST','MELISA_CLEAN_TEST','NODE_OPTIONS','HTTP_PROXY','OPENAI_API_KEY','JWT_SECRET'])assert.equal(result[key],undefined);
 assert.doesNotThrow(()=>assertEmptyLocalEnvironment(result));
});
test('wrong profile values, external integrations and mixed runtime flags fail closed',()=>{
 const changes={SQL_DATABASE:'MELISA_ERP_SIRKET_TEST_20260929_01',SQL_USER:'sa',SQL_SERVER:'other',SQL_PORT:'1434',API_PORT:'4144',
 SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'true',SQL_ENCRYPT:'false',SQL_TRUST_SERVER_CERTIFICATE:'true',MELISA_EMPTY_LOCAL:'other',WHATSAPP_ENABLED:'true',
 CORS_ORIGINS:'http://0.0.0.0:5294',SQL_HOST_NAME_IN_CERTIFICATE:'other',SQL_SERVER_NAME:'other',SQL_HOSTNAME_IN_CERTIFICATE:'other',NODE_TLS_REJECT_UNAUTHORIZED:'0',NODE_EXTRA_CA_CERTS:'other.pem',VEGA_SQL_PASSWORD:'injected',MELISA_CANONICAL_TEST:'true',NODE_OPTIONS:'--require x'};
 for(const [key,value]of Object.entries(changes))assert.throws(()=>assertEmptyLocalEnvironment({...environment(),[key]:value}),{code:'EMPTY_LOCAL_PROFILE_REJECTED'},key);
});
test('stdin secret schema rejects extra keys, weak or shared signing keys without changing input',()=>{
 for(const value of [null,[],{...secrets(),database:'other'},{...secrets(),sqlPassword:''},{...secrets(),jwtAccessSecret:'short'},{...secrets(),jwtRefreshSecret:'A'.repeat(48)}])assert.throws(()=>buildEmptyLocalEnvironment(value),{code:'EMPTY_LOCAL_PROFILE_REJECTED'});
 const input=Object.freeze(secrets());assert.doesNotThrow(()=>buildEmptyLocalEnvironment(input));
});
test('SQL identity rejects wrong DB/login/server, cross database access and malformed installation marker',()=>{
 assert.equal(assertEmptyLocalIdentity(identity()).databaseName,EMPTY_LOCAL_PROFILE.database);
 const changes={databaseName:'other',serverName:'other',loginName:'sa',databaseUser:'dbo',
 sysadmin:1,databaseControl:1,mutationPermissionCount:1,otherUserDatabaseAccess:1,businessRows:1,markerCount:0,environmentId:'wrong',
 schemaVersion:2,actualT1:1,externalOperations:1,readOnly:0};
 for(const [key,value]of Object.entries(changes))assert.throws(()=>assertEmptyLocalIdentity({...identity(),[key]:value}),{code:'EMPTY_LOCAL_PROFILE_REJECTED'},key);
 assert.throws(()=>assertEmptyLocalIdentity({...identity(),markerCount:2}));
 assert.throws(()=>assertEmptyLocalIdentity({...identity(),mutationPermissionCount:undefined}));
 for(const businessRows of [undefined,null,'0',-1,1,Number.NaN])assert.throws(()=>assertEmptyLocalIdentity({...identity(),businessRows}),{code:'EMPTY_LOCAL_PROFILE_REJECTED'});
 assert.match(EMPTY_LOCAL_IDENTITY_SQL,/CASE WHEN SUM\(row_count\)=0 THEN CONVERT\(int,0\) ELSE CONVERT\(int,1\) END/);
 assert.match(EMPTY_LOCAL_IDENTITY_SQL,/sys.fn_my_permissions\(NULL,'DATABASE'\)/);
 assert.match(EMPTY_LOCAL_IDENTITY_SQL,/'SCHEMA'/);
 assert.match(EMPTY_LOCAL_IDENTITY_SQL,/'OBJECT'/);
 assert.match(EMPTY_LOCAL_IDENTITY_SQL,/database_id>4 AND name<>DB_NAME\(\) AND HAS_DBACCESS\(name\)=1/);
});
test('registered profile cannot authorize a changed shared SQL configuration',()=>{
 const valid={port:4294,sql:{enabled:true,server:'127.0.0.1',port:1433,database:EMPTY_LOCAL_PROFILE.database,user:EMPTY_LOCAL_PROFILE.login,readOnly:true,trustedConnection:false,encrypt:true,trustServerCertificate:false,hostNameInCertificate:'SEMIH'}};
 assert.doesNotThrow(()=>assertEmptyLocalSqlConfiguration(valid));
 for(const key of ['database','user','readOnly','trustedConnection'])assert.throws(()=>assertEmptyLocalSqlConfiguration({...valid,sql:{...valid.sql,[key]:key==='readOnly'?false:key==='trustedConnection'?true:'wrong'}}));
 assert.throws(()=>assertEmptyLocalSqlConfiguration({...valid,port:4144}));
 assert.deepEqual(emptyLocalSqlOptions(valid),{encrypt:true,trustServerCertificate:false,readOnlyIntent:true,serverName:'SEMIH'});
 for(const [key,values]of Object.entries({hostNameInCertificate:[undefined,'semih','127.0.0.1','other','SEMIH\\\\MELISADEV'],encrypt:[false],trustServerCertificate:[true],server:['other','localhost'],port:[1434],serverName:['other'],options:[{serverName:'other'}]}))for(const value of values)assert.throws(()=>emptyLocalSqlOptions({...valid,sql:{...valid.sql,[key]:value}}),{code:'EMPTY_LOCAL_PROFILE_REJECTED'});
 assert.throws(()=>emptyLocalSqlOptions({...valid,options:{trustServerCertificate:true}}),{code:'EMPTY_LOCAL_PROFILE_REJECTED'});
});
test('request scope exposes real auth/read lists and closes CRUD, cash ensure, Vega and imports',()=>{
 const allowed=['/api/health','/api/auth/me','/api/products','/api/products/options','/api/customers','/api/suppliers','/api/dashboard/summary','/api/dashboard/alerts'];
 for(const path of allowed){assert.equal(emptyLocalRequestAllowed('GET',path),true);assert.equal(emptyLocalRequestAllowed('DELETE',path),false);}
 assert.equal(emptyLocalRequestAllowed('POST','/api/auth/login'),true);
 for(const path of ['/api/products','/api/customers/cash/ensure','/api/auth/local-passwordless-admin','/api/auth/test-admin','/api/auth/refresh','/api/import','/api/vega/products','/api/work-sales/drafts'])assert.equal(emptyLocalRequestAllowed('POST',path),false);
 for(const path of ['/api/products/1','/api/vega/products','/api/terminal-users','/api/products/','/api//products'])assert.equal(emptyLocalRequestAllowed('GET',path),false);
});
test('only the separately permissioned local reader is accepted after normal authentication',()=>{
 const user={username:'kurulum',role:{code:'empty_local_reader'},permissions:['product.view','customer.view','supplier.view','dashboard.view']};
 assert.equal(assertEmptyLocalUser(user),user);
 for(const changed of [{username:'admin'},{role:{code:'admin'}},{isAdmin:true},{testAdminSession:true},{permissions:[...user.permissions,'product.create']},{permissions:['product.view']}])assert.throws(()=>assertEmptyLocalUser({...user,...changed}));
});
test('dotenv remains available to legacy profiles but is disabled before empty imports',async()=>{
 const source=await readFile(new URL('../config/env.js',import.meta.url),'utf8');
 assert.match(source,/if \(process.env.MELISA_EMPTY_LOCAL !== undefined\)/);
 assert.match(source,/else \{\s*dotenv.config\(\{ path: '\.env\.local' \}\);\s*dotenv.config\(\);/);
 const server=await readFile(new URL('../emptyLocalServer.mjs',import.meta.url),'utf8');
 assert.ok(server.indexOf('registerEmptyLocalContext(identity[0])')<server.indexOf("import('./services/authService.js')"));
 assert.match(server,/app.listen\(4294,'127.0.0.1'/);
 assert.doesNotMatch(server,/import\(['"]\.\/app\.js/);
});
test('registration requires proof, cannot happen twice and exposes only a safe health profile',()=>{
 assert.equal(getEmptyLocalContext(),null);
 assert.throws(()=>assertRegisteredEmptyLocalContext(environment()));
 assert.throws(()=>registerEmptyLocalContext({...identity(),otherUserDatabaseAccess:1},environment()));
 const profile=registerEmptyLocalContext(identity(),environment());
 assert.deepEqual(Object.keys(profile).sort(),['actualT1','environment','environmentId','externalOperations','profile','readOnly']);
 assert.equal(profile.readOnly,true);assert.equal(Object.isFrozen(profile),true);
 assert.equal(assertRegisteredEmptyLocalContext(environment()),profile);
 assert.throws(()=>registerEmptyLocalContext(identity(),environment()));
});
