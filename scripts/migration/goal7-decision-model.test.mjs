import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCaptureRows,payloadHash,classifySourceRecord,classifyStockEffect,preserveLocalEffects,sourceAccountDirection,validateCaptureIdentity} from './goal7-decision-model.mjs';
const product={sourceId:1,stockCode:'0007',isActive:true,quantity:'10.000',unitStatus:'VERIFIED_ADET_FACTOR_1',prices:[{price:'8.55000000',currency:'USD'}],purchasePrice:{price:null,currency:null},averageCostTry:null};
const facts={sourceIdentityVerified:true,sourceCodeOwners:1,nativeOwners:1,nativeBeforeImageVerified:true,localMovementsReconciled:true,readerVersionReady:true};
test('source identity and literal leading-zero values survive comparable frozen/current database keys',()=>{
 const old={...product,sourceKey:'FROZEN/F0102/1'},now={...product,sourceKey:'VEGA2026/F0102/1'};
 assert.equal(payloadHash(old),payloadHash(now));assert.equal(compareCaptureRows([old],[now],p=>String(p.sourceId))[0].change,'UNCHANGED');
 assert.equal(compareCaptureRows([old],[{...now,stockCode:'007'}],p=>String(p.sourceId))[0].change,'CHANGED');
 assert.throws(()=>compareCaptureRows([], [now,now],p=>p.sourceId),/DUPLICATE_SOURCE/);
});
test('NULL cost stays unknown while existing source identity and known stock are independently usable',()=>{
 const r=classifySourceRecord({entity:'product',record:product,facts});assert.equal(r.classification,'GREEN');assert.equal(r.applyReady,true);assert.ok(r.notes.includes('COST_REMAINS_NULL_NO_PRICE_FALLBACK'));
 assert.throws(()=>preserveLocalEffects(null,['0']),/UNKNOWN_NOT_ZERO/);
});
test('native identity collisions, wrong barcode ownership, unrepresentable and negative stock reject',()=>{
 for(const change of [{nativeOwners:2},{nativeWrongOwner:true},{barcodeWrongOwner:true},{sourceCodeOwners:2},{nativeBeforeImageVerified:false}])assert.equal(classifySourceRecord({entity:'product',record:product,facts:{...facts,...change}}).classification,'RED');
 for(const quantity of ['-1.000','0.0001'])assert.equal(classifySourceRecord({entity:'product',record:{...product,quantity},facts}).classification,'RED');
});
test('holds, ambiguous barcode and unit, LL and local cost conflict need human decision without bypassing provenance',()=>{
 for(const change of [{hold:true},{barcodeMultipleOwners:true},{specialCard:true},{localCostConflict:true},{localMovementsReconciled:false}])assert.equal(classifySourceRecord({entity:'product',record:product,facts:{...facts,...change}}).classification,'YELLOW');
 assert.equal(classifySourceRecord({entity:'product',record:{...product,unitStatus:'REVIEW'},facts}).classification,'YELLOW');
 assert.equal(classifySourceRecord({entity:'product',record:{...product,prices:[{price:'3',currency:null,currencyRaw:'LL'}]},facts}).classification,'YELLOW');
 const r=classifySourceRecord({entity:'product',record:product,facts:{...facts,readerVersionReady:false}});assert.equal(r.classification,'GREEN');assert.equal(r.applyReady,false);assert.deepEqual(r.applicationBlockers,['IMMUTABLE_DELTA_READER_VERSION_REQUIRED']);
});
test('party account consistency, sign and currency are explicit; customer and supplier signs differ',()=>{
 const record={role:'supplier',company:'F0103',isActive:true,currency:'USD',nativeBalanceMapped:'4500',accounts:[{currency:'USD',nativeBalanceMapped:'4500'}]};const safe={...facts,signProven:true,cardFxConsistent:true,accountOwnershipVerified:true};
 assert.equal(classifySourceRecord({entity:'party',record,facts:safe}).classification,'GREEN');
 for(const patch of [{currency:'LL'},{nativeBalanceMapped:null},{accounts:[{currency:'EUR',nativeBalanceMapped:null}]}])assert.equal(classifySourceRecord({entity:'party',record:{...record,...patch},facts:safe}).classification,'YELLOW');
 for(const f of ['signProven','cardFxConsistent','accountOwnershipVerified'])assert.equal(classifySourceRecord({entity:'party',record,facts:{...safe,[f]:false}}).classification,'YELLOW');
 assert.equal(sourceAccountDirection('customer','3200',true),'Müşteri bize borçlu');assert.equal(sourceAccountDirection('supplier','-85000',true),'Tedarikçiye borçluyuz');assert.equal(sourceAccountDirection('supplier','-85000',false),'Yön doğrulanmadı');
});
test('unrecognized purchase currency, negative prices and malformed quantities never become safe',()=>{
 for(const change of [{purchasePrice:{price:null,currency:null,currencyRaw:'LL',foreign:'100'}},{prices:[{price:'-1',currency:'USD'}]},{quantity:'BROKEN'},{isActive:undefined}])assert.notEqual(classifySourceRecord({entity:'product',record:{...product,...change},facts}).classification,'GREEN');
 const party={role:'customer',company:'F0103',isActive:true,currency:'TRY',nativeBalanceMapped:'0',accounts:[{currency:'TRY',nativeBalanceMapped:'0'},{currency:'TRY',nativeBalanceMapped:'0'}]};
 assert.equal(classifySourceRecord({entity:'party',record:party,facts:{...facts,signProven:true,cardFxConsistent:true,accountOwnershipVerified:true}}).classification,'RED');
 const removed=compareCaptureRows([{sourceId:1,field:'x'}],[{sourceId:1}],p=>p.sourceId)[0];assert.deepEqual(removed.changedFields,['field']);
});
test('unused empty price tiers do not create fictitious financial ambiguity',()=>{
 assert.equal(classifySourceRecord({entity:'product',record:{...product,prices:[{price:null,currency:null,currencyRaw:null}]},facts}).classification,'GREEN');
 assert.equal(classifySourceRecord({entity:'product',record:{...product,prices:[{price:null,currency:'USD',currencyRaw:'USD'}]},facts}).classification,'YELLOW');
});
test('stock atoms isolate price/cost ambiguity but cannot bypass physical identity or hold',()=>{
 const record={...product,prices:[{price:'1',currency:null,currencyRaw:'LL'}]};
 assert.equal(classifySourceRecord({entity:'product',record,facts}).classification,'YELLOW');
 assert.equal(classifyStockEffect({record,facts:{...facts,localCostConflict:true}}).classification,'GREEN');
 assert.equal(classifyStockEffect({record,facts:{...facts,hold:true}}).classification,'YELLOW');
 assert.equal(classifyStockEffect({record,facts:{...facts,nativeOwners:0,nativeCreationChecked:true}}).classification,'RED');
});
test('later local exact effects survive source-base change; different currencies are never summed here',()=>{
 assert.equal(preserveLocalEffects('10.00000000',['-2.00000000','0.12500000']),'8.12500000');
 assert.equal(preserveLocalEffects('9007199254740993.00000000',['0.00000001']),'9007199254740993.00000001');
});
test('changed capture hash, wrong and LIVE databases fail before planning',()=>{
 const m={sourceSELECTOnly:true,twoPassStable:true,source:{server:'DESKTOP-KSRK0EQ',database:'VEGA2026'}};
 assert.doesNotThrow(()=>validateCaptureIdentity(m,'a','a'));assert.throws(()=>validateCaptureIdentity(m,'a','b'),/HASH_CHANGED/);
 for(const database of ['LIVE','MELISA_ERP_LIVE','wrong'])assert.throws(()=>validateCaptureIdentity({...m,source:{...m.source,database}},'a','a'),/WRONG_SOURCE_DATABASE/);
});
