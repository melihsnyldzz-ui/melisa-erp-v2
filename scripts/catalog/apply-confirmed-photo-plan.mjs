import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const requireRule=(condition,code)=>{if(!condition)throw new Error(code);};
const expectedRecordsSha='5da967d2652aa0d6710ad206ac10b7a5898d5a8af7ff3f45e048669e15d22b6d';
export function confirmedPhotoRecords(plan,{expectedCount=3830,expectedRecordsHash=expectedRecordsSha}={}){
 requireRule(plan?.schemaVersion==='melisa-erp.photo-mapping-plan.v1'&&Array.isArray(plan.records),'PLAN_SCHEMA');
 requireRule(sha(JSON.stringify(plan.records))===plan.recordsSha256&&plan.recordsSha256===expectedRecordsHash,'PLAN_HASH');
 const records=plan.records.filter(r=>r.status==='CONFIRMED');
 requireRule(records.length===expectedCount&&new Set(records.map(r=>r.productId)).size===records.length,'CONFIRMED_UNIQUE_COUNT');
 for(const r of records)requireRule(typeof r.productId==='string'&&/^[1-9]\d*$/.test(r.productId)&&typeof r.stockCode==='string'&&r.confidence==='EXACT_IDENTITY'&&/^[a-f0-9]{64}$/.test(r.sha256)&&r.provenance?.verified===true&&r.provenance.kind==='accepted-opening'&&r.hold?.blocked===false,'CONFIRMED_IDENTITY');
 return records;
}
export function validateFreshProduct(record,payload){
 const p=payload?.data,m=payload?.meta;
 requireRule(payload?.success===true&&m?.schemaVersion==='melisa-catalog.v1'&&m.readOnly===true&&m.scopeCounts?.acceptedOpening===16622&&m.scopeCounts?.quarantinedSource===54&&m.scopeCounts?.syntheticTest===0,'CURRENT_CATALOG_SCOPE');
 requireRule(p?.id===record.productId&&p.stockCode===record.stockCode&&p.hold?.blocked===false&&p.provenance?.verified===true&&p.provenance.kind==='accepted-opening'&&p.provenance.sourceKey===record.provenance.sourceKey&&p.provenance.runId===record.provenance.runId,'CURRENT_PRODUCT_IDENTITY');
 return p;
}
export async function verifiedSourceBytes(record,sourceRoot){
 const root=path.resolve(sourceRoot),file=path.resolve(record.filePath);
 requireRule(file.startsWith(root+path.sep)&&path.resolve(root,record.relativePath)===file,'SOURCE_SCOPE');
 for(let current=file;current!==root;current=path.dirname(current)){requireRule(!(await fs.lstat(current)).isSymbolicLink(),'SOURCE_REPARSE');}
 requireRule(await fs.realpath(root)===root&&await fs.realpath(file)===file,'SOURCE_REALPATH');
 const before=await fs.stat(file),bytes=await fs.readFile(file),after=await fs.stat(file);
 requireRule(before.size===after.size&&before.mtimeMs===after.mtimeMs&&bytes.length===record.bytes&&sha(bytes)===record.sha256,'SOURCE_HASH_DRIFT');
 requireRule(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff,'SOURCE_JPEG');
 return bytes;
}
export async function publishObject(root,variant,bytes){
 requireRule(['original','thumbnail','preview'].includes(variant),'OBJECT_VARIANT');
 const digest=sha(bytes),relativePath=variant+'/'+digest+'.jpg',target=path.join(root,relativePath);
 await fs.mkdir(path.dirname(target),{recursive:true});
 requireRule(!(await fs.lstat(path.dirname(target))).isSymbolicLink(),'TARGET_REPARSE');
 try{await fs.writeFile(target,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;requireRule(!(await fs.lstat(target)).isSymbolicLink()&&sha(await fs.readFile(target))===digest,'EXISTING_OBJECT_DRIFT');}
 requireRule(sha(await fs.readFile(target))===digest,'COPIED_HASH_DRIFT');
 return {relativePath,sha256:digest,bytes:bytes.length};
}
async function main(){
 const [flag,planPath,privateAccessPath,evidenceDirectory]=process.argv.slice(2);
 requireRule(flag==='--apply-approved-erp-d04'&&path.isAbsolute(planPath||'')&&path.isAbsolute(privateAccessPath||'')&&path.isAbsolute(evidenceDirectory||''),'EXPLICIT_APPROVED_ARGUMENTS');
 const sourceRoot='C:\\Users\\Xaser\\Desktop\\Melisa Temiz Stok Fotoğrafları';
 const root='C:\\Sirket\\ERP\\data\\TEST-20260929-01\\catalog-media';
 const plan=JSON.parse((await fs.readFile(planPath,'utf8')).replace(/^\uFEFF/,''));
 requireRule(plan.archiveRoot===sourceRoot,'EXPECTED_ARCHIVE_ROOT');
 const records=confirmedPhotoRecords(plan),base='http://127.0.0.1:4144';let token='';
 const get=async route=>{const r=await fetch(base+route,{headers:token?{Authorization:'Bearer '+token}:{},redirect:'error',signal:AbortSignal.timeout(60000)});requireRule(r.ok,'CURRENT_API_'+r.status);return r.json();};
 const healthCheck=h=>requireRule(h.environment==='CANONICAL_TEST'&&h.mode==='erp'&&h.port===4144&&h.databaseName==='MELISA_ERP_SIRKET_TEST_20260929_01'&&h.serverName==='Semih\\MELISADEV'&&h.sysadmin===0&&h.databaseControl===0&&h.liveDatabaseAccess===0&&h.externalOperations===false,'TARGET_TEST_IDENTITY');
 const startedAt=new Date().toISOString(),health=await get('/test-health');healthCheck(health);
 const access=JSON.parse((await fs.readFile(privateAccessPath,'utf8')).replace(/^\uFEFF/,''));
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:access.username,password:access.password}),redirect:'error'});requireRule(login.ok,'ACTOR_LOGIN');
 const session=(await login.json()).data;requireRule(session?.user?.id===14&&session.user.permissions.includes('product.view'),'READ_ACTOR_14');token=session.accessToken;access.password='';
 const sharp=createRequire(new URL('../../apps/api/package.json',import.meta.url))('sharp');
 await fs.mkdir(root,{recursive:true});requireRule(await fs.realpath(root)===root&&!(await fs.lstat(root)).isSymbolicLink(),'CENTRAL_ROOT_REPARSE');
 await fs.mkdir(evidenceDirectory,{recursive:true});
 let previous=null;const existingIndexPath=path.join(root,'index.json');
 try{
  requireRule(!(await fs.lstat(existingIndexPath)).isSymbolicLink()&&await fs.realpath(existingIndexPath)===existingIndexPath,'EXISTING_INDEX_REPARSE');
  previous=JSON.parse(await fs.readFile(existingIndexPath,'utf8'));
  requireRule(Object.keys(previous).sort().join(',')==='batchId,database,entries,planRecordsSha256,schemaVersion,server'&&previous.schemaVersion==='melisa-erp.catalog-media.v1'&&previous.server==='Semih\\MELISADEV'&&previous.database==='MELISA_ERP_SIRKET_TEST_20260929_01'&&previous.planRecordsSha256===plan.recordsSha256&&previous.batchId==='ERP-D04-20261005-'+plan.recordsSha256.slice(0,12)&&Array.isArray(previous.entries)&&previous.entries.length===records.length,'EXISTING_INDEX_METADATA_DRIFT');
 }catch(e){if(e.code!=='ENOENT')throw e;}
 const entries=[],rejected=[],proofs=[];let position=0,lastProgress=Date.now();
 // Sequential guarded reads keep the real catalogue responsive and bind each copy to a fresh card.
 for(const record of records){
  try{
   healthCheck(await get('/test-health'));
   const payload=await get('/api/catalog/products/'+record.productId);validateFreshProduct(record,payload);
   const bytes=await verifiedSourceBytes(record,sourceRoot),image=sharp(bytes,{failOn:'error'});const metadata=await image.metadata();
   requireRule(metadata.format==='jpeg'&&metadata.width===record.width&&metadata.height===record.height,'IMAGE_DIMENSION_DRIFT');
   const original=await publishObject(root,'original',bytes);
   const thumbnail=await publishObject(root,'thumbnail',await image.clone().resize({width:128,height:128,fit:'inside',withoutEnlargement:true}).jpeg({quality:78}).toBuffer());
   const preview=await publishObject(root,'preview',await image.clone().resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer());
   const entry={productId:record.productId,stockCode:record.stockCode,sourceKey:record.provenance.sourceKey,runId:record.provenance.runId,sourceSha256:record.sha256,sourceFileName:record.fileName,validationStatus:'CONFIRMED',validatedAt:payload.meta.readAt,original,thumbnail,preview};
   entries.push(entry);proofs.push({productId:entry.productId,stockCode:entry.stockCode,currentReadAt:payload.meta.readAt,currentHoldBlocked:false,currentSourceKey:entry.sourceKey,sourceSha256:entry.sourceSha256,originalSha256:original.sha256});
  }catch(error){rejected.push({productId:record.productId,stockCode:record.stockCode,reason:/^[A-Z0-9_]+$/.test(error.message)?error.message:'COPY_OR_VALIDATION_FAILED'});}
  position++;if(Date.now()-lastProgress>40000){console.log(JSON.stringify({event:'approved_photo_progress',checked:position,total:records.length,copied:entries.length,rejected:rejected.length}));lastProgress=Date.now();}
 }
 healthCheck(await get('/test-health'));token='';
 const result={task:'ERP-D04',startedAt,completedAt:new Date().toISOString(),sourceCommit:health.sourceCommit,planRecordsSha256:plan.recordsSha256,centralRoot:root,checked:records.length,successfulCopies:entries.length,excludedAmbiguous:plan.records.filter(r=>r.status==='AMBIGUOUS').length,rejected,originalsChanged:false,sqlWrites:0,proofs};
 // A partial copy has no published product bindings; its safe objects may be reused after review.
 requireRule(new Set(entries.map(e=>e.productId)).size===entries.length,'DUPLICATE_APPLY_PRODUCT');
 if(rejected.length){result.bindingsPublished=0;await fs.writeFile(path.join(evidenceDirectory,'photo-apply-result.json'),JSON.stringify(result,null,2));throw Error('REJECTED_RECORDS_NO_INDEX_PUBLISHED');}
 const index={schemaVersion:'melisa-erp.catalog-media.v1',server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01',planRecordsSha256:plan.recordsSha256,batchId:'ERP-D04-20261005-'+plan.recordsSha256.slice(0,12),entries};
 if(previous){
  const stable=rows=>rows.map(({validatedAt,...v})=>v);requireRule(JSON.stringify(stable(previous.entries))===JSON.stringify(stable(entries)),'EXISTING_INDEX_DRIFT');result.indexReplay=true;
 }else{
  const indexPath=path.join(root,'index.json');const temp=path.join(root,'index-'+crypto.randomUUID()+'.pending');await fs.writeFile(temp,JSON.stringify(index,null,2)+'\n',{flag:'wx'});
  requireRule(!(await fs.lstat(temp)).isSymbolicLink(),'INDEX_REPARSE');await fs.link(temp,indexPath);await fs.unlink(temp);result.indexReplay=false;
 }
 result.bindingsPublished=entries.length;result.indexSha256=sha(await fs.readFile(path.join(root,'index.json')));await fs.writeFile(path.join(evidenceDirectory,'photo-apply-result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({event:'approved_photo_complete',bound:entries.length,excludedAmbiguous:result.excludedAmbiguous,rejected:0,centralRoot:root,indexSha256:result.indexSha256,indexReplay:result.indexReplay}));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{console.error(JSON.stringify({event:'approved_photo_failed',code:/^[A-Z0-9_]+$/.test(error.message)?error.message:'APPLY_FAILED'}));process.exitCode=1;});
