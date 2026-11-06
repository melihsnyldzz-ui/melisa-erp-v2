// Offline, source-bound DDL compiler. No SQL client, executor, seeds, grants,
// or connection is imported. This is not a writable ERP or installation.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DESKTOP_EMPTY_SERVER,DESKTOP_EMPTY_DATABASE,desktopEmptyTargetGuard} from './schema.mjs';

const MIGRATION='apps/api/scripts/vega-native-migration-store.mjs';
const FIXTURE='scripts/canonical/fixtures/night-20261006-before.json';
const SOURCE_HASHES=Object.freeze({
 [MIGRATION]:'8226ba6ec778bbefc729de69e9a34ab3bde7d152ac9da1a564659587cdf2a5b3',
 [FIXTURE]:'3bb27b291723664d47d17a9f63c94a127d324c695d22e1d7b2eb067bc1c38e7e',
});
const COMMON=Object.freeze([
 ['source_record_key','nvarchar(250)'],['migration_run_id','nvarchar(80)'],
 ['source_payload_hash','char(64)'],['source_payload_json','nvarchar(max)'],
 ['source_document_key','nvarchar(250)'],['original_document_date','nvarchar(40)'],
].map(Object.freeze));
const TABLES=Object.freeze([
 Object.freeze({name:'party_entities',evidence:'pinned-native-source',fields:Object.freeze([
  ['role','nvarchar(20)'],['name','nvarchar(250)'],['identity_rule','nvarchar(100)'],['country','nvarchar(100)'],
 ].map(Object.freeze))}),
 Object.freeze({name:'party_currency_accounts',evidence:'pinned-native-source-and-column-fixture',fields:Object.freeze([
  ['party_entity_id','bigint'],['currency_code','nvarchar(3)'],['customer_id','bigint'],
  ['supplier_id','bigint'],['current_balance','decimal(28,8)'],['balance_status','nvarchar(100)'],
 ].map(Object.freeze))}),
 Object.freeze({name:'product_prices',evidence:'pinned-native-source-and-column-fixture',fields:Object.freeze([
  ['product_id','bigint'],['price_type','nvarchar(20)'],['price_tier','int'],
  ['currency_code','nvarchar(3)'],['price','decimal(28,8)'],['source_unit_id','int'],
 ].map(Object.freeze))}),
]);
const reject=code=>{throw Object.assign(new Error(code),{code});};
const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
function assertDataRecord(value,allowed,required,code){
 if(!value||typeof value!=='object'||Array.isArray(value)
  ||![Object.prototype,null].includes(Object.getPrototypeOf(value)))reject(code);
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);
 if(keys.some(key=>typeof key!=='string'||!allowed.includes(key)||!descriptors[key].enumerable
   ||!Object.hasOwn(descriptors[key],'value'))||required.some(key=>!Object.hasOwn(descriptors,key)))reject(code);
}
const normalize=value=>{
 if(typeof value!=='string')reject('DESKTOP_CATALOG_SOURCE_TYPE_REJECTED');
 const text=value.replace(/^\uFEFF/,'').replaceAll('\r\n','\n');
 if(text.includes('\r')||text.includes('\0'))reject('DESKTOP_CATALOG_SOURCE_ENCODING_REJECTED');
 return text;
};
const anchor=(text,expected)=>{
 const pos=text.indexOf(expected);
 if(pos<0||text.indexOf(expected,pos+expected.length)!==-1)reject('DESKTOP_CATALOG_SOURCE_ANCHOR_REJECTED');
};

export function readDesktopNativeCatalogSources(){
 return Object.fromEntries(Object.keys(SOURCE_HASHES).map(file=>[file,readFileSync(new URL('../../'+file,import.meta.url),'utf8')]));
}

