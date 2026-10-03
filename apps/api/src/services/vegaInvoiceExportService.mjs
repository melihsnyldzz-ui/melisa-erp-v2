import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {isAbsolute} from 'node:path';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {getSalesDraft} from './invoiceDraftService.js';
import {queryArmadaBridge} from './armadaReadBridgeClient.mjs';
import {createArmadaSaleSubmission} from './armadaSaleSubmission.mjs';
import {createInvoiceExportJournal} from './vegaInvoiceExportJournal.mjs';
import {exportError,exportDigest,invoiceExportSource,validateExportSource,compileInvoiceExport,exportNumber} from './vegaInvoiceExportCore.mjs';
const pending=new Map(),MAX_BATCH=20;
export function exportIds(value){
 if(!Array.isArray(value)||!value.length||value.length>MAX_BATCH||value.some(id=>!Number.isSafeInteger(Number(id))||Number(id)<1)||new Set(value.map(Number)).size!==value.length)throw exportError('EXPORT_IDS_INVALID','1–20 farklı fiş seçin.',400);
 return value.map(Number);
}
function authorize(actor,write=false){
 if(process.env.MELISA_PILOT_RUNTIME!=='true'||!actor?.permissions?.includes('sales.view')||(write&&!actor.permissions.includes('sales.finalize')))throw exportError('EXPORT_PERMISSION','Aktarım için satış görüntüleme ve kesinleştirme yetkileri gerekir.',403);
}
async function loadProfile(){
 const path=process.env.MELISA_INVOICE_EXPORT_PROFILE;
 if(!isAbsolute(path||''))throw exportError('EXPORT_PROFILE_REQUIRED','Armada aktarım bağlantısı yapılandırılmadı.',503);
 try{
  const p=JSON.parse(await readFile(path,'utf8'));
  if(p.bridgeUrl!=='http://192.168.1.42:4533/read'||!/^[a-f0-9]{64}$/.test(p.key||'')||!Number.isSafeInteger(p.terminalId)||p.terminalId<1)throw Error();
  return p;
 }catch{throw exportError('EXPORT_PROFILE_INVALID','Armada aktarım profili okunamadı.',503);}
}
export function readExportVega(request){
 return new Promise((resolve,reject)=>{
  const config=process.env.MELISA_INVOICE_EXPORT_SOURCE_CONFIG;
  if(!isAbsolute(config||''))return reject(exportError('EXPORT_SOURCE_REQUIRED','Salt okunur Vega kaynağı yapılandırılmadı.',503));
  const child=spawn(process.execPath,[fileURLToPath(new URL('../../scripts/vega-invoice-export-read.mjs',import.meta.url)),config],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let body='',done=false;
  const finish=(error,data)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(data);};
  const error=()=>exportError('EXPORT_SOURCE_UNAVAILABLE','Vega verileri salt okunur doğrulanamadı. Gönderim yapılmadı.',503);
  const timer=setTimeout(()=>{child.kill();finish(error());},25000);
  child.stdout.on('data',c=>{body+=c;if(body.length>2*1024*1024){child.kill();finish(error());}});
  child.stderr.resume();child.on('error',()=>finish(error()));child.stdin.on('error',()=>{});
  child.on('close',()=>{try{const p=JSON.parse(body);if(!p.ok)throw Error();finish(null,p.data);}catch{finish(error());}});
  child.stdin.end(JSON.stringify(request));
 });
}
async function sourceMappings(source,ctx=null){
 const pool=ctx?.pool||await getSqlPool(),sql=getSqlDriver(),q=ctx?new ctx.sqlDriver.Request(ctx.transaction):pool.request();
 const ids=[...new Set(source.items.map(i=>i.productId))];
 const params=ids.map((id,i)=>{q.input('m'+i,sql.BigInt,id);return '@m'+i;}).join(',');
 const rows=(await q.query(`SELECT entity_id,after_json FROM dbo.audit_logs WHERE entity_type=N'product' AND action IN(N'pilot_product_opening_imported',N'full_stock_product_imported',N'vega_card_imported') AND entity_id IN(${params}) ORDER BY id`)).recordset;
 return ids.map(productId=>{
  const found=rows.filter(r=>Number(r.entity_id)===productId).map(r=>JSON.parse(r.after_json)).filter(r=>typeof r.source==='string'&&r.source.startsWith('VEGA2026/F0102'));
  const sourceIds=[...new Set(found.map(r=>Number(r.sourceId)))];
  if(sourceIds.length!==1||!Number.isSafeInteger(sourceIds[0])||sourceIds[0]<1)throw exportError('EXPORT_SOURCE_MAPPING','Melisa ürününün doğrulanmış Vega bağlantısı eksik veya çelişkili.');
  return {productId,sourceId:sourceIds[0]};
 });
}
const journal=()=>createInvoiceExportJournal(process.env.MELISA_INVOICE_EXPORT_JOURNAL);
async function bridgeSnapshot(profile){
 try{return await queryArmadaBridge(profile,'snapshot');}
 catch{throw exportError('EXPORT_BRIDGE_UNAVAILABLE','Armada doğrulama servisine ulaşılamıyor (192.168.1.42:4533). Vega gönderimi başlamadı.',503);}
}
const summary=source=>({invoiceId:source.id,documentNo:source.documentNo,date:source.documentDate,customer:source.customerName,
 employee:source.employeeName,currency:source.currency,total:source.grandTotal,rate:source.exchangeRate,lines:source.items.length});
