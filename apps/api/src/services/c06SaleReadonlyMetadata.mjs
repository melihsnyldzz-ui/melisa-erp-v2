import {env} from '../config/env.js';
import * as database from '../config/database.js';

// This reader is deliberately confined to the existing canonical read-only
// identity. It does not grant a capability or authorize a maintenance step.
const NAMES=Object.freeze([
  'usp_canonical_business_sale_resolve_v1',
  'usp_canonical_business_sale_context_v1',
  'usp_canonical_business_sale_begin_v1',
]);
const QUERY=`SELECT o.name AS objectName,
 CONVERT(varchar(64), HASHBYTES('SHA2_256', m.definition), 2) AS definitionHash,
 m.uses_ansi_nulls AS usesAnsiNulls, m.uses_quoted_identifier AS usesQuotedIdentifier,
 m.execute_as_principal_id AS executeAsPrincipalId, m.is_schema_bound AS isSchemaBound,
 m.uses_native_compilation AS usesNativeCompilation
 FROM sys.objects AS o LEFT JOIN sys.sql_modules AS m ON m.object_id=o.object_id
 WHERE DB_ID()=18 AND DB_NAME() COLLATE Latin1_General_100_BIN2=N'MELISA_ERP_SIRKET_TEST_20260929_01'
 AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2=N'Semih\\MELISADEV'
 AND CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')) COLLATE Latin1_General_100_BIN2=N'Semih'
 AND CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName')) COLLATE Latin1_General_100_BIN2=N'MELISADEV'
 AND SUSER_SNAME() COLLATE Latin1_General_100_BIN2=N'melisa_sirket_test_20260929_01'
 AND USER_NAME() COLLATE Latin1_General_100_BIN2=N'melisa_sirket_test_20260929_01'
 AND IS_SRVROLEMEMBER('sysadmin')=0
 AND HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL')=0
 AND SCHEMA_NAME(o.schema_id) COLLATE Latin1_General_100_BIN2=N'dbo' AND o.type='P'
 AND o.name COLLATE Latin1_General_100_BIN2 IN (N'usp_canonical_business_sale_resolve_v1',
 N'usp_canonical_business_sale_context_v1',N'usp_canonical_business_sale_begin_v1');`;

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
  // The current database module does not expose this accessor. Until an
  // existing-only, ownership-verified accessor is integrated, fail closed;
  // getSqlPool() is intentionally not used because it can open a connection.
  if (typeof database.getExistingCanonicalReadonlyPool!=='function') throw blocked();
  try {
    const pool=await database.getExistingCanonicalReadonlyPool();
    if (!pool || pool.connected!==true || typeof pool.request!=='function') throw blocked();
    rows=(await pool.request().query(QUERY)).recordset;
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
