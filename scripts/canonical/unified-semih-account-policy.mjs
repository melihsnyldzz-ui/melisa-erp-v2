import {createHash} from 'node:crypto';
import {applyRolePermissionDefaults,expandPermissions} from '../../apps/api/src/services/permissionCatalog.js';
export const UNIFIED_SEMIH=Object.freeze({server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01',sourceDatabase:'MELISA_ERP_CLEAN_TEST_20261022',sourceUserId:10018,sourceRoleId:28,username:'unified-semih-test',displayName:'Semih TEST',roleCode:'unified_test_semih',permissionRows:36,permissionHash:'d49893294b3feffa73cb80fdf32ef81e9e4a205db98de3d4becdfe00170bc1d7',approvalTurn:'01a17e57-00cc-75e1-888f-14471d4d27d5'});
export const permissionHash=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
export function assertUnifiedSemihAdmission({identity,rows,approvalTurn,ownerSid,expectedOwnerSid}) {
 const p=UNIFIED_SEMIH;
 if(identity?.server!==p.server||identity?.database!==p.database||identity?.admin!==1||approvalTurn!==p.approvalTurn||!/^S-1-5-21-(?:\d+-){3}\d+$/.test(ownerSid??'')||ownerSid!==expectedOwnerSid)throw Error('UNIFIED_SEMIH_TARGET_OR_APPROVAL');
 if(!Array.isArray(rows)||rows.length!==p.permissionRows||permissionHash(rows)!==p.permissionHash||new Set(rows.map(r=>r.permission_key)).size!==rows.length)throw Error('UNIFIED_SEMIH_PERMISSION_DRIFT');
 const active=rows.filter(r=>r.can_view||r.can_create||r.can_update||r.can_approve);
 const old=applyRolePermissionDefaults(expandPermissions(active),'clean_test_administrator');
 const next=applyRolePermissionDefaults(expandPermissions(active),p.roleCode);
 if(JSON.stringify(old)!==JSON.stringify(next))throw Error('UNIFIED_SEMIH_EFFECTIVE_PERMISSION_DRIFT');
 return {permissionRows:rows.length,permissionHash:p.permissionHash,effectivePermissions:next};
}
