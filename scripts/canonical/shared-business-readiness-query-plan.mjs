// Source preparation only. Never connects to SQL or installs a revision.
// All drift predicates remain fresh on every invocation; there is no TTL,
// process cache, SESSION_CONTEXT proof or cached actor/hold/price result.
import {moduleHash} from './stage4-copy-sql.mjs';
const DB='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
const SERVER='Semih\\MELISADEV';
const fail=code=>{throw new Error(code);};
const exact=(o,keys)=>o&&Object.keys(o).sort().join(',')===keys.toSorted().join(',');
export function prepareBusinessReadinessQueryPlan(input){
 if(!exact(input,['database','server','copyId','actualT1','definition','expectedDefinitionHash'])||input.database!==DB||input.server!==SERVER||input.copyId!=='e16b70f0-4057-428b-9abc-6bbcaf35fe82'||input.actualT1!==false)fail('READINESS_PLAN_TARGET');
 const original=input.definition;
 if(typeof original!=='string'||!/^[A-Fa-f0-9]{64}$/.test(input.expectedDefinitionHash)||moduleHash(original)!==input.expectedDefinitionHash.toUpperCase())fail('READINESS_PLAN_BEFORE_PIN');
 if(!original.startsWith('CREATE PROCEDURE dbo.usp_stage4_copy_ready @copy_id uniqueidentifier WITH EXECUTE AS OWNER')||!original.includes(`DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${DB}'`)||!original.includes("DECLARE @readyBaseSeal nvarchar(4000)=JSON_VALUE(@p,'$.sealHash');"))fail('READINESS_PLAN_EXISTING_TEMPLATE');
 let candidate=original;
 const changes=[];
 // v4/v5 were appended after the existing v2 optimization and repeated the
 // entire large @p JSON scan in every registry row. Reuse that invocation's
 // already materialized scalar; retain each registry row/hash/trigger gate.
 for(const code of ['BUSINESS_DAILY_REVISION_DRIFT','BUSINESS_DAILY_PROFIT_REVISION_DRIFT']){
  const lines=candidate.split('\n').filter(line=>line.includes(`'${code}'`));
  if(lines.length!==1||!lines[0].startsWith('IF(')||lines[0].split("JSON_VALUE(@p,'$.sealHash')").length!==2)fail('READINESS_PLAN_REGISTRY_ANCHOR');
  if(original.indexOf("DECLARE @readyBaseSeal nvarchar(4000)=JSON_VALUE(@p,'$.sealHash');")>original.indexOf(lines[0]))fail('READINESS_PLAN_SCALAR_ORDER');
  const before=lines[0],after=before.replace("JSON_VALUE(@p,'$.sealHash')",'@readyBaseSeal');
  candidate=candidate.replace(before,after);changes.push({kind:'INVOCATION_SCALAR_REUSE',code,beforeHash:moduleHash(before),afterHash:moduleHash(after)});
 }
 // Table variables have no normal statistics. Recompile only these measured
 // expensive existence queries using their actual per-call cardinalities.
 // Exact SELECT/FROM/WHERE predicates (including NULL, LL and quarantine) are
 // copied byte-for-byte; the result remains a fresh existential boolean.
 for(const [code,variable] of [['STAGE4_PARTY_SCOPE_DRIFT','@currentPartyScopeDrift'],['BUSINESS_SOURCE_ACCOUNT_WITNESS_DRIFT','@currentSourceAccountDrift']]){
  if(original.toLowerCase().includes(variable.toLowerCase()))fail('READINESS_PLAN_VARIABLE_COLLISION');
  const lines=candidate.split('\n').filter(line=>line.includes(`'${code}'`));
  if(lines.length!==1)fail('READINESS_PLAN_EXISTENCE_ANCHOR');
  const before=lines[0],pattern=new RegExp(`^IF EXISTS\\((SELECT 1 FROM @scopeParties s [^\\r\\n]+)\\) THROW 51904,'${code}',1;\\r?$`),match=before.match(pattern);
  if(!match)fail('READINESS_PLAN_EXISTENCE_TEMPLATE');
  const query=match[1].replace(/^SELECT 1 /,`SELECT TOP(1) ${variable}=CONVERT(bit,1) `);
  const after=`DECLARE ${variable} bit=0;\n${query} OPTION (RECOMPILE);\nIF ${variable}=1 THROW 51904,'${code}',1;`;
  candidate=candidate.replace(before,after);changes.push({kind:'FRESH_QUERY_RECOMPILE',code,beforeHash:moduleHash(before),afterHash:moduleHash(after)});
 }
 return Object.freeze({schemaVersion:'melisa-readiness-query-plan-candidate.v1',database:DB,server:SERVER,copyId:input.copyId,actualT1:false,executeAllowed:false,installAllowed:false,requiresNewAppendOnlyRevisionProof:true,verification:'OFFLINE_SOURCE_ONLY',beforeHash:moduleHash(original),afterHash:moduleHash(candidate),createDefinition:candidate,reviewAlterDefinition:candidate.replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE '),changes:Object.freeze(changes),cachedBusinessResults:false,guardsFreshEveryInvocation:true});
}

// Separate opt-in candidate: the historical four-change preparation above
// remains byte-identical. Only this exact stored CREATE definition is eligible.
const SOURCE_SCOPE_BEFORE_HASH='7EF11EF1D5410689F6838E6D1233EA565D08E2461B3B0F7F483D8E1814B75166';
const SOURCE_ACCOUNT_INSERT="INSERT @sourceAccounts SELECT r.run_id,r.entity,r.payload_hash,LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varchar(max),r.payload_json COLLATE Latin1_General_100_BIN2_UTF8)),2)),JSON_VALUE(r.payload_json,'$.party_source_key'),JSON_VALUE(r.payload_json,'$.role'),JSON_VALUE(r.payload_json,'$.currency_code'),JSON_VALUE(r.payload_json,'$.balance_status'),TRY_CONVERT(decimal(28,8),JSON_VALUE(r.payload_json,'$.balance')) FROM erp_migration.records r WHERE r.run_id=N'VEGA-OPENING-TEST-20261004-06' AND r.entity=N'accounts';";
const SOURCE_LINK_INSERT="INSERT @sourceLinks SELECT customer_id,supplier_id,source_company,source_id,source_currency,N'VEGA2026/'+source_company+N'TBLCARI/'+CONVERT(varchar(20),source_id),N'VEGA_CAPTURE_20260930_01/'+source_company+N'/TBLCARI/'+CONVERT(varchar(20),source_id) FROM dbo.party_source_links;";
const SOURCE_WITNESS_QUERY="SELECT 1 FROM @scopeParties s WHERE s.currency NOT IN(N'TRY',N'USD',N'EUR') OR(s.role=N'customer' AND s.id IN(591,592)) OR NOT EXISTS(SELECT 1 FROM @sourceLinks l JOIN @sourceAccounts r ON r.run_id=N'VEGA-OPENING-TEST-20261004-06' AND r.entity=N'accounts' AND r.party_source_key=l.party_source_key WHERE(s.role=N'customer' AND l.customer_id=s.id AND l.supplier_id IS NULL AND l.source_company=N'F0102' OR s.role=N'supplier' AND l.supplier_id=s.id AND l.customer_id IS NULL AND l.source_company=N'F0103') AND l.source_currency<>N'LL' AND s.sourceKey=l.source_key AND r.payload_hash=s.sourceWitnessHash AND r.actual_payload_hash=LOWER(r.payload_hash) AND r.role=s.role AND r.currency_code=s.currency AND r.balance_status=N'SOURCE' AND r.balance IS NOT NULL)";
const SOURCE_JSON_GATE="IF EXISTS(SELECT 1 FROM erp_migration.records r WHERE r.run_id=N'VEGA-OPENING-TEST-20261004-06' AND r.entity=N'accounts' AND ISJSON(r.payload_json)<>1) THROW 51904,'READINESS_SOURCE_ACCOUNT_JSON_INVALID',1;";
const SOURCE_ACCOUNT_SEMIJOIN=" AND EXISTS(SELECT 1 FROM @scopeParties s WHERE CONVERT(char(64),r.payload_hash) COLLATE Turkish_CI_AS=s.sourceWitnessHash)";
const SOURCE_LINK_SEMIJOIN=" WHERE EXISTS(SELECT 1 FROM @scopeParties s WHERE(s.role=N'customer' AND CONVERT(bigint,party_source_links.customer_id)=s.id OR s.role=N'supplier' AND CONVERT(bigint,party_source_links.supplier_id)=s.id))";
export function prepareBusinessReadinessSourceScopePlan(input){
 const base=prepareBusinessReadinessQueryPlan(input);
 if(base.beforeHash!==SOURCE_SCOPE_BEFORE_HASH)fail('READINESS_SOURCE_SCOPE_BEFORE_PIN');
 const original=input.definition;
 const anchors=[SOURCE_ACCOUNT_INSERT,SOURCE_LINK_INSERT,`IF EXISTS(${SOURCE_WITNESS_QUERY}) THROW 51904,'BUSINESS_SOURCE_ACCOUNT_WITNESS_DRIFT',1;`];
 if(anchors.some(anchor=>original.split(anchor).length!==2)||original.includes('READINESS_SOURCE_ACCOUNT_JSON_INVALID'))fail('READINESS_SOURCE_SCOPE_ANCHOR');
 // Compare using the same materialized char(64)/Turkish_CI_AS witness type.
 // EXISTS preserves duplicate rows and SQL NULL semantics without multiplying
 // records. No daily-party subset, company/LL/role/balance predicate is moved.
 let candidate=base.createDefinition;
 const changes=[...base.changes];
 const add=(before,after,kind,code)=>{if(candidate.split(before).length!==2)fail('READINESS_SOURCE_SCOPE_ANCHOR');candidate=candidate.replace(before,after);changes.push({kind,code,beforeHash:moduleHash(before),afterHash:moduleHash(after)});};
 // Old JSON_VALUE evaluated even unrelated opening records. Reject malformed
 // JSON freshly across that entire run/entity before reducing hash/JSON work.
 // NULL remains UNKNOWN; this explicit gate is stricter for JSON scalars and
 // has its own error code, not the incidental baseline native parse error.
 add(SOURCE_ACCOUNT_INSERT,`${SOURCE_JSON_GATE}\n${SOURCE_ACCOUNT_INSERT}`,'FRESH_SOURCE_JSON_VALIDITY','READINESS_SOURCE_ACCOUNT_JSON_INVALID');
 add(SOURCE_ACCOUNT_INSERT,SOURCE_ACCOUNT_INSERT.slice(0,-1)+SOURCE_ACCOUNT_SEMIJOIN+';','FRESH_SOURCE_SCOPE_SEMIJOIN','SOURCE_ACCOUNTS_FULL_SCOPE');
 add(SOURCE_LINK_INSERT,SOURCE_LINK_INSERT.slice(0,-1)+SOURCE_LINK_SEMIJOIN+';','FRESH_SOURCE_SCOPE_SEMIJOIN','SOURCE_LINKS_FULL_SCOPE');
 const witness=SOURCE_WITNESS_QUERY.replace(/^SELECT 1 /,'SELECT TOP(1) @currentSourceAccountDrift=CONVERT(bit,1) ');
 if(!candidate.includes(witness+' OPTION (RECOMPILE);'))fail('READINESS_SOURCE_SCOPE_WITNESS');
 return Object.freeze({...base,schemaVersion:'melisa-readiness-source-scope-candidate.v1',afterHash:moduleHash(candidate),createDefinition:candidate,reviewAlterDefinition:candidate.replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE '),changes:Object.freeze(changes)});
}
