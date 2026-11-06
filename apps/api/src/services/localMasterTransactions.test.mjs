import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalMasterTransactions,LOCAL_MASTER_TRANSACTION_LIMITS} from './localMasterTransactions.mjs';

const customer=()=>({requestId:'da171000-6f42-4f19-8cab-9f4539618647',customerCode:'M1',name:'Örnek',phone:'555',customerType:'customer',currency:'EUR'});
const product=()=>({requestId:'6508625b-b648-421b-b7b9-35d4be7c7263',stockCode:'P1',name:'Örnek ürün',barcode:'000123',unit:'METRE',currency:'USD',salePriceExact4:'12.2500',purchasePriceExact4:'5.0000',purchaseDiscountRateExact4:'12.5000',saleTier:1});
function memoryStore(){
 let state={seq:0,rows:{customers:[],suppliers:[],entities:[],accounts:[],products:[],units:[],barcodes:[],prices:[],links:[],audit:[],openings:[]},journal:{}};
 let failAt=null,loseCommit=false,calls=0;
 const add=(draft,table,v)=>{if(failAt===table)throw Error('injected failure');const id=String(++draft.seq);draft.rows[table].push({id,...v});return id;};
 return {
  failAt(v){failAt=v;},loseCommit(){loseCommit=true;},snapshot(){return structuredClone(state);},calls(){return calls;},
  async withTransaction(work){
   calls++;const draft=structuredClone(state);
   const tx={
    async lockAndVerifyAuthority(v){if(failAt==='authority')return false;return v.actorId==='7'&&['customer.edit','product.edit','supplier.edit'].includes(v.permission);},
    async beginRequest(v){const entry=draft.journal[v.requestId];if(entry)return entry.operation===v.operation&&entry.actorId===v.actorId&&entry.payloadHash===v.payloadHash?{state:'REPLAY',response:entry.response}:{state:'CONFLICT'};draft.journal[v.requestId]={...v,response:null};return {state:'NEW'};},
    async insertCustomer(v){if(draft.rows.customers.some(r=>r.customerCode===v.customerCode))throw Error('duplicate');return add(draft,'customers',v);},
    async insertPartyEntity(v){return add(draft,'entities',v);},
    async attachCustomerEntity(v){if(failAt==='attach')throw Error('injected failure');if(failAt!=='attach-noop')draft.rows.customers.find(x=>x.id===v.customerId).entityId=v.entityId;},
    async insertCurrencyAccount(v){return add(draft,'accounts',v);},
    async insertSupplier(v){if(draft.rows.suppliers.some(r=>r.supplierCode===v.supplierCode))throw Error('duplicate');return add(draft,'suppliers',v);},
    async attachSupplierEntity(v){if(failAt==='supplier-attach')throw Error('injected');if(failAt!=='supplier-attach-noop')draft.rows.suppliers.find(x=>x.id===v.supplierId).entityId=v.entityId;},
    async insertSupplierCurrencyAccount(v){return add(draft,'accounts',v);},
    async readSupplierPersistence({supplierId,entityId,accountId}){const s=draft.rows.suppliers.find(v=>v.id===supplierId),e=draft.rows.entities.find(v=>v.id===entityId),a=draft.rows.accounts.find(v=>v.id===accountId);
     const value={supplier:{id:s.id,entityId:s.entityId,currency:s.currency,supplierCode:s.supplierCode,name:s.name,phone:s.phone,city:s.city,country:s.country,purchaseDiscountRateExact4:s.purchaseDiscountRateExact4,balanceExact4:'0.0000',isActive:true,isDeleted:false},entity:{id:e.id,role:e.role,name:e.name,country:e.country},account:{id:a.id,entityId:a.entityId,customerId:null,supplierId:a.supplierId,currency:a.currency,currentBalanceExact8:a.currentBalanceExact8}};
     if(failAt==='supplier-readback')value.account.supplierId='999';if(failAt==='supplier-status-drift')value.supplier.isActive=false;if(failAt==='supplier-balance-drift')value.supplier.balanceExact4='1.0000';return value;},
    async lockActiveSupplier({supplierId}){const s=draft.rows.suppliers.find(v=>v.id===supplierId);return s?{id:s.id,isActive:failAt!=='supplier-inactive',isDeleted:false}:null;},
    async findProductConflict({stockCode,barcode,additionalBarcodes=[]}){const codes=[barcode,...additionalBarcodes];return draft.rows.products.some(p=>p.stockCode===stockCode)?'PRODUCT_STOCK_CODE_IN_USE':new Set(codes.map(v=>v.toLocaleLowerCase('tr-TR'))).size!==codes.length?'PRODUCT_BARCODE_DUPLICATE_INPUT':draft.rows.barcodes.some(b=>codes.includes(b.barcode)&&b.isActive)?'PRODUCT_BARCODE_IN_USE':null;},
    async readCustomerPersistence({customerId,entityId,accountId}){
     const c=draft.rows.customers.find(v=>v.id===customerId),e=draft.rows.entities.find(v=>v.id===entityId),a=draft.rows.accounts.find(v=>v.id===accountId);
     const result={customer:{id:c.id,entityId:c.entityId,currency:c.currency,customerCode:c.customerCode,name:c.name,phone:c.phone,customerType:c.customerType,city:c.city,country:c.country},
      entity:{id:e.id,role:e.role,name:e.name,country:e.country},account:{id:a.id,entityId:a.entityId,customerId:a.customerId,supplierId:null,currency:a.currency,currentBalanceExact8:a.currentBalanceExact8}};
     if(failAt==='customer-entity-drift')result.entity.id='999';if(failAt==='customer-account-drift')result.account.customerId='999';return result;
    },
    async insertProduct(v){if(draft.rows.products.some(r=>r.stockCode===v.stockCode))throw Error('duplicate');return add(draft,'products',v);},
    async readRichProductFields({productId}){const p=draft.rows.products.find(v=>v.id===productId);return {brand:failAt==='rich-readback'?'wrong':p.brand,category:p.category,supplierId:p.supplierId};},
    async insertOpeningMovement(v){return add(draft,'openings',v);},
    async readOpeningMovement({productId,movementId}){const row=draft.rows.openings.find(v=>v.id===movementId&&v.productId===productId);return {id:row.id,productId:row.productId,actorId:row.actorId,quantityInExact3:row.quantityExact3,quantityOutExact3:'0.000',quantityNetExact3:row.quantityExact3,unitCostTryExact4:row.averageCostTryExact4,unitPriceExact4:row.unitPriceExact4,amountTryExact4:failAt==='opening-readback'?'99.0000':row.amountTryExact4,documentDate:row.documentDate,currency:'TRY',movementType:'in',sourceType:'stock_adjustment',sourceId:null,productMovementCount:'1'};},
    async insertLocalUnit(v){return add(draft,'units',v);},
    async readProductUnits({productId}){return draft.rows.units.filter(u=>u.productId===productId).map(u=>({...u,...(failAt==='series-unit-readback'&&!u.isMain?{productId:'999'}:{})}));},
    async insertBarcode(v){if(draft.rows.barcodes.some(r=>r.barcode===v.barcode))throw Error('duplicate');return add(draft,'barcodes',{...v,barcodeType:v.barcodeType??'primary',isPrimary:(v.barcodeType??'primary')==='primary',isActive:true});},
    async insertNativePrice(v){return add(draft,'prices',v);},
    async readProductSalePrices({productId}){const rows=draft.rows.prices.filter(p=>p.productId===productId).map(p=>({id:p.id,productId,unitId:draft.rows.links.find(l=>l.priceId===p.id)?.unitId??null,type:p.type,tier:p.tier,currency:p.currency,priceExact8:p.priceExact8}));const key={'extra-price-currency':'currency','extra-price-unit':'unitId','extra-price-parent':'productId','extra-price-value':'priceExact8','extra-price-tier':'tier'}[failAt];if(key)rows[1][key]=key==='tier'?2:'wrong';if(failAt==='extra-price-missing')rows.pop();if(failAt==='extra-price-duplicate')rows.push({...rows[1]});return rows;},
    async linkLocalPriceUnit(v){if(failAt!=='link-noop')add(draft,'links',v);},
    async readProductBarcodes({productId}){return draft.rows.barcodes.filter(b=>b.productId===productId&&b.isActive).map(b=>({id:b.id,productId,barcode:b.barcode,barcodeType:b.barcodeType,isPrimary:b.isPrimary,isActive:true})).map(b=>failAt==='extra-barcode-readback'?{...b,productId:'999'}:b);},
    async readProductPersistence({productId,unitId,barcodeId,priceId}){
     const p=draft.rows.products.find(v=>v.id===productId);
     const u=draft.rows.units.find(v=>v.id===unitId),b=draft.rows.barcodes.find(v=>v.id===barcodeId),q=draft.rows.prices.find(v=>v.id===priceId),l=draft.rows.links.find(v=>v.priceId===priceId);
     const row={product:{id:p.id,stockCode:p.stockCode,name:p.name,unit:p.unit,currency:p.currency,salePriceExact4:p.salePriceExact4,
      purchasePriceExact4:p.purchasePriceExact4,
      purchaseDiscountRateExact4:p.purchaseDiscountRateExact4,averageCostTryExact4:p.averageCostTryExact4,initialStockExact3:p.initialStockExact3},
      unit:{id:u.id,productId:u.productId,label:u.label,factorExact8:u.factorExact8,isMain:u.isMain},
      barcode:{id:b.id,productId:b.productId,barcode:b.barcode,isPrimary:b.isPrimary,isActive:b.isActive},
      price:{id:q.id,productId:q.productId,type:q.type,tier:q.tier,currency:q.currency,priceExact8:q.priceExact8,sourceUnitId:q.sourceUnitId},
      link:l?{productId:l.productId,unitId:l.unitId,priceId:l.priceId}:null};
     const changed={readback:'purchasePriceExact4','readback-cost':'averageCostTryExact4','readback-discount':'purchaseDiscountRateExact4',
      'readback-sale':'salePriceExact4','readback-currency':'currency','readback-unit':'unit'}[failAt];
     if(changed)row.product[changed]='wrong';
     if(failAt==='unit-drift')row.unit.productId='999';if(failAt==='barcode-drift')row.barcode.barcode='wrong';
     if(failAt==='price-drift')row.price.currency='TRY';if(failAt==='link-drift')row.link.unitId='999';return row;
    },
    async appendAudit(v){add(draft,'audit',v);},
    async readMasterAudit({requestId}){const a=draft.rows.audit.find(v=>v.requestId===requestId);if(failAt==='audit-readback')return null;const stockOpening=a.stockOpening?structuredClone(a.stockOpening):null;if(stockOpening&&failAt==='opening-audit-parent')stockOpening.productId='999';if(stockOpening&&failAt==='opening-audit-reason')stockOpening.reason='Başka gerekçe';return {requestId:a.requestId,actorId:a.actorId,operation:a.operation,entityId:a.entityId,...(stockOpening?{stockOpening}:{})};},
    async finishRequest(v){if(failAt==='journal')throw Error('injected failure');draft.journal[v.requestId].response=v.response;},
    async readFinishedRequest({requestId}){const j=draft.journal[requestId];if(failAt==='journal-readback')return null;return {requestId:j.requestId,operation:j.operation,actorId:j.actorId,payloadHash:j.payloadHash,response:j.response};},
   };
   const result=await work(tx);state=draft;if(loseCommit){loseCommit=false;throw Error('commit acknowledgement lost');}return result;
  },
 };
}
const system=s=>createLocalMasterTransactions({store:s,authorize:async()=>true});
const supplier=()=>({requestId:'12171000-6f42-4f19-8cab-9f4539618647',supplierCode:'T1',name:'Tedarik',phone:'555',city:'İstanbul',country:'Türkiye',currency:'TRY',purchaseDiscountRateExact4:'12.5000'});
const rich=s=>createLocalMasterTransactions({store:s,authorize:async()=>true,richCards:true});

