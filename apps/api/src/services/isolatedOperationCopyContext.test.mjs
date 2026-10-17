import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIsolatedOperationCopyContext,isolatedCopyHash,isolatedCopyJSON,assertIsolatedCopyIdentity,assertIsolatedCopyActor,assertIsolatedCopyReadProof,bindIsolatedCopyOperationDTO,ISOLATED_COPY_SCHEMA,ISOLATED_COPY_ORIGIN,ISOLATED_COPY_DATABASE,ISOLATED_COPY_SOURCE_DATABASE,ISOLATED_COPY_SERVER,ISOLATED_COPY_PROCEDURES} from './isolatedOperationCopyContext.mjs';

export function fixtureContext(){
 const hash='A'.repeat(64),body={schemaVersion:ISOLATED_COPY_SCHEMA,operationOrigin:ISOLATED_COPY_ORIGIN,actualT1:false,copyId:'ab9ab06a-6b0f-4b48-8898-43b13c140c93',backupSHA:'b'.repeat(64),sourceDatabase:ISOLATED_COPY_SOURCE_DATABASE,sourceCommit:'c'.repeat(40),currentProductSourceVersionRunId:'PRODUCT-4161d6d9-0716-469e-8c67-c165a20fa674',target:{server:ISOLATED_COPY_SERVER,database:ISOLATED_COPY_DATABASE,login:'melisa_stage4_copy_rw_20261008_01',databaseUser:'melisa_stage4_copy_rw_20261008_01'},date:'2026-10-08',actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:[{id:'34765',sourceKey:['VEGA2026','F0102TBLSTOKLAR','161'].join('/'),stockCode:'0161 MOLLY',unit:'ADET',unitFactorExact8:'1.00000000',priceIds:['100'],barcodes:['00161'],beforeHash:hash}],customers:[{id:'20',partyId:'21',accountId:'22',currency:'TRY',sourceKey:['VEGA2026','F0102TBLCARI','23'].join('/'),beforeHash:hash,accountBeforeHash:hash}],suppliers:[{id:'30',partyId:'31',accountId:'32',currency:'USD',sourceKey:['VEGA2026','F0103TBLCARI','33'].join('/'),beforeHash:hash,accountBeforeHash:hash}],financeAccounts:[{id:'40',currency:'TRY',beforeHash:hash},{id:'41',currency:'USD',beforeHash:hash}],sql:Object.fromEntries(Object.entries(ISOLATED_COPY_PROCEDURES).map(([k,name])=>[k,{name,hash}]))};
 return {...body,sealHash:isolatedCopyHash(body)};
}
export const fixtureIdentity=context=>({db:context.target.database,server:context.target.server,login:context.target.login,databaseUser:context.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0});
export const fixtureProof=c=>({copyId:c.copyId,sealHash:c.sealHash,backupSHA:c.backupSHA,valid:true,definitionHashes:Object.fromEntries(Object.entries(c.sql).map(([k,p])=>[k,p.hash]))});

