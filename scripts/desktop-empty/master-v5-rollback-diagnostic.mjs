// The same finite rollback proposal with metadata-only instrumentation. It
// cannot commit or earn an installation proof. Prior attempts remain immutable.
import {createHash} from 'node:crypto';
import {compileMasterV5Transition} from './master-v5-transition.mjs';
import {DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL} from '../../apps/api/src/config/desktopMasterV3Policy.mjs';
import {DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL,DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL,DESKTOP_MASTER_V5_CHECKS} from '../../apps/api/src/config/desktopMasterV5Policy.mjs';
const fail=()=>{throw Error('MASTER_V5_DIAGNOSTIC_SOURCE_REJECTED');};
const quote=v=>`N'${v.replaceAll("'","''")}'`;
function once(sql,before,after){if(sql.split(before).length!==2)fail();return sql.replace(before,after);}
export function compileMasterV5RollbackDiagnostic(baseline){
 if(!baseline||Object.keys(baseline).sort().join(',')!=='businessRowsSha256,metadataSha256,securitySha256')fail();
 const original=compileMasterV5Transition({mode:'rollback',...baseline});let sql=original.sql;
 const start=sql.indexOf('ROLLBACK TRANSACTION;\n IF ISNULL(IDENT_CURRENT'),end=sql.indexOf("SELECT N'MASTER_V5_ROLLED_BACK' state,");
 if(start<0||end<=start||sql.indexOf('ROLLBACK TRANSACTION;\n IF ISNULL(IDENT_CURRENT',start+1)!==-1)fail();
 const rollbackProof=sql.slice(start+'ROLLBACK TRANSACTION;'.length,end);
 if(!rollbackProof.includes('MASTER_V5_ROLLBACK_IDENTITY_DRIFT')||!rollbackProof.includes('MASTER_V5_ROLLBACK_DRIFT'))fail();
 const labels=[...new Set([...original.sql.matchAll(/\bTHROW\s+\d+\s*,\s*N?('{1,2})((?:MASTER_V5|DESKTOP|LOCAL_MASTER)_[A-Z0-9_]{1,100})\1\s*,\s*\d+\s*;/g)].map(m=>m[2]))].sort();
 if(!labels.includes('DESKTOP_MASTER_V5_SCHEMA_REJECTED')||!labels.includes('DESKTOP_WRITE_OBJECT_PERMISSION_REJECTED'))fail();
 sql=once(sql,'DECLARE @metadata char(64)',"DECLARE @diagnosticStage nvarchar(40)=N'PRECONDITION',@diagnosticChecks nvarchar(max)=NULL,@diagnosticRights nvarchar(max)=NULL,@diagnosticPermissions nvarchar(max)=NULL;\n DECLARE @metadata char(64)");
 const beforeWriter=`EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @impersonating=1;\n ${DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL}`;
 sql=once(sql,beforeWriter,"SET @diagnosticStage=N'WRITER_BEFORE';\n "+beforeWriter);
 const changedChecks=Object.entries(DESKTOP_MASTER_V5_CHECKS).map(([name,definition])=>{const table=name.includes('resolution')?'desktop_sale_request_resolutions':name.includes('operation')?'desktop_sale_workflow_requests':'desktop_empty_installation';return `ALTER TABLE dbo.${table} DROP CONSTRAINT ${name};ALTER TABLE dbo.${table} WITH CHECK ADD CONSTRAINT ${name} CHECK ${definition};`;}).join('\n');
 const ddl=`EXEC sys.sp_executesql ${quote(changedChecks)};`;
 const checks=`SET @diagnosticChecks=(SELECT name,OBJECT_NAME(parent_object_id) parentName,definition,is_disabled,is_not_trusted FROM sys.check_constraints WHERE name IN(${Object.keys(DESKTOP_MASTER_V5_CHECKS).map(quote).join(',')}) ORDER BY name FOR JSON PATH,INCLUDE_NULL_VALUES);`;
 sql=once(sql,ddl,"SET @diagnosticStage=N'CONSTRAINTS';\n "+ddl+'\n '+checks);
 for(const [needle,stage]of [["UPDATE dbo.desktop_empty_installation SET schema_version=5",'PROFILE_MARKER'],['GRANT UPDATE ON OBJECT::dbo.sales_invoices(cancelled_at,cancel_reason,updated_by)','GRANTS'],['SET IDENTITY_INSERT dbo.permissions ON;SET @identityInsert=1;','PERMISSION_INSERT'],['UPDATE dbo.roles SET updated_at=SYSUTCDATETIME() WHERE id=@operatorRole;','ROLE_UPDATE']])sql=once(sql,needle,`SET @diagnosticStage=N'${stage}';\n `+needle);
 const roleChecked="IF @@ROWCOUNT<>1 THROW 51995,'MASTER_V5_ROLE_UPDATE',1;";
 sql=once(sql,roleChecked,roleChecked+"\n SET @diagnosticStage=N'OPERATOR_AFTER';\n SET @diagnosticPermissions=(SELECT permission_key,can_view,can_create,can_update,can_delete,can_approve FROM dbo.permissions WHERE role_id=@operatorRole ORDER BY permission_key FOR JSON PATH,INCLUDE_NULL_VALUES);");
 sql=once(sql,DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL,"SET @diagnosticStage=N'SCHEMA_AFTER';\n "+DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL);
 const afterWriter=`EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @impersonating=1;\n ${DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL}`;
 const rights="SET @diagnosticRights=(SELECT SCHEMA_NAME(o.schema_id) schemaName,o.name objectName,p.permission_name permissionName,p.subentity_name columnName FROM sys.objects o CROSS APPLY sys.fn_my_permissions(QUOTENAME(SCHEMA_NAME(o.schema_id))+N'.'+QUOTENAME(o.name),'OBJECT') p WHERE o.is_ms_shipped=0 AND o.type IN(N'U',N'V',N'P',N'PC',N'FN',N'IF',N'TF',N'FS',N'FT',N'AF',N'SQ',N'SO') ORDER BY schemaName,objectName,permissionName,columnName FOR JSON PATH,INCLUDE_NULL_VALUES);";
 sql=once(sql,afterWriter,"SET @diagnosticStage=N'WRITER_AFTER';\n EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @impersonating=1;\n "+rights+'\n '+DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL);
 sql=once(sql,'REVERT;SET @impersonating=0;\n EXEC sys.sp_executesql ',"REVERT;SET @impersonating=0;\n SET @diagnosticStage=N'AFTER_SNAPSHOT';\n EXEC sys.sp_executesql ");
 const result=(state,errorNumber,errorLabel)=>`SELECT N'${state}' state,@metadata metadataSha256,@security securitySha256,@business businessRowsSha256,CONVERT(int,4) schemaVersion,CONVERT(varchar(40),IDENT_CURRENT(N'dbo.permissions')) permissionIdentityCurrent,@diagnosticStage diagnosticStage,${errorNumber} errorNumber,${errorLabel} errorLabel,@diagnosticChecks checkDefinitions,@diagnosticRights effectivePermissions,@diagnosticPermissions operatorPermissions;`;
 const successStart=sql.indexOf("SELECT N'MASTER_V5_ROLLED_BACK' state,"),successEnd=sql.indexOf(';',successStart);
 if(successStart<0||successEnd<successStart)fail();
 sql=once(sql,sql.slice(successStart,successEnd+1),"SET @diagnosticStage=N'COMPLETE';\n "+result('MASTER_V5_DIAGNOSTIC_ROLLED_BACK','0','CONVERT(nvarchar(128),NULL)'));
 const tail=`END TRY BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 IF @impersonating=1 REVERT;
 IF @identityInsert=1 SET IDENTITY_INSERT dbo.permissions OFF;
 THROW;END CATCH;`;
 if(!sql.endsWith(tail))fail();
 const label=`CASE WHEN @diagnosticMessage COLLATE Latin1_General_100_BIN2 IN(${labels.map(quote).join(',')}) THEN CONVERT(nvarchar(128),@diagnosticMessage) ELSE NULL END`;
 sql=once(sql,tail,`END TRY BEGIN CATCH
 DECLARE @diagnosticError int=ERROR_NUMBER(),@diagnosticMessage nvarchar(4000)=ERROR_MESSAGE();
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 IF @impersonating=1 REVERT;
 IF @identityInsert=1 SET IDENTITY_INSERT dbo.permissions OFF;
 IF @permissionIdentity IS NULL THROW 51995,'MASTER_V5_DIAGNOSTIC_IDENTITY_UNVERIFIED',1;
 ${rollbackProof}
 ${result('MASTER_V5_DIAGNOSTIC_ROLLED_BACK_ERROR','@diagnosticError',label)}
 END CATCH;`);
 if(/\bCOMMIT\s+TRAN(?:SACTION)?\b/i.test(sql)||sql.includes("SELECT N'MASTER_V5_ROLLED_BACK' state,"))fail();
 return Object.freeze({mode:'diagnose',sql,sha256:createHash('sha256').update(sql).digest('hex'),target:original.target,baseline:original.baseline,candidate:null,scope:Object.freeze({...original.scope,diagnosticOnly:true,createsAdmissionProof:false}),sqlTested:false,requiresIndependentReadback:true,requiresSecurityScopeApproval:true});
}
