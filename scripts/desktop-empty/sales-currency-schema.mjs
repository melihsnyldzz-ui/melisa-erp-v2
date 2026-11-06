// Offline proposal only: no SQL client, execution, migration, grants or data.
// Types/nullability come from the pinned 2026-10-06 column metadata, not rows.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DESKTOP_EMPTY_SERVER,DESKTOP_EMPTY_DATABASE,desktopEmptyTargetGuard,compileDesktopEmptySchema} from './schema.mjs';

const FIXTURE='scripts/canonical/fixtures/night-20261006-before.json';
const FIXTURE_SHA='3bb27b291723664d47d17a9f63c94a127d324c695d22e1d7b2eb067bc1c38e7e';
// This is a bounded subset, not a claim that the sales schema is complete.
const COLUMNS=Object.freeze({
 sales_invoices:Object.freeze([['account_currency','nvarchar(3)'],['account_amount','decimal(18,4)'],['account_exchange_rate_snapshot','decimal(18,8)'],['party_entity_id','bigint'],['party_currency_account_id','bigint']]),
 customer_movements:Object.freeze([['account_currency','nvarchar(3)'],['account_amount','decimal(18,4)'],['document_exchange_rate_snapshot','decimal(18,8)'],['account_exchange_rate_snapshot','decimal(18,8)'],['amount_try','decimal(18,4)'],['party_entity_id','bigint'],['party_currency_account_id','bigint']]),
 customers:Object.freeze([['party_entity_id','bigint']]),
 stock_movements:Object.freeze([['warehouse_name','nvarchar(80)']]),
});
const reject=code=>{throw Object.assign(new Error(code),{code});};
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
function object(value,allowed,required,code){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))reject(code);
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);
 if(keys.some(k=>typeof k!=='string'||!allowed.includes(k)||!descriptors[k].enumerable||!Object.hasOwn(descriptors[k],'value'))
  ||required.some(k=>!Object.hasOwn(descriptors,k)))reject(code);
}
function sqlMetadata(type){
 if(type==='bigint')return {type_name:'bigint',max_length:8,precision:19,scale:0};
 const n=/^nvarchar\((\d+)\)$/.exec(type);if(n)return {type_name:'nvarchar',max_length:Number(n[1])*2,precision:0,scale:0};
 const d=/^decimal\((\d+),(\d+)\)$/.exec(type);if(d&&Number(d[1])===18)return {type_name:'decimal',max_length:9,precision:Number(d[1]),scale:Number(d[2])};
 reject('DESKTOP_SALES_COLUMN_TYPE_REJECTED');
}
function verifyFixture(text){
 if(typeof text!=='string')reject('DESKTOP_SALES_SOURCE_REJECTED');
 const normalized=text.replace(/^\uFEFF/,'').replaceAll('\r\n','\n');
 if(normalized.includes('\r')||normalized.includes('\0')||sha(normalized)!==FIXTURE_SHA)reject('DESKTOP_SALES_SOURCE_REJECTED');
 let rows;try{rows=JSON.parse(normalized)?.exported?.resultSets?.[1];}catch{reject('DESKTOP_SALES_FIXTURE_REJECTED');}
 if(!Array.isArray(rows))reject('DESKTOP_SALES_FIXTURE_REJECTED');
 for(const [table,columns] of Object.entries(COLUMNS))for(const [name,type] of columns){
  const matches=rows.filter(row=>row?.table_name===table&&row?.column_name===name);
  const expected={...sqlMetadata(type),is_nullable:true,is_identity:false,default_expression:null};
  if(matches.length!==1||Object.entries(expected).some(([key,value])=>matches[0][key]!==value))reject('DESKTOP_SALES_METADATA_REJECTED');
 }
}
export const DESKTOP_SALES_SCHEMA_LIMITS=Object.freeze({executionAuthorized:false,commercialData:'NONE',
 completeSalesSchema:false,source:'metadata-only-2026-10-06',requiresIndependentReview:true,
 requiresTargetSpecificTransaction:true,requiresActualSqlCompatibilityVerification:true});
export function compileDesktopSalesCurrencySchema(options={}){
 object(options,['server','database','fixture'],[],'DESKTOP_SALES_OPTIONS_REJECTED');
 const server=Object.hasOwn(options,'server')?options.server:DESKTOP_EMPTY_SERVER;
 const database=Object.hasOwn(options,'database')?options.database:DESKTOP_EMPTY_DATABASE;
 if(server!==DESKTOP_EMPTY_SERVER||database!==DESKTOP_EMPTY_DATABASE)reject('DESKTOP_EMPTY_TARGET_REJECTED');
 const fixture=Object.hasOwn(options,'fixture')?options.fixture:readFileSync(new URL('../../'+FIXTURE,import.meta.url),'utf8');
 verifyFixture(fixture);
 const guard=desktopEmptyTargetGuard({server,database});
 // Ensure the emitted changes do not duplicate known columns in the pinned
 // offline foundation, including subsequent ALTERs within its batch list.
 const base=compileDesktopEmptySchema();
 const batches=[];
 for(const [table,columns] of Object.entries(COLUMNS)){
  const ownBase=base.batches.filter(batch=>new RegExp(`\\bdbo\\.(?:\\[${table}\\]|${table})(?![A-Za-z0-9_])`,'i').test(batch.sql)).map(batch=>batch.sql).join('\n');
  for(const [name] of columns)if(new RegExp(`\\b${name}\\b`,'i').test(ownBase))reject('DESKTOP_SALES_FOUNDATION_COLLISION');
  const checks=columns.map(([name])=>`COL_LENGTH(N'dbo.${table}',N'${name}') IS NOT NULL`).join(' OR ');
  const additions=columns.map(([name,type])=>`[${name}] ${type} NULL`).join(',');
  batches.push(Object.freeze({table,sql:`${guard}\nIF OBJECT_ID(N'dbo.${table}',N'U') IS NULL OR ${checks} THROW 51995, 'DESKTOP_SALES_SCHEMA_DRIFT', 1;\nALTER TABLE dbo.[${table}] ADD ${additions};`}));
 }
 return Object.freeze({scope:'desktop-sales-currency-columns-offline-v1',server,database,fixtureSha256:FIXTURE_SHA,
  requirements:DESKTOP_SALES_SCHEMA_LIMITS,batches:Object.freeze(batches)});
}
