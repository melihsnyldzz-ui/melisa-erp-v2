import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {compileDesktopEmptyBootstrap} from './bootstrap-sql.mjs';
import {DESKTOP_ATTEMPT_FENCE_REQUIREMENTS} from './attempt-fence.mjs';

const server='Semih\\MELISAERP',database='MELISA_ERP_DESKTOP_TEST_20261105';
const environmentId='eb2888c2-51cb-4570-a933-397cf7e62806';
const sqlSha256='74928c108df3180ed4877ead8732d93f5239f142d8ba8744d38517a2e0e413a6';
const input=()=>({server,database,environmentId,sqlSha256});
const attemptFile=root=>path.join(root,`desktop-empty-${environmentId}.attempt.json`);
const outcomeFile=root=>path.join(root,`desktop-empty-${environmentId}.outcome.json`);
// Isolated module copy pins a disposable test root, never the real ERP root.
async function fixture(t){
 const base=await fs.realpath(os.tmpdir());const root=await fs.mkdtemp(path.join(base,'erp-fence-test-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const source=await fs.readFile(new URL('./attempt-fence.mjs',import.meta.url),'utf8');
 const original="const ROOT_LITERAL = 'C:\\\\Users\\\\Xaser\\\\Desktop\\\\ERP';";
 assert.ok(source.includes(original));
 const text=source.replace(original,`const ROOT_LITERAL = ${JSON.stringify(root)};`);
 const module=await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
 return {root,module};
}

test('exact reviewed SQL hash and profile are pinned without any authority to execute',()=>{
 assert.equal(compileDesktopEmptyBootstrap().sqlSha256,sqlSha256);
 assert.equal(DESKTOP_ATTEMPT_FENCE_REQUIREMENTS.executionAuthorized,false);
 assert.equal(DESKTOP_ATTEMPT_FENCE_REQUIREMENTS.retryAfterAnyAttempt,'FORBIDDEN');
 assert.equal(DESKTOP_ATTEMPT_FENCE_REQUIREMENTS.requiresNativeReparseRaceProtection,true);
 assert.equal(DESKTOP_ATTEMPT_FENCE_REQUIREMENTS.requiresVerifiedDirectoryCrashDurability,true);
});

test('wrong target, hash, extra properties and getters never produce a file',async t=>{
 const {root,module}=await fixture(t);
 for(const value of [{...input(),server:'Semih\\SQLEXPRESS'},{...input(),database:'master'},
  {...input(),environmentId:'00000000-0000-0000-0000-000000000000'}, {...input(),sqlSha256:'0'.repeat(64)},
  {...input(),unexpected:true},Object.defineProperty(input(),'database',{get(){throw new Error('getter executed');},enumerable:true})]){
  await assert.rejects(module.createDesktopAttempt(value),/FENCE_(TARGET|INPUT)_REJECTED/);
 }
 assert.deepEqual(await fs.readdir(root),[]);
});

test('atomic same-path races allow one durable attempt; duplicates never retry',async t=>{
 const {root,module}=await fixture(t);
 const results=await Promise.allSettled(Array.from({length:12},()=>module.createDesktopAttempt(input())));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,11);
 const receipt=results.find(x=>x.status==='fulfilled').value;
 assert.equal(receipt.state,'UNKNOWN');assert.equal(receipt.executionAuthorized,false);
 const row=JSON.parse(await fs.readFile(attemptFile(root),'utf8'));
 assert.equal(row.attemptId,receipt.attemptId);assert.equal(row.state,'UNKNOWN');assert.equal(row.sqlSha256,sqlSha256);
 await assert.rejects(module.createDesktopAttempt(input()),/FENCE_ATTEMPT_UNKNOWN/);
 assert.equal((await fs.readdir(root)).length,1);
});

test('outcome is create-new, bound to exact complete attempt and caller assertion, never execution authority',async t=>{
 const {root,module}=await fixture(t);const first=await module.createDesktopAttempt(input());
 const outcome={...input(),attemptId:first.attemptId,outcome:'CONFIRMED_COMMIT',evidenceSha256:'a'.repeat(64)};
 await assert.rejects(module.recordDesktopOutcome({...outcome,attemptId:'de438807-87a3-4040-aeab-659895d6f444'}),/FENCE_OUTCOME_UNKNOWN/);
 await assert.rejects(module.recordDesktopOutcome({...outcome,evidenceSha256:'bad'}),/FENCE_OUTCOME_REJECTED/);
 const results=await Promise.allSettled([module.recordDesktopOutcome(outcome),module.recordDesktopOutcome(outcome)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.equal(results.find(x=>x.status==='fulfilled').value.executionAuthorized,false);
 assert.equal(JSON.parse(await fs.readFile(outcomeFile(root),'utf8')).claim,'CALLER_ASSERTED_ONLY');
 await assert.rejects(module.createDesktopAttempt(input()),/FENCE_ATTEMPT_UNKNOWN/);
});

test('incomplete and modified attempt records cannot be treated as proof or retried',async t=>{
 const {root,module}=await fixture(t);
 await fs.writeFile(attemptFile(root),'{"version":1', {flag:'wx'});
 await assert.rejects(module.createDesktopAttempt(input()),/FENCE_ATTEMPT_UNKNOWN/);
 await assert.rejects(module.recordDesktopOutcome({...input(),attemptId:'de438807-87a3-4040-aeab-659895d6f444',outcome:'CONFIRMED_ROLLBACK',evidenceSha256:'b'.repeat(64)}),/FENCE_OUTCOME_UNKNOWN/);
 assert.equal(await fs.readFile(attemptFile(root),'utf8'),'{"version":1');
 assert.equal((await fs.readdir(root)).length,1);
});

test('a complete record with altered target binding is rejected for outcome',async t=>{
 const {root,module}=await fixture(t);const receipt=await module.createDesktopAttempt(input());
 const file=attemptFile(root), row=JSON.parse(await fs.readFile(file,'utf8'));
 row.database='master';await fs.writeFile(file,JSON.stringify(row)+'\n');
 await assert.rejects(module.recordDesktopOutcome({...input(),attemptId:receipt.attemptId,outcome:'CONFIRMED_COMMIT',evidenceSha256:'c'.repeat(64)}),/FENCE_OUTCOME_UNKNOWN/);
 await assert.rejects(module.createDesktopAttempt(input()),/FENCE_ATTEMPT_UNKNOWN/);
 assert.equal((await fs.readdir(root)).length,1);
});

test('unknown or incomplete outcome input cannot create an outcome record',async t=>{
 const {root,module}=await fixture(t);const receipt=await module.createDesktopAttempt(input());
 const candidate={...input(),attemptId:receipt.attemptId,outcome:'UNKNOWN',evidenceSha256:'c'.repeat(64)};
 await assert.rejects(module.recordDesktopOutcome(candidate),/FENCE_OUTCOME_REJECTED/);
 await assert.rejects(module.recordDesktopOutcome({...candidate,outcome:'CONFIRMED_COMMIT',evidenceSha256:null}),/FENCE_OUTCOME_REJECTED/);
 assert.equal((await fs.readdir(root)).length,1);
});

test('preexisting outcome blocks an attempt even if the attempt file is missing',async t=>{
 const {root,module}=await fixture(t);await fs.writeFile(outcomeFile(root),'partial',{flag:'wx'});
 await assert.rejects(module.createDesktopAttempt(input()),/FENCE_ATTEMPT_UNKNOWN/);
 assert.deepEqual(await fs.readdir(root),[path.basename(outcomeFile(root))]);
});

test('junction root is rejected without writing through the link',async t=>{
 const {root}=await fixture(t);const parent=path.dirname(root),link=path.join(parent,`${path.basename(root)}-junction`);
 await fs.symlink(root,link,'junction');t.after(()=>fs.unlink(link));
 const source=await fs.readFile(new URL('./attempt-fence.mjs',import.meta.url),'utf8');
 const original="const ROOT_LITERAL = 'C:\\\\Users\\\\Xaser\\\\Desktop\\\\ERP';";
 const replaced=source.replace(original,`const ROOT_LITERAL = ${JSON.stringify(link)};`);
 const module=await import(`data:text/javascript;base64,${Buffer.from(replaced).toString('base64')}`);
 await assert.rejects(module.createDesktopAttempt(input()),/FENCE_ATTEMPT_UNKNOWN/);
 assert.deepEqual(await fs.readdir(root),[]);
});

test('attempt final symlink is never followed and target content survives',async t=>{
 const {root,module}=await fixture(t);const target=path.join(root,'do-not-modify');
 await fs.writeFile(target,'original');
 try{await fs.symlink(target,attemptFile(root),'file');}catch(e){if(e.code==='EPERM'){t.skip('Windows file symlink privilege unavailable');return;}throw e;}
 await assert.rejects(module.createDesktopAttempt(input()),/FENCE_ATTEMPT_UNKNOWN/);
 assert.equal(await fs.readFile(target,'utf8'),'original');
});

test('input snapshot cannot be altered during asynchronous IO',async t=>{
 const {root,module}=await fixture(t);const value=input();const pending=module.createDesktopAttempt(value);
 value.server='changed';value.sqlSha256='0'.repeat(64);
 const receipt=await pending;assert.equal(receipt.state,'UNKNOWN');
 const record=JSON.parse(await fs.readFile(attemptFile(root),'utf8'));
 assert.equal(record.server,server);assert.equal(record.sqlSha256,sqlSha256);
});
