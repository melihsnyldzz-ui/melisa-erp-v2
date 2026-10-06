import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceNativeMutations,nativeGuardBranch,temporaryNativeWrapper,restoreNativeGuard,insertRepresentationDiagnostic,nativeSqlType,validateNativeGuards,executeNative,replayBindingProofSql} from './goal7-source-native.mjs';
import {sourcePriceDelta,sourceNativeCost,SOURCE_VERSION_TABLES,SOURCE_VERSION_PRODUCT_FIELDS} from './goal7-source-version.mjs';
import {sqlJsonHash} from './goal7-test-delta.mjs';
const contract={runId:'GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d',sourceHash:'a'.repeat(64),stockHandledSeparately:true,actorId:'16',documentDate:'2026-10-07'};
const source=(patch={})=>({sourceKey:'VEGA2026/F0102/TBLSTOKLAR/10',sourceId:'10',stockCode:'EXPLICIT-TEST',name:'Fixture',brand:null,category:null,isActive:true,quantity:'2.00000000',unit:'ADET',unitStatus:'VERIFIED_ADET_FACTOR_1',unitFactor:'1.00000000',mainUnitSourceId:'100',prices:[{unitSourceId:'100',tier:1,currency:'USD',price:'10.12345678'}],purchasePrice:{currency:'USD',price:'8.12345678'},barcodes:[{barcode:'9911111111111'}],averageCostTry:null,...patch}); // Public source identity in synthetic fixture; gitleaks:allow
const before={id:42,stock_code:'EXPLICIT-TEST',name:'Fixture',brand:null,category:null,unit:'ADET',currency_code:'USD',sales_price:10.1235,purchase_price:8.1235,average_cost_try:19.4321,current_stock_qty:8.125,source_record_key:'VEGA2026/F0102TBLSTOKLAR/10'}; // Public source identity in synthetic fixture; gitleaks:allow
const evidence=()=>({productScalars:[{id:'42',sales_price:'10.1235',purchase_price:'8.1235'}],beforeImages:[{table:'products',id:'42',before_json:JSON.stringify(before),before_hash:sqlJsonHash(JSON.stringify(before))}],priceTuples:[],barcodeOwners:[{id:'43',product_id:'42',barcode:'9911111111111',is_active:true}]});
test('existing master change preserves native cost, scalar stock, provenance and local movement effects',()=>{
 const p=source({name:'Renamed',quantity:'5.00000000',averageCostTry:'90.00000000'}),rows=sourceNativeMutations([{change:'CHANGED',nativeId:'42',sourceKey:p.sourceKey,afterSource:p,masterFields:['name'],prices:[],cost:sourceNativeCost(p,{existing:true})}],evidence(),contract);
 assert.equal(rows.length,1);assert.deepEqual(rows[0].fields,{name:'Renamed'});assert.equal(rows[0].beforeImageJSON,JSON.stringify(before));assert.equal(rows.some(r=>r.table==='stock_movements'),false);
});
test('new unknown cost stays NULL and has exactly one opening with separate source lineage',()=>{
 const p=source(),rows=sourceNativeMutations([{change:'NEW',nativeId:null,sourceKey:p.sourceKey,afterSource:p,masterFields:[],prices:[],cost:sourceNativeCost(p)}],{beforeImages:[],priceTuples:[],barcodeOwners:[]},contract);
 assert.equal(rows.find(r=>r.table==='products').fields.average_cost_try,null);assert.equal(rows.find(r=>r.table==='stock_movements').fields.unit_cost_try,null);assert.equal(rows.filter(r=>r.table==='stock_movements').length,1);assert.equal(rows.find(r=>r.table==='products').fields.current_stock_qty,'2.000');assert.equal(rows.some(r=>Object.hasOwn(r.fields,'id')),false);
});
test('source negative quantity and a non-ADET factor are rejected before mutations',()=>{
 for(const p of [source({quantity:'-1.00000000'}),source({unitFactor:'12.00000000'})])assert.throws(()=>sourceNativeMutations([{change:'NEW',nativeId:null,sourceKey:p.sourceKey,afterSource:p,cost:{value:null},prices:[]}],{beforeImages:[],priceTuples:[],barcodeOwners:[]},contract),/SOURCE_NATIVE_UNIT_STOCK/);
});
test('typed native prices update exact eight places and reject a local price conflict',()=>{
 const old=source(),p=source({prices:[{unitSourceId:'100',tier:1,currency:'USD',price:'11.12345678'}]}),ev=evidence();ev.priceTuples=[{id:'66',product_id:'42',price_type:'sale',price_tier:1,currency_code:'USD',source_unit_id:100,price:'10.12345678'}];ev.beforeImages.push({table:'product_prices',id:'66',before_json:'{"id":66,"price":10.12345678}',before_hash:sqlJsonHash('{"id":66,"price":10.12345678}')});
 const changes=[{change:'CHANGED',nativeId:'42',sourceKey:p.sourceKey,afterSource:p,masterFields:[],prices:sourcePriceDelta(old,p),cost:sourceNativeCost(p,{existing:true})}];const rows=sourceNativeMutations(changes,ev,contract);assert.deepEqual(rows.find(r=>r.table==='product_prices').fields,{price:'11.12345678'});
 ev.priceTuples[0].price='9.00000000';assert.throws(()=>sourceNativeMutations(changes,ev,contract),/LOCAL_PRICE_CONFLICT/);
});
test('barcode ownership cannot be moved from another product or reactivate an inactive record',()=>{
 const p=source(),c={change:'CHANGED',nativeId:'42',sourceKey:p.sourceKey,afterSource:p,masterFields:[],prices:[],cost:{value:null}};
 const wrong=evidence();wrong.barcodeOwners[0].product_id='99';assert.throws(()=>sourceNativeMutations([c],wrong,contract),/BARCODE_WRONG_OWNER/);
 const ev=evidence();ev.barcodeOwners[0].is_active=false;assert.throws(()=>sourceNativeMutations([c],ev,contract),/INACTIVE_BARCODE/);
});
test('guard extension is bound to staged exact rows, plan hash and temporary guard body hashes',()=>{
 const columns=[{name:'id',type:'bigint',is_identity:true},{name:'price',type:'decimal',precision:28,scale:8},{name:'source_payload_json',type:'nvarchar',max_length:-1}];
 const sql=nativeGuardBranch('product_prices',columns,{...contract,planHash:'b'.repeat(64)});assert.match(sql,/#goal7_native_rows/);assert.match(sql,/#goal7_source_guard_hashes/);assert.match(sql,/goal7_source_plan/);assert.match(sql,/SOURCE_NATIVE_DELETE_FORBIDDEN/);assert.match(sql,/nvarchar\(max\)/);assert.match(sql,/decimal\(28,8\)/);assert.match(sql,/COALESCE\(IS_SRVROLEMEMBER\(N'sysadmin',ORIGINAL_LOGIN\(\)\),0\)/);assert.doesNotMatch(sql,/DISABLE TRIGGER|operation_quarantine_/);
});
test('quarantine is never a wrapper and original CREATE bytes plus FIRST order are restored',()=>{
 assert.equal(temporaryNativeWrapper({table:'products',name:'operation_quarantine_products'}),false);assert.equal(temporaryNativeWrapper({table:'products',name:'c03_guard_products'}),true);
 const g={table:'products',name:'c03_guard_products',definition:'CREATE TRIGGER dbo.c03_guard_products ON dbo.products AFTER UPDATE AS BEGIN RETURN;END',first_u:1};const sql=restoreNativeGuard(g);assert.equal(sql[1],g.definition);assert.match(sql[2],/First/);assert.throws(()=>restoreNativeGuard({...g,name:'operation_quarantine_products'}),/ORIGINAL_CREATE_REQUIRED/);
});
test('insertion defaults must be represented explicitly without weakening the guard',()=>{
 const schema=[{table:'products',name:'id',type:'bigint',is_identity:true},{table:'products',name:'created_at',type:'datetime2',is_nullable:false,default_definition:'getdate()'},{table:'products',name:'purchase_discount_rate',type:'decimal',is_nullable:false,default_definition:'(0)'},{table:'products',name:'supplier_id',type:'bigint',is_nullable:true,default_definition:null}];
 assert.equal(insertRepresentationDiagnostic({table:'products',targetId:null,sourceKey:'test',fields:{}},schema).length,1);assert.deepEqual(insertRepresentationDiagnostic({table:'products',targetId:null,sourceKey:'test',fields:{purchase_discount_rate:'0.0000'}},schema),[]);
});
test('missing old test guards on aliases/barcodes/prices is legitimate; quarantine FIRST remains required',()=>{
 const g=['products','stock_movements','product_prices','product_barcodes','product_source_aliases'].map(table=>({table,name:'operation_quarantine_'+table,disabled:false,first_i:1,first_u:1,first_d:1}));g.push(...['products','stock_movements'].map(table=>({table,name:'test_guard_'+table,disabled:false})));assert.doesNotThrow(()=>validateNativeGuards(g,g));const changed=structuredClone(g);changed[0].first_u=0;assert.throws(()=>validateNativeGuards(changed,changed),/QUARANTINE_FIRST_REQUIRED/);
});
test('execution is explicit and SQL schema rejects foreign column types',async()=>{
 await assert.rejects(executeNative('unused','--verify'),/EXPLICIT_MODE/);assert.throws(()=>nativeSqlType({name:'payload',type:'sql_variant'}),/COLUMN_TYPE/);
});
test('replay computes scalar JSON row hashes before aggregate validation',()=>{
 const sql=replayBindingProofSql(SOURCE_VERSION_TABLES.products,SOURCE_VERSION_PRODUCT_FIELDS,contract.runId);
 assert.match(sql,/SUM\(CASE WHEN binding_hash<>actual_hash/);assert.match(sql,/FROM\(SELECT x\.binding_hash,/);assert.match(sql,/FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES/);assert.doesNotMatch(sql,/SUM\(CASE WHEN binding_hash<>CONVERT/);assert.throws(()=>replayBindingProofSql('dbo.products',SOURCE_VERSION_PRODUCT_FIELDS,contract.runId),/BINDING_TABLE/);
});
