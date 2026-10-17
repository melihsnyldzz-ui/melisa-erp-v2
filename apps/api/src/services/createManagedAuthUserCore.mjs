// Transaction ownership and target authorization remain with the caller. This
// shared core is used by normal user management and the trusted local installer;
// it creates one user and never resets, adopts, or upgrades an existing user.
const fail=(code,message,statusCode=400)=>{throw Object.assign(new Error(message),{code,statusCode});};
export function normalizeManagedAuthUser(payload={}) {
 const username=typeof payload.username==='string'?payload.username.trim():'';
 if(!/^[a-zA-Z0-9._-]{3,80}$/.test(username))fail('AUTH_ADMIN_USERNAME_INVALID','Username must be 3-80 characters and use letters, numbers, dot, dash or underscore');
 const displayName=typeof payload.displayName==='string'?payload.displayName.trim().slice(0,150):'';
 if(!displayName)fail('AUTH_ADMIN_DISPLAY_NAME_REQUIRED','Display name is required');
 const password=typeof payload.password==='string'?payload.password:'';
 if(password.length<8||password.length>128)fail('AUTH_ADMIN_PASSWORD_INVALID','Password must be between 8 and 128 characters');
 const roleId=Number(payload.roleId);
 if(!Number.isInteger(roleId)||roleId<1)fail('AUTH_ADMIN_ROLE_REQUIRED','An active role must be selected');
 return {username,displayName,password,roleId};
}
export function createManagedAuthUserCore({sql,request,hashPassword,writeAudit}) {
 if(!sql||typeof request!=='function'||typeof hashPassword!=='function'||typeof writeAudit!=='function')throw Error('AUTH_ADMIN_CORE_DEPENDENCIES');
 return async function createUser(transaction,payload={},actor=null) {
  if(!transaction)throw Error('AUTH_ADMIN_CORE_TRANSACTION');
  const {username,displayName,password,roleId}=normalizeManagedAuthUser(payload);
  const passwordHash=await hashPassword(password,12);
  const roleResult=await request(transaction).input('roleId',sql.BigInt,roleId).query('SELECT TOP (1) id, code, name FROM dbo.roles WHERE id = @roleId AND is_active = 1;');
  const role=roleResult.recordset?.[0];
  if(!role)fail('AUTH_ADMIN_ROLE_NOT_FOUND','Active role not found',404);
  const inserted=await request(transaction)
   .input('username',sql.NVarChar(80),username).input('passwordHash',sql.NVarChar(255),passwordHash)
   .input('displayName',sql.NVarChar(150),displayName).input('roleId',sql.BigInt,roleId)
   .input('actorId',sql.BigInt,actor?.id?Number(actor.id):null)
   .query(`INSERT INTO dbo.users (username, password_hash, display_name, role_id, is_active, created_by, updated_by)
    OUTPUT INSERTED.id VALUES (@username, @passwordHash, @displayName, @roleId, 1, @actorId, @actorId);`);
  const userId=Number(inserted.recordset?.[0]?.id);
  if(!Number.isSafeInteger(userId)||userId<1)throw Error('AUTH_ADMIN_CORE_INSERT_RESULT');
  await writeAudit(request(transaction),{action:'user_created',entityType:'user',entityId:userId,
   afterSnapshot:{username,displayName,roleId,roleCode:role.code,isActive:true,passwordConfigured:true},actor});
  return {id:userId,username,displayName,roleId,roleCode:role.code,isActive:true};
 };
}
