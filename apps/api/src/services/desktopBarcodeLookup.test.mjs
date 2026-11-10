import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopWriteListService} from './desktopWriteListService.mjs';
import {isDesktopBarcode,isDesktopBarcodeLookup} from '../../../../packages/shared/src/desktopBarcodeLookup.mjs';
function setup({allow=true,target=true,rows=null}={}){
 const calls=[],product={id:'10',stockCode:'00092',productName:'Örnek ürün',unit:'ADET',currentStockExact3:'7.000',reservedExact3:'2.000'};let committed=0,rolled=0,tx;
 class Transaction{constructor(){tx=this;}async begin(){}async commit(){committed++;}async rollback(){rolled++;}}
 class Request{constructor(value){assert.equal(value,tx);this.params={};}input(k,_type,v){this.params[k]=v;return this;}async query(text){calls.push({text,params:this.params,tx});assert(text.includes('FROM dbo.products p WITH(HOLDLOCK)'));return {recordset:rows??[product]};}}
 const sql={Transaction,Request,NVarChar:()=>null,Int:{},ISOLATION_LEVEL:{SERIALIZABLE:4}},service=createDesktopWriteListService({pool:{},sql,richCards:true,schemaVersion:4,verifySession:async context=>{calls.push(context);return allow&&target;}});return {calls,product,read:barcode=>service.readProductBarcode('30002',barcode),get committed(){return committed;},get rolled(){return rolled;}};
}
test('barcode lookup keeps leading zeros and exact case, normal product.view, active relationships and current available stock in one held snapshot',async()=>{
 const f=setup(),result=await f.read('000000000092');assert.deepEqual(result,{barcode:'000000000092',product:{...f.product,availableExact3:'5.000'}});assert(isDesktopBarcodeLookup(result,'000000000092'));assert.equal(f.committed,1);assert.equal(f.calls.find(c=>c.permission).permission,'product.view');const queries=f.calls.filter(c=>c.text);assert.equal(new Set(queries.map(c=>c.tx)).size,1);const q=queries.at(-1);assert.deepEqual(q.params,{barcode:'000000000092'});assert.match(q.text,/b\.is_active=1/);assert.match(q.text,/p\.is_active=1 AND p\.is_deleted=0/);assert.match(q.text,/DATALENGTH/);assert.match(q.text,/CONVERT\(varbinary\(200\)/);assert.doesNotMatch(q.text,/LIKE|000000000092/);assert.match(q.text,/TOP\(2\)/);
});
test('no match stays absent, ambiguous matches and malformed stock stop, and missing authority stops before product reads',async()=>{
 const empty=setup({rows:[]});assert.equal(await empty.read('000000000099'),null);assert.equal(empty.committed,1);
 const ambiguous=setup({rows:[{},{}]});await assert.rejects(ambiguous.read('000000000092'),{code:'DESKTOP_BARCODE_AMBIGUOUS'});assert.equal(ambiguous.rolled,1);
 for(const options of [{allow:false},{target:false}]){const f=setup(options);await assert.rejects(f.read('000000000092'));assert.equal(f.calls.some(c=>c.text?.includes('FROM dbo.products p')),false);assert.equal(f.rolled,1);}
 const corrupt=setup();corrupt.product.currentStockExact3=null;await assert.rejects(corrupt.read('000000000092'));assert.equal(corrupt.rolled,1);
 const invalid=setup();for(const barcode of ['', ' 00092','00092\n','x'.repeat(101),92])await assert.rejects(invalid.read(barcode));assert.equal(invalid.calls.length,0);
});
test('barcode DTO rejects a wrong echo, getters, unknown fields and unknown-to-zero stock projections',()=>{
 const data={barcode:'00092',product:{id:'10',stockCode:'00092',productName:'Ürün',unit:'ADET',currentStockExact3:'7.000',reservedExact3:'2.000',availableExact3:'5.000'}};assert(isDesktopBarcodeLookup(data,'00092'));assert.equal(isDesktopBarcodeLookup(data,'000093'),false);assert.equal(isDesktopBarcode(92),false);assert.equal(isDesktopBarcodeLookup({...data,product:{...data.product,availableExact3:'0.000'}},'00092'),false);assert.equal(isDesktopBarcodeLookup({...data,price:'0.0000'},'00092'),false);let invoked=0;const getter={...data};Object.defineProperty(getter,'product',{enumerable:true,get(){invoked++;return data.product;}});assert.equal(isDesktopBarcodeLookup(getter,'00092'),false);assert.equal(invoked,0);
});
