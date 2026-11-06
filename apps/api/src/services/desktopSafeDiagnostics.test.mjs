import test from 'node:test';import assert from 'node:assert/strict';import {safeDesktopFailure} from './desktopSafeDiagnostics.mjs';
test('local diagnostics retain codes and numeric SQL errors without messages, SQL or credentials',()=>{
 const secret='private-example-not-a-real-credential';const row=safeDesktopFailure({requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c63',error:{code:'EREQUEST',number:547,message:'SQL text '+secret,sql:secret,password:secret}});assert.equal(row.number,547);assert.equal(row.label,null);assert.ok(!JSON.stringify(row).includes(secret));assert.equal(safeDesktopFailure({error:{message:'LOCAL_MASTER_JOURNAL_READBACK_INVALID',code:'LOCAL_MASTER_JOURNAL_READBACK_INVALID'}}).label,'LOCAL_MASTER_JOURNAL_READBACK_INVALID');
});
