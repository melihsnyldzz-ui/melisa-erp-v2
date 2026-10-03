import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { projectReviewedPublicCatalog } from './publicCatalogImagePolicy.mjs';
const rows = [1,2,3].map(sourceId => ({sourceId, secret:'PRIVATE'}));
const project = (row,imageUrl) => ({id:`vega-${row.sourceId}`,imageUrl});
const presentation = new Map([[1,{imageIdentityStatus:'CONFLICT',imageUrl:null}],
  [2,{imageIdentityStatus:'VERIFIED',imageUrl:'/uploads/verified-products/'+ 'a'.repeat(64)+'--2.jpg',imageIdentityHash:'a'.repeat(64)}],
  [3,{imageIdentityStatus:'UNAVAILABLE',imageUrl:null}]]);
test('image-only public pages withhold unapproved photos while preserving source scan counts',()=>{
  const result=projectReviewedPublicCatalog(rows,{page:2,total:7},presentation,project,true);
  assert.deepEqual(result.products.map(row=>row.id),['vega-2']);
  assert.equal(result.meta.total,7);assert.equal(result.meta.scannedCount,3);assert.equal(result.meta.imageCount,1);
  assert.equal(result.meta.paginationBasis,'SOURCE_ROWS');assert.equal(result.meta.imagePolicy,'VERIFIED_IDENTITY_ONLY');
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});

test('actual public reader fails closed on source error and never invokes legacy SQL fallback',async()=>{
  const source=await readFile(new URL('./catalogService.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function getPublicCatalogProducts(');
  const end=source.indexOf('// Retained for explicit legacy maintenance;',start);
  assert.ok(start>=0&&end>start);
  const create=new Function('getActiveVegaProductImageSourceIds','getVegaProductsListFromWorker','makeServiceError',
    source.slice(start,end).replace('export async function','async function')+';return getPublicCatalogProducts;');
  let reads=0;
  const run=create(async()=>[1],async()=>{reads++;throw Error('source offline');},(code,message,statusCode)=>Object.assign(new Error(message),{code,statusCode}));
  await assert.rejects(run({}),{code:'PUBLIC_CATALOG_UNAVAILABLE',statusCode:503});
  assert.equal(reads,1);
});
test('fully withheld page is not the end of source pagination; all-products view never restores a photo',()=>{
  const empty=projectReviewedPublicCatalog(rows,{page:1,total:9},new Map(),project,true);
  assert.equal(empty.products.length,0);assert.equal(empty.meta.scannedCount,3);assert.equal(empty.meta.total,9);
  const all=projectReviewedPublicCatalog(rows,{page:1,total:3},presentation,project,false);
  assert.equal(all.products.length,3);assert.equal(all.products[0].imageUrl,'');assert.equal(all.products[2].imageUrl,'');
  assert.equal(all.products[1].imageIdentityStatus,'VERIFIED');
});
