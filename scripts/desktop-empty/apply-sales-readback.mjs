// Offline compiler for an independent post-apply observation; never connects or
// grants execution authority. Caller identity and closed-child claims are not proof.
import {createHash} from 'node:crypto';
import {compileDesktopSalesBootstrap} from './bootstrap-sales-proposal.mjs';
import {compileDesktopEmptyBootstrap} from './bootstrap-sql.mjs';
import {compileRollbackReadback} from './rollback-readback.mjs';
import {compileDesktopEmptySchema} from './schema.mjs';

const APPLY_SHA='e4f0eb89743f497e761a02ebd6be6a74742d188f88fbaae77086292964ee7f1d';
const BASE_SHA='9ab2cc9dca7437ac30233f005a3d6277ef0d5eab12310046c2033b2541aa120b';
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const fail=()=>{throw new Error('APPLY_SALES_READBACK_REJECTED');};
function expectedConstraintValues(){
 const mapping={PRIMARY:'PK',UNIQUE:'UQ',FOREIGN:'F',CHECK:'C',DEFAULT:'D'},rows=[];
 for(const {sql} of compileDesktopEmptySchema().batches){
  let table=null;
  const re=/\b(?:CREATE|ALTER)\s+TABLE\s+dbo\.([a-z_]+)|\bCONSTRAINT\s+([a-z_][a-z_0-9]*)\s+(PRIMARY|UNIQUE|FOREIGN|CHECK|DEFAULT)\b/gi;
  for(const m of sql.matchAll(re)){
   if(m[1])table=m[1];
   else {if(!table||!mapping[m[3].toUpperCase()])fail();rows.push([m[2],mapping[m[3].toUpperCase()],table]);}
  }
 }
 if(rows.length<100||new Set(rows.map(row=>row[0].toLowerCase())).size!==rows.length)fail();
 return rows.map(row=>`(${row.map(x=>`N'${x}'`).join(',')})`).join(',');
}
function section(sql,start,end){
 const a=sql.indexOf(start),b=sql.indexOf(end,a+start.length);
 if(a<0||b<0)fail();
 const result=sql.slice(a,b+end.length);
 for(let next=sql.indexOf(start,a+start.length);next>=0;next=sql.indexOf(start,next+start.length)){
  if(sql.slice(next,next+result.length)!==result)fail();
 }
 return result;
}
export function compileApplySalesReadback(input){
 const keys=['databaseId','databaseCreateDate','databaseGuid','serverProcessId','applyProcessId'];
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail();
 const d=Object.getOwnPropertyDescriptors(input),own=Reflect.ownKeys(input);
 if(own.length!==keys.length||keys.some(k=>!d[k]||!d[k].enumerable||!Object.hasOwn(d[k],'value'))||own.some(k=>typeof k!=='string'||!keys.includes(k)))fail();
 const s=Object.fromEntries(keys.map(k=>[k,d[k].value]));
 const base=compileDesktopEmptyBootstrap(),applied=compileDesktopSalesBootstrap();
 if(base.sqlSha256!==BASE_SHA||sha(base.sql)!==BASE_SHA||applied.sqlSha256!==APPLY_SHA||sha(applied.sql)!==APPLY_SHA
  ||applied.ddlBatchCount!==45||applied.expectedTableCount!==27||applied.expectedCommercialEmptyTableCount!==26||applied.verifiedAddedColumns!==14)fail();
 const prior=compileRollbackReadback({databaseId:s.databaseId,databaseCreateDate:s.databaseCreateDate,databaseGuid:s.databaseGuid,serverProcessId:s.serverProcessId,probeProcessId:s.applyProcessId});
 const head=section(prior.sql,'SET NOCOUNT ON;'," THROW 51995,'ROLLBACK_READBACK_IDENTITY_OR_SESSION_REJECTED',1;");
 const baseline=section(base.sql,'  OR EXISTS(SELECT 1 FROM sys.synonyms WHERE is_ms_shipped=0)',"  THROW 51995, 'DESKTOP_BOOTSTRAP_TARGET_NOT_EMPTY_OR_ALREADY_APPLIED', 1;").replace(/^  OR /,'IF ');
 const env=section(base.sql,"IF CONVERT(varbinary(256),ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('ProductVersion'))", " THROW 51995, 'DESKTOP_BOOTSTRAP_ENVIRONMENT_BASELINE_REJECTED', 1;");
 const permissions=section(base.sql,'SET @desktop_permissions_json=(',"  THROW 51995, 'DESKTOP_BOOTSTRAP_PERMISSIONS_BASELINE_REJECTED', 1;");
 const tableSet=section(base.sql,"IF EXISTS(SELECT name FROM sys.tables WHERE is_ms_shipped=0 AND SCHEMA_NAME(schema_id)=N'dbo'", "  THROW 51995, 'DESKTOP_BOOTSTRAP_TABLE_SET_REJECTED', 1;");
 const catalog=section(base.sql,'DECLARE @desktop_expected_columns TABLE(',"  THROW 51995, 'DESKTOP_BOOTSTRAP_CATALOG_INDEXES_REJECTED', 1;");
 const sales=section(applied.sql,'DECLARE @desktop_sales_columns TABLE('," THROW 51995,'DESKTOP_SALES_BOOTSTRAP_METADATA_REJECTED',1;");
 const tables=base.expectedTables.filter(name=>name!=='desktop_empty_installation');
 if(tables.length!==26||tables.some(name=>!/^[a-z_]+$/.test(name)))fail();
 // sys.objects includes constraints, unlike sys.tables. Permit only the exact
 // source-named constraint/type/parent combinations and the three catalog
 // tables' system-named primary keys. Existing catalog checks verify those PKs.
 const objects=`DECLARE @desktop_allowed_constraints TABLE(name sysname,type char(2),parent_name sysname,PRIMARY KEY(name));
INSERT @desktop_allowed_constraints VALUES ${expectedConstraintValues()};
IF EXISTS(SELECT 1 FROM sys.objects o LEFT JOIN sys.tables p ON p.object_id=o.parent_object_id
 WHERE o.is_ms_shipped=0 AND NOT(
  (o.type='U' AND SCHEMA_NAME(o.schema_id)=N'dbo' AND o.parent_object_id=0)
  OR (SCHEMA_NAME(o.schema_id)=N'dbo' AND EXISTS(SELECT 1 FROM @desktop_allowed_constraints e
   WHERE CONVERT(varbinary(256),e.name)=CONVERT(varbinary(256),o.name) AND CONVERT(varbinary(2),e.type)=CONVERT(varbinary(2),o.type)
    AND CONVERT(varbinary(256),e.parent_name)=CONVERT(varbinary(256),p.name)))
  OR (o.type='PK' AND SCHEMA_NAME(o.schema_id)=N'dbo' AND EXISTS(SELECT 1 FROM sys.tables native_parent WHERE native_parent.object_id=o.parent_object_id AND native_parent.name IN(N'party_entities',N'party_currency_accounts',N'product_prices'))
   AND EXISTS(SELECT 1 FROM sys.key_constraints k WHERE k.object_id=o.object_id AND k.is_system_named=1))))
 THROW 51995,'DESKTOP_APPLY_READBACK_UNEXPECTED_OBJECT_REJECTED',1;`;
 const sql=`${head}\nIF EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID)
 OR EXISTS(SELECT 1 FROM sys.dm_tran_locks WHERE resource_database_id=DB_ID() AND request_session_id>0 AND request_session_id<>@@SPID)
 THROW 51995,'DESKTOP_APPLY_READBACK_OTHER_SESSION_REJECTED',1;
${baseline}\n${env}\nDECLARE @desktop_permissions_json nvarchar(max);\n${permissions}\n${tableSet}\n${objects}\n${catalog}\n${sales}
IF (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation
 WHERE id=1 AND environment_id=CONVERT(uniqueidentifier,N'eb2888c2-51cb-4570-a933-397cf7e62806')
 AND schema_version=1 AND actual_t1=0 AND external_operations=0 AND read_only=1)
 THROW 51995,'DESKTOP_APPLY_READBACK_MARKER_REJECTED',1;
IF ${tables.map(name=>`EXISTS(SELECT 1 FROM dbo.[${name}])`).join(' OR ')}
 THROW 51995,'DESKTOP_APPLY_READBACK_COMMERCIAL_DATA_REJECTED',1;
SELECT N'DESKTOP_APPLY_READBACK_VERIFIED';`;
 return Object.freeze({sql,sqlSha256:sha(sql),applySqlSha256:APPLY_SHA,expectedResult:'DESKTOP_APPLY_READBACK_VERIFIED',
  executionAuthorized:false,callerIdentityIsNotProof:true,requiresIndependentClosedProcess:true,requiresExclusiveTargetOwner:true,
  completeFoundationMetadataVerified:false,fullApplicationAcceptance:false,markerReadOnly:true});
}

// Compatibility for the apply supervisor: its historical field name denotes
// the apply SQLCMD PID; it is still only a caller assertion, not close proof.
export function compileSalesAppliedReadback(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail();
 const d=Object.getOwnPropertyDescriptors(input),keys=['databaseId','databaseCreateDate','databaseGuid','serverProcessId','probeProcessId'];
 if(Reflect.ownKeys(input).length!==keys.length||keys.some(k=>!d[k]||!d[k].enumerable||!Object.hasOwn(d[k],'value')))fail();
 const r=compileApplySalesReadback({databaseId:d.databaseId.value,databaseCreateDate:d.databaseCreateDate.value,databaseGuid:d.databaseGuid.value,
  serverProcessId:d.serverProcessId.value,applyProcessId:d.probeProcessId.value});
 return Object.freeze({...r,originalSha256:r.applySqlSha256});
}
