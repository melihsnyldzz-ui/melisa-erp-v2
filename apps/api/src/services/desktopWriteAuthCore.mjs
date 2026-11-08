// SOURCE ONLY. A real v2 writer pool, reviewed startup wiring, grants and
// session persistence policy are required before mounting this module.
// It does not open a listener, create users, grant roles or mutate SQL.
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomBytes,randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nativeSql from 'mssql';
import {applyRolePermissionDefaults,expandPermissions} from './permissionCatalog.js';
import {desktopSalesReadMode} from '../../../../packages/shared/src/desktopSalesReadScope.mjs';
import {desktopSalesPolicyForUser,desktopCreditAccessForUser,DESKTOP_SALES_POLICY_SETTING} from './desktopSalesPolicy.mjs';
import {createDesktopSalesPricingAuthority} from './desktopSalesPricingAuthority.mjs';
import {createDesktopCreditAuthority} from './desktopCreditAuthority.mjs';
import {DESKTOP_LIFECYCLE_PERMISSION_GUARD_SQL as DESKTOP_WRITE_PERMISSION_GUARD_SQL} from '../config/desktopLifecyclePermissionPolicy.mjs';
import {DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL} from '../config/desktopMasterV3Policy.mjs';
import {desktopMasterSchema,desktopMasterV5Schema,desktopMasterV6Schema,desktopMasterV7Schema,DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL} from '../config/desktopMasterVersion.mjs';
import {getDesktopMasterV6GuardSql} from '../config/desktopGoodsV6Guard.mjs';
import {getDesktopFinanceV7GuardSql} from '../config/desktopFinanceV7Policy.mjs';
import {DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL,DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL} from '../config/desktopMasterV5Policy.mjs';

const ISSUER='melisa-desktop-initial',AUDIENCE='melisa-desktop-initial';
const LOGIN='melisa_desktop_test_writer_20261105';
const DATABASE='MELISA_ERP_DESKTOP_TEST_20261105';
const GUID='c67f5317-9c0d-4831-aadd-fadc379a95d1';
const ENV='eb2888c2-51cb-4570-a933-397cf7e62806';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=()=>{throw Object.assign(Error('DESKTOP_AUTH_UNAVAILABLE'),{code:'DESKTOP_AUTH_UNAVAILABLE'});};
const authOwners=new WeakMap();
export function getDesktopWriteSessionVerifier(auth,pool){const entry=authOwners.get(auth);if(!entry||!entry.secure||entry.pool!==pool)fail();return entry.verifySession;}
export function getDesktopWriteProductMovementSalesScope(auth,pool){const entry=authOwners.get(auth);if(!entry||!entry.secure||entry.pool!==pool)fail();return entry.productMovementSalesScope;}
export function getDesktopWriteSalesReadScope(auth,pool){const entry=authOwners.get(auth);if(!entry||!entry.secure||entry.pool!==pool)fail();return entry.salesReadScope;}
export function getDesktopWriteSalesPolicy(auth,pool){const entry=authOwners.get(auth);if(!entry||!entry.secure||entry.pool!==pool)fail();return entry.salesPolicy;}
export function getDesktopWriteSalesPricingAuthority(auth,pool){const entry=authOwners.get(auth);if(!entry||!entry.secure||entry.pool!==pool)fail();return entry.pricingAuthority;}
export function getDesktopWriteSalesApprovalService(auth,pool,draftService){const entry=authOwners.get(auth);if(!entry||!entry.secure||entry.pool!==pool)fail();return entry.approvalService(draftService);}
export function getDesktopWriteCreditAuthority(auth,pool){const entry=authOwners.get(auth);if(!entry||!entry.secure||entry.pool!==pool)fail();return entry.creditAuthority;}
export function getDesktopWriteCreditService(auth,pool){const entry=authOwners.get(auth);if(!entry||!entry.secure||entry.pool!==pool)fail();return entry.creditService();}
export function getDesktopWriteDiscountCeiling(auth,pool){const entry=authOwners.get(auth);if(!entry||!entry.secure||entry.pool!==pool)fail();return entry.discountCeiling;}
const id=value=>typeof value==='string'&&/^[1-9]\d{0,15}$/.test(value)&&BigInt(value)<=9007199254740991n;
const tokenHeader=req=>{const v=req?.get?.('authorization');const m=typeof v==='string'?/^Bearer ([A-Za-z0-9._-]{1,4096})$/.exec(v):null;return m?.[1]??null;};
const one=r=>{if(!Array.isArray(r?.recordset)||r.recordset.length!==1)fail();return r.recordset[0];};

