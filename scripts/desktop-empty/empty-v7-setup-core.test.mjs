import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {emptyV7HeldFileLimit,assertEmptyV7SetupDecision,assertEmptyV7SchemaAcceptance,assertEmptyV7SchemaReview,validateEmptyV7HumanPassword,compileEmptyV7FirstSetup,emptyV7BeforeSetupSql,EMPTY_V7_SETUP_TABLES,EMPTY_V7_SQL_GRANTS} from './empty-v7-setup-core.mjs';
import {EMPTY_V7_TARGET,EMPTY_V7_OWNER_PERMISSION_KEYS} from '../../apps/api/src/config/desktopEmptyV7Profile.mjs';
const identity={adminPid:12345,adminSidHex:'0x01050000000000051500000011223344'};
test('only the fixed pinned Node executable receives the native binary cap; public metadata and other binaries stay bounded',()=>{
 const pin='3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5';
 assert.equal(emptyV7HeldFileLimit('C:/Program Files/nodejs/node.exe',pin),134217728);assert(85000000<emptyV7HeldFileLimit('C:/Program Files/nodejs/node.exe',pin));
 assert(!(134217728<emptyV7HeldFileLimit('C:/Program Files/nodejs/node.exe',pin)));assert(1999999<emptyV7HeldFileLimit('C:/public.json',pin));assert(!(2000000<emptyV7HeldFileLimit('C:/public.json',pin)));
 for(const [file,sha]of [['C:/other/node.exe',pin],['C:/Program Files/nodejs/node.exe','a'.repeat(64)],['C:/public.json',pin],['C:/Program Files/PowerShell/7/pwsh.exe',pin]])assert.equal(emptyV7HeldFileLimit(file,sha),2000000);
});
test('technical schema7 acceptance is separately bound and never implies full ERP/human/LIVE acceptance',()=>{
 const pin='1'.repeat(64),context={adminSidHex:identity.adminSidHex,sqlProcessBirth:'2026-11-10T00:32:27.3873190Z'},target={...EMPTY_V7_TARGET,sqlProcessId:8440,sqlProcessBirth:'2026-11-10T00:32:27.387319Z',adminSid:identity.adminSidHex};delete target.schemaVersion;delete target.actualT1;delete target.externalOperations;target.databaseCreateTime='2026-11-10T11:10:18.03';
 const a={state:'ROOT_EMPTY_PROFILE_SCHEMA7_ACTUAL_ACCEPTANCE_V1',decision:'ACCEPT_EMPTY_SCHEMA7_TECHNICAL_PROFILE_ONLY',schemaVersion:7,schema7Accepted:true,target,independentCombinedReviewSha256:pin,nativeHashes8:Object.fromEntries(['metadata','security','objectIds','identities','rows','marker','semantic','references'].map(n=>[n,'2'.repeat(64)])),actualApplyResultSha256:pin,actualObserverResultSha256:pin,applyRootExitSha256:pin,observerRootExitSha256:pin,totalUserTables:43,emptyBusinessTables:40,markerRows:1,technicalSettingsRows:2,zeroTryCashRows:1,fullK02Acceptance:false,fullERPReady:false,humanAcceptance:false,LIVEAuthorized:false,firstUserOrAppSqlPrincipalAuthorizedByThisRecord:false};
 assert.equal(assertEmptyV7SchemaAcceptance(a,pin,context),true);
 const r={decision:'GO_EMPTY_SCHEMA7_TECHNICAL_PROFILE_ONLY',P1P2Findings:0,target:a.target,sourceHead:'a'.repeat(40),rootApplyDecisionSha256:pin,applyResultSha256:a.actualApplyResultSha256,observerResultSha256:a.actualObserverResultSha256,applyRootExitSha256:a.applyRootExitSha256,observerRootExitSha256:a.observerRootExitSha256,nativeHashes8:a.nativeHashes8,fullK02Acceptance:false,fullERPReady:false,humanAcceptance:false,LIVEAuthorized:false};
 assert.equal(assertEmptyV7SchemaReview(r,a),true);
 for(const patch of [{},{decision:'NOT_RUN'},{P1P2Findings:1},{target:{...a.target,databaseId:5}},{nativeHashes8:{...a.nativeHashes8,rows:'3'.repeat(64)}},{applyResultSha256:'3'.repeat(64)},{observerRootExitSha256:null}]){if(Object.keys(patch).length)assert.throws(()=>assertEmptyV7SchemaReview({...r,...patch},a));else assert.throws(()=>assertEmptyV7SchemaReview({},a));}
 for(const patch of [{schema7Accepted:false},{schemaVersion:2},{independentCombinedReviewSha256:'3'.repeat(64)},{nativeHashes8:{}},{target:{...target,databaseId:5}},{target:{...target,sqlProcessBirth:'2026-11-10T00:32:27.3873191Z'}},...['fullK02Acceptance','fullERPReady','humanAcceptance','LIVEAuthorized','firstUserOrAppSqlPrincipalAuthorizedByThisRecord'].map(k=>({[k]:true}))])assert.throws(()=>assertEmptyV7SchemaAcceptance({...a,...patch},pin,context));
});
function fixture(){const context={packageHash:'a'.repeat(64),sourceHead:'b'.repeat(40),selfSha256:'c'.repeat(64),coreSha256:'d'.repeat(64),windowSha256:'e'.repeat(64),ownerSid:'S-1-5-21-1',recordedSchema7AcceptanceSha256:'f'.repeat(64),actualIndependentReviewSha256:'0'.repeat(64)};return {context,decision:{state:'ROOT_EMPTY_V7_FIRST_SETUP_DECISION_V1',operationId:'580356ae-e96e-41ac-b6b9-e6349cb52b07',packageHash:context.packageHash,sourceHead:context.sourceHead,localSourceSha256:context.selfSha256,coreSha256:context.coreSha256,windowSha256:context.windowSha256,ownerSid:context.ownerSid,target:EMPTY_V7_TARGET,recordedSchema7AcceptanceSha256:context.recordedSchema7AcceptanceSha256,actualIndependentReviewSha256:context.actualIndependentReviewSha256,schema7Accepted:true,newSqlPrincipalAuthorized:true,firstHumanOwnerAuthorized:true,noAutomaticRetry:true,db5Writes:false,otherDatabaseWrites:false,roleOrUserCopyFromDb5:false,businessWrites:false,companyPolicyDefaults:false,externalOperations:false,runtimeAction:false}};}
test('first setup requires an exact separately bound Root decision and actual schema7 review pins',()=>{
 const {decision,context}=fixture();assert.equal(assertEmptyV7SetupDecision(decision,context),true);
 for(const k of ['packageHash','sourceHead','localSourceSha256','coreSha256','windowSha256','recordedSchema7AcceptanceSha256','actualIndependentReviewSha256','ownerSid'])assert.throws(()=>assertEmptyV7SetupDecision({...decision,[k]:'wrong'},context));
 for(const k of ['schema7Accepted','newSqlPrincipalAuthorized','firstHumanOwnerAuthorized','noAutomaticRetry'])assert.throws(()=>assertEmptyV7SetupDecision({...decision,[k]:false},context));
 for(const k of ['db5Writes','otherDatabaseWrites','roleOrUserCopyFromDb5','businessWrites','companyPolicyDefaults','externalOperations','runtimeAction'])assert.throws(()=>assertEmptyV7SetupDecision({...decision,[k]:true},context));
 assert.throws(()=>assertEmptyV7SetupDecision({...decision,target:{...EMPTY_V7_TARGET,databaseId:5}},context));
});
test('only confirmed matching human input of 8-64 characters and at most 72 bcrypt bytes is accepted',()=>{
 const make=password=>({confirmation:true,password,passwordConfirmation:password});
 assert.equal(validateEmptyV7HumanPassword(make('synthetic-human-input')),true);
 for(const v of [make('short'),make('x'.repeat(65)),make('ş'.repeat(37)),make('\ud800'.repeat(8)),{...make('synthetic-input'),confirmation:false},{...make('synthetic-input'),passwordConfirmation:'other'},{...make('synthetic-input'),passwordHash:'forbidden'}])assert.throws(()=>validateEmptyV7HumanPassword(v));
});
test('setup compiles exact DB9 empty43 guards, private parameters and one atomic first-owner transaction',()=>{
 const out=compileEmptyV7FirstSetup(identity),sql=out.sql;
 assert.equal(out.executionAuthorized,false);assert.equal(out.requiresHumanSave,true);assert.equal(out.sha256,createHash('sha256').update(sql).digest('hex'));assert.equal(EMPTY_V7_SETUP_TABLES.length,43);
 for(const value of ['DB_ID()<>9',EMPTY_V7_TARGET.databaseGuid,EMPTY_V7_TARGET.environmentId,EMPTY_V7_TARGET.databaseCreateTime,"N'Shared memory'",'host_process_id','12345',identity.adminSidHex,'EMPTY_V7_SETUP_NOT_EMPTY','EMPTY_V7_SETUP_PRINCIPAL_EXISTS','@technicalPassword','@humanHash','COMMIT TRANSACTION','ROLLBACK TRANSACTION','CREATE LOGIN [melisa_empty_profile_db9_writer_v1]','CREATE USER [melisa_empty_profile_db9_writer_v1]',"VALUES(N'admin'","VALUES(N'kurulum'"])assert(sql.includes(value),value);
 assert.equal((sql.match(/CREATE LOGIN /g)||[]).length,1);assert.equal((sql.match(/INSERT dbo.users/g)||[]).length,1);assert.equal((sql.match(/INSERT dbo.audit_logs/g)||[]).length,1);
 for(const value of ['30002','desktop_first_sale_operator','MELISA_ERP_DESKTOP_TEST_20261105','c67f5317','eb2888c2','ALTER SERVER ROLE','db_owner','TRUSTWORTHY','@humanHash password_hash'])assert(!sql.includes(value),value);
 assert(!sql.slice(sql.indexOf('COMMIT TRANSACTION;SELECT')).includes('@humanHash'));
 for(const table of EMPTY_V7_SETUP_TABLES.filter(n=>!['desktop_empty_installation','system_settings','finance_accounts'].includes(n)))assert(sql.includes('EXISTS(SELECT 1 FROM dbo.['+table+'])'));
 assert(EMPTY_V7_SQL_GRANTS.every(g=>/^GRANT (SELECT|INSERT|UPDATE|DELETE) ON OBJECT::\[dbo\]\.\[[a-z_]+\]( \(\[[a-z_]+\]\))? TO \[desktop_local_writer_v2\];$/.test(g)));
 for(const key of ['goods.view','warehouse.view','finance.payment','sales.view'])assert(EMPTY_V7_OWNER_PERMISSION_KEYS.includes(key));
});
test('native identity compiler rejects invalid PID/SID instead of allowing SQL text input',()=>{
 for(const adminPid of [0,-1,1.2,'12345',Infinity])assert.throws(()=>emptyV7BeforeSetupSql({...identity,adminPid}));
 for(const adminSidHex of ['0x01','bad',"0x00';DROP DATABASE x;--",null])assert.throws(()=>emptyV7BeforeSetupSql({...identity,adminSidHex}));
});