test('three explicit sale prices and unit links commit atomically; a lost reply and changed-body UUID never duplicate or reprice',async()=>{
 const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id;
 const p={...product(),unit:'ADET',currency:'TRY',saleTier:null,brand:'B',category:'C',supplierId,additionalSalePrices:[{currency:'USD',priceExact4:'0.7500'},{currency:'EUR',priceExact4:'0.6000'}]};
 s.loseCommit();assert.equal((await svc.createProduct('7',p)).state,'UNKNOWN');const before=s.snapshot(),retry=await svc.createProduct('7',p);
 assert.equal(retry.state,'COMMITTED');assert.equal(retry.replayed,true);assert.deepEqual(retry.entity.prices.map(q=>[q.currency,q.priceExact8]),[['TRY','12.25000000'],['USD','0.75000000'],['EUR','0.60000000']]);assert.equal(new Set(retry.entity.prices.map(q=>q.unitId)).size,1);
 assert.equal((await svc.createProduct('7',{...p,additionalSalePrices:[{currency:'USD',priceExact4:'0.7600'}]})).state,'UNKNOWN');assert.deepEqual(s.snapshot(),before);assert.equal(before.rows.products[0].averageCostTryExact4,'4.3750');assert.equal(before.rows.openings.length,0);
});
test('every additional price/link readback corruption rolls back all new product rows and journal',async()=>{
 for(const fault of ['extra-price-currency','extra-price-unit','extra-price-parent','extra-price-value','extra-price-tier','extra-price-missing','extra-price-duplicate','prices','links']){
  const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id,before=s.snapshot();s.failAt(fault);
  const result=await svc.createProduct('7',{...product(),unit:'ADET',currency:'TRY',saleTier:null,brand:'B',category:'C',supplierId,additionalSalePrices:[{currency:'USD',priceExact4:'0.7500'},{currency:'EUR',priceExact4:'0.6000'}]});assert.equal(result.state,'UNKNOWN',fault);assert.deepEqual(s.snapshot(),before,fault);
 }
});
test('series creates a secondary multiplier while base stock and price stay ADET and exact replay stays immutable',async()=>{
 const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id,p={...product(),unit:'ADET',currency:'TRY',purchaseDiscountRateExact4:'0.0000',brand:'B',category:'C',supplierId,seriesFactorExact8:'6.00000000',openingQuantityExact3:'60.000',openingDate:'2026-11-06',openingReason:'Yeni TEST seri stoğu'};
 s.loseCommit();assert.equal((await svc.createProduct('7',p)).state,'UNKNOWN');const before=s.snapshot(),replay=await svc.createProduct('7',p);assert.equal(replay.replayed,true);assert.equal(replay.entity.units.length,2);assert.deepEqual(replay.entity.units.map(u=>[u.label,u.factorExact8,u.isMain]),[['ADET','1.00000000',true],['SERİ','6.00000000',false]]);assert.equal(replay.entity.prices.length,1);assert.equal(replay.entity.prices[0].unitId,replay.entity.units[0].id);assert.equal(before.rows.products[0].initialStockExact3,'60.000');assert.equal(before.rows.openings.length,1);assert.deepEqual(s.snapshot(),before);assert.equal((await svc.createProduct('7',{...p,seriesFactorExact8:'7.00000000'})).state,'UNKNOWN');assert.deepEqual(s.snapshot(),before);
 for(const factor of ['1.00000000','6.5','0.00000000','1000001.00000000']){const invalid=memoryStore();assert.equal((await rich(invalid).createProduct('7',{...p,seriesFactorExact8:factor})).state,'UNKNOWN');assert.equal(invalid.calls(),0);}
});
test('foreign secondary unit readback rolls back every series product row',async()=>{const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id,before=s.snapshot();s.failAt('series-unit-readback');const result=await svc.createProduct('7',{...product(),unit:'ADET',currency:'TRY',brand:'B',category:'C',supplierId,seriesFactorExact8:'6.00000000'});assert.equal(result.state,'UNKNOWN');assert.deepEqual(s.snapshot(),before);});
test('opening reason is bound to movement, actor and request in the same atomic audit; replay adds no effects',async()=>{
 const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id;
 const p={...product(),unit:'ADET',currency:'TRY',purchaseDiscountRateExact4:'0.0000',brand:'B',category:'C',supplierId,openingQuantityExact3:'2.000',openingDate:'2026-11-06',openingReason:'Yeni ürünün sayılmış başlangıç stoğu'};
 s.loseCommit();assert.equal((await svc.createProduct('7',p)).state,'UNKNOWN');const before=s.snapshot(),audit=before.rows.audit.find(a=>a.stockOpening),movement=before.rows.openings[0];assert.equal(audit.stockOpening.movementId,movement.id);assert.equal(audit.stockOpening.actorId,'7');assert.equal(audit.stockOpening.requestId,p.requestId);assert.equal(audit.stockOpening.reason,p.openingReason);assert.equal(audit.stockOpening.quantityExact3,'2.000');assert.equal(audit.stockOpening.amountTryExact4,'10.0000');
 assert.equal((await svc.createProduct('7',p)).replayed,true);assert.deepEqual(s.snapshot(),before);assert.equal((await svc.createProduct('7',{...p,openingReason:'Değişmiş gerekçe'})).state,'UNKNOWN');assert.deepEqual(s.snapshot(),before);
 for(const reason of ['', ' x','x\n','x'.repeat(251)]){const fresh=memoryStore();assert.equal((await rich(fresh).createProduct('7',{...p,openingReason:reason})).state,'UNKNOWN');assert.equal(fresh.calls(),0);}
 assert.equal((await svc.createProduct('7',{...p,openingQuantityExact3:'0.000'})).state,'UNKNOWN');assert.deepEqual(s.snapshot(),before);
});
test('opening audit readback mismatch rolls back product, opening and every related row',async()=>{
 for(const fault of ['opening-audit-parent','opening-audit-reason','audit','audit-readback']){const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id,before=s.snapshot();s.failAt(fault);assert.equal((await svc.createProduct('7',{...product(),unit:'ADET',currency:'TRY',purchaseDiscountRateExact4:'0.0000',brand:'B',category:'C',supplierId,openingQuantityExact3:'2.000',openingDate:'2026-11-06',openingReason:'Yeni ürün açılışı'})).state,'UNKNOWN');assert.deepEqual(s.snapshot(),before,fault);}
});
test('legacy fresh rich opening keeps its original body hash and gets an explicit creation reason; committed replay is unchanged',async()=>{
 const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id,p={...product(),unit:'ADET',currency:'TRY',purchaseDiscountRateExact4:'0.0000',brand:'B',category:'C',supplierId,openingQuantityExact3:'2.000',openingDate:'2026-11-06'};const body=JSON.stringify(p),result=await svc.createProduct('7',p);assert.equal(result.state,'COMMITTED');assert.equal(JSON.stringify(p),body);const before=s.snapshot();assert.equal(before.rows.audit.find(a=>a.stockOpening).stockOpening.reason,'Yeni ürün kartı başlangıç stok girişi');assert.equal((await svc.createProduct('7',p)).replayed,true);assert.deepEqual(s.snapshot(),before);
});

