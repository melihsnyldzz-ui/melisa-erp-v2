import {operationQuarantineGate} from '../services/operationQuarantineGate.mjs';
import {Router} from 'express';
import path from 'node:path';
import {requireAuth,requireAnyPermission} from '../middleware/authMiddleware.js';
import {ok,fail} from '../utils/response.js';
import {pilotCatalog,pilotContext,pilotRates,pilotCatalogScope,pilotDigest,pilotError} from '../services/pilotTerminalCatalog.mjs';
import {submitPilotSale,pilotSaleStatus} from '../services/pilotTerminalSale.mjs';
import {createCatalogStore,createTerminalCatalogSync} from '../services/terminalCatalogSync.mjs';
import {printTerminalSaleReceipt} from '../services/terminalReceiptPrintService.js';
import {getSqlPool,getSqlDriver} from '../config/database.js';

export const pilotTerminalRoutes=Router();
const handle=fn=>async(req,res)=>{try{return await fn(req,res);}catch(e){return fail(res,e.statusCode||503,e.code||'PILOT_REQUEST_FAILED',e.statusCode?e.message:'Pilot isteği tamamlanamadı; fişi koruyup sonucu kontrol edin.',e.submissionAttempted===false&&e.commercialEffect===false?{submissionAttempted:false,commercialEffect:false}:{})}};
const product=[requireAuth,requireAnyPermission(['terminal.sync.run','product.view'])];
const customer=[requireAuth,requireAnyPermission(['terminal.sync.run','customer.view'])];
const sale=[requireAuth,requireAnyPermission(['terminal.sales.create','sales.create']),requireAnyPermission(['terminal.sales.create','sales.finalize'])];
const sync=[...product,requireAnyPermission(['terminal.sync.run','customer.view'])];
const catalog=createTerminalCatalogSync({scope:pilotCatalogScope,validId:id=>typeof id==='string'&&/^[1-9]\d*$/.test(id),store:createCatalogStore(path.resolve(process.env.PILOT_CATALOG_DIR||'output/pilot/catalog-private'),pilotCatalogScope),readPage:(kind,page)=>pilotCatalog(kind,{page,limit:500}),enrich:async(_kind,rows)=>rows,keyTag:async()=>pilotDigest(process.env.PILOT_SIGNING_KEY)});
pilotTerminalRoutes.get('/products/search',...product,handle(async(req,res)=>{const r=await pilotCatalog('product',req.query);return ok(res,r.data,r.meta)}));
pilotTerminalRoutes.get('/products/barcode/:barcode',...product,handle(async(req,res)=>{const r=await pilotCatalog('product',{barcode:req.params.barcode});if(r.data.length!==1)pilotError('PILOT_BARCODE_NOT_FOUND','Barkod pilot ürünlerinde bulunamadı.',404);return ok(res,r.data[0],r.meta)}));
pilotTerminalRoutes.get('/customers/search',...customer,handle(async(req,res)=>{const r=await pilotCatalog('customer',req.query);return ok(res,r.data,r.meta)}));
pilotTerminalRoutes.get('/currency-rates',...sale,handle(async(_req,res)=>ok(res,await pilotRates(),{source:'melisa-pilot-sql'})));
pilotTerminalRoutes.get('/offline/context',requireAuth,handle(async(req,res)=>ok(res,await pilotContext(req.query.terminalCode,req.user))));
pilotTerminalRoutes.get('/sales/capabilities',requireAuth,handle(async(req,res)=>ok(res,(await pilotContext(req.query.terminalCode,req.user)).capability)));
pilotTerminalRoutes.post('/catalog-sync',...sync,handle(async(req,res)=>ok(res.status(202),catalog.start(req.body,req.user))));
pilotTerminalRoutes.get('/catalog-sync/version',...sync,handle(async(req,res)=>ok(res,await catalog.version(req.query,req.user))));
pilotTerminalRoutes.get('/catalog-sync/:jobId',...sync,handle(async(req,res)=>ok(res,catalog.page(req.params.jobId,req.query,req.user))));
pilotTerminalRoutes.post('/sales/submit',...sale,operationQuarantineGate('sales'),handle(async(req,res)=>ok(res,await submitPilotSale(req.body,req.user),{source:'melisa-pilot-sql'})));
pilotTerminalRoutes.post('/sales/status',...sale,handle(async(req,res)=>ok(res,await pilotSaleStatus(req.body,req.user),{source:'melisa-pilot-sql',readOnly:true})));
pilotTerminalRoutes.post('/sales/readiness',...sale,handle(async(req,res)=>ok(res,(await pilotContext(req.body.terminalCode,req.user)).capability)));
pilotTerminalRoutes.post('/sales/:invoiceId/print',...sale,handle(async(req,res)=>{
 if(!req.user.permissions.includes('sales.view')){
  const id=Number(req.params.invoiceId);if(!Number.isSafeInteger(id)||id<1)pilotError('PILOT_RECEIPT_ID_INVALID','Geçersiz fiş.',400);
  const pool=await getSqlPool(),sql=getSqlDriver();
  const owned=(await pool.request().input('invoice',sql.BigInt,id).input('user',sql.BigInt,req.user.id).query("SELECT TOP(1) id FROM dbo.terminal_sync_queue WHERE target_entity=N'sales_invoice' AND target_entity_id=@invoice AND user_id=@user")).recordset.length;
  if(!owned)pilotError('PILOT_RECEIPT_OWNER_REQUIRED','Terminal personeli yalnız kendi fişini yazdırabilir.',403);
 }
 return ok(res,await printTerminalSaleReceipt(req.params.invoiceId,req.user),{source:'melisa-pilot-windows-spooler',physicalOutputConfirmed:false});
}));
// No request may fall through to the old Armada, Vega or messaging router.
pilotTerminalRoutes.use((_req,res)=>fail(res,404,'PILOT_TERMINAL_ROUTE_UNAVAILABLE','Bu işlem pilot terminal kapsamında yok.'));
