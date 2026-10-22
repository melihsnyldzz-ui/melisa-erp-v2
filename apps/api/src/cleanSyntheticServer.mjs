// Real ERP app, auth and native order engine against one fresh synthetic DB.
import sql from 'mssql';
import {cleanOrderSaleService} from './services/cleanOrderSaleService.mjs';
import {createWorkInboundRoutes} from './routes/workInboundRoutes.mjs';
import {createWorkInboundService} from './services/workInboundService.mjs';
import {cleanStoreDayStore,cleanInboundActor,cleanInboundCapabilities,cleanFinanceActor} from './services/cleanStoreDayStore.mjs';
import {createWorkCollectionService} from './services/workCollectionService.mjs';
import {createWorkSupplierPaymentService} from './services/workSupplierPaymentService.mjs';
import {createWorkSupplierPaymentRoutes} from './routes/workSupplierPaymentRoutes.mjs';
import {assertCleanEnvironment,registerCleanContext,CLEAN_IDENTITY_SQL,assertRegisteredCleanContext} from './services/cleanSyntheticContext.mjs';
assertCleanEnvironment();
const probe=await new sql.ConnectionPool({server:'127.0.0.1',port:1433,database:process.env.SQL_DATABASE,user:process.env.SQL_USER,password:process.env.SQL_PASSWORD,options:{encrypt:false,trustServerCertificate:true},connectionTimeout:10000,requestTimeout:10000}).connect();
try{registerCleanContext((await probe.request().query(CLEAN_IDENTITY_SQL)).recordset[0]);if(process.env.API_PORT==='4194'&&process.env.MELISA_CLEAN_STORE_DAY==='20261022')await probe.request().execute('dbo.usp_clean_store_day_ready');if(process.env.API_PORT==='4194'&&process.env.MELISA_CLEAN_FINANCE==='20261022')await probe.request().query("IF OBJECT_ID(N'dbo.clean_store_finance_manifest') IS NULL THROW 51960,'CLEAN_INBOUND_COHORT_DRIFT',1;EXEC dbo.usp_clean_store_day_ready;");}finally{await probe.close();}
const [{default:express},{default:cors},{createApp},{requireAuth,requirePermission},{crmOrderV2Routes},{readCleanCatalog,readCleanPhoto},{errorHandler},{createWorkCollectionRoutes}]=await Promise.all([import('express'),import('cors'),import('./app.js'),import('./middleware/authMiddleware.js'),import('./routes/crmOrderV2Routes.mjs'),import('./services/cleanSyntheticCatalog.mjs'),import('./middleware/errorHandler.js'),import('./routes/workCollectionRoutes.mjs')]);
const app=express();app.disable('x-powered-by');app.use(cors({origin:['http://127.0.0.1:5244','http://127.0.0.1:62800']}));app.use(express.json({limit:'128kb'}));
const saleWrite=req=>process.env.API_PORT==='4194'&&process.env.MELISA_CLEAN_SALES==='20261022'&&req.method==='POST'&&/^\/api\/sales-orders\/[1-9]\d*\/(?:convert-to-sales-draft|finalize-linked-sale)$/.test(req.path);
const inboundEnabled=()=>process.env.API_PORT==='4194'&&process.env.MELISA_CLEAN_STORE_DAY==='20261022';
const financeEnabled=()=>inboundEnabled()&&process.env.MELISA_CLEAN_FINANCE==='20261022';
const financeWrite=req=>financeEnabled()&&req.method==='POST'&&/^\/api\/(?:work-collections(?:\/preview)?|work-supplier-payments\/(?:preview|payments))$/.test(req.path);
const inboundWrite=req=>inboundEnabled()&&req.method==='POST'&&/^\/api\/(?:work-receiving\/(?:count-drafts(?:\/[1-9]\d*\/(?:update|submit|cancel))?|receipts\/[1-9]\d*\/(?:approve|reject))|work-purchases\/(?:preview|drafts(?:\/[1-9]\d*\/finalize)?))$/.test(req.path);
app.use((req,res,next)=>{try{assertRegisteredCleanContext();if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!/^\/api\/auth\/(login|refresh|logout)$/.test(req.path)&&!(req.method==='POST'&&req.path==='/api/test/crm/orders/v2/drafts')&&!saleWrite(req)&&!inboundWrite(req)&&!financeWrite(req))return res.status(403).json({success:false,error:{code:'CLEAN_TEST_OPERATION_DISABLED',message:'Bu örnek kurulumda işlem açık değil.'}});next();}catch(e){next(e);}});
app.get('/api/health',(req,res)=>res.json({success:true,data:{status:'ok',...assertRegisteredCleanContext(),sourceCommit:process.env.CLEAN_SOURCE_COMMIT}}));
app.get('/test-health',async(req,res,next)=>{try{const {getSqlPool}=await import('./config/database.js'),identity=(await (await getSqlPool()).request().query(CLEAN_IDENTITY_SQL)).recordset[0],sales=process.env.API_PORT==='4194'&&process.env.MELISA_CLEAN_SALES==='20261022';res.json({ok:true,...assertRegisteredCleanContext(),databaseName:identity.databaseName,serverName:identity.serverName,originalDatabaseAccess:identity.originalDatabaseAccess,liveDatabaseAccess:identity.liveDatabaseAccess,sysadmin:identity.sysadmin,databaseControl:identity.databaseControl,port:Number(process.env.API_PORT),mode:'erp',writes:true,purpose:inboundEnabled()?'clean-store-day-inbound-and-sales':sales?'crm-order-approval-sales-only':'crm-order-draft-only',automaticJobs:false,stockEffect:sales,ledgerEffect:sales,reservationEffect:false,sourceCommit:process.env.CLEAN_SOURCE_COMMIT,packageId:process.env.CLEAN_PACKAGE_ID});}catch(e){next(e);}});
const read=detail=>async(req,res,next)=>{try{res.json(await readCleanCatalog(req.query,req.user,detail?req.params.id:null));}catch(e){next(e);}};
app.get('/api/catalog/products/:id/photo',requireAuth,requirePermission('product.view'),async(req,res,next)=>{try{res.set({'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}).end(await readCleanPhoto(req.params.id,req.query));}catch(e){next(e);}});
app.get('/api/catalog/products',requireAuth,requirePermission('product.view'),read(false));app.get('/api/catalog/products/:id',requireAuth,requirePermission('product.view'),read(true));
const saleHandle=op=>async(req,res,next)=>{try{res.json({success:true,data:await op(req),meta:{schemaVersion:'melisa-order-sale.v1',...assertRegisteredCleanContext()}});}catch(e){next(e);}};
app.get('/api/sales-orders/:id/sale',requireAuth,requirePermission('sales.view'),saleHandle(req=>cleanOrderSaleService().get(req.params.id,req.user)));
app.post('/api/sales-orders/:id/convert-to-sales-draft',requireAuth,requirePermission('sales.create'),saleHandle(req=>cleanOrderSaleService().mutate(req.params.id,'convert',req.body,req.user)));
app.post('/api/sales-orders/:id/finalize-linked-sale',requireAuth,requirePermission('sales.finalize'),saleHandle(req=>cleanOrderSaleService().mutate(req.params.id,'finalize',req.body,req.user)));
app.get('/api/test/crm/orders/v2/drafts/:requestId/sale',requireAuth,requirePermission('sales.view'),saleHandle(async req=>{const {crmOrderV2Service}=await import('./services/crmOrderV2Service.mjs'),authorization=req.get('x-crm-authorization'),before=await crmOrderV2Service().get(req.params.requestId,req.user,authorization),result=await cleanOrderSaleService().get(before.id,req.user),after=await crmOrderV2Service().get(req.params.requestId,req.user,authorization);if(result.requestId!==req.params.requestId.toLowerCase()||before.id!==after.id||before.request.requestId!==after.request.requestId)throw Object.assign(new Error('Sipariş bağlantısı değişti.'),{code:'CLEAN_SALE_SOURCE',statusCode:409});return result;}));
if(inboundEnabled())app.use('/api',createWorkInboundRoutes({service:createWorkInboundService({getStore:()=>cleanStoreDayStore,actorCheck:cleanInboundActor,requireCap:cleanInboundCapabilities})}));
if(financeEnabled()){
 const store={read:(a,fn)=>cleanStoreDayStore.readFinance(a,fn),mutate:(a,fn)=>cleanStoreDayStore.mutateFinance(a,fn)};
 const collections=createWorkCollectionService({getStore:async()=>({...store,mutate:(a,op,p,fn)=>store.mutate(a,c=>c.journal(op,p,()=>fn(c)))})});
 app.use('/api',createWorkCollectionRoutes({service:collections}));
 app.use('/api',createWorkSupplierPaymentRoutes({service:createWorkSupplierPaymentService({getStore:async()=>store,actorCheck:cleanFinanceActor})}));
 app.get('/api/work-sales/context',requireAuth,requirePermission('finance.view'),saleHandle(req=>store.read(req.user,c=>c.context)));
 app.get('/api/work-sales/invoices',requireAuth,requirePermission('finance.view'),async(req,res,next)=>{try{res.json({success:true,data:await store.read(req.user,async c=>[await c.invoice('1')])});}catch(e){next(e);}});
 app.get('/api/work-sales/requests/:id',requireAuth,requirePermission('finance.view'),saleHandle(req=>store.read(req.user,c=>c.request(req.params.id))));
}
app.use('/api',crmOrderV2Routes);app.use(createApp());app.use(errorHandler);
const server=app.listen(Number(process.env.API_PORT),'127.0.0.1',()=>console.log(JSON.stringify({status:'listening',port:Number(process.env.API_PORT),environment:'CLEAN_SYNTHETIC_TEST',actualT1:false})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
