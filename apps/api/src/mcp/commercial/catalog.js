import crypto from 'node:crypto';
import {sourcePool,sourceProof,quote,sql} from './sourcePools.js';
import {templateFamily,melisaTemplateFamily,excludedObject,secretName,fieldPolicy,defaultNames,fail,warnings} from './policy.js';
import {applySemantics} from './semantics.js';
let cached;let pending;
const authorizedCompanies=new Set(['F0102','F0103','F0104']);
const objectQuery=`SELECT TOP (10001) o.object_id AS objectId,s.name AS schemaName,o.name AS objectName,o.type_desc AS objectType,
 HAS_PERMS_BY_NAME(QUOTENAME(s.name)+'.'+QUOTENAME(o.name),'OBJECT','SELECT') AS canSelect
 FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE o.is_ms_shipped=0 AND o.type IN ('U','V') ORDER BY s.name,o.name`;
async function metadata(pool,text){const r=pool.request();r.timeout=15000;return(await r.query(text)).recordset;}
function datasetObject(source,object,definitions,periods){
 const match=object.objectName.match(/^(F\d{4})(D\d{4})?(.+)$/);
 const company=match?.[1]||null,period=match?.[2]||null,template=match?.[3]||object.objectName;
 const family=(source==='vega'?templateFamily:melisaTemplateFamily).get(template)||'unclassified';
 const restricted=excludedObject.test(object.objectName)||secretName.test(object.objectName);
 const scoped=source==='melisa'||!company||authorizedCompanies.has(company);
 const registered=!restricted&&scoped&&object.schemaName==='dbo';
 const periodDefinition=periods.find(p=>p.company===company&&p.period===period);
 const description=definitions.find(d=>d.TABLENAME===template);
 return {...object,id:`${source}.${object.schemaName}.${object.objectName}`,source,company,period,year:periodDefinition?.year||null,template,family,
   registered,readable:object.canSelect===1&&registered,permission:object.canSelect===1?'allowed':object.canSelect===0?'denied':'not-visible-or-unknown',
   status:restricted?'security-excluded':!registered?'mapping-required':object.canSelect===1?'available':'permission-required',
   description:description?.DESCRIPTION?.trim()||(source==='melisa'?'Local ERP table defined in application schema.':'Raw Vega object; business interpretation requires mapping.'),
   evidence:description?.DESCRIPTION?[`VEGA2026.dbo.TBLTABLEDESCRIPTIONS:${description.IND}`]:source==='melisa'?['infra/sql/migrations; live column metadata']:['live column metadata; semantic interpretation unverified'],
   fields:[],primaryKey:[],relationships:[],objects:[{schemaName:object.schemaName,objectName:object.objectName}],
   extraWarnings:family==='unclassified'?['This object is readable as raw source data. Only reviewed safe scalar fields are exposed; other field meanings and relationships remain unverified.']:[],
 };
}
async function loadSource(source){
 const pool=await sourcePool(source);const objects=await metadata(pool,objectQuery);
 if(objects.length>10000)throw fail('CATALOG_OBJECT_LIMIT');
 let definitions=[],companies=[],periods=[];
 if(source==='vega'){
   definitions=await metadata(pool,`SELECT TOP (3000) IND,TABLENAME,CONVERT(nvarchar(4000),DESCRIPTION) AS DESCRIPTION FROM dbo.TBLTABLEDESCRIPTIONS ORDER BY IND`);
   companies=(await metadata(pool,`SELECT TOP (100) IND,KOD,KISAAD FROM dbo.TBLFIRMA ORDER BY IND`)).filter(c=>authorizedCompanies.has('F'+String(c.IND).padStart(4,'0'))).map(c=>({company:'F'+String(c.IND).padStart(4,'0'),name:c.KISAAD||c.KOD,evidence:'dbo.TBLFIRMA'}));
   periods=(await metadata(pool,`SELECT TOP (200) FIND,IND,DONEM FROM dbo.TBLDONEM ORDER BY FIND,IND`)).map(p=>({company:'F'+String(p.FIND).padStart(4,'0'),period:'D'+String(p.IND).padStart(4,'0'),year:p.DONEM,evidence:'dbo.TBLDONEM'})).filter(p=>authorizedCompanies.has(p.company));
 }
 const datasets=objects.map(o=>datasetObject(source,o,definitions,periods));
 const candidates=datasets.filter(d=>d.registered&&d.canSelect===1);
 for(let offset=0;offset<candidates.length;offset+=250){
   const batch=candidates.slice(offset,offset+250);const ids=batch.map(d=>d.objectId).filter(Number.isInteger).join(',');if(!ids)continue;
   const columns=await metadata(pool,`SELECT c.object_id AS objectId,c.column_id AS ordinal,c.name AS name,t.name AS dataType,c.max_length AS maxLength,c.precision,c.scale,c.is_nullable AS nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id IN (${ids}) ORDER BY c.object_id,c.column_id`);
   const keys=await metadata(pool,`SELECT i.object_id AS objectId,i.index_id AS indexId,i.is_primary_key AS isPrimaryKey,c.name AS name,ic.key_ordinal AS ordinal FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE i.object_id IN (${ids}) AND i.is_unique=1 AND i.has_filter=0 AND i.is_disabled=0 AND ic.key_ordinal>0 ORDER BY i.object_id,i.is_primary_key DESC,i.index_id,ic.key_ordinal`);
   const byObject=new Map(batch.map(d=>[d.objectId,d]));
   const safeIdentityColumns=new Set(keys.filter(k=>k.isPrimaryKey).map(k=>k.objectId+':'+k.name));
   for(const c of columns){const d=byObject.get(c.objectId);const field=fieldPolicy({...c,sourcePrimaryKey:safeIdentityColumns.has(c.objectId+':'+c.name)},d);if(field)d.fields.push(field);}
   for(const d of batch){
     const keyRows=keys.filter(k=>k.objectId===d.objectId);const first=keyRows[0];
     d.primaryKey=first?keyRows.filter(k=>k.indexId===first.indexId).map(k=>k.name):[];
     if(!d.primaryKey.length||d.primaryKey.some(k=>!d.fields.some(f=>f.name===k&&!f.nullable&&!f.personal))){d.primaryKey=[];d.rowReadBlocked='NO_SAFE_UNIQUE_KEY';}
     d.defaultFields=[...new Set([...d.primaryKey,...defaultNames.filter(n=>d.fields.some(f=>f.name===n&&!f.personal))])].slice(0,12);
     if(d.defaultFields.length<3)d.defaultFields=[...new Set([...d.defaultFields,...d.fields.filter(f=>!f.personal).map(f=>f.name)])].slice(0,8);
     d.from=quote(d.schemaName)+'.'+quote(d.objectName);
     d.schemaVersion=crypto.createHash('sha256').update(JSON.stringify([d.primaryKey,d.fields.map(f=>[f.name,f.dataType,f.precision,f.scale])])).digest('hex').slice(0,16);
   }
 }
 const relations=await metadata(pool,`SELECT TOP (10000) fk.parent_object_id AS parentObjectId,fk.referenced_object_id AS referencedObjectId,fk.name,pc.name AS parentColumn,rc.name AS referencedColumn,fk.is_disabled AS disabled,fk.is_not_trusted AS untrusted FROM sys.foreign_keys fk JOIN sys.foreign_key_columns k ON k.constraint_object_id=fk.object_id JOIN sys.columns pc ON pc.object_id=k.parent_object_id AND pc.column_id=k.parent_column_id JOIN sys.columns rc ON rc.object_id=k.referenced_object_id AND rc.column_id=k.referenced_column_id ORDER BY fk.object_id,k.constraint_column_id`);
 const mappedObjects=new Map(datasets.map(d=>[d.objectId,d]));
 for(const r of relations){const parent=mappedObjects.get(r.parentObjectId),target=mappedObjects.get(r.referencedObjectId);
   if(parent?.fields.some(f=>f.name===r.parentColumn)&&target?.fields.some(f=>f.name===r.referencedColumn))parent.relationships.push({field:r.parentColumn,targetDataset:target.id,targetField:r.referencedColumn,evidence:'SQL foreign-key metadata',enabled:!r.disabled,trusted:!r.untrusted});
 }
 if(source==='melisa')for(const [name,family] of melisaTemplateFamily){if(!datasets.some(d=>d.objectName===name))datasets.push({id:`melisa.dbo.${name}`,source:'melisa',schemaName:'dbo',objectName:name,company:null,period:null,year:null,template:name,family,registered:true,readable:false,permission:'not-visible-or-unknown',status:'permission-or-schema-required',description:'Defined or referenced in ERP code; existence cannot be established through this principal.',fields:[],primaryKey:[],evidence:['ERP migrations/services; live SELECT-only metadata incomplete']});}
 return {source,database:sourceProof(source)?.databaseName,proof:sourceProof(source),objectsVisible:objects.length,excludedObjects:datasets.filter(d=>d.status==='security-excluded').length,companies,periods,datasets:applySemantics(datasets)};
}
async function load(){
 const sources=[];
 for(const source of ['vega','melisa'])try{sources.push(await loadSource(source));}catch(error){sources.push({source,status:'unavailable',code:error.code||'SOURCE_UNAVAILABLE',datasets:[]});}
 const datasets=sources.flatMap(s=>s.datasets).sort((a,b)=>a.id.localeCompare(b.id));
 return {at:Date.now(),readAt:new Date().toISOString(),sources,datasets,map:new Map(datasets.map(d=>[d.id,d])),warnings};
}
export async function catalog(){
 if(cached&&Date.now()-cached.at<300000)return cached;
 if(!pending)pending=load().then(value=>(cached=value)).finally(()=>{pending=undefined;});
 return pending;
}
export async function dataset(id){if(typeof id!=='string'||id.length>200)throw fail('INVALID_DATASET');const d=(await catalog()).map.get(id);if(!d)throw fail('DATASET_NOT_ALLOWED');return d;}
export function datasetSummary(d){return {id:d.id,source:d.source,family:d.family,company:d.company,period:d.period,year:d.year,description:d.description,status:d.status,permission:d.permission,queryable:Boolean(d.readable&&!d.rowReadBlocked),aggregatable:Boolean(d.readable),warning:d.rowReadBlocked||null};}
export function clearCatalog(){cached=undefined;}
