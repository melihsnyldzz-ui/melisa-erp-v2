// Admission for existing user/personnel services, never a general write bypass.
import {getCleanContext,assertRegisteredCleanContext,isCleanAdministrator} from './cleanSyntheticContext.mjs';

export const CLEAN_PERSONNEL_ROLES=Object.freeze({20:'clean_test_sales',23:'clean_test_warehouse',25:'clean_test_finance',26:'clean_test_counter'});
const operations=new Set(['user_create','user_update','user_password','employee_create','employee_update']);
const fail=(code,message,statusCode=403)=>{throw Object.assign(new Error(message),{code,statusCode});};
export function cleanPersonnelRequestAllowed(request,environment=process.env){
  if(environment.API_PORT!=='4194'||environment.MELISA_CLEAN_TEST!=='20261022')return false;
  return request?.method==='POST'&&/^\/api\/(?:auth-admin\/users|personnel\/employees)$/.test(request.path)
    ||request?.method==='PATCH'&&/^\/api\/(?:auth-admin\/users\/[1-9]\d*(?:\/password)?|personnel\/employees\/[1-9]\d*)$/.test(request.path);
}
export function assertCleanPersonnelWrite(actor,operation){
  if(!getCleanContext())return false;
  assertRegisteredCleanContext();
  if(process.env.API_PORT!=='4194'||!operations.has(operation)||!isCleanAdministrator(actor)||!actor.permissions.includes('settings.manage'))
    fail('CLEAN_PERSONNEL_FORBIDDEN','Personel yönetimi için yetkiniz bulunmuyor.');
  return true;
}
export async function cleanPersonnelOptions(pool){
  if(!getCleanContext())return null;
  assertRegisteredCleanContext();
  const result=await pool.request().query(`
    IF OBJECT_ID(N'dbo.clean_personnel_members',N'U') IS NULL OR OBJECT_ID(N'dbo.usp_clean_personnel_ready',N'P') IS NULL SELECT CONVERT(bit,0) ready;
    ELSE EXEC(N'EXEC dbo.usp_clean_personnel_ready; SELECT CONVERT(bit,1) ready; SELECT user_id,employee_id FROM dbo.clean_personnel_members;');
  `);
  return {ready:result.recordsets?.[0]?.[0]?.ready===true,roleIds:Object.keys(CLEAN_PERSONNEL_ROLES).map(Number),
    userIds:(result.recordsets?.[1]??[]).map(r=>Number(r.user_id)),employeeIds:(result.recordsets?.[1]??[]).filter(r=>r.employee_id!==null).map(r=>Number(r.employee_id)),
    existingAccountRequired:true};
}
export async function bindCleanPersonnelWrite(transaction,driver,actor,operation,payload={},targetId=null){
  if(!assertCleanPersonnelWrite(actor,operation))return async()=>{};
  if(!transaction||!driver||targetId!==null&&(!Number.isSafeInteger(targetId)||targetId<1))fail('CLEAN_PERSONNEL_INPUT_INVALID','Personel kaydı doğrulanamadı.',400);
  // Passwords and hashes stay in bcrypt/the normal core, not intent or audit.
  let metadata;
  if(operation==='user_create')metadata={username:payload.username,displayName:payload.displayName,roleId:payload.roleId,isActive:true};
  else if(operation==='user_update')metadata=Object.fromEntries(['username','displayName','roleId','isActive'].filter(k=>payload[k]!==undefined).map(k=>[k,payload[k]]));
  else if(operation==='user_password')metadata={passwordConfigured:true};
  else {
    if(payload.loginUsername||payload.loginPassword||!Number.isSafeInteger(payload.userId)||payload.userId<1)
      fail('CLEAN_PERSONNEL_ACCOUNT_REQUIRED','Önce Kullanıcı Yönetimi ekranında kişisel hesabı oluşturun; personel kartında bu hesabı seçin.',400);
    metadata=Object.fromEntries(['employeeCode','fullName','phone','department','jobTitle','userId','canTerminalSale','canChangeSalePrice','maxSaleDiscountPercent','isActive'].map(k=>[k,payload[k]]));
  }
  if(metadata.roleId!==undefined&&!Object.hasOwn(CLEAN_PERSONNEL_ROLES,metadata.roleId))fail('CLEAN_PERSONNEL_ROLE_FORBIDDEN','Bu adımda yalnız izin verilen personel görev rolü seçilebilir.');
  let row;
  try {row=(await new driver.Request(transaction).input('actor_id',driver.BigInt,Number(actor.id))
    .input('operation',driver.NVarChar(24),operation).input('target_id',driver.BigInt,targetId)
    .input('payload_json',driver.NVarChar(driver.MAX),JSON.stringify(metadata)).execute('dbo.usp_clean_personnel_bind')).recordset?.[0];}
  catch(error){
    if([51972,51973,51974].includes(error.number))fail(error.number===51973?'CLEAN_PERSONNEL_PROTECTED_RECORD':'CLEAN_PERSONNEL_FORBIDDEN','Bu hesap veya personel kaydı bu işlem kapsamında değiştirilemez.');
    throw error;
  }
  if(row?.accepted!==true||row.operation!==operation||Number(row.actorId)!==Number(actor.id))fail('CLEAN_PERSONNEL_ADMISSION_INVALID','Personel yönetimi kapsamı doğrulanamadı.');
  return async()=>{
    const result=(await new driver.Request(transaction).execute('dbo.usp_clean_personnel_finish')).recordset?.[0];
    if(result?.verified!==true||result.operation!==operation||Number(result.actorId)!==Number(actor.id))fail('CLEAN_PERSONNEL_RESULT_INVALID','Personel yönetimi sonucu doğrulanamadı.');
  };
}