test('main and extra barcode strings commit with one product and replay without duplicate rows',async()=>{
 const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id;
 const p={...product(),brand:'B',category:'C',supplierId,additionalBarcodes:['000000000051','000000000052']};
 const result=await svc.createProduct('7',p);assert.equal(result.state,'COMMITTED');const before=s.snapshot();assert.equal(before.rows.products.length,1);
 assert.deepEqual(before.rows.barcodes.map(b=>b.barcode),[p.barcode,...p.additionalBarcodes]);assert.deepEqual(before.rows.barcodes.map(b=>b.isPrimary),[true,false,false]);assert.ok(before.rows.barcodes.every(b=>b.productId===result.entity.id));
 assert.equal((await svc.createProduct('7',p)).replayed,true);assert.deepEqual(s.snapshot(),before);
 assert.equal((await svc.createProduct('7',{...p,additionalBarcodes:[...p.additionalBarcodes].reverse()})).state,'UNKNOWN');assert.deepEqual(s.snapshot(),before);
 const conflict=await svc.createProduct('7',{...p,requestId:'c1a71000-6f42-4f19-8cab-9f4539618647',stockCode:'P2',barcode:'0009',additionalBarcodes:['000000000052']});assert.equal(conflict.state,'NOT_COMMITTED');assert.equal(conflict.reason,'PRODUCT_BARCODE_IN_USE');assert.deepEqual(s.snapshot().rows,before.rows);
});

