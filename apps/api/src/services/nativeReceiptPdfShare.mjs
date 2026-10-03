import {createHash,randomBytes} from 'node:crypto';
import {nativeOwnedInvoice} from './nativeTerminalSale.mjs';
import {getSalesDraft} from './invoiceDraftService.js';
import {getUserById} from './authService.js';
import {nativeError,positiveId} from './nativeTerminalPolicy.mjs';

const lifetimeMs=10*60*1000;
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const keyFor=token=>createHash('sha256').update(token).digest('hex');
const canShare=actor=>Array.isArray(actor?.permissions)&&actor.permissions.some(p=>p==='terminal.sales.create'||p==='sales.create');
const unavailable=()=>nativeError('NATIVE_PDF_LINK_UNAVAILABLE','Bu bağlantı artık kullanılamıyor. Terminalden yeni QR kod açın.',404);
const render=async invoice=>(await import('./terminalReceiptPdf.mjs')).buildTerminalReceiptPdf(invoice);

/** A receipt-specific capability; never an ERP login token or generic document endpoint. */
export function createNativeReceiptPdfShare({baseUrl,ownedInvoice=nativeOwnedInvoice,readInvoice=getSalesDraft,
 readActor=getUserById,renderPdf=render,now=Date.now,randomToken=()=>randomBytes(32).toString('base64url'),
 ttlMs=lifetimeMs,maxGrants=500}={}){
 const origin=new URL(baseUrl);
 if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)
  throw Error('A trusted native API origin is required');
 if(!Number.isInteger(ttlMs)||ttlMs<1||ttlMs>lifetimeMs||!Number.isInteger(maxGrants)||maxGrants<1||maxGrants>500)
  throw Error('Invalid receipt share lifetime or capacity');
 const grants=new Map();
 function prune(){for(const [key,grant] of grants)if(grant.expiresAt<=now())grants.delete(key);}
 function verifyActor(actor){
  if(!Number.isSafeInteger(Number(actor?.id))||Number(actor?.id)<1)
   nativeError('TERMINAL_OPERATOR_REQUIRED','Personel girişi gerekli.',401);
  if(!canShare(actor))nativeError('AUTH_PERMISSION_DENIED','Bu fişi paylaşma yetkiniz yok.',403);
 }
 async function eligible(invoiceId,terminalCode,actor){
  await ownedInvoice(invoiceId,terminalCode,actor);
  const invoice=await readInvoice(invoiceId);
  if(Number(invoice?.id)!==invoiceId||invoice.status!=='FINALIZED')
   nativeError('NATIVE_PDF_RECEIPT_UNAVAILABLE','Yalnız gönderilmiş ve iptal edilmemiş fiş paylaşılabilir.',409);
  return invoice;
 }
 return {
  async mint(id,terminalCode,actor){
   verifyActor(actor);
   const invoiceId=positiveId(id);
   if(typeof terminalCode!=='string'||!/^[-\w]{1,80}$/.test(terminalCode))
    nativeError('TERMINAL_CODE_REQUIRED','Geçerli terminal kodu gerekli.',400);
   const invoice=await eligible(invoiceId,terminalCode,actor);
   prune();
   const token=randomToken();
   if(typeof token!=='string'||!tokenPattern.test(token)||grants.has(keyFor(token)))
    nativeError('NATIVE_PDF_LINK_FAILED','QR kod oluşturulamadı. Yeniden deneyin.',503);
   while(grants.size>=maxGrants)grants.delete(grants.keys().next().value);
   const expiresAt=now()+ttlMs;
   grants.set(keyFor(token),{invoiceId,terminalCode,actorId:Number(actor.id),expiresAt});
   return {url:`${origin.origin}/native-receipts/${token}.pdf`,expiresAt:new Date(expiresAt).toISOString(),documentNumber:String(invoice.documentNo??'')};
  },
  async download(token){
   if(typeof token!=='string'||!tokenPattern.test(token))unavailable();
   const key=keyFor(token),grant=grants.get(key);
   if(!grant||grant.expiresAt<=now()){grants.delete(key);unavailable();}
   let invoice;
   try{
    const actor=await readActor(grant.actorId);
    verifyActor(actor);
    if(Number(actor.id)!==grant.actorId)unavailable();
    invoice=await eligible(grant.invoiceId,grant.terminalCode,actor);
   }catch(error){
    if([400,401,403,404,409].includes(error.statusCode)){grants.delete(key);unavailable();}
    throw error;
   }
   const bytes=await renderPdf(invoice);
   if(!Buffer.isBuffer(bytes)||bytes.length<5||bytes.subarray(0,5).toString()!=='%PDF-')
    nativeError('NATIVE_PDF_RENDER_FAILED','PDF hazırlanamadı. Yeniden deneyin.',503);
   // Never serve a grant that expired or was evicted during an asynchronous read/render.
   if(grants.get(key)!==grant||grant.expiresAt<=now()){grants.delete(key);unavailable();}
   return {bytes,documentNumber:String(invoice.documentNo??'')};
  }
 };
}
