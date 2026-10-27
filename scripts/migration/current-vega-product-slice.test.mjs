import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCurrentVegaProductSlice,compareCurrentVegaSliceWithNative,selectActiveVegaProductCards} from './current-vega-product-slice.mjs';
import {hash} from './mapping-opening.mjs';
import {buildProductCompletionPlan} from './product-completion-plan.mjs';

function fixture(){
 const common={source:'vega',database:'VEGA2026',company:'F0102',period:null,readAt:'2026-10-27T01:00:00.000Z',readOnly:true,hasMore:false,nextCursor:null};
 const envelope=(object,items,filter)=>({...common,objects:[{schemaName:'dbo',objectName:object}],items,filters:[{field:'STOKNO',op:'eq',value:filter}]});
 const cards=envelope('F0102TBLSTOKLAR',[
  {IND:41,STOKKODU:'0007 ÖRNEK',MALINCINSI:'TAKIM',KOD1:'ÖRNEK',KOD4:'TAKIM',ANABIRIM:71,STATUS:1,DELETED:null,IPTAL:false},
  {IND:42,STOKKODU:'0161 BELİRSİZ',MALINCINSI:'Ürün',KOD1:null,KOD4:null,ANABIRIM:72,STATUS:1,DELETED:false,IPTAL:false}
 ]);
 const units=cards.items.map(c=>envelope('F0102TBLBIRIMLEREX',[{IND:c.ANABIRIM,STOKNO:c.IND,BIRIMADI:'ADET',CARPAN:'1.00000000',BARCODE:'0000'+c.IND}],c.IND));
 const prices=structuredClone(units);for(const e of prices)Object.assign(e.items[0],{SATISFIYATI:'999.00000000',SATISFIYATI1:'12.34567890',PB1:'$',SATISFIYATI2:'0.00000000',PB2:'TL',SATISFIYATI3:null,PB3:null,SATISFIYATI4:null,PB4:null,SATISFIYATI5:null,PB5:null,SATISFIYATI6:null,PB6:null});
 const quantities=cards.items.map(c=>({...envelope('F0102D0007TBLSTOKHAREKETLERI',[{source_id:c.IND,stock_code:c.STOKKODU,source_unit:'ADET',source_unit_id:c.ANABIRIM,erp_quantity:c.IND===41?'0.00000000':'-2.00000000',quantity_basis:'period_movements'}]),period:'D0007',periodYear:2026}));
 return {cards,units,prices,quantities};
}

