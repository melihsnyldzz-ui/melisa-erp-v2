import test from 'node:test';
import assert from 'node:assert/strict';
import {checkSemihPrivatePath,semihSetupRoot} from './semih-test-local-credential.mjs';
test('private credential path rejects parent traversal, foreign target and non-canonical alias before any file write',()=>{for(const name of [semihSetupRoot+'\\..\\outside.json',semihSetupRoot+'\\part\\..\\outside.json','C:\\other\\erp-first-login.dpapi','erp-first-login.dpapi',semihSetupRoot])assert.throws(()=>checkSemihPrivatePath(name,{exists:false}));});
test('uncreated regular canonical credential candidate remains inside the exact private root',()=>{if(process.platform==='win32')assert.doesNotThrow(()=>checkSemihPrivatePath(semihSetupRoot+'\\unit-test-candidate-never-written.json',{exists:false}));else assert.throws(()=>checkSemihPrivatePath(semihSetupRoot+'\\unit-test-candidate-never-written.json',{exists:false}));});
