import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import {assertSharedCopyRelease} from './src/services/sharedCopyRelease.mjs';
import {validateIsolatedOperationCopyContext,assertIsolatedCopyIdentity,copyAssert} from './src/services/isolatedOperationCopyContext.mjs';
import {registerIsolatedOperationCopyRuntime,registerIsolatedCopyReadonlyRuntime} from './src/config/isolatedOperationCopyRuntime.mjs';

const [mode,configPath]=process.argv.slice(2);
copyAssert(['erp','native'].includes(mode)&&path.isAbsolute(configPath??''),'STAGE4_ARGUMENTS');
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
const context=validateIsolatedOperationCopyContext(config.copyContext);
copyAssert(context.target.database==='MELISA_ERP_CRM_SHARED_TEST_20261009_01'&&config.lanHost==='192.168.1.46','SHARED_FINITE_TARGET');
copyAssert(config.host==='127.0.0.1'&&config.erpPort===4174&&config.nativePort===4176&&config.webPort===5224
 &&config.database===context.target.database&&config.server===context.target.server
 &&config.sqlUser==='melisa_shared_test_ro_20261009_01'&&config.salesSqlUser===context.target.login
 &&typeof config.jwtAccessSecret==='string'&&config.jwtAccessSecret.length>=48
 &&typeof config.jwtRefreshSecret==='string'&&config.jwtRefreshSecret.length>=48,'STAGE4_CONFIG_IDENTITY');
