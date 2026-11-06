import test from 'node:test';import assert from 'node:assert/strict';
import {isDesktopProductCard} from '../../../../packages/shared/src/desktopProductCard.mjs';
const card={id:'6',stockCode:'P5',name:'Ürün',brand:'B',category:'C',unit:'ADET',currency:'TRY',salePriceExact4:'12.0000',purchasePriceExact4:'8.0000',purchaseDiscountRateExact4:'0.0000',averageCostTryExact4:'8.0000',currentStockExact3:'0.000',supplierId:'1',supplierName:'Tedarik',isActive:true,barcodes:[{id:'9',productId:'6',barcode:'00000000005',type:'primary',isPrimary:true},{id:'10',productId:'6',barcode:'000000000051',type:'extra',isPrimary:false}]};
test('readonly card binds every barcode to the selected product without numeric barcode conversion',()=>{
 assert.equal(isDesktopProductCard(card,'6'),true);assert.equal(isDesktopProductCard(card,'7'),false);
 for(const change of [{id:'7'},{salePriceExact4:12},{currentStockExact3:null},{barcodes:[{...card.barcodes[0],productId:'7'}]},{barcodes:[{...card.barcodes[0],barcode:5}]},{barcodes:[{...card.barcodes[0],isPrimary:false}]},{barcodes:[card.barcodes[0],card.barcodes[0]]},{role:'admin'}])assert.equal(isDesktopProductCard({...card,...change},'6'),false);
 assert.equal(isDesktopProductCard({...card,brand:null,category:null,supplierId:null,supplierName:null},'6'),true);
});
