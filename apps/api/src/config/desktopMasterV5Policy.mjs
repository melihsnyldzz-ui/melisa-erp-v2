// Finite proposal only. Existing V2/V3/V4 manifests remain unchanged.
import {DESKTOP_MASTER_V3_PERMISSION_MANIFEST,DESKTOP_MASTER_V3_OPERATOR_PERMISSIONS} from './desktopMasterV3Policy.mjs';
import {compileDesktopWritePermissionGuard} from './desktopWritePermissionPolicy.mjs';
import {DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL} from './desktopMasterVersion.mjs';
export const DESKTOP_MASTER_V5_PERMISSION_MANIFEST=Object.freeze([
 ...DESKTOP_MASTER_V3_PERMISSION_MANIFEST,
 ...['cancelled_at','cancel_reason','updated_by'].map(column=>Object.freeze({schema:'dbo',name:'sales_invoices',permission:'UPDATE',column})),
 Object.freeze({schema:'dbo',name:'terminal_sync_queue',permission:'SELECT',column:null})
]);
export const DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL=compileDesktopWritePermissionGuard(DESKTOP_MASTER_V5_PERMISSION_MANIFEST);
export const DESKTOP_MASTER_V5_OPERATOR_PERMISSIONS=Object.freeze([...DESKTOP_MASTER_V3_OPERATOR_PERMISSIONS,Object.freeze({key:'sales.cancel',view:1,create:0,update:0,delete:0,approve:1})]);
const operation=['CREATE_DRAFT','PREPARE','SAVE_CARTONS','READY','CHECK','DISPATCH','CANCEL','CANCEL_SALE'],kind=['draft','transition','dispatch','cancel'];
export const DESKTOP_MASTER_V5_CHECKS=Object.freeze({
 CK_desktop_request_operation:'('+operation.map(v=>`operation COLLATE Latin1_General_100_BIN2='${v}'`).join(' OR ')+')',
 CK_desktop_resolution_kind:'('+kind.map(v=>`kind COLLATE Latin1_General_100_BIN2='${v}'`).join(' OR ')+')',
 CK_desktop_profile_version_mode:'('+[1,2,3,4,5].map(v=>`(schema_version=${v} AND read_only=${v===1?1:0})`).join(' OR ')+')'
});
const quote=v=>`N'${v.replaceAll("'","''")}'`,compact=v=>v.replace(/[\[\]()\s]/g,'');
const normalized=column=>["N'['","N']'","N'('","N')'","N' '",'NCHAR(9)','NCHAR(10)','NCHAR(13)'].reduce((sql,v)=>`REPLACE(${sql},${v},N'')`,column);
// Binary comparison retains the case-sensitive permitted literal values. If
// SQL Server renders an unexpected expression, admission fails closed.
export const DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL=DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL+`
IF (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.sales_invoices') AND is_nullable=1 AND ((name=N'cancel_reason' AND system_type_id=231 AND max_length=500) OR (name=N'cancelled_at' AND system_type_id=42 AND scale=0 AND max_length=6) OR (name=N'updated_by' AND system_type_id=127 AND max_length=8)))<>3
 OR OBJECT_ID(N'dbo.terminal_sync_queue',N'U') IS NULL
 ${Object.entries(DESKTOP_MASTER_V5_CHECKS).map(([name,definition])=>`OR NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=${quote(name)} AND parent_object_id=OBJECT_ID(${quote('dbo.'+(name.includes('resolution')?'desktop_sale_request_resolutions':name.includes('operation')?'desktop_sale_workflow_requests':'desktop_empty_installation'))}) AND is_disabled=0 AND is_not_trusted=0 AND CONVERT(varbinary(max),${normalized('definition')})=CONVERT(varbinary(max),${quote(compact(definition))}))`).join('\n ')}
 THROW 51995,'DESKTOP_MASTER_V5_SCHEMA_REJECTED',1;`;
