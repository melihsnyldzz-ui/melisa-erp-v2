import fs from 'node:fs/promises';
import {reportError} from './workReportsModel.mjs';
const ERP_STATUS='C:/Sirket/ERP/runtime/canonical-test/health-status.json';
const CRM_STATUS='C:/Sirket/CRM/runtime/test-completion/health-status.json';
const BACKUP_STATUS='C:/Sirket/ERP/runtime/canonical-test/backup-status.json';
let releaseContext=null;
export function configureWorkSystem(context){
 if(context?.identity?.databaseName!=='MELISA_ERP_SIRKET_TEST_20260929_01'||context.identity.serverName!=='Semih\\MELISADEV'||typeof context.release?.sourceCommit!=='string'||typeof context.release?.packageId!=='string')throw reportError(503);
 releaseContext={...context.release};
}
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?v:null;
async function readStatus(file){try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>256000)return null;return JSON.parse(await fs.readFile(file,'utf8'));}catch{return null;}}
async function probe(url,check){try{const response=await fetch(url,{signal:AbortSignal.timeout(1500),redirect:'error',headers:{Accept:'application/json'}});const body=await response.json();return response.ok&&check(body);}catch{return false;}}
async function probeDatabase(){try{const db=await import('../config/database.js');if(!db.isCanonicalTest())return false;const row=(await (await db.getSqlPool()).request().query("SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName")).recordset?.[0];return row?.databaseName==='MELISA_ERP_SIRKET_TEST_20260929_01'&&row.serverName==='Semih\\MELISADEV';}catch{return false;}}
export function startupProjection(record,{sourceCommit=null,now=Date.now()}={}){
 if(!record||record.version!==1||!['CANONICAL_TEST','TEST'].includes(record.environment)||!stamp(record.observedAt)||now-Date.parse(record.observedAt)>90000||Date.parse(record.observedAt)>now+5000||sourceCommit&&record.sourceCommit!==sourceCommit)return {status:'unknown',lastCheckAt:null};
 const configured=record.startup?.configured===true,state=record.startup?.state;
 return {status:configured&&state==='running'?'technical_ready_acceptance_pending':configured&&['degraded','circuit-open'].includes(state)?'failed':configured?'configured':'disabled',lastCheckAt:record.observedAt};
}
export function backupProjection(record){
 const empty={backup:{status:'unknown',lastSuccessAt:null,sizeBytes:null,checksumVerified:null},restore:{status:'unknown',lastSuccessAt:null,sourceDatabaseMatched:null,criticalDataMatched:null}};
 if(record?.version!==1||record.environment!=='TEST'||record.sourceDatabase!=='MELISA_ERP_SIRKET_TEST_20260929_01')return empty;
 const b=record.backup||{},r=record.restore||{};
 return {backup:{status:b.status==='success'&&stamp(b.completedAt)&&b.checksumVerified===true?'success':b.status==='failed'?'failed':'unknown',lastSuccessAt:b.status==='success'?stamp(b.completedAt):null,sizeBytes:Number.isSafeInteger(b.sizeBytes)&&b.sizeBytes>=0?b.sizeBytes:null,checksumVerified:typeof b.checksumVerified==='boolean'?b.checksumVerified:null},restore:{status:r.status==='success'&&stamp(r.completedAt)&&r.sourceDatabaseMatched===true&&r.criticalDataMatched===true?'success':r.status==='failed'?'failed':'unknown',lastSuccessAt:r.status==='success'?stamp(r.completedAt):null,sourceDatabaseMatched:typeof r.sourceDatabaseMatched==='boolean'?r.sourceDatabaseMatched:null,criticalDataMatched:typeof r.criticalDataMatched==='boolean'?r.criticalDataMatched:null}};
}
export function createWorkSystemService({read=readStatus,health=probe,database=probeDatabase,context=()=>releaseContext,clock=()=>new Date()}={}){return {async summary(actor){
 const release=context();if(!release||!actor?.id||!Array.isArray(actor.permissions))throw reportError(403);
 const checkedAt=clock().toISOString();const [erp,crm,back,nativeReady,crmReady,databaseReady]=await Promise.all([read(ERP_STATUS),read(CRM_STATUS),read(BACKUP_STATUS),health('http://127.0.0.1:4146/test-health',b=>b.ok===true&&b.databaseName==='MELISA_ERP_SIRKET_TEST_20260929_01'&&b.sourceCommit===release.sourceCommit),health('http://127.0.0.1:62401/health',b=>b.success===true),database()]);
 const permissionsSummary=[];for(const [key,label] of [['sales.view','Satış görüntüleme'],['purchase.view','Alış görüntüleme'],['product.view','Ürün görüntüleme'],['finance.view','Finans görüntüleme'],['settings.manage','Ayarlar yönetimi']])if(actor.permissions.includes(key))permissionsSummary.push(label);
 return {environment:'TEST',package:{sourceCommit:release.sourceCommit,packageId:release.packageId},currentUser:{id:Number(actor.id),displayName:String(actor.displayName||actor.username||'Personel'),roleCodes:[String(actor.role?.code||'')],permissionsSummary},services:[{id:'api',label:'ERP bağlantısı',status:'ready',checkedAt},{id:'database',label:'Veri bağlantısı',status:databaseReady?'ready':'unavailable',checkedAt},{id:'native',label:'İşlem servisi',status:nativeReady?'ready':'unavailable',checkedAt},{id:'crm',label:'CRM bağlantısı',status:crmReady?'ready':'unavailable',checkedAt}],terminal:{webReady:true,physicalAcceptance:'pending',lastAccessAt:null},...backupProjection(back),autostart:{erp:startupProjection(erp,{sourceCommit:release.sourceCommit,now:clock().getTime()}),crm:startupProjection(crm,{now:clock().getTime()})}};
 }};}
export const workSystemService=createWorkSystemService();
