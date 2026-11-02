// Planning observation only. Never a write-admission receipt or SQL executor
// for caller-provided text. The caller supplies an already admitted live pool.
import {createHash} from 'node:crypto';
import {canonicalCustomerMasterMetadataRuntime,CUSTOMER_MASTER_NORMAL_TARGET,CUSTOMER_MASTER_NORMAL_LOGIN} from './customerMasterCanonicalRuntime.mjs';
import {CUSTOMER_MASTER_NORMAL_COLUMN_SETS} from './customerMasterCanonicalSql.mjs';
import {customerMasterError} from './customerMasterModel.mjs';
import {CUSTOMER_MASTER_METADATA_IDENTITY_SQL as IDENTITY,CUSTOMER_MASTER_METADATA_SQL as CATALOG,CUSTOMER_MASTER_METADATA_OBJECTS as OBJECTS,CUSTOMER_MASTER_METADATA_COLUMNS as COLUMNS,CUSTOMER_MASTER_METADATA_LIMITS as LIMITS} from './customerMasterMetadataSql.mjs';
const names=['objects','columns','indexes','foreignKeys','defaults','checks','permissions'];
const schemas=[['objectName','objectId','objectType','databaseVisible','schemaVisible','objectVisible','totalColumns','totalDefaults','totalChecks'],['objectName','columnName','columnId','typeName','maxLength','precision','scale','nullable','identityColumn','computedColumn','aliasType','collation'],['objectName','indexId','indexType','primaryKey','uniqueIndex','disabled','filtered','filterHash','indexColumnId','keyOrdinal','included','descendingKey','columnName'],['objectName','foreignKeyId','ordinal','columnName','referencedObject','referencedColumn','disabled','notTrusted','deleteAction','updateAction'],['objectName','constraintId','columnName','definitionHash','kind'],['objectName','constraintId','disabled','notTrusted','usesDatabaseCollation','definitionHash','kind'],['objectName','columnName','permissionName','permissionValue']];
const identityKeys=['databaseName','serverName','loginName','databaseUser','originalLogin','sysadmin','databaseControl','liveDatabaseAccess'];
class MetadataFailure extends Error{constructor(reason){super();this.reason=reason;}}
const ensure=(value,reason='RESULT_INVALID')=>{if(!value)throw new MetadataFailure(reason);};
const own=(value,keys)=>{ensure(value&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));const descriptors=Object.getOwnPropertyDescriptors(value);ensure(Reflect.ownKeys(value).length===keys.length&&keys.every(k=>descriptors[k]?.enumerable&&Object.hasOwn(descriptors[k],'value')));return Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));};
const array=(value,max)=>{ensure(Array.isArray(value)&&value.length<=max,'RESULT_LIMIT');const rows=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));ensure(d&&Object.hasOwn(d,'value'));rows.push(d.value);}return rows;};
const integer=(n,min,max,nullable=false)=>nullable&&n===null||Number.isSafeInteger(n)&&n>=min&&n<=max;
const tri=value=>value===null||value===0||value===1;
const bool=value=>typeof value==='boolean';
const digest=value=>value===null||typeof value==='string'&&/^[A-F0-9]{64}$/.test(value);
const systemTypes=new Set('bigint binary bit char date datetime datetime2 datetimeoffset decimal float geography geometry hierarchyid image int money nchar ntext numeric nvarchar real rowversion smalldatetime smallint smallmoney sql_variant text time timestamp tinyint uniqueidentifier varbinary varchar xml'.split(' '));
const knownColumn=(object,column)=>COLUMNS[object]?.includes(column);
const permissionNames=object=>object==='dbo.customers'?['SELECT','VIEW DEFINITION']:['SELECT','INSERT','UPDATE','DELETE','VIEW DEFINITION','CONTROL'];
const columnPermissions=object=>object==='dbo.customers'?['SELECT','REFERENCES']:['SELECT','UPDATE'];
const permissionKey=r=>[r.objectName,r.columnName,r.permissionName].join('|');
const expectedPermissions=OBJECTS.flatMap(object=>[...permissionNames(object).map(permission=>[object,null,permission].join('|')),...COLUMNS[object].flatMap(column=>columnPermissions(object).map(permission=>[object,column,permission].join('|')))]);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

