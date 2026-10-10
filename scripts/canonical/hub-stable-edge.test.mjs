import test from 'node:test';import assert from 'node:assert/strict';
import {validateStableEdgeConfig,stableConfigReferenceAllowed} from './hub-stable-edge.mjs';
const source='a'.repeat(40),db='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
const c={schemaVersion:1,sourceCommit:source,copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',database:db,origin:'https://semih.tail295701.ts.net:8443',host:'127.0.0.1',port:5244};
const r={sourceCommit:source,repository:'https://github.com/melihsnyldzz-ui/melisa-erp-v2.git',sharedTestCopy:{database:db}};
test('edge entry exact DB02 source/config guard rejects foreign release, bind, port or extra credentials',()=>{
 assert.deepEqual(validateStableEdgeConfig(c,r),c);
 for(const changed of [{database:'LIVE'},{host:'0.0.0.0'},{port:443},{origin:'https://foreign.invalid'},{sourceCommit:'b'.repeat(40)},{copyId:'foreign'},{password:'fixture'}])assert.throws(()=>validateStableEdgeConfig({...c,...changed},r));
 assert.throws(()=>validateStableEdgeConfig(c,{...r,repository:'foreign'}));assert.throws(()=>validateStableEdgeConfig(c,{...r,sharedTestCopy:{database:'LIVE'}}));
});
test('private config references cannot escape runtime or normalize through aliases',()=>{
 assert.equal(stableConfigReferenceAllowed('C:\\Sirket\\ERP\\runtime\\hub-stable\\edge.json'),true);
 for(const p of ['C:\\Sirket\\ERP\\runtime\\..\\config\\edge.json','C:\\Sirket\\ERP\\runtime\\hub\\edge.json:stream','C:\\Sirket\\ERP\\runtime\\hub\\CON.json','C:\\Sirket\\ERP\\runtime\\hub.\\edge.json','C:\\Sirket\\ERP\\runtime\\hub\\edge.js','C:\\Sirket\\ERP\\runtime-other\\edge.json'])assert.equal(stableConfigReferenceAllowed(p),false);
});
