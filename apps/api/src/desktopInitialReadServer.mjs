// Isolated first-login server. Import creates no listener or SQL connection.
// It exposes only authenticated empty read lists; this is not the ERP writer.
import express from 'express';
import rateLimit from 'express-rate-limit';
import sql from 'mssql';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {randomBytes} from 'node:crypto';
import {openDesktopInitialTlsConnector,getDesktopInitialTlsPool,closeDesktopInitialTlsConnector} from './config/desktopInitialTls.mjs';
import {assertDesktopInitialReadIdentity,assertDesktopInitialReadUser,DESKTOP_INITIAL_READ_IDENTITY_SQL} from './services/desktopInitialReadProfile.mjs';
import {expandPermissions,applyRolePermissionDefaults} from './services/permissionCatalog.js';

const HOST='127.0.0.1',PORT=4294,ORIGIN='http://127.0.0.1:5294';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const endpoints=Object.freeze({products:{table:'products',permission:'product.view'},customers:{table:'customers',permission:'customer.view'},suppliers:{table:'suppliers',permission:'supplier.view'}});
const usersSql=`SELECT CONVERT(varchar(20),u.id) id,u.username,u.display_name displayName,
 CONVERT(varchar(20),r.id) roleId,r.code roleCode,r.name roleName,u.is_active userActive,r.is_active roleActive,u.password_hash passwordHash
 FROM dbo.users u WITH(HOLDLOCK) JOIN dbo.roles r WITH(HOLDLOCK) ON r.id=u.role_id
 WHERE u.username=@username AND (@userId IS NULL OR u.id=TRY_CONVERT(bigint,@userId));`;
const permsSql=`SELECT permission_key,can_view,can_create,can_update,can_delete,can_approve FROM dbo.permissions WITH(HOLDLOCK)
 WHERE role_id=TRY_CONVERT(bigint,@roleId) ORDER BY permission_key;`;
export const DESKTOP_INITIAL_SERVER_LIMITS=Object.freeze({readOnly:true,salesWritesEnabled:false,fullErpReady:false,
 requiresProvisionedSqlLoginAndAppUser:true,requiresPrivateCredentialProvider:true,requiresTrustedPublicCertificate:true,
 requiresIndependentSqlIntegrationProof:true,firstUserProvisioned:false});

