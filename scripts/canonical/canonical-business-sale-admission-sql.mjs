// Offline B6 migration component. No SQL driver, file IO, credentials or executor.
// This compiles only the legacy-definition hash closure. It does not grant sale
// admission, generate a row guard, install modules or issue transaction proofs.
import {createHash} from 'node:crypto';

export const CANONICAL_SALE_BEFORE_SHA256='A89BA46ED624409464C557EA38D8C2EB8E7FD0AB493CA575387D11DB4FF1E377';
export const CANONICAL_SALE_CLOSURE_SHA256='0C5A96724EB0485A7850ECC1061439B2F2D6080FC79CB8766A84E5112F6B3627';
export const CANONICAL_SALE_PROJECTION_STATUS='FULL_ADMISSION_NOT_READY';
export const CANONICAL_SALE_PREFIX_BEGIN='/* CANONICAL_BUSINESS_SALE_PREFIX_BEGIN */';
export const CANONICAL_SALE_PREFIX_END='/* CANONICAL_BUSINESS_SALE_PREFIX_END */';
export const CANONICAL_SALE_REGISTRY='dbo.canonical_business_sale_original_definitions_v1';
export const CANONICAL_SALE_PROJECTION='dbo.fn_canonical_business_sale_original_definition_v1';
export const CANONICAL_SALE_REGISTRY_GUARD='dbo.canonical_business_sale_original_definitions_immutable_v1';
const permitted=new Set(['work_trade_assert_ready','work_trade_get_context','work_trade_assert_effects','goal8_day_assert_scope','test_guard_sales_invoices','test_guard_sales_invoice_items','test_guard_stock_movements','test_guard_products','test_guard_customers','test_guard_customer_movements','test_guard_audit_logs','work_night_guard_work_trade_intents','work_night_guard_work_trade_requests','work_night_guard_work_sales_links']);
const sha=(v,encoding='utf8')=>createHash('sha256').update(v,encoding).digest('hex').toUpperCase();
export const canonicalBusinessSaleModuleHash=v=>sha(v,'utf16le');
const check=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const literal=s=>{check(typeof s==='string'&&!s.includes('\0'),'B6_SQL_LITERAL');return "N'"+s.replaceAll("'","''")+"'";};
const exactKeys=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const hash=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const once=(text,part)=>text.split(part).length===2;
const target=`DB_NAME() COLLATE Latin1_General_100_BIN2=N'MELISA_ERP_SIRKET_TEST_20260929_01' AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2=N'Semih\\MELISADEV'`;

function moduleInsertion(original){
 check(typeof original==='string'&&original.length>0&&original.length<=1048576,'B6_ORIGINAL_DEFINITION');
 check(!original.includes(CANONICAL_SALE_PREFIX_BEGIN)&&!original.includes(CANONICAL_SALE_PREFIX_END),'B6_ORIGINAL_ALREADY_PREFIXED');
 const head=/^CREATE\s+(?:PROCEDURE|TRIGGER)\s+dbo\.([A-Za-z0-9_]+)\b/i.exec(original);
 check(head,'B6_ORIGINAL_HEADER');
 // Exact frozen definitions use AS BEGIN. This intentionally does not accept
 // arbitrary SQL syntax or guess a later BEGIN inside a nested statement.
 const body=/\bAS\s+BEGIN\b/i.exec(original.slice(head[0].length));
 check(body,'B6_ORIGINAL_BODY');
 return {name:head[1],at:head[0].length+body.index+body[0].length};
}

// Owner-reviewed source delta input, not a runtime capability. The full B6
// compiler must separately prove the prefix's row-level semantics and pin its
// approved hash. This component verifies that no other old byte was changed.
export function insertCanonicalBusinessSalePrefix(original,prefix){
 const {at}=moduleInsertion(original);
 check(typeof prefix==='string'&&prefix.length<=262144&&prefix.startsWith(CANONICAL_SALE_PREFIX_BEGIN+'\n')&&prefix.endsWith('\n'+CANONICAL_SALE_PREFIX_END)&&once(prefix,CANONICAL_SALE_PREFIX_BEGIN)&&once(prefix,CANONICAL_SALE_PREFIX_END)&&!prefix.includes('\0'),'B6_PREFIX_SHAPE');
 return original.slice(0,at)+'\n'+prefix+'\n'+original.slice(at);
}

function closureRows(before,closure){
 const groups=[['work_trade_guard_manifest',before.guardManifestJson],['test_purchase_batch_guard_manifest',closure.purchaseBatchManifestJson],['test_purchase_fx_guard_manifest',closure.purchaseFxManifestJson],['goal8_day_manifest',closure.goal8ManifestJson]];
 const counts=[22,15,17,18],result=[];
 for(let n=0;n<groups.length;n++){
  const [table,rows]=groups[n];check(Array.isArray(rows)&&rows.length===counts[n],'B6_LEGACY_CLOSURE_COUNT');
  const seen=new Set();
  for(const row of rows){
   check(row&&typeof row.name==='string'&&/^[A-Za-z0-9_]+$/.test(row.name)&&!seen.has(row.name),'B6_LEGACY_CLOSURE_NAME');seen.add(row.name);
   const pin=row.after_hash??row.definition_hash;check(hash(pin),'B6_LEGACY_CLOSURE_HASH');
   result.push(Object.freeze({table,name:row.name,hash:pin}));
  }
 }
 return Object.freeze(result);
}

