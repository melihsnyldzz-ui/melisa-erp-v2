// Offline driver double only: no mssql import, connection, config or native SQL.
// Table/transaction semantics below are a model, never SQL execution evidence.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateIsolatedOperationCopyContext,isolatedCopyHash,ISOLATED_COPY_PROCEDURES} from './isolatedOperationCopyContext.mjs';
import {CUSTOMER_CARD_PROC,CUSTOMER_CARD_PROC_HASH,CUSTOMER_CARD_PROC_SQL,assembleCustomerCardRaw,createCustomerCardReadStore} from './customerCardReadStore.mjs';
import {createCanonicalCustomerMasterRuntime,CUSTOMER_MASTER_NORMAL_TARGET,CUSTOMER_MASTER_NORMAL_LOGIN,CUSTOMER_MASTER_NORMAL_GUARD} from './customerMasterCanonicalRuntime.mjs';
import {NORMAL_MASTER_FRAME_SQL,NORMAL_MASTER_SOURCE_SQL,NORMAL_MASTER_UPDATE_SQL,NORMAL_MASTER_RECOVERY_SQL,NORMAL_MASTER_LIST_SQL} from './customerMasterCanonicalSql.mjs';
import {FINAL_PARTY_READ_PROC,FINAL_PARTY_READ_PROC_HASH} from './finalPartyDeltaRead.mjs';
import {CURRENT_FINANCE_PARTY_PROC,CURRENT_FINANCE_PARTY_PROC_HASH} from './currentFinanceDeltaRead.mjs';
import {sharedPartyReaderDefinition} from './isolatedPartyCardReader.mjs';
import {customerMasterRevision} from './customerMasterProjection.mjs';
import {MASTER_FRAME_SQL,MASTER_SOURCE_SQL,MASTER_UPDATE_SQL,MASTER_RECOVERY_SQL,MASTER_LIST_SQL} from './customerMasterSqlContract.mjs';
import {createCustomerMasterSqlStore} from './customerMasterSqlStore.mjs';
import {createCustomerMasterService} from './customerMasterService.mjs';
import {createCustomerCardService} from './customerCardService.mjs';
export const identityActor=Object.freeze({id:17,role:{id:2,code:'admin'},permissions:['customer.view','customer.edit']});
const digest=v=>createHash('sha256').update(JSON.stringify(v),'utf16le').digest('hex').toUpperCase();
const fail=n=>{throw Object.assign(Error('Offline SQL model failure'),{number:n});};
function profile(){
 const h='A'.repeat(64),party=(id,currency,accountId)=>({id,partyId:String(2000+Number(id)),accountId,currency,sourceKey:['VEGA2026','F0102TBLCARI',id].join('/'),beforeHash:h,accountBeforeHash:h,sourceKnown:true,sourceWitnessHash:h});
 const body={schemaVersion:'melisa-stage4-isolated-operation-copy.v1',operationOrigin:'ISOLATED_TEST_COPY',actualT1:false,copyId:'12345678-1234-4234-8234-123456789012',backupSHA:h,sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',sourceCommit:'c'.repeat(40),currentProductSourceVersionRunId:'PRODUCT-4161d6d9-0716-469e-8c67-c165a20fa674',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',login:'melisa_shared_test_rw_20261009_02',databaseUser:'melisa_shared_test_rw_20261009_02'},date:'2026-10-09',scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:h,businessInvoiceMaxExact4:'20000.0000',externalOperations:false,humanAccepted:false,currencyRates:[{currency:'TRY',rateExact8:'1.00000000',source:'IDENTITY_TRY',date:'2026-10-09',id:null},{currency:'USD',rateExact8:'47.80000000',source:'synthetic',date:'2026-10-09',id:'2'}],actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:[{id:'444',stockCode:'OFFLINE-444',sourceKey:['VEGA2026','F0102TBLSTOKLAR','444'].join('/'),unit:'ADET',unitFactorExact8:'1.00000000',priceIds:['100'],barcodes:['00444'],beforeHash:h}],customers:[party('100','TRY','1100'),party('100','USD','5100'),party('100','EUR','6100'),party('101','TRY','1101')],suppliers:[{...party('200','TRY','1200'),sourceKey:['VEGA2026','F0103TBLCARI','200'].join('/')}],financeAccounts:[{id:'40',currency:'TRY',beforeHash:h}],catalogProof:{preservedGuardHash:h},sql:Object.fromEntries(Object.entries(ISOLATED_COPY_PROCEDURES).map(([k,name])=>[k,{name,hash:h}]))};
 return validateIsolatedOperationCopyContext({...body,sealHash:isolatedCopyHash(body)});
}
function row(copy,id){
 const scoped=copy.customers.filter(c=>c.id===id),p=scoped[0],code='OFFLINE-'+id,name=id==='100'?'Örnek Müşteri':'Diğer Müşteri',key='P'+id;
 return {customer:{id,customerCode:code,customerName:name,currency:'TRY',partyEntityId:p.partyId,sourceRecordKey:p.sourceKey,isActive:true,phone:'001000000',city:'İstanbul',country:'Türkiye',customerType:'customer',revision:1},sourceLinks:[{sourceId:id,sourceCompany:'01',partyEntityId:p.partyId}],sourceParties:[{sourceKey:key,sourceId:id,company:'01',role:'customer',code,name,currency:'TRY',scope:'IN_SCOPE_ACTIVE',balanceStatus:'SOURCE',globalSourceLinkCount:1}],sourceAccounts:scoped.map((a,i)=>({sourceKey:'A'+a.accountId,partySourceKey:key,role:'customer',currency:a.currency,balanceStatus:'SOURCE',sourceOpeningBalanceExact:['-100.00000001','5.12345678','0.00000000'][i]})),nativeAccounts:scoped.map((a,i)=>({id:a.accountId,customerId:id,nativeOwnerCustomerId:id,partyEntityId:p.partyId,currency:a.currency,sourceRecordKey:a.sourceKey,nativeBalanceExact:['-90.00000001','7.12345678','0.00000000'][i],localDeltaExact:['10.00000000','2.00000000','0.00000000'][i],ledgerBalanceExact:['-90.00000001','7.12345678','0.00000000'][i]})),quarantineHolds:[]};
}
export function customerMasterSqlFixture({normal=false}={}){
 const copy=profile(),recipe=normal?{name:CUSTOMER_CARD_PROC,afterHash:CUSTOMER_CARD_PROC_HASH}:sharedPartyReaderDefinition(copy,{role:'customer',sourceSQL:CUSTOMER_CARD_PROC_SQL});
 const [FRAME,SOURCE,UPDATE,RECOVERY,LIST]=normal?[NORMAL_MASTER_FRAME_SQL,NORMAL_MASTER_SOURCE_SQL,NORMAL_MASTER_UPDATE_SQL,NORMAL_MASTER_RECOVERY_SQL,NORMAL_MASTER_LIST_SQL]:[MASTER_FRAME_SQL,MASTER_SOURCE_SQL,MASTER_UPDATE_SQL,MASTER_RECOVERY_SQL,MASTER_LIST_SQL];
 const field=normal?'scopeKey':'copyId',parameter=normal?'scope_key':'copy_id';
 let state={rows:['100','101'].map(id=>row(copy,id)),local:[],journal:[],audit:[]},tail=Promise.resolve(),serial=0;
 if(normal)for(const r of state.rows)for(const a of r.nativeAccounts){if(a.id==='1100')a.nativeBalanceExact=a.ledgerBalanceExact='-93.00000001';if(a.id==='5100')a.nativeBalanceExact=a.ledgerBalanceExact='8.12345678';}
 const modes={},calls=[],sqlError=()=>fail(52110),clone=v=>structuredClone(v),key=(a,b)=>a[field]===b[field]&&a.customerId===b.customerId;
 const final={schemaVersion:'melisa-final-catalog-context.v1',runId:'FINAL-11111111-1111-4111-8111-111111111111',planHash:'A'.repeat(64),partyBindingsHash:'B'.repeat(64)};
 const current={schemaVersion:'melisa-current-finance-read-context.v1',cutoverId:'22222222-2222-4222-8222-222222222222',planHash:'C'.repeat(64),partyBindingsHash:'D'.repeat(64),packetHash:'E'.repeat(64),accountIds:['1100','5100']};
 class Transaction{
  async begin(level){assert.equal(level,'SERIALIZABLE');const prior=tail;tail=new Promise(r=>{this.unlock=r;});await prior;this.data=clone(state);this.number=String(++serial);this.active=true;calls.push(['begin',this.number]);}
  async commit(){assert(this.active);if(modes.commitFailure)sqlError();state=this.data;this.active=false;this.unlock();calls.push(['commit',this.number]);if(modes.lostCommitAck)sqlError();}
  async rollback(){if(this.active){this.active=false;this.unlock();}calls.push(['rollback',this.number]);}
 }
 class Request{
  constructor(tx){this.parent=tx;this.p={};this.types={};}
  input(k,t,v){assert(this.parent.active);this.p[k]=v;this.types[k]=t;return this;}
  async execute(name){
   if(normal&&[FINAL_PARTY_READ_PROC,CURRENT_FINANCE_PARTY_PROC].includes(name)){const ids=JSON.parse(this.p.account_ids);calls.push(['finance',name,ids]);const proof=ids.filter(id=>name===FINAL_PARTY_READ_PROC||current.accountIds.includes(id)).map(accountId=>({accountId,sourceDeltaExact:name===FINAL_PARTY_READ_PROC?(accountId==='1100'?'2.00000000':'0.00000000'):(accountId==='1100'?'-5.00000000':'1.00000000'),verified:!modes.financeUnverified}));if(modes.financeMissing&&name===CURRENT_FINANCE_PARTY_PROC)proof.pop();return {recordset:[{readerDefinitionHash:modes.financeHash??(name===FINAL_PARTY_READ_PROC?FINAL_PARTY_READ_PROC_HASH:CURRENT_FINANCE_PARTY_PROC_HASH),rowsJson:JSON.stringify(proof)}]};}
   assert.equal(name,recipe.name);assert.deepEqual(Object.keys(this.p).sort(),[...(normal?[]:['copy_id']),'customer_id','search','page','page_size','status','quarantine'].sort());calls.push(['reader',name]);const rows=this.parent.data.rows.filter(r=>!this.p.customer_id||r.customer.id===this.p.customer_id);return {recordset:[{total:rows.length,readerDefinitionHash:modes.readerHash??recipe.afterHash,rowsJson:JSON.stringify(rows)}]};}
  async query(sql){
   assert(this.parent.active);const p=this.p,s=this.parent.data,scope={[field]:p[parameter],customerId:p.customer_id},native=s.rows.find(r=>r.customer.id===p.customer_id),local=s.local.find(r=>key(r,scope));calls.push(['query',sql,this.types]);
   if(sql.includes('sys.sp_getapplock')){this.parent.mode=sql.includes("N'Exclusive'")?'Exclusive':'Shared';return {};}
   if(sql===FRAME)return {recordset:[{...(normal?{db:CUSTOMER_MASTER_NORMAL_TARGET.database,server:CUSTOMER_MASTER_NORMAL_TARGET.server,login:CUSTOMER_MASTER_NORMAL_LOGIN,databaseUser:CUSTOMER_MASTER_NORMAL_LOGIN,guardHash:CUSTOMER_MASTER_NORMAL_GUARD}:{db:copy.target.database,server:copy.target.server,login:copy.target.login,databaseUser:copy.target.databaseUser,profileJson:JSON.stringify(copy)}),sysadmin:0,control:0,live:0,originalDatabaseAccess:0,sessionId:71,transactionId:this.parent.number,transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:this.parent.mode,sourceReaderHash:recipe.afterHash,schemaValid:true,actorJson:JSON.stringify([{id:Number(p.actor_id),roleId:2,roleCode:'admin',canView:true,canUpdate:true}]),...modes.frame}]};
   if(sql===SOURCE)return {recordset:[{baseType:native.customer.customerType,sourceRevision:digest(native.customer),projectionJson:local?JSON.stringify(local):null}]};
   if(sql===LIST){const found=s.rows.filter(r=>{const l=s.local.find(l=>l[field]===p[parameter]&&l.customerId===r.customer.id),c=r.customer;return c.isDeleted!==true&&(p.status==='all'||c.isActive===(p.status==='active'))&&(p.quarantine==='all'||(r.quarantineHolds.length>0)===(p.quarantine==='included'))&&[l?.customerCode??c.customerCode,l?.customerName??c.customerName,c.customerCode,c.phone].some(v=>String(v??'').toLocaleLowerCase('tr').includes(p.search.toLocaleLowerCase('tr')));}).sort((a,b)=>Number(a.customer.id)-Number(b.customer.id));return {recordset:[{total:found.length,idsJson:JSON.stringify(found.slice((p.page-1)*p.limit,p.page*p.limit).map(r=>({id:r.customer.id})))}]};}
   const prior=s.journal.find(r=>r[field]===p[parameter]&&r.requestId===p.request_id);
   const valid=()=>prior.actorId===p.actor_id&&prior.customerId===p.customer_id&&prior.identityHash===p.identity_hash&&local&&local.identityHash===prior.identityHash&&local.version>=prior.version&&s.audit.some(a=>a[field]===p[parameter]&&a.requestId===p.request_id&&a.actorId===prior.actorId&&a.customerId===prior.customerId&&a.payloadHash===prior.payloadHash)&&digest(JSON.parse(prior.payloadJson))===prior.payloadHash;
   if(sql===RECOVERY){if(prior&&!valid())fail(52114);return {recordset:[{replayed:!!prior}]};}
   assert.equal(sql,UPDATE);assert.equal(this.parent.mode,'Exclusive');
   assert.equal(this.types.customer_code,'nvarchar(50)');assert.equal(this.types.customer_name,'nvarchar(250)');assert.equal(this.types.customer_type,'nvarchar(30)');
   if(prior){if(!valid()||prior.payloadHash!==p.payload_hash||prior.payloadJson!==p.payload_json)fail(52114);return {recordset:[{replayed:true}]};}
   if(p.expected_revision!==customerMasterRevision(digest(native.customer),local?.version??0,p.identity_hash))fail(52113);
   if(s.rows.some(r=>r.customer.id!==p.customer_id&&r.customer.customerCode.toUpperCase()===p.customer_code.toUpperCase())||s.local.some(r=>r[field]===p[parameter]&&r.customerId!==p.customer_id&&r.customerCode.toUpperCase()===p.customer_code.toUpperCase()))fail(52116);
   const next={...scope,identityHash:p.identity_hash,customerCode:p.customer_code,customerName:p.customer_name,customerType:p.customer_type,version:(local?.version??0)+1};if(local)Object.assign(local,next);else s.local.push(next);
   if(modes.journalFailure)sqlError();s.journal.push({...scope,requestId:p.request_id,actorId:p.actor_id,identityHash:p.identity_hash,payloadHash:p.payload_hash,payloadJson:p.payload_json,version:next.version});
   if(modes.auditFailure)sqlError();s.audit.push({...scope,requestId:p.request_id,actorId:p.actor_id,payloadHash:p.payload_hash});return {recordset:[{replayed:false}]};
  }
 }
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'},BigInt:'bigint',Int:'int',Bit:'bit',UniqueIdentifier:'uuid',MAX:'max',NVarChar:n=>`nvarchar(${n})`,Char:n=>`char(${n})`},pool={};
 const normalOptions={database:{isCanonicalTest:()=>true,isIsolatedOperationCopyRuntime:()=>false,getSqlPool:async()=>pool,getSqlDriver:()=>sql},startup:{mode:'erp',port:4144,writes:true,identity:{databaseName:CUSTOMER_MASTER_NORMAL_TARGET.database,serverName:CUSTOMER_MASTER_NORMAL_TARGET.server,loginName:CUSTOMER_MASTER_NORMAL_LOGIN,databaseUser:CUSTOMER_MASTER_NORMAL_LOGIN,sysadmin:0,databaseControl:0,liveDatabaseAccess:0},env:{port:4144,sql:{database:CUSTOMER_MASTER_NORMAL_TARGET.database,server:'127.0.0.1',port:1433,user:CUSTOMER_MASTER_NORMAL_LOGIN,readOnly:false,trustedConnection:false}}},getFinalContext:()=>final,getCurrentFinanceContext:()=>current};
 let runtimePromise;const getRuntime=normal?()=>runtimePromise??=createCanonicalCustomerMasterRuntime(normalOptions):()=>({sql,pool,copyContext:copy});
 const store=createCustomerMasterSqlStore({getRuntime}),service=createCustomerMasterService({getStore:()=>store});
 const readStore=normal?createCustomerCardReadStore({getRuntime,getCopyContext:()=>null,getFinalContext:()=>final,getCurrentFinanceContext:()=>current}):{listCustomerCardRows:async()=>({rows:state.rows.map(r=>assembleCustomerCardRaw(clone(r))),total:state.rows.length}),readCustomerCardRows:async id=>assembleCustomerCardRaw(clone(state.rows.find(r=>r.customer.id===id)))};
 const cards=createCustomerCardService({getStore:()=>readStore,masterProjection:store});
 return {copy,store,service,cards,calls,modes,normalOptions,final,current,snapshot:()=>clone(state),change:(id,fn)=>fn(state.rows.find(r=>r.customer.id===id)),tamper:fn=>fn(state),nativeExecution:false};
}
