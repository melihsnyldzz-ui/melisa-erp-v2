// Dedicated read-only local empty installation. No createApp, jobs or legacy runtime.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  EMPTY_LOCAL_PROFILE,EMPTY_LOCAL_IDENTITY_SQL,buildEmptyLocalEnvironment,
  assertEmptyLocalEnvironment,assertEmptyLocalIdentity,registerEmptyLocalContext,
  assertRegisteredEmptyLocalContext,assertEmptyLocalUser,emptyLocalRequestAllowed,
} from './services/emptyLocalContext.mjs';

let cleanupPools=null;

async function readSecrets(stream){
  const chunks=[];let size=0;
  try{
    for await(const chunk of stream){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;if(size>8192)throw Error('EMPTY_LOCAL_INPUT_REJECTED');chunks.push(bytes);}
    const bytes=Buffer.concat(chunks);
    try{return JSON.parse(bytes.toString('utf8'));}finally{bytes.fill(0);}
  }finally{for(const chunk of chunks)chunk.fill(0);}
}

export async function startEmptyLocal(secrets){
  const environment=buildEmptyLocalEnvironment(secrets,process.env);
  for(const key of Object.keys(secrets))secrets[key]='';
  for(const key of Object.keys(process.env))delete process.env[key];
  Object.assign(process.env,environment);
  for(const key of Object.keys(environment))environment[key]='';
  assertEmptyLocalEnvironment();
  for(const file of ['.env','.env.local'])if(fs.existsSync(path.resolve(file)))throw Error('EMPTY_LOCAL_DOTENV_REJECTED');
  const {default:sql}=await import('mssql');
  const probe=new sql.ConnectionPool({
    server:EMPTY_LOCAL_PROFILE.host,port:EMPTY_LOCAL_PROFILE.sqlPort,
    database:EMPTY_LOCAL_PROFILE.database,user:EMPTY_LOCAL_PROFILE.login,password:process.env.SQL_PASSWORD,
    options:{encrypt:true,trustServerCertificate:false,readOnlyIntent:true},
    connectionTimeout:5000,requestTimeout:5000,pool:{max:1,min:0},
  });
  try{
    await probe.connect();
    const identity=(await probe.request().query(EMPTY_LOCAL_IDENTITY_SQL)).recordset;
    if(identity?.length!==1)throw Error('EMPTY_LOCAL_IDENTITY_REJECTED');
    assertEmptyLocalIdentity(identity[0]);
    registerEmptyLocalContext(identity[0]);
  }finally{await probe.close();}
  // Environment and identity are proven before importing shared env/database/auth.
  const [{default:express},{default:cors},{requireAuth,requirePermission},
    {login},{getProducts,getProductOptions},{getCustomers},{getSuppliers},
    {getDashboardSummary,getDashboardAlerts},{getSqlPool,closeSqlPool},
    {securityHeaders,apiRateLimit}]=await Promise.all([
    import('express'),import('cors'),import('./middleware/authMiddleware.js'),
    import('./services/authService.js'),import('./controllers/productController.js'),
    import('./controllers/customerController.js'),import('./controllers/supplierController.js'),
    import('./controllers/dashboardController.js'),import('./config/database.js'),
    import('./middleware/security.js'),
  ]);
  cleanupPools=closeSqlPool;
  const assertPool=async()=>{
    assertRegisteredEmptyLocalContext();
    const rows=(await (await getSqlPool()).request().query(EMPTY_LOCAL_IDENTITY_SQL)).recordset;
    if(rows?.length!==1)throw Error('EMPTY_LOCAL_IDENTITY_REJECTED');
    assertEmptyLocalIdentity(rows[0]);
  };
  await assertPool();
  const app=express();app.disable('x-powered-by');app.set('strict routing',true);
  app.use(securityHeaders());
  app.use((req,res,next)=>{
    if(req.get('host')!=='127.0.0.1:4294'||req.get('origin')&&req.get('origin')!=='http://127.0.0.1:5294')return res.status(403).json({success:false,error:{code:'EMPTY_LOCAL_ORIGIN_REJECTED',message:'Bağlantı kapsamı doğrulanamadı.'}});
    next();
  });
  app.use(cors({origin:'http://127.0.0.1:5294',methods:['GET','POST'],allowedHeaders:['Content-Type','Authorization'],credentials:false}));
  app.use(apiRateLimit());app.use(express.json({limit:'16kb'}));
  app.use((req,res,next)=>{
    if(!emptyLocalRequestAllowed(req.method,req.path))return res.status(403).json({success:false,error:{code:'EMPTY_LOCAL_READ_ONLY',message:'Bu kurulum ilk aşamada yalnız görüntülemeye açıktır.'}});
    assertPool().then(()=>next(),next);
  });
  app.get('/api/health',(req,res)=>res.json({success:true,data:{status:'ok',...assertRegisteredEmptyLocalContext()}}));
  app.post('/api/auth/login',async(req,res,next)=>{
    try{const data=await login(req.body,req.get('user-agent')||'');assertEmptyLocalUser(data.user);res.json({success:true,data,meta:{source:'sql-auth'}});}catch(error){next(error);}
  });
  app.use('/api',(req,res,next)=>{
    requireAuth(req,res,error=>{if(error)return next(error);try{assertEmptyLocalUser(req.user);next();}catch(rejected){next(rejected);}});
  });
  app.get('/api/auth/me',(req,res)=>res.json({success:true,data:req.user,meta:{source:'jwt-auth'}}));
  app.get('/api/products/options',requirePermission('product.view'),getProductOptions);
  app.get('/api/products',requirePermission('product.view'),getProducts);
  app.get('/api/customers',requirePermission('customer.view'),getCustomers);
  app.get('/api/suppliers',requirePermission('supplier.view'),getSuppliers);
  app.get('/api/dashboard/summary',requirePermission('dashboard.view'),getDashboardSummary);
  app.get('/api/dashboard/alerts',requirePermission('dashboard.view'),getDashboardAlerts);
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    const status=[400,401,403,404,409,413,429].includes(error?.statusCode)?error.statusCode:503;
    // Never serialize SQL/driver errors, connection details, secrets or request bodies.
    res.status(status).json({success:false,error:{code:status===401?'AUTH_INVALID_CREDENTIALS':status===403?'AUTH_PERMISSION_DENIED':'EMPTY_LOCAL_REQUEST_REJECTED',message:status===401?'Kullanıcı adı veya şifre doğrulanamadı.':'İstek güvenli biçimde tamamlanamadı.'}});
  });
  let server;
  try{
    server=await new Promise((resolve,reject)=>{
      const listening=app.listen(4294,'127.0.0.1',()=>{listening.off('error',reject);resolve(listening);});
      listening.once('error',reject);
    });
  }catch(error){await closeSqlPool();throw error;}
  let shuttingDown=false;
  const shutdown=async()=>{if(shuttingDown)return;shuttingDown=true;server.close(async()=>{await closeSqlPool();});};
  process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
  return {server,shutdown};
}
async function main(){
  if(process.argv.length!==2)throw Error('EMPTY_LOCAL_ARGUMENT_REJECTED');
  await startEmptyLocal(await readSecrets(process.stdin));
  console.log(JSON.stringify({status:'listening',profile:EMPTY_LOCAL_PROFILE.id,readOnly:true,actualT1:false,externalOperations:false,port:4294}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(async()=>{
    console.error('EMPTY_LOCAL_STARTUP_REJECTED');
    try{if(cleanupPools)await cleanupPools();}catch{}
    process.exitCode=1;
  });
}