test('extra barcode readback drift rolls back every product-linked row and its journal',async()=>{
 const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id,before=s.snapshot();s.failAt('extra-barcode-readback');
 assert.equal((await svc.createProduct('7',{...product(),brand:'B',category:'C',supplierId,additionalBarcodes:['0005']})).state,'UNKNOWN');assert.deepEqual(s.snapshot(),before);
});

test('durable rich product conflict survives a lost reply; old commit and changed-body UUID keep their outcomes',async()=>{
 const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id;
 const first={...product(),brand:'B',category:'C',supplierId};assert.equal((await svc.createProduct('7',first)).state,'COMMITTED');
 const rows=s.snapshot().rows,second={...first,requestId:'c1a71000-6f42-4f19-8cab-9f4539618647',stockCode:'P2'};
 s.loseCommit();assert.equal((await svc.createProduct('7',second)).state,'UNKNOWN');
 const after=s.snapshot();assert.deepEqual(after.rows,rows);assert.equal(after.journal[second.requestId].response.reason,'PRODUCT_BARCODE_IN_USE');
 const replay=await svc.createProduct('7',second);assert.equal(replay.state,'NOT_COMMITTED');assert.equal(replay.resolution,'DURABLE_REJECTION');assert.equal(replay.replayed,true);
 assert.equal((await svc.createProduct('7',{...second,barcode:'fixed'})).state,'UNKNOWN');
 assert.equal((await svc.createProduct('7',first)).state,'COMMITTED');assert.deepEqual(s.snapshot(),after);
 const noAuth=createLocalMasterTransactions({store:s,richCards:true,authorize:async()=>false});assert.equal((await noAuth.createProduct('7',second)).state,'UNKNOWN');
});

