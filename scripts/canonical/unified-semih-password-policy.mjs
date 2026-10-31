import {UNIFIED_SEMIH as p,assertUnifiedSemihAdmission} from './unified-semih-account-policy.mjs';
export function assertPersonalPasswordTarget({identity,intent,user,role,rows,ownerSid,expectedOwnerSid,expectedVersion}){
 if(intent?.server!==p.server||intent.database!==p.database||intent.approvalTurn!==p.approvalTurn||intent.userId!==17||intent.roleId!==17||intent.username!==p.username||intent.roleCode!==p.roleCode||intent.permissionHash!==p.permissionHash)throw Error('PERSONAL_PASSWORD_INTENT');
 if(Number(user?.id)!==17||user.username!==p.username||user.display_name!==p.displayName||Number(user.role_id)!==17||user.is_active!==true||role?.code!==p.roleCode||role.is_active!==true||role.is_system_role!==false)throw Error('PERSONAL_PASSWORD_ACCOUNT');
 if(!Buffer.isBuffer(user.row_version)||user.row_version.length!==8||expectedVersion!==undefined&&user.row_version.toString('hex')!==expectedVersion)throw Error('PERSONAL_PASSWORD_VERSION_CHANGED');
 assertUnifiedSemihAdmission({identity,rows,ownerSid,expectedOwnerSid,approvalTurn:p.approvalTurn});
 return {userId:17,roleId:17,version:user.row_version.toString('hex'),permissionHash:p.permissionHash};
}
