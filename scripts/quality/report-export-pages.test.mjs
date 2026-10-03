import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllExportPages } from '../../apps/web-admin/src/modules/reports/reportExportPages.js';

test('server page cap does not truncate export and filters reach every request', async () => {
  const calls=[];
  const result=await fetchAllExportPages(async query=>{
    calls.push(query);
    const start=(query.page-1)*25;
    return {data:Array.from({length:Math.min(25,63-start)},(_,i)=>({id:start+i})),meta:{page:query.page,limit:25,total:63}};
  },{search:'winter',dateFrom:'2026-09-01',dateTo:'2026-09-10'},{pageSize:500});
  assert.equal(result.data.length,63);assert.equal(result.data.at(-1).id,62);assert.equal(result.meta.truncated,false);
  assert.equal(calls.length,3);assert.ok(calls.every(q=>q.search==='winter'&&q.dateTo==='2026-09-10'));
});
test('missing continuation and repeated page fail instead of exporting incomplete data', async () => {
  await assert.rejects(fetchAllExportPages(async()=>({data:[],meta:{total:5}}),{}),/tüm satırları/);
  await assert.rejects(fetchAllExportPages(async()=>({data:[{id:1}],meta:{page:1,total:3,limit:1}}),{}),/ilerlemedi/);
});
test('row limit is explicit even without total metadata', async () => {
  const result=await fetchAllExportPages(async({page})=>({data:[{id:page*2},{id:page*2+1}]}),{},{pageSize:2,maxRows:3});
  assert.equal(result.data.length,3);assert.equal(result.meta.truncated,true);
  const exact=await fetchAllExportPages(async()=>({data:[{id:1},{id:2}],meta:{total:2}}),{},{pageSize:2,maxRows:2});
  assert.equal(exact.meta.truncated,false);
});
