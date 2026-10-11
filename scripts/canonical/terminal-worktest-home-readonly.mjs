import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,BUSINESS_COPY_DATABASE,ISOLATED_COPY_PROCEDURES} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {configureBusinessDailyRevision,BUSINESS_DAILY_REVISION_PROOF_SQL} from '../../apps/api/src/services/businessDailyRevisionBootstrap.mjs';
import {businessDailyProfitReadSQL} from '../../apps/api/src/services/businessDailyProfitRevision.mjs';
import {businessDailyNativeCheckReadSQL} from '../../apps/api/src/services/businessDailyNativeCheck.mjs';
import {businessReadinessQueryPlanReadSQL} from '../../apps/api/src/services/businessReadinessQueryPlanRevision.mjs';
import {ISOLATED_COPY_FINITE_FK_SQL} from '../../apps/api/src/services/isolatedOperationCopyStoreFactory.mjs';
import {createHomeSummaryReadStore,BUSINESS_INBOUND_HOME_SUMMARY_SQL} from '../../apps/api/src/services/homeSummaryReadStoreFactory.mjs';
import {createHomeSummaryService} from '../../apps/api/src/services/createHomeSummaryServiceFactory.mjs';

export const TERMINAL_WORKTEST_HOME_PATH='/api/terminal-worktest/home-summary';
export const TERMINAL_HOME_IDENTITY_SQL="SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess";
// This is the existing copy reader's transaction lock, never an arbitrary EXEC.
export const TERMINAL_HOME_SHARED_LOCK_SQL="DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=@lockKey,@LockMode=N'Shared',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51401,'ISOLATED_COPY_BUSY',1;";
const denied=(statusCode=503)=>Object.assign(new Error('Günlük işler bağlantısı doğrulanamadı.'),{code:'WORKTEST_HOME_UNAVAILABLE',statusCode});
const permissions=value=>Array.isArray(value)&&value.every(p=>typeof p==='string'&&/^[a-z][a-z0-9_.]*$/.test(p))&&new Set(value).size===value.length?value.toSorted():null;
export function assertTerminalHomeActor(actor,context){
 assertIsolatedCopyContext(context);
 const sealed=context.actors.find(a=>a.id===String(actor?.id)),rights=permissions(actor?.permissions);
 if(context.target.database!==BUSINESS_COPY_DATABASE||!sealed||!['15','16'].includes(sealed.id)||actor?.role?.code!==sealed.role||actor.isAdmin===true||actor.active===false||actor.isActive===false||!rights?.includes('goods.view'))throw denied(403);
 return actor;
}
// Only the current, pinned reader/bootstrap queries may enter this writer-login
// pool. Table-variable INSERTs and exact SELECT-only metadata EXEC strings are
// accepted by equality; general SQL, batch/bulk and native writes are closed.
export function createTerminalHomeReadonlySql(native,{context,actor=null}={}){
 assertIsolatedCopyContext(context);if(actor)assertTerminalHomeActor(actor,context);
 const queries=new Set([TERMINAL_HOME_IDENTITY_SQL,TERMINAL_HOME_SHARED_LOCK_SQL,ISOLATED_COPY_FINITE_FK_SQL,BUSINESS_INBOUND_HOME_SUMMARY_SQL,BUSINESS_DAILY_REVISION_PROOF_SQL,businessDailyProfitReadSQL(),businessDailyNativeCheckReadSQL(),businessReadinessQueryPlanReadSQL()]);
 class Request extends native.Request{
  query(text,...args){if(args.length||!queries.has(text))throw denied();return super.query(text);}
  async execute(name,...args){
   if(args.length||![ISOLATED_COPY_PROCEDURES.ready,ISOLATED_COPY_PROCEDURES.context].includes(name)||name===ISOLATED_COPY_PROCEDURES.context&&!actor)throw denied();
   const result=await super.execute(name);
   if(name===ISOLATED_COPY_PROCEDURES.context){
    let actual;try{actual=JSON.parse(result?.recordset?.[0]?.actor_json);}catch{throw denied();}
    const sealed=context.actors.find(a=>a.id===String(actor.id)),upstream=permissions(actor.permissions),fresh=permissions(actual?.permissions);
    if(result.recordset.length!==1||String(actual?.id)!==sealed.id||actual.role!==sealed.role||actual.active!==true||!fresh||JSON.stringify(fresh)!==JSON.stringify(upstream))throw denied(403);
   }
   return result;
  }
  batch(){throw denied();}
  bulk(){throw denied();}
 }
 return {...native,Request};
}
export function createTerminalHomeSummary({native,pool,context,clock}={}){
 assertIsolatedCopyContext(context);
 return async actor=>{
  assertTerminalHomeActor(actor,context);
  // A separate Request class captures each authenticated actor; concurrent
  // requests cannot replace one another's native permission comparison.
  const sql=createTerminalHomeReadonlySql(native,{context,actor}),runtime={pool,sql,copyContext:context};
  const store=createHomeSummaryReadStore({getRuntime:async()=>runtime});
  return createHomeSummaryService({store,...(clock?{clock}:{})}).summary(actor);
 };
}
export async function initializeTerminalHomeReadonly({native,pool,context,config}={}){
 assertIsolatedCopyContext(context);
 if(context.target.database!==BUSINESS_COPY_DATABASE||!config?.businessDailyRevision)throw denied();
 const sql=createTerminalHomeReadonlySql(native,{context}),guardedPool={request:()=>new sql.Request(pool)};
 assertIsolatedCopyIdentity(context,(await guardedPool.request().query(TERMINAL_HOME_IDENTITY_SQL)).recordset?.[0]);
 await configureBusinessDailyRevision(context,config.businessReadyRevision,config.businessReadyPerformanceRevision,config.businessEffectsPerformanceRevision,config.businessDailyRevision,guardedPool,config.businessDailyProfitRevision,config.businessDailyNativeCheck,config.businessReadinessQueryPlanRevision);
 return createTerminalHomeSummary({native,pool,context});
}