export async function previewInvoiceExport(ids,actor){
 authorize(actor,true);ids=exportIds(ids);
 for(const [token,p] of pending)if(p.expiresAt<Date.now())pending.delete(token);
 if(pending.size>=100)throw exportError('EXPORT_PREVIEW_LIMIT','Bekleyen önizleme sayısı dolu; birkaç dakika sonra deneyin.',429);
 let profile,bridge,connectionError;
 try{profile=await loadProfile();bridge=await bridgeSnapshot(profile);}catch(e){connectionError=e;}
 const j=journal(),rows=[],prepared=[];
 for(const invoiceId of ids){
  let source;
  try{
   source=invoiceExportSource(await getSalesDraft(invoiceId));
   const prior=await j.inspect({invoiceId});
   if(prior.state!=='NOT_ATTEMPTED'){rows.push({...summary(source),...prior,ready:false,message:prior.state==='VERIFIED'?'Daha önce Vega’ya gönderildi.':'Önceki gönderim sonucu incelenmeli; tekrar gönderilemez.'});continue;}
   validateExportSource(source);if(connectionError)throw connectionError;
   const mappings=await sourceMappings(source),mapping=await readExportVega({operation:'mapping',customerCode:source.customerCode,mappings,documentNumber:exportNumber(source)});
   const snapshot=compileInvoiceExport(source,mapping,bridge,profile,{uid:randomUUID(),actor});
   prepared.push(snapshot);rows.push({...summary(source),state:'READY',ready:true,target:snapshot.target,vegaDocumentNo:snapshot.expected.documentNumber,message:'Gönderim ön kontrolü tamamlandı.'});
  }catch(e){rows.push({...(source?summary(source):{invoiceId}),state:'BLOCKED',ready:false,message:e.statusCode?e.message:'Fiş aktarım için doğrulanamadı.'});}
 }
 const token=randomUUID(),expiresAt=Date.now()+300000;
 pending.set(token,{actorId:actor.id,expiresAt,prepared,used:false});
 return {token,expiresAt:new Date(expiresAt).toISOString(),rows,readyCount:prepared.length,source:'MELISA_ERP_V2',target:'VEGA2026 / F0102 / D0007',
  notice:'Melisa fişi korunur. Vega’da gerçek satış, stok ve cari hareketi oluşur. Kaynak personel fiş notunda korunur; Vega personeli önizlemedeki aktarım hesabıdır. Tahsilat yeniden aktarılmaz. Gönderim denenince fişin bu test ERP’sinden düzenlenmesi/iptali inceleme için kilitlenir.'};
}
async function reconcileResult(profile,expected){
 const linkRows=(await queryArmadaBridge(profile,'link',expected.uid)).recordsets?.[0],link=linkRows?.[0];
 if(linkRows?.length!==1||String(link.uid).toLowerCase()!==expected.uid||link.terminalId!==expected.armadaTerminalId||link.documentType!==33||Number(link.customerId)!==expected.customerId||link.currency!==expected.currency||link.armadaDocumentNumber!==expected.documentNumber||!Number.isSafeInteger(link.vegaDocumentId)||link.vegaDocumentId<1||(expected.vegaDocumentId&&expected.vegaDocumentId!==link.vegaDocumentId))return {state:'REVIEW_REQUIRED',reason:'ARMADA_UID_LINK_UNCONFIRMED'};
 return readExportVega({operation:'result',expected:{...expected,vegaDocumentId:link.vegaDocumentId}});
}
export async function getInvoiceExportStatus(ids,actor,reconcile=false){
 authorize(actor);ids=exportIds(ids);const j=journal(),rows=[];
 for(const invoiceId of ids){
  try{
   let state=await j.inspect({invoiceId}),snapshot=await j.loadPrepared({invoiceId});
   if(snapshot&&reconcile){
    const profile=await loadProfile();
    const sender=createArmadaSaleSubmission({journal:j,readResult:e=>reconcileResult(profile,e)});
    state=await sender.status({invoiceId});
   }
   if(snapshot){
    const source=invoiceExportSource(await getSalesDraft(invoiceId));
    if(exportDigest(source)!==snapshot.sourceHash)state={...state,state:'REVIEW_REQUIRED',reason:'MELISA_SOURCE_CHANGED',message:'Melisa fişi aktarım kaydından farklı; iki sistem birlikte incelenmeli.'};
   }
   rows.push({invoiceId,...state,mayResend:false});
  }catch{rows.push({invoiceId,state:'REVIEW_REQUIRED',mayResend:false,message:'Aktarım sonucu doğrulanamadı; tekrar göndermeyin.'});}
 }
 return {rows};
}
export async function submitInvoiceExport(token,confirmed,actor){
 authorize(actor,true);
 const p=pending.get(token);
 if(!p||p.actorId!==actor.id||p.expiresAt<Date.now()||confirmed!==true)throw exportError('EXPORT_PREVIEW_REQUIRED','Güncel önizlemeyi açıp seçilen fişlerin gerçek Vega gönderimini onaylayın.');
 if(p.used)return getInvoiceExportStatus(p.prepared.map(s=>s.source.id),actor);
 if(!p.prepared.length)throw exportError('EXPORT_NONE_READY','Gönderime uygun fiş yok.');
 if(process.env.MELISA_INVOICE_EXPORT_ENABLED!=='true')throw exportError('EXPORT_DISABLED','Vega fiş aktarımı etkin değil.',503);
 p.used=true;
 const profile=await loadProfile(),j=journal(),results=[];
 for(const saved of p.prepared){
  const invoiceId=saved.source.id,pool=await getSqlPool(),sql=getSqlDriver(),tx=new sql.Transaction(pool);
  let begun=false;
  try{
   await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
   await new sql.Request(tx).input('id',sql.BigInt,invoiceId).query('SET LOCK_TIMEOUT 15000; SELECT id FROM dbo.sales_invoices WITH(UPDLOCK,HOLDLOCK) WHERE id=@id');
   const {assertInvoiceHasNoReturns}=await import('./invoiceReturnGuard.mjs');
   await assertInvoiceHasNoReturns(()=>new sql.Request(tx),'sales',invoiceId);
   const ctx={pool,sqlDriver:sql,transaction:tx};
   const sender=createArmadaSaleSubmission({journal:j,refreshUnattempted:true,prepareSale:async()=>saved,
    validateBeforeSend:async()=>{
     authorize(actor,true);
     const current=invoiceExportSource(await getSalesDraft(invoiceId,ctx));
     if(exportDigest(current)!==saved.sourceHash)throw exportError('EXPORT_SOURCE_CHANGED','Fiş önizlemeden sonra değişti. Yeni önizleme gerekli.');
     const mappings=await sourceMappings(current,ctx),mapping=await readExportVega({operation:'mapping',customerCode:current.customerCode,mappings,documentNumber:exportNumber(current)});
     const fresh=compileInvoiceExport(current,mapping,await bridgeSnapshot(profile),profile,{uid:saved.expected.uid,actor,now:saved.preparedAt});
     if(exportDigest(fresh)!==exportDigest(saved))throw exportError('EXPORT_TARGET_CHANGED','Vega eşleştirmesi önizlemeden sonra değişti; yeni önizleme gerekli.');
     return fresh;
    },readResult:e=>reconcileResult(profile,e)});
   const result=await sender.submit({invoiceId});
   await tx.commit();begun=false;
   results.push({invoiceId,documentNo:saved.source.documentNo,...result});
   if(result.state!=='VERIFIED')break;
  }catch(e){
   if(begun)await tx.rollback().catch(()=>{});
   let prior;try{prior=await j.inspect({invoiceId});}catch{prior={state:'REVIEW_REQUIRED'};}
   results.push({invoiceId,state:prior.state==='NOT_ATTEMPTED'?'BLOCKED':'REVIEW_REQUIRED',mayResend:false,message:e.statusCode?e.message:'Aktarım sonucu doğrulanamadı; yeni gönderim yapmayın.'});break;
  }
 }
 for(const s of p.prepared)if(!results.some(r=>r.invoiceId===s.source.id))results.push({invoiceId:s.source.id,state:'NOT_ATTEMPTED',message:'Önceki fişte işlem durdu; bu fiş gönderilmedi.'});
 return {rows:results};
}
