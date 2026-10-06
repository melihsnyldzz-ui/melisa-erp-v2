import { configureCanonicalTest } from './canonical-test-env.mjs';
import {startCanonicalListeners,canonicalInboundMiddleware,canonicalReadiness} from './canonical-test-listeners.mjs';
const [mode, configPath] = process.argv.slice(2);
const {identity,port,networkPolicy,release,pool,writes,env,config,listenerPolicy}=await configureCanonicalTest(configPath,mode);
if(mode==='erp' && writes){
  const {configureCatalogClassificationStore}=await import('./src/services/catalogClassificationStore.mjs');
  try{await configureCatalogClassificationStore({root:config.catalogClassificationRoot,indexSha256:config.catalogClassificationIndexSha256,identity,mode,port,writes,env});}
  catch{try{await pool.close();}catch{}throw new Error('Ürün kataloğu başlangıçta doğrulanamadı.');}
  const {configureCatalogMediaStore}=await import('./src/services/catalogMediaStore.mjs');
  await configureCatalogMediaStore({root:config.catalogMediaRoot,indexSha256:config.catalogMediaIndexSha256,identity,mode,port,writes});
}
if(mode==='erp' && writes){
  try{const {warmCatalogPlan}=await import('./src/services/catalogPlanWarmup.mjs');await warmCatalogPlan({identity,port,mode,writes,env});}
  catch{try{await pool.close();}catch{}throw new Error('Ürün kataloğu başlangıçta doğrulanamadı.');}
}
const {isCanonicalTestWriteAllowed}=await import('./src/services/canonicalTestRoutePolicy.mjs');
const {default:express}=await import('express');
const {default:cors}=await import('cors');
const {securityHeaders,corsOptions,apiRateLimit}=await import('./src/middleware/security.js');
const {requestContext}=await import('./src/middleware/requestContext.js');
const {errorHandler}=await import('./src/middleware/errorHandler.js');
const app=express();app.disable('x-powered-by');
app.use(canonicalInboundMiddleware({port,policy:listenerPolicy}));
app.use(securityHeaders(),cors(corsOptions()),requestContext,apiRateLimit(),express.json({limit:'2mb'}));
app.use((_req,res,next)=>{res.set('X-Melisa-Environment','CANONICAL-TEST');res.set('Cache-Control','no-store');next();});
const health={ok:true,environment:'CANONICAL_TEST',mode,port,listenerHosts:listenerPolicy.hosts,...identity,sqlReadOnly:!writes,writes,writeScope:writes?'Existing named TEST records; guarded API and SQL triggers':'none',externalOperations:false,automaticJobs:false,networkPolicy,sourceCommit:release.sourceCommit,packageId:release.packageId};
const readiness=canonicalReadiness();
app.get('/test-health',(_req,res)=>readiness.send(res,health));
app.get('/production-switch-health',(_req,res)=>readiness.send(res,health));
app.get('/terminal-release-health',(_req,res)=>readiness.send(res,{...health,automaticSubmit:false,dailyWebEnabled:true,invoiceExportEnabled:false}));
app.get('/native-terminal-health',(_req,res)=>readiness.send(res,{...health,writeEnabled:false,automaticSubmit:false}));
if(mode==='erp' && writes){
  const {canonicalTestAdminContext}=await import('./src/services/canonicalTestAdminSession.mjs');
  const {createCanonicalTestAdminRoutes}=await import('./src/routes/canonicalTestAdminRoutes.mjs');
  const {env}=await import('./src/config/env.js');
  app.use(canonicalTestAdminContext({identity,mode,port,writes,env,listenerPolicy}));
  app.use('/api',createCanonicalTestAdminRoutes());
}
app.use((req,res,next)=>{
  if(/^\/(?:api\/)?(?:whatsapp|crm|shipping|nakliyat|email|mail|invoice-vega-export|product-card-sync|armada|vega)(?:\/|$)/i.test(req.path))return res.status(403).json({success:false,error:{code:'TEST_EXTERNAL_DISABLED'}});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!isCanonicalTestWriteAllowed(req.method,req.path,{writes,mode}))return res.status(405).json({success:false,error:{code:'TEST_WRITE_OUTSIDE_SCOPE',message:'Yalnız ayrı TEST kayıtlarına bağlı iş akışları açıktır.'}});
  next();
});
if(mode==='erp'){
  const {configureWorkSystem}=await import('./src/services/workSystemService.mjs');
  configureWorkSystem({identity,release});
  const {workSystemRoutes}=await import('./src/routes/workSystemRoutes.mjs');
  app.use('/api',workSystemRoutes);
  if(writes){
    const {workSalesRoutes}=await import('./src/routes/workSalesRoutes.mjs');
    const {workCollectionRoutes}=await import('./src/routes/workCollectionRoutes.mjs');
    app.use('/api',workSalesRoutes);app.use('/api',workCollectionRoutes);
    const {workInboundRoutes}=await import('./src/routes/workInboundRoutes.mjs');
    app.use('/api',workInboundRoutes);
    const {workInboundFxRoutes}=await import('./src/routes/workInboundFxRoutes.mjs');
    app.use('/api',workInboundFxRoutes);
    const {workSupplierPaymentRoutes}=await import('./src/routes/workSupplierPaymentRoutes.mjs');
    app.use('/api',workSupplierPaymentRoutes);
  }
  const {workReportsRoutes}=await import('./src/routes/workReportsRoutes.mjs');
  app.use('/api',workReportsRoutes);
  const {homeSummaryRoutes}=await import('./src/routes/homeSummaryRoutes.mjs');
  app.use('/api',homeSummaryRoutes);
  const {stockProductRoutes}=await import('./src/routes/stockProductRoutes.mjs');
  app.use('/api',stockProductRoutes);
  const {catalogProductsRoutes}=await import('./src/routes/catalogRoutes.mjs');
  app.use('/api',catalogProductsRoutes);
  const {resolveDailyWebPolicy,dailyWebScopeMiddleware}=await import('./src/services/dailyWebPolicy.mjs');
  const {pilotTerminalRoutes}=await import('./src/routes/pilotTerminalRoutes.mjs');
  app.use('/api/terminal',pilotTerminalRoutes);
  app.use('/api',dailyWebScopeMiddleware(resolveDailyWebPolicy({dailyWebEnabled:true,automaticCardSyncEnabled:false,invoiceExportEnabled:false})));
  if(writes){
    for(const name of ['Sales','Finance','Daily','Refund','Payment','Purchase','Price','PurchaseFx','ProductPrice','CurrentPricePurchase']){
      const routes=await import('./src/routes/test'+name+'Routes.mjs');
      app.use('/api',routes['test'+name+'Routes']);
    }
  }
  const {createApp}=await import('./src/app.js');app.use(createApp());
}else{
  app.locals.nativeTerminalV1=true;
  const {createNativeReceiptPdfShare}=await import('./src/services/nativeReceiptPdfShare.mjs');
  app.locals.nativeReceiptPdfShare=createNativeReceiptPdfShare({baseUrl:'http://127.0.0.1:4146'});
  const {createNativeReceiptPdfRoutes}=await import('./src/routes/nativeReceiptPdfRoutes.mjs');
  app.use('/native-receipts',createNativeReceiptPdfRoutes(app.locals.nativeReceiptPdfShare));
  const {authRoutes}=await import('./src/routes/authRoutes.js');
  const {nativeTerminalRoutes}=await import('./src/routes/nativeTerminalRoutes.mjs');
  app.use('/api',authRoutes);app.use('/api/native-terminal',nativeTerminalRoutes);
}
app.use(errorHandler);
let listeners;
try{listeners=await startCanonicalListeners(app,{port,policy:listenerPolicy});}
catch{try{await pool.close();}catch{}throw Error('TEST_LISTENER_START_FAILED');}
readiness.markReady();
console.log(JSON.stringify({event:'CANONICAL_TEST_READY',...health}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await listeners.close();await pool.close();process.exit(0);});
