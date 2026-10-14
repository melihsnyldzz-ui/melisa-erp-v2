import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,BUSINESS_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';
import {assertCustomerContactActor,parseCustomerContactId,parseCustomerContact,CUSTOMER_CONTACT_LIMITS} from './customerContactModel.mjs';
import {CUSTOMER_CONTACT_CONTEXT,CUSTOMER_CONTACT_UPDATE,CUSTOMER_CONTACT_BODY_KEYS,CUSTOMER_CONTACT_CONTEXT_SCHEMA,CUSTOMER_CONTACT_ROW_KEYS,CUSTOMER_CONTACT_CONTEXT_KEYS,CUSTOMER_CONTACT_ACCOUNT_KEYS,CUSTOMER_CONTACT_NATIVE_ERRORS} from '../../../../scripts/canonical/shared-business-customer-contact-contract.mjs';

export const customerContactError=(code='CUSTOMER_CONTACT_UNAVAILABLE',statusCode=503)=>Object.assign(new Error('Müşteri iletişim kapsamı veya kayıt yetkisi doğrulanamadı.'),{code,statusCode});
const check=ok=>{if(!ok)throw customerContactError();};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const id=value=>typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
const transactionId=value=>(typeof value==='string'||typeof value==='number'&&Number.isSafeInteger(value))&&id(String(value));
const parse=value=>{check(typeof value==='string');try{return JSON.parse(value);}catch{throw customerContactError();}};
const contact=value=>exact(value,Object.keys(CUSTOMER_CONTACT_LIMITS))&&Object.entries(CUSTOMER_CONTACT_LIMITS).every(([key,max])=>value[key]===null||typeof value[key]==='string'&&value[key].length<=max&&!/[\u0000-\u001f\u007f-\u009f]/.test(value[key]))&&(value.phone===null||!value.phone.includes('*'));

export const CUSTOMER_CONTACT_TRANSACTION_SQL="SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,@@SPID sessionId,CURRENT_TRANSACTION_ID() transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode;";
const frameKeys=['db','server','login','databaseUser','sysadmin','control','live','originalDatabaseAccess','sessionId','transactionId','transactionCount','transactionState','isolationLevel','copyLockMode'];

function scopedCustomer(copy,customerId){
 assertIsolatedCopyContext(copy);
 if(copy.target.database!==BUSINESS_COPY_DATABASE||copy.scopeKind!=='VERIFIED_BUSINESS_TEST'||copy.actualT1!==false)throw customerContactError('CUSTOMER_CONTACT_SCOPE',403);
 const rows=copy.customers.filter(row=>row.id===customerId);
 if(!rows.length||rows.some(row=>row.sourceKnown!==true||row.quarantined===true))throw customerContactError('CUSTOMER_CONTACT_SCOPE',403);
 check(rows.length<=3&&new Set(rows.map(row=>row.accountId)).size===rows.length&&new Set(rows.map(row=>row.currency)).size===rows.length);
 return rows;
}

export function customerContactContext(copy,raw,customerId){
 const sealed=scopedCustomer(copy,customerId);
 check(exact(raw,CUSTOMER_CONTACT_CONTEXT_KEYS)&&raw.schemaVersion===CUSTOMER_CONTACT_CONTEXT_SCHEMA&&raw.copyId===copy.copyId&&raw.sealHash===copy.sealHash&&raw.customerId===customerId&&id(raw.partyEntityId)&&raw.sourceCompany==='F0102'&&id(raw.sourceId)&&raw.sourceKey===`VEGA2026/F0102TBLCARI/${raw.sourceId}`&&typeof raw.customerCode==='string'&&raw.customerCode.trim()&&raw.customerCode.length<=80&&typeof raw.customerName==='string'&&raw.customerName.trim()&&raw.customerName.length<=250&&hash(raw.revision)&&contact(raw.contact));
 check(sealed.every(row=>row.partyId===raw.partyEntityId)&&sealed.some(row=>row.sourceKey===raw.sourceKey));
 for(const row of sealed){if(Object.hasOwn(row,'code'))check(row.code===raw.customerCode);if(Object.hasOwn(row,'name'))check(row.name===raw.customerName);}
 check(Array.isArray(raw.accounts)&&raw.accounts.length===sealed.length&&new Set(raw.accounts.map(row=>row.accountId)).size===raw.accounts.length&&new Set(raw.accounts.map(row=>row.currency)).size===raw.accounts.length);
 for(const row of raw.accounts)check(exact(row,CUSTOMER_CONTACT_ACCOUNT_KEYS)&&sealed.some(source=>row.accountId===source.accountId&&row.currency===source.currency&&row.partyEntityId===source.partyId&&row.sourceKey===source.sourceKey));
 return Object.freeze({...raw,revision:raw.revision.toUpperCase(),accounts:Object.freeze(raw.accounts.map(row=>Object.freeze({...row}))),contact:Object.freeze({...raw.contact})});
}

