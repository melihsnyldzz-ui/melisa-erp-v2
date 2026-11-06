import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve,dirname,basename} from 'node:path';
import {createInvoiceExportJournal} from './vegaInvoiceExportJournal.mjs';
const intent={invoiceId:13},proof={actorId:'30002',requestId:'7cbb7e06-ef75-4456-92e5-99f6d99b8312',payloadHash:'a'.repeat(64)},snapshot={source:{id:13},sourceHash:'b'.repeat(64),expected:{documentNumber:'TEST13'}};
async function fixture(t){const directory=await mkdtemp(join(tmpdir(),'melisa-export-fence-'));t.after(async()=>{const target=resolve(directory);assert.equal(dirname(target),resolve(tmpdir()));assert(basename(target).startsWith('melisa-export-fence-'));await rm(target,{recursive:true,force:true});});return {directory,journal:createInvoiceExportJournal(directory)};}
test('permanent cancellation fence blocks stale prepared export even after SQL rollback or lost ACK',async t=>{
 const {directory,journal}=await fixture(t);assert.equal((await journal.inspect(intent)).state,'NOT_ATTEMPTED');
 assert.equal((await journal.claimCancellation(intent,proof)).state,'CANCELLATION_FENCED');
 assert.deepEqual(await journal.inspect(intent),{state:'REVIEW_REQUIRED',reason:'CANCELLATION_FENCED'});assert.equal(await journal.assertCancellationUnexported(intent),true);
 const persisted=await readFile(join(directory,'13.cancellation.json'),'utf8');
 assert.equal(await journal.verifyCancellation(intent,proof),true);assert.equal((await journal.claimCancellation(intent,proof)).state,'CANCELLATION_FENCED');
 await assert.rejects(journal.claimPrepared(intent,snapshot),{code:'EXPORT_CANCELLATION_FENCED'});
 assert.equal(await readFile(join(directory,'13.cancellation.json'),'utf8'),persisted);
 for(const change of [{actorId:'30003'},{payloadHash:'c'.repeat(64)},{requestId:'7cbb7e06-ef75-4456-92e5-99f6d99b8313'}]){await assert.rejects(journal.claimCancellation(intent,{...proof,...change}));await assert.rejects(journal.verifyCancellation(intent,{...proof,...change}));}
});
test('an already attempted or verified export prevents cancellation; existing replay remains unchanged',async t=>{
 const {journal}=await fixture(t);assert.equal((await journal.claimPrepared(intent,snapshot)).maySend,true);await assert.rejects(journal.claimCancellation(intent,proof),{code:'EXPORT_INVOICE_LOCKED'});
 assert.equal((await journal.claimPrepared(intent,snapshot)).maySend,false);
 await journal.recordVerified(intent,{state:'VERIFIED',documentId:19,documentNumber:'TEST13'});assert.equal((await journal.inspect(intent)).state,'VERIFIED');await assert.rejects(journal.claimCancellation(intent,proof),{code:'EXPORT_INVOICE_LOCKED'});
});
test('concurrent export and cancellation cannot both claim; separate journal instances share the lock',async t=>{
 for(let n=0;n<8;n++){const {directory,journal}=await fixture(t),other=createInvoiceExportJournal(directory);const outcomes=await Promise.allSettled(n%2?[journal.claimCancellation(intent,proof),other.claimPrepared(intent,snapshot)]:[journal.claimPrepared(intent,snapshot),other.claimCancellation(intent,proof)]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);const cancelled=await readFile(join(directory,'13.cancellation.json'),'utf8').then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});if(cancelled){assert.deepEqual(await journal.inspect(intent),{state:'REVIEW_REQUIRED',reason:'CANCELLATION_FENCED'});await assert.rejects(other.claimPrepared(intent,snapshot));}else assert.equal((await journal.inspect(intent)).state,'REVIEW_REQUIRED');}
});
test('unknown/corrupt fences and abandoned mutation locks fail closed and are retained for review',async t=>{
 for(const text of ['{',JSON.stringify({version:1,invoiceId:13,actorId:'x',requestId:proof.requestId,payloadHash:proof.payloadHash})]){const {directory,journal}=await fixture(t);await writeFile(join(directory,'13.cancellation.json'),text,{flag:'wx'});await assert.rejects(journal.claimPrepared(intent,snapshot));await assert.rejects(journal.claimCancellation(intent,proof));assert.equal(await readFile(join(directory,'13.cancellation.json'),'utf8'),text);}
 const {directory,journal}=await fixture(t);await writeFile(join(directory,'13.mutation.lock'),'review',{flag:'wx'});assert.deepEqual(await journal.inspect(intent),{state:'REVIEW_REQUIRED',reason:'MUTATION_LOCKED'});await assert.rejects(journal.claimPrepared(intent,snapshot),{code:'EXPORT_MUTATION_BUSY'});await assert.rejects(journal.claimCancellation(intent,proof),{code:'EXPORT_MUTATION_BUSY'});assert.equal(await readFile(join(directory,'13.mutation.lock'),'utf8'),'review');
});
