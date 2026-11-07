// Pure metadata comparison only. Caller must independently bind the table IDs,
// observed origin and grantor to the fixed target; this cannot authorize grants.
import {DESKTOP_FINANCE_PROPOSED_RIGHTS} from '../../apps/api/src/config/desktopFinanceSchemaProposal.mjs';
import {DESKTOP_GOODS_V6_OPERATOR_PERMISSIONS} from '../../apps/api/src/config/desktopGoodsV6Policy.mjs';
import {DESKTOP_FINANCE_V7_OPERATOR_PERMISSIONS} from '../../apps/api/src/config/desktopFinanceV7Policy.mjs';
const fail=()=>{throw Error('MASTER_V7_SECURITY_INVALID');};
const stable=v=>JSON.stringify(v);const sort=a=>a.map(stable).sort();
const eq=(a,b)=>stable(sort(a))===stable(sort(b));
function read(s){let v;try{v=JSON.parse(s);}catch{fail();}if(!v||Object.keys(v).sort().join(',')!=='operator_permissions,permissions,principals,role_members'||Object.values(v).some(x=>!Array.isArray(x)))fail();return v;}
export function compareDesktopFinanceV7Security({baselineJson,candidateJson,newTables,grantorPrincipalId}={}){
 const before=read(baselineJson),after=read(candidateJson);if(!Number.isSafeInteger(grantorPrincipalId)||grantorPrincipalId<1||!Array.isArray(newTables)||newTables.length!==3||!eq(before.principals,after.principals)||!eq(before.role_members,after.role_members))fail();
 const writers=before.principals.filter(p=>p.name==='desktop_local_writer_v2');if(writers.length!==1||!Number.isSafeInteger(writers[0].principal_id)||(grantorPrincipalId!==1&&!before.principals.some(p=>p.principal_id===grantorPrincipalId)))fail();const writer=writers[0].principal_id,ids=new Map();for(const x of newTables){if(!x||Object.keys(x).sort().join(',')!=='name,objectId'||!['finance_accounts','finance_account_movements','desktop_finance_requests'].includes(x.name)||ids.has(x.name)||!Number.isSafeInteger(x.objectId)||x.objectId<1||[...ids.values()].includes(x.objectId))fail();ids.set(x.name,x.objectId);}
 const fields=p=>({permission_key:p.key,can_view:!!p.view,can_create:!!p.create,can_update:!!p.update,can_delete:!!p.delete,can_approve:!!p.approve});
 if(!eq(before.operator_permissions,DESKTOP_GOODS_V6_OPERATOR_PERMISSIONS.map(fields))||!eq(after.operator_permissions,DESKTOP_FINANCE_V7_OPERATOR_PERMISSIONS.map(fields)))fail();
 const columnIds={'finance_accounts.current_balance':7,'finance_accounts.updated_at':10,'desktop_finance_requests.state':5,'desktop_finance_requests.response_json':6},types={SELECT:'SL',INSERT:'IN',UPDATE:'UP'};
 const required=DESKTOP_FINANCE_PROPOSED_RIGHTS.map(p=>{const minor=p.column===null?0:columnIds[p.name+'.'+p.column];if(!Number.isInteger(minor)||!types[p.permission]||!ids.has(p.name))fail();return {class:1,major_id:ids.get(p.name),minor_id:minor,grantee_principal_id:writer,grantor_principal_id:grantorPrincipalId,type:types[p.permission],state:'G'};});
 const newIds=new Set(ids.values()),added=after.permissions.filter(p=>p.class===1&&newIds.has(p.major_id)),preserved=after.permissions.filter(p=>!(p.class===1&&newIds.has(p.major_id)));if(!eq(before.permissions,preserved)||!eq(added,required))fail();
 return Object.freeze({state:'MASTER_V7_OLD_SECURITY_MATCH_SOURCE_ONLY',originVerified:false,admissionAllowed:false});
}