// The transaction retains one checked-out physical connection from identity
// check through the permission and data reads; SQL driver errors never escape.
export function createDesktopInitialReadCore({pool,driver=sql,connector=null,passwordHasher=bcrypt,tokenKey=randomBytes(48)}={}){
 if(!pool||!driver?.Transaction||!driver?.Request||!driver?.NVarChar||driver?.ISOLATION_LEVEL?.SERIALIZABLE===undefined||typeof passwordHasher?.compare!=='function'
  ||!Buffer.isBuffer(tokenKey)||tokenKey.length<32)fail('DESKTOP_INITIAL_CONFIG_REJECTED');
 if(driver===sql&&getDesktopInitialTlsPool(connector)!==pool)fail('DESKTOP_INITIAL_CONFIG_REJECTED');
 async function transaction(work){
  const tx=new driver.Transaction(pool);let begun=false;
  try{
   if(driver===sql&&getDesktopInitialTlsPool(connector)!==pool)fail('DESKTOP_INITIAL_CONFIG_REJECTED');
   await tx.begin(driver.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
   const result=await new driver.Request(tx).query(DESKTOP_INITIAL_READ_IDENTITY_SQL);
   if(!Array.isArray(result?.recordset)||result.recordset.length!==1)fail('DESKTOP_INITIAL_IDENTITY_REJECTED');
   assertDesktopInitialReadIdentity(result.recordset[0]);
   const value=await work(tx);await tx.commit();begun=false;return value;
  }catch(error){if(begun)try{await tx.rollback();}catch{}if(error?.code==='DESKTOP_INITIAL_AUTH_REJECTED')fail('DESKTOP_INITIAL_AUTH_REJECTED');fail('DESKTOP_INITIAL_UNAVAILABLE');}
 }
 async function userFor(tx,userId=null){
  const request=new driver.Request(tx);
  const rows=(await request.input('username',driver.NVarChar(80),'kurulum').input('userId',driver.NVarChar(20),userId).query(usersSql)).recordset;
  if(!Array.isArray(rows)||rows.length!==1)fail('DESKTOP_INITIAL_USER_REJECTED');
  const row=rows[0];
  if(typeof row.id!=='string'||!/^\d+$/.test(row.id)||!Number.isSafeInteger(Number(row.id))||Number(row.id)<1
   ||typeof row.roleId!=='string'||!/^\d+$/.test(row.roleId)||!Number.isSafeInteger(Number(row.roleId))||Number(row.roleId)<1)fail('DESKTOP_INITIAL_USER_REJECTED');
  const permissionRows=(await new driver.Request(tx).input('roleId',driver.NVarChar(20),row.roleId).query(permsSql)).recordset;
  const keys=['customer.view','dashboard.view','product.view','supplier.view'];
  if(!Array.isArray(permissionRows)||permissionRows.length!==keys.length
   ||permissionRows.some((p,i)=>p?.permission_key!==keys[i]||p.can_view!==true||p.can_create!==false||p.can_update!==false||p.can_delete!==false||p.can_approve!==false))fail('DESKTOP_INITIAL_USER_REJECTED');
  const permissions=applyRolePermissionDefaults(expandPermissions(permissionRows),row.roleCode);
  assertDesktopInitialReadUser({id:row.id,username:row.username,userActive:row.userActive,roleCode:row.roleCode,roleActive:row.roleActive,permissions});
  return {id:row.id,username:row.username,displayName:row.displayName,role:{id:Number(row.roleId),code:row.roleCode,name:row.roleName},permissions,passwordHash:row.passwordHash};
 }
 function publicUser(u){return {id:Number(u.id),username:u.username,displayName:u.displayName,role:u.role,permissions:u.permissions};}
 async function login(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='password,username'
   ||body.username!=='kurulum'||typeof body.password!=='string'||!body.password||Buffer.byteLength(body.password,'utf8')>72)fail('DESKTOP_INITIAL_AUTH_REJECTED');
  const output=await transaction(async tx=>{
   const u=await userFor(tx);
   if(typeof u.passwordHash!=='string'||!await passwordHasher.compare(body.password,u.passwordHash))fail('DESKTOP_INITIAL_AUTH_REJECTED');
   return publicUser(u);
  });
  const accessToken=jwt.sign({sub:String(output.id)},tokenKey,{algorithm:'HS256',issuer:'melisa-desktop-initial',audience:'melisa-desktop-initial',expiresIn:'10m'});
  return {user:output,accessToken,refreshToken:null,tokenType:'Bearer',expiresIn:'10m',readOnlySession:true};
 }
 function tokenSubject(token){
  if(typeof token!=='string'||token.length>4096)fail('DESKTOP_INITIAL_AUTH_REJECTED');
  let payload;try{payload=jwt.verify(token,tokenKey,{algorithms:['HS256'],issuer:'melisa-desktop-initial',audience:'melisa-desktop-initial'});}catch{fail('DESKTOP_INITIAL_AUTH_REJECTED');}
  if(typeof payload?.sub!=='string'||!/^[1-9]\d*$/.test(payload.sub))fail('DESKTOP_INITIAL_AUTH_REJECTED');return payload.sub;
 }
 async function read(token,kind){
  const target=endpoints[kind];if(!target)fail('DESKTOP_INITIAL_REQUEST_REJECTED');
  const userId=tokenSubject(token);
  return transaction(async tx=>{
   const u=await userFor(tx,userId);if(!u.permissions.includes(target.permission))fail('DESKTOP_INITIAL_USER_REJECTED');
   const rows=(await new driver.Request(tx).query(`SELECT COUNT_BIG(*) AS total FROM dbo.[${target.table}] WHERE is_deleted=0;`)).recordset;
   if(!Array.isArray(rows)||rows.length!==1||String(rows[0].total)!=='0')fail('DESKTOP_INITIAL_DATA_NOT_EMPTY');
   return {user:publicUser(u),data:[]};
  });
 }
 async function me(token){const userId=tokenSubject(token);return transaction(async tx=>publicUser(await userFor(tx,userId)));}
 return Object.freeze({login,read,me});
}