function metadataType(sqlType){
 if(sqlType==='bigint')return {type_name:'bigint',max_length:8,precision:19,scale:0};
 if(sqlType==='int')return {type_name:'int',max_length:4,precision:10,scale:0};
 if(sqlType==='decimal(28,8)')return {type_name:'decimal',max_length:13,precision:28,scale:8};
 const match=/^(nvarchar|char)\((max|[1-9][0-9]*)\)$/.exec(sqlType);
 if(!match||match[1]==='char'&&match[2]==='max')reject('DESKTOP_CATALOG_COLUMN_TYPE_REJECTED');
 return {type_name:match[1],max_length:match[2]==='max'?-1:Number(match[2])*(match[1]==='nvarchar'?2:1),precision:0,scale:0};
}
function expectedFixtureRow(table,column,index){
 const [name,type]=column;
 return {table_name:table,column_id:index+1,column_name:name,...metadataType(type),
  is_nullable:index!==0,is_identity:index===0,default_expression:null};
}
function validateFixture(text){
 let fixture;try{fixture=JSON.parse(text);}catch{reject('DESKTOP_CATALOG_FIXTURE_REJECTED');}
 const rows=fixture?.exported?.resultSets?.[1];
 if(!Array.isArray(rows))reject('DESKTOP_CATALOG_FIXTURE_REJECTED');
 for(const table of TABLES.filter(entry=>entry.evidence==='pinned-native-source-and-column-fixture')){
  const expected=[['id','bigint'],...table.fields,...COMMON].map((column,index)=>expectedFixtureRow(table.name,column,index));
  const actual=rows.filter(row=>row?.table_name===table.name);
  if(actual.length!==expected.length)reject('DESKTOP_CATALOG_FIXTURE_COLUMNS_REJECTED');
  for(let i=0;i<actual.length;i++){
   const row=actual[i],want=expected[i];
   if(!row||Object.keys(row).length!==Object.keys(want).length
     ||Object.keys(want).some(key=>!Object.hasOwn(row,key)||row[key]!==want[key]))
    reject('DESKTOP_CATALOG_FIXTURE_COLUMNS_REJECTED');
  }
 }
}
function validateMigration(text){
 // Exact hash pins the complete module. These sentinels bind generated columns
 // and the filtered source-key index to the original native migration's code.
 anchor(text,"export const common = {source_record_key:'nvarchar(250)', migration_run_id:'nvarchar(80)', source_payload_hash:'char(64)', source_payload_json:'nvarchar(max)', source_document_key:'nvarchar(250)', original_document_date:'nvarchar(40)'};");
 anchor(text,"const create=async(table,cols)=>request().query(`IF OBJECT_ID(N'dbo.${table}',N'U') IS NULL CREATE TABLE dbo.${ident(table)}(id bigint IDENTITY PRIMARY KEY,${Object.entries({...cols,...common}).map(([k,v])=>`${ident(k)} ${v} NULL`).join(',')});`);");
 for(const table of TABLES){
  const fields=table.fields.map(([name,type])=>`${name}:'${type}'`).join(',');
  anchor(text,`await create('${table.name}',{${fields}});`);
 }
 anchor(text,"CREATE UNIQUE INDEX ${ident('UX_'+t+'_source_record')} ON dbo.${ident(t)}(source_record_key) WHERE source_record_key IS NOT NULL;");
}

export const DESKTOP_NATIVE_CATALOG_REQUIREMENTS=Object.freeze({
 executionAuthorized:false,commercialData:'NONE',requiresIndependentReview:true,
 requiresTargetSpecificTransactionalInstaller:true,requiresActualSqlMetadataVerification:true,
 fixtureLimitation:'party_entities absent from bundled column fixture; native migration source only',
});

export function compileDesktopNativeCatalogSchema(options={}){
 assertDataRecord(options,['server','database','sources'],[],'DESKTOP_CATALOG_OPTIONS_REJECTED');
 const server=Object.hasOwn(options,'server')?options.server:DESKTOP_EMPTY_SERVER;
 const database=Object.hasOwn(options,'database')?options.database:DESKTOP_EMPTY_DATABASE;
 if(server!==DESKTOP_EMPTY_SERVER||database!==DESKTOP_EMPTY_DATABASE)reject('DESKTOP_EMPTY_TARGET_REJECTED');
 const guard=desktopEmptyTargetGuard({server,database});
 const sources=Object.hasOwn(options,'sources')?options.sources:readDesktopNativeCatalogSources();
 const names=Object.keys(SOURCE_HASHES);
 assertDataRecord(sources,names,names,'DESKTOP_CATALOG_SOURCE_ALLOWLIST_REJECTED');
 const verified=Object.fromEntries(names.map(name=>{
  const text=normalize(sources[name]);
  if(sha256(text)!==SOURCE_HASHES[name])reject('DESKTOP_CATALOG_SOURCE_HASH_REJECTED');
  return [name,text];
 }));
 validateMigration(verified[MIGRATION]);validateFixture(verified[FIXTURE]);
 const batches=[];
 for(const table of TABLES){
  const fields=[...table.fields,...COMMON];
  const columns=fields.map(([name,type])=>`[${name}] ${type} NULL`).join(',');
  const tableSql=`CREATE TABLE dbo.[${table.name}](id bigint IDENTITY PRIMARY KEY,${columns});`;
  const indexSql=`CREATE UNIQUE INDEX [UX_${table.name}_source_record] ON dbo.[${table.name}](source_record_key) WHERE source_record_key IS NOT NULL;`;
  batches.push(Object.freeze({table:table.name,kind:'TABLE',evidence:table.evidence,sql:guard+'\n'+tableSql}));
  batches.push(Object.freeze({table:table.name,kind:'INDEX',evidence:'pinned-native-source',sql:guard+'\n'+indexSql}));
 }
 return Object.freeze({scope:'desktop-native-catalog-source-only-v1',server,database,
  requirements:DESKTOP_NATIVE_CATALOG_REQUIREMENTS,sourceHashes:SOURCE_HASHES,batches:Object.freeze(batches)});
}
