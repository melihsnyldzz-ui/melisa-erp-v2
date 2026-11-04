// Manual read-only source observation; no Git/children/writes/runtime calls.
// This file is not CI-listed: a future checkout need not match the 7ab pin.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import * as pair from './prepare-current-business-pair.mjs';import * as metadata from './prepare-customer-master-metadata-package.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('current checkout native entry matches fixed P7 before-image and exact 7ab projection',()=>{
 const root=path.resolve(import.meta.dirname,'../..'),baseRoot=pair.C06_BASE.api;
 const manifestBytes=fs.readFileSync(path.join(baseRoot,'release-manifest.json'));assert.equal(sha(manifestBytes),pair.C06_BASE.apiSha256);
 const base=JSON.parse(manifestBytes),byPath=new Map(base.files.map(r=>[r.path,r]));
 for(const p of pair.C06_7AB_API_SOURCE_FILES){
  const current=fs.readFileSync(path.join(root,...p.split('/')));assert(current.length>0);
  if(pair.C06_7AB_NEW_API_FILES.includes(p))assert.equal(byPath.has(p),false);
  else {const expected=byPath.get(p);assert(expected);const original=fs.readFileSync(path.join(baseRoot,...p.split('/')));assert.equal(sha(original),expected.sha256);}
 }
 const before=fs.readFileSync(path.join(baseRoot,...metadata.CUSTOMER_METADATA_ENTRY.split('/')));
 const after=fs.readFileSync(path.join(root,...metadata.CUSTOMER_METADATA_ENTRY.split('/')));
 assert(metadata.customerMasterSuccessorEntryDelta(before,after,pair.C06_7AB_SOURCE_PIN));
 assert.throws(()=>metadata.customerMasterSuccessorEntryDelta(before,after,pair.C06_154_SOURCE_PIN));
});
