import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {terminalHandoffConfiguration,terminalHandoffRequestAllowed,createTerminalHandoffRuntime} from './terminalHandoffRuntime.mjs';
const context={environment:'CLEAN_SYNTHETIC_TEST',environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67',database:'MELISA_ERP_CLEAN_TEST_20261022',synthetic:true,actualT1:false,externalOperations:false};
const relation={erpUserId:15,crmUserId:'clean-staff-20261022',chatwootAgentId:2,bindingRevision:'a'.repeat(64),active:true};
const config=()=>({MELISA_CLEAN_TEST:'20261022',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_DATABASE:context.database,SQL_USER:'melisa_clean_test_app_20261022',SQL_READ_ONLY:'false',API_PORT:'4194',MELISA_TEST_PROTECTED_SESSION_PATH:'C:\\Sirket\\ERP\\clean\\20261022\\runtime\\protected-erp-sessions\\grants.json',MELISA_TERMINAL_LINK_ENABLED:'true',MELISA_TERMINAL_LINK_PEER_KEY:crypto.randomBytes(32).toString('base64url'),MELISA_TERMINAL_LINK_RELATIONS:JSON.stringify([relation])});
test('default-off, exact clean SQL/API/store target and distinct peer key are mandatory',()=>{
 const cfg=config();assert.equal(terminalHandoffConfiguration(context,cfg).relations.length,1);
 for(const patch of [{MELISA_TERMINAL_LINK_ENABLED:undefined},{MELISA_TERMINAL_LINK_ENABLED:'1'},{SQL_DATABASE:'LIVE'},{API_PORT:'4196'},{SQL_USER:'sa'},{SQL_READ_ONLY:'true'},{SQL_SERVER:'Semih'},{MELISA_TEST_PROTECTED_SESSION_PATH:'elsewhere.json'},{MELISA_TERMINAL_LINK_PEER_KEY:'weak'},{JWT_ACCESS_SECRET:cfg.MELISA_TERMINAL_LINK_PEER_KEY},{OPENAI_API_KEY:'fixture-not-a-real-key'}])assert.throws(()=>terminalHandoffConfiguration(context,{...cfg,...patch}));
 assert.throws(()=>terminalHandoffConfiguration({...context,actualT1:true},cfg));
 assert.deepEqual(terminalHandoffConfiguration(context,{...cfg,MELISA_TERMINAL_LINK_RELATIONS:'[]'}).relations,[]);
});
test('relations must be explicit unique exact metadata; no inferred or caller-selected account',()=>{
 const cfg=config();for(const rows of [null,{},[relation,relation],[{...relation,erpUserId:16},relation],[{...relation,chatwootAgentId:3},relation],[{...relation,username:'inferred'}],[{...relation,active:'true'}],[{...relation,bindingRevision:'unknown'}],[{...relation,bindingRevision:['a'.repeat(64)]}]])assert.throws(()=>terminalHandoffConfiguration(context,{...cfg,MELISA_TERMINAL_LINK_RELATIONS:JSON.stringify(rows)}));
});
test('front admission opens only four exact POST routes with the same valid config',()=>{
 const cfg=config();for(const verb of ['prepare','redeem','verify','revoke'])assert(terminalHandoffRequestAllowed({method:'POST',path:'/api/auth/terminal-handoff/'+verb,query:{}},{context,config:cfg}));
 for(const patch of [{method:'GET'},{path:'/api/auth/terminal-handoff/verify/'},{path:'/api/auth/terminal-handoff/other'},{query:{userId:'15'}}])assert(!terminalHandoffRequestAllowed({method:'POST',path:'/api/auth/terminal-handoff/prepare',query:{},...patch},{context,config:cfg}));
 assert(!terminalHandoffRequestAllowed({method:'POST',path:'/api/auth/terminal-handoff/prepare'},{context,config:{}}));
});
test('runtime relation revocation, key rotation and environment change invalidate already-issued links',async()=>{
 const cfg=config(),sid=crypto.randomUUID(),user={id:15},expiresAt=Date.now()+600000;
 const runtime=createTerminalHandoffRuntime({getContext:()=>context,config:cfg,confirmErpPair:async()=>({confirmed:true,user,normalTestSessionId:sid,expiresAt}),readErpFamily:async()=>({user,normalTestSessionId:sid,expiresAt})});
 const verifier=crypto.randomBytes(32).toString('base64url'),input={accessToken:'fixture-own-access',refreshToken:'fixture-own-refresh',requestId:crypto.randomUUID(),deviceBinding:'b'.repeat(64),codeChallenge:crypto.createHash('sha256').update(verifier).digest('base64url'),erpOrigin:'http://127.0.0.1:5244',crmOrigin:'http://127.0.0.1:62800'};
 const prepared=await runtime.prepare(input),{codeChallenge,accessToken,refreshToken,...request}=input;
 const link=await runtime.redeem({...request,code:prepared.code,codeVerifier:verifier},cfg.MELISA_TERMINAL_LINK_PEER_KEY);
 cfg.MELISA_TERMINAL_LINK_RELATIONS=JSON.stringify([{...relation,active:false}]);
 await assert.rejects(runtime.verify({...request,linkId:link.linkId},cfg.MELISA_TERMINAL_LINK_PEER_KEY));
 cfg.MELISA_TERMINAL_LINK_RELATIONS=JSON.stringify([relation]);cfg.MELISA_TERMINAL_LINK_PEER_KEY=crypto.randomBytes(32).toString('base64url');
 await assert.rejects(runtime.prepare({...input,requestId:crypto.randomUUID()}));runtime.close();
});
