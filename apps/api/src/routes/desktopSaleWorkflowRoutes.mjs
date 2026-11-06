import {Router} from 'express';
import {desktopSaleCurrencySelection} from '../../../../packages/shared/src/desktopSaleCurrencySelection.mjs';
const permissions={PREPARE:'sales.create',SAVE_CARTONS:'sales.edit',READY:'sales.edit',CHECK:'sales.finalize',CANCEL:'sales.edit'};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const unknown=requestId=>({success:false,data:{state:'UNKNOWN',requestId:typeof requestId==='string'&&/^[0-9a-f-]{36}$/.test(requestId)?requestId:null,retry:'SAME_REQUEST_ONLY'}});
export function createDesktopSaleWorkflowRoutes({service,draftService,dispatchService,readService,resolutionService,authenticateNormal}={}){
 if(typeof service?.transition!=='function'||typeof authenticateNormal!=='function')throw Error('DESKTOP_WORKFLOW_CONFIGURATION');
 const router=Router();
 router.post('/api/desktop-sale/resolve',async(req,res)=>{
  try{
   if(typeof resolutionService?.resolve!=='function'||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294'||!req.is('application/json')||Object.keys(req.query).length)throw Error();
   const user=await authenticateNormal(req),actor=typeof user?.userId==='number'?String(user.userId):user?.userId;if(user?.kind!=='normal'||!id(actor)||!user.permissions?.includes('sales.view'))throw Error();
   return res.json({success:true,data:await resolutionService.resolve(actor,req.body)});
  }catch{return res.status(503).json({success:false});}
 });
 router.get('/api/desktop-sale/workflows/:id',async(req,res)=>{
  try{
   if(typeof readService?.read!=='function'||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294'||Object.keys(req.query).length||!id(req.params.id))throw Error();
   const user=await authenticateNormal(req),actor=typeof user?.userId==='number'?String(user.userId):user?.userId;if(user?.kind!=='normal'||!id(actor)||!user.permissions?.includes('sales.view'))throw Error();
   return res.json({success:true,data:await readService.read(actor,req.params.id)});
  }catch{return res.status(503).json({success:false});}
 });
 router.get('/api/desktop-sale/draft-preview',async(req,res)=>{
  try{
   const quote=Object.hasOwn(req.query,'discountRateExact4'),fx=Object.hasOwn(req.query,'currencySelection');
   if(typeof draftService?.preview!=='function'||fx&&!quote||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294'||Object.keys(req.query).sort().join(',')!==['customerId','documentDate','productIds',...(quote?['discountRateExact4','quantities','quantityUnits']:[]),...(fx?['currencySelection']:[])].sort().join(',')||typeof req.query.productIds!=='string'||quote&&['quantities','quantityUnits','discountRateExact4'].some(k=>typeof req.query[k]!=='string'))throw Error();
   let currencySelection;if(fx){if(typeof req.query.currencySelection!=='string'||req.query.currencySelection.length>512)throw Error();currencySelection=desktopSaleCurrencySelection(JSON.parse(req.query.currencySelection));}
   const user=await authenticateNormal(req),actor=typeof user?.userId==='number'?String(user.userId):user?.userId;
   if(user?.kind!=='normal'||!id(actor)||!Array.isArray(user.permissions)||['sales.create','sales.finalize'].some(p=>!user.permissions.includes(p)))throw Error();
   const data=await draftService.preview(actor,{customerId:req.query.customerId,documentDate:req.query.documentDate,productIds:req.query.productIds.split(','),...(quote?{quantities:req.query.quantities.split(','),quantityUnits:req.query.quantityUnits.split(','),discountRateExact4:req.query.discountRateExact4}:{}),...(fx?{currencySelection}:{})});return res.json({success:true,data});
  }catch(error){if(error?.code==='DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED')return res.status(403).json({success:false,code:'DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED'});if(['DESKTOP_COMPANY_RATE_REQUIRED','DESKTOP_COMPANY_RATE_CHANGED','DESKTOP_SALE_PRICE_REQUIRED'].includes(error?.code))return res.status(409).json({success:false,code:error.code});return res.status(503).json({success:false});}
 });
 router.post('/api/desktop-sale/workflows/:id/dispatch',async(req,res)=>{
  const requestId=req.body?.requestId;try{
   if(typeof dispatchService?.dispatch!=='function'||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294'||!req.is('application/json')||Object.keys(req.query).length||!id(req.params.id)||req.body?.invoiceId!==req.params.id)throw Error();
   const user=await authenticateNormal(req),actor=typeof user?.userId==='number'?String(user.userId):user?.userId;
   if(user?.kind!=='normal'||!id(actor)||!Array.isArray(user.permissions)||['sales.create','sales.finalize'].some(p=>!user.permissions.includes(p)))throw Error();
   const result=await dispatchService.dispatch(actor,req.body);
   if(result?.state!=='COMMITTED'||result.requestId!==requestId||result.invoiceId!==req.params.id||result.workflowState!=='COMPLETED'||typeof result.version!=='string'||!/^0x[0-9A-F]{16}$/.test(result.version)||typeof result.replayed!=='boolean')throw Error();
   return res.status(result.replayed?200:201).json({success:true,data:result});
  }catch{return res.status(503).json(unknown(requestId));}
 });
 router.post('/api/desktop-sale/drafts',async(req,res)=>{
  const requestId=req.body?.requestId;try{
   if(typeof draftService?.createDraft!=='function'||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294'||!req.is('application/json')||Object.keys(req.query).length)throw Error();
   const user=await authenticateNormal(req),actor=typeof user?.userId==='number'?String(user.userId):user?.userId;
   if(user?.kind!=='normal'||!id(actor)||!Array.isArray(user.permissions)||['sales.create','sales.finalize'].some(p=>!user.permissions.includes(p)))throw Error();
   const result=await draftService.createDraft(actor,req.body);
   if(result?.state!=='COMMITTED'||result.requestId!==requestId||!id(result.invoiceId)||result.workflowState!=='DRAFT'||typeof result.version!=='string'||!/^0x[0-9A-F]{16}$/.test(result.version)||typeof result.replayed!=='boolean')throw Error();
   return res.status(result.replayed?200:201).json({success:true,data:result});
  }catch{return res.status(503).json(unknown(requestId));}
 });
 router.post('/api/desktop-sale/workflows/:id/transitions',async(req,res)=>{
  const requestId=req.body?.requestId;
  try{
   if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294'||!req.is('application/json')||Object.keys(req.query).length||!id(req.params.id)||req.body?.invoiceId!==req.params.id||!Object.hasOwn(permissions,req.body?.operation))throw Error();
   const user=await authenticateNormal(req),actor=typeof user?.userId==='number'?String(user.userId):user?.userId;
   if(user?.kind!=='normal'||!id(actor)||!Array.isArray(user.permissions)||!user.permissions.includes(permissions[req.body.operation]))throw Error();
   const result=await service.transition(actor,req.body);
   if(result?.state!=='COMMITTED'||result.requestId!==requestId||result.invoiceId!==req.params.id||result.operation!==req.body.operation||typeof result.replayed!=='boolean')throw Error();
   return res.status(result.replayed?200:201).json({success:true,data:result});
  }catch{return res.status(503).json(unknown(requestId));}
 });return router;
}