// Pure synthetic fixtures may exercise this compiler. It is deliberately
// UNVERIFIED_SOURCE_INPUT and never installable. The raw-byte pinned entrypoint
// below is the only way to obtain FROZEN_BEFORE_SOURCE evidence.
export function prepareCanonicalBusinessSaleOriginalProjection({before,closure,successors}={}){
 check(before?.identityJson?.databaseName==='MELISA_ERP_SIRKET_TEST_20260929_01'&&before.identityJson.serverName==='Semih\\MELISADEV','B6_TARGET');
 check(Array.isArray(before.modulesJson)&&Array.isArray(before.columnsJson)&&before.columnsJson.every(r=>r.schemaName==='dbo'),'B6_DBO_METADATA');
 const modules=new Map();
 for(const m of before.modulesJson){
  check(m.schemaName==='dbo'&&typeof m.name==='string'&&/^[A-Za-z0-9_]+$/.test(m.name)&&!modules.has(m.name)&&typeof m.type==='string'&&['P','TR','V'].includes(m.type.trim())&&typeof m.definition==='string'&&hash(m.definitionHash)&&canonicalBusinessSaleModuleHash(m.definition)===m.definitionHash,'B6_BEFORE_MODULE_HASH');
  check(new RegExp('^CREATE\\s+(?:PROCEDURE|TRIGGER|VIEW)\\s+dbo\\.'+m.name+'\\b','i').test(m.definition),'B6_BEFORE_MODULE_NAME');modules.set(m.name,m);
 }
 const legacy=closureRows(before,closure);
 check(Array.isArray(successors)&&successors.length>=1&&successors.length<=permitted.size,'B6_SUCCESSOR_COUNT');
 const seen=new Set(),entries=[];
 for(const s of successors){
  check(exactKeys(s,['name','prefix','approvedPrefixHash','definition'])&&permitted.has(s.name)&&!seen.has(s.name),'B6_SUCCESSOR_SCOPE');seen.add(s.name);
  const old=modules.get(s.name);check(old,'B6_SUCCESSOR_BEFORE_REQUIRED');
  check(typeof s.prefix==='string'&&hash(s.approvedPrefixHash)&&sha(s.prefix)===s.approvedPrefixHash,'B6_APPROVED_PREFIX_HASH');
  const expected=insertCanonicalBusinessSalePrefix(old.definition,s.prefix);
  check(s.definition===expected,'B6_ORIGINAL_BYTES_CHANGED');
  for(const l of legacy.filter(r=>r.name===s.name))check(l.hash===old.definitionHash,'B6_LEGACY_ORIGINAL_HASH');
  entries.push(Object.freeze({name:s.name,originalDefinition:old.definition,beforeHash:old.definitionHash,afterHash:canonicalBusinessSaleModuleHash(expected),prefixHash:s.approvedPrefixHash}));
 }
 entries.sort((a,b)=>a.name.localeCompare(b.name,'en'));
 const r=CANONICAL_SALE_REGISTRY;
 const registryDDL=`CREATE TABLE ${r}(schema_name sysname NOT NULL CHECK(schema_name=N'dbo'),module_name sysname NOT NULL,original_definition nvarchar(max) NOT NULL,before_hash char(64) NOT NULL,after_hash char(64) NOT NULL,prefix_hash char(64) NOT NULL,CONSTRAINT PK_canonical_business_sale_original_definitions_v1 PRIMARY KEY(schema_name,module_name));`;
 // No ALTER of a successor, GRANT or old-manifest write is emitted. The
 // assembler of a future coherent full migration must install successors and
 // seed this registry atomically, then install its immutable trigger.
 const afterConditions=entries.map(e=>`ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${e.name}'))),2),'')<>${literal(e.afterHash)}`).join(' OR ');
 const registrySeedSQL=`IF NOT(${target}) OR IS_SRVROLEMEMBER(N'sysadmin')<>1 OR @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51917,'B6_PROJECTION_INSTALL_SCOPE',1;
IF (${afterConditions}) OR EXISTS(SELECT 1 FROM ${r}) THROW 51917,'B6_PROJECTION_AFTER_IMAGE_REQUIRED',1;
INSERT ${r}(schema_name,module_name,original_definition,before_hash,after_hash,prefix_hash) VALUES
${entries.map(e=>`(N'dbo',${literal(e.name)},${literal(e.originalDefinition)},${literal(e.beforeHash)},${literal(e.afterHash)},${literal(e.prefixHash)})`).join(',\n')};`;
 const registryGuardDefinition=`CREATE TRIGGER ${CANONICAL_SALE_REGISTRY_GUARD} ON ${r} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON; IF EXISTS(SELECT 1 FROM inserted) OR EXISTS(SELECT 1 FROM deleted) THROW 51917,'B6_PROJECTION_REGISTRY_IMMUTABLE',1; END;`;
 const values=entries.map(e=>`(${literal(e.name)},${literal(e.beforeHash)},${literal(e.afterHash)},${literal(e.prefixHash)})`).join(',');
 // SQL UDFs cannot THROW. NULL is the intentional fail-closed result: legacy
 // readiness comparisons must retain their existing NULL/missing rejection.
 // Untouched modules return their real definition, never a stored substitute.
 const projectionDefinition=`CREATE FUNCTION ${CANONICAL_SALE_PROJECTION}(@object_id int) RETURNS nvarchar(max) WITH EXECUTE AS OWNER AS BEGIN
IF NOT(${target}) RETURN NULL;
IF ISNULL(OBJECTPROPERTY(OBJECT_ID(N'${CANONICAL_SALE_REGISTRY_GUARD}'),'ExecIsTriggerDisabled'),1)<>0 OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CANONICAL_SALE_REGISTRY_GUARD}'))),2),'')<>${literal(canonicalBusinessSaleModuleHash(registryGuardDefinition))} RETURN NULL;
IF NOT EXISTS(SELECT 1 FROM sys.triggers WHERE object_id=OBJECT_ID(N'${CANONICAL_SALE_REGISTRY_GUARD}') AND parent_id=OBJECT_ID(N'${r}') AND is_disabled=0 AND is_instead_of_trigger=0) OR (SELECT COUNT(*) FROM sys.trigger_events WHERE object_id=OBJECT_ID(N'${CANONICAL_SALE_REGISTRY_GUARD}') AND type_desc IN(N'INSERT',N'UPDATE',N'DELETE'))<>3 RETURN NULL;
IF (SELECT COUNT(*) FROM ${r})<>${entries.length} OR EXISTS(SELECT 1 FROM(VALUES ${values}) expected(name,before_hash,after_hash,prefix_hash) FULL OUTER JOIN ${r} actual ON actual.schema_name=N'dbo' AND actual.module_name=expected.name WHERE expected.name IS NULL OR actual.module_name IS NULL OR actual.before_hash<>expected.before_hash OR actual.after_hash<>expected.after_hash OR actual.prefix_hash<>expected.prefix_hash OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',actual.original_definition),2),'')<>expected.before_hash OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+actual.module_name))),2),'')<>expected.after_hash) RETURN NULL;
DECLARE @current nvarchar(max)=OBJECT_DEFINITION(@object_id),@original nvarchar(max),@before char(64),@after char(64);
IF @current IS NULL RETURN NULL;
SELECT @original=original_definition,@before=before_hash,@after=after_hash FROM ${r} WHERE schema_name=N'dbo' AND OBJECT_ID(N'dbo.'+module_name)=@object_id;
IF @original IS NULL RETURN @current;
IF CONVERT(varchar(64),HASHBYTES('SHA2_256',@current),2)<>@after OR CONVERT(varchar(64),HASHBYTES('SHA2_256',@original),2)<>@before RETURN NULL;
RETURN @original; END;`;
 const result={schemaVersion:'melisa-canonical-business-sale-original-projection.v1',status:CANONICAL_SALE_PROJECTION_STATUS,sourceEvidence:'UNVERIFIED_SOURCE_INPUT',installable:false,prefixSemanticsVerified:false,requiresCoherentAdmissionCompiler:true,grants:0,businessWrites:0,legacyManifestWrites:0,successorModuleAlters:0,legacyReadinessRewrites:0,entries:Object.freeze(entries),legacyClosure:legacy,registryDDL,registrySeedSQL,registryGuardDefinition,projectionDefinition};
 return Object.freeze({...result,registryGuardHash:canonicalBusinessSaleModuleHash(registryGuardDefinition),projectionHash:canonicalBusinessSaleModuleHash(projectionDefinition)});
}

export function compileCanonicalBusinessSaleOriginalProjection({beforeMetadataJSON,legacyClosureJSON,successors}={}){
 check(typeof beforeMetadataJSON==='string'&&sha(beforeMetadataJSON)===CANONICAL_SALE_BEFORE_SHA256,'B6_FROZEN_BEFORE_BYTES');
 check(typeof legacyClosureJSON==='string'&&sha(legacyClosureJSON)===CANONICAL_SALE_CLOSURE_SHA256,'B6_FROZEN_CLOSURE_BYTES');
 const result=prepareCanonicalBusinessSaleOriginalProjection({before:JSON.parse(beforeMetadataJSON.replace(/^\uFEFF/,'')),closure:JSON.parse(legacyClosureJSON.replace(/^\uFEFF/,'')),successors});
 return Object.freeze({...result,sourceEvidence:'FROZEN_BEFORE_SOURCE',beforeMetadataHash:CANONICAL_SALE_BEFORE_SHA256,legacyClosureHash:CANONICAL_SALE_CLOSURE_SHA256});
}
