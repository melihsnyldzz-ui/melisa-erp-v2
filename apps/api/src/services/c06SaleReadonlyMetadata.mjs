import {env} from '../config/env.js';
import * as database from '../config/database.js';

// This reader is deliberately confined to the existing canonical read-only
// identity. It does not grant a capability or authorize a maintenance step.
const NAMES=Object.freeze([
  'usp_canonical_business_sale_resolve_v1',
  'usp_canonical_business_sale_context_v1',
  'usp_canonical_business_sale_begin_v1',
]);
// IF guards execute on the same acquired SQL session as the metadata SELECT.
// A wrong target exits before enumerating even permission or module metadata.
const QUERY=`IF ISNULL(DB_ID(),-1)<>18
 OR ISNULL(DB_NAME(),N'') COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01'
 OR ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV'
 OR ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')),N'') COLLATE Latin1_General_100_BIN2<>N'Semih'
 OR ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName')),N'') COLLATE Latin1_General_100_BIN2<>N'MELISADEV'
 OR ISNULL(SUSER_SNAME(),N'') COLLATE Latin1_General_100_BIN2<>N'melisa_sirket_test_20260929_01'
 OR ISNULL(USER_NAME(),N'') COLLATE Latin1_General_100_BIN2<>N'melisa_sirket_test_20260929_01'
BEGIN SELECT N'DENIED' AS admission; END
ELSE IF ISNULL(IS_SRVROLEMEMBER('sysadmin'),-1)<>0
 OR ISNULL(HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL'),-1)<>0
 OR ISNULL(HAS_PERMS_BY_NAME('dbo.sales_invoices','OBJECT','INSERT'),-1)<>0
BEGIN SELECT N'DENIED' AS admission; END
ELSE IF EXISTS (
 SELECT permission_name FROM sys.fn_my_permissions(NULL,'DATABASE') WHERE permission_name IN ('INSERT','UPDATE','DELETE','EXECUTE','CONTROL','ALTER','TAKE OWNERSHIP')
 UNION SELECT p.permission_name FROM sys.tables t CROSS APPLY sys.fn_my_permissions(QUOTENAME(SCHEMA_NAME(t.schema_id))+'.'+QUOTENAME(t.name),'OBJECT') p WHERE p.permission_name IN ('INSERT','UPDATE','DELETE','ALTER','CONTROL','TAKE OWNERSHIP')
 UNION SELECT p.permission_name FROM sys.procedures t CROSS APPLY sys.fn_my_permissions(QUOTENAME(SCHEMA_NAME(t.schema_id))+'.'+QUOTENAME(t.name),'OBJECT') p WHERE p.permission_name='EXECUTE'
)
BEGIN SELECT N'DENIED' AS admission; END
ELSE BEGIN
 SELECT N'OK' AS admission;
 SELECT o.name AS objectName,
 CONVERT(varchar(64), HASHBYTES('SHA2_256', m.definition), 2) AS definitionHash,
 m.uses_ansi_nulls AS usesAnsiNulls, m.uses_quoted_identifier AS usesQuotedIdentifier,
 m.execute_as_principal_id AS executeAsPrincipalId, m.is_schema_bound AS isSchemaBound,
 m.uses_native_compilation AS usesNativeCompilation
 FROM sys.objects AS o LEFT JOIN sys.sql_modules AS m ON m.object_id=o.object_id
 WHERE SCHEMA_NAME(o.schema_id) COLLATE Latin1_General_100_BIN2=N'dbo' AND o.type='P'
 AND o.name COLLATE Latin1_General_100_BIN2 IN (N'usp_canonical_business_sale_resolve_v1',
 N'usp_canonical_business_sale_context_v1',N'usp_canonical_business_sale_begin_v1');
END;`;

function blocked() { const e=new Error('C06_SALE_METADATA_UNAVAILABLE'); e.code='C06_SALE_METADATA_UNAVAILABLE'; return e; }
function bit(value) {
  if (value===true || value===1) return true;
  if (value===false || value===0) return false;
  throw blocked();
}

export async function readC06SaleReadonlyMetadata() {
  const c=env.sql;
  if (!database.isCanonicalTest() || env.port!==4146 || !c || c.enabled!==true || c.trustedConnection!==false || c.readOnly!==true
    || c.server!=='127.0.0.1' || c.port!==1433
    || c.database!=='MELISA_ERP_SIRKET_TEST_20260929_01'
    || c.user!=='melisa_sirket_test_20260929_01') throw blocked();
  let rows;
  // getSqlPool() is intentionally not used: it can create a pool. A request
  // may still acquire or replace a physical connection inside the existing pool.
  if (typeof database.getExistingCanonicalReadonlyPool!=='function') throw blocked();
  try {
    const pool=await database.getExistingCanonicalReadonlyPool();
    if (!pool || pool.connected!==true || typeof pool.request!=='function') throw blocked();
    const result=await pool.request().query(QUERY);
    if (!Array.isArray(result.recordsets) || result.recordsets.length!==2
      || result.recordsets[0]?.length!==1 || result.recordsets[0][0]?.admission!=='OK') throw blocked();
    rows=result.recordsets[1];
    if (await database.getExistingCanonicalReadonlyPool()!==pool) throw blocked();
  }
  catch { throw blocked(); }
  if (!Array.isArray(rows)) throw blocked();
  const byName=new Map();
  for (const r of rows) {
    if (!r || !NAMES.includes(r.objectName) || byName.has(r.objectName)) throw blocked();
    if (r.definitionHash==null) { byName.set(r.objectName,{name:r.objectName,status:'UNKNOWN'}); continue; }
    if (typeof r.definitionHash!=='string' || !/^[0-9A-F]{64}$/.test(r.definitionHash)
      || (r.executeAsPrincipalId!==null && !Number.isSafeInteger(r.executeAsPrincipalId))) throw blocked();
    byName.set(r.objectName,{name:r.objectName,status:'OBSERVED',definitionHash:r.definitionHash,
      options:{usesAnsiNulls:bit(r.usesAnsiNulls),usesQuotedIdentifier:bit(r.usesQuotedIdentifier),
        executeAsPrincipalId:r.executeAsPrincipalId,isSchemaBound:bit(r.isSchemaBound),
        // The read-only principal's cryptographic metadata visibility is not
        // established here; an empty query result would not prove no signature.
        usesNativeCompilation:bit(r.usesNativeCompilation),signatureCount:null}});
  }
  return {modules:NAMES.map(name=>byName.get(name)||{name,status:'UNKNOWN'})};
}
