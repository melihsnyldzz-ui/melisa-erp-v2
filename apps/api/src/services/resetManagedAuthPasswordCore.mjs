// Caller owns authorization, transaction, commit and rollback. Normal admin
// keeps its existing write guard. Trusted local TEST setup can use this same
// operation after its separate exact-account/OS-owner admission.
export function createResetManagedAuthPasswordCore({sql,request,hashPassword,writeAudit,authorizeUser=async()=>{}}){
 if(!sql||[request,hashPassword,writeAudit,authorizeUser].some(f=>typeof f!=='function'))throw Error('AUTH_ADMIN_PASSWORD_CORE_DEPENDENCIES');
 return async(transaction,userId,payload={},actor=null)=>{
  const id=Number(userId),password=typeof payload.password==='string'?payload.password:'';
  if(!transaction||!Number.isSafeInteger(id)||id<1)throw Object.assign(Error('Invalid user'),{code:'AUTH_ADMIN_USER_ID_INVALID',statusCode:400});
  if(password.length<8||password.length>128)throw Object.assign(Error('Password length is invalid'),{code:'AUTH_ADMIN_PASSWORD_INVALID',statusCode:400});
  const user=(await request(transaction).input('userId',sql.BigInt,id).query('SELECT TOP (1) id,username,display_name,is_active,role_id,row_version FROM dbo.users WITH(UPDLOCK,HOLDLOCK) WHERE id=@userId;')).recordset?.[0];
  if(!user)throw Object.assign(Error('User not found'),{code:'AUTH_ADMIN_USER_NOT_FOUND',statusCode:404});
  await authorizeUser(user,transaction);
  const passwordHash=await hashPassword(password,12);
  const changed=await request(transaction).input('userId',sql.BigInt,id).input('passwordHash',sql.NVarChar(255),passwordHash).input('actorId',sql.BigInt,actor?.id?Number(actor.id):null)
   .query(`DECLARE @updated TABLE(row_version binary(8));
    UPDATE dbo.users SET password_hash=@passwordHash,updated_at=SYSUTCDATETIME(),updated_by=@actorId OUTPUT INSERTED.row_version INTO @updated WHERE id=@userId;
    UPDATE dbo.auth_refresh_tokens SET revoked_at=SYSUTCDATETIME() WHERE user_id=@userId AND revoked_at IS NULL;
    SELECT row_version FROM @updated;`);
  if(changed.recordset?.length!==1||!Buffer.isBuffer(changed.recordset[0].row_version)||changed.recordset[0].row_version.length!==8)throw Error('AUTH_ADMIN_PASSWORD_CORE_RESULT');
  await writeAudit(request(transaction),{action:'user_password_reset',entityType:'user',entityId:id,
   beforeSnapshot:{username:user.username,passwordConfigured:true},afterSnapshot:{username:user.username,passwordConfigured:true,sessionsRevoked:true},actor});
  return {id,username:user.username,passwordConfigured:true,sessionsRevoked:true,rowVersion:changed.recordset[0].row_version.toString('hex')};
 };
}
