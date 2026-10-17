import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {worktest,validateWorktestSession} from './protectedWorkSessionPolicy.mjs';
import {validateWorktestPackage,startWorktestEntry} from './worktest-entry.mjs';
import {semihIdentityPath,semihCredentialPath,validateSemihEntryPin,validateSemihHostIdentity,readSemihHostIdentity,createSemihHostEntry,createSemihStartupState} from './semihHostEntry.mjs';
const identity={schemaVersion:'melisa-semih-test-identity.v1',copyId:worktest.copyId,target:{server:worktest.server,database:worktest.database},userId:'17',username:'erp-semih-test-20261012',displayName:'Semih TEST',role:{id:'2',code:'admin'},fingerprint:'c'.repeat(64)};
const user={id:17,username:identity.username,displayName:identity.displayName,role:{id:2,code:'admin'},permissions:['product.view']};
const grant=n=>({accessToken:'PRIVATE_ACCESS_'+n,refreshToken:'PRIVATE_REFRESH_'+n,expiresAt:Date.now()+600000,user});
const pin={identityPath:semihIdentityPath,identitySHA256:'d'.repeat(64)};
const publicPackage={schemaVersion:'melisa-windows-worktest-package.v1',sourceCommit:'a'.repeat(40),copyId:worktest.copyId,databaseName:worktest.database,serverName:worktest.server};
test('only exact optional public Semih identity pin; legacy entry scrubs environment selection',async()=>{
 assert.equal(validateWorktestPackage({...publicPackage,semihTestEntry:pin}).semihTestEntry.identityPath,semihIdentityPath);
 for(const invalid of [null,{...pin,password:'PRIVATE'}, {...pin,identityPath:'C:\\other.json'},{...pin,identitySHA256:'latest'}])assert.throws(()=>validateWorktestPackage({...publicPackage,semihTestEntry:invalid}));
 let imported=false;const env={MELISA_DESKTOP_SEMIH_ENTRY_PIN:'untrusted'};
 await startWorktestEntry({env,platform:'win32',electronVersion:'39.8.10',readPin:async()=>publicPackage,loadMain:async()=>{imported=true;assert(!Object.hasOwn(env,'MELISA_DESKTOP_SEMIH_ENTRY_PIN'));}});assert(imported);
 await startWorktestEntry({env,platform:'win32',electronVersion:'39.8.10',readPin:async()=>({...publicPackage,semihTestEntry:pin}),loadMain:async()=>assert.deepEqual(JSON.parse(env.MELISA_DESKTOP_SEMIH_ENTRY_PIN),pin)});
});
test('private identity exact hash, fixed file, size and no-reparse checks fail closed',()=>{
 const bytes=Buffer.from(JSON.stringify(identity)),p={...pin,identitySHA256:createHash('sha256').update(bytes).digest('hex')};
 const stat={isSymbolicLink:()=>false,isFile:()=>true,nlink:1,size:bytes.length},io={lstatSync:()=>stat,readFileSync:()=>bytes};
 assert.equal(readSemihHostIdentity(p,{platform:'win32',io}).userId,'17');
 for(const patch of [{platform:'linux'},{io:{...io,lstatSync:()=>({...stat,isSymbolicLink:()=>true})}},{io:{...io,lstatSync:()=>({...stat,nlink:2})}},{io:{...io,readFileSync:()=>Buffer.from('{}')}}])assert.throws(()=>readSemihHostIdentity(p,{platform:'win32',io,...patch}));
 for(const patch of [{userId:'15'},{role:{id:'2',code:'isolated_test_sales'}},{target:{...identity.target,database:'LIVE'}},{copyId:'other'},{fingerprint:'x'}])assert.throws(()=>validateSemihHostIdentity({...identity,...patch}));
 assert.throws(()=>validateSemihEntryPin({...pin,token:'SECRET'}));
});
test('Semih session scope cannot widen legacy 15/16 or mix identities',()=>{
 const record={accessToken:'a',refreshToken:'r',userId:'17',username:identity.username,expiresAt:123};
 assert.throws(()=>validateWorktestSession(record));assert.deepEqual(validateWorktestSession(record,identity),record);
 for(const patch of [{userId:'15'},{userId:'16'},{username:'admin'},{role:'admin'}])assert.throws(()=>validateWorktestSession({...record,...patch},identity));
});
function fixture({saved=null,badMe=false,badLogin=false,failedPut=false,healthFailure=false,startupConsumed=false,refreshRejected=false,refreshUnavailable=false,markerFailure=false,logoutUnavailable=false,logoutErrorStatus=false,logoutBadJson=false,logoutBadProof=false,vaultReadFailure=false,localClearFailure=false}={}){
 let value=saved,credentialReads=0,health=0,refreshes=0;const calls=[],vault=[];
 const pairs=new Map();
 const remember=record=>{pairs.set(record.accessToken,{...record,user});return record;};
 if(saved)remember(saved);
 const rememberGrant=g=>{remember({...g,userId:String(g.user.id),username:g.user.username});return g;};
 const store={get:async()=>{if(vaultReadFailure)throw Error('PRIVATE_VAULT_PATH_AND_TOKEN');return value;},put:async record=>{vault.push('put');if(failedPut)throw Error('PRIVATE_PATH');value=record;},clear:async()=>{vault.push('clear');if(localClearFailure)throw Error('PRIVATE_CLEAR_PATH');value=null;}};
 const response=data=>({ok:true,body:(async function*(){yield Buffer.from(JSON.stringify({success:true,data}));})()});
 const fetchImpl=async(url,options)=>{
  calls.push({url,options});assert.equal(options.headers.Origin,worktest.origin);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
  if(url===worktest.api+'/api/auth/login'){if(badLogin)return{ok:false,body:(async function*(){yield Buffer.from('{"success":false}');})()};return response(rememberGrant(grant(1)));}
  if(url===worktest.api+'/api/auth/refresh'){if(refreshUnavailable)throw new Error('NETWORK');if(refreshRejected)return{ok:false,status:401,body:(async function*(){yield Buffer.from('{"success":false}');})()};return response(rememberGrant(grant(++refreshes+1)));}
  if(url===worktest.api+'/api/auth/session-confirm'){
   const known=pairs.get(options.headers.Authorization?.slice(7));
   if(!known||known.refreshToken!==JSON.parse(options.body).refreshToken)return{ok:false,status:401,body:(async function*(){yield Buffer.from('{"success":false}');})()};
   return response({confirmed:true,user:badMe?{...known.user,id:15}:known.user,expiresAt:known.expiresAt});
  }
  if(url===worktest.api+'/api/auth/me')return response(badMe?{...user,id:15}:user);
  if(url===worktest.api+'/api/auth/logout'){if(logoutUnavailable)throw new Error('PRIVATE_NETWORK_MESSAGE');if(logoutErrorStatus)return{ok:false,status:500,body:(async function*(){yield Buffer.from('{"success":false}');})()};if(logoutBadJson)return{ok:true,status:200,body:(async function*(){yield Buffer.from('PRIVATE_RAW_RESPONSE');})()};return response({loggedOut:!logoutBadProof});}
  assert.fail('unapproved endpoint');
 };
 const startupState={canFirstLogin:async()=>!startupConsumed,consume:async()=>{if(markerFailure)throw new Error('MARKER_IO');startupConsumed=true;}};
 const entry=createSemihHostEntry({identity,store,fetchImpl,startupState,readCredential:async file=>{assert.equal(file,semihCredentialPath);credentialReads++;return{username:identity.username,password:'P'.repeat(40)};},verifyRuntime:async()=>{health++;if(healthFailure)throw Error('LIVE');}});
 return{entry,calls,vault,store,getValue:()=>value,credentialReads:()=>credentialReads,health:()=>health,startupConsumed:()=>startupConsumed,register:record=>remember(record),setProofUser:(accessToken,nextUser)=>{pairs.get(accessToken).user=nextUser;}};
}
test('explicit continue uses normal password login then fresh me before DPAPI put, not token minting',async()=>{
 const f=fixture();assert.equal(f.calls.length,0);assert.equal(f.credentialReads(),0);
 await f.entry.continueSession();assert.equal(f.credentialReads(),1);assert.equal(f.health(),2);assert.equal(f.getValue().userId,'17');
 assert.deepEqual(f.calls.map(c=>new URL(c.url).pathname),['/api/auth/login','/api/auth/me']);assert.equal(f.calls[1].options.headers.Authorization,'Bearer PRIVATE_ACCESS_1');assert.deepEqual(f.vault,['put']);
});
test('reopen continuation rotates saved normal grant; no password reread, old user never replaced',async()=>{
 const record={accessToken:'OLD_ACCESS',refreshToken:'OLD_REFRESH',userId:'17',username:identity.username,expiresAt:1},f=fixture({saved:record});
 await f.entry.continueSession();assert.equal(f.credentialReads(),0);assert.equal(f.getValue().refreshToken,'PRIVATE_REFRESH_2');assert.equal(JSON.parse(f.calls[0].options.body).refreshToken,'OLD_REFRESH');assert.equal(f.calls[0].url,worktest.api+'/api/auth/refresh');
});
test('foreign fresh identity or vault failure revokes new and old grants and clears failed session',async()=>{
 for(const flags of [{badMe:true},{failedPut:true},{badLogin:true}]){const f=fixture(flags);await assert.rejects(()=>f.entry.continueSession(),/WORKTEST_SEMIH_ENTRY_UNAVAILABLE/);assert.equal(f.getValue(),null);assert(f.vault.includes('clear'));if(!flags.badLogin)assert(f.calls.some(c=>c.url.endsWith('/logout')));}
 const f=fixture({saved:{accessToken:'OLD',refreshToken:'OLD_REFRESH',userId:'17',username:identity.username,expiresAt:1},badMe:true});await assert.rejects(()=>f.entry.continueSession());assert.deepEqual(f.calls.filter(c=>c.url.endsWith('/logout')).map(c=>JSON.parse(c.options.body).refreshToken),['PRIVATE_REFRESH_2','OLD_REFRESH']);
});
test('health failure forbids credential read or normal auth; logout clears protected memory and revokes',async()=>{
 const stopped=fixture({healthFailure:true});await assert.rejects(()=>stopped.entry.continueSession());assert.equal(stopped.calls.length,0);assert.equal(stopped.credentialReads(),0);
 const f=fixture();await f.entry.continueSession();await f.entry.clear();assert.equal(f.getValue(),null);assert.equal(f.calls.at(-1).url,worktest.api+'/api/auth/logout');assert.equal(JSON.parse(f.calls.at(-1).options.body).refreshToken,'PRIVATE_REFRESH_1');assert.equal(f.credentialReads(),1);
});
test('renderer put is accepted only after fresh normal identity, expired grant rejects, no password fallback',async()=>{
 const f=fixture(),g=grant(7),record={accessToken:g.accessToken,refreshToken:g.refreshToken,userId:'17',username:identity.username,expiresAt:g.expiresAt};
 f.register(record);await f.entry.accept(record);assert.equal(f.calls[0].url,worktest.api+'/api/auth/session-confirm');assert.equal(f.credentialReads(),0);
 await assert.rejects(()=>f.entry.accept({...record,expiresAt:1}));assert.deepEqual(f.getValue(),record);assert.equal(f.calls.at(-1).url,worktest.api+'/api/auth/session-confirm');assert(!f.calls.some(call=>call.url.endsWith('/logout')));
});
test('logout marker prevents password login on reopened app; explicit Semih menu may login normally',async()=>{
 const f=fixture();await f.entry.continueSession({startup:true});await f.entry.clear();const before=f.calls.length;await f.entry.continueSession({startup:true});assert.equal(f.calls.length,before);assert.equal(f.getValue(),null);assert.equal(f.credentialReads(),1);
 await f.entry.continueSession();assert.equal(f.credentialReads(),2);assert.equal(f.getValue().userId,'17');
 const denied=fixture({startupConsumed:true});await denied.entry.continueSession({startup:true});assert.equal(denied.credentialReads(),0);assert.equal(denied.calls.length,0);
});
test('offline saved session remains protected; server reject clears without first-password fallback',async()=>{
 const saved={accessToken:'OLD_ACCESS',refreshToken:'OLD_REFRESH',userId:'17',username:identity.username,expiresAt:1};
 for(const flags of [{healthFailure:true},{refreshUnavailable:true}]){const f=fixture({saved,...flags});await assert.rejects(()=>f.entry.continueSession({startup:true}));assert.deepEqual(f.getValue(),saved);assert.equal(f.credentialReads(),0);assert(!f.vault.includes('clear'));}
 const f=fixture({saved,refreshRejected:true});await assert.rejects(()=>f.entry.continueSession({startup:true}));assert.equal(f.getValue(),null);assert.equal(f.credentialReads(),0);assert(f.calls.some(c=>c.url.endsWith('/logout')));
});
test('marker write failure prevents credential login and is not falsely reported as logout success',async()=>{
 const f=fixture({markerFailure:true});await assert.rejects(()=>f.entry.continueSession({startup:true}));assert.equal(f.credentialReads(),0);assert.equal(f.calls.length,0);await assert.rejects(()=>f.entry.clear());
});
test('durable public marker is exact, survives new instance, contains no secret and rejects tamper/link',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'melisa-semih-marker-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const file=path.join(root,'first-login-consumed.json'),state=createSemihStartupState({root});assert.equal(await state.canFirstLogin(),true);await state.consume();assert.equal(await createSemihStartupState({root}).canFirstLogin(),false);await state.consume();const data=JSON.parse(await fs.readFile(file,'utf8'));assert.deepEqual(Object.keys(data).sort(),['consumed','copyId','schemaVersion','userId']);
 await fs.writeFile(file,JSON.stringify({...data,userId:'15'}));await assert.rejects(()=>state.canFirstLogin());await assert.rejects(()=>state.consume());await fs.unlink(file);const outside=path.join(root,'outside');await fs.writeFile(outside,JSON.stringify(data));await fs.link(outside,file);await assert.rejects(()=>state.canFirstLogin());
});
test('logout refuses success for offline/API500/JSON/unknown-vault/local failures while attempting every local cleanup',async()=>{
 const saved={accessToken:'PRIVATE_ACCESS',refreshToken:'PRIVATE_REFRESH',userId:'17',username:identity.username,expiresAt:Date.now()+600000};
 for(const flags of [{logoutUnavailable:true},{logoutErrorStatus:true},{logoutBadJson:true},{logoutBadProof:true},{vaultReadFailure:true},{localClearFailure:true},{markerFailure:true}]){
  const f=fixture({saved,...flags});await assert.rejects(()=>f.entry.clear(),error=>error.message==='WORKTEST_SEMIH_ENTRY_UNAVAILABLE'&&!String(error.stack).includes('PRIVATE'));
  assert(f.vault.includes('clear'));assert.equal(f.credentialReads(),0);if(!flags.markerFailure)assert.equal(f.startupConsumed(),true);
  if(!flags.localClearFailure)assert.equal(f.getValue(),null);if(!flags.vaultReadFailure)assert(f.calls.some(call=>call.url===worktest.api+'/api/auth/logout'));
 }
 const f=fixture({saved});assert.equal(await f.entry.clear(),null);assert.equal(f.getValue(),null);assert.equal(f.startupConsumed(),true);assert.equal(f.calls.at(-1).url,worktest.api+'/api/auth/logout');assert.equal(JSON.parse(f.calls.at(-1).options.body).refreshToken,saved.refreshToken);
});
test('unconfirmed access-refresh pair cannot replace good vault or revoke another refresh family',async()=>{
 const good={accessToken:'GOOD_ACCESS',refreshToken:'GOOD_REFRESH',userId:'17',username:identity.username,expiresAt:Date.now()+600000};
 for(const variant of ['arbitrary-refresh','same-user-different-grant','fresh-role','fresh-sid','expiry-mismatch']){
  const f=fixture({saved:good}),candidate={...good,accessToken:'CANDIDATE_ACCESS',refreshToken:'CANDIDATE_REFRESH'};f.register(candidate);
  let input={...candidate};if(variant==='arbitrary-refresh')input.refreshToken='OTHER_USER_REFRESH';
  if(variant==='same-user-different-grant'){f.register({...candidate,accessToken:'OTHER_ACCESS',refreshToken:'OTHER_SAME_USER_REFRESH'});input.refreshToken='OTHER_SAME_USER_REFRESH';}
  if(variant==='fresh-role')f.setProofUser(candidate.accessToken,{...user,role:{id:3,code:'personel'}});
  if(variant==='fresh-sid')input.accessToken='UNRECOGNIZED_SIGNED_SID';
  if(variant==='expiry-mismatch')input.expiresAt++;
  await assert.rejects(()=>f.entry.accept(input),error=>error.message==='WORKTEST_SEMIH_ENTRY_UNAVAILABLE');assert.deepEqual(f.getValue(),good);assert.equal(f.vault.length,0);assert(!f.calls.some(call=>call.url.endsWith('/logout')));assert.equal(f.credentialReads(),0);
 }
 const f=fixture({saved:good,failedPut:true}),candidate={...good,accessToken:'CONFIRMED_ACCESS',refreshToken:'CONFIRMED_REFRESH'};f.register(candidate);await assert.rejects(()=>f.entry.accept(candidate));assert.equal(f.getValue(),null);
 assert.deepEqual(f.calls.filter(call=>call.url.endsWith('/logout')).map(call=>JSON.parse(call.options.body).refreshToken),[candidate.refreshToken]);assert(!f.calls.some(call=>call.url.endsWith('/refresh')));
});
