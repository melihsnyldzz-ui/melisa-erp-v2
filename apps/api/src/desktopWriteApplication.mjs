import {createDesktopCustomerLedgerRoutes} from './routes/desktopCustomerLedgerRoutes.mjs';
// SOURCE ONLY. The sole exported factory accepts a connector issued by the
// separately verified v2 TLS opener; callers cannot pass a naked SQL pool or
// a caller-supplied 'verified' flag. Importing opens no listener or database.
import express from 'express';
import rateLimit from 'express-rate-limit';
import sql from 'mssql';
import {getDesktopWritePool,getDesktopWriteProfile} from './config/desktopWriteTlsConnector.mjs';
import {createDesktopWriteAuthCore,getDesktopWriteSalesReadScope,getDesktopWriteProductMovementSalesScope,getDesktopWriteSalesApprovalService,getDesktopWriteCreditService} from './services/desktopWriteAuthCore.mjs';
import {createDesktopCreditRoutes} from './routes/desktopCreditRoutes.mjs';
import {createDesktopSalesPricingRoutes} from './routes/desktopSalesPricingRoutes.mjs';
import {createDesktopLocalMasterSqlStore} from './services/desktopLocalMasterSqlStore.mjs';
import {createLocalMasterTransactions} from './services/localMasterTransactions.mjs';
import {recordDesktopFailure} from './services/desktopSafeDiagnostics.mjs';
import {createDesktopLocalMasterRoutes} from './routes/desktopLocalMasterRoutes.mjs';
import {createDesktopWriteListService} from './services/desktopWriteListService.mjs';
import {createDesktopWriteListRoutes} from './routes/desktopWriteListRoutes.mjs';
import {createDesktopSaleWorkflowService} from './services/desktopSaleWorkflowService.mjs';
import {createDesktopSaleWorkflowRoutes} from './routes/desktopSaleWorkflowRoutes.mjs';
import {createDesktopWorkflowDraftService,createDesktopWorkflowDispatchService} from './services/desktopWorkflowDraftPrivate.mjs';
import {createDesktopWorkflowReadService} from './services/desktopWorkflowReadService.mjs';
import {createDesktopWorkflowResolutionService} from './services/desktopWorkflowResolutionService.mjs';
import {isDesktopRuntimeInfo} from '../../../packages/shared/src/desktopRuntimeInfo.mjs';
import {createDesktopCustomerAccountSqlStore} from './services/desktopCustomerAccountSqlStore.mjs';
import {createDesktopCustomerAccountTransactions} from './services/desktopCustomerAccountTransactions.mjs';
import {createDesktopCustomerAccountRoutes} from './routes/desktopCustomerAccountRoutes.mjs';
import {createDesktopFinalCancellationService} from './services/desktopFinalCancellationPrivate.mjs';
import {createDesktopFinalCancellationRoutes} from './routes/desktopFinalCancellationRoutes.mjs';
import {createDesktopGoodsService} from './services/desktopGoodsAssembly.mjs';
import {createDesktopGoodsRoutes} from './routes/desktopGoodsRoutes.mjs';
import {createDesktopFinanceAssembly} from './services/desktopFinanceAssembly.mjs';
import {createDesktopFinanceRoutes} from './routes/desktopFinanceRoutes.mjs';
import {createDesktopWarehouseService} from './services/desktopWarehouseService.mjs';
import {createDesktopWarehouseRoutes} from './routes/desktopWarehouseRoutes.mjs';

const HOST='127.0.0.1:4294',ORIGIN='http://127.0.0.1:5294';
const reject=(res,status=403)=>res.status(status).json({success:false,error:{code:'DESKTOP_WRITE_UNAVAILABLE'}});
export const DESKTOP_WRITE_APPLICATION_LIMITS=Object.freeze({sourceOnly:true,listenerOpened:false,writableProfileInstalled:false,
 requiresVerifiedDedicatedWriterConnector:true,requiresV2SchemaMigrationAndLeastPrivilegeGrants:true,
 requiresPersistedNormalRoleProvisioning:true,requiresDriverAndPackagePin:true,
 salesLifecycleRoutesImplemented:true,installedSalesWritesVerified:false,realSqlVerified:false,fullErpReady:false});