test('stock code conflict writes only its rejection and does not create a second product',async()=>{
 const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id,p={...product(),brand:'B',category:'C',supplierId};
 await svc.createProduct('7',p);const before=s.snapshot().rows;
 const result=await svc.createProduct('7',{...p,requestId:'c1a71000-6f42-4f19-8cab-9f4539618647',barcode:'different'});
 assert.equal(result.state,'NOT_COMMITTED');assert.equal(result.reason,'PRODUCT_STOCK_CODE_IN_USE');assert.equal(result.replayed,false);assert.deepEqual(s.snapshot().rows,before);
});
test('v3 creates supplier entity and currency account once, then binds rich product to the active supplier',async()=>{
 const s=memoryStore(),svc=rich(s),input=supplier();s.loseCommit();assert.equal((await svc.createSupplier('7',input)).state,'UNKNOWN');const replay=await svc.createSupplier('7',input);assert.equal(replay.state,'COMMITTED');assert.equal(replay.replayed,true);
 assert.equal(replay.entity.kind,'local');assert.equal(replay.entity.accounts[0].supplierId,replay.entity.id);assert.equal(Object.hasOwn(replay.entity.accounts[0],'customerId'),false);
 assert.equal((await svc.createSupplier('7',{...input,name:'Farklı'})).state,'UNKNOWN');
 const p={...product(),brand:'Marka',category:'Takım',supplierId:replay.entity.id};assert.equal((await svc.createProduct('7',p)).state,'COMMITTED');const state=s.snapshot();assert.equal(state.rows.suppliers.length,1);assert.equal(state.rows.products[0].supplierId,replay.entity.id);assert.equal(state.rows.products[0].brand,'Marka');assert.equal(state.rows.products[0].category,'Takım');
});
test('v3 requires locations and complete rich product fields; supplier failures and inactive supplier roll back',async()=>{
 for(const failure of ['suppliers','entities','supplier-attach','supplier-attach-noop','accounts','supplier-readback','supplier-status-drift','supplier-balance-drift','audit','journal-readback']){const s=memoryStore();s.failAt(failure);assert.equal((await rich(s).createSupplier('7',supplier())).state,'UNKNOWN',failure);assert.equal(Object.keys(s.snapshot().journal).length,0);assert.ok(Object.values(s.snapshot().rows).every(x=>x.length===0));}
 const s=memoryStore(),svc=rich(s),supplierId=(await svc.createSupplier('7',supplier())).entity.id,before=s.snapshot();for(const failure of ['supplier-inactive','rich-readback']){s.failAt(failure);assert.equal((await svc.createProduct('7',{...product(),brand:'B',category:'C',supplierId})).state,'UNKNOWN');assert.deepEqual(s.snapshot(),before);}s.failAt(null);
 for(const body of [{...customer(),city:'',country:'TR'},{...customer(),city:'İzmir',country:null}])assert.equal((await svc.createCustomer('7',body)).state,'UNKNOWN');
 assert.equal((await svc.createProduct('7',{...product(),brand:'B'})).state,'UNKNOWN');assert.deepEqual(s.snapshot(),before);
 assert.throws(()=>createLocalMasterTransactions({store:s,authorize:async()=>true,richCards:'true'}));
});
test('v3 replays matching committed v2 bodies without creating new legacy records',async()=>{
 for(const [method,body] of [['createCustomer',customer()],['createProduct',product()]]){const s=memoryStore(),old=system(s),current=rich(s);assert.equal((await old[method]('7',body)).state,'COMMITTED');const before=s.snapshot();const replay=await current[method]('7',body);assert.equal(replay.state,'COMMITTED');assert.equal(replay.replayed,true);assert.deepEqual(s.snapshot(),before);
  const fresh={...body,requestId:'c1a71000-6f42-4f19-8cab-9f4539618647'};assert.equal((await current[method]('7',fresh)).state,'UNKNOWN');assert.deepEqual(s.snapshot(),before);
 }
});
test('customer and product commit their linked rows and journal once, preserving chosen units and currencies',async()=>{
 const s=memoryStore(),service=system(s),c=await service.createCustomer('7',customer()),p=await service.createProduct('7',product()),st=s.snapshot();
 assert.equal(c.state,'COMMITTED');assert.equal(c.entity.selectedCurrency,'EUR');
 assert.equal(st.rows.customers[0].entityId,st.rows.entities[0].id);assert.equal(st.rows.accounts[0].customerId,c.entity.id);
 assert.equal(st.rows.accounts[0].currentBalanceExact8,'0.00000000');
 assert.equal(p.state,'COMMITTED');assert.equal(p.entity.units[0].label,'METRE');assert.equal(p.entity.prices[0].currency,'USD');
 assert.equal(st.rows.prices[0].sourceUnitId,null);assert.equal(st.rows.links[0].unitId,p.entity.units[0].id);
 assert.equal(st.rows.products[0].purchasePriceExact4,'5.0000');assert.equal(st.rows.products[0].purchaseDiscountRateExact4,'12.5000');
 assert.equal(st.rows.products[0].averageCostTryExact4,'0.0000');
 assert.equal(st.rows.products[0].initialStockExact3,'0.000');assert.equal(st.rows.audit.length,2);assert.equal(Object.keys(st.journal).length,2);
 assert.equal(LOCAL_MASTER_TRANSACTION_LIMITS.sqlAdapterImplemented,false);assert.equal(LOCAL_MASTER_TRANSACTION_LIMITS.realErpComplete,false);
});
test('customer locations are normalized, persisted and covered by the same request identity',async()=>{
 const s=memoryStore(),service=system(s),input={...customer(),city:'  Yalova  ',country:' Türkiye '};
 assert.equal((await service.createCustomer('7',input)).state,'COMMITTED');
 const state=s.snapshot();assert.equal(state.rows.customers[0].city,'Yalova');assert.equal(state.rows.customers[0].country,'Türkiye');
 assert.equal(state.rows.entities[0].country,'Türkiye');
 assert.equal((await service.createCustomer('7',{...input,city:'Yalova',country:'Türkiye'})).replayed,true);
 assert.equal((await service.createCustomer('7',{...input,city:'Bursa'})).state,'UNKNOWN');
 const another=memoryStore(),svc=system(another);
 assert.equal((await svc.createCustomer('7',{...customer(),city:'  ',country:null})).state,'COMMITTED');
 assert.equal(another.snapshot().rows.customers[0].city,null);
 const bad=memoryStore();assert.equal((await system(bad).createCustomer('7',{...customer(),city:'Yalova\n'})).state,'UNKNOWN');assert.equal(bad.calls(),0);
});
test('every interrupted customer and product transaction returns UNKNOWN and leaves no partial rows',async()=>{
 for(const [payload,method,failures] of [[customer,'createCustomer',['authority','customers','entities','attach','attach-noop','accounts','customer-entity-drift','customer-account-drift','audit','audit-readback','journal','journal-readback']],
  [product,'createProduct',['authority','products','units','barcodes','prices','links','link-noop','unit-drift','barcode-drift','price-drift','link-drift','readback','readback-cost','readback-discount','readback-sale','readback-currency','readback-unit','audit','audit-readback','journal','journal-readback']]])for(const stage of failures){
  const s=memoryStore();s.failAt(stage);const result=await system(s)[method]('7',payload());
  assert.equal(result.state,'UNKNOWN',stage);assert.equal(result.retry,'SAME_REQUEST_ONLY');
  assert.equal(Object.keys(s.snapshot().journal).length,0,stage);assert.ok(Object.values(s.snapshot().rows).every(rows=>rows.length===0),stage);
 }
});
test('lost commit acknowledgement recovers same UUID and body; changed body cannot create a duplicate',async()=>{
 for(const [make,method,table,related] of [[product,'createProduct','products','prices'],[customer,'createCustomer','customers','accounts']]){
  const s=memoryStore(),service=system(s);s.loseCommit();const body=make();
  const first=await service[method]('7',body);assert.equal(first.state,'UNKNOWN');assert.equal(first.requestId,body.requestId);
  const replay=await service[method]('7',body);assert.equal(replay.state,'COMMITTED');assert.equal(replay.replayed,true);
  const changed=await service[method]('7',{...body,name:'Başka'});assert.equal(changed.state,'UNKNOWN');
  const otherActor=await service[method]('8',body);assert.equal(otherActor.state,'UNKNOWN');
  const st=s.snapshot();assert.equal(st.rows[table].length,1);assert.equal(st.rows[related].length,1);assert.equal(st.rows.audit.length,1);
 }
});
test('invalid and unauthorized replay cannot claim an earlier request was rejected',async()=>{
 const s=memoryStore(),service=system(s),noAccess=createLocalMasterTransactions({store:s,authorize:async()=>false});
 for(const v of [{...product(),currency:''},{...product(),unit:''},{...product(),salePriceExact4:'1.23456'},
  {...product(),purchaseDiscountRateExact4:'100.0001'}])assert.equal((await service.createProduct('7',v)).state,'UNKNOWN');
 await assert.rejects(service.createProduct('7',{...product(),requestId:'bad'}),{code:'LOCAL_MASTER_INPUT_INVALID'});
 assert.equal((await noAccess.createCustomer('7',customer())).state,'UNKNOWN');assert.equal(s.calls(),0);
});
test('TRY cost follows PR54 decimal parity, rejecting binary rounding disagreement',async()=>{
 const s=memoryStore(),body={...product(),currency:'TRY',purchasePriceExact4:'10.0000',purchaseDiscountRateExact4:'0.0000'};
 assert.equal((await system(s).createProduct('7',body)).state,'COMMITTED');
 assert.equal(s.snapshot().rows.products[0].averageCostTryExact4,'10.0000');
 for(const [purchase,discount] of [['0.0750','0.6000'],['0.0003','50.0000']]){const other=memoryStore();assert.equal((await system(other).createProduct('7',{...body,purchasePriceExact4:purchase,purchaseDiscountRateExact4:discount})).state,'UNKNOWN');assert.equal(other.calls(),0);}
 const common=memoryStore();assert.equal((await system(common).createProduct('7',{...body,purchasePriceExact4:'5.3000'})).state,'COMMITTED');assert.equal(common.snapshot().rows.products[0].averageCostTryExact4,'5.3000');
 const discounted=memoryStore();assert.equal((await system(discounted).createProduct('7',{...body,purchasePriceExact4:'0.0750',purchaseDiscountRateExact4:'12.5000'})).state,'COMMITTED');assert.equal(discounted.snapshot().rows.products[0].averageCostTryExact4,'0.0656');
 const exact=memoryStore();assert.equal((await system(exact).createProduct('7',{...body,purchasePriceExact4:'0.0625'})).state,'COMMITTED');
 const full=memoryStore();assert.equal((await system(full).createProduct('7',{...body,purchaseDiscountRateExact4:'100.0000'})).state,'COMMITTED');assert.equal(full.snapshot().rows.products[0].averageCostTryExact4,'0.0000');
 const invalid={...body,purchaseDiscountRateExact4:undefined};assert.equal((await system(memoryStore()).createProduct('7',invalid)).state,'UNKNOWN');
});
test('permission loss after an unknown commit remains UNKNOWN until authorized recovery',async()=>{
 const s=memoryStore(),service=system(s),body=customer();s.loseCommit();
 assert.equal((await service.createCustomer('7',body)).state,'UNKNOWN');
 const noAccess=createLocalMasterTransactions({store:s,authorize:async()=>false});
 assert.equal((await noAccess.createCustomer('7',body)).state,'UNKNOWN');
 s.failAt('authority');assert.equal((await service.createCustomer('7',body)).state,'UNKNOWN');
 s.failAt(null);const recovered=await service.createCustomer('7',body);assert.equal(recovered.state,'COMMITTED');assert.equal(recovered.replayed,true);
 assert.equal(s.snapshot().rows.customers.length,1);
});
test('product opening stock is one traced native-shaped movement in the product request transaction',async()=>{
 const s=memoryStore(),service=system(s),body={...product(),unit:'ADET',currency:'TRY',purchasePriceExact4:'5.3000',purchaseDiscountRateExact4:'0.0000',openingQuantityExact3:'4.000',openingDate:'2026-11-05'};
 s.loseCommit();assert.equal((await service.createProduct('7',body)).state,'UNKNOWN');assert.equal(s.snapshot().rows.products[0].initialStockExact3,'4.000');assert.equal(s.snapshot().rows.openings[0].amountTryExact4,'21.2000');
 assert.equal((await service.createProduct('7',body)).replayed,true);assert.equal(s.snapshot().rows.openings.length,1);
 const broken=memoryStore();broken.failAt('opening-readback');assert.equal((await system(broken).createProduct('7',body)).state,'UNKNOWN');assert.equal(broken.snapshot().rows.products.length,0);assert.equal(broken.snapshot().rows.openings.length,0);
 for(const change of [{openingQuantityExact3:'-1.000'},{openingDate:'2026-02-30'},{currency:'USD'},{unit:'METRE'},{purchasePriceExact4:'0.0000'}]){const other=memoryStore();assert.equal((await system(other).createProduct('7',{...body,...change})).state,'UNKNOWN');assert.equal(other.snapshot().rows.products.length,0);}
});
