import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,BUSINESS_COPY_DATABASE,copyAssert} from './isolatedOperationCopyContext.mjs';
import {workActor,workKeys,workId,workSelection} from './workSalesModel.mjs';
import {selectBusinessSalePreview,readBusinessSelectedSalePreviewContext,businessSelectedSalePreview} from './businessSelectedSalePreview.mjs';
import {prepareBusinessSelectedSaleContextSQL} from '../../../../scripts/canonical/shared-business-selected-sale-preview-sql.mjs';

const preparations=new WeakMap();
const identitySQL="SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess";
const sharedLockSQL="DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=@lockKey,@LockMode=N'Shared',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51401,'ISOLATED_COPY_BUSY',1;";

async function defaultRuntime(){
 const db=await import('../config/database.js');
 copyAssert(db.isIsolatedOperationCopyRuntime(),'SELECTED_SALE_READ_RUNTIME');
 const copyContext=assertIsolatedCopyContext(db.getIsolatedOperationCopyConfig());
 copyAssert(copyContext.target.database===BUSINESS_COPY_DATABASE,'SELECTED_SALE_DB02_ONLY');
 return {copyContext,pool:await db.getSqlPool(),sql:db.getSqlDriver()};
}
function readActor(actor){
 const a=workActor(actor,'sales.view');workActor(a,'sales.create');
 return Object.freeze({id:a.id,permissions:Object.freeze([...a.permissions])});
}
function selectionInput(input){
 workKeys(input,['customerId','currency','productIds']);
 copyAssert(Array.isArray(input.productIds),'SELECTED_SALE_ITEMS',400);
 return {customerId:workId(input.customerId),currency:input.currency,productIds:input.productIds.map(workId)};
}
function rollbackFailure(primary,rollbackError,failed){
 // Retain the original failure as the cause and first error; cleanup failure
 // must also be visible rather than silently claiming a successful rollback.
 const errors=failed?[primary,rollbackError]:[rollbackError];
 return Object.assign(new AggregateError(errors,'Salt okunur işlem geri alınamadı.',{cause:failed?primary:rollbackError}),{
  code:'SELECTED_SALE_READ_ROLLBACK_FAILED',statusCode:503,primaryError:failed?primary:undefined,rollbackError
 });
}

// Server dependencies only. There is no domain callback, journal, writer or
// client-owned proof flag. Prepared source text is cached; native proofs and
// source/price/stock/FX/role rows are read afresh inside each transaction.
export function createBusinessSelectedSalePreviewStore({getRuntime=defaultRuntime}={}){
 copyAssert(typeof getRuntime==='function','SELECTED_SALE_READ_DEPENDENCIES');
 async function read(selection,actor,previewInput=null){
  const runtime=await getRuntime(),copy=assertIsolatedCopyContext(runtime?.copyContext),sql=runtime.sql;
  copyAssert(copy.target.database===BUSINESS_COPY_DATABASE,'SELECTED_SALE_DB02_ONLY');
  copyAssert(copy.actors.some(a=>a.id===actor.id),'ISOLATED_COPY_FORBIDDEN',403);
  const selected=selectBusinessSalePreview(copy,selection);
  let artifact=preparations.get(copy);
  if(!artifact){artifact=prepareBusinessSelectedSaleContextSQL(copy);preparations.set(copy,artifact);}
  copyAssert(runtime.pool&&typeof sql?.Transaction==='function'&&typeof sql.Request==='function'&&sql.ISOLATION_LEVEL?.SERIALIZABLE!==undefined,'SELECTED_SALE_READ_RUNTIME');
  const tx=new sql.Transaction(runtime.pool),request=()=>new sql.Request(tx);
  let begun=false,failed=false,primary,result;
  try{
   await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
   const identity=async()=>{const rows=(await request().query(identitySQL)).recordset;copyAssert(rows?.length===1,'SELECTED_SALE_READ_IDENTITY');assertIsolatedCopyIdentity(copy,rows[0]);};
   await identity();
   await request().input('lockKey',sql.NVarChar(255),'melisa-stage4-copy:'+copy.copyId).query(sharedLockSQL);
   const context=await readBusinessSelectedSalePreviewContext({copy,sql,request,artifact,selected,actor});
   result=previewInput?businessSelectedSalePreview(previewInput,context,actor):context;
   await identity();
  }catch(error){failed=true;primary=error;}
  if(begun){try{await tx.rollback();}catch(error){throw rollbackFailure(primary,error,failed);}}
  if(failed)throw primary;
  return result;
 }
 return Object.freeze({
  context(input,actor){const a=readActor(actor),selection=selectionInput(input);return read(selection,a);},
  preview(input,actor){const a=readActor(actor),selection=workSelection(input,{allowBusinessCurrencies:true});return read({customerId:selection.customerId,currency:selection.currency,productIds:selection.items.map(p=>p.productId)},a,selection);}
 });
}

export const businessSelectedSalePreviewStore=createBusinessSelectedSalePreviewStore();
