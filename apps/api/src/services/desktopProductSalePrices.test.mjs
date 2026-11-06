import test from 'node:test';import assert from 'node:assert/strict';
import {desktopAdditionalSalePrices,isDesktopProductSalePrices} from '../../../../packages/shared/src/desktopProductSalePrices.mjs';
import {DESKTOP_PRODUCT_SALE_PRICES_SQL} from './desktopProductSalePricesSql.mjs';
test('additional prices never supply a rate, default, duplicate currency or rounded amount',()=>{
 const usd={currency:'USD',priceExact4:'0.7500'},eur={currency:'EUR',priceExact4:'0.6000'};assert.deepEqual(desktopAdditionalSalePrices('TRY',[usd,eur]),[usd,eur]);assert.deepEqual(desktopAdditionalSalePrices('TRY',[eur]),[eur]);
 for(const values of [[],[eur,usd],[usd,usd],[{...usd,currency:'TRY'}],[{...usd,currency:'GBP'}],[{...usd,priceExact4:'0.0000'}],[{...usd,priceExact4:'0.75001'}],[{...usd,priceExact4:0.75}],[{...usd,rate:'1.00000000'}]])assert.throws(()=>desktopAdditionalSalePrices('TRY',values));assert.throws(()=>desktopAdditionalSalePrices('USD',[eur]));
 const getter={currency:'USD',get priceExact4(){throw Error('getter called');}};assert.throws(()=>desktopAdditionalSalePrices('TRY',[getter]),/PRODUCT_SALE_PRICES_INVALID/);
});
test('readonly prices preserve eight decimals and old tiers but reject orphan/foreign units, duplicate tuples and excess rows',()=>{
 const p={id:'1',productId:'8',unitId:'9',type:'sale',tier:null,currency:'TRY',priceExact8:'12.00000000'};assert.equal(isDesktopProductSalePrices([p,{...p,id:'2',tier:1,priceExact8:'10.00000001'}],'8','9'),true);
 for(const rows of [[],[p,p],[{...p,unitId:null}],[{...p,productId:'9'}],[{...p,priceExact8:'12.0000'}],[{...p,priceExact8:'-1.00000000'}],Array.from({length:31},(_,i)=>({...p,id:String(i+1),tier:i}))])assert.equal(isDesktopProductSalePrices(rows,'8','9'),false);
 assert.match(DESKTOP_PRODUCT_SALE_PRICES_SQL,/TOP\(31\)/);assert.match(DESKTOP_PRODUCT_SALE_PRICES_SQL,/LEFT JOIN/);assert.doesNotMatch(DESKTOP_PRODUCT_SALE_PRICES_SQL,/decimal\(18,4\)|INSERT|UPDATE|DELETE|MERGE/);
});
