// Isolated CRM draft contract, sharing only the verified named TEST database.
// The daily ERP/native/web listeners and their deployment are not replaced.
import { configureCanonicalTest } from './canonical-test-env.mjs';
const {identity,pool,release,writes}=await configureCanonicalTest(process.argv[2],'erp');
if(!writes)throw Error('CRM_ORDER_TEST_WRITER_REQUIRED');
const {enableCrmOrderTestGateway}=await import('./canonical-test-network.mjs');
const networkPolicy=enableCrmOrderTestGateway(identity);
const {default:express}=await import('express');
const {securityHeaders,apiRateLimit}=await import('./src/middleware/security.js');
const {requestContext}=await import('./src/middleware/requestContext.js');
const {errorHandler}=await import('./src/middleware/errorHandler.js');
const {authRoutes}=await import('./src/routes/authRoutes.js');
const {testCrmOrderRoutes}=await import('./src/routes/testCrmOrderRoutes.mjs');
const app=express();app.disable('x-powered-by');
app.use(securityHeaders(),requestContext,apiRateLimit(),express.json({limit:'64kb'}));
app.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('X-Melisa-Environment','CANONICAL-TEST');next();});
const health={ok:true,environment:'CANONICAL_TEST',purpose:'crm-order-draft-only',port:62404,...identity,database:identity.databaseName,sourceCommit:release.sourceCommit,packageId:release.packageId,sqlReadOnly:false,writeScope:'scoped-sales-order-draft-procedure-only',stockEffect:false,ledgerEffect:false,externalOperations:false,automaticJobs:false,networkPolicy};
app.get('/test-health',(_req,res)=>res.json(health));
app.use((req,res,next)=>{
  if(req.method==='POST'&&req.path==='/api/auth/login')return next();
  if(req.method==='GET'&&req.path==='/api/auth/me')return next();
  if(req.method==='POST'&&req.path==='/api/test/crm/orders/drafts')return next();
  if(req.method==='GET'&&/^\/api\/test\/crm\/orders\/(?:context|drafts\/[0-9a-f-]{36})$/i.test(req.path))return next();
  return res.status(405).json({success:false,error:{code:'TEST_WRITE_OUTSIDE_SCOPE',message:'Bu TEST servisi yalnız CRM sipariş taslağı oluşturur ve geri okur.'}});
});
app.use('/api',authRoutes,testCrmOrderRoutes);
app.use(errorHandler);
const server=app.listen(62404,'127.0.0.1',()=>console.log(JSON.stringify({event:'CRM_ORDER_TEST_READY',...health})));
server.on('error',()=>process.exit(1));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await pool.close();process.exit(0);}));
