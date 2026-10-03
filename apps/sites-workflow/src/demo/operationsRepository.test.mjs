import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOperationsRepository, STORAGE_KEY, LEGACY_KEY, BACKUP_KEY } from './operationsRepository.js';
import { seedOperations, transitionOperations } from './operationsStore.js';

function memory(initial={}) {
  const map=new Map(Object.entries(initial));
  return { getItem:key=>map.get(key)??null, setItem:(key,value)=>map.set(key,value), map };
}
function environment(initial={}) {
  const storage=memory(initial), legacyStorage=memory();
  let pending=Promise.resolve();
  const lock=(_name, action)=>{
    const next=pending.then(action);
    pending=next.catch(()=>{});
    return next;
  };
  return { storage, legacyStorage, lock, seed:seedOperations };
}
const order={type:'save-order', input:{date:'2026-09-26',validUntil:'2026-09-30',customerId:'201',currency:'TRY',items:[{productId:'101',quantity:'2',unitPrice:'100'}],taxRate:'0'}};

test('two tabs serialize new documents and stale edits do not overwrite another tab',async()=>{
  const env=environment(), tabA=createOperationsRepository(env), tabB=createOperationsRepository(env);
  const [first,second]=await Promise.all([tabA.execute({...order,requestId:'request-aaaa'},transitionOperations),tabB.execute({...order,requestId:'request-bbbb'},transitionOperations)]);
  assert.equal(first.orders.length,1);assert.equal(second.orders.length,2);
  assert.deepEqual(tabA.read().orders.map(o=>o.number),['TEK-00001','TEK-00002']);
  await assert.rejects(tabA.execute({...order,expectedRevision:1,requestId:'request-cccc'},transitionOperations),/başka bir sekmede/);
  assert.equal(tabA.read().orders.length,2);
});

test('request replay is idempotent and a changed payload with the same key is rejected',async()=>{
  const repo=createOperationsRepository(environment());
  const command={...order,requestId:'request-aaaa',expectedRevision:0};
  await repo.execute(command,transitionOperations);
  const replay=await repo.execute({...command,expectedRevision:1},transitionOperations);
  assert.equal(replay.revision,1);assert.equal(replay.orders.length,1);
  await assert.rejects(repo.execute({...command,input:{...order.input,customerId:'202'}},transitionOperations),/farklı bir komutta/);
});

test('v1 session record migrates without deleting the source, then survives another tab and reload',async()=>{
  const env=environment();const original=seedOperations();original.version=1;delete original.orders;delete original.nextOrderId;
  env.legacyStorage.setItem(LEGACY_KEY,JSON.stringify(original));
  const repo=createOperationsRepository(env);
  assert.equal(repo.read().version,2);assert.deepEqual(repo.read().orders,[]);
  await repo.execute({...order,requestId:'request-aaaa'},transitionOperations);
  assert.equal(JSON.parse(env.legacyStorage.getItem(LEGACY_KEY)).version,1);
  assert.equal(createOperationsRepository({...env,legacyStorage:memory()}).read().orders.length,1);
});

test('failed save does not publish an action; damaged records preserve bytes until explicit recovery',async()=>{
  const env=environment();const repo=createOperationsRepository(env);
  await repo.execute({...order,requestId:'request-aaaa'},transitionOperations);
  const valid=env.storage.getItem(STORAGE_KEY);
  env.storage.setItem(STORAGE_KEY,'{"version":2,"orders":');
  assert.throws(()=>repo.read(),/bozuk/);assert.equal(env.storage.getItem(STORAGE_KEY),'{"version":2,"orders":');
  assert.equal(repo.backup().orders.length,0);
  await repo.restore();assert.equal(repo.read().orders.length,0);
  env.storage.setItem(STORAGE_KEY,valid);
  env.storage.setItem=(key,value)=>{if(key===STORAGE_KEY)throw Error('storage quota');env.storage.map.set(key,value);};
  await assert.rejects(repo.execute({...order,requestId:'request-bbbb'},transitionOperations),/yazılamadı/);
  assert.equal(repo.read().orders.length,1);
  assert.ok(env.storage.getItem(BACKUP_KEY));
});
