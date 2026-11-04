import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkingCatalogSession} from './workingCatalogSession.mjs';
const actor={id:15,username:'ornek-satis',role:{code:'clean_test_sales'},permissions:['product.view','sales.view']};
const location={origin:'http://192.168.1.46:5244',protocol:'http:',hostname:'192.168.1.46',port:'5244'};
const response=data=>({ok:true,status:200,json:async()=>({success:true,data})});
function fixture({expires=Date.now()+900000,me=async()=>actor}={}){
 let stored=null,rotations=0;const calls=[];
 const protectedDevice={get:async()=>stored,put:async value=>{stored=value;},clear:async()=>{stored=null;}};
 const session=createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4194',storage:{removeItem(){},setItem(){},getItem(){return null;}},protectedDevice,fetchImpl:async(url,options)=>{
  calls.push({url,body:options.body,authorization:options.headers.Authorization});
  if(url.endsWith('/auth/login'))return response({user:actor,accessToken:'fixture-access',refreshToken:'fixture-refresh',expiresAt:expires});
  if(url.endsWith('/auth/refresh')){rotations++;return response({user:actor,accessToken:'fixture-rotated',refreshToken:'fixture-rotated-refresh',expiresAt:Date.now()+900000});}
  if(url.endsWith('/auth/me'))return response(await me());
  throw Error('Unexpected preparation path');
 }});
 return {session,calls,stored:()=>stored,rotations:()=>rotations};
}
test('clean protected CRM activation renews through the existing ERP path before authenticated me',async()=>{
 const f=fixture({expires:Date.now()+30000});await f.session.login({username:actor.username,password:'fixture-only'});await f.session.prepareCrm();
 assert.equal(f.rotations(),1);assert(f.calls.at(-2).url.endsWith('/api/auth/refresh'));assert(f.calls.at(-1).url.endsWith('/api/auth/me'));
 assert.equal(f.calls.at(-1).authorization,'Bearer fixture-rotated');assert.equal(f.stored().refreshToken,'fixture-rotated-refresh');
 assert(f.calls.every(c=>c.url.startsWith(location.origin+'/api/auth/')));assert(!JSON.stringify(f.calls).includes('62800'));
});
test('fresh same-person preparation has no extra refresh or grant and mismatched me is refused',async()=>{
 const f=fixture();await f.session.login({username:actor.username,password:'fixture-only'});await f.session.prepareCrm();assert.equal(f.rotations(),0);assert.equal(f.calls.length,2);
 const wrong=fixture({me:async()=>({...actor,id:18})});await wrong.session.login({username:actor.username,password:'fixture-only'});await assert.rejects(wrong.session.prepareCrm(),{status:401});
});
test('anonymous or late disposed activation cannot authorize a CRM opening',async()=>{
 const f=fixture();await assert.rejects(f.session.prepareCrm(),{status:401});assert.equal(f.calls.length,0);
 let finish;const waiting=fixture({me:()=>new Promise(done=>{finish=done;})});await waiting.session.login({username:actor.username,password:'fixture-only'});
 const prepared=waiting.session.prepareCrm();await new Promise(resolve=>setImmediate(resolve));waiting.session.dispose();finish(actor);await assert.rejects(prepared);
});
