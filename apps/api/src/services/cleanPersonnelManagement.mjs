// Admission for existing user/personnel services, never a general write bypass.
import {getCleanContext,assertRegisteredCleanContext,isCleanAdministrator,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';

export const CLEAN_PERSONNEL_ROLES=Object.freeze({20:'clean_test_sales',23:'clean_test_warehouse',25:'clean_test_finance',26:'clean_test_counter'});
// Separate application jobs in the existing single-role model. These rows are
// installed only by the personal-work SQL patch, not by account creation.
const staff={view:['product.view','customer.view','sales.view','goods.view'],create:['sales.create','goods.create'],approve:['sales.finalize']};
export const CLEAN_PERSONNEL_WORK_ROLES=Object.freeze({
  30:Object.freeze({code:'clean_test_personnel',name:'Personel — satış, mal kabul ve sayım',view:Object.freeze(staff.view),create:Object.freeze(staff.create),approve:Object.freeze(staff.approve)}),
  31:Object.freeze({code:'clean_test_personnel_manager',name:'Uygulama yöneticisi — personel ve günlük işler',view:Object.freeze([...staff.view,'purchase.view','supplier.view','finance.view','settings.view']),create:Object.freeze([...staff.create,'purchase.create','finance.collection','finance.payment','finance.collection.cancel','finance.payment.cancel','settings.manage']),approve:Object.freeze([...staff.approve,'goods.approve','goods.reject','purchase.finalize','stock.adjust','purchase.cancel'])}),
  32:Object.freeze({code:'clean_test_personnel_finance',name:'Muhasebe — tahsilat, ödeme ve kasa',view:Object.freeze(['product.view','customer.view','sales.view','purchase.view','supplier.view','finance.view']),create:Object.freeze(['finance.collection','finance.payment','finance.collection.cancel','finance.payment.cancel']),approve:Object.freeze([])}),
});
const workRoles=Object.freeze({sale:[30,31],packing:[30,31],inbound:[30,31],daily:[30,31],finance:[31,32],cash:[31,32],management:[31]});
const workOperations=Object.freeze({sale_draft:'sale',sale_finalize:'sale',count_create:'inbound',count_update:'inbound',count_submit:'inbound',count_cancel:'inbound',goods_accept:'management',goods_reject:'management',purchase_draft:'management',purchase_finalize:'management',stock_count_draft:'daily',stock_count_approve:'management',stock_count_reject:'management',stock_count_cancel:'management',purchase_return_draft:'management',purchase_return_approve:'management',purchase_return_reject:'management',purchase_return_cancel:'management',collection_create:'finance',collection_cancel:'finance',payment:'finance',payment_cancel:'finance',cash_open:'cash',cash_close:'cash',cash_transfer:'cash',cash_expense:'cash'});
// Routing hint only. Every read/mutation also proves the live member/employee
// link in the same native transaction; a JWT role alone never grants a write.
export function isCleanPersonalWorkCandidate(actor,kind){
  const role=Number(actor?.role?.id),definition=CLEAN_PERSONNEL_WORK_ROLES[role];
  return Number.isSafeInteger(Number(actor?.id))&&Number(actor.id)>0&&!['15','16','17','18','19','20','21','22','23','10018'].includes(String(actor.id))&&actor.isActive!==false&&actor.isAdmin!==true&&actor.testAdminSession!==true&&typeof actor.username==='string'&&actor.username.length>0&&Array.isArray(actor.permissions)&&(kind!=='packing'||actor.permissions.includes('sales.view'))&&definition?.code===actor.role?.code&&(workRoles[kind]??workRoles[workOperations[kind]]??[]).includes(role);
}
export async function proveCleanPersonalWorkActor(transaction,driver,actor,kind){
  if(!isCleanPersonalWorkCandidate(actor,kind)){if(kind==='packing')fail('CLEAN_PERSONNEL_FORBIDDEN','Toplama göreviniz doğrulanamadı.');return null;}
  assertRegisteredCleanContext();if(process.env.API_PORT!=='4194')fail('CLEAN_PERSONNEL_FORBIDDEN','Bu personel işlemi için yetkiniz yok.');
  let row;try{row=(await new driver.Request(transaction).input('actor_id',driver.BigInt,Number(actor.id)).execute('dbo.usp_clean_personnel_work_actor')).recordset?.[0];}
  catch(error){if(error.number===51975)fail('CLEAN_PERSONNEL_FORBIDDEN','Kişisel hesabınızın etkin personel bağlantısı doğrulanamadı.');throw error;}
  if(row?.accepted!==true||row.environmentId?.toLowerCase()!==CLEAN_ENVIRONMENT_ID||String(row.actorId)!==String(actor.id)||row.username!==actor.username||String(row.roleId)!==String(actor.role.id)||row.roleCode!==actor.role.code||!Number.isSafeInteger(Number(row.employeeId))||Number(row.employeeId)<1||(kind==='sale'&&row.canTerminalSale!==true)||(kind==='packing'&&row.canTerminalPacking!==true))
    fail('CLEAN_PERSONNEL_FORBIDDEN','Kişisel hesabınızın etkin personel bağlantısı doğrulanamadı.');
  return Object.freeze({actorId:String(row.actorId),employeeId:String(row.employeeId),roleId:Number(row.roleId),manager:Number(row.roleId)===31,...(kind==='packing'?{canTerminalPacking:true}:{})});
}
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
  if(process.env.API_PORT!=='4194'||!operations.has(operation)||(!isCleanAdministrator(actor)&&!isCleanPersonalWorkCandidate(actor,'management'))||!actor.permissions.includes('settings.manage'))
    fail('CLEAN_PERSONNEL_FORBIDDEN','Personel yönetimi için yetkiniz bulunmuyor.');
  return true;
}
export async function cleanPersonnelOptions(pool){
  if(!getCleanContext())return null;
  assertRegisteredCleanContext();
  const result=await pool.request().query(`
    IF OBJECT_ID(N'dbo.clean_personnel_members',N'U') IS NULL OR OBJECT_ID(N'dbo.usp_clean_personnel_ready',N'P') IS NULL SELECT CONVERT(bit,0) ready;
    ELSE EXEC(N'EXEC dbo.usp_clean_personnel_ready; SELECT CONVERT(bit,1) ready; SELECT user_id,employee_id FROM dbo.clean_personnel_members;');
    IF OBJECT_ID(N'dbo.usp_clean_personnel_work_ready',N'P') IS NOT NULL EXEC(N'EXEC dbo.usp_clean_personnel_work_ready; SELECT CONVERT(bit,1) personalWorkReady;');
    IF COL_LENGTH(N'dbo.employees',N'can_terminal_packing') IS NULL OR OBJECT_ID(N'dbo.usp_clean_personnel_packing_ready',N'P') IS NULL SELECT CONVERT(bit,0) packingTaskSupported;
    ELSE EXEC(N'EXEC dbo.usp_clean_personnel_packing_ready; SELECT CONVERT(bit,1) packingTaskSupported;');
  `);
  return {ready:result.recordsets?.[0]?.[0]?.ready===true,roleIds:[...Object.keys(CLEAN_PERSONNEL_ROLES),...(result.recordsets?.[2]?.[0]?.personalWorkReady===true?Object.keys(CLEAN_PERSONNEL_WORK_ROLES):[])].map(Number),
    userIds:(result.recordsets?.[1]??[]).map(r=>Number(r.user_id)),employeeIds:(result.recordsets?.[1]??[]).filter(r=>r.employee_id!==null).map(r=>Number(r.employee_id)),
    existingAccountRequired:true,packingTaskSupported:result.recordsets?.[2]?.[0]?.personalWorkReady===true&&result.recordsets?.[3]?.[0]?.packingTaskSupported===true};
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
    if(Object.hasOwn(payload,'canTerminalPacking')){
      if(typeof payload.canTerminalPacking!=='boolean')fail('CLEAN_PERSONNEL_PACKING_INPUT','Toplama görevi açık veya kapalı olmalıdır.',400);
      metadata.canTerminalPacking=payload.canTerminalPacking;
    }
  }
  if(metadata.roleId!==undefined&&!Object.hasOwn(CLEAN_PERSONNEL_ROLES,metadata.roleId)&&!Object.hasOwn(CLEAN_PERSONNEL_WORK_ROLES,metadata.roleId))fail('CLEAN_PERSONNEL_ROLE_FORBIDDEN','Bu adımda yalnız izin verilen personel görev rolü seçilebilir.');
  let row;
  // Native admission proves the complete layered store seal before binding.
  // Give only this proof the same finite budget as startup, never the writes,
  // finish, pool defaults or subsequent normal requests.
  try {row=(await new driver.Request(transaction,{requestTimeout:30000}).input('actor_id',driver.BigInt,Number(actor.id))
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
