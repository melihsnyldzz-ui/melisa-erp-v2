import {isDesktopProductMovements} from '../../../../packages/shared/src/desktopProductMovements.mjs';
// Source-only v2 list routes. The injected service owns the SQL transaction.
import {Router} from 'express';
import {desktopSalesReadMode} from '../../../../packages/shared/src/desktopSalesReadScope.mjs';
import {desktopProductCardId,isDesktopProductCard} from '../../../../packages/shared/src/desktopProductCard.mjs';
import {desktopCustomerCardId,isDesktopCustomerCard} from '../../../../packages/shared/src/desktopCustomerCard.mjs';
import {desktopCompanyRateDate,isDesktopCompanyRates} from '../../../../packages/shared/src/desktopCompanyRates.mjs';
import {desktopAccountSalesPage,isDesktopAccountSales} from '../../../../packages/shared/src/desktopAccountSales.mjs';
import {isDesktopBarcode,isDesktopBarcodeLookup} from '../../../../packages/shared/src/desktopBarcodeLookup.mjs';

export function createDesktopWriteListRoutes({service,authenticateNormal,richCards=false}={}){
 if(typeof richCards!=='boolean'||typeof service?.list!=='function'||typeof authenticateNormal!=='function'||richCards&&typeof service.readProduct!=='function')throw Error('DESKTOP_LIST_CONFIGURATION');
 const router=Router();
 if(richCards&&typeof service.readCompanyRates==='function')router.get('/api/desktop-company-rates',async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294')return res.status(403).json({success:false});
  try{if(Object.keys(req.query??{}).sort().join(',')!=='date')throw Error();desktopCompanyRateDate(req.query.date);}catch{return res.status(400).json({success:false});}
  let actor;try{actor=await authenticateNormal(req);}catch{return res.status(401).json({success:false});}if(actor?.kind!=='normal'||!Array.isArray(actor.permissions)||!actor.permissions.includes('sales.view'))return res.status(403).json({success:false});const actorId=typeof actor.userId==='number'&&Number.isSafeInteger(actor.userId)?String(actor.userId):actor.userId;
  try{const data=await service.readCompanyRates(actorId,req.query.date);if(!isDesktopCompanyRates(data,req.query.date))throw Error();return res.json({success:true,data});}catch{return res.status(503).json({success:false,error:{code:'DESKTOP_COMPANY_RATES_UNAVAILABLE'}});}
 });
 if(richCards&&typeof service.readProductBarcode==='function')router.get('/api/desktop-product-barcode',async(req,res)=>{
  res.set('Cache-Control','no-store');if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294')return res.status(403).json({success:false});
  if(Object.keys(req.query??{}).sort().join(',')!=='barcode'||!isDesktopBarcode(req.query.barcode))return res.status(400).json({success:false});let actor;try{actor=await authenticateNormal(req);}catch{return res.status(401).json({success:false});}if(actor?.kind!=='normal'||!Array.isArray(actor.permissions)||!actor.permissions.includes('product.view'))return res.status(403).json({success:false});const actorId=typeof actor.userId==='number'&&Number.isSafeInteger(actor.userId)?String(actor.userId):actor.userId;
  try{const data=await service.readProductBarcode(actorId,req.query.barcode);if(!data)return res.status(404).json({success:false,code:'DESKTOP_BARCODE_NOT_FOUND'});if(!isDesktopBarcodeLookup(data,req.query.barcode))throw Error();return res.json({success:true,data});}catch(error){if(error?.code==='DESKTOP_BARCODE_AMBIGUOUS')return res.status(409).json({success:false,code:'DESKTOP_BARCODE_AMBIGUOUS'});return res.status(503).json({success:false,error:{code:'DESKTOP_LIST_UNAVAILABLE'}});}
 });
 for(const kind of ['products','customers','suppliers','receipts'])router.get(`/api/${kind}`,async(req,res)=>{
  if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294')return res.status(403).json({success:false});
  const q=req.query||{};
  if(Object.keys(q).some(k=>!['page','limit','search'].includes(k))||['page','limit'].some(k=>q[k]!==undefined&&(typeof q[k]!=='string'||!(/^[1-9]\d{0,5}$/.test(q[k]))))||(q.search!==undefined&&(typeof q.search!=='string'||q.search.length>100||/[\u0000-\u001f\u007f]/.test(q.search))))return res.status(400).json({success:false});
  const page=q.page===undefined?1:Number(q.page),limit=q.limit===undefined?100:Number(q.limit);
  if(page>100000||limit>100)return res.status(400).json({success:false});
  let actor;try{actor=await authenticateNormal(req);}catch{return res.status(401).json({success:false});}
  if(actor?.kind!=='normal'||!Array.isArray(actor.permissions)||!actor.permissions.includes(({products:'product.view',customers:'customer.view',suppliers:'supplier.view',receipts:'sales.view'})[kind]))return res.status(403).json({success:false});
  const actorId=typeof actor.userId==='number'&&Number.isSafeInteger(actor.userId)?String(actor.userId):actor.userId;
  try{const result=await service.list(actorId,kind,{page,limit,search:q.search??''});return res.json({success:true,...result});}
  catch{return res.status(503).json({success:false,error:{code:'DESKTOP_LIST_UNAVAILABLE'}});}
 });
 if(richCards&&typeof service.readProductMovements==='function')router.get('/api/desktop-products/:productId/movements',async(req,res)=>{
  res.set('Cache-Control','no-store');if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294')return res.status(403).json({success:false});
  const q=req.query??{},page=q.page===undefined?1:typeof q.page==='string'&&/^[1-9]\d{0,5}$/.test(q.page)?Number(q.page):null;if(Object.keys(q).some(k=>k!=='page')||!page||page>100000||!desktopProductCardId(req.params.productId))return res.status(400).json({success:false});
  let actor;try{actor=await authenticateNormal(req)}catch{return res.status(401).json({success:false})}if(actor?.kind!=='normal'||!Array.isArray(actor.permissions)||!['product.view','product.edit'].every(p=>actor.permissions.includes(p)))return res.status(403).json({success:false});const actorId=typeof actor.userId==='number'&&Number.isSafeInteger(actor.userId)?String(actor.userId):actor.userId;
  try{const data=await service.readProductMovements(actorId,req.params.productId,{page});if(!data)return res.status(404).json({success:false});if(!isDesktopProductMovements(data,{productId:req.params.productId,page}))throw Error();return res.json({success:true,data});}catch{return res.status(503).json({success:false,error:{code:'DESKTOP_LIST_UNAVAILABLE'}});}
 });
 if(richCards)router.get('/api/products/:id',async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294')return res.status(403).json({success:false});
  if(!desktopProductCardId(req.params.id)||Object.keys(req.query??{}).length)return res.status(400).json({success:false});
  let actor;try{actor=await authenticateNormal(req);}catch{return res.status(401).json({success:false});}
  if(actor?.kind!=='normal'||!Array.isArray(actor.permissions)||!['product.view','product.edit'].every(p=>actor.permissions.includes(p)))return res.status(403).json({success:false});
  const actorId=typeof actor.userId==='number'&&Number.isSafeInteger(actor.userId)?String(actor.userId):actor.userId;
  try{const card=await service.readProduct(actorId,req.params.id);if(!card)return res.status(404).json({success:false});if(!isDesktopProductCard(card,req.params.id))return res.status(503).json({success:false});return res.json({success:true,data:card});}
  catch{return res.status(503).json({success:false,error:{code:'DESKTOP_LIST_UNAVAILABLE'}});}
 });
 if(richCards&&typeof service.readCustomer==='function')router.get('/api/customers/:id',async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294')return res.status(403).json({success:false});
  if(!desktopCustomerCardId(req.params.id)||Object.keys(req.query??{}).length)return res.status(400).json({success:false});
  let actor;try{actor=await authenticateNormal(req);}catch{return res.status(401).json({success:false});}
  if(actor?.kind!=='normal'||!Array.isArray(actor.permissions)||!actor.permissions.includes('customer.view'))return res.status(403).json({success:false});
  const actorId=typeof actor.userId==='number'&&Number.isSafeInteger(actor.userId)?String(actor.userId):actor.userId,includeSales=actor.permissions.includes('sales.view');
  try{const card=await service.readCustomer(actorId,req.params.id,{includeSales});if(!card)return res.status(404).json({success:false});if(!isDesktopCustomerCard(card,req.params.id)||card.salesHistoryAvailable!==includeSales)return res.status(503).json({success:false});return res.json({success:true,data:card});}
  catch{return res.status(503).json({success:false,error:{code:'DESKTOP_LIST_UNAVAILABLE'}});}
 });
 if(richCards&&typeof service.readCustomerAccountSales==='function')router.get('/api/customers/:id/accounts/:accountId/sales',async(req,res)=>{
  res.set('Cache-Control','no-store');if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294')return res.status(403).json({success:false});
  const q=req.query??{},page=q.page===undefined?1:typeof q.page==='string'&&/^[1-9]\d{0,5}$/.test(q.page)?Number(q.page):null;if(Object.keys(q).some(k=>k!=='page')||!desktopAccountSalesPage(page)||!desktopCustomerCardId(req.params.id)||!desktopCustomerCardId(req.params.accountId))return res.status(400).json({success:false});
  let actor;try{actor=await authenticateNormal(req);}catch{return res.status(401).json({success:false});}if(actor?.kind!=='normal'||!Array.isArray(actor.permissions)||!['customer.view','sales.view'].every(p=>actor.permissions.includes(p)))return res.status(403).json({success:false});const actorId=typeof actor.userId==='number'&&Number.isSafeInteger(actor.userId)?String(actor.userId):actor.userId;
  try{const data=await service.readCustomerAccountSales(actorId,req.params.id,req.params.accountId,{page});if(!data)return res.status(404).json({success:false});if(!isDesktopAccountSales(data,{customerId:req.params.id,accountId:req.params.accountId,page,actorId,mode:desktopSalesReadMode(actor.permissions)}))throw Error();return res.json({success:true,data});}catch{return res.status(503).json({success:false,error:{code:'DESKTOP_ACCOUNT_SALES_UNAVAILABLE'}});}
 });
 return router;
}
