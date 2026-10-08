import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {catalogError,parseCatalogId,catalogDisplayCode,compareCatalogCodes} from './catalogModel.mjs';
import {canonicalTestAdminContext,testAdminClaims} from './canonicalTestAdminSession.mjs';
import {isBoundCatalogContext,boundCatalogLineage,validateBoundCatalogContext} from './currentProductCatalogContext.mjs';
const ROOT='C:/Sirket/ERP/data/TEST-20260929-01/catalog-classification';
const SOURCE='36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400';
const RUN='VEGA-OPENING-TEST-20261004-06';
const fail=()=>{throw catalogError();};
const check=ok=>{if(!ok)fail();};
const hex=v=>typeof v==='string'&&/^[a-fA-F0-9]{64}$/.test(v);
const exactKeys=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const text=(v,max)=>{check(v===null||typeof v==='string'&&v.length<=max);return v===null||!v.trim()?null:v;};
const samePath=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
async function defaultValidate(entriesJson,actorId){return (await import('./catalogProductReadStore.mjs')).validateCatalogClassification({entriesJson,actorId});}
export function createCatalogClassificationStore({expectedRoot=ROOT,acceptedCount=16622,heldCount=54,validateIndex=defaultValidate,getSourceVersion=async()=>(await import('./catalogProductReadStore.mjs')).catalogSourceVersion(),getUser=async id=>(await import('./authService.js')).getUserById(id)}={}){
 let registry=null;
 return {
  async configure(context){
   registry=null;
   try{
    const {root,indexSha256}=context;canonicalTestAdminContext(context);const version=context.sourceVersion??null;
    if(version){if(isBoundCatalogContext(version))validateBoundCatalogContext(version);const configured=await getSourceVersion();check(configured&&['runId','sourceHash','planHash','bindingsHash','readerDefinitionHash','sourceAsOf','productCount','priceCount'].every(k=>version[k]===configured[k]));}
    check(typeof root==='string'&&samePath(root,version?expectedRoot+'-goal7':expectedRoot)&&hex(indexSha256));
    const user=await getUser(testAdminClaims.sub);check(String(user?.id)===testAdminClaims.sub&&Array.isArray(user.permissions)&&user.permissions.includes('product.view')&&user.permissions.includes('sales.view'));
    const file=path.join(root,'index.json');for(let current=file;current!==path.parse(file).root;current=path.dirname(current))check(!(await fs.lstat(current)).isSymbolicLink());check(samePath(await fs.realpath(file),file));
    const raw=await fs.readFile(file);check(raw.length<=16*1024*1024&&createHash('sha256').update(raw).digest('hex')===indexSha256.toLowerCase());const index=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
    const count=version?.productCount??acceptedCount;
    check(exactKeys(index,['schemaVersion','server','database','runId','sourceAsOf','sourceHash','entries'])&&index.schemaVersion===(version?'melisa-erp.catalog-classification.v2':'melisa-erp.catalog-classification.v1')&&index.server===context.identity.serverName&&index.database===context.identity.databaseName&&index.runId===(version?.runId??RUN)&&index.sourceAsOf===(version?.sourceAsOf??'2026-09-30')&&index.sourceHash===(version?.sourceHash??SOURCE)&&Array.isArray(index.entries)&&index.entries.length===count+heldCount);
    const entries=new Map(),sources=new Set();let accepted=0,held=0;
    for(const e of index.entries){
     check(exactKeys(e,['productId','stockCode','sourceKey','kind','brand','productType','sourceName','stagePayloadHash','stageSqlHash',...(version?['lineageRunId','sourceAsOf']:[])]));parseCatalogId(e.productId);check(!entries.has(e.productId)&&!['301984','301985','301986'].includes(e.productId)&&typeof e.stockCode==='string'&&e.stockCode.length>0&&e.stockCode.length<=250&&typeof e.sourceKey==='string'&&(version?/^(?:VEGA_CAPTURE_20260930_01|VEGA2026)\/F0102\/TBLSTOKLAR\/[1-9]\d*$/:/^VEGA_CAPTURE_20260930_01\/F0102\/TBLSTOKLAR\/[1-9]\d*$/).test(e.sourceKey)&&!sources.has(e.sourceKey));sources.add(e.sourceKey);
    if(version)check(e.lineageRunId===RUN&&e.sourceAsOf==='2026-09-30'||e.kind==='accepted-opening'&&(e.lineageRunId===version.runId&&e.sourceAsOf===version.sourceAsOf||boundCatalogLineage(version,{runId:e.lineageRunId,sourceAsOf:e.sourceAsOf})));
     const v={...e,brand:text(e.brand,250),productType:text(e.productType,250),sourceName:text(e.sourceName,500)};
     if(e.kind==='accepted-opening'){accepted++;check(hex(e.stagePayloadHash)&&hex(e.stageSqlHash));v.stagePayloadHash=e.stagePayloadHash.toUpperCase();v.stageSqlHash=e.stageSqlHash.toUpperCase();}
     else{held++;check(e.kind==='quarantined-source'&&e.brand===null&&e.productType===null&&e.sourceName===null&&e.stagePayloadHash===null&&e.stageSqlHash===null);}
     v.displayCode=catalogDisplayCode(e.stockCode,e.kind==='accepted-opening'?v.brand:null);entries.set(e.productId,v);
    }
    check(accepted===count&&held===heldCount);await validateIndex(JSON.stringify([...entries.values()].map(({displayCode,lineageRunId,sourceAsOf,...v})=>v)),testAdminClaims.sub);
    const ordered=[...entries.values()].sort((a,b)=>compareCatalogCodes(a.displayCode,b.displayCode)||Buffer.compare(Buffer.from(a.stockCode,'utf16le'),Buffer.from(b.stockCode,'utf16le'))||(BigInt(a.productId)<BigInt(b.productId)?-1:BigInt(a.productId)>BigInt(b.productId)?1:0));ordered.forEach((e,i)=>{e.rank=i+1;});
    const facets={brands:[...new Set(ordered.filter(e=>e.kind==='accepted-opening'&&e.brand!==null).map(e=>e.brand))],productTypes:[...new Set(ordered.filter(e=>e.kind==='accepted-opening'&&e.productType!==null).map(e=>e.productType))]};for(const values of Object.values(facets))values.sort((a,b)=>Buffer.compare(Buffer.from(a,'utf16le'),Buffer.from(b,'utf16le')));
    registry={entries,ordered,facets,version,allCandidatesJson:JSON.stringify(ordered.map(e=>[e.productId,e.rank]))};
   }catch{registry=null;fail();}
  },
  selection({productId=null,options}){
   check(registry!==null);let candidatesJson=registry.allCandidatesJson;
   if(productId!==null||options.brand||options.productType){const selected=registry.ordered.filter(e=>(productId===null||e.productId===productId)&&(!options.brand||e.kind==='accepted-opening'&&e.brand===options.brand)&&(!options.productType||e.kind==='accepted-opening'&&e.productType===options.productType));candidatesJson=JSON.stringify(selected.map(e=>[e.productId,e.rank]));}
   return {candidatesJson,filters:{brands:[...registry.facets.brands],productTypes:[...registry.facets.productTypes]}};
  },
  reportBindings(){
   check(registry!==null);return JSON.stringify(registry.ordered.filter(e=>e.kind==='accepted-opening').map(e=>({productId:e.productId,brand:e.brand,productType:e.productType})));
  },
  assertRow(row){
   const e=registry?.entries.get(row.id);check(e&&row.stockCode===e.stockCode&&row.provenance.kind===e.kind&&row.provenance.sourceKey===e.sourceKey&&row.provenance.runId===(e.lineageRunId??RUN)&&row.provenance.sourceAsOf===(e.sourceAsOf??'2026-09-30')&&row.provenance.verified===true&&row.displayCode===e.displayCode&&row.classification.verified===(e.kind==='accepted-opening'&&!row.hold.blocked)&&row.classification.brand===e.brand&&row.classification.productType===e.productType&&row.classification.sourceName===e.sourceName);
  }
 };
}
export const catalogClassificationStore=createCatalogClassificationStore();
export const configureCatalogClassificationStore=context=>catalogClassificationStore.configure(context);