test('dated readback capture cannot masquerade as an admitted frozen writer input',()=>{
 const sourceSnapshot=buildCurrentVegaProductSlice(fixture());
 assert.throws(()=>buildProductCompletionPlan({actorId:'1',sourceSnapshot,sourceHash:hash(sourceSnapshot)}),/^Error: PRODUCT_FROZEN_SNAPSHOT$/);
});
test('dated live slice feeds established typed-price contract without creating an opening or inventing metadata',()=>{
 const input=fixture(),raw=JSON.stringify(input),s=buildCurrentVegaProductSlice(input);
 assert.equal(JSON.stringify(input),raw);assert.equal(s.products.length,2);assert.equal(s.products[0].stockCode,'0007 ÖRNEK');
 assert.equal(s.products[1].brand,null);assert.equal(s.products[1].category,null);assert.equal(s.products[0].barcodes[0].barcode,'000041');
 assert.equal(s.products[0].typedSalePrices[0].priceExact,'12.34567890');assert.equal(s.products[0].typedSalePrices[0].currency,'USD');
 assert.equal(s.products[0].typedSalePrices[1].priceExact,'0.00000000');assert.equal(s.products[0].quantity,'0.00000000');
 assert.equal(s.products[1].quantity,'-2.00000000');assert.equal(s.products[0].stockApplicationReady,false);assert.equal(s.products[0].warehouseAllocation,null);
 assert.equal(s.acceptedOpening,false);assert.equal(s.source.atomic,false);assert.equal(s.source.actualT1,false);
 assert.equal(s.products[0].provenance.kind,'DATED_SOURCE_READ');assert.equal(s.products[0].averageCostTry,null);
 assert.equal(s.products[0].nativeSourceKey,['VEGA2026','F0102TBLSTOKLAR','41'].join('/'));
 const {snapshotHash,...body}=s;assert.equal(snapshotHash,hash(body));
});
test('wrong company, snapshot database, missing page, duplicate card and wrong unit owner fail closed',()=>{
 for(const mutate of [f=>{f.cards.company='F0103';},f=>{f.cards.database='VEGA_CAPTURE_20260930_01';},f=>{f.units[0].hasMore=true;},f=>{f.cards.items[1].IND=41;},f=>{f.units[0].items[0].STOKNO=42;},f=>{f.quantities[0].period='D0006';},f=>{f.quantities[0].items[0].stock_code='other';},f=>{f.prices[0].items[0].CARPAN='2';},f=>{f.cards.items[0].STATUS=null;}]){
  const f=fixture();mutate(f);assert.throws(()=>buildCurrentVegaProductSlice(f),/^Error: CURRENT_PRODUCT_/);
 }
});
test('unknown unit, currency and amount remain independent unknowns; a negative price is not a valid quote',()=>{
 const f=fixture();f.units[0].items[0].CARPAN='2';f.prices[0].items[0].CARPAN='2';
 f.prices[1].items[0].PB1=null;f.prices[1].items[0].SATISFIYATI2=null;f.prices[1].items[0].SATISFIYATI3='-1';f.prices[1].items[0].PB3='$';
 const s=buildCurrentVegaProductSlice(f);
 assert.equal(s.products[0].stockCode,'0007 ÖRNEK');assert.equal(s.products[0].unit,null);assert.equal(s.products[0].quantity,null);assert.equal(s.products[0].typedSalePrices.length,0);
 assert.equal(s.products[1].typedSalePrices.length,0);assert.equal(s.products[1].prices[0].currency,null);assert.equal(s.products[1].prices[1].price,null);
 assert(s.products[1].issues.some(i=>i.reason==='SOURCE_NEGATIVE_SALE_PRICE'));
});
test('all valid source barcodes survive, collisions are not silently bound, numeric barcodes are rejected',()=>{
 const f=fixture();f.units[0].items.push({...f.units[0].items[0],IND:73,BARCODE:'000042'});
 const s=buildCurrentVegaProductSlice(f);assert.equal(s.products[0].barcodes.length,2);assert(s.products.every(p=>p.issues.some(i=>i.reason==='SOURCE_BARCODE_MULTIPLE_PRODUCTS')));
 f.units[0].items[0].BARCODE=41;assert.throws(()=>buildCurrentVegaProductSlice(f),/CURRENT_PRODUCT_BARCODE_MUST_BE_TEXT/);
});
test('native equality is readback only; clean DB substitution, unknown holds and duplicate prices never authorize opening',()=>{
 const s=buildCurrentVegaProductSlice(fixture()),native={server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01',holdsCount:0,holds:null,products:s.products.map(p=>({id:p.sourceId,source_record_key:p.nativeSourceKey,stock_code:p.stockCode,name:p.name,brand:p.brand,category:p.category,unit:p.unit,is_active:p.isActive,stockExact:p.quantity})),barcodes:s.products.flatMap(p=>p.barcodes.map(b=>({product_id:p.sourceId,barcode:b.barcode,is_active:true}))),prices:s.products.flatMap(p=>p.typedSalePrices.map(q=>({product_id:p.sourceId,price_type:'sale',source_unit_id:q.unitSourceId,price_tier:q.tier,currency_code:q.currency,priceExact:q.priceExact})))};
 const result=compareCurrentVegaSliceWithNative(s,native);assert(result.results.every(r=>r.status==='OBSERVED_EQUAL'&&r.observedQuantitySame&&r.stockApplicationReady===false));assert.equal(result.openingApplied,false);
 assert.throws(()=>compareCurrentVegaSliceWithNative(s,{...native,database:'MELISA_ERP_CLEAN_TEST_20261022'}),/CURRENT_PRODUCT_NATIVE_TARGET/);
 assert.throws(()=>compareCurrentVegaSliceWithNative(s,{...native,holdsCount:1}),/CURRENT_PRODUCT_NATIVE_HOLD_PROOF/);
 const duplicate=structuredClone(native);duplicate.prices.push({...duplicate.prices[0]});assert.equal(compareCurrentVegaSliceWithNative(s,duplicate).results[0].status,'DIFFERENCES');
 const held=structuredClone(native);held.holdsCount=1;held.holds=[{native_id:41}];assert.equal(compareCurrentVegaSliceWithNative(s,held).results[0].status,'HELD');
 const gaps=structuredClone(s);gaps.products[0].issues.push({field:'quantity',reason:'SOURCE_QUANTITY_UNKNOWN'});const {snapshotHash:oldHash,...gapBody}=gaps;gaps.snapshotHash=hash(gapBody);assert.equal(compareCurrentVegaSliceWithNative(gaps,native).results[0].status,'SOURCE_GAPS');
});
test('active-only stock scope keeps zero-stock active cards, ignores AKTIF, and cannot be applied to party cards',()=>{
 const f=fixture();f.cards.items[0].AKTIF=false;
 const passive={...f.cards.items[0],IND:43,STATUS:2,AKTIF:true},unknown={...passive,IND:44,STATUS:null};
 f.cards.items.push(passive,unknown);const before=JSON.stringify(f.cards),selected=selectActiveVegaProductCards(f.cards);
 assert.equal(JSON.stringify(f.cards),before);assert.deepEqual(selected.items.map(c=>c.IND),[41,42]);
 assert.equal(selected.selection.selected,2);assert.equal(selected.selection.unknownActive,1);assert.equal(selected.selection.stockQuantityFilter,false);assert.equal(selected.selection.partyScopeUnchanged,true);
 f.cards=selected;assert.equal(buildCurrentVegaProductSlice(f).products[0].quantity,'0.00000000');
 const invalid=fixture();invalid.cards.items[0].STATUS=2;assert.throws(()=>buildCurrentVegaProductSlice(invalid),/CURRENT_PRODUCT_ACTIVE_SCOPE_ONLY/);
 const parties=structuredClone(selected);parties.objects[0].objectName='F0102TBLCARI';assert.throws(()=>selectActiveVegaProductCards(parties),/CURRENT_PRODUCT_SOURCE_OBJECT/);
});
