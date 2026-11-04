import {createCanonicalCustomerMasterBinding} from './customerMasterCanonicalBinding.mjs';
import {customerMasterError} from './customerMasterModel.mjs';
import {createCustomerMasterMetadataCheckAssets} from './customerMasterMetadataCheckAssets.mjs';
import {CUSTOMER_MASTER_NORMAL_TARGET,CUSTOMER_MASTER_NORMAL_LOGIN} from './customerMasterCanonicalRuntime.mjs';
import {CUSTOMER_MASTER_NORMAL_COLUMN_SETS} from './customerMasterCanonicalSql.mjs';
import {assertCanonicalBusinessSession,BUSINESS_SESSION} from './canonicalBusinessSessionContext.mjs';

const masterNames=['dbo.customer_master_local_v1','dbo.customer_master_requests_v1','dbo.customer_master_audit_v1'];
// A completed metadata observation is a startup routing precondition, never
// transaction authority. The SQL store still validates its locked frame before
// and after every operation and fails closed on any later drift.
export function customerMasterWriterMetadataCompatible(result){
 try{
  if(result?.status!=='OBSERVED'||result.schemaVersion!=='melisa-customer-master-metadata.v1'||result.consistency!=='NON_TRANSACTIONAL_OBSERVATION_NOT_WRITE_ADMISSION'||result.queryScope!=='SELECT_ONLY'||result.queryCount!==3||result.commercialRowsRead!==false||result.writeStatements!==0||result.target?.server!==CUSTOMER_MASTER_NORMAL_TARGET.server||result.target?.database!==CUSTOMER_MASTER_NORMAL_TARGET.database||result.identity?.serverName!==CUSTOMER_MASTER_NORMAL_TARGET.server||result.identity?.databaseName!==CUSTOMER_MASTER_NORMAL_TARGET.database||result.identity?.loginName!==CUSTOMER_MASTER_NORMAL_LOGIN||result.identity?.databaseUser!==CUSTOMER_MASTER_NORMAL_LOGIN||result.identity?.originalLogin!==CUSTOMER_MASTER_NORMAL_LOGIN||result.identity?.sysadmin!==0||result.identity?.databaseControl!==0||result.identity?.liveDatabaseAccess!==0||!Array.isArray(result.objects)||result.objects.length!==4)return false;
  const names=[...masterNames,'dbo.customers'];
  if(new Set(result.objects.map(o=>o.name)).size!==4||!names.every(n=>result.objects.some(o=>o.name===n)))return false;
  for(const name of names){const o=result.objects.find(v=>v.name===name),native=name==='dbo.customers',part=native?null:name.slice('dbo.customer_master_'.length,-'_v1'.length);
   const expected={columns:'MATCH',primaryKey:'MATCH',uniqueCode:part==='local'?'MATCH':'NOT_APPLICABLE',foreignKeys:native?'NOT_APPLICABLE':'MATCH',collation:native?'NOT_APPLICABLE':'MATCH',defaults:native?'NOT_APPLICABLE':'MATCH',checks:native?'NOT_APPLICABLE':'MATCH'};
   if(o.status!=='PRESENT'||o.visibility!=='COMPLETE'||!o.compatibility||Object.keys(o.compatibility).length!==Object.keys(expected).length||Object.entries(expected).some(([k,v])=>o.compatibility[k]!==v)||!Array.isArray(o.observed?.permissions))return false;
   const required=native?['id','customer_code','name','customer_type']:CUSTOMER_MASTER_NORMAL_COLUMN_SETS[part].map(c=>c[0]);
   const permitted=(columnName,permissionName)=>o.observed.permissions.some(p=>p.columnName===columnName&&p.permissionName===permissionName&&p.permissionValue===1&&p.status==='GRANTED');
   if(!permitted(null,'VIEW DEFINITION')||!required.every(column=>permitted(column,'SELECT')))return false;
   if(name!=='dbo.customers'&&!permitted(null,'INSERT'))return false;
   if(name===masterNames[0]&&!['customer_code','customer_name','customer_type','version','updated_by'].every(column=>permitted(column,'UPDATE')))return false;
  }
  return true;
 }catch{return false;}
}

// Existing canonical bootstrap only. Reuse the exact pool it has already
// connected/admitted; never reacquire or create a connection for metadata.
async function prepareBinding({startup,database,getFinalContext,getCurrentFinanceContext}={}){
 const pool=startup?.pool;
 if(!pool||pool.connected!==true||pool.connecting!==false||typeof database?.getSqlDriver!=='function')throw customerMasterError();
 const existingDatabase=Object.freeze({
  isCanonicalTest:()=>database.isCanonicalTest(),
  isIsolatedOperationCopyRuntime:()=>database.isIsolatedOperationCopyRuntime(),
  getSqlPool:async()=>pool,
  getSqlDriver:()=>database.getSqlDriver()
 });
 return createCanonicalCustomerMasterBinding({database:existingDatabase,startup,getFinalContext,getCurrentFinanceContext});
}
export async function prepareCanonicalCustomerMasterMetadata(options={}){
 const binding=await prepareBinding(options);
 // Do not return or register binding.service/store/cards. Preparing this route
 // does not enable the global master writer or run any metadata request.
 return Object.freeze({read:binding.metadata.read,checkAssets:createCustomerMasterMetadataCheckAssets(options.startup.release)});
}

// Called only during the existing normal ERP bootstrap and only for an exact
// explicit config flag. A later metadata GET never calls this function or
// changes routing. UNKNOWN/DENIED/MISMATCH keeps the old read-only routes.
export async function prepareCanonicalCustomerMasterWriter(options={}){
 if(options?.startup?.config?.customerMasterWritesEnabled!==true)return null;
 const binding=await prepareBinding(options);
 if(!customerMasterWriterMetadataCompatible(await binding.metadata.read()))return null;
 // The actor comes exclusively from the already registered business session,
 // not a supplied customer, client claim, default role or metadata observation.
 try{
  const c=assertCanonicalBusinessSession(options.startup.businessSession);
  if(c.userId!==17||c.roleId!==17||c.username!==BUSINESS_SESSION.username||c.roleCode!==BUSINESS_SESSION.roleCode||c.database!==BUSINESS_SESSION.database||c.server!==BUSINESS_SESSION.server||c.actualT1!==false||c.externalOperations!==false||!Array.isArray(c.permissions))return null;
  const actor=Object.freeze({id:c.userId,role:Object.freeze({id:c.roleId,code:c.roleCode}),permissions:c.permissions});
  if(await binding.store.verifyNormalWriterFrame(actor)!==true)return null;
 }catch{return null;}
 const {createCustomerMasterCanonicalRoutes}=await import('../routes/customerMasterCanonicalRoutes.mjs');
 return createCustomerMasterCanonicalRoutes(binding);
}
