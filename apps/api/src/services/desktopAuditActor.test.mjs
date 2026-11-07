// Synthetic SQL requests; SQL Server and GUI acceptance are separate.
import test from 'node:test';
import assert from 'node:assert/strict';

test('desktop actor resolves inside caller request and cannot spoof the source brand', async t => {
  const type=()=>({});type.MAX={};
  t.mock.module('mssql',{exports:{default:{NVarChar:type,BigInt:{}}}});
  t.mock.module('../config/database.js',{exports:{getSqlPool(){throw Error('unexpected pool');}}});
  t.mock.module('./vegaProductMetadataClientService.js',{exports:{getVegaProductMetadataFromWorker(){throw Error('unexpected worker');}}});
  const {resolveDesktopAuditActor,writeAuditLog}=await import('./auditService.js');
  const calls=[];
  function request(rows){return {params:{},input(k,_t,v){this.params[k]=v;return this;},async query(q){calls.push({q,params:{...this.params}});return {recordset:rows};}};}
  const actor=await resolveDesktopAuditActor(request([{id:'7',username:'semih'}]),'7','desktop-first-sale');
  assert.equal(Object.isFrozen(actor),true);assert.equal(actor.id,'7');
  await writeAuditLog(request([]),{action:'sale',entityType:'sale',entityId:1,actor});
  assert.equal(calls.at(-1).params.auditReason,'actor:semih');assert.equal(calls.at(-1).params.auditSource,'desktop-first-sale');
  const finance=await resolveDesktopAuditActor(request([{id:'7',username:'semih'}]),'7','desktop-finance');
  await writeAuditLog(request([]),{action:'payment',entityType:'payment',entityId:2,actor:finance});
  assert.equal(calls.at(-1).params.auditSource,'desktop-finance');
  const goods=await resolveDesktopAuditActor(request([{id:'7',username:'semih'}]),'7','desktop-goods');
  await writeAuditLog(request([]),{action:'purchase',entityType:'purchase',entityId:3,actor:goods});
  assert.equal(calls.at(-1).params.auditSource,'desktop-goods');
  await writeAuditLog(request([]),{action:'sale',entityType:'sale',entityId:1,actor:{...actor,source:'desktop-finance'}});
  assert.equal(calls.at(-1).params.auditSource,'web-admin');
  await writeAuditLog(request([]),{action:'system',entityType:'system',entityId:1});
  assert.equal(calls.at(-1).params.auditReason,'actor:SYSTEM');assert.equal(calls.at(-1).params.auditSource,'SYSTEM');
  for (const [rows,id,source] of [[[],'7','desktop-first-sale'],[[{id:'8',username:'x'}],'7','desktop-first-sale'],[[{id:'7',username:''}],'7','desktop-first-sale'],[[{id:'7',username:'x'}],'7','web-admin'],[[{id:'7',username:'x'}],'0','desktop-finance'],[[{id:'9007199254740992',username:'x'}],'9007199254740992','desktop-finance']])
    await assert.rejects(resolveDesktopAuditActor(request(rows),id,source),/DESKTOP_AUDIT_ACTOR_INVALID/);
});
