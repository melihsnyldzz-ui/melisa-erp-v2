import test from 'node:test';
import assert from 'node:assert/strict';
import {digestRuntimeRecords} from './sql-login-runtime-integrity.mjs';
test('tree digest covers paths, entry kinds, sizes and exact bytes',()=>{
 const base=[{kind:'D',path:'pkg',size:0,hash:''},{kind:'F',path:'pkg/index.js',size:1,hash:'a'.repeat(64)}];
 const digest=digestRuntimeRecords(base);assert.match(digest,/^[0-9a-f]{64}$/);
 for(const changed of [
  [base[0],{...base[1],hash:'b'.repeat(64)}],
  [base[0],{...base[1],size:2}],
  [base[0],{...base[1],path:'pkg/main.js'}],
  [...base,{kind:'F',path:'pkg/other.js',size:0,hash:'c'.repeat(64)}],
 ])assert.notEqual(digestRuntimeRecords(changed),digest);
 assert.throws(()=>digestRuntimeRecords([base[1],base[0]]),/DESKTOP_RUNTIME_INTEGRITY_REJECTED/);
 assert.throws(()=>digestRuntimeRecords([base[0],base[0]]),/DESKTOP_RUNTIME_INTEGRITY_REJECTED/);
 assert.throws(()=>digestRuntimeRecords([{...base[1],path:'bad\nname'}]),/DESKTOP_RUNTIME_INTEGRITY_REJECTED/);
});