for(const key of Object.keys(process.env))if(/^(SQL_|VEGA_|ARMADA_|WHATSAPP_|EVOLUTION_|CRM_|NAKLIYAT_|SMTP_|MAIL_|EMAIL_|JWT_|NATIVE_|TERMINAL_|PILOT_|MELISA_|SHIPPING_|SCHEDULE|WORKER_|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NODE_OPTIONS)/i.test(key))delete process.env[key];
const writes=mode==='erp',port=writes?4174:4176,user=writes?config.salesSqlUser:config.sqlUser;
Object.assign(process.env,{NODE_ENV:'production',API_PORT:String(port),APP_NAME:'melisa-shared-test',SQL_SERVER:config.server,SQL_PORT:'1433',SQL_DATABASE:config.database,SQL_USER:user,SQL_PASSWORD:writes?config.salesSqlPassword:config.sqlPassword,SQL_TRUSTED_CONNECTION:'false',SQL_READ_ONLY:String(!writes),SQL_ENCRYPT:'false',SQL_TRUST_SERVER_CERTIFICATE:'true',JWT_ACCESS_SECRET:config.jwtAccessSecret,JWT_SECRET:config.jwtAccessSecret,JWT_REFRESH_SECRET:config.jwtRefreshSecret,JWT_ACCESS_EXPIRES_IN:'8h',MELISA_TEST_STATELESS_AUTH:'true',MELISA_LOCAL_PASSWORDLESS_LOGIN:'false',MELISA_PILOT_RUNTIME:'true',WHATSAPP_ENABLED:'false',NAKLIYAT_ENABLED:'false',SMTP_ENABLED:'false',EMAIL_ENABLED:'false',WORKERS_ENABLED:'false',SCHEDULER_ENABLED:'false',MELISA_INVOICE_EXPORT_ENABLED:'false',TERMINAL_RECEIPT_PRINT_ENABLED:'false',TERMINAL_RECEIPT_PRINT_MODE:'disabled',CORS_ORIGINS:'http://127.0.0.1:5224,http://localhost:5224,http://192.168.1.46:5224',RATE_LIMIT_ENABLED:'true',RATE_LIMIT_WINDOW_MS:'60000',RATE_LIMIT_MAX:'1000',NATIVE_CUSTOMER_ROUTES_ENABLED:'false'});
for(const file of ['.env','.env.local'])copyAssert(!fs.existsSync(path.resolve(file)),'STAGE4_DOTENV_REJECTED');
const runtime={database:context.target.database,server:context.target.server,user,port,readOnly:!writes,trustedConnection:false,externalProvidersDisabled:true};
if(writes)registerIsolatedOperationCopyRuntime(context,runtime);else registerIsolatedCopyReadonlyRuntime(context,runtime);
const {env}=await import('./src/config/env.js');
copyAssert(!env.vega.enabled&&!env.whatsapp.enabled&&!env.nakliyat.enabled&&!env.receiptPrinting.enabled,'STAGE4_EXTERNAL_DISABLED');
const {getSqlPool}=await import('./src/config/database.js');const pool=await getSqlPool();
const raw=(await pool.request().query("SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess")).recordset[0];
if(writes)assertIsolatedCopyIdentity(context,raw);else copyAssert(raw.db===context.target.database&&raw.server===context.target.server&&raw.login===user&&raw.databaseUser===user&&raw.sysadmin===0&&raw.control===0&&raw.live===0&&raw.originalDatabaseAccess===0,'STAGE4_READER_IDENTITY');
const identity={databaseName:raw.db,serverName:raw.server,loginName:raw.login,databaseUser:raw.databaseUser,sysadmin:raw.sysadmin,databaseControl:raw.control,liveDatabaseAccess:raw.live,originalDatabaseAccess:raw.originalDatabaseAccess};
const release=JSON.parse(fs.readFileSync(path.resolve('../../release-manifest.json'),'utf8'));
assertSharedCopyRelease(release);
copyAssert(/^[a-f0-9]{40}$/.test(release.sourceCommit??'')&&typeof release.packageId==='string','STAGE4_RELEASE_REQUIRED');
const {default:express}=await import('express'),{default:cors}=await import('cors');
const {securityHeaders,corsOptions,apiRateLimit}=await import('./src/middleware/security.js');
const {requestContext}=await import('./src/middleware/requestContext.js'),{errorHandler}=await import('./src/middleware/errorHandler.js');
const app=express();app.disable('x-powered-by');
app.use((req,res,next)=>{if(!( ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||(writes&&/^192\.168\.1\.[0-9]{1,3}$/.test(req.socket.remoteAddress)))||![`127.0.0.1:${port}`,`localhost:${port}`,...(writes?[`192.168.1.46:${port}`]:[])].includes(req.get('host')))return res.status(403).json({success:false,error:{code:'STAGE4_LOOPBACK_ONLY'}});next();});
app.use(securityHeaders(),cors(corsOptions()),requestContext,apiRateLimit(),express.json({limit:'2mb'}));
app.use((_req,res,next)=>{res.set('X-Melisa-Environment','ISOLATED-TEST-COPY');res.set('Cache-Control','no-store');next();});
const health={ok:true,environment:'ISOLATED_TEST_COPY',mode,port,...identity,sqlReadOnly:!writes,writes,externalOperations:false,automaticJobs:false,actualT1:false,copyId:context.copyId,backupSHA:context.backupSHA,copiedFromSourceCommit:context.sourceCommit,sourceCommit:release.sourceCommit,packageId:release.packageId};
for(const route of ['/test-health','/production-switch-health','/terminal-release-health','/native-terminal-health'])app.get(route,(_req,res)=>res.json({...health,writeEnabled:writes,automaticSubmit:false}));
if(writes){
 // Reuse the existing convenience endpoint with the actor's existing native
 // role and permissions. No admin defaults or permanent login are created.
 const session=async(req,res,next)=>{try{
  copyAssert(['http://127.0.0.1:5224','http://localhost:5224','http://192.168.1.46:5224'].includes(req.get('origin'))&&(req.path==='/api/auth/test-admin'?Object.keys(req.body??{}).length===0:Object.keys(req.body??{}).length===3&&['15','16'].includes(req.body?.actorId)&&req.body?.copyId===context.copyId&&req.body?.sealHash===context.sealHash),'STAGE4_SESSION_ORIGIN',403);
  const {getUserById}=await import('./src/services/authService.js');const actor=await getUserById(req.path==='/api/auth/test-admin'?16:req.body.actorId);
  copyAssert(context.actors.some(a=>a.id===String(actor.id)&&a.role===actor.role.code),'STAGE4_SESSION_ROLE',403);
  const accessToken=jwt.sign({sub:String(actor.id),username:actor.username,role:actor.role.code,isolatedOperationCopy:context.copyId,database:context.target.database},env.auth.jwtSecret,{expiresIn:'8h'});
  res.json({success:true,data:{user:{...actor,testAdminSession:true,sessionScope:'isolated-test-copy; existing native role'},accessToken,refreshToken:null,tokenType:'Bearer',expiresIn:'8h'},meta:{source:'canonical-test-admin',operationOrigin:context.operationOrigin,copyId:context.copyId,sealHash:context.sealHash}});
 }catch(e){next(e);}};
 app.post('/api/auth/test-admin',session);app.post('/api/auth/stage4-actor',session);
 const {isCanonicalTestWriteAllowed}=await import('./src/services/canonicalTestRoutePolicy.mjs');
 app.use((req,res,next)=>{
  if(/^\/(?:api\/)?(?:whatsapp|crm|shipping|nakliyat|email|mail|invoice-vega-export|product-card-sync|armada|vega)(?:\/|$)/i.test(req.path))return res.status(403).json({success:false,error:{code:'STAGE4_EXTERNAL_DISABLED'}});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&(!['http://127.0.0.1:5224','http://localhost:5224','http://192.168.1.46:5224'].includes(req.get('origin'))||!isCanonicalTestWriteAllowed(req.method,req.path,{writes:true,mode:'erp'})))return res.status(405).json({success:false,error:{code:'STAGE4_WRITE_OUTSIDE_SCOPE'}});next();
 });
 const {configureCatalogSourceVersion}=await import('./src/services/catalogProductReadStore.mjs');configureCatalogSourceVersion(config.goal7SourceVersion);
 const {configureCatalogClassificationStore}=await import('./src/services/catalogClassificationStore.mjs');await configureCatalogClassificationStore({root:config.catalogClassificationRoot,indexSha256:config.catalogClassificationIndexSha256,identity,mode,port,writes,env,sourceVersion:config.goal7SourceVersion});
 const {configureCatalogMediaStore}=await import('./src/services/catalogMediaStore.mjs');await configureCatalogMediaStore({root:config.catalogMediaRoot,indexSha256:config.catalogMediaIndexSha256,identity,mode,port,writes});
 const {configureWorkSystem}=await import('./src/services/workSystemService.mjs');configureWorkSystem({identity,release,copyContext:context});
 for(const [file,key]of [['workSystemRoutes.mjs','workSystemRoutes'],['workReportsRoutes.mjs','workReportsRoutes'],['workSalesRoutes.mjs','workSalesRoutes'],['workCollectionRoutes.mjs','workCollectionRoutes'],['workInboundRoutes.mjs','workInboundRoutes'],['workSupplierPaymentRoutes.mjs','workSupplierPaymentRoutes'],['homeSummaryRoutes.mjs','homeSummaryRoutes'],['stockProductRoutes.mjs','stockProductRoutes'],['catalogRoutes.mjs','catalogProductsRoutes'],['testDailyRoutes.mjs','testDailyRoutes']])app.use('/api',(await import('./src/routes/'+file))[key]);
 const {createApp}=await import('./src/app.js');app.use(createApp());
}else{
 app.use((req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():res.status(405).json({success:false,error:{code:'STAGE4_NATIVE_READ_ONLY'}}));
 const {authRoutes}=await import('./src/routes/authRoutes.js'),{nativeTerminalRoutes}=await import('./src/routes/nativeTerminalRoutes.mjs');app.use('/api',authRoutes);app.use('/api/native-terminal',nativeTerminalRoutes);
}
app.use(errorHandler);const server=await new Promise((resolve,reject)=>{const s=app.listen(port,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
const lanServer=writes?await new Promise((resolve,reject)=>{const s=app.listen(port,'192.168.1.46',()=>resolve(s));s.once('error',reject);}):null;
console.log(JSON.stringify({event:'SHARED_COPY_READY',...health}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await Promise.all([server,lanServer].filter(Boolean).map(s=>new Promise(resolve=>s.close(resolve))));await pool.close();process.exit(0);});
