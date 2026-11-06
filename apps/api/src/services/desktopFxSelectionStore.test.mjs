import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopFxSelectionStore,DESKTOP_FX_SELECTION_SQL,DESKTOP_FX_MISSING_PRICE_SQL} from './desktopFxSelectionStore.mjs';
import {DESKTOP_COMPANY_RATE_READ_SQL} from './desktopCompanyRateRead.mjs';
const fx={documentCurrency:'USD',accountId:'7',documentRateExact8:'40.00000000',accountRateExact8:'40.00000000',documentRateMode:'override',accountRateMode:'override'};
function fixture(mode='ok'){
 const tx={},scope={},calls=[];let count=0;
 class Request{constructor(t){assert.equal(t,tx);this.values={};}input(k,_type,v){this.values[k]=v;return this;}async query(text){calls.push({text,values:{...this.values}});if(text===DESKTOP_COMPANY_RATE_READ_SQL)return {recordset:[]};if(text===DESKTOP_FX_MISSING_PRICE_SQL)return {recordset:[{missingPrice:mode==='missing-price'?1:0}]};if(!text.includes('@accountId'))return {recordset:[{reservedExact3:mode==='reserved'?'broken':'1.000'}]};count++;const customer={id:'2',entityId:'2',accountId:'7',accountCustomerId:mode==='missing-foreign'?'3':'2',accountEntityId:'2',accountSupplierId:null,active:true,accountCurrency:'USD',currency:'TRY'},product={id:this.values.productId,unit:'ADET',seriesUnitId:null,seriesFactorExact8:null};if(mode==='parent'&&count===2)customer.accountId='8';if(mode==='series')product.seriesUnitId='91';return {recordsets:[[customer],mode.startsWith('missing-')?[]:mode==='duplicate'?[product,product]:[product]]};}}
 const select=createDesktopFxSelectionStore({sql:{Request,NVarChar:()=>null},verifyScope:async value=>{assert.equal(value.transaction,tx);assert.equal(value.scope,scope);return mode!=='scope';}});
 return {calls,read:()=>select({transaction:tx,scope,customerId:'2',productIds:['10','9'],currencySelection:fx,documentDate:'2026-11-06'})};
}
test('FX selector binds account and price currency, locks products in numeric order and reads exact dated rates in the same transaction',async()=>{
 const f=fixture(),data=await f.read();assert.deepEqual(data.products.map(p=>p.id),['10','9']);assert.deepEqual(f.calls.filter(c=>c.text===DESKTOP_FX_SELECTION_SQL).map(c=>c.values),[{customerId:'2',productId:'9',accountId:'7',documentCurrency:'USD'},{customerId:'2',productId:'10',accountId:'7',documentCurrency:'USD'}]);assert.deepEqual(f.calls.at(-1).values,{companyRateDate:'2026-11-06'});assert.equal(data.companyRates.rates.find(r=>r.currency==='USD').defined,false);
 for(const marker of ['a.supplier_id IS NULL','a.id=TRY_CONVERT(bigint,@accountId)','q.currency_code=@documentCurrency AND q.price_tier IS NULL',"e.role=N'customer'",'q.product_id=p.id','l.unit_id=u.id','UPDLOCK,HOLDLOCK'])assert.ok(DESKTOP_FX_SELECTION_SQL.includes(marker));
});
test('unverified scope, ambiguous prices, conflicting parents, partial series and malformed reservations never return a usable FX selection',async()=>{for(const mode of ['scope','duplicate','parent','series','reserved']){const f=fixture(mode);await assert.rejects(f.read());if(mode==='scope')assert.equal(f.calls.length,0);}});
test('an actual absent selected-currency base price gets a finite explanation while corrupted links and foreign accounts remain unavailable',async()=>{
 const missing=fixture('missing-price');await assert.rejects(missing.read(),{code:'DESKTOP_SALE_PRICE_REQUIRED'});assert.equal(missing.calls.length,2);assert.deepEqual(missing.calls[1].values,{productId:'9',documentCurrency:'USD'});
 for(const mode of ['missing-link','missing-foreign']){const f=fixture(mode);await assert.rejects(f.read(),/DESKTOP_FX_SELECTION_INVALID/);if(mode==='missing-foreign')assert.equal(f.calls.some(c=>c.text===DESKTOP_FX_MISSING_PRICE_SQL),false);}
 assert.match(DESKTOP_FX_MISSING_PRICE_SQL,/q\.price_type=N'sale' AND q\.price_tier IS NULL AND q\.currency_code=@documentCurrency/);assert.doesNotMatch(DESKTOP_FX_MISSING_PRICE_SQL,/ISNULL\(.*price|COALESCE\(.*price|q\.price\s*[><=]/);assert.match(DESKTOP_FX_MISSING_PRICE_SQL,/u\.factor=1 AND u\.label=p\.unit/);
});
