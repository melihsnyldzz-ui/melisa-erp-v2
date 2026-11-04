import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPr53CompletePackageInventory as verify} from './p03-pr53-package-inventory.mjs';
const sha='a'.repeat(64),row=path=>({path,sha256:sha});
const manifest={files:[row('apps/api/server.mjs'),row('apps/sites-workflow/dist-business/assets/a.js')]};
const fixture=()=>[row('release-manifest.json'),...structuredClone(manifest.files),...['api','sites-workflow','web-admin'].map(x=>row('apps/'+x+'/node_modules/pkg/index.js'))];
test('complete inventory separates exactly three dependency trees and preserves declared hashes',()=>{
 const result=verify(manifest,fixture());assert.equal(result.declaredFiles,2);assert.equal(result.totalFiles,6);assert.equal(result.dependencyInventories.length,3);assert.ok(result.dependencyInventories.every(x=>x.files===1&&/^[a-f0-9]{64}$/.test(x.inventorySha256)));
 assert.deepEqual(verify(manifest,fixture().reverse()),result);
});
test('undeclared runtime JS, source, private config, asset and unknown dependency root all reject',()=>{
 for(const extra of ['apps/api/src/injected.mjs','scripts/canonical/extra.mjs','apps/api/.env','apps/sites-workflow/dist-business/assets/extra.js','apps/foreign/node_modules/pkg/index.js','apps/api/NODE_MODULES/pkg/index.js'])assert.throws(()=>verify(manifest,[...fixture(),row(extra)]));
});
test('missing declarations, changed hashes, duplicate paths and incomplete dependency inventory reject',()=>{
 const changed=fixture();changed[1].sha256='b'.repeat(64);assert.throws(()=>verify(manifest,changed));
 for(const rows of [fixture().slice(1),fixture().filter(x=>x.path!=='apps/api/server.mjs'),fixture().filter(x=>!x.path.startsWith('apps/web-admin/node_modules/')),[...fixture(),row('APPS/API/SERVER.MJS')],[...fixture(),row('apps/api/node_modules/pkg/../extra.js')]])assert.throws(()=>verify(manifest,rows));
});
