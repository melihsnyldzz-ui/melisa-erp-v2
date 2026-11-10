import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopTargetStorage} from './desktopTargetStorage.mjs';
import {DESKTOP_EMPTY_V7_PROFILE_ID,DESKTOP_EMPTY_V7_TARGET} from '../../../../packages/shared/src/desktopEmptyProfile.mjs';
const installation={targetProfile:DESKTOP_EMPTY_V7_PROFILE_ID,environmentId:DESKTOP_EMPTY_V7_TARGET.environmentId,databaseGuid:DESKTOP_EMPTY_V7_TARGET.databaseGuid};
function fixture(){const data=new Map(),calls=[];return {data,calls,storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},locks:{request:(...args)=>calls.push(args)}};}
test('same actor DB9 journals and last receipt are isolated without copying, changing or deleting legacy UNKNOWN bytes',()=>{
 const x=fixture(),legacy=desktopTargetStorage(x.storage,x.locks),fresh=desktopTargetStorage(x.storage,x.locks,installation);
 assert.equal(legacy.storage,x.storage);assert.equal(legacy.locks,x.locks);
 for(const key of ['melisa.desktop.workflow.last.v1.1','melisa.desktop.workflow.pending.v1.1','melisa-finance-v1:1','melisa-credit-v1:1']){
  const bytes=JSON.stringify({requestId:'2040935c-16f0-4d70-9d84-8fc533cdf839',state:'UNKNOWN',actorId:'1',body:{amount:'1.0000'}});legacy.storage.setItem(key,bytes);
  assert.equal(fresh.storage.getItem(key),null);fresh.storage.setItem(key,'new profile bytes');assert.equal(legacy.storage.getItem(key),bytes);assert.equal(fresh.storage.getItem(key),'new profile bytes');fresh.storage.removeItem(key);assert.equal(legacy.storage.getItem(key),bytes);
 }
 fresh.locks.request('actor:1',{mode:'exclusive'},()=>{});assert(x.calls[0][0].startsWith(fresh.namespace));assert.equal(x.data.size,4);
});
test('unknown, missing, getter and mixed target identities cannot select a new storage namespace',()=>{
 const x=fixture();for(const v of [null,{},'empty-db9-v7-v1',{...installation,environmentId:'other'},{...installation,databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1'},{...installation,extra:true}])assert.throws(()=>desktopTargetStorage(x.storage,x.locks,v));
 let called=false;assert.throws(()=>desktopTargetStorage(x.storage,x.locks,{...installation,get environmentId(){called=true;return installation.environmentId;}}));assert.equal(called,false);
});
