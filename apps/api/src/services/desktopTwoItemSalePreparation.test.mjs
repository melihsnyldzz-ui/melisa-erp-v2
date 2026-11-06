import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopTwoItemRevision,prepareDesktopTwoItemSale} from './desktopTwoItemSalePreparation.mjs';
import {normalizeSalesPayload} from './invoiceDraftService.js';

const product=(id,price)=>({id,unitId:id+'1',priceId:id+'2',unitProductId:id,priceProductId:id,priceUnitId:id+'1',barcodeProductId:id,priceType:'sale',currency:'TRY',active:true,unitFactorExact8:'1.00000000',mainUnit:true,stockCode:'P'+id,name:'Ürün '+id,barcode:'00'+id,unit:'ADET',stockExact3:'4.000',priceExact4:price,averageCostTryExact4:'5.3000'});
const locked=()=>({customer:{id:'2',customerCode:'M1',entityId:'3',accountId:'4',accountCustomerId:'2',accountEntityId:'3',accountSupplierId:null,accountCurrency:'TRY',currency:'TRY',active:true,balanceExact4:'1.0000',accountBalanceExact8:'1.00000000'},products:[product('5','10.0000'),product('8','7.5000')],reservedExact3:['1.000','0.000']});
const request=s=>({requestId:'da171000-6f42-4f19-8cab-9f4539618647',customerId:'2',documentDate:'2026-11-05',expectedRevision:desktopTwoItemRevision(s),items:[{productId:'5',quantityExact3:'2.000'},{productId:'8',quantityExact3:'1.000'}]});
test('entered full series is admitted only against the revision-bound allowed product unit; native invoice remains ADET',()=>{
 const s=locked();s.products[0].stockExact3='60.000';s.products[0].seriesUnit={unitId:'53',factorExact8:'6.00000000'};const r=request(s);r.items[0]={productId:'5',quantityExact3:'12.000',series:{unitId:'53',factorExact8:'6.00000000',quantityExact3:'2.000'}};const p=prepareDesktopTwoItemSale(r,s);assert.equal(p.invoice.items[0].quantity,12);assert.equal(p.invoice.items[0].unitPrice,10);assert.equal(p.expected.lines[0].quantityExact3,'12.000');assert.equal(p.seriesSelections[0].seriesQuantityExact3,'2.000');
 for(const change of [{quantityExact3:'11.000'},{series:{...r.items[0].series,unitId:'99'}},{series:{...r.items[0].series,factorExact8:'7.00000000'}},{series:{...r.items[0].series,quantityExact3:'2.500'}}])assert.throws(()=>prepareDesktopTwoItemSale({...r,items:[{...r.items[0],...change},r.items[1]]},s));
 const changed=structuredClone(s);changed.products[0].seriesUnit.factorExact8='7.00000000';assert.throws(()=>prepareDesktopTwoItemSale(r,changed));
});

test('two selected products share one invoice and exact total while reservations reduce availability',()=>{
 const s=locked(),p=prepareDesktopTwoItemSale(request(s),s);
 assert.equal(p.invoice.items.length,2);assert.equal(p.expected.totalExact4,'27.5000');
 assert.deepEqual(p.expected.lines.map(v=>v.stockAfterExact3),['2.000','3.000']);
 assert.equal(p.expected.customerAfterExact4,'28.5000');assert.equal(p.expected.accountAfterExact8,'28.50000000');
 assert.equal(Object.hasOwn(p.expected.lines[0],'customerAfterExact4'),false);
 assert.equal(p.invoice.customerId,2);assert.equal(p.expected.currency,'TRY');
 const native=normalizeSalesPayload(p.invoice);assert.equal(native.items.length,2);assert.equal(native.grandTotal.toFixed(4),p.expected.totalExact4);
});
test('rejects stale selection, oversubscribed stock and duplicate product',()=>{
 const s=locked(),r=request(s);s.reservedExact3[0]='2.000';assert.throws(()=>prepareDesktopTwoItemSale(r,s));
 const fresh=request(s);fresh.items[0].quantityExact3='2.001';assert.throws(()=>prepareDesktopTwoItemSale(fresh,s));
 const same=locked(),dupe=request(same);same.products[1]=structuredClone(same.products[0]);dupe.items[1].productId='5';dupe.expectedRevision=desktopTwoItemRevision(same);assert.throws(()=>prepareDesktopTwoItemSale(dupe,same));
});
test('rejects unverified identities, invalid dates and malformed reservation amounts',()=>{
 for(const change of [s=>{s.customer.accountCustomerId='99';},s=>{s.products[1].priceUnitId='99';},s=>{s.reservedExact3[1]='-1.000';}]){const s=locked();change(s);assert.throws(()=>prepareDesktopTwoItemSale(request(s),s));}
 const s=locked(),r=request(s);r.documentDate='2026-02-30';assert.throws(()=>prepareDesktopTwoItemSale(r,s));
});
