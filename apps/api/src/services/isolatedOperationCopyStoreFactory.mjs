import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,assertIsolatedCopyActor,assertIsolatedCopyReadProof,bindIsolatedCopyOperationDTO,copyAssert,isolatedCopyHash,isolatedCopyJSON,isolatedCopyUUID,ISOLATED_COPY_PROCEDURES,BUSINESS_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';
import {getBusinessInboundSelection} from '../middleware/businessInboundSelectionContext.mjs';
import {getBusinessDailyScopeHash} from './isolatedOperationCopyContext.mjs';
import {withIsolatedOperationCopyScope} from './isolatedOperationCopyScope.mjs';
import {verifyBusinessDailyNativeCheck} from './businessDailyNativeCheck.mjs';
import {verifyBusinessReadinessQueryPlan} from './businessReadinessQueryPlanRevision.mjs';
import {verifyBusinessDailyHomeReadProof} from './businessDailyHomeReadProof.mjs';
import {selectBusinessSaleWriteIntent} from './businessSelectedSaleWriteIntent.mjs';
import {withBusinessSelectedSaleWriteScope} from './businessSelectedSaleWriteScope.mjs';
import {readBusinessSelectedSaleNativeContext} from './businessSelectedSaleNativeContext.mjs';
import {createBusinessSelectedSaleInvoiceReader} from './businessSelectedSaleInvoiceRead.mjs';
import {getRegisteredBusinessSelectedSaleRevision} from '../../../../scripts/canonical/shared-business-selected-sale-revision-bootstrap.mjs';

