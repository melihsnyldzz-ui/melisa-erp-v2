import fs from 'node:fs';
import assert from 'node:assert/strict';
const here=new URL('../../../temp/sql-lab/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const fixture=read(new URL('stock-count-fixture.json',here));
const phase=process.argv[2];assert.ok(['before','after'].includes(phase));
const expectedQuantity=Number(process.argv[3] ?? 6);assert.ok(Number.isFinite(expectedQuantity));
const base='http://127.0.0.1:54100',results=[];
async function call(path,body,token){const response=await fetch(base+path,{method:'POST',redirect:'error',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
async function login(privateFile){const {username,password}=read(privateFile);const result=await call('/api/auth/login',{username,password});assert.equal(result.status,200);assert.ok(result.body.data.accessToken);return result.body.data;}
const payload={productId:fixture.productId,expectedCurrentQuantity:5,countedQuantity:999,note:'TEST permission denial must not change stock'};
if(phase==='before'){
  const webFixture=read(new URL('web-fixture.json',here)),editor=await login(webFixture.privateFile);
  assert.ok(editor.user.permissions.includes('product.edit'));assert.ok(!editor.user.permissions.includes('stock.adjust'));
  for(const [name,token,status] of [['unauthenticated',undefined,401],['product-editor',editor.accessToken,403]]){const result=await call('/api/stock-count/adjust',payload,token);assert.equal(result.status,status);results.push({name,status:result.status,code:result.body.error.code});}
}else{
  const counter=await login(fixture.privateFile);assert.ok(counter.user.permissions.includes('stock.adjust'));assert.ok(!counter.user.permissions.includes('product.edit'));
  for(const [name,body,status,code] of [
    ['stale-snapshot',{...payload,countedQuantity:8,note:'TEST stale snapshot'},409,'STOCK_COUNT_STALE'],
    ['missing-reason',{...payload,expectedCurrentQuantity:expectedQuantity,countedQuantity:expectedQuantity+2,note:''},400,'STOCK_COUNT_REASON_REQUIRED'],
    ['unchanged-count',{...payload,expectedCurrentQuantity:expectedQuantity,countedQuantity:expectedQuantity,note:'TEST unchanged count'},200,null],
  ]){const result=await call('/api/stock-count/adjust',body,counter.accessToken);assert.equal(result.status,status);if(code)assert.equal(result.body.error.code,code);else assert.equal(result.body.data.movementCreated,false);results.push({name,status:result.status,code:result.body.error?.code,movementCreated:result.body.data?.movementCreated});}
}
const evidence={at:new Date().toISOString(),phase,status:'PASS',syntheticOnly:true,productId:fixture.productId,results};
fs.writeFileSync(new URL(`stock-count-http-${phase}.json`,here),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
