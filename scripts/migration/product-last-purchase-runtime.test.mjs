import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEMA,TARGET,hash,sqlHash} from './product-last-purchase-model.mjs';
import {normalizePurchaseSource} from './product-last-purchase-source.mjs';
import {PURCHASE_REFERENCE_SQL_PROOF} from './product-purchase-reference-sql.mjs';
import {TABLES,DDL,DEFINITIONS,ASSERT_SQL,READER_SQL,LAST_PURCHASE_SQL_PROOF} from './product-last-purchase-sql.mjs';
import {buildLastPurchasePlan,compareLastPurchaseRows,lastPurchaseRowsHash,verifyParentSnapshot,validateLastPurchaseReadback,applyLastPurchaseReferences,replayLastPurchaseDecision} from './product-last-purchase-runtime.mjs';

const h='a'.repeat(64),b='b'.repeat(64),at='2026-10-08T12:00:00.000Z';
const modules=Object.entries(PURCHASE_REFERENCE_SQL_PROOF.moduleHashes).map(([name,hash])=>({name,hash})).sort((a,b)=>a.name.localeCompare(b.name));
const makeParent=i=>{const rawSource={card:{sourceId:i},units:[]};return {schemaVersion:'melisa-product-purchase-reference.v1',productId:String(i),sourceId:String(i),stockCode:'CODE-'+i,nativeKey:'FIXTURE/PRODUCT/'+i,bindingKind:'OPENING',bindingRun:'PARENT',bindingHash:b,productHash:h,sourceHash:hash(rawSource),rawSource,sourceAsOf:at,cardAmountExact:'25.00000000',referenceExact:null,discountExact:'10.00000000',currency:'USD',unitLabel:'ADET',priceBasis:'UNKNOWN',status:'CARD_AMOUNT_ONLY',method:'SOURCE_CARD_AMOUNT',reasons:[],protectedManual:false,protectedExistingCost:true,accountingCost:false,financialWrites:0};};
const parentRows=Array.from({length:16668},(_,n)=>{const parent=makeParent(n+1),record_json=JSON.stringify(parent);return {product_id:parent.productId,record_json,record_hash:sqlHash(record_json)};});
const parentManifest={run_id:'PARENT',manifest_hash:b,rows_hash:hash(parentRows.map(r=>r.record_hash).join('')),sealed:1,status:'COMMITTED',row_count:16668};
const parentSnapshot={manifest:parentManifest,rows:parentRows};
const products=[1,2].map(i=>({productId:String(i),stockCode:'CODE-'+i,nativeKey:'FIXTURE/PRODUCT/'+i,productHash:h,aliasCount:1,aliasSourceId:i,held:0,manualPurchaseProtected:false}));
const bindings=[1,2].map(i=>({product_id:String(i),source_id:String(i),bindingKind:'OPENING',bindingRun:'PARENT',binding_hash:b}));
function capture(overrides={}){
 const cards=[1,2].map(i=>({sourceId:i,stockCode:'CODE-'+i,mainUnitPointer:i,brand:'BRAND'})),units=[1,2].map(i=>({sourceId:i,productSourceId:i,name:'ADET',factor:'1.00000000',barcode:'B'+i}));
 const costs=[{company:'F0103',period:'D0007',headerSourceId:90,lineSourceId:91,documentType:20,date:'2026-10-01T00:00:00',stockCode:'CODE-1',model:'MODEL',supplierCode:'BRAND',canceled:false,returnFlag:false,lineCurrencyRaw:'TL',lineExchangeRate:'1.00000000',quantity:'3.00000000',netLineTotalTry:'100.00000000',headerTotalTry:'100.00000000',headerLineSumTry:'100.00000000',postedCreditTry:'100.00000000',postedCount:1,vatRate:'0.00000000',extraCharge:'0.00000000',unit:'ADET',multiplier:'1.00000000',seriesMultiplier:'1.00000000'}];
 const rawOutputs=[cards,units,costs].map((rows,i)=>({queryHash:hash('query'+i),rows,hash:hash(rows)}));
 return {...normalizePurchaseSource({cards,units,costs,sourceAsOf:at}),identity:{server:'DESKTOP-KSRK0EQ',database:'VEGA2026'},permissions:{admin:0,controlServer:0,dbControl:0,ins:0,upd:0,del:0,exe:0},twoPassStable:true,startedAt:'2026-10-08T11:59:59.000Z',endedAt:at,rawOutputs,sourceHash:hash(rawOutputs.map(x=>({queryHash:x.queryHash,hash:x.hash}))),...overrides};
}
function refresh(c){for(const o of c.rawOutputs)o.hash=hash(o.rows);c.sourceHash=hash(c.rawOutputs.map(x=>({queryHash:x.queryHash,hash:x.hash})));const [cards,units,costs]=c.rawOutputs.slice(0,3).map(x=>x.rows);return {...c,...normalizePurchaseSource({cards,units,costs,sourceAsOf:c.sourceAsOf})};}
const backup={file:'synthetic-unused.bak',verified:true,sha256:h,backupSetUuid:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'};
function plan(overrides={}){return buildLastPurchasePlan({capture:capture(),parentSnapshot,bindings,products,runId:'ERP-MIGUNIFIED01-NET-FIXTURE',backup,protectedBefore:{synthetic:h},moduleBefore:modules,...overrides});}

test('separate sealed SQL object set keeps old modules/native objects unchanged and reader has exactly three resultsets',()=>{
 assert.equal(DEFINITIONS.size,5);assert.doesNotMatch(DDL,/ALTER|DROP|UPDATE|DELETE|dbo\./i);for(const [name,sql]of DEFINITIONS){assert.ok(name.includes('product_last_purchase'));assert.equal(LAST_PURCHASE_SQL_PROOF.moduleHashes[name],sqlHash(sql));assert.doesNotMatch(sql,/(?:INSERT|UPDATE|DELETE)\s+dbo\.|DISABLE TRIGGER|SESSION_CONTEXT|GRANT/i);}
 assert.match(ASSERT_SQL,/row_count=16668/);assert.match(ASSERT_SQL,/usp_assert_product_purchase_reference @full=@full/);assert.match(ASSERT_SQL,/WITHIN GROUP\(ORDER BY product_id\)/);assert.match(READER_SQL,/PURCHASE_REFERENCE_NATIVE_DRIFT/);assert.match(READER_SQL,/PURCHASE_REFERENCE_BINDING_DRIFT/);assert.match(READER_SQL,/PURCHASE_REFERENCE_HELD/);assert.match(READER_SQL,/LAST_PURCHASE_PARENT_DRIFT/);assert.match(READER_SQL,/LAST_PURCHASE_MANUAL_DRIFT/);assert.equal((READER_SQL.match(/SELECT .* rowJson/g)||[]).length,2);assert.equal((READER_SQL.match(/SELECT DB_NAME\(\) databaseName/g)||[]).length,1);
});
test('plan preserves parent scope and exact card metadata while filling independent rational document net',()=>{
 const p=plan();assert.equal(p.parentRows,16668);assert.equal(p.parentRowsHash,parentManifest.rows_hash);assert.equal(p.rows.length,2);assert.equal(p.excluded.length,16666);assert.equal(p.rows[0].referenceExact,'33.333333333333333333');assert.equal(p.rows[0].precisionStatus,'TRUNCATED_18');assert.equal(p.rows[1].referenceExact,null);assert.equal(p.rows[1].sourceKind,'CARD');assert.equal(p.rows[0].parentRecordHash,parentRows[0].record_hash);assert.equal(p.costWrites,0);assert.equal(p.financialWrites,0);assert.equal(p.schemaVersion,SCHEMA);
});
test('source permission/hash drift and parent row scope/image tampering fail before planning',()=>{
 assert.throws(()=>plan({capture:capture({permissions:{admin:1}})}),/READONLY/);assert.throws(()=>plan({capture:capture({sourceHash:h})}),/CAPTURE_HASH/);
 const derivedTamper=capture();derivedTamper.products[0]={...derivedTamper.products[0],name:'fabricated'};assert.throws(()=>plan({capture:derivedTamper}),/SOURCE_DERIVED_DRIFT/);
 assert.throws(()=>verifyParentSnapshot({...parentManifest,row_count:16667},parentRows),/PARENT_SCOPE/);assert.throws(()=>verifyParentSnapshot(parentManifest,parentRows.slice(1)),/PARENT_MANIFEST/);
 const changed=[...parentRows];changed[0]={...changed[0],record_json:'{}'};assert.throws(()=>verifyParentSnapshot(parentManifest,changed),/PARENT_IMAGE/);
 const changedPins=modules.map((m,i)=>i?m:{...m,hash:h});assert.throws(()=>plan({moduleBefore:changedPins}),/PARENT_SQL_PIN/);
});
test('CAS excludes whole-product/binding/held/manual drifts individually without changing other planned rows',()=>{
 const p=plan();for(const [patch,reason]of [[{productHash:b},'TARGET_OR_BINDING_DRIFT'],[{held:1},'HELD_PRODUCT'],[{manualPurchaseProtected:true},'MANUAL_PURCHASE_DRIFT']]){const result=compareLastPurchaseRows({plan:p,capture:capture(),parentSnapshot,bindings,products:products.map((x,i)=>i?x:{...x,...patch})});assert.equal(result.rows.length,1);assert.deepEqual(result.skipped,[{productId:'1',reason}]);}
 const drift=bindings.map((x,i)=>i?x:{...x,bindingRun:'other'});assert.equal(compareLastPurchaseRows({plan:p,capture:capture(),parentSnapshot,bindings:drift,products}).skipped[0].reason,'TARGET_OR_BINDING_DRIFT');
});
test('fresh source read retains frozen sourceAsOf and pins all candidate records, not only selected line',()=>{
 const p=plan(),later=capture({startedAt:'2026-10-08T12:00:29Z',endedAt:'2026-10-08T12:00:30Z',sourceAsOf:'2026-10-08T12:00:30Z'});assert.equal(compareLastPurchaseRows({plan:p,capture:later,parentSnapshot,bindings,products}).rows[0].sourceAsOf,p.sourceAsOf);
 const fresh=capture();fresh.rawOutputs[2].rows.push({...fresh.rawOutputs[2].rows[0],lineSourceId:999,date:'2026-10-08T00:00:00'});const result=compareLastPurchaseRows({plan:p,capture:refresh(fresh),parentSnapshot,bindings,products});assert.equal(result.skipped[0].reason,'SOURCE_PRODUCT_OR_CANDIDATES_DRIFT');assert.equal(result.rows.length,1);
 const sourceChanged=capture();sourceChanged.rawOutputs[0].rows[0]={...sourceChanged.rawOutputs[0].rows[0],name:'changed'};assert.equal(compareLastPurchaseRows({plan:p,capture:refresh(sourceChanged),parentSnapshot,bindings,products}).skipped[0].reason,'SOURCE_PRODUCT_OR_CANDIDATES_DRIFT');
});
test('numeric digest/readback and same-run replay reject duplicates, altered payload and parent manifest',()=>{
 const p=plan();assert.equal(lastPurchaseRowsHash([{productId:'100000'},{productId:'99999'}]),hash([sqlHash(JSON.stringify({productId:'99999'})),sqlHash(JSON.stringify({productId:'100000'}))].join('')));
 const actual=p.rows.map(r=>({product_id:r.productId,record_json:JSON.stringify(r),record_hash:sqlHash(JSON.stringify(r))}));assert.equal(validateLastPurchaseReadback([...actual].reverse(),p.rows),true);assert.throws(()=>validateLastPurchaseReadback([actual[0],actual[0]],p.rows),/READBACK_COUNT/);
 const existing={run_id:p.runId,manifest_hash:p.manifestHash,parent_manifest_hash:p.parentManifestHash,parent_rows_hash:p.parentRowsHash};assert.equal(replayLastPurchaseDecision(existing,p),'REPLAY_NOOP');assert.throws(()=>replayLastPurchaseDecision({...existing,manifest_hash:h},p),/REPLAY_BODY_CHANGED/);
});

function mockTarget({native=products,breakReadback=false,breakProtected=false}={}){
 const state={installed:false,manifests:[],rows:[],definitions:new Map(),proof:[],committed:0,rolledBack:0,closed:0,queries:[]};
 class Transaction{async begin(){this.before={installed:state.installed,manifests:structuredClone(state.manifests),rows:structuredClone(state.rows),definitions:new Map(state.definitions),proof:structuredClone(state.proof)};}async commit(){state.committed++;}async rollback(){state.rolledBack++;Object.assign(state,this.before);}}
 class Request{constructor(){this.parameters={};}input(name,type,value){this.parameters[name]=value;return this;}async query(sql){state.queries.push(sql);const out=recordset=>({recordset});
  if(sql.includes('SELECT @@SERVERNAME'))return out([{...TARGET,admin:1}]);
  if(sql.includes('FROM sys.sql_modules'))return out(modules);
  if(sql.includes('SELECT * FROM erp_migration.product_purchase_reference_runs'))return out([parentManifest]);
  if(sql.includes('FROM erp_migration.product_purchase_reference_rows r ORDER'))return out(parentRows);
  if(sql.startsWith("SELECT N'GOAL7'"))return out(bindings);
  if(sql.includes('nativeCost')&&sql.includes('FROM dbo.products p'))return out(native);
  if(sql.startsWith('SELECT DISTINCT entity_id'))return out(native.filter(p=>p.manualPurchaseProtected).map(p=>({entity_id:p.productId})));
  if(sql.startsWith('SELECT OBJECT_ID'))return out([{id:state.installed?1:null}]);
  if(sql.includes('FROM sys.tables'))return out([{n:state.installed?3:0}]);
  if(sql===DDL){state.installed=true;return out([]);}
  if(sql.startsWith('INSERT '+TABLES.runs)){const p=this.parameters;state.manifests=[{run_id:p.run,manifest_hash:p.manifest,manifest_json:p.json,manifest_sql_hash:p.sqlhash,row_count:p.n,rows_hash:p.rowsHash,source_hash:p.source,source_as_of:p.at,parent_run_id:p.parentRun,parent_manifest_hash:p.parentManifest,parent_rows_hash:p.parentRows,status:'COMMITTED',sealed:1}];return out([]);}
  if(sql.startsWith('INSERT '+TABLES.rows)){state.rows.push(...JSON.parse(this.parameters.rows).map(r=>({product_id:r.productId,record_json:r.recordJson,record_hash:r.recordHash})));return out([]);}
  if(sql.startsWith('INSERT '+TABLES.proof)){state.proof.push(this.parameters);return out([]);}
  for(const [name,definition]of DEFINITIONS)if(sql===definition){state.definitions.set(name,definition);return out([]);}
  if(sql.includes('OBJECT_DEFINITION(OBJECT_ID')){const name=sql.match(/OBJECT_ID\(N'([^']+)'/)[1];return out([{hash:sqlHash(state.definitions.get(name))}]);}
  if(sql.includes('SELECT * FROM '+TABLES.runs))return out(state.manifests);
  if(sql.includes('FROM '+TABLES.rows+' r ORDER'))return out(breakReadback?state.rows.map((r,i)=>i?r:{...r,record_hash:b}):state.rows);
  if(sql.startsWith('EXEC ')||sql.startsWith('SET '))return out([]);
  return out([{hash:breakProtected&&state.installed?b:h}]);
 }}
 const sql={Transaction,Request,NVarChar:()=>{},Char:()=>{},Int:'Int',MAX:'MAX',ISOLATION_LEVEL:{SERIALIZABLE:4}},pool={request:()=>new Request(),close:async()=>{state.closed++;}};
 return {state,getTarget:async()=>({pool,sql})};
}
test('mock apply commits only additive metadata and exact replay writes nothing',async()=>{
 const p=plan(),mock=mockTarget(),options={plan:p,getTarget:mock.getTarget,captureSource:async()=>capture(),verifyBackup:async()=>{}};
 const first=await applyLastPurchaseReferences(options);assert.equal(first.metadataWrites,2);assert.equal(first.costWrites,0);assert.equal(mock.state.committed,1);assert.equal(mock.state.definitions.size,5);const before=mock.state.queries.length;
 const replay=await applyLastPurchaseReferences(options);assert.equal(replay.status,'REPLAY_NOOP');assert.equal(replay.metadataWrites,0);assert.equal(mock.state.committed,1);assert.equal(mock.state.rolledBack,1);assert.ok(mock.state.queries.slice(before).every(q=>!q.startsWith('INSERT ')&&!q.startsWith('CREATE ')));assert.ok(mock.state.queries.every(q=>!/(?:INSERT|UPDATE|DELETE|ALTER|DROP)\s+dbo\./i.test(q)));
});
test('mock apply skips held row, and replay later native/source drift is refused',async()=>{
 const p=plan(),native=products.map((p,i)=>i?p:{...p,held:1}),mock=mockTarget({native});const result=await applyLastPurchaseReferences({plan:p,getTarget:mock.getTarget,captureSource:async()=>capture(),verifyBackup:async()=>{}});assert.equal(result.metadataWrites,1);assert.deepEqual(result.skipped,[{productId:'1',reason:'HELD_PRODUCT'}]);
 const good=mockTarget(),options={plan:p,getTarget:good.getTarget,captureSource:async()=>capture(),verifyBackup:async()=>{}};await applyLastPurchaseReferences(options);const drift=capture();drift.rawOutputs[2].rows[0]={...drift.rawOutputs[2].rows[0],netLineTotalTry:'120'};await assert.rejects(applyLastPurchaseReferences({...options,captureSource:async()=>refresh(drift)}),/REPLAY_NATIVE_OR_SOURCE_DRIFT/);assert.equal(good.state.committed,1);
});
test('mock readback/protected-image failures roll back the entire installation',async()=>{
 const p=plan();for(const kind of ['breakReadback','breakProtected']){const mock=mockTarget({[kind]:true});await assert.rejects(applyLastPurchaseReferences({plan:p,getTarget:mock.getTarget,captureSource:async()=>capture(),verifyBackup:async()=>{}}),kind==='breakReadback'?/READBACK_IMAGE/:/PROTECTED_DATA_CHANGED/);assert.equal(mock.state.committed,0);assert.equal(mock.state.rolledBack,1);assert.equal(mock.state.installed,false);assert.equal(mock.state.closed,1);}
});
