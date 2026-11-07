// Read-only SQL compiler only: no connection, execution, credentials or admission.
import {createHash} from 'node:crypto';
import {compileMasterV6Readback} from './master-v6-transition.mjs';
import {MASTER_V3_BUSINESS_SNAPSHOT_SQL} from './master-v3-transition.mjs';
import {DESKTOP_GOODS_V6_SCHEMA_GUARD_SQL} from '../../apps/api/src/config/desktopGoodsV6Policy.mjs';
import {DESKTOP_FINANCE_V7_SCHEMA_GUARD_CANDIDATE,DESKTOP_FINANCE_V7_PERMISSION_GUARD_SQL} from '../../apps/api/src/config/desktopFinanceV7Policy.mjs';
const fail=()=>{throw Error('MASTER_V7_READBACK_SOURCE_DRIFT');};
function exact(s,a,b,count=1){if(s.split(a).length!==count+1)fail();return s.split(a).join(b);}
export function addDesktopFinanceObjectIds(sql){const marker=' (SELECT t.name tableName,CONVERT(varchar(40),ic.seed_value)';return exact(sql,marker," (SELECT t.name tableName,t.object_id objectId FROM sys.tables t WHERE t.is_ms_shipped=0 AND t.schema_id=SCHEMA_ID(N'dbo') ORDER BY t.name FOR JSON PATH,INCLUDE_NULL_VALUES) objectIdsJson,\n"+marker);}
export function compileMasterV7Readback(){
 if(arguments.length)fail();const v6=compileMasterV6Readback({appMayBeRunning:false});
 let business=MASTER_V3_BUSINESS_SNAPSHOT_SQL.replaceAll('<>36','<>40').replace('<>33','<>37');
 if(business===MASTER_V3_BUSINESS_SNAPSHOT_SQL||business.includes('<>36')||business.includes('<>33'))fail();
 const exclude="NOT IN(N'desktop_empty_installation',N'roles',N'permissions')";
 let next=exact(business,exclude,"NOT IN(N'desktop_empty_installation',N'roles',N'permissions',N'finance_accounts',N'finance_account_movements',N'desktop_finance_requests')");
 next=exact(next,'<>40','<>43',2);
 let sql=exact(v6.sql,business,next);sql=exact(sql,DESKTOP_GOODS_V6_SCHEMA_GUARD_SQL,DESKTOP_FINANCE_V7_SCHEMA_GUARD_CANDIDATE);
 sql=exact(sql,'schema_version IN(5,6)','schema_version IN(6,7)',2);
 sql=exact(sql,"IF NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=6) THROW 51995,'MASTER_V6_OBSERVER_VERSION',1;","IF NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=7) THROW 51995,'MASTER_V7_OBSERVER_VERSION',1;");
 sql=exact(sql,"SELECT N'MASTER_V6_READ_ONLY_SNAPSHOT' state,",`DECLARE @v7_readback_impersonating bit=0;BEGIN TRY EXECUTE AS LOGIN=N'melisa_desktop_test_writer_20261105';SET @v7_readback_impersonating=1;\n${DESKTOP_FINANCE_V7_PERMISSION_GUARD_SQL}\nREVERT;SET @v7_readback_impersonating=0;END TRY BEGIN CATCH IF @v7_readback_impersonating=1 REVERT;THROW;END CATCH;\nSELECT N'MASTER_V7_READ_ONLY_SNAPSHOT' state,\n(SELECT COUNT_BIG(*) FROM dbo.finance_accounts) financeAccountCount,(SELECT COUNT_BIG(*) FROM dbo.finance_account_movements) financeMovementCount,(SELECT COUNT_BIG(*) FROM dbo.desktop_finance_requests) financeRequestCount,\n(SELECT COUNT_BIG(*) FROM dbo.finance_accounts WHERE id>0 AND DATALENGTH(account_code)=DATALENGTH(N'KASA-TRY') AND CONVERT(varbinary(max),account_code)=CONVERT(varbinary(max),N'KASA-TRY') AND DATALENGTH(account_name)=DATALENGTH(N'TRY Ana Kasa') AND CONVERT(varbinary(max),account_name)=CONVERT(varbinary(max),N'TRY Ana Kasa') AND DATALENGTH(account_type)=DATALENGTH(N'cash') AND CONVERT(varbinary(max),account_type)=CONVERT(varbinary(max),N'cash') AND DATALENGTH(currency_code)=DATALENGTH(N'TRY') AND CONVERT(varbinary(max),currency_code)=CONVERT(varbinary(max),N'TRY') AND opening_balance=0 AND current_balance=0 AND is_active=1 AND created_at IS NOT NULL AND updated_at IS NULL) financeSeedValidCount,`);
 sql=addDesktopFinanceObjectIds(sql);
 return Object.freeze({mode:'readback',sql,sha256:createHash('sha256').update(sql,'utf8').digest('hex'),target:v6.target,readOnly:true,sqlTested:false,appMayBeRunning:false,businessTableCount:37,tableCount:43,requiresIndependentOrigin:true,admissionAllowed:false});
}
