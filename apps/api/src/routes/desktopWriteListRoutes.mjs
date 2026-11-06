// Source-only v2 list routes. The injected service owns the SQL transaction.
import {Router} from 'express';
import {desktopProductCardId,isDesktopProductCard} from '../../../../packages/shared/src/desktopProductCard.mjs';

export function createDesktopWriteListRoutes({service,authenticateNormal,richCards=false}={}){
 if(typeof richCards!=='boolean'||typeof service?.list!=='function'||typeof authenticateNormal!=='function'||richCards&&typeof service.readProduct!=='function')throw Error('DESKTOP_LIST_CONFIGURATION');
 const router=Router();
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
 return router;
}
