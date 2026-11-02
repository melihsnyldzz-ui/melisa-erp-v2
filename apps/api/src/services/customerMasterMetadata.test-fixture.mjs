// SQL driver double; no native connection, config, credential or app startup.
import {customerMasterSqlFixture} from './customerMasterSql.test-fixture.mjs';
import {createCanonicalCustomerMasterRuntime,CUSTOMER_MASTER_NORMAL_TARGET as target,CUSTOMER_MASTER_NORMAL_LOGIN as login} from './customerMasterCanonicalRuntime.mjs';
import {createCustomerMasterMetadataReader} from './customerMasterMetadata.mjs';
import {CUSTOMER_MASTER_NORMAL_COLUMN_SETS as SHAPE} from './customerMasterCanonicalSql.mjs';
import {CUSTOMER_MASTER_METADATA_IDENTITY_SQL as IDENTITY,CUSTOMER_MASTER_METADATA_SQL as CATALOG,CUSTOMER_MASTER_METADATA_OBJECTS as OBJECTS,CUSTOMER_MASTER_METADATA_COLUMNS as COLUMNS} from './customerMasterMetadataSql.mjs';
const h='A'.repeat(64);
export function metadataIdentity(){return {databaseName:target.database,serverName:target.server,loginName:login,databaseUser:login,originalLogin:login,sysadmin:0,databaseControl:0,liveDatabaseAccess:0};}
export function metadataCatalog(){
 const objects=OBJECTS.map((objectName,i)=>({objectName,objectId:i+100,objectType:'U ',databaseVisible:1,schemaVisible:1,objectVisible:1,totalColumns:objectName==='dbo.customers'?30:8,totalDefaults:i===2?1:i===3?null:0,totalChecks:[3,2,1,null][i]}));
 const columns=OBJECTS.flatMap(objectName=>{const native=objectName==='dbo.customers',shape=native?[['id','bigint',8],['customer_code','nvarchar',100],['name','nvarchar',500],['customer_type','nvarchar',60]]:SHAPE[objectName.replace('dbo.customer_master_','').replace('_v1','')];return shape.map(([columnName,typeName,maxLength,nullable],i)=>({objectName,columnName,columnId:i+1,typeName,maxLength,precision:0,scale:0,nullable:!!nullable,identityColumn:native&&columnName==='id',computedColumn:false,aliasType:false,collation:typeName==='nvarchar'||typeName==='char'?(columnName==='scope_key'?'Latin1_General_100_BIN2':'Turkish_CI_AS'):null}));});
 const indexes=OBJECTS.flatMap(objectName=>{const keys=objectName==='dbo.customers'?[['id']]:objectName.endsWith('local_v1')?[['scope_key','customer_id'],['scope_key','customer_code']]:[['scope_key','request_id']];return keys.flatMap((key,n)=>key.map((columnName,i)=>({objectName,indexId:n+1,indexType:n===0?1:2,primaryKey:n===0,uniqueIndex:true,disabled:false,filtered:false,filterHash:null,indexColumnId:i+1,keyOrdinal:i+1,included:false,descendingKey:false,columnName})));});
 const foreignKeys=OBJECTS.slice(0,3).flatMap((objectName,n)=>{const pairs=n===0?[['customer_id','id']]:n===1?[['scope_key','scope_key'],['customer_id','customer_id']]:[['scope_key','scope_key'],['request_id','request_id']];return pairs.map(([columnName,referencedColumn],i)=>({objectName,foreignKeyId:1000+n,ordinal:i+1,columnName,referencedObject:OBJECTS[n===0?3:n-1],referencedColumn,disabled:false,notTrusted:false,deleteAction:0,updateAction:0}));});
 const defaults=[{objectName:OBJECTS[2],constraintId:2000,columnName:'created_at',definitionHash:h,kind:'UTC_NOW'}];
 const checks=OBJECTS.slice(0,3).flatMap((objectName,n)=>['TARGET_SCOPE_FIXED',...(n===0?['VERSION_POSITIVE','CUSTOMER_TYPE_SET']:n===1?['COMMITTED_VERSION_POSITIVE']:[])].map((kind,i)=>({objectName,constraintId:3000+n*10+i,disabled:false,notTrusted:false,usesDatabaseCollation:false,definitionHash:h,kind})));
 const permissions=OBJECTS.flatMap(objectName=>{const native=objectName==='dbo.customers',local=objectName===OBJECTS[0];return [...(native?['SELECT','VIEW DEFINITION']:['SELECT','INSERT','UPDATE','DELETE','VIEW DEFINITION','CONTROL']).map(permissionName=>({objectName,columnName:null,permissionName,permissionValue:['SELECT','INSERT','VIEW DEFINITION'].includes(permissionName)?1:0})),...COLUMNS[objectName].flatMap(columnName=>(native?['SELECT','REFERENCES']:['SELECT','UPDATE']).map(permissionName=>({objectName,columnName,permissionName,permissionValue:permissionName==='SELECT'||local&&['customer_code','customer_name','customer_type','version','updated_by'].includes(columnName)?1:0})))];});
 return [[metadataIdentity()],objects,columns,indexes,foreignKeys,defaults,checks,permissions];
}
export async function customerMasterMetadataFixture(){
 const options=customerMasterSqlFixture({normal:true}).normalOptions,catalog=metadataCatalog(),modes={},calls=[];let poolCalls=0;
 class Request{constructor(parent){this.parent=parent;}async query(text){calls.push(text);if(modes.error)throw modes.error;if(text===IDENTITY){if(modes.lastIdentity&&calls.length===3)return {recordset:[{...metadataIdentity(),...modes.lastIdentity}]};return {recordset:[{...metadataIdentity(),...modes.identity}]};}if(text!==CATALOG)throw Error('Unexpected SQL');return {recordsets:catalog};}}
 const pool={connected:true,connecting:false,config:{requestTimeout:10000},request:()=>new Request(pool)};
 options.database.getSqlPool=async()=>{poolCalls++;return pool;};options.database.getSqlDriver=()=>({Request});
 const runtime=await createCanonicalCustomerMasterRuntime(options),reader=createCustomerMasterMetadataReader({getRuntime:()=>runtime});
 return {reader,runtime,pool,catalog,calls,modes,poolCalls:()=>poolCalls,nativeSql:false};
}