// Same physical SQL transaction is retained throughout each authority read.
// Real TLS validation is the responsibility of the separately reviewed pool
// opener. SQL checks target identity and a dedicated, non-admin writer login.
const identitySql=`SET NOCOUNT ON;
IF DB_NAME() IS NULL OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'${DATABASE}')
 OR CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'Semih\\MELISAERP')
 OR SUSER_SNAME() IS NULL OR CONVERT(varbinary(256),SUSER_SNAME())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR ORIGINAL_LOGIN() IS NULL OR CONVERT(varbinary(256),ORIGINAL_LOGIN())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR USER_NAME() IS NULL OR DATALENGTH(USER_NAME())<>DATALENGTH(N'${LOGIN}') OR CONVERT(varbinary(256),USER_NAME())<>CONVERT(varbinary(256),N'${LOGIN}')
 OR DATALENGTH(SUSER_SNAME())<>DATALENGTH(N'${LOGIN}') OR DATALENGTH(ORIGINAL_LOGIN())<>DATALENGTH(N'${LOGIN}')
 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'TCP'
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),1)<>0 OR ISNULL(IS_ROLEMEMBER(N'db_owner'),1)<>0
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=DB_ID() AND database_guid='${GUID}')
 OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WITH(UPDLOCK,HOLDLOCK) WHERE id=1 AND environment_id='${ENV}' AND schema_version=2 AND actual_t1=0 AND external_operations=0 AND read_only=0)
 THROW 51995,'DESKTOP_AUTH_TARGET_REJECTED',1;
${DESKTOP_WRITE_PERMISSION_GUARD_SQL}
SELECT 1 AS ok;`;
const userSql=`SELECT CONVERT(varchar(20),u.id) id,u.username,u.display_name displayName,u.password_hash passwordHash,
 CONVERT(varchar(20),r.id) roleId,r.code roleCode,r.name roleName,u.is_active userActive,r.is_active roleActive,
 CONVERT(varchar(18),CONVERT(binary(8),u.row_version),1) userVersion,
 CONVERT(varchar(18),CONVERT(binary(8),r.row_version),1) roleVersion
 FROM dbo.users u WITH(UPDLOCK,HOLDLOCK) JOIN dbo.roles r WITH(UPDLOCK,HOLDLOCK) ON r.id=u.role_id
 WHERE (@username IS NOT NULL AND CONVERT(varbinary(160),u.username)=CONVERT(varbinary(160),@username) AND DATALENGTH(u.username)=DATALENGTH(@username))
 OR (@userId IS NOT NULL AND u.id=TRY_CONVERT(bigint,@userId));`;
const permissionSql=`SELECT permission_key,can_view,can_create,can_update,can_delete,can_approve
 FROM dbo.permissions WITH(UPDLOCK,HOLDLOCK) WHERE role_id=TRY_CONVERT(bigint,@roleId)
 AND (can_view=1 OR can_create=1 OR can_update=1 OR can_approve=1) ORDER BY permission_key;`;

export const DESKTOP_WRITE_AUTH_LIMITS=Object.freeze({sourceOnly:true,routeMounted:false,writableProfileInstalled:false,
 credentialVerifier:'bcrypt',algorithm:'HS256',issuer:ISSUER,audience:AUDIENCE,
 sessions:'process-local-revocable',sessionInvalidAfterRestart:true,multiProcessSessionSharingImplemented:false,
 writerPoolAndTlsOpenerImplemented:false,requiresSameTransactionAuthorityCheck:true,
 userAndRolePermissionsProvisioned:false,realSqlVerified:false,fullErpReady:false});