export function customerContactProcedureRow(result){
 const sets=result?.recordsets;check(Array.isArray(sets)&&sets.length>0&&sets.every(Array.isArray));
 const contexts=sets.filter(rows=>rows.some(row=>row&&Object.hasOwn(row,'context_json')));
 check(contexts.length===1&&contexts[0].length===1&&sets.every(rows=>rows===contexts[0]||rows.length===0));
 const row=contexts[0][0];check(exact(row,CUSTOMER_CONTACT_ROW_KEYS));return row;
}

function assertNativeActor(actor,actual,registered){
 assertCustomerContactActor(actor);
 const pin=registered.actor;
 if(!pin||!id(pin.id)||!id(pin.nativeRoleId)||typeof pin.nativeRoleCode!=='string'||!hash(pin.permissionsRowsHash)||String(actor.id)!==pin.id||!Number.isSafeInteger(actor.role?.id)||String(actor.role.id)!==pin.nativeRoleId||actor.role.code!==pin.nativeRoleCode)throw customerContactError('CUSTOMER_CONTACT_FORBIDDEN',403);
 if(!exact(actual,['id','nativeRoleId','nativeRoleCode','permissionsRowsHash','permissions','active'])||actual.id!==pin.id||actual.nativeRoleId!==pin.nativeRoleId||actual.nativeRoleCode!==pin.nativeRoleCode||!hash(actual.permissionsRowsHash)||actual.permissionsRowsHash.toUpperCase()!==pin.permissionsRowsHash.toUpperCase()||actual.active!==true||!Array.isArray(actual.permissions)||!actual.permissions.every(value=>typeof value==='string')||!actual.permissions.includes('customer.view')||!actual.permissions.includes('customer.edit'))throw customerContactError('CUSTOMER_CONTACT_FORBIDDEN',403);
}

async function defaultRuntime(){
 const db=await import('../config/database.js');check(db.isIsolatedOperationCopyRuntime());
 const copyContext=assertIsolatedCopyContext(db.getIsolatedOperationCopyConfig());
 const bootstrap=await import('../../../../scripts/canonical/shared-business-customer-contact-bootstrap.mjs');
 check(copyContext.target.database===BUSINESS_COPY_DATABASE&&bootstrap.getRegisteredCustomerContactRevision(copyContext));
 return {copyContext,pool:await db.getSqlPool(),sql:db.getSqlDriver()};
}

