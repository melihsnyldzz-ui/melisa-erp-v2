import test from 'node:test';
import assert from 'node:assert/strict';
import {TARGET,validateHumanInput,assertAccountingTarget,resetAccountingHumanPassword} from './accounting-human-password-core.mjs';

const input=(password='human-fixture-only')=>({password,passwordConfirmation:password,confirmation:true});
function target(){return {
 identity:{server:TARGET.server,database:TARGET.database,databaseId:5,databaseGuid:TARGET.databaseGuid,environmentId:TARGET.environmentId,schemaVersion:7,actualT1:false,externalOperations:false,readOnly:false,windowsOwner:TARGET.windowsOwner,expectedUserVersion:'0000000000000001'},
 user:{id:30018,username:TARGET.username,role_id:19,is_active:true,row_version:Buffer.from('0000000000000001','hex')},
 role:{id:19,code:TARGET.roleCode,is_active:true,is_system_role:false}
};}
function fixture(){
 const admitted=target(),events=[],transaction={commit(){assert.fail('caller owns commit');},rollback(){assert.fail('caller owns rollback');}};
 const sql={BigInt:'bigint',NVarChar:n=>'nvarchar'+n};
 const request=tx=>{assert.equal(tx,transaction);const values={};return {input(key,_type,value){values[key]=value;return this;},async query(text){events.push({kind:'query',text,values,tx});return text.startsWith('SELECT')?{recordset:[admitted.user]}:{recordset:[{row_version:Buffer.from('0000000000000002','hex')}]};}};};
 const dependencies={sql,transaction,request,identity:admitted.identity,
  async readRole(tx,id){assert.equal(tx,transaction);assert.equal(id,19);events.push({kind:'role',tx,id});return admitted.role;},
  async hashPassword(password,rounds){events.push({kind:'hash',rounds});assert.equal(password,'human-fixture-only');return 'fixture-hash-only';},
  async writeAudit(_request,event){events.push({kind:'audit',event});}};
 return {admitted,events,transaction,dependencies};
}

test('fixed target and human input require exact confirmation, matching entries and UTF8 bounds without normalization',()=>{
 assert(Object.isFrozen(TARGET));assert.equal(TARGET.userId,30018);assert.equal(TARGET.roleId,19);
 for(const password of ['a'.repeat(8),'a'.repeat(64),'é'.repeat(36),'  keep spaces  '])assert.equal(validateHumanInput(input(password)),true);
 for(const password of ['a'.repeat(7),'a'.repeat(65),'é'.repeat(37),'😀'.repeat(19),'abcdefg\ud800'])assert.throws(()=>validateHumanInput(input(password)),/HUMAN_INPUT/);
 for(const bad of [{...input(),confirmation:false},{...input(),confirmation:'true'},{...input(),passwordConfirmation:'different'},{...input(),extra:true},{password:'human-fixture-only',confirmation:true},null,[]])assert.throws(()=>validateHumanInput(bad),/HUMAN_INPUT/);
 let accessed=false;const getter={...input()};Object.defineProperty(getter,'password',{enumerable:true,get(){accessed=true;throw Error('must not read');}});assert.throws(()=>validateHumanInput(getter),/HUMAN_INPUT/);assert.equal(accessed,false);
});

test('pure target admission binds database, environment, owner, flags, active account, role and exact prior row version',()=>{
 assert.equal(assertAccountingTarget(target()),true);
 const upper=target();upper.identity.databaseGuid=upper.identity.databaseGuid.toUpperCase();upper.identity.environmentId=upper.identity.environmentId.toUpperCase();assert.equal(assertAccountingTarget(upper),true);
 for(const [key,value] of Object.entries({server:'Semih\\OTHER',database:'master',databaseId:9,databaseGuid:'00000000-0000-0000-0000-000000000000',environmentId:'00000000-0000-0000-0000-000000000000',schemaVersion:6,actualT1:true,externalOperations:true,readOnly:true,windowsOwner:'SEMIH\\Other',expectedUserVersion:'0000000000000002'})){
  const v=target();v.identity[key]=value;assert.throws(()=>assertAccountingTarget(v),/ACCOUNTING_PASSWORD_/);
 }
 for(const [key,value] of Object.entries({id:30002,username:'erp_deneme',role_id:5,is_active:false,row_version:Buffer.from('0000000000000002','hex')})){
  const v=target();v.user[key]=value;assert.throws(()=>assertAccountingTarget(v),/ACCOUNTING_PASSWORD_USER/);
 }
 for(const [key,value] of Object.entries({id:5,code:'operator',is_active:false,is_system_role:true})){
  const v=target();v.role[key]=value;assert.throws(()=>assertAccountingTarget(v),/ACCOUNTING_PASSWORD_ROLE/);
 }
 for(const value of [undefined,1,'bad','000000000000000A']){const v=target();v.identity.expectedUserVersion=value;assert.throws(()=>assertAccountingTarget(v));}
 for(const [key,value] of [['databaseId','5'],['schemaVersion','7'],['actualT1',0],['externalOperations','false'],['readOnly',0]]){const v=target();v.identity[key]=value;assert.throws(()=>assertAccountingTarget(v));}
});

test('invalid human input and identity fail before any injected operation, including hash',async()=>{
 const mutations=[f=>{f.dependencies.identity.database='master';},f=>{f.dependencies.identity.databaseGuid='00000000-0000-0000-0000-000000000000';},f=>{f.dependencies.identity.environmentId='00000000-0000-0000-0000-000000000000';},f=>{f.dependencies.identity.windowsOwner='SEMIH\\Other';},f=>{f.dependencies.identity.schemaVersion=6;},f=>{f.dependencies.identity.expectedUserVersion='bad';}];
 for(const mutate of mutations){const f=fixture();mutate(f);await assert.rejects(resetAccountingHumanPassword(f.dependencies,input()));assert.deepEqual(f.events,[]);}
 for(const value of [{...input(),confirmation:false},{...input(),passwordConfirmation:'different'},input('é'.repeat(37))]){const f=fixture();await assert.rejects(resetAccountingHumanPassword(f.dependencies,value));assert.deepEqual(f.events,[]);}
});

