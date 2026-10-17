import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {fail} from '../utils/response.js';

const filename=number=>`Melisa-Fis-${String(number).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,80)||'belge'}.pdf`;

/** Mount only on the trusted native LAN API at /native-receipts. */
export function createNativeReceiptPdfRoutes(share,{limit=60}={}){
 const router=Router();
 router.use((_req,res,next)=>{
  res.set({'Cache-Control':'no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff',
   'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive'});
  next();
 });
 router.use(rateLimit({windowMs:60*1000,limit,standardHeaders:'draft-7',legacyHeaders:false,
  handler:(_req,res)=>fail(res,429,'NATIVE_PDF_RATE_LIMITED','Çok sık denendi. Bir dakika sonra yeniden deneyin.')}));
 router.get('/:token.pdf',async(req,res)=>{
  try{
   const {bytes,documentNumber}=await share.download(req.params.token);
   res.set({'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${filename(documentNumber)}"`});
   return res.send(bytes);
  }catch(error){
   const known=error.code==='NATIVE_PDF_LINK_UNAVAILABLE';
   return fail(res,known?404:503,known?error.code:'NATIVE_PDF_UNAVAILABLE',
    known?error.message:'PDF şu anda hazırlanamadı. Biraz sonra yeniden deneyin.');
  }
 });
 // Keep malformed or unmatched capability URLs inside this boundary. The generic
 // ERP error logger records originalUrl and must never receive a share token.
 router.use((_req,res)=>fail(res,404,'NATIVE_PDF_LINK_UNAVAILABLE',
  'Bu bağlantı artık kullanılamıyor. Terminalden yeni QR kod açın.'));
 router.use((_error,_req,res,_next)=>{
  if(res.headersSent)return res.end();
  return fail(res,400,'NATIVE_PDF_REQUEST_INVALID','PDF bağlantısı okunamadı. Terminalden yeni QR kod açın.');
 });
 return router;
}
