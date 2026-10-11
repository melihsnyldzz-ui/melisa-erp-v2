import {createRequire} from 'node:module';
import {assertIsolatedCopyContext,BUSINESS_COPY_DATABASE,isolatedCopyTopology} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {createTerminalCartonFileStore} from '../../apps/api/src/services/terminalCartonStore.mjs';
import {createWorktestHandler,createReadonlySourceLock,readUpstream,assertSqlIdentity,assertPrivateCartonDirectory,CARTON_IDENTITY_SQL,WORKTEST} from './start-terminal-worktest.mjs';
import {TERMINAL_WORKTEST_HOME_PATH} from './terminal-worktest-home-readonly.mjs';

const fail=(code,statusCode=503)=>Object.assign(new Error(code),{code,statusCode});
const hosts=new Set(['127.0.0.1:5234','localhost:5234','192.168.1.46:5234']);
const loopback=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
const bearer=value=>/^Bearer [^\s]{1,8192}$/.test(value??'');
export function persistentTerminalRequestGuard(req){
 const peer=req.socket?.remoteAddress,lan=/^(?:::ffff:)?192\.168\.1\.(?:[1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(peer??'');
 if(!loopback.has(peer)&&!lan||!hosts.has(req.headers?.host))throw fail('WORKTEST_PEER',403);
 if(Object.keys(req.headers).some(k=>k==='forwarded'||k.startsWith('x-forwarded-')||k.startsWith('tailscale-')))throw fail('WORKTEST_PROXY',403);
 const sameOrigin=`http://${req.headers.host}`;
 if(req.headers.origin!==undefined&&req.headers.origin!==sameOrigin||req.headers['sec-fetch-site']==='cross-site'||req.method==='POST'&&req.headers.origin!==sameOrigin)throw fail('WORKTEST_ORIGIN',403);
 if(typeof req.url!=='string'||!req.url.startsWith('/')||req.url.includes('%')||req.url.includes('\\')||req.url.includes('#')||req.url.includes('..'))throw fail('WORKTEST_PATH',400);
}
export function isPersistentTerminalApiPath(pathname){return pathname==='/api/terminal-cartons'||pathname.startsWith('/api/terminal-cartons/')||pathname==='/api/terminal-worktest'||pathname.startsWith('/api/terminal-worktest/');}

// This is one authenticated GET reader, not a general reverse proxy. No body,
// cookie, incoming URL, alternate host or session creation is forwarded.
export async function readPersistentTerminalUpstream(pathname,authorization,{transport=fetch}={}){
 if(pathname!=='/api/home-summary')return readUpstream(pathname,authorization,{transport});
 if(!bearer(authorization))throw fail('WORKTEST_AUTH',401);
 let response;
 try{response=await transport(WORKTEST.api+'/api/home-summary',{method:'GET',headers:{authorization},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw fail('WORKTEST_API_UNAVAILABLE');}
 if(!response.ok)throw fail(response.status===401?'WORKTEST_AUTH':'WORKTEST_SCOPE',[401,403,404,409].includes(response.status)?response.status:503);
 const text=await response.text();if(Buffer.byteLength(text)>2097152)throw fail('WORKTEST_UPSTREAM_SIZE');
 let result;try{result=JSON.parse(text);}catch{throw fail('WORKTEST_API_DATA');}
 if(result?.success!==true||!result.data)throw fail('WORKTEST_API_DATA');
 return result.data;
}
export function createPersistentTerminalHandler({context,csp,store,withSource,transport=fetch}){
 assertIsolatedCopyContext(context);
 if(context.target.database!==BUSINESS_COPY_DATABASE||isolatedCopyTopology(context).webPort!==5234)throw fail('WORKTEST_DB_IDENTITY');
 const upstream=(pathname,authorization)=>readPersistentTerminalUpstream(pathname,authorization,{transport});
 return createWorktestHandler({context,csp,store,withSource,upstream,
  homeSummary:(_actor,authorization)=>upstream('/api/home-summary',authorization),
  guard:persistentTerminalRequestGuard,apiOnly:true});
}
export async function initializePersistentTerminalSupport({config,context,csp,native,transport=fetch,assertDirectory=assertPrivateCartonDirectory}){
 assertIsolatedCopyContext(context);const topology=isolatedCopyTopology(context);
 if(context.target.database!==BUSINESS_COPY_DATABASE||topology.webPort!==5234||topology.apiPort!==4184||config.server!==context.target.server||config.database!==context.target.database||config.sqlUser!==topology.reader||typeof config.sqlPassword!=='string'||!config.sqlPassword)throw fail('WORKTEST_DB_IDENTITY');
 await assertDirectory();
 // Dependencies come from this immutable package's API, never an old release.
 const sql=native??createRequire(new URL('../../apps/api/package.json',import.meta.url))('mssql');
 const pool=new sql.ConnectionPool({server:config.server,database:config.database,user:config.sqlUser,password:config.sqlPassword,pool:{max:2,min:0},connectionTimeout:8000,requestTimeout:12000,options:{encrypt:true,trustServerCertificate:true,appName:'MelisaPersistentTerminalCartonReadonly'}});
 try{
  await pool.connect();const identity=await pool.request().input('copy',sql.UniqueIdentifier,context.copyId).query(CARTON_IDENTITY_SQL);
  if(identity.recordset?.length!==1)throw fail('WORKTEST_DB_IDENTITY');assertSqlIdentity(identity.recordset[0],context);
  const store=createTerminalCartonFileStore({assertDirectory});
  const handler=createPersistentTerminalHandler({context,csp,store,withSource:createReadonlySourceLock({sql,pool,context}),transport});
  return Object.freeze({handler,close:()=>pool.close(),homeRuntime:Object.freeze({path:TERMINAL_WORKTEST_HOME_PATH,copyId:context.copyId})});
 }catch(error){await pool.close();throw error;}
}
