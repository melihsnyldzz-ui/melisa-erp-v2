import { configureCanonicalTest } from './canonical-test-env.mjs';
const [mode, configPath] = process.argv.slice(2);
const {identity,port,networkPolicy,release,pool}=await configureCanonicalTest(configPath,mode);
const {default:express}=await import('express');
const {default:cors}=await import('cors');
const {securityHeaders,corsOptions,apiRateLimit}=await import('./src/middleware/security.js');
const {requestContext}=await import('./src/middleware/requestContext.js');
const {errorHandler}=await import('./src/middleware/errorHandler.js');
const app=express();app.disable('x-powered-by');
app.use(securityHeaders(),cors(corsOptions()),requestContext,apiRateLimit(),express.json({limit:'2mb'}));
app.use((_req,res,next)=>{res.set('X-Melisa-Environment','CANONICAL-TEST');res.set('Cache-Control','no-store');next();});
const health={ok:true,environment:'CANONICAL_TEST',mode,port,...identity,sqlReadOnly:true,writes:false,externalOperations:false,automaticJobs:false,networkPolicy,sourceCommit:release.sourceCommit,packageId:release.packageId};
app.get('/test-health',(_req,res)=>res.json(health));
app.get('/production-switch-health',(_req,res)=>res.json(health));
app.get('/terminal-release-health',(_req,res)=>res.json({...health,automaticSubmit:false,dailyWebEnabled:true,invoiceExportEnabled:false}));
app.get('/native-terminal-health',(_req,res)=>res.json({...health,writeEnabled:false,automaticSubmit:false}));
app.use((req,res,next)=>{
  if(/^\/(?:api\/)?(?:whatsapp|crm|shipping|nakliyat|email|mail|invoice-vega-export|product-card-sync|armada|vega)(?:\/|$)/i.test(req.path))return res.status(403).json({success:false,error:{code:'TEST_EXTERNAL_DISABLED'}});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!(req.method==='POST'&&/^\/api\/auth\/(?:login|terminal-login)$/.test(req.path)))return res.status(405).json({success:false,error:{code:'TEST_READ_ONLY'}});
  next();
});
if(mode==='erp'){
  const {resolveDailyWebPolicy,dailyWebScopeMiddleware}=await import('./src/services/dailyWebPolicy.mjs');
  const {pilotTerminalRoutes}=await import('./src/routes/pilotTerminalRoutes.mjs');
  app.use('/api/terminal',pilotTerminalRoutes);
  app.use('/api',dailyWebScopeMiddleware(resolveDailyWebPolicy({dailyWebEnabled:true,automaticCardSyncEnabled:false,invoiceExportEnabled:false})));
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
const server=app.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({event:'CANONICAL_TEST_READY',...health})));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await pool.close();process.exit(0);}));
