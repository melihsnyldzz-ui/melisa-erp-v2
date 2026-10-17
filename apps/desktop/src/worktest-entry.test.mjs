import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {worktest} from './protectedWorkSessionPolicy.mjs';
import {worktestPackageSchema,validateWorktestPackage,startWorktestEntry,readWorktestPackage} from './worktest-entry.mjs';
const pin={schemaVersion:worktestPackageSchema,sourceCommit:'a'.repeat(40),copyId:worktest.copyId,databaseName:worktest.database,serverName:worktest.server};
test('dedicated entry takes only exact colocated public runtime pin and defeats environment unpin',async()=>{
 const env={MELISA_DESKTOP_ISOLATED_WORKTEST:'false',MELISA_DESKTOP_WORKTEST_SOURCE_COMMIT:'b'.repeat(40),OTHER:'unchanged'};let imported=0;
 await startWorktestEntry({env,platform:'win32',electronVersion:'39.8.10',readPin:async()=>pin,loadMain:async()=>{imported++;assert.equal(env.MELISA_DESKTOP_ISOLATED_WORKTEST,'true');assert.equal(env.MELISA_DESKTOP_WORKTEST_SOURCE_COMMIT,pin.sourceCommit);}});
 assert.equal(imported,1);assert.equal(env.OTHER,'unchanged');assert(Object.isFrozen(validateWorktestPackage(pin)));
});
test('malformed/foreign/private metadata never imports main or mutates environment',async()=>{
 for(const invalid of [{...pin,sourceCommit:'latest'},{...pin,copyId:'other'},{...pin,databaseName:'LIVE'},{...pin,serverName:'other'},{...pin,password:'secret'},{...pin,url:'http://other'},null]){
  const env={};let imported=0;await assert.rejects(()=>startWorktestEntry({env,platform:'win32',electronVersion:'39.8.10',readPin:async()=>invalid,loadMain:async()=>imported++}),/WORKTEST_PACKAGE_PIN_INVALID/);assert.equal(imported,0);assert.deepEqual(env,{});
 }
 for(const patch of [{platform:'linux'},{electronVersion:'40.0.0'}])await assert.rejects(()=>startWorktestEntry({platform:'win32',electronVersion:'39.8.10',...patch,readPin:async()=>pin,loadMain:async()=>assert.fail('unexpected main import')}));
});
test('missing colocated metadata fails closed; entry exposes no login or arbitrary import',async()=>{
 await assert.rejects(()=>readWorktestPackage(),/WORKTEST_PACKAGE_PIN_INVALID/);
 const source=await readFile(new URL('./worktest-entry.mjs',import.meta.url),'utf8');assert(source.includes("new URL('./worktest-package.json',import.meta.url)"));assert(source.includes("loadMain=()=>import('./main.mjs')"));assert(!source.includes('ensureLocalStack'));assert(!source.includes('auth/login'));assert(!source.includes('spawn('));
});
