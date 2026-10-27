import {createHash} from 'node:crypto';
import {expandPermissions,applyRolePermissionDefaults} from './permissionCatalog.js';
export const BUSINESS_SESSION=Object.freeze({id:'ERP-5244-REALDATA-20261027',database:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV',login:'melisa_sirket_sales_test_20260929_01',userId:17,username:'unified-semih-test',roleId:17,roleCode:'unified_test_semih',permissionRows:36,permissionHash:'d49893294b3feffa73cb80fdf32ef81e9e4a205db98de3d4becdfe00170bc1d7',sessionPath:'C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027\\grants.json'});
let registered=null;
const environments=new WeakMap();
const fail=()=>{throw Object.assign(new Error('Business TEST session target rejected'),{code:'AUTH_BUSINESS_TEST_TARGET_INVALID',statusCode:503});};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function validateBusinessSessionProfile(profile){
 if(!profile||Object.getPrototypeOf(profile)!==Object.prototype||Object.keys(profile).sort().join(',')!=='actualT1,externalOperations,id,permissionHash,sessionPath,userId'||profile.id!==BUSINESS_SESSION.id||profile.userId!==17||profile.permissionHash!==BUSINESS_SESSION.permissionHash||profile.sessionPath!==BUSINESS_SESSION.sessionPath||profile.actualT1!==false||profile.externalOperations!==false)fail();
 return profile;
}
function assertEnvironment(e){
 if(e.MELISA_CANONICAL_TEST!=='true'||e.SQL_DATABASE!==BUSINESS_SESSION.database||e.SQL_SERVER!=='127.0.0.1'||String(e.SQL_PORT)!=='1433'||e.SQL_USER!==BUSINESS_SESSION.login||e.SQL_READ_ONLY!=='false'||e.SQL_TRUSTED_CONNECTION!=='false'||String(e.API_PORT)!=='4144'||e.MELISA_CLEAN_TEST||e.MELISA_ISOLATED_OPERATION_COPY||e.MELISA_TEST_PROTECTED_SESSION_PATH!==BUSINESS_SESSION.sessionPath)fail();
}
function assertTarget({profile,identity,mode,port,writes,environment}){
 validateBusinessSessionProfile(profile);assertEnvironment(environment);
 if(mode!=='erp'||port!==4144||writes!==true||identity?.databaseName!==BUSINESS_SESSION.database||identity.serverName?.toLowerCase()!=='semih\\melisadev'||identity.loginName!==BUSINESS_SESSION.login||identity.databaseUser!==BUSINESS_SESSION.login||identity.sysadmin!==0||identity.databaseControl!==0||identity.liveDatabaseAccess!==0||identity.canInsertSales!==1)fail();
}
export function validateBusinessSessionWitness({profile,identity,mode,port,writes,environment,user,rows}){
 assertTarget({profile,identity,mode,port,writes,environment});
 if(Number(user?.id)!==17||user.username!==BUSINESS_SESSION.username||Number(user.roleId)!==17||user.roleCode!==BUSINESS_SESSION.roleCode||user.userActive!==true||user.roleActive!==true||user.systemRole!==false||!Array.isArray(rows)||rows.length!==36||digest(rows)!==BUSINESS_SESSION.permissionHash)fail();
 const permissions=applyRolePermissionDefaults(expandPermissions(rows.filter(r=>r.can_view||r.can_create||r.can_update||r.can_approve)),BUSINESS_SESSION.roleCode);
 return Object.freeze({environment:'CANONICAL_BUSINESS_TEST',database:BUSINESS_SESSION.database,server:BUSINESS_SESSION.server,userId:17,username:BUSINESS_SESSION.username,roleId:17,roleCode:BUSINESS_SESSION.roleCode,permissions:Object.freeze(permissions),sessionPath:BUSINESS_SESSION.sessionPath,actualT1:false,externalOperations:false});
}
export async function configureCanonicalBusinessSession({config,identity,mode,port,writes,pool,environment=process.env}){
 if(mode==='native')return null;
 if(config.businessWorkface===undefined)return null;
 if(registered)fail();assertTarget({profile:config.businessWorkface,identity,mode,port,writes,environment});
 // Fresh SQL proof uses the already checked canonical service pool, never an
 // administrator connection, JWT claim, client identity or copied CLEAN row.
 const user=(await pool.request().query("SELECT u.id,u.username,u.is_active userActive,r.id roleId,r.code roleCode,r.is_active roleActive,r.is_system_role systemRole FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=17 AND u.username=N'unified-semih-test';")).recordset;
 const rows=(await pool.request().query('SELECT permission_key,can_view,can_create,can_update,can_delete,can_approve FROM dbo.permissions WHERE role_id=17 ORDER BY permission_key;')).recordset;
 if(user.length!==1)fail();
 registered=validateBusinessSessionWitness({profile:config.businessWorkface,identity,mode,port,writes,environment,user:user[0],rows});environments.set(registered,environment);return registered;
}
export function getCanonicalBusinessSession(){return registered;}
export function assertBusinessSessionPermissionRows(roleId,rows){
 if(!registered||Number(roleId)!==17)return;
 assertCanonicalBusinessSession(registered);
 if(!Array.isArray(rows)||rows.length!==36||digest(rows)!==BUSINESS_SESSION.permissionHash)throw Object.assign(new Error('Business TEST permissions changed'),{code:'AUTH_REFRESH_INVALID',statusCode:401});
}
export function assertCanonicalBusinessSession(context){if(!context||context!==registered||!environments.has(context))fail();assertEnvironment(environments.get(context));return context;}
export function businessSessionUserAllowed(user,context,fingerprint){
 try{assertCanonicalBusinessSession(context);}catch{return false;}
 return !!(Number(user?.id)===17&&user.username===BUSINESS_SESSION.username&&Number(user.role?.id)===17&&user.role.code===BUSINESS_SESSION.roleCode&&user.isActive!==false&&user.isAdmin!==true&&user.testAdminSession!==true&&Array.isArray(user.permissions)&&JSON.stringify([...user.permissions].sort())===JSON.stringify([...context.permissions].sort())&&/^[a-f0-9]{64}$/.test(fingerprint??''));
}
export function businessSessionFingerprintWitness(user,row){
 if(!registered)return undefined;assertCanonicalBusinessSession(registered);
 if(user.username!==BUSINESS_SESSION.username&&Number(user.id)!==17)return undefined;
 if(Number(user.id)!==17||user.username!==BUSINESS_SESSION.username||Number(user.role?.id)!==17||user.role.code!==BUSINESS_SESSION.roleCode||row.is_active!==true||row.role_is_active!==true||!Array.isArray(user.permissions)||JSON.stringify([...user.permissions].sort())!==JSON.stringify([...registered.permissions].sort())||!/^[0][x][a-fA-F0-9]{16}$/.test(row.user_version??'')||!/^[0][x][a-fA-F0-9]{16}$/.test(row.role_version??''))throw Object.assign(new Error('Business TEST identity changed'),{code:'AUTH_REFRESH_INVALID',statusCode:401});
 return [row.user_version,row.role_version];
}
