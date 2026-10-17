// Prepared normal CRM account source qualification; no server, paid AI,
// provider call, message, SQL write or shared-user/password change.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readCrmSemihFirstLogin,semihSetupRoot,checkSemihPrivatePath} from './semih-test-local-credential.mjs';
const pkg='C:/Sirket/CRM/releases/crm-shared-test-fb34c293fa58154e00b132d13b8246939ce8cbbb',require=createRequire(pkg+'/apps/gateway/package.json');
const baseline=require('dotenv').parse(fs.readFileSync('C:/Sirket/CRM/runtime/SEMIH-TEST-20261012/semih-test-baseline-v3.env'));
for(const key of Object.keys(process.env))if(/^(CRM_|WHATSAPP_|WAAPI_|OPENAI_|AI_|JWT_|SMTP_|EMAIL_)/i.test(key))delete process.env[key];
for(const key of ['WHATSAPP_CRM_AUTH_USERS_JSON','WHATSAPP_CRM_AUTH_JWT_SECRET','WHATSAPP_CRM_AUTH_ISSUER','WHATSAPP_CRM_AUTH_AUDIENCE'])if(typeof baseline[key]==='string')process.env[key]=baseline[key];
Object.assign(process.env,{CRM_ISOLATED_PREPARATION:'true',CRM_TEST_EXPECTED_DATABASE:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',CRM_NORMAL_REFRESH_ENABLED:'true',CRM_NORMAL_REFRESH_USER_ID:'crm-agent-test-20261011',CRM_NORMAL_REFRESH_JOURNAL_PATH:'C:\\Sirket\\CRM\\runtime\\ERP-COMPLETION01-20261011\\protected-normal-sessions\\refresh-journal.json',CRM_SEMIH_TEST_CONTINUE_ENABLED:'true',CRM_SEMIH_TEST_AGENT_ID:'2',CRM_SEMIH_TEST_REFRESH_JOURNAL_PATH:'C:\\Sirket\\CRM\\runtime\\SEMIH-TEST-20261012\\qualification-refresh-journal.json',CRM_PAID_AI_ENABLED:'false',CRM_AI_SALES_MODE:'off',WHATSAPP_SEND_ENABLED:'false',WHATSAPP_LIVE_SEND_APPROVED:'false',WAAPI_CHATWOOT_BRIDGE_ENABLED:'false',WAAPI_INCOMING_READER_ENABLED:'false'});
let grant,auth;const fail=()=>{throw Error('SEMIH_CRM_NORMAL_AUTH_PROOF_FAILED');};
try{
 auth=await import(pathToFileURL(pkg+'/apps/gateway/src/services/crmAuthService.js').href);
 const credential=await readCrmSemihFirstLogin();grant=auth.authenticateCrmUser(credential);
 const user=auth.verifyCrmAccessToken(grant.accessToken);
 if(user.id!=='crm-semih-test-20261012'||user.role!=='patron'||user.chatwootAgentId!==2||!grant.refreshToken)fail();
 const old=grant.refreshToken;grant=auth.refreshNormalCrmSession(old);
 if(grant.refreshToken===old)fail();
 let oldRejected=false;try{auth.refreshNormalCrmSession(old);}catch(e){oldRejected=e.code==='AUTH_TOKEN_INVALID';}if(!oldRejected)fail();
 const current=grant.accessToken;auth.verifyCrmAccessToken(current);auth.logoutSemihCrmSession(grant.refreshToken);
 let accessRejected=false,refreshRejected=false;try{auth.verifyCrmAccessToken(current);}catch(e){accessRejected=e.code==='AUTH_TOKEN_INVALID';}try{auth.refreshSemihCrmSession(grant.refreshToken);}catch(e){refreshRejected=e.code==='AUTH_TOKEN_INVALID';}if(!accessRejected||!refreshRejected)fail();
 const proof={schemaVersion:'melisa-semih-crm-normal-auth-proof.v1',sourceQualification:true,runtimeActivated:false,clientStarted:false,user:{id:user.id,role:user.role,chatwootAgentId:user.chatwootAgentId},protectedCredentialRead:true,normalPasswordLogin:true,freshUser:true,refreshRotated:true,oldRefreshRejected:true,logout:true,accessAfterLogoutRejected:true,refreshAfterLogoutRejected:true,providerCalls:0,paidAiCalls:0,messages:0,commercialWrites:0};
 const file=path.join(semihSetupRoot,'crm-normal-auth-proof-'+crypto.randomUUID()+'.json');checkSemihPrivatePath(file,{exists:false});fs.writeFileSync(file,JSON.stringify(proof,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(proof));
}catch{console.error('SEMIH_CRM_NORMAL_AUTH_PROOF_FAILED');process.exitCode=1;}
finally{if(auth&&grant?.refreshToken)try{auth.logoutSemihCrmSession(grant.refreshToken);}catch{}}
