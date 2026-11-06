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
 CK_desktop_request_operation:'('+operation.map(v=>`operation collate Latin1_General_100_BIN2='${v}'`).join(' OR ')+')',
 CK_desktop_resolution_kind:'('+kind.map(v=>`kind collate Latin1_General_100_BIN2='${v}'`).join(' OR ')+')',
 CK_desktop_profile_version_mode:'('+[1,2,3,4,5].map(v=>`(schema_version=${v} AND read_only=${v===1?1:0})`).join(' OR ')+')'
});
// Exact SQL Server metadata captured from the independently rolled-back
// diagnostic. Unexpected rendering fails closed, including literal contents.
export const DESKTOP_MASTER_V5_RECORDED_CHECKS=Object.freeze({
 CK_desktop_profile_version_mode:'([schema_version]=(1) AND [read_only]=(1) OR [schema_version]=(2) AND [read_only]=(0) OR [schema_version]=(3) AND [read_only]=(0) OR [schema_version]=(4) AND [read_only]=(0) OR [schema_version]=(5) AND [read_only]=(0))',
 CK_desktop_request_operation:"(([operation]) collate Latin1_General_100_BIN2='CREATE_DRAFT' OR ([operation]) collate Latin1_General_100_BIN2='PREPARE' OR ([operation]) collate Latin1_General_100_BIN2='SAVE_CARTONS' OR ([operation]) collate Latin1_General_100_BIN2='READY' OR ([operation]) collate Latin1_General_100_BIN2='CHECK' OR ([operation]) collate Latin1_General_100_BIN2='DISPATCH' OR ([operation]) collate Latin1_General_100_BIN2='CANCEL' OR ([operation]) collate Latin1_General_100_BIN2='CANCEL_SALE')",
 CK_desktop_resolution_kind:"(([kind]) collate Latin1_General_100_BIN2='draft' OR ([kind]) collate Latin1_General_100_BIN2='transition' OR ([kind]) collate Latin1_General_100_BIN2='dispatch' OR ([kind]) collate Latin1_General_100_BIN2='cancel')"
});
// Candidate metadata rendering must be confirmed by an independent SQL rollback readback.
export const DESKTOP_V5_CUSTOMER_MOVEMENT_CHECK="(movement_type=N'sales_invoice' OR movement_type=N'sales_invoice_cancel')";
export const DESKTOP_V5_CUSTOMER_MOVEMENT_RECORDED="([movement_type]=N'sales_invoice' OR [movement_type]=N'sales_invoice_cancel')";
const quote=v=>`N'${v.replaceAll("'","''")}'`;
export const DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL=DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL+`
IF (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.sales_invoices') AND is_nullable=1 AND ((name=N'cancel_reason' AND system_type_id=231 AND max_length=500) OR (name=N'cancelled_at' AND system_type_id=42 AND scale=0 AND max_length=6) OR (name=N'updated_by' AND system_type_id=127 AND max_length=8)))<>3
 OR (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.customer_movements') AND name=N'movement_type' AND system_type_id=231 AND max_length=80 AND is_nullable=0)<>1
 OR OBJECT_ID(N'dbo.terminal_sync_queue',N'U') IS NULL
 OR NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=N'CK_customer_movements_type' AND parent_object_id=OBJECT_ID(N'dbo.customer_movements') AND is_disabled=0 AND is_not_trusted=0 AND is_not_for_replication=0 AND CONVERT(varbinary(max),definition)=CONVERT(varbinary(max),${quote(DESKTOP_V5_CUSTOMER_MOVEMENT_RECORDED)}) )
 ${Object.entries(DESKTOP_MASTER_V5_RECORDED_CHECKS).map(([name,definition])=>`OR NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=${quote(name)} AND parent_object_id=OBJECT_ID(${quote('dbo.'+(name.includes('resolution')?'desktop_sale_request_resolutions':name.includes('operation')?'desktop_sale_workflow_requests':'desktop_empty_installation'))}) AND is_disabled=0 AND is_not_trusted=0 AND CONVERT(varbinary(max),definition)=CONVERT(varbinary(max),${quote(definition)}))`).join('\n ')}
 THROW 51995,'DESKTOP_MASTER_V5_SCHEMA_REJECTED',1;`;
