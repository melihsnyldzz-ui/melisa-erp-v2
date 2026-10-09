import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {SHARED_WEB_CSP} from './sharedCopyWebPolicy.mjs';
const directives=Object.fromEntries(SHARED_WEB_CSP.split(';').map(s=>s.trim().split(/\s+/)).filter(parts=>parts[0]).map(([name,...sources])=>[name,sources]));
test('shared browser permits authenticated photo object URLs as images while blocking arbitrary script/object endpoints',()=>{
 const photoLoader=fs.readFileSync(new URL('../../../sites-workflow/src/workflow/workCatalogPhoto.mjs',import.meta.url),'utf8');
 assert.match(photoLoader,/createObjectURL\(blob\)/);assert.ok(directives['img-src'].includes('blob:'));
 assert.deepEqual(directives['script-src'],["'self'"]);assert.deepEqual(directives['object-src'],["'none'"]);
 assert.ok(!directives['connect-src'].includes('blob:'));assert.ok(!SHARED_WEB_CSP.includes('*'));
 assert.deepEqual(directives['frame-src'],['http://127.0.0.1:62600','http://localhost:62600','http://192.168.1.46:62600']);
 assert.ok(!SHARED_WEB_CSP.includes(':62500'));
 const bootstrap=fs.readFileSync(new URL('../../start-shared-test-copy-web.mjs',import.meta.url),'utf8');
 assert.match(bootstrap,/res\.set\('Content-Security-Policy',SHARED_WEB_CSP\)/);
});
