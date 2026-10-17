import {mkdir,open,readFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {exportDigest,exportError} from './vegaInvoiceExportCore.mjs';
export function createInvoiceExportJournal(directory) {
  if(!isAbsolute(directory||''))throw exportError('EXPORT_JOURNAL_REQUIRED','Aktarım günlüğü yapılandırılmadı.',503);
  const key=intent=>{const id=Number(intent.invoiceId);if(!Number.isSafeInteger(id)||id<1)throw exportError('EXPORT_ID_INVALID','Fiş kimliği geçersiz.',400);return String(id);};
  async function read(intent,suffix){
    try{return JSON.parse(await readFile(join(directory,key(intent)+suffix+'.json'),'utf8'));}
    catch(e){if(e.code==='ENOENT')return null;throw exportError('EXPORT_JOURNAL_CORRUPT','Aktarım günlüğü okunamadı; tekrar gönderim engellendi.');}
  }
  async function exclusive(intent,suffix,data){
    await mkdir(directory,{recursive:true,mode:0o700});
    const f=await open(join(directory,key(intent)+suffix+'.json'),'wx',0o600);
    try{await f.writeFile(JSON.stringify(data));await f.sync();}finally{await f.close();}
  }
  async function loadPrepared(intent){
    const r=await read(intent,'.attempt');if(!r)return null;
    if(r.version!==1||r.invoiceId!==Number(intent.invoiceId)||!r.snapshot||r.hash!==exportDigest(r.snapshot)||r.snapshot.source.id!==r.invoiceId)
      throw exportError('EXPORT_JOURNAL_CORRUPT','Aktarım kaydı doğrulanamadı; tekrar gönderim engellendi.');
    return r.snapshot;
  }
  async function inspect(intent){
    const snapshot=await loadPrepared(intent),verified=await read(intent,'.verified');
    if(!snapshot){if(verified)throw exportError('EXPORT_JOURNAL_CORRUPT','Aktarım kayıtları tutarsız.');return {state:'NOT_ATTEMPTED'};}
    if(verified){
      if(verified.version!==1||verified.sourceHash!==snapshot.sourceHash||verified.documentNumber!==snapshot.expected.documentNumber||!Number.isSafeInteger(verified.documentId)||verified.documentId<1)throw exportError('EXPORT_JOURNAL_CORRUPT','Aktarım sonuç kaydı tutarsız.');
      return {state:'VERIFIED',documentId:verified.documentId,documentNumber:verified.documentNumber};
    }
    return {state:'REVIEW_REQUIRED'};
  }
  return {inspect,loadPrepared,async getSubmission(){return null;},
    async claimPrepared(intent,snapshot){
      try{await exclusive(intent,'.attempt',{version:1,invoiceId:Number(intent.invoiceId),hash:exportDigest(snapshot),snapshot,attemptedAt:new Date().toISOString()});return {maySend:true};}
      catch(e){if(e.code!=='EEXIST')throw e;return {...await inspect(intent),maySend:false};}
    },
    async recordVerified(intent,result){
      const snapshot=await loadPrepared(intent);if(!snapshot||result.state!=='VERIFIED'||result.documentNumber!==snapshot.expected.documentNumber||!Number.isSafeInteger(result.documentId)||result.documentId<1)throw exportError('EXPORT_RESULT_INVALID','Vega sonucu doğrulanamadı.');
      try{await exclusive(intent,'.verified',{version:1,sourceHash:snapshot.sourceHash,documentId:result.documentId,documentNumber:result.documentNumber,verifiedAt:new Date().toISOString()});}
      catch(e){if(e.code!=='EEXIST')throw e;}
      const saved=await inspect(intent);if(saved.documentId!==result.documentId)throw exportError('EXPORT_RESULT_CONFLICT','Vega sonuç kimliği çelişkili.');return saved;
    }};
}
export async function assertInvoiceNotExported(invoiceId){
  if(process.env.MELISA_PILOT_RUNTIME!=='true'||!process.env.MELISA_INVOICE_EXPORT_JOURNAL)return;
  const s=await createInvoiceExportJournal(process.env.MELISA_INVOICE_EXPORT_JOURNAL).inspect({invoiceId});
  if(s.state!=='NOT_ATTEMPTED')throw exportError('EXPORT_INVOICE_LOCKED','Bu fiş için Vega aktarımı denenmiş. Düzeltme/iptal öncesinde iki sistemdeki kayıt yetkili kişi tarafından birlikte incelenmeli.');
}
