import {isDeepStrictEqual} from 'node:util';
import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,validateIsolatedOperationCopyContext} from './isolatedOperationCopyContext.mjs';
import {sharedPartyReaderDefinition} from './isolatedPartyCardReader.mjs';
import {CUSTOMER_CARD_PROC_SQL,assembleCustomerCardRaw} from './customerCardReadStore.mjs';
import {customerCardDto} from './customerCardModel.mjs';
import {assertCustomerMasterActor,customerMasterId,customerMasterRequestId,parseCustomerMaster,customerMasterError} from './customerMasterModel.mjs';
import {customerMasterIdentity,customerMasterRevision,validateMasterProjection,bindCustomerMasterProjection} from './customerMasterProjection.mjs';
import {MASTER_FRAME_SQL,MASTER_SOURCE_SQL,MASTER_UPDATE_SQL,MASTER_RECOVERY_SQL,MASTER_LIST_SQL} from './customerMasterSqlContract.mjs';
import {canonicalCustomerMasterBoundary,assertCanonicalCustomerMasterIdentity,CUSTOMER_MASTER_NORMAL_GUARD} from './customerMasterCanonicalRuntime.mjs';
import {NORMAL_MASTER_FRAME_SQL,NORMAL_MASTER_SOURCE_SQL,NORMAL_MASTER_UPDATE_SQL,NORMAL_MASTER_RECOVERY_SQL,NORMAL_MASTER_LIST_SQL} from './customerMasterCanonicalSql.mjs';
const check=ok=>{if(!ok)throw customerMasterError();},unavailable=()=>{throw customerMasterError();};
const parse=value=>{try{return JSON.parse(value);}catch{throw customerMasterError();}};
const viewActor=actor=>{if(!Number.isSafeInteger(actor?.id)||actor.id<1||!Array.isArray(actor.permissions)||!actor.permissions.includes('customer.view'))throw customerMasterError('AUTH_PERMISSION_DENIED',403);};
const framesEqual=(a,b)=>a.sessionId===b.sessionId&&a.transactionId===b.transactionId&&a.sourceReaderHash===b.sourceReaderHash&&a.actorJson===b.actorJson&&a.profileJson===b.profileJson;
// Explicit injection only. This factory is NOT connected to the runtime service.
// The DDL is a proposed metadata schema, never an assertion it is installed.
export function createCustomerMasterSqlStore({getRuntime=unavailable}={}){
 async function boundary({customerId,actor,write=false,projectionRead=false,readiness=false},callback){
  if(customerId!==null)customerMasterId(customerId);else check(projectionRead&&!write);if(readiness)check(customerId===null&&projectionRead&&!write);if(projectionRead){check(!write);if(readiness)assertCustomerMasterActor(actor);else viewActor(actor);}else assertCustomerMasterActor(actor);let tx;const receipts=[];
  try{const runtime=await getRuntime(),normal=canonicalCustomerMasterBoundary(runtime),copy=normal?null:assertIsolatedCopyContext(runtime.copyContext),{sql,pool}=runtime;check(sql&&pool);if(readiness)check(normal);
   const statements=normal?{frame:NORMAL_MASTER_FRAME_SQL,source:NORMAL_MASTER_SOURCE_SQL,update:NORMAL_MASTER_UPDATE_SQL,recover:NORMAL_MASTER_RECOVERY_SQL,list:NORMAL_MASTER_LIST_SQL}:{frame:MASTER_FRAME_SQL,source:MASTER_SOURCE_SQL,update:MASTER_UPDATE_SQL,recover:MASTER_RECOVERY_SQL,list:MASTER_LIST_SQL};
   tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);let active=true;
   const req=()=>{check(active);const r=new sql.Request(tx);check(r.parent===tx);return r;};
   const common=()=>{const r=req();if(normal)r.input('scope_key',sql.NVarChar(128),normal.scopeKey).input('admission_hash',sql.Char(64),normal.admissionHash).input('permission_key',sql.NVarChar(50),projectionRead&&!readiness?'customer.view':'customer.update').input('require_final_reader',sql.Bit,normal.requiresFinalReader);else r.input('copy_id',sql.UniqueIdentifier,copy.copyId).input('seal_hash',sql.Char(64),copy.sealHash);return r.input('actor_id',sql.BigInt,String(actor.id));};
   await req().input('lockKey',sql.NVarChar(255),normal?'melisa-customer-master:'+normal.scopeKey:'melisa-stage4-copy:'+copy.copyId).query(`DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=@lockKey,@LockMode=N'${write?'Exclusive':'Shared'}',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51401,'ISOLATED_COPY_BUSY',1;`);
   const recipe=normal?.recipe??sharedPartyReaderDefinition(copy,{role:'customer',sourceSQL:CUSTOMER_CARD_PROC_SQL});
   const frame=async()=>{normal?.assertCurrent();const rows=(await common().query(statements.frame)).recordset;check(rows?.length===1);const m=rows[0];if(normal){assertCanonicalCustomerMasterIdentity(m);check(m.guardHash===CUSTOMER_MASTER_NORMAL_GUARD);}else{assertIsolatedCopyIdentity(copy,m);check(isDeepStrictEqual(validateIsolatedOperationCopyContext(parse(m.profileJson)),copy));}check(m.transactionCount===1&&m.transactionState===1&&m.isolationLevel===4&&m.copyLockMode===(write?'Exclusive':'Shared')&&Number.isSafeInteger(m.sessionId)&&m.sessionId>0&&/^[1-9]\d*$/.test(m.transactionId)&&m.schemaValid===true&&m.sourceReaderHash===recipe.afterHash);
    const actual=parse(m.actorJson);if(actual?.length!==1||actual[0].id!==actor.id||actual[0].roleId!==actor.role?.id||actual[0].roleCode!==actor.role?.code||actual[0].canView!==true||(!projectionRead||readiness)&&actual[0].canUpdate!==true)throw customerMasterError('CUSTOMER_MASTER_FORBIDDEN',403);return m;};
   const before=await frame();
   const load=async(customerIdToRead=customerId)=>{
    const customerId=customerIdToRead;
    const call=req().input('customer_id',sql.BigInt,customerId).input('search',sql.NVarChar(120),'').input('page',sql.Int,1).input('page_size',sql.Int,1).input('status',sql.NVarChar(12),'all').input('quarantine',sql.NVarChar(12),'all');if(copy)call.input('copy_id',sql.UniqueIdentifier,copy.copyId);
    const rows=(await call.execute(recipe.name)).recordset;check(rows?.length===1&&rows[0].readerDefinitionHash===recipe.afterHash&&rows[0].total===1);const rawRows=parse(rows[0].rowsJson);check(rawRows?.length===1&&rawRows[0].customer?.id===customerId);
    const raw=normal?(await normal.assemble(rawRows,{sql,tx}))[0]:assembleCustomerCardRaw(rawRows[0]),dto=customerCardDto(raw);
    const meta=(await common().input('customer_id',sql.BigInt,customerId).query(statements.source)).recordset;check(meta?.length===1&&/^[A-F0-9]{64}$/.test(meta[0].sourceRevision));
    const scope=normal?{target:normal.target,scopeKey:normal.scopeKey,admissionHash:normal.admissionHash,customerId}:{copyId:copy.copyId,sealHash:copy.sealHash,customerId},baseType=meta[0].baseType;
    if(projectionRead&&!meta[0].projectionJson)return {raw,scope,baseType,projection:null,sourceRevision:meta[0].sourceRevision};
    if(dto.quarantine.blocked!==false||dto.source.status!=='accepted-opening'||dto.hasUnknownAccounts||dto.accounts.some(a=>!a.reconciled))throw customerMasterError('CUSTOMER_MASTER_FORBIDDEN',403);
    if(copy){const selected=copy.customers.filter(c=>c.id===customerId);check(selected.length===raw.nativeAccounts.length&&selected.every(s=>s.sourceKnown===true&&!s.quarantined&&(s.code===undefined||s.code===raw.customer.customerCode)&&(s.name===undefined||s.name===raw.customer.customerName)&&s.partyId===raw.customer.partyEntityId&&s.sourceKey===raw.customer.sourceRecordKey&&raw.nativeAccounts.some(a=>a.id===s.accountId&&a.currency===s.currency)));}

    const {identityHash}=customerMasterIdentity(raw,scope,baseType),projection=meta[0].projectionJson?validateMasterProjection(parse(meta[0].projectionJson),scope,identityHash):null;
    const context={schemaVersion:normal?'melisa-customer-master-context.v3':'melisa-customer-master-context.v2',...scope,actorId:actor.id,customerCode:projection?.customerCode??raw.customer.customerCode,customerName:projection?.customerName??raw.customer.customerName,customerType:projection?.customerType??baseType,currency:raw.customer.currency,revision:customerMasterRevision(meta[0].sourceRevision,projection?.version??0,identityHash),original:{customerCode:raw.customer.customerCode,customerName:raw.customer.customerName}};
    return {raw,scope,baseType,identityHash,projection,sourceRevision:meta[0].sourceRevision,context};
   };
   let current=customerId===null?null:await load(),result;
   try{result=await callback(Object.freeze({get context(){return current.context;},
    update:async input=>{check(active&&write);const parsed=parse(input.payloadJson),{customerId:bodyId,...body}=parsed,validated=parseCustomerMaster(customerId,body);check(bodyId===customerId&&Object.entries(validated).every(([k,v])=>input[k]===v));
     const row=(await common().input('customer_id',sql.BigInt,customerId).input('request_id',sql.UniqueIdentifier,input.requestId).input('identity_hash',sql.Char(64),current.identityHash).input('payload_hash',sql.Char(64),input.payloadHash).input('payload_json',sql.NVarChar(sql.MAX),input.payloadJson).input('expected_revision',sql.Char(64),input.expectedRevision).input('customer_code',sql.NVarChar(50),input.customerCode).input('customer_name',sql.NVarChar(250),input.customerName).input('customer_type',sql.NVarChar(30),input.customerType).query(statements.update)).recordset;
     check(row?.length===1&&typeof row[0].replayed==='boolean');const next=await load();check(next.identityHash===current.identityHash);current=next;return {context:current.context,replayed:row[0].replayed};
    },recover:async id=>{check(active&&!write);const row=(await common().input('customer_id',sql.BigInt,customerId).input('request_id',sql.UniqueIdentifier,customerMasterRequestId(id)).input('identity_hash',sql.Char(64),current.identityHash).query(statements.recover)).recordset;check(row?.length===1&&typeof row[0].replayed==='boolean');return {context:current.context,replayed:row[0].replayed};},
    projectCard:raw=>{check(active&&isDeepStrictEqual(raw,current.raw));receipts.push(bindCustomerMasterProjection(raw,{...current,transactionId:before.transactionId}));return raw;},
    list:async options=>{check(active&&projectionRead&&customerId===null);const {search,page,limit,status,quarantine}=options;
     const row=(await common().input('search',sql.NVarChar(120),search).input('page',sql.Int,page).input('limit',sql.Int,limit).input('status',sql.NVarChar(12),status).input('quarantine',sql.NVarChar(12),quarantine).query(statements.list)).recordset;
     check(row?.length===1&&Number.isSafeInteger(row[0].total)&&row[0].total>=0);const ids=parse(row[0].idsJson);check(Array.isArray(ids)&&ids.length===Math.min(limit,Math.max(0,row[0].total-(page-1)*limit))&&ids.every(r=>Object.keys(r).join()==='id'&&customerMasterId(r.id)===r.id)&&new Set(ids.map(r=>r.id)).size===ids.length);
     const rows=[];for(const {id} of ids){const value=await load(id);receipts.push(bindCustomerMasterProjection(value.raw,{...value,transactionId:before.transactionId}));rows.push(value.raw);}return {rows,total:row[0].total};}
   }));check(framesEqual(before,await frame()));}finally{active=false;}
   await tx.commit();for(const receipt of receipts)receipt.commit();return result;
  }catch(error){for(const receipt of receipts)receipt.revoke();if(tx)try{await tx.rollback();}catch{}const codes={52113:['CUSTOMER_MASTER_STALE',409],52114:['CUSTOMER_MASTER_REQUEST_CONFLICT',409],52116:['CUSTOMER_MASTER_CODE_CONFLICT',409]};const found=codes[error?.number];if(found)throw customerMasterError(...found);if(['AUTH_PERMISSION_DENIED','CUSTOMER_VALIDATION_FAILED','CUSTOMER_MASTER_FORBIDDEN'].includes(error?.code))throw error;throw customerMasterError();}
 }
 return Object.freeze({withCustomerMaster:boundary,
  // No customer is selected and the callback does not issue a statement.
  // This is a same-transaction frame/guard observation, not a write or grant.
  verifyNormalWriterFrame:async actor=>boundary({customerId:null,actor,projectionRead:true,readiness:true},()=>true),
  // Scoped source seam for card/service chains. No configured runtime caller.
  projectCard:async(raw,actor)=>{viewActor(actor);return boundary({customerId:String(raw.customer.id),actor,write:false,projectionRead:true},session=>session.projectCard(raw));},
  listCustomerCardRows:async(options,actor)=>{check(options&&Object.keys(options).sort().join()==='limit,page,quarantine,search,status'&&typeof options.search==='string'&&options.search.length<=120&&Number.isInteger(options.page)&&options.page>=1&&options.page<=1000000&&Number.isInteger(options.limit)&&options.limit>=1&&options.limit<=100&&['all','active','passive'].includes(options.status)&&['all','included','excluded'].includes(options.quarantine));return boundary({customerId:null,actor,projectionRead:true},session=>session.list(options));}
 });
}