export function createDesktopInitialReadApp(core){
 if(!core||typeof core.login!=='function'||typeof core.read!=='function'||typeof core.me!=='function')fail('DESKTOP_INITIAL_CONFIG_REJECTED');
 const app=express();app.disable('x-powered-by');app.set('strict routing',true);
 app.use((req,res,next)=>{if(req.get('host')!==`${HOST}:${PORT}`||(req.get('origin')&&req.get('origin')!==ORIGIN))return res.status(403).json({success:false,error:{code:'DESKTOP_INITIAL_SCOPE_REJECTED'}});next();});
 app.use((req,res,next)=>{if(req.get('origin')===ORIGIN){res.set('Access-Control-Allow-Origin',ORIGIN);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Content-Type, Authorization');res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');}if(req.method==='OPTIONS')return res.sendStatus(204);next();});
 app.use(rateLimit({windowMs:60000,limit:60,standardHeaders:true,legacyHeaders:false}));
 app.use(express.json({limit:'8kb',strict:true}));
 const bearer=req=>{const m=/^Bearer ([A-Za-z0-9._-]+)$/.exec(req.get('authorization')||'');if(!m)fail('DESKTOP_INITIAL_AUTH_REJECTED');return m[1];};
 const safe=(fn)=>async(req,res)=>{try{await fn(req,res);}catch(error){const auth=error?.code==='DESKTOP_INITIAL_AUTH_REJECTED';res.status(auth?401:503).json({success:false,error:{code:auth?'AUTH_INVALID_CREDENTIALS':'DESKTOP_INITIAL_UNAVAILABLE',message:'İstek doğrulanamadı.'}});}};
 app.post('/api/auth/login',safe(async(req,res)=>res.json({success:true,data:await core.login(req.body),meta:{source:'sql-auth'}})));
 app.get('/api/auth/me',safe(async(req,res)=>res.json({success:true,data:await core.me(bearer(req)),meta:{source:'jwt-auth'}})));
 for(const kind of Object.keys(endpoints))app.get(`/api/${kind}`,safe(async(req,res)=>{
  const pageRaw=req.query.page??'1',limitRaw=req.query.limit??'100';
  if(typeof pageRaw!=='string'||typeof limitRaw!=='string'||!/^[1-9]\d{0,5}$/.test(pageRaw)||!/^[1-9]\d{0,2}$/.test(limitRaw)||Number(limitRaw)>500)fail('DESKTOP_INITIAL_REQUEST_REJECTED');
  const result=await core.read(bearer(req),kind),page=Number(pageRaw),limit=Number(limitRaw);
  res.json({success:true,data:result.data,meta:{page,limit,total:0,totalPages:1,hasNextPage:false,hasPreviousPage:page>1,maxLimit:500,source:'sql-select',filters:{}}});
 }));
 app.use((req,res)=>res.status(403).json({success:false,error:{code:'DESKTOP_INITIAL_READ_ONLY'}}));
 app.use((error,req,res,next)=>{if(res.headersSent)return next(error);res.status(400).json({success:false,error:{code:'DESKTOP_INITIAL_REQUEST_REJECTED'}});});
 return app;
}

// Explicit call only. Provider must return the SQL password privately; neither
// argv, environment variables, nor logs are used as a credential transport.
export async function startDesktopInitialReadServer({credentialProvider,publicCertificatePem}={}){
 if(typeof credentialProvider!=='function')fail('DESKTOP_INITIAL_CONFIG_REJECTED');
 let pool,server,connector;
 try{
  const secret=await credentialProvider();
  connector=await openDesktopInitialTlsConnector({password:secret,publicCertificatePem});
  pool=getDesktopInitialTlsPool(connector);
  const core=createDesktopInitialReadCore({pool,connector}),app=createDesktopInitialReadApp(core);
  // Establish and validate one pinned session before opening the listener.
  const tx=new sql.Transaction(pool);let begun=false;
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;const rows=(await new sql.Request(tx).query(DESKTOP_INITIAL_READ_IDENTITY_SQL)).recordset;
   if(!Array.isArray(rows)||rows.length!==1)fail('DESKTOP_INITIAL_IDENTITY_REJECTED');assertDesktopInitialReadIdentity(rows[0]);await tx.commit();begun=false;
  }finally{if(begun)try{await tx.rollback();}catch{}}
  server=await new Promise((resolve,reject)=>{const listening=app.listen(PORT,HOST,()=>{listening.off('error',reject);resolve(listening);});listening.once('error',reject);});
  return Object.freeze({server,close:async()=>{await new Promise(resolve=>server.close(resolve));await closeDesktopInitialTlsConnector(connector);}});
 }catch{try{if(server)server.close();if(connector)await closeDesktopInitialTlsConnector(connector);}catch{}fail('DESKTOP_INITIAL_START_REJECTED');}
}
