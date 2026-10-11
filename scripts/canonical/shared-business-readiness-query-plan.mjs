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