function identity(result){
 const rows=array(result,1);ensure(rows.length===1);const row=own(rows[0],identityKeys);
 ensure(row.databaseName===CUSTOMER_MASTER_NORMAL_TARGET.database&&row.serverName===CUSTOMER_MASTER_NORMAL_TARGET.server&&row.loginName===CUSTOMER_MASTER_NORMAL_LOGIN&&row.databaseUser===CUSTOMER_MASTER_NORMAL_LOGIN&&row.originalLogin===CUSTOMER_MASTER_NORMAL_LOGIN&&row.sysadmin===0&&row.databaseControl===0&&row.liveDatabaseAccess===0,'IDENTITY_REJECTED');return row;
}
function validateSets(recordsets){
 const sets=array(recordsets,8);ensure(sets.length===8);identity(sets[0]);
 return names.map((name,index)=>{
  const rows=array(sets[index+1],LIMITS[name]).map(r=>own(r,schemas[index])),seen=new Set();
  for(const r of rows){ensure(OBJECTS.includes(r.objectName));let key;
   if(name==='objects'){ensure(integer(r.objectId,1,2147483647,true)&&[r.databaseVisible,r.schemaVisible,r.objectVisible].every(tri)&&integer(r.totalColumns,0,4096)&&integer(r.totalDefaults,0,4096,true)&&integer(r.totalChecks,0,4096,true)&& (r.objectType===null||typeof r.objectType==='string'&&/^[A-Z ]{1,2}$/.test(r.objectType)));key=r.objectName;}
   if(name==='columns'){ensure(knownColumn(r.objectName,r.columnName)&&integer(r.columnId,1,4096)&&systemTypes.has(r.typeName)&&integer(r.maxLength,-1,8000)&&integer(r.precision,0,38)&&integer(r.scale,0,38)&&[r.nullable,r.identityColumn,r.computedColumn,r.aliasType].every(bool)&&(r.collation===null||typeof r.collation==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(r.collation)));key=r.objectName+'|'+r.columnName;}
   if(name==='indexes'){ensure(integer(r.indexId,1,32767)&&integer(r.indexType,1,9)&&integer(r.indexColumnId,1,4096)&&integer(r.keyOrdinal,0,32)&&[r.primaryKey,r.uniqueIndex,r.disabled,r.filtered,r.included,r.descendingKey].every(bool)&&digest(r.filterHash)&&(knownColumn(r.objectName,r.columnName)||r.columnName==='OTHER_COLUMN'));key=[r.objectName,r.indexId,r.indexColumnId].join('|');}
   if(name==='foreignKeys'){ensure(r.objectName!=='dbo.customers'&&integer(r.foreignKeyId,1,2147483647)&&integer(r.ordinal,1,32)&&(knownColumn(r.objectName,r.columnName)||r.columnName==='OTHER_COLUMN')&&(OBJECTS.includes(r.referencedObject)||r.referencedObject==='OTHER_OBJECT')&&(knownColumn(r.referencedObject,r.referencedColumn)||r.referencedColumn==='OTHER_COLUMN')&&[r.disabled,r.notTrusted].every(bool)&&integer(r.deleteAction,0,3)&&integer(r.updateAction,0,3));key=[r.objectName,r.foreignKeyId,r.ordinal].join('|');}
   if(name==='defaults'){ensure(r.objectName!=='dbo.customers'&&integer(r.constraintId,1,2147483647)&&knownColumn(r.objectName,r.columnName)&&digest(r.definitionHash)&&['UTC_NOW','OTHER','UNAVAILABLE'].includes(r.kind)&&((r.definitionHash===null)===(r.kind==='UNAVAILABLE')));key=[r.objectName,r.constraintId].join('|');}
   if(name==='checks'){ensure(r.objectName!=='dbo.customers'&&integer(r.constraintId,1,2147483647)&&[r.disabled,r.notTrusted,r.usesDatabaseCollation].every(bool)&&digest(r.definitionHash)&&['VERSION_POSITIVE','COMMITTED_VERSION_POSITIVE','TARGET_SCOPE_FIXED','CUSTOMER_TYPE_SET','OTHER','UNAVAILABLE'].includes(r.kind)&&((r.definitionHash===null)===(r.kind==='UNAVAILABLE')));key=[r.objectName,r.constraintId].join('|');}
   if(name==='permissions'){ensure(tri(r.permissionValue)&&(r.columnName===null?permissionNames(r.objectName).includes(r.permissionName):knownColumn(r.objectName,r.columnName)&&columnPermissions(r.objectName).includes(r.permissionName)));key=permissionKey(r);}
   ensure(!seen.has(key));seen.add(key);
  }
  if(name==='objects')ensure(rows.length===4);
  if(name==='permissions')ensure(rows.length===expectedPermissions.length&&expectedPermissions.every(k=>seen.has(k)));
  return rows;
 });
}
function group(rows,key){const map=new Map();for(const r of rows){const k=r[key];if(!map.has(k))map.set(k,[]);map.get(k).push(r);}return [...map.values()];}
const orderedKey=rows=>rows.filter(r=>!r.included&&r.keyOrdinal>0).sort((a,b)=>a.keyOrdinal-b.keyOrdinal).map(r=>r.columnName);
const exactKey=(rows,key)=>JSON.stringify(orderedKey(rows))===JSON.stringify(key)&&rows.every(r=>!r.disabled&&!r.filtered&&r.uniqueIndex);
function compatibility(object,objects){
 const unknown={columns:'UNKNOWN',primaryKey:'UNKNOWN',uniqueCode:'UNKNOWN',foreignKeys:'UNKNOWN',collation:'UNKNOWN',defaults:'UNKNOWN',checks:'UNKNOWN'};
 if(object.status!=='PRESENT'||object.visibility!=='COMPLETE')return unknown;
 const native=object.name==='dbo.customers',part=object.name.replace('dbo.customer_master_','').replace('_v1','');
 const expected=native?[['id',null,null],['customer_code','nvarchar',100],['name','nvarchar',500],['customer_type','nvarchar',60]]:CUSTOMER_MASTER_NORMAL_COLUMN_SETS[part];
 const cols=object.observed.columns,find=column=>cols.find(c=>c.columnName===column);
 const valid=expected.every(([name,type,len,nullable])=>{const c=find(name);return c&&(!type||c.typeName===type)&&(!len||c.maxLength===len)&&c.nullable===!!nullable&&!c.aliasType&&!c.computedColumn&&(!c.identityColumn||native&&name==='id');})&&(native||object.totalColumns===expected.length);
 const indexes=group(object.observed.indexes,'indexId'),pk=indexes.filter(rows=>rows[0].primaryKey),pkKey=native?['id']:['scope_key',part==='local'?'customer_id':'request_id'];
 const source=objects.find(o=>o.name==='dbo.customers'),code=find('customer_code'),sourceCode=source?.observed.columns.find(c=>c.columnName==='customer_code');
 const collation=native?'NOT_APPLICABLE':cols.find(c=>c.columnName==='scope_key')?.collation!=='Latin1_General_100_BIN2'?'MISMATCH':part!=='local'?'MATCH':!sourceCode?.collation?'UNKNOWN':code?.collation===sourceCode.collation?'MATCH':'MISMATCH';
 const requiredChecks=native?[]:part==='local'?['TARGET_SCOPE_FIXED','VERSION_POSITIVE','CUSTOMER_TYPE_SET']:part==='requests'?['TARGET_SCOPE_FIXED','COMMITTED_VERSION_POSITIVE']:['TARGET_SCOPE_FIXED'];
 const checks=object.observed.checks,defaults=object.observed.defaults;
 const checkState=native?'NOT_APPLICABLE':object.totalChecks!==checks.length||checks.some(c=>['OTHER','UNAVAILABLE'].includes(c.kind))?'UNKNOWN':requiredChecks.every(kind=>checks.some(c=>c.kind===kind&&!c.disabled&&!c.notTrusted))?'MATCH':'MISMATCH';
 const defaultState=native?'NOT_APPLICABLE':object.totalDefaults!==defaults.length||defaults.some(d=>['OTHER','UNAVAILABLE'].includes(d.kind))?'UNKNOWN':part==='audit'?defaults.length===1&&defaults[0].columnName==='created_at'&&defaults[0].kind==='UTC_NOW'?'MATCH':'MISMATCH':defaults.length===0?'MATCH':'MISMATCH';
 let foreignKeys='NOT_APPLICABLE';
 if(!native){const to=part==='local'?'dbo.customers':part==='requests'?'dbo.customer_master_local_v1':'dbo.customer_master_requests_v1',pairs=part==='local'?[['customer_id','id']]:part==='requests'?[['scope_key','scope_key'],['customer_id','customer_id']]:[['scope_key','scope_key'],['request_id','request_id']],groups=group(object.observed.foreignKeys,'foreignKeyId'),ref=objects.find(o=>o.name===to);
  const match=groups.some(rows=>rows.length===pairs.length&&rows.every((r,i)=>r.ordinal===i+1&&r.columnName===pairs[i][0]&&r.referencedObject===to&&r.referencedColumn===pairs[i][1]&&!r.disabled&&!r.notTrusted&&r.deleteAction===0&&r.updateAction===0));
  foreignKeys=ref?.status!=='PRESENT'||ref.visibility!=='COMPLETE'?'UNKNOWN':match&&groups.length===1?'MATCH':match?'UNKNOWN':'MISMATCH';
  if(foreignKeys==='MATCH'&&part==='local'){const id=ref.observed.columns.find(c=>c.columnName==='id'),ownId=find('customer_id');if(!id||!ownId)foreignKeys='UNKNOWN';else if(id.typeName!==ownId.typeName||id.maxLength!==ownId.maxLength)foreignKeys='MISMATCH';}
 }
 return {columns:valid?'MATCH':'MISMATCH',primaryKey:pk.length===1&&exactKey(pk[0],pkKey)?'MATCH':'MISMATCH',uniqueCode:native||part!=='local'?'NOT_APPLICABLE':indexes.some(rows=>exactKey(rows,['scope_key','customer_code']))?'MATCH':'MISMATCH',foreignKeys,collation,defaults:defaultState,checks:checkState};
}
function format(sets){
 const data=Object.fromEntries(names.map((name,i)=>[name,sets[i]]));
 const objects=OBJECTS.map(name=>{const row=data.objects.find(o=>o.objectName===name),complete=row.objectId!==null&&row.objectVisible===1,type=row.objectType?.trim();
  // An enclosing grant does not rule out a narrower DENY. A hidden object
  // cannot be proved absent by these observations, even with database VIEW.
  const status=row.objectId===null?'UNKNOWN':type==='U'?'PRESENT':type?'UNSUPPORTED':'UNKNOWN';
  const observed=Object.fromEntries(names.slice(1).map(k=>[k,data[k].filter(r=>r.objectName===name).map(({objectName,...r})=>k==='permissions'?{...r,status:r.permissionValue===1?'GRANTED':r.permissionValue===0?'DENIED':'UNKNOWN'}:r)]));
  return {name,status,visibility:complete?'COMPLETE':row.objectId!==null?'PARTIAL':'UNKNOWN',objectType:type??null,totalColumns:row.totalColumns,totalDefaults:row.totalDefaults,totalChecks:row.totalChecks,visibilityPermissions:{database:row.databaseVisible,schema:row.schemaVisible,object:row.objectVisible},observed};
 });
 for(const object of objects)object.compatibility=compatibility(object,objects);
 return objects;
}
export function createCustomerMasterMetadataReader(options={}){
 if(!options||![Object.prototype,null].includes(Object.getPrototypeOf(options))||Reflect.ownKeys(options).some(k=>k!=='getRuntime'))throw customerMasterError('CUSTOMER_VALIDATION_FAILED',400);
 const descriptor=Object.getOwnPropertyDescriptor(options,'getRuntime');
 if(descriptor&&(!Object.hasOwn(descriptor,'value')||typeof descriptor.value!=='function'))throw customerMasterError('CUSTOMER_VALIDATION_FAILED',400);
 const getRuntime=descriptor?.value;
 return Object.freeze({async read(input){
  if(input!==undefined&&(!input||![Object.prototype,null].includes(Object.getPrototypeOf(input))||Reflect.ownKeys(input).length))throw customerMasterError('CUSTOMER_VALIDATION_FAILED',400);
  let stage='runtime',queryCount=0;
  const base={schemaVersion:'melisa-customer-master-metadata.v1',target:CUSTOMER_MASTER_NORMAL_TARGET,queryScope:'SELECT_ONLY',commercialRowsRead:false,writeStatements:0,consistency:'NON_TRANSACTIONAL_OBSERVATION_NOT_WRITE_ADMISSION'};
  try{
   const runtime=canonicalCustomerMasterMetadataRuntime(getRuntime?await getRuntime():null);ensure(runtime,'NO_ADMITTED_IN_PROCESS_RUNTIME');
   const {pool,sql}=runtime;ensure(pool?.connected===true&&pool.connecting===false&&typeof pool.request==='function'&&typeof sql?.Request==='function'&&integer(pool.config?.requestTimeout,1,LIMITS.requestTimeoutMs),'POOL_NOT_READY');
   const query=async text=>{const r=pool.request();ensure(r instanceof sql.Request&&r.parent===pool&&typeof r.query==='function','DRIVER_REJECTED');queryCount++;return r.query(text);};
   stage='identity';const before=identity((await query(IDENTITY)).recordset);
   stage='catalog';const sets=validateSets((await query(CATALOG)).recordsets);
   stage='identity-after';const after=identity((await query(IDENTITY)).recordset);ensure(JSON.stringify(after)===JSON.stringify(before),'IDENTITY_REJECTED');
   const objects=format(sets),result={...base,status:'OBSERVED',observedAtUtc:new Date().toISOString(),queryCount,identity:before,objects};
   ensure(Buffer.byteLength(JSON.stringify(result),'utf8')<=LIMITS.bytes,'RESULT_LIMIT');return freeze(result);
  }catch(error){const reason=error instanceof MetadataFailure?error.reason:stage==='runtime'?'PROVIDER_UNAVAILABLE':error?.number===229?'QUERY_PERMISSION_DENIED':'QUERY_FAILED';return freeze({...base,status:reason==='NO_ADMITTED_IN_PROCESS_RUNTIME'||reason==='POOL_NOT_READY'||reason==='PROVIDER_UNAVAILABLE'?'UNAVAILABLE':reason==='IDENTITY_REJECTED'||reason==='DRIVER_REJECTED'?'REJECTED':'FAILED',stage,reason,queryCount,objects:[]});}
 }});
}
