// Manual read-only checkout graph observation; never a commit or runtime proof.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import * as pair from './prepare-current-business-pair.mjs';import {relativeModuleSpecifiers} from './prepare-business-sale-preview-link-package.mjs';
const expectedFour=['workInboundFx.js','workInboundFxModel.mjs','workPurchasePresentation.mjs','workPurchases.js'].map(n=>'apps/sites-workflow/src/workflow/'+n);
test('ERP154 current checkout WEB graph remains within exact purchase closure',()=>{
 // This tests current checkout shape only. A separate Git comparison is
 // required to establish which committed application bytes are checked out.
 const root=path.resolve(import.meta.dirname,'../..'),parse=createRequire(path.join(root,'apps/sites-workflow/package.json'))('@babel/parser').parse;
 const readSource=p=>fs.readFileSync(path.join(root,...p.split('/'))),options={parse,relativeImports:relativeModuleSpecifiers,sourcePin:pair.C06_154_SOURCE_PIN};
 const graph=pair.currentC06WebClosure({readSource,...options});assert.equal(graph.size,63);
 for(const p of pair.C06_154_WEB_SOURCE_FILES)assert(graph.has(p));for(const p of expectedFour)assert(graph.has(p));
 assert.throws(()=>pair.currentC06WebClosure({readSource:p=>p===expectedFour[3]?Buffer.from("import './unapproved.mjs';"):readSource(p),...options}),/C06_WEB_CLOSURE_PATH/);
});