test('locked wrong account, activity, version or role rejects before hashing, update and audit',async()=>{
 const mutations=[f=>{f.admitted.user.id=30002;},f=>{f.admitted.user.username='erp_deneme';},f=>{f.admitted.user.role_id=5;},f=>{f.admitted.user.is_active=false;},f=>{f.admitted.user.row_version=Buffer.from('0000000000000002','hex');},f=>{f.admitted.role.id=5;},f=>{f.admitted.role.code='operator';},f=>{f.admitted.role.is_active=false;},f=>{f.admitted.role.is_system_role=true;}];
 for(const mutate of mutations){const f=fixture();mutate(f);await assert.rejects(resetAccountingHumanPassword(f.dependencies,input()),/ACCOUNTING_HUMAN_PASSWORD_RESET_REJECTED/);assert.equal(f.events.filter(x=>x.kind==='query').length,1);assert.equal(f.events.some(x=>['hash','audit'].includes(x.kind)),false);}
});

test('native adapter canonical BIGINT strings admit the same fixed account and role without coercion',async()=>{
 for(const userId of [30018,'30018'])for(const userRole of [19,'19'])for(const roleId of [19,'19']){
  const f=fixture();f.admitted.user.id=userId;f.admitted.user.role_id=userRole;f.admitted.role.id=roleId;
  assert.equal(assertAccountingTarget(f.admitted),true);
  const result=await resetAccountingHumanPassword(f.dependencies,input());
  assert.equal(result.id,30018);assert.equal(result.sessionsRevoked,true);assert.equal(f.events.filter(e=>e.kind==='hash').length,1);
 }
});

test('native adapter rejects noncanonical, fractional, exponent, bigint and object IDs before hashing',async()=>{
 const invalidUserIds=['030018',' 30018','30018 ','30018.0','3.0018e4',30018.5,30018n,Object(30018),{toString:()=> '30018'},true,null];
 const invalidRoleIds=['019',' 19','19 ','19.0','1.9e1',19.5,19n,Object(19),{valueOf:()=>19},true,null];
 for(const [section,key,values] of [['user','id',invalidUserIds],['user','role_id',invalidRoleIds],['role','id',invalidRoleIds]])for(const value of values){
  const f=fixture();f.admitted[section][key]=value;
  assert.throws(()=>assertAccountingTarget(f.admitted),/ACCOUNTING_PASSWORD_(?:USER|ROLE)/);
  await assert.rejects(resetAccountingHumanPassword(f.dependencies,input()),/ACCOUNTING_HUMAN_PASSWORD_RESET_REJECTED/);
  assert.equal(f.events.filter(e=>e.kind==='query').length,1);assert.equal(f.events.some(e=>['hash','audit'].includes(e.kind)),false);
 }
});

test('normal reset receives the same caller transaction, revokes sessions and returns only the native acknowledgment',async()=>{
 const f=fixture(),result=await resetAccountingHumanPassword(f.dependencies,input());
 assert.deepEqual(result,{id:30018,username:'erp_muhasebe_deneme',passwordConfigured:true,sessionsRevoked:true,rowVersion:'0000000000000002'});
 assert.deepEqual(f.events.map(e=>e.kind),['query','role','hash','query','audit']);assert.equal(f.events[2].rounds,12);
 const update=f.events[3];assert.equal(update.tx,f.transaction);assert.equal(update.values.userId,30018);assert.equal(update.values.actorId,null);assert.equal(update.values.passwordHash,'fixture-hash-only');assert.match(update.text,/WHERE id=@userId/);assert.match(update.text,/WHERE user_id=@userId AND revoked_at IS NULL/);assert.doesNotMatch(update.text,/SET\s+(?:role_id|username|is_active)/i);
 const audit=f.events[4].event;assert.equal(audit.entityId,30018);assert.equal(audit.action,'user_password_reset');assert.equal(audit.afterSnapshot.sessionsRevoked,true);assert.equal(audit.actor,null);
 const publicOutput=JSON.stringify({result,audit});assert(!publicOutput.includes('human-fixture-only'));assert(!publicOutput.includes('fixture-hash-only'));
});

test('input is snapshotted before awaits and dependency failures do not leak secret-bearing messages',async()=>{
 const f=fixture(),human=input(),read=f.dependencies.readRole;
 f.dependencies.readRole=async(...args)=>{human.password='changed-after-submit';human.passwordConfirmation=human.password;f.dependencies.identity.expectedUserVersion='0000000000000009';return read(...args);};
 assert.equal((await resetAccountingHumanPassword(f.dependencies,human)).sessionsRevoked,true);
 const bad=fixture();bad.dependencies.hashPassword=async()=>{throw Error('human-fixture-only fixture-hash-only');};
 await assert.rejects(resetAccountingHumanPassword(bad.dependencies,input()),error=>error.message==='ACCOUNTING_HUMAN_PASSWORD_RESET_REJECTED'&&!error.cause);assert.equal(bad.events.filter(e=>e.kind==='query').length,1);assert(!bad.events.some(e=>e.kind==='audit'));
 const absent=fixture();delete absent.dependencies.readRole;await assert.rejects(resetAccountingHumanPassword(absent.dependencies,input()),/DEPENDENCIES/);assert.deepEqual(absent.events,[]);
});
