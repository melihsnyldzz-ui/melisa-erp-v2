// Non-executing fragments only. A reviewed transaction compiler must still
// bind the actual V6 snapshot, identity cleanup, full candidate comparison,
// separate rollback observation and conditional apply before using them.
import {DESKTOP_FINANCE_PROPOSAL_SQL,DESKTOP_FINANCE_PROPOSED_RIGHTS} from '../../apps/api/src/config/desktopFinanceSchemaProposal.mjs';
import {DESKTOP_FINANCE_V7_OPERATOR_PERMISSIONS} from '../../apps/api/src/config/desktopFinanceV7Policy.mjs';
const fail=()=>{throw Error('MASTER_V7_FRAGMENT_INVALID');};
const quote=s=>`N'${s.replaceAll("'","''")}'`;
export function compileDesktopFinanceV7MutationFragments({mode}={}){
 if(!['rollback','apply'].includes(mode)||arguments.length!==1||Object.keys(arguments[0]??{}).sort().join(',')!=='mode')fail();
 const permissions=DESKTOP_FINANCE_V7_OPERATOR_PERMISSIONS.slice(17);if(permissions.length!==2||permissions[0].key!=='finance.collection'||permissions[1].key!=='finance.payment')fail();
 const ids=[-30701,-30702],values=permissions.map((p,i)=>`(${mode==='rollback'?ids[i]+',':''}@operatorRole,${quote(p.key)},${p.view},${p.create},${p.update},${p.delete},${p.approve})`).join(',');
 const permissionPrecondition=mode==='rollback'?`IF EXISTS(SELECT 1 FROM dbo.permissions WHERE id IN(${ids.join(',')})) THROW 51995,'MASTER_V7_TRIAL_ID_COLLISION',1;`:'';
 const permissionInsert=`INSERT dbo.permissions(${mode==='rollback'?'id,':''}role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve) VALUES ${values}; IF @@ROWCOUNT<>2 THROW 51995,'MASTER_V7_PERMISSION_INSERT',1;`;
 const grants=DESKTOP_FINANCE_PROPOSED_RIGHTS.map(p=>`GRANT ${p.permission} ON OBJECT::dbo.[${p.name}]${p.column===null?'':`([${p.column}])`} TO desktop_local_writer_v2;`).join('\n');
 return Object.freeze({mode,ddl:DESKTOP_FINANCE_PROPOSAL_SQL,permissionPrecondition,permissionInsert,grants,requiresOuterIdentityInsert:mode==='rollback',trialPermissionIds:Object.freeze(mode==='rollback'?ids:[]),newPrincipalCount:0,admissionAllowed:false,sqlVerified:false});
}