export function createDesktopWriteAuthCore({pool,sql,tokenKey=randomBytes(48),passwordHasher=bcrypt,richCards=false,schemaVersion=richCards?3:2}={}){
 schemaVersion=schemaVersion===7?desktopMasterV7Schema(richCards,schemaVersion):schemaVersion===6?desktopMasterV6Schema(richCards,schemaVersion):schemaVersion===5?desktopMasterV5Schema(richCards,schemaVersion):desktopMasterSchema(richCards,schemaVersion);
 if(typeof richCards!=='boolean')fail();
 if(!pool||!sql?.Transaction||!sql?.Request||!sql?.NVarChar||!sql?.ISOLATION_LEVEL?.SERIALIZABLE||!Buffer.isBuffer(tokenKey)||tokenKey.length<32||typeof passwordHasher?.compare!=='function')fail();
 const key=Buffer.from(tokenKey),sessions=new Map(),storage=new AsyncLocalStorage(),draftServices=new WeakSet();let closed=false;
 const maxSessions=256;
 // Never evict an operation holding a transaction lease. A stale idle session
 // can be discarded on a subsequent login; an in-flight one is removed only
 // after its caller has settled the transaction.
 function prune(){for(const [sid,entry] of sessions)if(entry.expiresAt<=Date.now()&&entry.inflight===0)sessions.delete(sid);}
 const run=(tx,params,statement)=>{const q=new sql.Request(tx);for(const [name,size,value] of params)q.input(name,sql.NVarChar(size),value);return q.query(statement);};
 const profileIdentitySql=richCards?identitySql.replace('schema_version=2',`schema_version=${schemaVersion}`).replace(DESKTOP_WRITE_PERMISSION_GUARD_SQL,schemaVersion===7?getDesktopFinanceV7GuardSql():schemaVersion===6?getDesktopMasterV6GuardSql():schemaVersion===5?DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL+DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL:DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL+(schemaVersion===4?DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL:'')):identitySql;
 async function guard(tx){if(one(await run(tx,[],profileIdentitySql)).ok!==1)fail();}
 async function user(tx,{username=null,userId=null}={}){
  const rows=(await run(tx,[['username',80,username],['userId',20,userId]],userSql))?.recordset;
  if(!Array.isArray(rows)||rows.length!==1)fail();const row=rows[0];
  if(!id(row.id)||!id(row.roleId)||typeof row.username!=='string'||!row.username||typeof row.displayName!=='string'||typeof row.roleCode!=='string'||typeof row.roleName!=='string'
   ||row.userActive!==true||row.roleActive!==true||!/^0x[0-9a-f]{16}$/i.test(row.userVersion)||!/^0x[0-9a-f]{16}$/i.test(row.roleVersion))fail();
  const permissions=(await run(tx,[['roleId',20,row.roleId]],permissionSql))?.recordset;
  if(!Array.isArray(permissions))fail();
  const expanded=applyRolePermissionDefaults(expandPermissions(permissions),row.roleCode);
  return {id:row.id,username:row.username,displayName:row.displayName,role:{id:Number(row.roleId),code:row.roleCode,name:row.roleName},
   permissions:expanded,passwordHash:row.passwordHash,userVersion:row.userVersion,roleVersion:row.roleVersion};
 }
 async function transaction(work){const tx=new sql.Transaction(pool);let begun=false;
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;await guard(tx);const result=await work(tx);await tx.commit();begun=false;return result;}
  catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}}
 const publicUser=u=>({id:Number(u.id),username:u.username,displayName:u.displayName,role:u.role,permissions:u.permissions});
 function verify(token){
  if(closed||typeof token!=='string'||token.length>4096)fail();let p;
  try{p=jwt.verify(token,key,{algorithms:['HS256'],issuer:ISSUER,audience:AUDIENCE});}catch{fail();}
  if(typeof p?.sub!=='string'||!id(p.sub)||typeof p.sid!=='string'||!uuid.test(p.sid)||!Number.isSafeInteger(p.exp))fail();
  const entry=sessions.get(p.sid);if(!entry||entry.revoked||entry.userId!==p.sub||entry.expiresAt!==p.exp*1000||entry.expiresAt<=Date.now())fail();
  return entry;
 }
 async function login(input){
  if(closed||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='password,username'||typeof input.username!=='string'||typeof input.password!=='string'||!input.username.trim()||!input.password||Buffer.byteLength(input.password,'utf8')>72)fail();
  prune();if(sessions.size>=maxSessions)fail();
  const username=input.username.trim();if(username.length>80)fail();
  const found=await transaction(async tx=>{const u=await user(tx,{username});if(typeof u.passwordHash!=='string'||!await passwordHasher.compare(input.password,u.passwordHash))fail();return u;});
  prune();if(closed||sessions.size>=maxSessions)fail();const sid=randomUUID();
  const accessToken=jwt.sign({sub:found.id,sid},key,{algorithm:'HS256',issuer:ISSUER,audience:AUDIENCE,expiresIn:'10m'});
  const decoded=jwt.decode(accessToken);if(!decoded||!Number.isSafeInteger(decoded.exp))fail();
  sessions.set(sid,{sid,userId:found.id,userVersion:found.userVersion,roleVersion:found.roleVersion,expiresAt:decoded.exp*1000,revoked:false,inflight:0,waiters:[]});
  return {user:publicUser(found),accessToken,refreshToken:null,tokenType:'Bearer',expiresIn:'10m'};
 }
 function active(ctx){return !!ctx&&ctx.open&&sessions.get(ctx.entry?.sid)===ctx.entry&&!ctx.entry.revoked&&ctx.entry.expiresAt>Date.now();}
 function release(ctx){if(!ctx?.leased)return;ctx.leased=false;ctx.verifiedTransaction=null;ctx.verifiedRole=null;ctx.verifiedUser=null;ctx.verifiedSalesPolicy=null;ctx.verifiedPermissions=null;ctx.verifiedRequired=null;const e=ctx.entry;e.inflight--;if(e.inflight===0){for(const f of e.waiters.splice(0))f();if(e.revoked||e.expiresAt<=Date.now())sessions.delete(e.sid);}
  if(closed&&![...sessions.values()].some(entry=>entry.inflight>0)){sessions.clear();key.fill(0);}}
 async function bind(req,res,next){
  const ctx={req,entry:null,current:null,open:!res.destroyed&&!res.writableEnded,leased:false};
  res.once('finish',()=>{ctx.open=false;});res.once('close',()=>{ctx.open=false;});
  let entry=null,current=null;try{entry=verify(tokenHeader(req));current=await transaction(tx=>user(tx,{userId:entry.userId}));
   if(!ctx.open||entry.revoked||sessions.get(entry.sid)!==entry||entry.expiresAt<=Date.now()||current.userVersion!==entry.userVersion||current.roleVersion!==entry.roleVersion)fail();
  }catch{entry=null;current=null;}
  ctx.entry=entry;ctx.current=current;
  return storage.run(ctx,()=>next());
 }
 async function authenticateNormal(req){const ctx=storage.getStore();if(!active(ctx)||ctx.req!==req)fail();return {kind:'normal',userId:ctx.entry.userId,permissions:[...ctx.current.permissions]};}
 async function authorize({actorId,permission}={}){const ctx=storage.getStore();return !!active(ctx)&&ctx.entry.userId===actorId&&['customer.edit','product.edit',...(richCards?['supplier.edit']:[])].includes(permission)&&ctx.current.permissions.includes(permission);}
 async function me(req){const ctx=storage.getStore();if(!active(ctx)||ctx.req!==req)fail();return publicUser(ctx.current);}
 async function verifySession({transaction:tx,actorId,permission}={}){
   const required=Array.isArray(permission)?permission:[permission],allowed=['customer.edit','product.edit','customer.view','product.view','supplier.view','sales.view','sales.create','sales.edit','sales.finalize',...(richCards?['supplier.edit']:[]),...([5,6,7].includes(schemaVersion)?['sales.cancel']:[]),...([6,7].includes(schemaVersion)?['goods.view','goods.create','goods.approve','purchase.view','purchase.create','purchase.finalize']:[]),...(schemaVersion===7?['finance.collection','finance.payment','warehouse.view','warehouse.prepare','warehouse.pack']:[])];
   const ctx=storage.getStore();if(!active(ctx)||!tx||ctx.leased||actorId!==ctx.entry.userId||required.length<1||required.length>([6,7].includes(schemaVersion)?6:2)||new Set(required).size!==required.length||required.some(p=>!allowed.includes(p)||!ctx.current.permissions.includes(p)))return false;
  // Lease before SQL I/O. Concurrent logout marks the token revoked and waits
  // for this operation to commit or roll back; it never returns early.
  ctx.entry.inflight++;ctx.leased=true;
  try{await guard(tx);const current=await user(tx,{userId:actorId});
   if(!ctx.open||ctx.entry.revoked||ctx.entry.expiresAt<=Date.now()||current.userVersion!==ctx.entry.userVersion||current.roleVersion!==ctx.entry.roleVersion||required.some(p=>!current.permissions.includes(p))){release(ctx);return false;}
   ctx.verifiedTransaction=tx;ctx.verifiedRole=current.role.code;ctx.verifiedUser=current;ctx.verifiedPermissions=Object.freeze([...current.permissions]);ctx.verifiedRequired=Object.freeze([...required]);
   if(required.some(p=>p==='sales.create'||p==='sales.finalize'))ctx.verifiedSalesPolicy=(await readPricingPolicy({transaction:tx,actorId})).policy;
   return true;
  }catch{release(ctx);return false;}
 }
 // Old wire commands cannot bypass a later individual restriction. Widening
 // above 3% requires the new bound pricing proof; the old body stays identical.
 function discountCeiling({transaction,actorId}={}){const ctx=ensurePricingLease(transaction,actorId),p=ctx.verifiedSalesPolicy;if(!p)fail();return BigInt(p.maxDiscountRateExact4.replace('.',''))<30000n?p.maxDiscountRateExact4:'3.0000';}
 function productMovementSalesScope({transaction,actorId}={}){const ctx=storage.getStore();if(!active(ctx)||!ctx.leased||ctx.verifiedTransaction!==transaction||ctx.entry.userId!==actorId||!ctx.verifiedRequired?.includes('product.view')||!ctx.verifiedRequired?.includes('product.edit')||!Array.isArray(ctx.verifiedPermissions))fail();return desktopSalesReadMode(ctx.verifiedPermissions);}
 function salesReadScope({transaction,actorId}={}){const ctx=storage.getStore();if(!active(ctx)||!ctx.leased||ctx.verifiedTransaction!==transaction||ctx.entry.userId!==actorId||!Array.isArray(ctx.verifiedPermissions)||!ctx.verifiedRequired?.includes('sales.view'))fail();const mode=desktopSalesReadMode(ctx.verifiedPermissions);if(mode!=='own'&&mode!=='all')fail();return mode;}
 function ensurePricingLease(transaction,actorId){const ctx=storage.getStore();if(!active(ctx)||!ctx.leased||ctx.verifiedTransaction!==transaction||ctx.entry.userId!==actorId||!ctx.verifiedUser||!ctx.verifiedRequired?.some(k=>k==='sales.view'||k==='sales.create'||k==='sales.finalize'))fail();return ctx;}
 async function readPricingPolicy({transaction,actorId,targetActorId=actorId}={}){
  const ctx=ensurePricingLease(transaction,actorId);if(!id(targetActorId))fail();
  if(targetActorId===actorId&&ctx.verifiedSalesPolicy)return {policy:ctx.verifiedSalesPolicy,user:ctx.verifiedUser};
  const current=targetActorId===actorId?ctx.verifiedUser:await user(transaction,{userId:targetActorId});
  const r=await run(transaction,[['group',80,DESKTOP_SALES_POLICY_SETTING.group],['key',100,DESKTOP_SALES_POLICY_SETTING.key]],`/* DESKTOP_SALES_POLICY_READ */ SELECT TOP(2) CONVERT(varchar(20),id) id,setting_value value,value_type valueType,is_active active,CONVERT(varchar(18),CONVERT(binary(8),row_version),1) version FROM dbo.system_settings WITH(UPDLOCK,HOLDLOCK) WHERE CONVERT(varbinary(160),setting_group)=CONVERT(varbinary(160),@group) AND CONVERT(varbinary(200),setting_key)=CONVERT(varbinary(200),@key);`);
  if(!Array.isArray(r?.recordset)||r.recordset.length>1)fail();ensurePricingLease(transaction,actorId);
  return {policy:desktopSalesPolicyForUser(current,r.recordset[0]??null),user:current};
 }
 const pricing=createDesktopSalesPricingAuthority({sql,readPolicy:readPricingPolicy,ensureLease:ensurePricingLease});
 function ensureCreditLease(transaction,actorId){const ctx=storage.getStore();if(!active(ctx)||!ctx.leased||ctx.verifiedTransaction!==transaction||ctx.entry.userId!==actorId||!ctx.verifiedUser||!Array.isArray(ctx.verifiedRequired)||!ctx.verifiedRequired.length)fail();return ctx;}
 async function readCreditAuthority({transaction,actorId,targetActorId=actorId}={}){
  const ctx=ensureCreditLease(transaction,actorId);if(!id(targetActorId))fail();
  const current=targetActorId===actorId?ctx.verifiedUser:await user(transaction,{userId:targetActorId});
  const r=await run(transaction,[['group',80,DESKTOP_SALES_POLICY_SETTING.group],['key',100,DESKTOP_SALES_POLICY_SETTING.key]],`/* DESKTOP_CREDIT_ACCESS_READ */ SELECT TOP(2) CONVERT(varchar(20),id) id,setting_value value,value_type valueType,is_active active,CONVERT(varchar(18),CONVERT(binary(8),row_version),1) version FROM dbo.system_settings WITH(UPDLOCK,HOLDLOCK) WHERE CONVERT(varbinary(160),setting_group)=CONVERT(varbinary(160),@group) AND CONVERT(varbinary(200),setting_key)=CONVERT(varbinary(200),@key);`);
  if(!Array.isArray(r?.recordset)||r.recordset.length>1)fail();ensureCreditLease(transaction,actorId);
  return desktopCreditAccessForUser(current,r.recordset[0]??null);
 }
 const credit=createDesktopCreditAuthority({sql,readAuthority:readCreditAuthority,ensureLease:ensureCreditLease});
 const creditService=()=>{if(schemaVersion!==7)fail();return credit.service({pool,verifySession,release:()=>release(storage.getStore())});};
 const salesPolicy=async args=>(await readPricingPolicy(args)).policy;
 const approvalService=draftService=>{if(!draftServices.has(draftService)||typeof draftService.preview!=='function')fail();return pricing.approvalService({pool,verifySession,release:()=>release(storage.getStore()),preview:draftService.preview});};
 function bindService(service){
  if(!service||typeof service.createCustomer!=='function'||typeof service.createProduct!=='function')fail();
  const invoke=name=>async(actor,payload)=>{const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service[name](actor,payload);}finally{release(ctx);}};
  if(richCards&&typeof service.createSupplier!=='function')fail();
   if([4,5,6,7].includes(schemaVersion)&&typeof service.createCustomerAccount!=='function')fail();
   return Object.freeze({createCustomer:invoke('createCustomer'),createProduct:invoke('createProduct'),...(richCards?{createSupplier:invoke('createSupplier')}:{}),...([4,5,6,7].includes(schemaVersion)?{createCustomerAccount:invoke('createCustomerAccount')}:{})});
 }
 function bindReadService(service){
  if(!service||typeof service.list!=='function')fail();
  const invoke=name=>async(actor,...args)=>{const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service[name](actor,...args);}finally{release(ctx);}};
    return Object.freeze({list:invoke('list'),...(richCards&&typeof service.readProduct==='function'?{readProduct:invoke('readProduct')}:{}),...(richCards&&typeof service.readProductMovements==='function'?{readProductMovements:invoke('readProductMovements')}:{}),...(richCards&&typeof service.readCustomer==='function'?{readCustomer:invoke('readCustomer')}:{}),...(richCards&&typeof service.readCompanyRates==='function'?{readCompanyRates:invoke('readCompanyRates')}:{}),...(richCards&&typeof service.readProductBarcode==='function'?{readProductBarcode:invoke('readProductBarcode')}:{}),...(richCards&&typeof service.readCustomerAccountSales==='function'?{readCustomerAccountSales:invoke('readCustomerAccountSales')}:{}),...(schemaVersion>=5&&typeof service.readCustomerLedger==='function'?{readCustomerLedger:invoke('readCustomerLedger')}:{})});
 }
 function bindSaleService(service){
  if(!service||typeof service.sell!=='function')fail();
  const bound={};for(const name of ['sell','preview','receipt'])if(typeof service[name]==='function')bound[name]=async(actor,...args)=>{const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service[name](actor,...args);}finally{release(ctx);}};
  return Object.freeze(bound);
 }
 async function logout(req){
  const entry=verify(tokenHeader(req));entry.revoked=true;
  if(entry.inflight>0)await new Promise(resolve=>entry.waiters.push(resolve));
  sessions.delete(entry.sid);return true;
 }
 function close(){closed=true;for(const entry of sessions.values())entry.revoked=true;if([...sessions.values()].some(e=>e.inflight>0))return false;sessions.clear();key.fill(0);return true;}
 function bindWorkflowService(service){
  if(typeof service?.transition!=='function')fail();
  return Object.freeze({async transition(actor,payload){const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service.transition(actor,payload);}finally{release(ctx);}}});
 }
 function bindDraftService(service){if(typeof service?.createDraft!=='function')fail();const methods={};for(const name of ['createDraft','preview'])if(typeof service[name]==='function')methods[name]=async(actor,payload)=>{const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service[name](actor,payload);}finally{release(ctx);}};const bound=Object.freeze(methods);draftServices.add(bound);return bound;}
 function bindDispatchService(service){if(typeof service?.dispatch!=='function')fail();return Object.freeze({async dispatch(actor,payload){const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service.dispatch(actor,payload);}finally{release(ctx);}}});}
 function bindWorkflowReadService(service){if(typeof service?.read!=='function')fail();return Object.freeze({async read(actor,invoiceId){const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service.read(actor,invoiceId);}finally{release(ctx);}}});}
 function bindResolutionService(service){if(typeof service?.resolve!=='function')fail();return Object.freeze({async resolve(actor,payload){const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service.resolve(actor,payload);}finally{release(ctx);}}});}
 // This binder retains the normal request/session lease through transaction
 // commit. Existing profiles still reject sales.cancel in verifySession.
 function bindFinalCancellationService(service){if(typeof service?.cancel!=='function')fail();return Object.freeze({async cancel(actor,payload){const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service.cancel(actor,payload);}finally{release(ctx);}}});}
  function bindGoodsService(service){if(![6,7].includes(schemaVersion)||!service||['options','preview','read','readRequest','create','approve','finalize'].some(n=>typeof service[n]!=='function'))fail();const bound={};for(const name of ['options','preview','read','readRequest','create','approve','finalize'])bound[name]=async(actor,...args)=>{const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service[name](actor,...args);}finally{release(ctx);}};return Object.freeze(bound);}
  function bindFinanceService(service){if(schemaVersion!==7||!service||['create','options','list'].some(n=>typeof service[n]!=='function'))fail();const bound={};for(const name of ['create','options','list'])bound[name]=async(actor,...args)=>{const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service[name](actor,...args);}finally{release(ctx);}};return Object.freeze(bound);}
  function bindWarehouseService(service){if(schemaVersion!==7||!service||['list','read','transition','resolve'].some(n=>typeof service[n]!=='function'))fail();const bound={};for(const name of ['list','read','transition','resolve'])bound[name]=async(actor,...args)=>{const ctx=storage.getStore();try{if(!active(ctx)||ctx.entry.userId!==actor)fail();return await service[name](actor,...args);}finally{release(ctx);}};return Object.freeze(bound);}
  const api=Object.freeze({login,bind,authenticateNormal,authorize,me,verifySession,bindService,bindReadService,bindSaleService,bindWorkflowService,bindDraftService,bindDispatchService,bindResolutionService,bindWorkflowReadService,bindFinalCancellationService,bindGoodsService,bindFinanceService,bindWarehouseService,logout,close});authOwners.set(api,{pool,verifySession,discountCeiling,salesReadScope,productMovementSalesScope,salesPolicy,pricingAuthority:pricing.authorize,approvalService,creditAuthority:credit,creditService,secure:sql===nativeSql&&passwordHasher===bcrypt});return api;
}
