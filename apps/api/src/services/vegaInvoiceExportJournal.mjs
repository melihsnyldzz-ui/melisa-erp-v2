import {mkdir,open,readFile,unlink,lstat} from 'node:fs/promises';
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
  async function inspectAttempts(intent){
    const snapshot=await loadPrepared(intent),verified=await read(intent,'.verified');
    if(!snapshot){if(verified)throw exportError('EXPORT_JOURNAL_CORRUPT','Aktarım kayıtları tutarsız.');return {state:'NOT_ATTEMPTED'};}
    if(verified){
      if(verified.version!==1||verified.sourceHash!==snapshot.sourceHash||verified.documentNumber!==snapshot.expected.documentNumber||!Number.isSafeInteger(verified.documentId)||verified.documentId<1)throw exportError('EXPORT_JOURNAL_CORRUPT','Aktarım sonuç kaydı tutarsız.');
      return {state:'VERIFIED',documentId:verified.documentId,documentNumber:verified.documentNumber};
    }
    return {state:'REVIEW_REQUIRED'};
  }
  async function inspect(intent){
    const attempted=await inspectAttempts(intent);if(attempted.state!=='NOT_ATTEMPTED')return attempted;
    if(await cancellation(intent))return {state:'REVIEW_REQUIRED',reason:'CANCELLATION_FENCED'};
    try{await lstat(join(directory,key(intent)+'.mutation.lock'));return {state:'REVIEW_REQUIRED',reason:'MUTATION_LOCKED'};}
    catch(e){if(e.code!=='ENOENT')throw exportError('EXPORT_JOURNAL_CORRUPT','Aktarım kilidi doğrulanamadı.');}
    return attempted;
  }
  // Both export and cancellation acquire this same finite per-invoice lock.
  // An abandoned lock is never stolen automatically. Cancellation writes a
  // permanent fence BEFORE SQL effects, so releasing this lock cannot reopen
  // an export race while SQL commits (or its acknowledgement is unknown).
  async function mutation(intent,fn){
    await mkdir(directory,{recursive:true,mode:0o700});
    const path=join(directory,key(intent)+'.mutation.lock');let handle;
    try{handle=await open(path,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw exportError('EXPORT_MUTATION_BUSY','Fiş aktarım/iptal işlemi sürüyor veya inceleme gerektiriyor.');throw e;}
    try{return await fn();}finally{await handle.close();await unlink(path);}
  }
  function cancellationProof(intent,value){
    if(!value||Object.keys(value).sort().join(',')!=='actorId,payloadHash,requestId'||typeof value.actorId!=='string'||! /^[1-9]\d{0,15}$/.test(value.actorId)||BigInt(value.actorId)>9007199254740991n||typeof value.requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.requestId)||typeof value.payloadHash!=='string'||! /^[a-f0-9]{64}$/.test(value.payloadHash))throw exportError('EXPORT_CANCEL_PROOF_INVALID','İptal aktarım engeli doğrulanamadı.');
    return {version:1,invoiceId:Number(key(intent)),actorId:value.actorId,requestId:value.requestId,payloadHash:value.payloadHash};
  }
  async function cancellation(intent){
    const value=await read(intent,'.cancellation');if(!value)return null;
    if(Object.keys(value).sort().join(',')!=='actorId,invoiceId,payloadHash,requestId,version'||value.version!==1||value.invoiceId!==Number(key(intent)))throw exportError('EXPORT_JOURNAL_CORRUPT','İptal aktarım engeli okunamadı.');
    cancellationProof(intent,{actorId:value.actorId,requestId:value.requestId,payloadHash:value.payloadHash});return value;
  }
  return {inspect,loadPrepared,async getSubmission(){return null;},
    // Cancellation's own durable fence is not an export attempt. Its proof is
    // checked separately by claim/verify; public status remains REVIEW_REQUIRED.
    async assertCancellationUnexported(intent){if((await inspectAttempts(intent)).state!=='NOT_ATTEMPTED')throw exportError('EXPORT_INVOICE_LOCKED','Vega aktarımı denenmiş fiş iptal edilemez.');await cancellation(intent);return true;},
    async claimPrepared(intent,snapshot){
      return mutation(intent,async()=>{
        if(await cancellation(intent))throw exportError('EXPORT_CANCELLATION_FENCED','Bu fişte iptal denendi; Vega gönderimi yetkili incelemesine kadar kapalı.');
        try{await exclusive(intent,'.attempt',{version:1,invoiceId:Number(intent.invoiceId),hash:exportDigest(snapshot),snapshot,attemptedAt:new Date().toISOString()});return {maySend:true};}
        catch(e){if(e.code!=='EEXIST')throw e;return {...await inspectAttempts(intent),maySend:false};}
      });
    },
    async claimCancellation(intent,proof){
      const expected=cancellationProof(intent,proof);
      return mutation(intent,async()=>{
        if((await inspectAttempts(intent)).state!=='NOT_ATTEMPTED')throw exportError('EXPORT_INVOICE_LOCKED','Vega aktarımı denenmiş fiş iptal edilemez.');
        const existing=await cancellation(intent);
        if(existing){if(JSON.stringify(existing)!==JSON.stringify(expected))throw exportError('EXPORT_CANCELLATION_CONFLICT','Başka iptal isteği inceleme gerektiriyor.');}
        else await exclusive(intent,'.cancellation',expected);
        return {state:'CANCELLATION_FENCED'};
      });
    },
    async verifyCancellation(intent,proof){
      const expected=cancellationProof(intent,proof),existing=await cancellation(intent);
      if(!existing||JSON.stringify(existing)!==JSON.stringify(expected)||(await inspectAttempts(intent)).state!=='NOT_ATTEMPTED')throw exportError('EXPORT_CANCELLATION_CONFLICT','İptal aktarım engeli doğrulanamadı.');
      return true;
    },
    async cancellationState(intent,proof){
      const expected=cancellationProof(intent,proof),existing=await cancellation(intent);
      if((await inspectAttempts(intent)).state!=='NOT_ATTEMPTED'||existing&&JSON.stringify(existing)!==JSON.stringify(expected))throw exportError('EXPORT_CANCELLATION_CONFLICT','İptal aktarım engeli yetkili incelemesi gerektiriyor.');
      return existing?'CANCELLATION_FENCED':'NO_FENCE';
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
