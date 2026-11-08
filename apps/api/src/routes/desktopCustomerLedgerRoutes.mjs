import {Router} from 'express';
import {desktopSalesReadMode} from '../../../../packages/shared/src/desktopSalesReadScope.mjs';
import {desktopCustomerCardId as id} from '../../../../packages/shared/src/desktopCustomerCard.mjs';
import {desktopAccountSalesPage as validPage} from '../../../../packages/shared/src/desktopAccountSales.mjs';
import {isDesktopLedgerRange} from '../../../../packages/shared/src/desktopLedgerRange.mjs';
import {isDesktopCustomerLedger} from '../services/desktopCustomerLedgerRead.mjs';
export function createDesktopCustomerLedgerRoutes({service,authenticateNormal}={}){
 if(typeof service?.readCustomerLedger!=='function'||typeof authenticateNormal!=='function')throw Error('DESKTOP_CUSTOMER_LEDGER_CONFIGURATION');const router=Router({caseSensitive:true,strict:true});
 router.get('/api/desktop-customers/:id/accounts/:accountId/ledger',async(req,res)=>{
  res.set('Cache-Control','no-store');if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!=='127.0.0.1:4294'||req.get('origin')!=='http://127.0.0.1:5294')return res.status(403).json({success:false});
  const q=req.query??{},page=q.page===undefined?1:typeof q.page==='string'&&/^[1-9]\d{0,5}$/.test(q.page)?Number(q.page):null;let range;if(q.range!==undefined){try{if(typeof q.range!=='string')throw Error();range=JSON.parse(q.range);if(!isDesktopLedgerRange(range)||JSON.stringify({fromDate:range.fromDate,toDate:range.toDate})!==q.range)throw Error();}catch{return res.status(400).json({success:false});}}if(Object.keys(q).some(k=>k!=='page'&&k!=='range')||!validPage(page)||!id(req.params.id)||!id(req.params.accountId))return res.status(400).json({success:false});
  let actor;try{actor=await authenticateNormal(req);}catch{return res.status(401).json({success:false});}if(actor?.kind!=='normal'||!Array.isArray(actor.permissions)||!['customer.view','sales.view'].every(p=>actor.permissions.includes(p)))return res.status(403).json({success:false});if(desktopSalesReadMode(actor.permissions)!=='all')return res.status(403).json({success:false});const actorId=typeof actor.userId==='number'&&Number.isSafeInteger(actor.userId)?String(actor.userId):actor.userId;if(!id(actorId))return res.status(403).json({success:false});
  try{const data=await service.readCustomerLedger(actorId,req.params.id,req.params.accountId,{page,...(range===undefined?{}:{range})});if(!data)return res.status(404).json({success:false});if(!isDesktopCustomerLedger(data,{customerId:req.params.id,accountId:req.params.accountId,page,range}))throw Error();return res.json({success:true,data});}catch{return res.status(503).json({success:false,error:{code:'DESKTOP_CUSTOMER_LEDGER_UNAVAILABLE'}});}
 });return router;
}