export function createCustomerContactStore({getRuntime=defaultRuntime}={}){
 return Object.freeze({async withCustomerContact({customerId,actor,write=false},fn){
  let tx;
  try{
   parseCustomerContactId(customerId);assertCustomerContactActor(actor);check(typeof write==='boolean'&&typeof fn==='function');
   const runtime=await getRuntime(),copy=assertIsolatedCopyContext(runtime.copyContext);scopedCustomer(copy,customerId);
   const bootstrap=await import('../../../../scripts/canonical/shared-business-customer-contact-bootstrap.mjs');
   const registered=bootstrap.getRegisteredCustomerContactRevision(copy);check(registered);
   if(String(actor.id)!==registered.actor?.id)throw customerContactError('CUSTOMER_CONTACT_FORBIDDEN',403);
   const sql=runtime.sql;check(runtime.pool&&sql);
   tx=new sql.Transaction(runtime.pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
   let active=true;const request=()=>{check(active);const req=new sql.Request(tx);check(req.parent===tx);return req;};
   const metadata=async()=>{
    const rows=(await request().input('copy_id',sql.UniqueIdentifier,copy.copyId).query(CUSTOMER_CONTACT_TRANSACTION_SQL)).recordset;check(rows?.length===1);
    const row=rows[0];check(exact(row,frameKeys));assertIsolatedCopyIdentity(copy,row);
    check(Number.isSafeInteger(row.sessionId)&&row.sessionId>0&&transactionId(row.transactionId)&&row.transactionCount===1&&row.transactionState===1&&row.isolationLevel===4&&row.copyLockMode===(write?'Exclusive':'Shared'));return row;
   };
   await request().input('lockKey',sql.NVarChar(255),'melisa-stage4-copy:'+copy.copyId).query(`DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=@lockKey,@LockMode=N'${write?'Exclusive':'Shared'}',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51401,'ISOLATED_COPY_BUSY',1;`);
   const before=await metadata();
   const verify=async()=>{const value=await bootstrap.verifyCustomerContactRevision(copy,request().input('copy_id',sql.UniqueIdentifier,copy.copyId),{write});check(value===registered);};
   const call=async(name,payload)=>{
    const pins=registered.revision?.modules?.filter(row=>row.name===name);check(pins?.length===1&&hash(pins[0].afterHash));
    const req=request().input('copy_id',sql.UniqueIdentifier,copy.copyId).input('customer_id',sql.BigInt,customerId).input('actor_id',sql.BigInt,String(actor.id));
    if(payload!==undefined){check(write&&name===CUSTOMER_CONTACT_UPDATE&&typeof payload==='string'&&Buffer.byteLength(payload,'utf16le')<=8192);req.input('payload_json',sql.NVarChar(sql.MAX),payload);}
    const row=customerContactProcedureRow(await req.execute(name));check(hash(row.readerDefinitionHash)&&row.readerDefinitionHash.toUpperCase()===pins[0].afterHash.toUpperCase()&&row.sessionId===before.sessionId&&transactionId(row.transactionId)&&String(row.transactionId)===String(before.transactionId)&&typeof row.replayed==='boolean'&&(name!==CUSTOMER_CONTACT_CONTEXT||row.replayed===false));
    assertNativeActor(actor,parse(row.actor_json),registered);return {context:customerContactContext(copy,parse(row.context_json),customerId),replayed:row.replayed};
   };
   let result;
   try{
    await verify();const initial=await call(CUSTOMER_CONTACT_CONTEXT);
    const update=async payload=>{check(active&&write);const raw=parse(payload);check(exact(raw,['customerId',...CUSTOMER_CONTACT_BODY_KEYS])&&raw.customerId===customerId);const {customerId:ignored,...body}=raw,input=parseCustomerContact(customerId,body);check(input.payloadJson===payload);await verify();return call(CUSTOMER_CONTACT_UPDATE,payload);};
    result=await fn(Object.freeze({copy,context:initial.context,update}));await verify();const after=await metadata();check(after.sessionId===before.sessionId&&String(after.transactionId)===String(before.transactionId));
   }finally{active=false;}
   await tx.commit();return result;
  }catch(error){
   if(tx)try{await tx.rollback();}catch{}
   const numbers=[error?.number,error?.originalError?.info?.number,...(error?.precedingErrors??[]).map(row=>row.number)],mapped=numbers.map(number=>CUSTOMER_CONTACT_NATIVE_ERRORS[number]).find(Boolean);
   if(mapped)throw customerContactError(mapped.code,mapped.statusCode);
   if(['CUSTOMER_ID_INVALID','CUSTOMER_VALIDATION_FAILED','AUTH_PERMISSION_DENIED','CUSTOMER_CONTACT_FORBIDDEN','CUSTOMER_CONTACT_SCOPE','CUSTOMER_CONTACT_UNAVAILABLE'].includes(error?.code))throw error;
   throw customerContactError();
  }
 }});
}
export const customerContactStore=createCustomerContactStore();
