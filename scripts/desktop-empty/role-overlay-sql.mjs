// SQL BODY only. Caller owns one SERIALIZABLE transaction and outcome handling.
import {compileEmptyV7PersonnelReadSql,EMPTY_V7_PERSONNEL_LOCAL_MASTER_SETTLED_SQL} from './empty-v7-personnel-sql.mjs';
import {EMPTY_V7_SETUP_TABLES} from './empty-v7-setup-core.mjs';
import {validateOverlayBaseline,validateOverlayReceipt,OVERLAY_CODE,OVERLAY_KEYS,OVERLAY_SOURCE,ROLE_OVERLAY_HASH_KEYS,id,uuid,need,digest} from './role-overlay-core.mjs';
const q=s=>"N'"+s.replaceAll("'","''")+"'",json=s=>`COALESCE((${s} FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')`,one=s=>`(${s} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)`;
const stringId=c=>`CONVERT(varchar(20),${c})`,ver=c=>`LOWER(CONVERT(varchar(18),CONVERT(binary(8),${c}),1))`,date=c=>`CONVERT(varchar(33),${c},126)`,H=c=>`LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),${c})),2))`;
const users=`SELECT ${stringId('id')} id,username,display_name displayName,${stringId('role_id')} roleId,is_active active,${date('created_at')} createdAt,${date('updated_at')} updatedAt,${stringId('created_by')} createdBy,${stringId('updated_by')} updatedBy,${ver('row_version')} version FROM dbo.users ORDER BY id`;
const roles=`SELECT ${stringId('id')} id,code,name,description,is_system_role [system],is_active active,${date('created_at')} createdAt,${date('updated_at')} updatedAt,${ver('row_version')} version FROM dbo.roles ORDER BY id`;
const permissions=`SELECT ${stringId('id')} id,${stringId('role_id')} roleId,permission_key [key],can_view [view],can_create [create],can_update [update],can_delete [delete],can_approve approve,${date('created_at')} createdAt,${date('updated_at')} updatedAt,${ver('row_version')} version FROM dbo.permissions ORDER BY id`;
const policy=`SELECT ${stringId('id')} id,setting_group [group],setting_key [key],setting_value value,value_type valueType,is_active active,${date('created_at')} createdAt,${date('updated_at')} updatedAt,${stringId('created_by')} createdBy,${stringId('updated_by')} updatedBy,${ver('row_version')} version FROM dbo.system_settings WHERE setting_group=N'desktop-sales' AND setting_key=N'individualPolicyV1'`;
// Audit bodies stay inside SQL's digest. Only bounded count/id/hash are returned.
const auditRows=where=>`SELECT id,actor_user_id,action,entity_type,entity_id,before_json,after_json,reason,source,ip_address,device_id,created_at FROM dbo.audit_logs ${where} ORDER BY id`;
function publicSql(boundary){need(boundary===null||id(boundary));return {users:json(users),roles:json(roles),permissions:json(permissions),policy:one(policy),audit:one(`SELECT (SELECT COUNT(*) FROM dbo.audit_logs) [count],${stringId('(SELECT MAX(id) FROM dbo.audit_logs)')} maxId,${H(json(auditRows('')))} sha256,${H(json(auditRows(`WHERE id<=${boundary??'0'}`)))} prefixSha256`)};}
const compiled=(sql,extra={})=>Object.freeze({version:1,sql,sqlSha256:digest(sql),parameters:compileEmptyV7PersonnelReadSql().parameters,bindings:Object.freeze({}),executionAuthorized:false,commitControlledByCaller:true,...extra});
export function compileRoleOverlayRead({auditBoundary=null}={}){const p=publicSql(auditBoundary);return compiled(compileEmptyV7PersonnelReadSql().sql+'\nSELECT '+Object.entries(p).map(([k,v])=>v+' '+k+'Json').join(',')+';',{fieldNames:['usersJson','rolesJson','permissionsJson','policyJson','auditJson'],auditBoundary});}
const guard=(predicate,code)=>`IF ${predicate} THROW 51996,'${code}',1;`;
const equal=(left,right)=>`CONVERT(varbinary(max),${left})=CONVERT(varbinary(max),${right})`;
function baselineGuard(observation,auditBoundary=null){const p=publicSql(auditBoundary);return ROLE_OVERLAY_HASH_KEYS.map(k=>guard(`@read_${k}<>0x${observation.frozen[k]}`,'OVERLAY_BASELINE_HASH')).join('\n')+'\n'+Object.entries(p).map(([k,expr])=>guard(`CASE WHEN ${equal(expr,q(JSON.stringify(observation.public[k])))} THEN 1 ELSE 0 END<>1`,'OVERLAY_PUBLIC_BASELINE')).join('\n');}
const lock=`DECLARE @overlayLock int;EXEC @overlayLock=sys.sp_getapplock @Resource=N'melisa-db9-role-overlay-v1',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=0;${guard('@overlayLock<0','OVERLAY_LOCK')}
${guard('EXISTS(SELECT 1 FROM sys.triggers WHERE parent_id IN(SELECT object_id FROM sys.tables WHERE is_ms_shipped=0) AND is_disabled=0)','OVERLAY_TRIGGER')}
DECLARE @lockedOverlayRows bigint;${EMPTY_V7_SETUP_TABLES.map(n=>`SELECT @lockedOverlayRows=COUNT_BIG(*) FROM dbo.[${n}] WITH(TABLOCKX,HOLDLOCK);`).join('\n')}`;
// No hard-coded original invoice count; no requirement to consume historical
// unused approvals. Their exact before-image hashes are retained unchanged.
const quiescent=guard("EXISTS(SELECT 1 FROM dbo.desktop_sale_workflows WHERE state COLLATE Latin1_General_100_BIN2 NOT IN(N'COMPLETED',N'CANCELLED'))",'OVERLAY_OPEN_WORKFLOW')+'\n'+guard("EXISTS(SELECT 1 FROM dbo.desktop_sale_workflow_requests WHERE result_json IS NULL OR ISJSON(result_json)<>1 OR ISNULL(JSON_VALUE(result_json,'$.state'),N'') COLLATE Latin1_General_100_BIN2<>N'COMMITTED') OR EXISTS(SELECT 1 FROM dbo.desktop_finance_requests WHERE ISNULL(state,N'') COLLATE Latin1_General_100_BIN2<>N'committed' OR response_json IS NULL OR ISJSON(response_json)<>1 OR ISNULL(JSON_VALUE(response_json,'$.state'),N'') COLLATE Latin1_General_100_BIN2<>N'COMMITTED') OR EXISTS(SELECT 1 FROM dbo.desktop_goods_requests WHERE ISNULL(state,N'') COLLATE Latin1_General_100_BIN2<>N'committed' OR response_json IS NULL OR ISJSON(response_json)<>1 OR ISNULL(JSON_VALUE(response_json,'$.state'),N'') COLLATE Latin1_General_100_BIN2<>N'COMMITTED')",'OVERLAY_UNRESOLVED_WRITE')+'\n'+EMPTY_V7_PERSONNEL_LOCAL_MASTER_SETTLED_SQL;
const rowVersion=(r,col='row_version')=>`${col}=0x${r.version.slice(2)}`;
const oneUpdated=()=>guard('@@ROWCOUNT<>1','OVERLAY_CAS');
function event(operationId,kind,before,newRole){return `DECLARE @overlayAudit TABLE(id bigint);INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,before_json,after_json,reason,source) OUTPUT inserted.id INTO @overlayAudit VALUES(1,N'role.overlay.${kind}',N'user',11,${q(JSON.stringify({baselineDigest:digest(before),bossRoleId:before.public.users.find(x=>x.id==='11').roleId,policySha256:digest(before.public.policy.value)}))},N'{"operationId":"${operationId}","bossRoleId":"'+CONVERT(nvarchar(20),${newRole})+N'"}',N'operation:${operationId}',N'${OVERLAY_SOURCE}');${oneUpdated()}SELECT ${stringId('id')} auditId FROM @overlayAudit;`;}
export function compileRoleOverlayMutation({mode,operationId,before,receipt=null}={}){
 need(['trial-rollback','apply','compensate'].includes(mode)&&uuid(operationId));if(mode==='compensate'){validateOverlayReceipt(receipt);need(operationId!==receipt.operationId);}else{validateOverlayBaseline(before);need(receipt===null);}const expected=mode==='compensate'?receipt.after:before;
 const prefix=compileEmptyV7PersonnelReadSql().sql+'\n'+lock+'\n'+quiescent+'\n'+baselineGuard(expected,mode==='compensate'?receipt.before.public.audit.maxId:null)+'\n'+guard(`EXISTS(SELECT 1 FROM dbo.audit_logs WHERE source=N'${OVERLAY_SOURCE}' AND reason=N'operation:${operationId}')`,'OVERLAY_OPERATION_EXISTS');
 if(mode==='compensate'){
  const b=receipt.before.public,a=receipt.after.public,nr=receipt.inserted.roleId,boss=a.users.find(x=>x.id==='11'),managerRole=a.roles.find(x=>x.id==='9');
  const sql=prefix+`\n${guard(`(SELECT COUNT(*) FROM dbo.users WHERE role_id=${nr})<>1 OR NOT EXISTS(SELECT 1 FROM dbo.users WHERE id=11 AND role_id=${nr})`,'OVERLAY_ROLE_REFERENCED')}
UPDATE dbo.users SET role_id=9,updated_at=SYSUTCDATETIME(),updated_by=1 WHERE id=11 AND role_id=${nr} AND ${rowVersion(boss)};${oneUpdated()}
UPDATE dbo.roles SET updated_at=SYSUTCDATETIME() WHERE id=9 AND ${rowVersion(managerRole)};${oneUpdated()}
UPDATE dbo.system_settings SET setting_value=${q(b.policy.value)},updated_at=SYSUTCDATETIME(),updated_by=1 WHERE id=${a.policy.id} AND ${rowVersion(a.policy)};${oneUpdated()}
DELETE FROM dbo.permissions WHERE id IN(${receipt.inserted.permissionIds.join(',')});${guard('@@ROWCOUNT<>7','OVERLAY_DELETE_COUNT')}
DELETE FROM dbo.roles WHERE id=${nr} AND ${rowVersion(a.roles.find(x=>x.id===nr))};${oneUpdated()}
${event(operationId,'compensate',expected,'9')}`;
  return compiled(sql,{mode,operationId,baselineDigest:digest(expected),readAuditBoundary:expected.public.audit.maxId,resultSets:['frozen-before','audit-id']});
 }
 const b=before.public,manager=b.roles.find(x=>x.id==='9'),boss=b.users.find(x=>x.id==='11');
 const sql=prefix+`\n${guard(`EXISTS(SELECT 1 FROM dbo.roles WHERE code=N'${OVERLAY_CODE}') OR EXISTS(SELECT 1 FROM dbo.permissions WHERE role_id=9 AND permission_key=N'sales.cancel')`,'OVERLAY_NOT_ABSENT')}
DECLARE @overlayRole TABLE(id bigint);INSERT dbo.roles(code,name,description,is_system_role,is_active) OUTPUT inserted.id INTO @overlayRole VALUES(N'${OVERLAY_CODE}',N'DB9 boss role overlay',N'Finite six-key successor; no implicit admin defaults',0,1);${oneUpdated()}DECLARE @newOverlayRole bigint=(SELECT id FROM @overlayRole);
DECLARE @overlayPermissions TABLE(id bigint);INSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve) OUTPUT inserted.id INTO @overlayPermissions VALUES(9,N'sales.cancel',1,0,0,0,0),${OVERLAY_KEYS.map(k=>`(@newOverlayRole,N'${k}',1,${k.startsWith('finance.')?1:0},0,0,0)`).join(',')};${guard('@@ROWCOUNT<>7','OVERLAY_PERMISSION_COUNT')}
UPDATE dbo.roles SET updated_at=SYSUTCDATETIME() WHERE id=9 AND ${rowVersion(manager)};${oneUpdated()}
UPDATE dbo.users SET role_id=@newOverlayRole,updated_at=SYSUTCDATETIME(),updated_by=1 WHERE id=11 AND role_id=9 AND ${rowVersion(boss)};${oneUpdated()}
DECLARE @overlayPolicy nvarchar(max)=REPLACE(${q(b.policy.value)},N'"actorId":"11","roleId":"9","roleCode":"desktop_db9_approval_test"',N'"actorId":"11","roleId":"'+CONVERT(nvarchar(20),@newOverlayRole)+N'","roleCode":"${OVERLAY_CODE}"');
${guard(`@overlayPolicy IS NULL OR ${equal('@overlayPolicy',q(b.policy.value))}`,'OVERLAY_POLICY_NO_DELTA')}
UPDATE dbo.system_settings SET setting_value=@overlayPolicy,updated_at=SYSUTCDATETIME(),updated_by=1 WHERE id=${b.policy.id} AND ${rowVersion(b.policy)};${oneUpdated()}
${event(operationId,'apply',before,'@newOverlayRole')}
SELECT ${stringId('@newOverlayRole')} roleId,${json('SELECT '+stringId('id')+' id FROM @overlayPermissions ORDER BY id')} permissionIdsJson;`;
 return compiled(sql,{mode,operationId,baselineDigest:digest(before),readAuditBoundary:before.public.audit.maxId,resultSets:['frozen-before','audit-id','inserted-role-permissions']});
}