export const ISOLATED_COPY_OPERATION_PERMISSIONS=Object.freeze({sale_draft:'sales.create',sale_finalize:'sales.finalize',sale_cancel:'sales.cancel',collection_create:'finance.collection',collection_cancel:'finance.collection.cancel',count_create:'goods.create',count_update:'goods.create',count_submit:'goods.create',count_cancel:'goods.create',goods_accept:'goods.approve',goods_reject:'goods.reject',purchase_draft:'purchase.create',purchase_finalize:'purchase.finalize',purchase_cancel:'purchase.cancel',payment:'finance.payment',payment_cancel:'finance.payment.cancel',stock_count_draft:'product.view',stock_count_approve:'stock.adjust',stock_count_reject:'stock.adjust',stock_count_cancel:'stock.adjust',purchase_return_draft:'purchase.view',purchase_return_approve:'purchase.cancel',purchase_return_reject:'purchase.cancel',purchase_return_cancel:'purchase.cancel',stock_reverse:'stock.adjust'});
const domains=new Set(['trade','inbound','payment','daily']);
const homeRead=Symbol('server HOME read');
const parse=value=>{copyAssert(typeof value==='string','ISOLATED_COPY_SQL_JSON');try{return JSON.parse(value);}catch{copyAssert(false,'ISOLATED_COPY_SQL_JSON');}};
const safeId=id=>{const n=Number(id);copyAssert(Number.isSafeInteger(n)&&n>0,'ISOLATED_COPY_ID');return n;};
const identitySQL="SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess";
export const ISOLATED_COPY_FINITE_FK_SQL=`SELECT f.name constraintName,ps.name parentSchema,pt.name parentTable,pc.name parentColumn,rs.name referencedSchema,rt.name referencedTable,rc.name referencedColumn,fc.constraint_column_id ordinal,COUNT(*) OVER(PARTITION BY f.object_id) columnCount,f.is_disabled isDisabled,f.is_not_trusted isNotTrusted,f.delete_referential_action_desc deleteAction,f.update_referential_action_desc updateAction
FROM sys.foreign_keys f JOIN sys.foreign_key_columns fc ON fc.constraint_object_id=f.object_id JOIN sys.tables pt ON pt.object_id=f.parent_object_id JOIN sys.schemas ps ON ps.schema_id=pt.schema_id JOIN sys.columns pc ON pc.object_id=pt.object_id AND pc.column_id=fc.parent_column_id JOIN sys.tables rt ON rt.object_id=f.referenced_object_id JOIN sys.schemas rs ON rs.schema_id=rt.schema_id JOIN sys.columns rc ON rc.object_id=rt.object_id AND rc.column_id=fc.referenced_column_id
WHERE f.name IN(N'FK__test_good__produ__5654B625',N'FK__test_purc__produ__69678A99') ORDER BY f.name,fc.constraint_column_id;`;
function assertFiniteCopyForeignKeys(rows){
 const parents=new Map([['FK__test_good__produ__5654B625','test_goods_batch_lines'],['FK__test_purc__produ__69678A99','test_purchase_batch_intent_lines']]);
 copyAssert(Array.isArray(rows)&&rows.length===2&&new Set(rows.map(row=>row.constraintName)).size===2&&rows.every(row=>parents.has(row.constraintName)&&row.parentSchema==='dbo'&&row.parentTable===parents.get(row.constraintName)&&row.parentColumn==='product_id'&&row.referencedSchema==='dbo'&&row.referencedTable==='products'&&row.referencedColumn==='id'&&row.ordinal===1&&row.columnCount===1&&row.isDisabled===false&&row.isNotTrusted===false&&row.deleteAction==='NO_ACTION'&&row.updateAction==='NO_ACTION'),'ISOLATED_COPY_FINITE_FK_UNVERIFIED');
}
export function isolatedCopyRequestBody(context,actor,operation,payload){
 assertIsolatedCopyContext(context);copyAssert(Object.hasOwn(ISOLATED_COPY_OPERATION_PERMISSIONS,operation)&&payload&&typeof payload==='object'&&!Array.isArray(payload),'ISOLATED_COPY_OPERATION',400);
 copyAssert(isolatedCopyUUID(payload.requestId),'ISOLATED_COPY_REQUEST_REQUIRED',400);
 // Reject client-owned identity fields instead of silently overriding them.
 copyAssert(!['copyId','sealHash','backupSHA','operationOrigin','actorId','operation','testProfile','testDayId','businessDailyScopeHash','businessCustomerId','businessProductIds','businessSelectedSalePolicyHash','sourceSelectionHash','selectedSaleIntent'].some(k=>Object.hasOwn(payload,k)),'ISOLATED_COPY_CLIENT_PROFILE',400);
 const dailyHash=getBusinessDailyScopeHash(context),inbound=['count_create','count_update','count_submit','count_cancel','goods_accept','goods_reject','purchase_draft','purchase_finalize'].includes(operation);
 const json=isolatedCopyJSON({...payload,copyId:context.copyId,sealHash:context.sealHash,actorId:String(actor.id),operation,operationOrigin:context.operationOrigin,...(dailyHash&&!inbound?{businessDailyScopeHash:dailyHash}:{})});
 return {json,hash:isolatedCopyHash(JSON.parse(json)),requestId:payload.requestId};
}
// Only a server domain may supply a selection. Recalculate every identity and
// policy field from the sealed SOURCE profile; never accept them in the body.
export function isolatedCopySelectedSaleRequestBody(context,actor,operation,payload,selection){
 const body=isolatedCopyRequestBody(context,actor,operation,payload);
 copyAssert(!Object.hasOwn(payload,'businessAccountId')&&!Object.hasOwn(payload,'businessCurrency'),'ISOLATED_COPY_CLIENT_PROFILE',400);
 copyAssert(['sale_draft','sale_finalize','sale_cancel'].includes(operation),'SELECTED_SALE_INTENT_OPERATION');
 copyAssert(selection&&typeof selection==='object','SELECTED_SALE_SERVER_SELECTION_REQUIRED');
 const expected=selectBusinessSaleWriteIntent(context,{customerId:selection.customerId,currency:selection.currency,productIds:selection.productIds});
 copyAssert(isolatedCopyJSON(selection)===isolatedCopyJSON(expected),'SELECTED_SALE_SERVER_SELECTION_REQUIRED');
 const value={...parse(body.json),businessCustomerId:expected.customerId,businessAccountId:expected.customerAccountId,businessCurrency:expected.currency,businessProductIds:expected.productIds,businessSelectedSalePolicyHash:expected.policyHash,sourceSelectionHash:expected.sourceSelectionHash};
 delete value.businessDailyScopeHash;
 const json=isolatedCopyJSON(value);return{json,hash:isolatedCopyHash(value),requestId:body.requestId};
}
function effectProof(value,context,actor,operation,body){
 const proof=parse(value);
 const sqlUUID=value=>typeof value==='string'&&isolatedCopyUUID(value.toLowerCase())?value.toLowerCase():null;
 copyAssert(proof.valid===true&&sqlUUID(proof.copyId)===context.copyId&&proof.sealHash===context.sealHash&&sqlUUID(proof.requestId)===body.requestId&&String(proof.actorId)===String(actor.id)&&proof.operation===operation&&proof.payloadHash===body.hash&&proof.stockVerified===true&&proof.partyAccountsVerified===true&&proof.financeAccountsVerified===true&&proof.protectedRowsVerified===true,'ISOLATED_COPY_EFFECT_UNVERIFIED');
 return proof;
}

