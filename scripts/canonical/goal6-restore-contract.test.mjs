import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {RESTORE_DATABASE,RESTORE_SERVER,assertRestoreIdentity,assertRestoreRead} from './goal6-restore-contract.mjs';
const identity={serverName:RESTORE_SERVER,databaseName:RESTORE_DATABASE,isReadOnly:true,state:'ONLINE'};
test('restore read requires exact isolated database, server and READ_ONLY ONLINE state',()=>{
 assert.doesNotThrow(()=>assertRestoreIdentity(identity));
 for(const changed of [{databaseName:'MELISA_ERP_SIRKET_TEST_20260929_01'},{databaseName:'MELISA_ERP_PROD_CANDIDATE_20260917_01'},{serverName:'other'},{isReadOnly:false},{state:'RESTORING'}])assert.throws(()=>assertRestoreIdentity({...identity,...changed}),/TARGET_INVALID/);
});
test('application proof rejects lost leading zeros, altered prices, duplicate/missing native rows or unpreserved pending drafts',()=>{
 const fixture=()=>({identity,catalog:{count:'16622',unknownCost:'10552',prices:'63774'},products:[{productId:'34765',stockCode:'0161 MOLLY',barcode:'8697130801618',price:'9.66000000',currency:'USD'},{productId:'36724',stockCode:'8023 CONCEPT',price:'15.78000000',currency:'USD'}],nativeOrder:{id:'9',status:'draft',currency:'USD',total:'25.4400'},nativeLines:[{productId:'34765',quantity:'1.000',currency:'USD'},{productId:'36724',quantity:'1.000',currency:'USD'}],dailyDrafts:[{id:'43',state:'pending'},{id:'44',state:'pending'}],inbound:{id:'7'},roles:{users:16,roles:16,permissions:137}});
 assert.doesNotThrow(()=>assertRestoreRead(fixture()));
 for(const mutate of [p=>p.products[0].stockCode='161 MOLLY',p=>p.products[1].price='15.77000000',p=>p.catalog.unknownCost='0',p=>p.nativeLines.push({...p.nativeLines[0]}),p=>p.nativeLines[1].productId='34765',p=>p.nativeOrder.status='finalized',p=>p.dailyDrafts[0].state='approved',p=>p.roles.permissions=0]){
  const p=fixture();mutate(p);assert.throws(()=>assertRestoreRead(p));
 }
});
test('operator rehearsal cannot replace, drop, accept arbitrary targets or restore active TEST',async()=>{
 const source=await fs.readFile(new URL('./goal6-backup-restore.ps1',import.meta.url),'utf8');
 assert.doesNotMatch(source,/WITH\s+REPLACE|\bDROP\s+DATABASE|RESTORE DATABASE \[\$sourceDb\]/i);
 assert.match(source,/GOAL6_RESTORE_TARGET_EXISTS/);assert.match(source,/COPY_ONLY,CHECKSUM\$compression,NOINIT/);assert.match(source,/engineEdition -eq 4/);assert.match(source,/SET READ_ONLY WITH NO_WAIT/);
 assert.match(source,/GuardDefinitionsCompared|guardDefinitionsCompared/);
});
