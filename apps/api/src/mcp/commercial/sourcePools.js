import sql from 'mssql/tedious.js';
import { getBionicVegaSqlPool,verifyBionicVegaPermissions } from '../../config/bionicVegaDatabase.js';
import { getBionicSqlPool,verifyBionicPermissions } from '../../config/bionicDatabase.js';
import { fail } from './policy.js';
export {sql};
const sources={vega:{get:getBionicVegaSqlPool,verify:verifyBionicVegaPermissions,database:'VEGA2026'},melisa:{get:getBionicSqlPool,verify:verifyBionicPermissions,database:'MELISA_ERP_V2'}};
const verified=new Map();
export async function sourcePool(source){
 const spec=sources[source];if(!spec)throw fail('SOURCE_NOT_ALLOWED');
 const pool=await spec.get();
 const last=verified.get(source);
 if(!last||Date.now()-last.at>30000){const proof=await spec.verify(pool);verified.set(source,{at:Date.now(),proof});}
 return pool;
}
export function sourceProof(source){return verified.get(source)?.proof||null;}
export function quote(name){if(typeof name!=='string'||!name||name.length>128)throw fail('INVALID_IDENTIFIER');return '['+name.replaceAll(']',']]')+']';}
export async function assertObjectRead(pool,object){
 const request=pool.request().input('objectName',sql.NVarChar(260),quote(object.schemaName)+'.'+quote(object.objectName));
 request.timeout=5000;
 const row=(await request.query(`SELECT HAS_PERMS_BY_NAME(@objectName,'OBJECT','SELECT') AS canRead,
 HAS_PERMS_BY_NAME(@objectName,'OBJECT','INSERT') AS canInsert,HAS_PERMS_BY_NAME(@objectName,'OBJECT','UPDATE') AS canUpdate,
 HAS_PERMS_BY_NAME(@objectName,'OBJECT','DELETE') AS canDelete,HAS_PERMS_BY_NAME(@objectName,'OBJECT','ALTER') AS canAlter,
 HAS_PERMS_BY_NAME(@objectName,'OBJECT','CONTROL') AS canControl,HAS_PERMS_BY_NAME(@objectName,'OBJECT','EXECUTE') AS canExecute`)).recordset[0];
 if(!row||row.canRead!==1)throw fail('DATASET_READ_PERMISSION_MISSING');
 if(['canInsert','canUpdate','canDelete','canAlter','canControl'].some(k=>row[k]!==0)||row.canExecute===1)throw fail('READ_ONLY_PERMISSION_CHECK_FAILED');
}
export async function readQuery(source,objects,statement,parameters=[]){
 if(!/^\s*SELECT\b/i.test(statement))throw fail('INTERNAL_QUERY_NOT_SELECT');
 const pool=await sourcePool(source);
 for(const object of objects)await assertObjectRead(pool,object);
 const request=pool.request();request.timeout=12000;
 for(const {name,type,value} of parameters)request.input(name,type,value);
 try{return(await request.query(statement)).recordset;}catch(error){
   if(error.code==='ETIMEOUT')throw fail('QUERY_TIMEOUT');
   if(error.number===229)throw fail('DATASET_READ_PERMISSION_MISSING');
   throw fail('SOURCE_READ_FAILED');
 }
}
