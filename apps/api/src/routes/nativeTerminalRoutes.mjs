import {nativeCatalogVersion,nativeCatalogPage} from '../services/nativeCatalogSync.mjs';
import {Router} from 'express';
import {nativeWorkflows} from '../services/nativeTerminalWorkflows.mjs';
import {nativePacking} from '../services/nativeTerminalPacking.mjs';
import {createPackingCheck} from '../services/nativePackingCheck.mjs';
import {nativeCategoryReports} from '../services/nativeCategoryReports.mjs';
import {rateLimit} from 'express-rate-limit';
import {requireAuth,requireAnyPermission} from '../middleware/authMiddleware.js';
import {requireNativeDeviceScope} from '../middleware/nativeDeviceScope.mjs';
import {ok,fail} from '../utils/response.js';
import {nativeBootstrap,nativeSearch} from '../services/nativeTerminalCatalog.mjs';
import {nativeSubmitSale,nativeSaleStatus,nativeDiscountApproval,nativeCancelSale,nativeOwnedInvoice} from '../services/nativeTerminalSale.mjs';
import {printTerminalSaleReceipt} from '../services/terminalReceiptPrintService.js';

export const nativeTerminalRoutes=Router();
nativeTerminalRoutes.use(requireAuth,requireNativeDeviceScope);
const handle=fn=>async(req,res)=>{try{return ok(res,await fn(req));}catch(e){return fail(res,e.statusCode||503,e.code||'NATIVE_REQUEST_FAILED',e.statusCode?e.message:'ERP işlemi tamamlanamadı. Fiş korunuyor.');}};
// Optional packaging reads need personnel/device authentication, not sales authority.
nativeTerminalRoutes.get('/packing-receipts',handle(req=>nativePacking.receipts(req.query,req.user)));
nativeTerminalRoutes.get('/packing-receipts/:id',handle(req=>nativePacking.receipt(req.params.id,req.query,req.user)));
const packingCheck=createPackingCheck();
nativeTerminalRoutes.post('/packing-receipts/:id/check',handle(req=>(req.app.locals.packingCheck||packingCheck)(req.params.id,req.body,req.user)));
nativeTerminalRoutes.use(requireAnyPermission(['terminal.sales.create','sales.create']));
const approvals=rateLimit({windowMs:60*1000,limit:5,standardHeaders:'draft-7',legacyHeaders:false});
nativeTerminalRoutes.get('/settings',handle(req=>nativeWorkflows.settings(req.query,req.user)));
nativeTerminalRoutes.post('/settings/rates',requireAnyPermission(['settings.manage']),handle(req=>nativeWorkflows.saveRates(req.body,req.user)));
nativeTerminalRoutes.get('/orders',handle(req=>nativeWorkflows.orders(req.query,req.user)));
nativeTerminalRoutes.get('/orders/:id',handle(req=>nativeWorkflows.order(req.params.id,req.query,req.user)));
nativeTerminalRoutes.get('/bootstrap',handle(req=>nativeBootstrap(req.query,req.user)));
nativeTerminalRoutes.get('/products/search',handle(req=>nativeSearch(req.query,req.user)));
nativeTerminalRoutes.get('/products/categories',handle(req=>nativeCategoryReports.products(req.query,req.user)));
nativeTerminalRoutes.get('/catalog/version',handle(req=>nativeCatalogVersion(req.query,req.user)));
nativeTerminalRoutes.get('/catalog/page',handle(req=>nativeCatalogPage(req.query,req.user)));
nativeTerminalRoutes.get('/catalog',handle(req=>nativeSearch(req.query,req.user,{catalog:true})));
nativeTerminalRoutes.post('/approval',approvals,handle(req=>nativeDiscountApproval(req.body,req.user)));
nativeTerminalRoutes.post('/sales/submit',requireAnyPermission(['terminal.sales.create','sales.finalize']),handle(req=>nativeSubmitSale(req.body,req.user)));
nativeTerminalRoutes.post('/sales/status',handle(req=>nativeSaleStatus(req.body,req.user)));
nativeTerminalRoutes.get('/sales/:invoiceId/category-report',handle(req=>nativeCategoryReports.receipt(req.params.invoiceId,req.query,req.user)));
nativeTerminalRoutes.post('/sales/cancel',approvals,handle(req=>nativeCancelSale(req.body,req.user)));
const pdfShares=rateLimit({windowMs:60*1000,limit:12,standardHeaders:'draft-7',legacyHeaders:false});
nativeTerminalRoutes.post('/sales/:invoiceId/pdf-share',pdfShares,(_req,res,next)=>{res.set('Cache-Control','no-store');next();},handle(req=>{
 const share=req.app.locals.nativeReceiptPdfShare;
 if(!share){const error=new Error('PDF paylaşımı bu sunucuda açık değil.');error.statusCode=503;error.code='NATIVE_PDF_UNAVAILABLE';throw error;}
 return share.mint(req.params.invoiceId,req.body.terminalCode,req.user);
}));
nativeTerminalRoutes.post('/sales/:invoiceId/print',handle(async req=>{
 await nativeOwnedInvoice(req.params.invoiceId,req.body.terminalCode,req.user);
 return printTerminalSaleReceipt(req.params.invoiceId,req.user);
}));
nativeTerminalRoutes.use((_req,res)=>fail(res,404,'NATIVE_ROUTE_UNAVAILABLE','Bu işlem terminal kapsamında yok.'));
