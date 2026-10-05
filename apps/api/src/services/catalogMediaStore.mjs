import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {catalogError,parseCatalogId} from './catalogModel.mjs';
const ROOT='C:/Sirket/ERP/data/TEST-20260929-01/catalog-media';
const PLAN='5da967d2652aa0d6710ad206ac10b7a5898d5a8af7ff3f45e048669e15d22b6d';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const samePath=(a,b)=>process.platform==='win32'?path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase():path.resolve(a)===path.resolve(b);
const unavailable=()=>catalogError('CATALOG_MEDIA_UNAVAILABLE','Ürün fotoğrafı şu anda okunamıyor.',503);
const absent=()=>catalogError('CATALOG_MEDIA_NOT_FOUND','Ürün fotoğrafı bulunamadı.',404);
const check=ok=>{if(!ok)throw unavailable();};
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const utc=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&new Date(v).toISOString()===v;
const keys=(v,allowed)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===allowed.length&&Object.keys(v).every(k=>allowed.includes(k));
async function safePath(root,relative){
 check(typeof relative==='string'&&!relative.includes('\\')&&!path.isAbsolute(relative)&&!relative.split('/').some(p=>!p||p==='.'||p==='..'));
 const full=path.resolve(root,relative);check(full.startsWith(path.resolve(root)+path.sep));
 let current=path.parse(full).root;
 for(const part of full.slice(current.length).split(path.sep)){current=path.join(current,part);check(!(await fs.lstat(current)).isSymbolicLink());}
 check(samePath(await fs.realpath(full),full));return full;
}
async function readVerified(root,file){
 const full=await safePath(root,file.relativePath),before=await fs.stat(full);check(before.isFile()&&before.size===file.bytes);
 const bytes=await fs.readFile(full),after=await fs.stat(full);
 check(after.size===before.size&&after.mtimeMs===before.mtimeMs&&bytes.length===file.bytes&&digest(bytes)===file.sha256&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255);return bytes;
}
export function parseCatalogMediaVariant(query={}){
 if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).some(k=>k!=='variant'))throw catalogError('CATALOG_MEDIA_QUERY_INVALID','Geçerli fotoğraf boyutu gerekli.',400);
 const variant=query.variant===undefined?'preview':query.variant;
 if(!['preview','thumbnail','original'].includes(variant))throw catalogError('CATALOG_MEDIA_QUERY_INVALID','Geçerli fotoğraf boyutu gerekli.',400);return variant;
}
export function createCatalogMediaStore({expectedRoot=ROOT,expectedCount=3830}={}){
 let registry=null;
 function match(row){const entry=registry?.entries.get(row?.id);return entry&&row.stockCode===entry.stockCode&&row.provenance?.kind==='accepted-opening'&&row.provenance.verified===true&&row.provenance.sourceKey===entry.sourceKey&&row.provenance.runId===entry.runId&&row.provenance.sourceAsOf==='2026-09-30'&&row.hold?.blocked===false?entry:null;}
 return {
  async configure({root,indexSha256,identity,mode,port,writes}){
   registry=null;if(root===undefined||root===null)return;
   try{
    check(samePath(root,expectedRoot)&&mode==='erp'&&port===4144&&writes===true&&identity?.serverName==='Semih\\MELISADEV'&&identity.databaseName==='MELISA_ERP_SIRKET_TEST_20260929_01'&&identity.sysadmin===0&&identity.databaseControl===0&&identity.liveDatabaseAccess===0);
    check(hash(indexSha256));const filename=await safePath(root,'index.json'),raw=await fs.readFile(filename);check(raw.length<=16*1024*1024&&digest(raw)===indexSha256);const index=JSON.parse(raw.toString('utf8'));
    check(keys(index,['schemaVersion','server','database','planRecordsSha256','batchId','entries'])&&index.schemaVersion==='melisa-erp.catalog-media.v1'&&index.server===identity.serverName&&index.database===identity.databaseName&&index.planRecordsSha256===PLAN&&typeof index.batchId==='string'&&index.batchId.length>0&&index.batchId.length<=128&&Array.isArray(index.entries)&&index.entries.length===expectedCount);
    const entries=new Map(),sources=new Set();
    for(const e of index.entries){
     check(keys(e,['productId','stockCode','sourceKey','runId','sourceSha256','sourceFileName','validationStatus','validatedAt','original','thumbnail','preview']));parseCatalogId(e.productId);
     check(!entries.has(e.productId)&&!['301984','301985','301986'].includes(e.productId)&&typeof e.stockCode==='string'&&e.stockCode.length>0&&typeof e.sourceKey==='string'&&/^VEGA_CAPTURE_20260930_01\/F0102\/TBLSTOKLAR\/[1-9]\d*$/.test(e.sourceKey)&&e.runId==='VEGA-OPENING-TEST-20261004-06'&&hash(e.sourceSha256)&&typeof e.sourceFileName==='string'&&e.sourceFileName.length>0&&!/[\\/]/.test(e.sourceFileName)&&e.validationStatus==='CONFIRMED'&&utc(e.validatedAt));
     for(const variant of ['original','thumbnail','preview']){const f=e[variant];check(keys(f,['relativePath','sha256','bytes'])&&hash(f.sha256)&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&f.bytes<=32*1024*1024&&f.relativePath===`${variant}/${f.sha256}.jpg`);await readVerified(root,f);}
     check(e.original.sha256===e.sourceSha256&&!sources.has(e.sourceKey));sources.add(e.sourceKey);entries.set(e.productId,e);
    }
    registry={root,entries,bindingsJson:JSON.stringify([...entries.values()].map(e=>({productId:e.productId,stockCode:e.stockCode,sourceKey:e.sourceKey,runId:e.runId})))};
   }catch{registry=null;throw unavailable();}
  },
  photoFor(row){const e=match(row);return e?{status:'available',url:`/api/catalog/products/${e.productId}/photo?variant=preview`,thumbnailUrl:`/api/catalog/products/${e.productId}/photo?variant=thumbnail`,sourceKey:e.sourceKey,sha256:e.original.sha256,verified:true}:row.photo;},
  filterBindingsJson(){return registry?.bindingsJson??'[]';},
  async readPhoto(row,variant){const e=match(row);if(!e)throw absent();if(!['original','preview','thumbnail'].includes(variant))throw unavailable();try{return {bytes:await readVerified(registry.root,e[variant]),mimeType:'image/jpeg'};}catch{throw unavailable();}}
 };
}
export const catalogMediaStore=createCatalogMediaStore();
export const configureCatalogMediaStore=context=>catalogMediaStore.configure(context);