// Native callbacks are server code supplied by the existing domain adapter,
// never JSON/HTTP handlers. The store adds a copy-only transaction boundary and
// the existing engines retain responsibility for invoice/finance arithmetic.
export function createIsolatedOperationCopyStore({getRuntime,buildDomain,domain='trade',readPermission='sales.view'}={}){
 copyAssert(typeof getRuntime==='function'&&typeof buildDomain==='function'&&domains.has(domain),'ISOLATED_COPY_STORE_DEPENDENCIES');
 async function transaction(actor,write,fn,permission=readPermission,automatic=null,readPath=null){
  const r=await getRuntime(),context=assertIsolatedCopyContext(r.copyContext),q=r.sql,selected=getRegisteredBusinessSelectedSaleRevision(context);
  copyAssert(q&&r.pool,'ISOLATED_COPY_RUNTIME');
  const tx=new q.Transaction(r.pool);await tx.begin(q.ISOLATION_LEVEL.SERIALIZABLE);const req=()=>new q.Request(tx);
  try{
   const identity=(await req().query(identitySQL)).recordset?.[0];assertIsolatedCopyIdentity(context,identity);
   // Readers join the same copy lock before acquiring data locks. Shared reads
   // remain concurrent; existing exclusive writers cannot invert the lock order.
   await req().input('lockKey',q.NVarChar(255),'melisa-stage4-copy:'+context.copyId).query(`DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=@lockKey,@LockMode=N'${write?'Exclusive':'Shared'}',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51401,'ISOLATED_COPY_BUSY',1;`);
   if(getBusinessDailyScopeHash(context))await verifyBusinessDailyNativeCheck(context,req());
   await verifyBusinessReadinessQueryPlan(context,req());
   // Only readHome can select this route. Its pinned context still executes
   // full ready on every request; every other caller retains the outer call.
   const contextRunsReady=readPath===homeRead&&await verifyBusinessDailyHomeReadProof(context,req().input('copy_id',q.UniqueIdentifier,context.copyId),{domain,write,automatic});
   if(!contextRunsReady)await req().input('copy_id',q.UniqueIdentifier,context.copyId).execute(ISOLATED_COPY_PROCEDURES.ready);
   assertFiniteCopyForeignKeys((await req().query(ISOLATED_COPY_FINITE_FK_SQL)).recordset);
   const selection=context.target.database===BUSINESS_COPY_DATABASE?getBusinessInboundSelection(context):null;
   const contextRequest=()=>{const r=req().input('copy_id',q.UniqueIdentifier,context.copyId).input('actor_id',q.BigInt,safeId(actor?.id)).input('domain',q.NVarChar(20),domain);if(context.target.database===BUSINESS_COPY_DATABASE)r.input('supplier_id',q.BigInt,selection?.supplierId??null).input('currency',q.NVarChar(3),selection?.currency??null);return r;};
   const row=(await contextRequest().execute(ISOLATED_COPY_PROCEDURES.context)).recordset?.[0];
   const readProof=parse(row?.proof_json),actual=parse(row?.actor_json),normalContext=bindIsolatedCopyOperationDTO(context,parse(row?.context_json));
   assertIsolatedCopyReadProof(context,readProof);assertIsolatedCopyActor(context,actor,actual,permission);
   const nativeContext={pool:r.pool,sqlDriver:q,transaction:tx,isolatedOperationCopy:context};
   const reloadContext=async()=>{
    if(getBusinessDailyScopeHash(context))await verifyBusinessDailyNativeCheck(context,req());
    await verifyBusinessReadinessQueryPlan(context,req());
    if(contextRunsReady)await verifyBusinessDailyHomeReadProof(context,req().input('copy_id',q.UniqueIdentifier,context.copyId),{domain,write,automatic});
    const fresh=(await contextRequest().execute(ISOLATED_COPY_PROCEDURES.context)).recordset?.[0];
    assertIsolatedCopyReadProof(context,parse(fresh?.proof_json));assertIsolatedCopyActor(context,actor,parse(fresh?.actor_json),permission);
    Object.assign(normalContext,parse(fresh?.context_json));bindIsolatedCopyOperationDTO(context,normalContext);return normalContext;
   };
   const readSelectedSaleContext=selected?selection=>readBusinessSelectedSaleNativeContext({copy:context,transaction:tx,sql:q,request:req,artifact:selected.bundle.contextArtifact,actor,selection}):undefined;
   // Only historical invoice reads use the narrow projection. Preview and every
   // writer retain the full owner selected-context/intent reader. The closure
   // is created after fresh READY+owner context, and invoked inside the same
   // branded read scope below; it cannot escape to another transaction.
   const readSelectedSaleInvoiceState=selected&&!write&&domain==='trade'?createBusinessSelectedSaleInvoiceReader({copy:context,transaction:tx,sql:q,request:req,artifact:selected.bundle.contextArtifact,actor,actual,readProof}):undefined;
   const c=await buildDomain({runtime:r,copyContext:context,context:normalContext,actor,actual,identity,nativeContext,request:req,write,reloadContext,readSelectedSaleContext,readSelectedSaleInvoiceState});
   copyAssert(c&&typeof c==='object'&&c.context===normalContext,'ISOLATED_COPY_DOMAIN_CONTEXT');
   c.request=async requestId=>{
    copyAssert(isolatedCopyUUID(requestId),'ISOLATED_COPY_REQUEST_REQUIRED',400);
    const prior=(await req().input('copy_id',q.UniqueIdentifier,context.copyId).input('request_id',q.UniqueIdentifier,requestId).input('actor_id',q.BigInt,safeId(actor.id)).query('SELECT operation,response_json FROM dbo.stage4_copy_requests WHERE copy_id=@copy_id AND request_id=@request_id AND actor_id=@actor_id;')).recordset?.[0];
    copyAssert(prior,'ISOLATED_COPY_REQUEST_NOT_FOUND',404);return{requestId,operation:prior.operation,response:parse(prior.response_json)};
   };
   const effects=async(operation,body,response,replay)=>{
    const proof=(await req().input('copy_id',q.UniqueIdentifier,context.copyId).input('request_id',q.UniqueIdentifier,body.requestId).input('actor_id',q.BigInt,safeId(actor.id)).input('operation',q.NVarChar(40),operation).input('payload_hash',q.Char(64),body.hash).input('response_json',q.NVarChar(q.MAX),isolatedCopyJSON(response)).input('replay',q.Bit,replay).execute(ISOLATED_COPY_PROCEDURES.effects)).recordset?.[0];
    const raw=proof?.effect_proof_json;
    return {proof:effectProof(raw,context,actor,operation,body),raw};
   };
   const journal=async(operation,payload,execute,selection=null)=>{
    copyAssert(write&&typeof execute==='function','ISOLATED_COPY_WRITE_TRANSACTION');
    const body=selection?isolatedCopySelectedSaleRequestBody(context,actor,operation,payload,selection):isolatedCopyRequestBody(context,actor,operation,payload);
    assertIsolatedCopyActor(context,actor,actual,ISOLATED_COPY_OPERATION_PERMISSIONS[operation]);
    const prior=(await req().input('copy_id',q.UniqueIdentifier,context.copyId).input('request_id',q.UniqueIdentifier,body.requestId).query('SELECT actor_id,operation,payload_hash,payload_json,response_json,effect_proof_json FROM dbo.stage4_copy_requests WITH(UPDLOCK,HOLDLOCK) WHERE copy_id=@copy_id AND request_id=@request_id;')).recordset?.[0];
    if(prior){
     copyAssert(String(prior.actor_id)===String(actor.id)&&prior.operation===operation&&prior.payload_hash===body.hash&&prior.payload_json===body.json,'ISOLATED_COPY_REQUEST_CONFLICT',409);
     const response=parse(prior.response_json);await effects(operation,body,response,true);return {...response,replayed:true};
    }
    await req().input('copy_id',q.UniqueIdentifier,context.copyId).input('request_id',q.UniqueIdentifier,body.requestId).input('actor_id',q.BigInt,safeId(actor.id)).input('operation',q.NVarChar(40),operation).input('payload_hash',q.Char(64),body.hash).input('payload_json',q.NVarChar(q.MAX),body.json).execute(ISOLATED_COPY_PROCEDURES.begin);
    const response=selection?await withBusinessSelectedSaleWriteScope({copy:context,transaction:tx,sql:q,request:req,artifact:selected.bundle.writeScopeArtifact,actor,operation,requestId:body.requestId},execute):await execute();
    const proof=await effects(operation,body,response,false);
    // The SQL intent seals this exact text. Preserve its order and GUID casing;
    // a JS reserialization would no longer equal the immutable SQL proof.
    await req().input('copy_id',q.UniqueIdentifier,context.copyId).input('request_id',q.UniqueIdentifier,body.requestId).input('actor_id',q.BigInt,safeId(actor.id)).input('operation',q.NVarChar(40),operation).input('payload_hash',q.Char(64),body.hash).input('payload_json',q.NVarChar(q.MAX),body.json).input('response_json',q.NVarChar(q.MAX),isolatedCopyJSON(response)).input('effect_proof_json',q.NVarChar(q.MAX),proof.raw).query('INSERT dbo.stage4_copy_requests(copy_id,request_id,actor_id,operation,payload_hash,payload_json,response_json,effect_proof_json) VALUES(@copy_id,@request_id,@actor_id,@operation,@payload_hash,@payload_json,@response_json,@effect_proof_json);');
    return response;
   };
   c.journal=(operation,payload,execute)=>journal(operation,payload,execute);
   c.selectedSaleJournal=(operation,payload,selection,execute)=>journal(operation,payload,execute,selection);
   const run=async()=>{
    if(!automatic)return fn(c);
    if(automatic.selected&&selected&&context.target.database===BUSINESS_COPY_DATABASE){
     copyAssert(typeof c.selectedSaleSelection==='function'&&typeof c.useSelectedSaleContext==='function','SELECTED_SALE_DOMAIN_REQUIRED');
     const selection=await c.selectedSaleSelection(automatic.operation,automatic.payload);
     return c.selectedSaleJournal(automatic.operation,automatic.payload,selection,async dto=>{c.useSelectedSaleContext(dto);return fn(c);});
    }
    return c.journal(automatic.operation,automatic.payload,()=>fn(c));
   };
   const result=await withIsolatedOperationCopyScope({context,identity,transaction:tx,readProof,write},run);
   // Identity is checked again immediately before committing the same connection.
   assertIsolatedCopyIdentity(context,(await req().query(identitySQL)).recordset?.[0]);
   await tx.commit();return result;
  }catch(error){try{await tx.rollback();}catch{}if(error.number===51401||error.originalError?.info?.number===51401)copyAssert(false,'ISOLATED_COPY_BUSY',503);throw error;}
 }
 return {
  selectedSaleEnabled:async()=>{const r=await getRuntime();return !!getRegisteredBusinessSelectedSaleRevision(r.copyContext);},
  context:actor=>transaction(actor,false,c=>c.context),
  read:(actor,fn,permission)=>transaction(actor,false,fn,permission??readPermission),
  readHome:(actor,fn)=>transaction(actor,false,fn,readPermission,null,homeRead),
  mutate:(actor,operation,payload,fn)=>typeof operation==='function'?transaction(actor,true,operation):transaction(actor,true,fn,readPermission,{operation,payload}),
  mutateSelectedSale:(actor,operation,payload,fn)=>transaction(actor,true,fn,readPermission,{operation,payload,selected:true}),
 };
}