if(import.meta.filename===process.argv[1]){
test('an unregistered serialized v9 adjunct cannot replace the sealed effective READY hash',()=>{
 const copy=validateIsolatedOperationCopyContext(fixtureContext()),proof=fixtureProof(copy);assertIsolatedCopyReadProof(copy,proof);
 const forged={...proof,definitionHashes:{...proof.definitionHashes,ready:'F'.repeat(64)},supplierItemQuarantineRevision:{version:9,modules:[{name:copy.sql.ready.name,afterHash:'F'.repeat(64)}]}};assert.throws(()=>assertIsolatedCopyReadProof(copy,forged),{code:'ISOLATED_COPY_READ_PROOF'});assert.throws(()=>assertIsolatedCopyReadProof(structuredClone(copy),proof),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
});
test('serialized v10 self/parent receipts never authorize a new effective READY hash',()=>{
 const copy=validateIsolatedOperationCopyContext(fixtureContext()),proof=fixtureProof(copy);assertIsolatedCopyReadProof(copy,proof);
 const forged={...proof,definitionHashes:{...proof.definitionHashes,ready:'F'.repeat(64)},operationQuarantineRevision:{version:10,modules:[{name:'dbo.usp_assert_operation_quarantine_v2',afterHash:'F'.repeat(64)},{name:copy.sql.ready.name,afterHash:'F'.repeat(64)}]}};assert.throws(()=>assertIsolatedCopyReadProof(copy,forged),{code:'ISOLATED_COPY_READ_PROOF'});assert.equal(proof.definitionHashes.ready,copy.sql.ready.hash);
});

test('serialized V11 stock/TR and parent/P receipts never replace effective READY or register a write actor',()=>{
 const copy=validateIsolatedOperationCopyContext(fixtureContext()),proof=fixtureProof(copy);
 const forged={...proof,definitionHashes:{...proof.definitionHashes,ready:'F'.repeat(64)},stockPredicateRevision:{version:11,modules:[{name:'dbo.supplier_identity_quarantine_v2_stock_movements',type:'TR',afterHash:'F'.repeat(64)},{name:copy.sql.ready.name,type:'P',afterHash:'F'.repeat(64)}]}};
 assert.throws(()=>assertIsolatedCopyReadProof(copy,forged),{code:'ISOLATED_COPY_READ_PROOF'});assertIsolatedCopyReadProof(copy,proof);
 assert.throws(()=>assertIsolatedCopyActor(copy,{id:17,permissions:['sales.create']},{id:17,role:'admin',active:true,permissions:['sales.create']},'sales.create'),{code:'ISOLATED_COPY_FORBIDDEN'});
});
test('native Date response journals preserve the same timestamp on first response and replay',()=>{
 const createdAt=new Date('2026-10-10T09:08:07.123Z');createdAt.nanosecondsDelta=0;
 const response={result:{createdAt,id:123,plan:{documentDate:'2026-10-09',amount:170}},id:456,dates:[createdAt,new Date('2026-10-10T09:09:00Z')]};
 const first=JSON.parse(JSON.stringify(response)),replay=JSON.parse(isolatedCopyJSON(response));
 assert.deepEqual(replay,first);assert.equal(replay.result.createdAt,'2026-10-10T09:08:07.123Z');
 assert.equal(isolatedCopyHash(response),isolatedCopyHash(first));
 assert.equal(createdAt.nanosecondsDelta,0);assert.equal(createdAt.getTime(),Date.parse(first.result.createdAt));
 assert.equal(isolatedCopyJSON(createdAt),JSON.stringify(createdAt));
 assert.equal(isolatedCopyJSON({createdAt:new Date(NaN)}),'{"createdAt":null}');
});

test('Date handling leaves existing JSON-only seals and historical malformed journal objects unchanged',()=>{
 const body={z:[{b:2,a:'2026-10-10'},null],a:{d:false,c:'exact'}};
 assert.equal(isolatedCopyJSON(body),'{"a":{"c":"exact","d":false},"z":[{"a":"2026-10-10","b":2},null]}');
 assert.equal(isolatedCopyHash(body),'8F43DA5589AA4F8FD472D027F8C5C8BFEDF974BED34D4CDA4E1178AA0EF998FE');
 const historical={result:{createdAt:{nanosecondsDelta:0},id:123}};
 assert.equal(isolatedCopyJSON(historical),'{"result":{"createdAt":{"nanosecondsDelta":0},"id":123}}');
 assert.deepEqual(JSON.parse(isolatedCopyJSON(historical)),historical);
});

test('copy context preserves exact source code/barcode and immutable copy origin',()=>{const c=validateIsolatedOperationCopyContext(fixtureContext());assert.equal(c.products[0].stockCode,'0161 MOLLY');assert.equal(c.products[0].barcodes[0],'00161');assert.equal(c.operationOrigin,ISOLATED_COPY_ORIGIN);assert.equal(Object.isFrozen(c.products[0]),true);assertIsolatedCopyIdentity(c,fixtureIdentity(c));});
test('original target, unknown backup and changed sealed fields fail closed',()=>{
 for(const mutate of [v=>v.target.database=ISOLATED_COPY_SOURCE_DATABASE,v=>v.backupSHA=null,v=>v.products[0].unitFactorExact8='2.00000000',v=>v.products[0].stockCode='161',v=>v.sql.effects.name='dbo.any_writer',v=>v.suppliers[0].currency='LL']){const c=fixtureContext();mutate(c);assert.throws(()=>validateIsolatedOperationCopyContext(c));}
 const c=validateIsolatedOperationCopyContext(fixtureContext());assert.throws(()=>assertIsolatedCopyIdentity(c,{...fixtureIdentity(c),originalDatabaseAccess:1}));assert.throws(()=>assertIsolatedCopyIdentity(structuredClone(c),fixtureIdentity(c)));
});
test('current actual role permissions intersect JWT and reject a forged admin convenience',()=>{
 const c=validateIsolatedOperationCopyContext(fixtureContext()),actor={id:'16',permissions:['sales.create'],testAdminSession:true},actual={id:'16',role:'isolated_test_ilker',active:true,permissions:['sales.create']};
 assertIsolatedCopyActor(c,actor,actual,'sales.create');assert.throws(()=>assertIsolatedCopyActor(c,actor,{...actual,permissions:[]},'sales.create'),{statusCode:403});assert.throws(()=>assertIsolatedCopyActor(c,actor,{...actual,role:'admin'},'sales.create'),{statusCode:403});assert.throws(()=>assertIsolatedCopyActor(c,{...actor,id:'1'},actual,'sales.create'),{statusCode:403});
});

test('normal copied sale uses source code/verified quote and rejects serialized origin spoofing',async()=>{
 const {workSalePreview}=await import('./workSalesModel.mjs'),copy=validateIsolatedOperationCopyContext(fixtureContext());
 const origin={synthetic:false,operationOrigin:copy.operationOrigin};
 const dto={revision:'a'.repeat(64),meta:{date:copy.date,operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash},scope:{...origin,customer:{...origin,id:'20',currency:'TRY',writeEligible:true},products:[{...origin,id:'34765',stockCode:'0161 MOLLY',name:'Molly',barcode:'00161',stockQuantityExact3:'153.000',writeEligible:true,unit:{label:'ADET',factorExact8:'1.00000000'},prices:[{quoteId:'100',currency:'TRY',unitPriceExact8:'92.00000000',revision:'a'.repeat(64),source:{kind:'isolated-test-copy',copyId:copy.copyId,sealHash:copy.sealHash}}]}],accounts:[]},limits:{maxInvoiceAmountExact4:'500.0000'}};
 bindIsolatedCopyOperationDTO(copy,dto);
 const selection={customerId:'20',documentDate:copy.date,currency:'TRY',items:[{productId:'34765',quoteId:'100',quantityExact3:'1.000'}]};
 assert.equal(workSalePreview(selection,dto).grandTotalExact4,'92.0000');
 assert.equal(workSalePreview(selection,dto).items[0].stockCode,'0161 MOLLY');
 assert.throws(()=>workSalePreview(selection,structuredClone(dto)),{code:'ISOLATED_COPY_UNBOUND_DTO'});
 assert.throws(()=>workSalePreview({...selection,items:[{...selection.items[0],quoteId:'101'}]},dto));
 assert.throws(()=>workSalePreview({...selection,currency:'USD'},dto));
});

test('unknown copied cash opening is retained while only a sealed starting balance authorizes the proof',async()=>{
 const {validateIsolatedCopySupplierPaymentContext}=await import('./workSupplierPaymentModel.mjs');
 const raw=fixtureContext();raw.suppliers[0].currency='TRY';raw.financeAccounts=[{...raw.financeAccounts[0],baselineBalanceExact4:'100.0000'}];const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const copy=validateIsolatedOperationCopyContext(raw),origin={synthetic:false,operationOrigin:copy.operationOrigin};
 const make=()=>({meta:{date:copy.date,operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash},suppliers:[{...origin,id:'30',currency:'TRY',writeEligible:true,balanceExact4:'166600.0000',debtKind:'mixed',invoices:[]}],accounts:[{...origin,id:'40',currency:'TRY',type:'cash',openingVerified:false,openingOrigin:'UNKNOWN',openingBalanceExact4:null,startingBalanceVerified:true,startingBalanceExact4:'100.0000',balanceExact4:'100.0000'}],rates:[],payments:[],limits:{maxAmountExact4:'500.0000',maxPayments:30}});
 const actor={id:'16',permissions:['finance.view','supplier.view','finance.payment']},actual={id:'16',role:'isolated_test_ilker',permissions:actor.permissions};
 const dto=bindIsolatedCopyOperationDTO(copy,make());validateIsolatedCopySupplierPaymentContext(dto,actor,actual);assert.equal(dto.accounts[0].openingVerified,false);assert.equal(dto.accounts[0].openingBalanceExact4,null);
 for(const change of [a=>a.startingBalanceVerified=false,a=>a.startingBalanceExact4='101.0000',a=>a.openingOrigin='VERIFIED']){const bad=make();change(bad.accounts[0]);bindIsolatedCopyOperationDTO(copy,bad);assert.throws(()=>validateIsolatedCopySupplierPaymentContext(bad,actor,actual));}
});

test('copy report SQL excludes inherited history and retains the exact8 signed currency ledger',async()=>{
 const {isolatedCopyReportSourceSql,reportBatchSql}=await import('./workReportsReadStore.mjs');
 const {reportFilters}=await import('./workReportsModel.mjs');
 for(const kind of ['sales','purchases','collections','supplier-payments','stock-movements','customer-movements','supplier-movements']){
  const f=reportFilters({kind},new Date('2026-10-08T09:00:00Z')),sql=isolatedCopyReportSourceSql(f);
  assert.match(sql,/stage4_copy_requests/);assert.match(sql,/stage4_copy_effect_components/);assert.match(sql,/copy_id=@copy_id/);assert.match(sql,/effect_json COLLATE Latin1_General_100_BIN2/);
  if(kind.endsWith('movements')&&kind!=='stock-movements')assert.match(sql,/COALESCE\(m.balance_effect_exact,m.balance_effect\)/);
  const batch=reportBatchSql(f,{sourceSql:sql,scale:8});assert.match(batch,/decimal\(38,8\)/);assert.match(batch,/GROUP BY currency/);
 }
});

test('copy daily report remains on its sealed operation date across host midnight',async()=>{
 const {createWorkReportsService}=await import('./workReportsService.mjs'),copy=validateIsolatedOperationCopyContext(fixtureContext());
 const actor={id:'16',permissions:['sales.view']},meta={operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash,date:copy.date};let seen;
 const service=createWorkReportsService({freshActor:async()=>actor,clock:()=>new Date('2026-10-09T01:00:00+03:00'),store:{scopeMeta:async()=>meta,read:async f=>{seen=f;return{rows:[],total:0,currencyTotals:[],copyMeta:meta,scopeLabel:'Bu çalışma kopyasında oluşturulan günlük işlemler'};}},classification:{selection:()=>({filters:{brands:[],productTypes:[]}})}});
 await service.report({},actor);assert.equal(seen.from,'2026-10-08');assert.equal(seen.to,'2026-10-08');
 await service.report({period:'custom',from:'2026-10-09',to:'2026-10-09'},actor);assert.equal(seen.from,'2026-10-09');
});

}