export function createDesktopWriteApplication({connector,tokenKey,runtimeInfo=null}={}){
 const pool=getDesktopWritePool(connector);
 const profile=getDesktopWriteProfile(connector);
 if(!['desktop-write-v2','desktop-master-v3','desktop-master-v4','desktop-master-v5','desktop-master-v6','desktop-master-v7'].includes(profile))throw Error('DESKTOP_RUNTIME_PROFILE_UNAVAILABLE');
 const richCards=['desktop-master-v3','desktop-master-v4','desktop-master-v5','desktop-master-v6','desktop-master-v7'].includes(profile),schemaVersion=profile==='desktop-master-v7'?7:profile==='desktop-master-v6'?6:profile==='desktop-master-v5'?5:profile==='desktop-master-v4'?4:richCards?3:2;
 if(runtimeInfo!==null&&(!richCards||!isDesktopRuntimeInfo(runtimeInfo)||runtimeInfo.profile!==profile||runtimeInfo.schemaVersion!==schemaVersion))throw Error('DESKTOP_RUNTIME_INFO_INVALID');const publicRuntimeInfo=runtimeInfo===null?null:Object.freeze({...runtimeInfo});
 const auth=createDesktopWriteAuthCore({pool,sql,tokenKey,richCards,schemaVersion});
 const store=createDesktopLocalMasterSqlStore({pool,sql,verifySession:auth.verifySession,richCards,schemaVersion});
 const coordinator=createLocalMasterTransactions({store,authorize:auth.authorize,onFailure:recordDesktopFailure,richCards});
 const accountCoordinator=[4,5,6,7].includes(schemaVersion)?createDesktopCustomerAccountTransactions({store:createDesktopCustomerAccountSqlStore({pool,sql,verifySession:auth.verifySession}),authorize:auth.authorize,onFailure:recordDesktopFailure}):null;
 const service=auth.bindService({...coordinator,...accountCoordinator});
 const listService=auth.bindReadService(createDesktopWriteListService({pool,sql,verifySession:auth.verifySession,getSalesReadScope:getDesktopWriteSalesReadScope(auth,pool),getProductMovementSalesScope:getDesktopWriteProductMovementSalesScope(auth,pool),richCards,schemaVersion}));
 const workflowService=createDesktopSaleWorkflowService({connector,auth});
 const draftService=createDesktopWorkflowDraftService({connector,auth});
 const dispatchService=createDesktopWorkflowDispatchService({connector,auth});
 const workflowReadService=createDesktopWorkflowReadService({connector,auth});
 const resolutionService=createDesktopWorkflowResolutionService({connector,auth});
 const finalCancellationService=[5,6,7].includes(schemaVersion)?createDesktopFinalCancellationService({connector,auth}):null;
 const goodsService=[6,7].includes(schemaVersion)?auth.bindGoodsService(createDesktopGoodsService({connector,auth})):null;
 const financeService=schemaVersion===7?auth.bindFinanceService(createDesktopFinanceAssembly({connector,auth})):null;
 const warehouseService=schemaVersion===7?auth.bindWarehouseService(createDesktopWarehouseService({connector,auth})):null;
 const app=express();app.disable('x-powered-by');app.set('strict routing',true);
 app.use((req,res,next)=>{
  res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');
  if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||req.get('host')!==HOST||(req.get('origin')&&req.get('origin')!==ORIGIN))return reject(res);
  if(req.get('origin')===ORIGIN){res.set('Access-Control-Allow-Origin',ORIGIN);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Content-Type, Authorization');res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
  if(req.method==='OPTIONS')return res.sendStatus(204);next();
 });
 app.use(rateLimit({windowMs:60000,limit:60,standardHeaders:true,legacyHeaders:false}));
 if([6,7].includes(schemaVersion))app.use('/api/desktop-goods',express.json({limit:'32kb',strict:true}));
 if(schemaVersion===7)app.use('/api/desktop-warehouse',express.json({limit:'32kb',strict:true}));
 app.use(express.json({limit:'8kb',strict:true}));
 app.post('/api/auth/login',rateLimit({windowMs:60000,limit:10,standardHeaders:true,legacyHeaders:false}),async(req,res)=>{
  try{if(req.get('origin')!==ORIGIN||!req.is('application/json'))return reject(res);const data=await auth.login(req.body);return res.json({success:true,data});}
  catch{return reject(res,401);}
 });
 app.post('/api/auth/logout',async(req,res)=>{try{if(req.get('origin')!==ORIGIN)return reject(res);await auth.logout(req);return res.json({success:true,data:{loggedOut:true}});}catch{return reject(res,401);}});
 app.get('/api/auth/me',auth.bind,async(req,res)=>{try{const data=await auth.me(req);return res.json({success:true,data});}catch{return reject(res,401);}});
 if(publicRuntimeInfo)app.get('/api/desktop-runtime',auth.bind,async(req,res)=>{
  if(req.get('origin')!==ORIGIN||Object.keys(req.query??{}).length)return reject(res,400);
  try{const actor=await auth.authenticateNormal(req);if(actor?.kind!=='normal')return reject(res,403);return res.json({success:true,data:publicRuntimeInfo});}catch{return reject(res,401);}
 });
 app.use('/api/desktop-local',auth.bind);
 app.use(createDesktopLocalMasterRoutes({service,authenticateNormal:auth.authenticateNormal,richCards}));
 if([4,5,6,7].includes(schemaVersion))app.use(createDesktopCustomerAccountRoutes({service,authenticateNormal:auth.authenticateNormal}));
 app.use(['/api/products','/api/customers','/api/suppliers','/api/receipts','/api/desktop-company-rates','/api/desktop-product-barcode','/api/desktop-products'],auth.bind);
 app.use(createDesktopWriteListRoutes({service:listService,authenticateNormal:auth.authenticateNormal,richCards}));
 if([5,6,7].includes(schemaVersion)){app.use('/api/desktop-customers',auth.bind);app.use(createDesktopCustomerLedgerRoutes({service:listService,authenticateNormal:auth.authenticateNormal}));}
 app.use('/api/desktop-sale/workflows',auth.bind);
 app.use('/api/desktop-sale/drafts',auth.bind);
 app.use('/api/desktop-sale/draft-preview',auth.bind);
 app.use('/api/desktop-sale/resolve',auth.bind);
 if(schemaVersion===7){app.use('/api/desktop-sale/discount-requests',auth.bind);app.use(createDesktopSalesPricingRoutes({service:getDesktopWriteSalesApprovalService(auth,pool,draftService),authenticateNormal:auth.authenticateNormal}));}
 if(schemaVersion===7){app.use('/api/desktop-credit',auth.bind);app.use(createDesktopCreditRoutes({service:getDesktopWriteCreditService(auth,pool),authenticateNormal:auth.authenticateNormal}));}
 app.use(createDesktopSaleWorkflowRoutes({service:workflowService,draftService,dispatchService,readService:workflowReadService,resolutionService,authenticateNormal:auth.authenticateNormal}));
 if([5,6,7].includes(schemaVersion))app.use(createDesktopFinalCancellationRoutes({service:finalCancellationService,authenticateNormal:auth.authenticateNormal}));
 if([6,7].includes(schemaVersion)){app.use('/api/desktop-goods',auth.bind);app.use(createDesktopGoodsRoutes({service:goodsService,authenticateNormal:auth.authenticateNormal}));}
 if(schemaVersion===7){app.use('/api/desktop-finance',auth.bind);app.use(createDesktopFinanceRoutes({service:financeService,authenticateNormal:auth.authenticateNormal}));}
 if(schemaVersion===7){app.use('/api/desktop-warehouse',auth.bind);app.use(createDesktopWarehouseRoutes({service:warehouseService,authenticateNormal:auth.authenticateNormal}));}
 app.use((_req,res)=>reject(res,404));
 app.use((error,_req,res,next)=>{if(res.headersSent)return next(error);return reject(res,400);});
 return Object.freeze({app,closeSessions:auth.close,profile});
}
