import test from 'node:test';import assert from 'node:assert/strict';
import {hash} from './mapping-opening.mjs';import {sqlJsonHash} from './goal7-test-delta.mjs';
import {buildCurrentVegaCompletionInput,buildCurrentVegaCompletionPlan} from './current-vega-product-slice.mjs';
function fixture(){
 const card={IND:7,UID:'source-uid-7',STOKKODU:'0007 ÖRNEK',MALINCINSI:'TAKIM',KOD1:'ÖRNEK',KOD4:'TAKIM',ANABIRIM:42,STATUS:1,DELETED:false,IPTAL:false,STOKTIPI:0,DEPO:1,KALAN:'0.00000000'};
 const unit={IND:42,UID:'unit-uid-42',STOKNO:7,BIRIMADI:'ADET',CARPAN:'1.00000000',BARCODE:'000123',ANABIRIM:true};for(let i=1;i<=6;i++){unit['SATISFIYATI'+i]=i===1?'12.34567890':null;unit['PB'+i]=i===1?'USD':null;}
 const pass={readStartedAt:'2026-10-27T10:00:00.000Z',readCompletedAt:'2026-10-27T10:00:01.000Z',cards:[card],units:[unit],warehouseRows:[{STOKNO:7,BIRIMEX:42,DEPO:1,quantity:'0.00000000',movement_rows:2,invalid_quantity:0}]};
 const capture={schemaVersion:'melisa-active-stock-bounded-two-pass.v1',expectedSourceIds:[7],atomic:false,actualT1:false,sourceIdentity:{identity:{server:'DESKTOP-KSRK0EQ',database:'VEGA2026'},readOnly:true,readAt:'2026-10-27T10:00:05.000Z',permissions:Object.fromEntries(['sysadmin','controlServer','dbControl','dbInsert','dbUpdate','dbDelete','dbExecute','dbAlter','dbCreateTable'].map(k=>[k,0])),tablePermissions:['F0102TBLSTOKLAR','F0102TBLBIRIMLEREX','F0102D0007TBLSTOKHAREKETLERI'].map(name=>({name,canSelect:1,canInsert:0,canUpdate:0,canDelete:0,canAlter:0})),companies:[{IND:102}],periods:[{FIND:102,IND:7,DONEM:2026}]},passes:[pass,{...structuredClone(pass),readStartedAt:'2026-10-27T10:00:02.000Z',readCompletedAt:'2026-10-27T10:00:03.000Z'}]};
 const target={server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01'},proof={kind:'ACCEPTED_SOURCE_DEPOT_MAPPING',sourceCompany:'F0102',sourceWarehouseId:'1',targetWarehouse:'MERKEZ',target,nativeWitnessRows:[{sourceWarehouseId:'1',targetWarehouse:'MERKEZ'}]};
 const nativeInput={runId:'PRODUCT-00000000-0000-4000-8000-000000000009',actorId:'13',sourceAsOf:'2026-10-27',documentDate:'2026-10-27',targetIdentity:target,previousVersion:{context:{runId:'GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d',sourceAsOf:'2026-10-07',bindingsHash:'a'.repeat(64)},products:[{product_id:'99'}],prices:[],records:[]},evidence:{products:[{sourceId:'7',nativeId:null,nativeJSON:null,nativeHash:null,aliasRows:[],codeOwners:[],holdRows:[],prices:[],barcodeOwners:[]}],schema:[],guards:[],constraints:[]}};
 return {capture,nativeInput,warehouseMapping:{proof,proofHash:hash(proof)}};
}
test('two actual equal passes feed the unchanged writer with UID, zero stock, exact currency/price and leading-zero barcode',()=>{
 const f=fixture(),before=JSON.stringify(f),result=buildCurrentVegaCompletionPlan(f),g=result.plan.groups[0];
 assert.equal(JSON.stringify(f),before);assert.equal(result.input.sourceSnapshot.twoPassStable,true);assert.equal(result.input.sourceSnapshot.actualT1,false);assert.equal(g.sourceUid,'source-uid-7');assert.equal(g.source.warehouseSourceId,'1');assert.equal(g.stock.nativeAfter,'0.00000000');assert.equal(g.barcodes[0].barcode,'000123');assert.equal(g.prices[0].after.priceExact,'12.34567890');assert.equal(g.fields.purchase_price,null);assert.equal(g.fields.average_cost_try,null);assert.equal(result.report.targetWrites,0);
});
test('wrong source/target, missing UID column, permissions and overlapping passes never manufacture writer admission',()=>{
 for(const mutate of [f=>{f.capture.sourceIdentity.identity.server='OTHER';},f=>{f.capture.sourceIdentity.permissions.dbUpdate=1;},f=>{f.capture.sourceIdentity.tablePermissions.pop();},f=>{delete f.capture.passes[0].cards[0].UID;},f=>{f.capture.passes[1].readStartedAt=f.capture.passes[0].readStartedAt;},f=>{f.nativeInput.targetIdentity.database='MELISA_ERP_CLEAN_TEST_20261022';}]){const f=fixture();mutate(f);assert.throws(()=>buildCurrentVegaCompletionInput(f),/^Error: CURRENT_COMPLETION_/);}
});
test('source drift isolates only that identity; the caller cannot assert away a real UID change',()=>{
 const f=fixture();f.capture.expectedSourceIds.push(8);f.nativeInput.evidence.products.push({...structuredClone(f.nativeInput.evidence.products[0]),sourceId:'8'});
 for(const p of f.capture.passes){p.cards.push({...p.cards[0],IND:8,UID:'source-uid-8',ANABIRIM:43});p.units.push({...p.units[0],IND:43,STOKNO:8,UID:'unit-uid-43',BARCODE:'000456'});p.warehouseRows.push({...p.warehouseRows[0],STOKNO:8,BIRIMEX:43});}
 f.capture.passes[1].cards[1].UID='changed-source-uid';f.capture.changedIds=[];
 const r=buildCurrentVegaCompletionPlan(f);assert.deepEqual(r.report.unstableSourceIds,['8']);assert.deepEqual(r.input.sourceSnapshot.products.map(p=>p.sourceId),['7']);assert.equal(r.plan.groups.length,1);
});
test('unknown depot, multiple depots, unknown unit and missing quantity are not converted to a zero opening',()=>{
 for(const mutate of [f=>{f.warehouseMapping=null;},f=>{for(const p of f.capture.passes)p.warehouseRows.push({...p.warehouseRows[0],DEPO:2});},f=>{for(const p of f.capture.passes)p.units[0].CARPAN=null;},f=>{for(const p of f.capture.passes)p.warehouseRows[0].invalid_quantity=1;}]){const f=fixture();mutate(f);const r=buildCurrentVegaCompletionPlan(f);assert.equal(r.plan.groups.length,0);assert.equal(r.plan.counts.stockEffects,0);assert.equal(r.plan.deferred.length,1);}
});
test('an unsupported secondary package unit never becomes an ADET price or factor-one barcode',()=>{
 const f=fixture();for(const p of f.capture.passes)p.units.push({...p.units[0],IND:43,UID:'package-unit-43',BIRIMADI:'KOLI',CARPAN:'12.00000000',BARCODE:'000999',ANABIRIM:false});
 const r=buildCurrentVegaCompletionPlan(f),g=r.plan.groups[0];assert.equal(g.prices.length,1);assert.equal(g.prices[0].after.unitSourceId,'42');assert.equal(g.barcodes.length,1);assert.equal(g.barcodes[0].barcode,'000123');assert(g.exceptions.some(e=>e.reason==='BARCODE_UNIT_FACTOR_UNVERIFIED'));assert(r.report.fieldIssues[0].issues.some(e=>e.reason==='SOURCE_PRICE_UNIT_UNSUPPORTED'));assert.equal(g.source.typedSalePrices.length,1);assert(g.source.typedSalePrices.every(p=>p.unitSourceId==='42'));
});
function existing(f){
 const n={id:15,stock_code:'0007 ÖRNEK',name:'TAKIM',brand:'ÖRNEK',category:'TAKIM',is_active:true,unit:'ADET',currency_code:'USD',sales_price:5,purchase_price:17,average_cost_try:60,current_stock_qty:0,source_record_key:['VEGA2026','F0102TBLSTOKLAR','7'].join('/')},nativeJSON=JSON.stringify(n),pr={id:71,product_id:15,price_type:'sale',source_unit_id:42,price_tier:1,currency_code:'USD',price:5},priceJSON=JSON.stringify(pr);
 f.nativeInput.previousVersion.products=[{product_id:'15'}];f.nativeInput.evidence.products[0]={...f.nativeInput.evidence.products[0],nativeId:'15',nativeJSON,nativeHash:sqlJsonHash(nativeJSON),aliasRows:[{product_id:'15',source_product_id:7}],codeOwners:[{id:'15'}],previousSource:{sourceId:'7',sourceUid:'source-uid-7',stockCode:n.stock_code,name:n.name,brand:n.brand,category:n.category,isActive:true},salesPriceExact:'5.0000',averageCostTryExact:'60.0000',stockProof:null,prices:[{...pr,id:'71',nativeJSON:priceJSON,nativeHash:sqlJsonHash(priceJSON),priceExact:'5.00000000',acceptedPriceExact:'5.00000000',acceptedNativeHash:sqlJsonHash(priceJSON),manual:true}]};
 return f;
}
test('real native preimages reach existing manual-price and local-stock protections without substituting a TEST fixture',()=>{
 const r=buildCurrentVegaCompletionPlan(existing(fixture())),g=r.plan.groups[0];assert.equal(g.stock,null);assert.equal(g.prices.length,0);assert.equal(g.fields.sales_price,undefined);assert(g.exceptions.some(e=>e.reason==='LOCAL_OR_UNPROVEN_PRICE'));assert.equal(g.fields.purchase_price,undefined);assert.equal(g.fields.average_cost_try,undefined);
 const held=existing(fixture());held.nativeInput.evidence.products[0].holdRows=[{native_id:15}];assert.equal(buildCurrentVegaCompletionPlan(held).plan.groups.length,0);
});
