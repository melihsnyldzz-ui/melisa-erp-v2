// Prepare only the existing dedicated, not-yet-activated Semih TEST profile.
// Other users, existing baselines, journals and the running CRM remain intact.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {semihSetupRoot,checkSemihPrivatePath,transformSemihCredential,readCrmSemihFirstLogin} from './semih-test-local-credential.mjs';
const pkg='C:/Sirket/CRM/releases/crm-shared-test-fb34c293fa58154e00b132d13b8246939ce8cbbb';
const crmRoot='C:/Sirket/CRM/runtime/SEMIH-TEST-20261012';
const require=createRequire(pkg+'/apps/gateway/package.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('SEMIH_CRM_PROFILE_PREPARATION_REJECTED');};
function durableNew(file,bytes){const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
export function encodeSemihCrmEnvironment(env){
 return Buffer.from(Object.entries(env).map(([key,value])=>{if(!/^[A-Z0-9_]+$/.test(key)||typeof value!=='string')fail();const quote=["'",'`'].find(q=>!value.includes(q));if(!quote)fail();return key+'='+quote+value+quote;}).join('\n')+'\n');
}
export async function prepareSemihCrmProfile(){
 if(process.platform!=='win32')fail();
 for(const file of [pkg+'/release-manifest.json',crmRoot+'/owner-activation-handoff.json',crmRoot+'/semih-test-baseline.env'])for(let p=path.resolve(file);;p=path.dirname(p)){if(!fs.existsSync(p)||fs.lstatSync(p).isSymbolicLink())fail();if(p===path.dirname(p))break;}
 const handoff=JSON.parse(fs.readFileSync(crmRoot+'/owner-activation-handoff.json','utf8'));
 if(handoff.active!==false||handoff.requiresSupportedOwnerActivation!==true||handoff.database!=='MELISA_ERP_CRM_SHARED_TEST_20261009_02'||handoff.user?.id!=='crm-semih-test-20261012'||handoff.user?.role!=='patron'||handoff.user?.chatwootAgentId!==2)fail();
 const parse=require('dotenv').parse,oldBytes=fs.readFileSync(crmRoot+'/semih-test-baseline.env');
 const baseline=parse(oldBytes),users=JSON.parse(baseline.WHATSAPP_CRM_AUTH_USERS_JSON);
 if(!Array.isArray(users))fail();const selected=users.filter(u=>u.id==='crm-semih-test-20261012');
 if(selected.length!==1||selected[0].username!=='crm-semih-test'||selected[0].displayName!=='Semih TEST'||selected[0].role!=='patron'||selected[0].chatwootAgentId!==2)fail();
 const personnel=users.filter(u=>u.id==='crm-agent-test-20261011');if(personnel.length!==1||personnel[0].role!=='personel')fail();
 const otherHash=sha(JSON.stringify(users.filter(u=>u.id!=='crm-semih-test-20261012')));
 const credentialFile=path.join(semihSetupRoot,'crm-first-login.dpapi'),newBaseline=crmRoot+'/semih-test-baseline-v3.env',receiptFile=path.join(semihSetupRoot,'crm-profile-v3.json');
 checkSemihPrivatePath(credentialFile,{exists:false});checkSemihPrivatePath(receiptFile,{exists:false});
 if(fs.existsSync(newBaseline)||fs.existsSync(receiptFile))fail();
 let password;
 if(fs.existsSync(credentialFile)){
  const previousFile=path.join(semihSetupRoot,'crm-profile-v2.json');checkSemihPrivatePath(previousFile);const previous=JSON.parse(fs.readFileSync(previousFile,'utf8'));
  if(previous.active!==false||previous.userId!=='crm-semih-test-20261012'||previous.role!=='patron'||previous.chatwootAgentId!==2||previous.previousBaselineSHA256!==sha(oldBytes)||previous.otherUsersSHA256!==otherHash)fail();
  password=(await readCrmSemihFirstLogin()).password;
 }else password=crypto.randomBytes(36).toString('base64url');
 const {createPasswordHash}=await import(pathToFileURL(pkg+'/apps/gateway/src/services/crmAuthService.js').href);
 const next=users.map(u=>u.id==='crm-semih-test-20261012'?{...u,passwordHash:createPasswordHash(password)}:u);
 if(sha(JSON.stringify(next.filter(u=>u.id!=='crm-semih-test-20261012')))!==otherHash)fail();
 if(!fs.existsSync(credentialFile)){
  const body=Buffer.from(JSON.stringify({schemaVersion:'melisa-semih-test-credential.v1',copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',username:'crm-semih-test',password}));
  let cipher;try{cipher=await transformSemihCredential('protect',body);}finally{body.fill(0);}
  try{durableNew(credentialFile,cipher);}finally{cipher.fill(0);}
 }
 const env={...baseline,WHATSAPP_CRM_AUTH_USERS_JSON:JSON.stringify(next),CRM_PAID_AI_ENABLED:'false',CRM_AI_SALES_MODE:'off',WHATSAPP_SEND_ENABLED:'false',WHATSAPP_LIVE_SEND_APPROVED:'false',WAAPI_CHATWOOT_BRIDGE_ENABLED:'false',WAAPI_INCOMING_READER_ENABLED:'false'};
 const encoded=encodeSemihCrmEnvironment(env);
 const roundtrip=parse(encoded);if(Object.keys(env).some(k=>roundtrip[k]!==env[k])||JSON.stringify(JSON.parse(roundtrip.WHATSAPP_CRM_AUTH_USERS_JSON))!==JSON.stringify(next))fail();
 durableNew(newBaseline,encoded);
 const proof={schemaVersion:'melisa-semih-crm-profile-preparation.v1',active:false,sourceCommit:'fb34c293fa58154e00b132d13b8246939ce8cbbb',userId:'crm-semih-test-20261012',role:'patron',chatwootAgentId:2,baselinePath:path.win32.normalize(newBaseline),baselineSHA256:sha(encoded),previousBaselineSHA256:sha(oldBytes),otherUsersUnchanged:true,otherUsersSHA256:otherHash,onlyDedicatedPreparedCredentialRenewed:true,credentialPath:credentialFile,providerSend:false,paidAi:false,live:false};
 durableNew(receiptFile,Buffer.from(JSON.stringify(proof,null,2)+'\n'));return proof;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{if(process.argv.length!==3||process.argv[2]!=='--prepare')fail();console.log(JSON.stringify(await prepareSemihCrmProfile()));}catch{console.error('SEMIH_CRM_PROFILE_PREPARATION_REJECTED');process.exitCode=1;}}
