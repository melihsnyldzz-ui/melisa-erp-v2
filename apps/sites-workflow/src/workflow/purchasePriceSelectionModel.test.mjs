import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { eligiblePurchaseQuotes, nativePriceProjection, purchaseSelectionPreview, purchaseSelectionRequest, displayExact, openingPurchaseSelection, fxRatesForWidget, fxPreviewBody } from './purchasePriceSelectionModel.js';
import { calculateCurrencySettlement } from '../../../../packages/shared/src/currencySettlement.mjs';
const product={id:1,name:'Kabul edilmiş ürün',accepted:true};
const quote={id:'q',productId:1,accepted:true,type:'purchase',unitKind:'CARD',tier:0,currency:'USD',priceExact:'1.23456789',sourceKind:'accepted-opening',sourceAsOf:'2026-09-30',source:'Açılış kaydı'};
const input=()=>({product,quotes:[quote],units:[{id:'u',productId:1,verified:true,label:'Adet',source:'Doğrulanmış stok birimi',factorExact:'1.00000000'}],rates:[{id:'usd',currency:'USD',date:'2026-10-04',rateToTryExact:'40.00000000',verified:true,source:'Seçilmiş banka kaydı'},{id:'eur',currency:'EUR',date:'2026-10-04',rateToTryExact:'50.00000000',verified:true,source:'Seçilmiş banka kaydı'}],quoteId:'q',unitId:'u',documentRateId:'usd',accountRateId:'eur',date:'2026-10-04',quantity:'2.5',accountCurrency:'EUR'});
test('Exact unknown prices never become zero; half-up projection preserves the exact difference',()=>{
 for(const value of [null,undefined,'',0,'wrong','1.23'])assert.throws(()=>nativePriceProjection(value));
 assert.deepEqual(nativePriceProjection('1.23456789'),{priceExact:'1.23456789',priceNative:'1.2346',roundingExact:'0.00003211'});
 assert.equal(nativePriceProjection('1.23455000').priceNative,'1.2346');
 assert.equal(nativePriceProjection('0.00000000').priceNative,'0.0000');
 assert.equal(displayExact(null),'Bilinmiyor');
});
test('Only accepted CARD purchase tier 0 source quotes are selectable',()=>{
 const invalid=[{type:'sale'},{tier:null},{tier:1},{unitKind:'SALES'},{accepted:false},{currency:'GBP'},{productId:2},{sourceAsOf:'2026-10-04'}];
 for(const delta of invalid)assert.equal(eligiblePurchaseQuotes(product,[{...quote,...delta}]).length,0);
 assert.equal(eligiblePurchaseQuotes({...product,accepted:false},[quote]).length,0);
});
test('Operational factor, native amount and cross currency settlement are exact',()=>{
 const p=purchaseSelectionPreview(input());
 assert.equal(p.stockQuantityExact,'2.50000000');assert.equal(p.documentAmountNative,'3.0865');
 assert.equal(p.amountTryNative,'123.4600');assert.equal(p.accountAmountNative,'2.4692');
 const shared=calculateCurrencySettlement({documentAmount:p.documentAmountNative,documentCurrency:'USD',accountCurrency:'EUR',documentRateToTry:'40.00000000',accountRateToTry:'50.00000000'});
 assert.equal(shared.accountAmount,Number(p.accountAmountNative));assert.equal(shared.amountTry,Number(p.amountTryNative));
});
test('Missing, stale, wrong date/currency and unknown rate records block preview',()=>{
 for(const delta of [{stale:true},{date:'2026-10-03'},{currency:'TRY'},{verified:false},{source:''},{rateToTryExact:null},{rateToTryExact:'0.00000000'}]){
  const i=input();i.rates[0]={...i.rates[0],...delta};assert.throws(()=>purchaseSelectionPreview(i));
 }
 const i=input();i.documentRateId='absent';assert.throws(()=>purchaseSelectionPreview(i));
});
test('No operational factor or malformed quantity/date is guessed',()=>{
 for(const delta of [{verified:false},{factorExact:null},{factorExact:'0.00000000'},{factorExact:'12.00000000'},{productId:2}]){const i=input();i.units[0]={...i.units[0],...delta};assert.throws(()=>purchaseSelectionPreview(i));}
 for(const quantity of ['',null,'0','-1','1.2345'])assert.throws(()=>purchaseSelectionPreview({...input(),quantity}));
 assert.throws(()=>purchaseSelectionPreview({...input(),date:'2026-02-30'}));
});
test('TRY 1 and same-currency rate consistency apply to selected records',()=>{
 const i=input();i.accountCurrency='USD';i.rates[1]={...i.rates[1],currency:'USD'};assert.throws(()=>purchaseSelectionPreview(i),/iki farklı kur/);
 i.rates[1]={...i.rates[1],currency:'TRY'};i.accountCurrency='TRY';assert.throws(()=>purchaseSelectionPreview(i),/TRY kuru/);
 i.rates[1].rateToTryExact='1.00000000';assert.equal(purchaseSelectionPreview(i).accountAmountNative,'123.4600');
});
test('Widget renders source age, precision, safe text and disabled loading/error/empty states',async()=>{
 const path=new URL('./purchasePriceSelection.js',import.meta.url);
 const source=(await readFile(path,'utf8')).replace("import './purchasePriceSelection.css';",'').replace("'./purchasePriceSelectionModel.js'",JSON.stringify(new URL('./purchasePriceSelectionModel.js',import.meta.url).href));
 const {createPurchasePriceSelection}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 let calls=0;const widget=createPurchasePriceSelection({onSelection:()=>calls++});
 let html=widget.update({...input(),product:{...product,name:'<unsafe>'}});
 assert.match(html,/eski açılış fiyatı, güncel fiyat değildir/);assert.match(html,/1,23456789/);assert.match(html,/1,2346/);assert.match(html,/&lt;unsafe&gt;/);assert.equal(calls,0);
 html=widget.update({loading:true});assert.match(html,/<fieldset disabled>/);assert.match(html,/Fiyatlar yükleniyor/);
 html=widget.update({loading:false,error:'Fiyat okunamadı'});assert.match(html,/role="alert"/);assert.match(html,/data-pps-preview disabled/);
 html=widget.update({error:'',quotes:[]});assert.match(html,/seçilebilir kart alış fiyatı bulunamadı/);assert.equal(widget.getSelection(),null);
 html=widget.update({quotes:[{...quote,sourceKind:'synthetic'}]});assert.match(html,/Sentetik ürün ve fiyat/);
 html=widget.update({authoritativeOnly:true,units:[],quotes:[quote]});assert.match(html,/önizlemede kaynak kaydından doğrulanacak/);assert.ok(widget.getSelection());assert.doesNotMatch(html,/data-pps-preview disabled/);
});
test('Readonly request can ask for unit proof without inventing a factor or local amount',()=>{
 const i={...input(),units:[],authoritativeOnly:true,quantityPolicy:{integer:true},quantity:'1'};
 assert.equal(purchaseSelectionRequest(i).quoteId,'q');assert.throws(()=>purchaseSelectionPreview(i),/birimini/);
 for(const quantity of ['0','6','1.5','1.000'])assert.throws(()=>purchaseSelectionRequest({...i,quantity}));
});
test('Native request retains original source tuple; selected rates must match currency and proof',()=>{
 const price={...quote,id:'9',productId:'123',unitSourceId:null,sourceKey:'origin/PRICE/purchase/CARD/0/USD'};
 const productDto={productId:'123',productSourceKey:'origin',accepted:true};const meta={runId:'opening',sourceHash:'a'.repeat(64),planHash:'b'.repeat(64)};
 const snapshot=openingPurchaseSelection(productDto,price,meta);assert.equal(snapshot.priceExact,'1.23456789');assert.equal(snapshot.priceSourceKey,price.sourceKey);assert.equal(snapshot.unitSourceId,null);
 assert.throws(()=>openingPurchaseSelection(productDto,{...price,unitSourceId:'1'},meta));
 const rates=fxRatesForWidget([{currency:'USD',sourceId:'USD-TEST',rateToTryExact8:'40.00000000',source:'synthetic-test',asOf:'2026-10-04',version:'1',hash:'c'.repeat(64)},{currency:'TRY',sourceId:'TRY-TEST',rateToTryExact8:'1.00000000',source:'synthetic-test',asOf:'2026-10-04',version:'1',hash:'d'.repeat(64)}]);
 const selected={quantity:'1',date:'2026-10-04',documentCurrency:'USD',accountCurrency:'TRY',documentRateId:rates[0].id,accountRateId:rates[1].id};
 assert.deepEqual(fxPreviewBody(snapshot,selected,rates),{selection:snapshot,quantity:1,date:'2026-10-04',rateVersion:'1'});
 assert.throws(()=>fxPreviewBody(snapshot,{...selected,date:'2026-10-05'},rates));
 assert.throws(()=>fxPreviewBody(snapshot,{...selected,accountRateId:rates[0].id},rates));
 assert.equal(fxRatesForWidget([{...rates[0].raw,hash:null}])[0].verified,false);
 assert.match(rates[0].source,/piyasa kuru değildir/);
});
