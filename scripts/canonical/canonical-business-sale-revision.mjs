// B6 source-only assembler. It never connects to SQL, runs batches, reads files,
// changes runtime/configuration, or treats a private capture hash as approval.
import {createHash} from 'node:crypto';
import {compileCanonicalBusinessSaleOwnerFromFrozenBefore,compileCanonicalBusinessSaleOwnerSQL,canonicalBusinessSaleOwnerProfileHash,CANONICAL_BUSINESS_SALE_OWNER as O} from './canonical-business-sale-owner-sql.mjs';
import {compileCanonicalBusinessSaleEffects,prepareCanonicalBusinessSaleEffects,CANONICAL_SALE_GUARD,CANONICAL_SALE_EFFECTS,CANONICAL_SALE_PCA_GUARD} from './canonical-business-sale-effects-sql.mjs';
import {compileCanonicalBusinessSaleOriginalProjection,prepareCanonicalBusinessSaleOriginalProjection,insertCanonicalBusinessSalePrefix,canonicalBusinessSaleModuleHash as moduleHash,CANONICAL_SALE_PREFIX_BEGIN as BEGIN,CANONICAL_SALE_PREFIX_END as END,CANONICAL_SALE_REGISTRY,CANONICAL_SALE_REGISTRY_GUARD,CANONICAL_SALE_PROJECTION,CANONICAL_SALE_REGISTRY_GUARD_DEFINITION,CANONICAL_SALE_ACTIVE_READERS,frozenCanonicalBusinessSaleActiveReaders} from './canonical-business-sale-admission-sql.mjs';
const check=(v,code)=>{if(!v)throw Object.assign(Error(code),{code});};
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex').toUpperCase();
const hex=s=>typeof s==='string'&&/^[A-F0-9]{64}$/.test(s);
const lit=s=>{check(typeof s==='string'&&!s.includes('\0'),'B6_REVISION_LITERAL');return "N'"+s.replaceAll("'","''")+"'";};
const parse=s=>JSON.parse(s.replace(/^\uFEFF/,''));
const clones=Object.freeze({work_trade_assert_ready:'dbo.usp_canonical_business_sale_legacy_ready_v1',goal8_day_assert_scope:'dbo.usp_canonical_business_sale_legacy_goal8_v1'});
export const CANONICAL_BUSINESS_SALE_LEGACY_CLONES=clones;
const cloneCounts={work_trade_assert_ready:4,goal8_day_assert_scope:2};
export const CANONICAL_BUSINESS_SALE_READER_CLOSURE_PINS=Object.freeze({ranges:'B304E559140D6F7747CBBEE4E12C738A4CE73F3EC73AD830F0FD8CB3CE2458D0',parameters:'8208719C6ED3CA1BADCD069CC70FFB34F7EEDD55F38B76BB02E69D69BAA84A70',objectIds:'AFFC0C863506AD192995D9DD367E92E084532AD8B7F24BD42F7BC6178C5EBFAA',options:'359512F086C52ED7338FB35956EAFB76E825821643DAE8D87C8EDC4C6D26C9BB'});
export const canonicalBusinessSaleReaderCloneName=name=>{check(CANONICAL_SALE_ACTIVE_READERS.includes(name),'B6_REVISION_ACTIVE_READER_NAME');return 'dbo.usp_b6_reader_'+sha('dbo.'+name).slice(0,16).toLowerCase()+'_v1';};

export function buildCanonicalBusinessSaleActiveReader({module,ranges,parameters}={}){
 check(module?.schemaName==='dbo'&&CANONICAL_SALE_ACTIVE_READERS.includes(module.name)&&module.type.trim()==='P'&&moduleHash(module.definition)===module.definitionHash,'B6_REVISION_READER_SOURCE');
 check(ranges?.name===module.name&&ranges.definitionHash===module.definitionHash&&(ranges.errors===0||(Array.isArray(ranges.errors)&&ranges.errors.length===0))&&Array.isArray(ranges.predicates)&&Array.isArray(ranges.objectDefinitionCalls),'B6_REVISION_READER_AST');
 check(Array.isArray(parameters)&&parameters.every(p=>p.moduleName===module.name&&Number.isInteger(p.parameter_id)&&p.parameter_id>0&&/^@[A-Za-z_][A-Za-z0-9_]*$/.test(p.name)&&typeof p.is_output==='boolean')&&new Set(parameters.map(p=>p.name)).size===parameters.length&&new Set(parameters.map(p=>p.parameter_id)).size===parameters.length,'B6_REVISION_READER_PARAMETERS');
 const source=module.definition,name='dbo.'+module.name,privateName=canonicalBusinessSaleReaderCloneName(module.name),edits=[];let projected=0,quarantine=0,actualMetadata=0,procIds=0;
 for(const [start,length]of ranges.objectDefinitionCalls){
  check(Number.isInteger(start)&&Number.isInteger(length)&&start>=0&&length>0&&start+length<=source.length,'B6_REVISION_READER_AST_RANGE');
  const original=source.slice(start,start+length);check(/^OBJECT_DEFINITION\s*\(/i.test(original),'B6_REVISION_READER_AST_CALL');
  const pred=ranges.predicates.filter(([s,l])=>start>=s&&start+length<=s+l).sort((a,b)=>a[1]-b[1])[0];
  const predicate=pred?source.slice(pred[0],pred[0]+pred[1]):'';
  const actualQuarantine=!!pred&&/FROM sys\.triggers\b/i.test(predicate)&&/operation\[_\]quarantine|operation_quarantine/.test(predicate)&&/^OBJECT_DEFINITION\s*\(\s*object_id\s*\)$/i.test(original);
  let replacement=original;
  if(pred&&!actualQuarantine){
   replacement=original.replace(/^OBJECT_DEFINITION/i,CANONICAL_SALE_PROJECTION);projected++;
   // Keep IS NULL / IS NOT NULL tests truthful. Hash comparisons fail closed
   // with a nonmatching sentinel instead of SQL's UNKNOWN(NULL) comparison.
   if(!/^\s*\)*\s+IS\s+(?:NOT\s+)?NULL\b/i.test(source.slice(start+length)))replacement=`COALESCE(${replacement},N'B6_INVALID_DEFINITION')`;
  }else if(actualQuarantine)quarantine++;else actualMetadata++;
  if(/@@PROCID/i.test(original)){
   check([O.reader.slice(4),'usp_read_stock_products_product_b40b0745_1fa0_4970_b19f_1479cf75d67a','usp_read_supplier_cards'].includes(module.name),'B6_REVISION_READER_PROCID_SCOPE');
   procIds+=(original.match(/@@PROCID/gi)||[]).length;replacement=replacement.replace(/@@PROCID/gi,`OBJECT_ID(${lit(name)})`);
  }
  if(replacement!==original)edits.push({start,length,replacement});
 }
 check(projected>0&&procIds===(source.match(/@@PROCID/gi)||[]).length,'B6_REVISION_READER_AST_COVERAGE');
 edits.sort((a,b)=>b.start-a.start);for(let i=1;i<edits.length;i++)check(edits[i].start+edits[i].length<=edits[i-1].start,'B6_REVISION_READER_AST_OVERLAP');
 let definition=source;for(const e of edits)definition=definition.slice(0,e.start)+e.replacement+definition.slice(e.start+e.length);
 const header='CREATE PROCEDURE '+name;check(definition.startsWith(header),'B6_REVISION_READER_HEADER');definition=definition.replace(header,'CREATE PROCEDURE '+privateName);
 const definitionHash=moduleHash(definition),guardHash=moduleHash(CANONICAL_SALE_REGISTRY_GUARD_DEFINITION),args=[...parameters].sort((a,b)=>a.parameter_id-b.parameter_id).map(p=>`${p.name}=${p.name}${p.is_output?' OUTPUT':''}`).join(',');
 const prefix=BEGIN+`\nIF ISNULL(${objectHash(privateName)},'')<>${lit(definitionHash)} THROW 51917,'B6_READER_CLONE_DRIFT',1;
IF ISNULL(${objectHash(CANONICAL_SALE_REGISTRY_GUARD)},'')<>${lit(guardHash)} OR ISNULL(OBJECTPROPERTY(OBJECT_ID(${lit(CANONICAL_SALE_REGISTRY_GUARD)}),'ExecIsTriggerDisabled'),1)<>0 OR NOT EXISTS(SELECT 1 FROM sys.triggers WHERE object_id=OBJECT_ID(${lit(CANONICAL_SALE_REGISTRY_GUARD)}) AND parent_id=OBJECT_ID(${lit(CANONICAL_SALE_REGISTRY)}) AND is_disabled=0) THROW 51917,'B6_READER_REGISTRY_GUARD',1;
IF ISNULL(${objectHash(CANONICAL_SALE_PROJECTION)},'')<>ISNULL((SELECT projection_hash FROM ${O.scope} WHERE id=1),N'!') THROW 51917,'B6_READER_PROJECTION_DRIFT',1;
IF ${CANONICAL_SALE_PROJECTION}(OBJECT_ID(${lit(name)})) IS NULL THROW 51917,'B6_READER_PROJECTION_CLOSED',1;
DECLARE @b6_reader_return int; EXEC @b6_reader_return=${privateName}${args?' '+args:''}; RETURN @b6_reader_return;\n`+END;
 return Object.freeze({sourceName:name,name:privateName,definition,definitionHash,projectedCalls:projected,actualQuarantineCalls:quarantine,returnedActualCalls:actualMetadata,publicProcIdSubstitutions:procIds,successor:Object.freeze({name:module.name,prefix,approvedPrefixHash:sha(prefix),definition:insertCanonicalBusinessSalePrefix(source,prefix)})});
}

// Lexical replacement intentionally leaves strings, comments and quoted names
// untouched. Only the two frozen readiness sources can reach this transform.
export function projectCanonicalLegacyObjectDefinitions(source){
 check(typeof source==='string','B6_REVISION_CLONE_SOURCE');let out='',i=0,count=0;
 while(i<source.length){
  const at=i,c=source[i];
  if(c==="'"||c==='"'||c==='['){const close=c==='['?']':c;i++;let closed=false;while(i<source.length){if(source[i]===close){if(source[i+1]===close){i+=2;continue;}i++;closed=true;break;}i++;}check(closed,'B6_REVISION_UNCLOSED_SQL');out+=source.slice(at,i);continue;}
  if(source.startsWith('--',i)){const end=source.indexOf('\n',i);i=end<0?source.length:end+1;out+=source.slice(at,i);continue;}
  if(source.startsWith('/*',i)){let depth=1;i+=2;while(i<source.length&&depth){if(source.startsWith('/*',i)){depth++;i+=2;}else if(source.startsWith('*/',i)){depth--;i+=2;}else i++;}check(depth===0,'B6_REVISION_UNCLOSED_SQL');out+=source.slice(at,i);continue;}
  if(/[A-Za-z_]/.test(c)){i++;while(i<source.length&&/[A-Za-z0-9_$#@]/.test(source[i]))i++;const word=source.slice(at,i);if(word.toUpperCase()==='OBJECT_DEFINITION'&&/^\s*\(/.test(source.slice(i))){check(source.slice(0,at).trimEnd().at(-1)!=='.','B6_REVISION_QUALIFIED_BUILTIN');out+=CANONICAL_SALE_PROJECTION;count++;}else out+=word;continue;}
  out+=c;i++;
 }
 return Object.freeze({definition:out,replacements:count});
}

export function buildCanonicalBusinessSaleLegacyClone(before){
 check(before?.schemaName==='dbo'&&Object.hasOwn(clones,before.name)&&typeof before.definition==='string'&&moduleHash(before.definition)===before.definitionHash,'B6_REVISION_CLONE_BEFORE');
 const header='CREATE PROCEDURE dbo.'+before.name;check(before.definition.startsWith(header+' '),'B6_REVISION_CLONE_HEADER');
 const renamed=clones[before.name],projected=projectCanonicalLegacyObjectDefinitions(before.definition.replace(header,'CREATE PROCEDURE '+renamed));
 check(projected.replacements===cloneCounts[before.name],'B6_REVISION_CLONE_CALL_COUNT');
 const prefix=BEGIN+'\nEXEC '+O.ready+' @legacy=1;\n'+END;
 const definition=insertCanonicalBusinessSalePrefix(projected.definition,prefix);
 return Object.freeze({sourceName:before.name,name:renamed,definition,definitionHash:moduleHash(definition),beforeHash:before.definitionHash,objectDefinitionRewrites:projected.replacements});
}
const prefixForClone=name=>{const prefix=BEGIN+'\nEXEC '+clones[name]+'; RETURN;\n'+END;return prefix;};
const objectHash=name=>`CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(${lit(name)}))),2)`;
function stateSQL(m,expectedHash,{preserveObjectId=true}={}){
 const name='dbo.'+m.name;check(hex(expectedHash)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(m.name),'B6_REVISION_MODULE_PIN');
 const objectCheck=preserveObjectId?` OR ISNULL(OBJECT_ID(${lit(name)}),-1)<>${m.objectId}`:'';
 if(preserveObjectId)check(Number.isSafeInteger(m.objectId)&&m.objectId>0,'B6_REVISION_OBJECT_ID');
 let trigger='';
 if(m.type.trim()==='TR'){
  check(m.parentSchema==='dbo'&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(m.parentTable)&&typeof m.is_disabled==='boolean','B6_REVISION_TRIGGER_METADATA');
  check(Array.isArray(m.triggerEvents)&&m.triggerEvents.length>=1&&m.triggerEvents.length<=3&&new Set(m.triggerEvents.map(e=>e.type_desc)).size===m.triggerEvents.length&&m.triggerEvents.every(e=>['INSERT','UPDATE','DELETE'].includes(e.type_desc)),'B6_REVISION_TRIGGER_EVENTS');
  trigger=` OR NOT EXISTS(SELECT 1 FROM sys.triggers WHERE object_id=OBJECT_ID(${lit(name)}) AND parent_id=OBJECT_ID(${lit('dbo.'+m.parentTable)}) AND is_instead_of_trigger=0 AND is_disabled=${m.is_disabled?1:0}) OR (SELECT COUNT(*) FROM sys.trigger_events WHERE object_id=OBJECT_ID(${lit(name)}))<>${m.triggerEvents.length} OR EXISTS(SELECT 1 FROM sys.trigger_events WHERE object_id=OBJECT_ID(${lit(name)}) AND type_desc NOT IN(${m.triggerEvents.map(e=>lit(e.type_desc)).join(',')}))`;
  for(const event of ['Insert','Update','Delete'])for(const order of ['First','Last']){const v=m[order.toLowerCase()+event];check(v===0||v===1,'B6_REVISION_TRIGGER_ORDER');trigger+=` OR ISNULL(OBJECTPROPERTY(OBJECT_ID(${lit(name)}),'ExecIs${order}${event}Trigger'),-1)<>${v}`;}
 }
 return `IF ISNULL(${objectHash(name)},'')<>${lit(expectedHash)}${objectCheck}${trigger} THROW 51917,'B6_REVISION_MODULE_CAS',1;`;
}
function restoreOrderSQL(m){
 if(m.type.trim()!=='TR')return '';
 return ['Insert','Update','Delete'].map(e=>{const first=m['first'+e],last=m['last'+e];check(!(first===1&&last===1),'B6_REVISION_TRIGGER_ORDER');return `EXEC sys.sp_settriggerorder @triggername=${lit('dbo.'+m.name)},@order=N'${first?'First':last?'Last':'None'}',@stmttype=N'${e.toUpperCase()}';`;}).join('\n');
}
const authoredOptions=Object.freeze({uses_ansi_nulls:true,uses_quoted_identifier:true,is_schema_bound:false,uses_database_collation:false,execute_as_principal_id:-2});
function optionsSQL(name,options){
 check(options&&['uses_ansi_nulls','uses_quoted_identifier','is_schema_bound','uses_database_collation'].every(k=>typeof options[k]==='boolean')&&(options.execute_as_principal_id===null||Number.isInteger(options.execute_as_principal_id)),'B6_REVISION_MODULE_OPTIONS');
 return `IF NOT EXISTS(SELECT 1 FROM sys.sql_modules WHERE object_id=OBJECT_ID(${lit(name)}) AND uses_ansi_nulls=${options.uses_ansi_nulls?1:0} AND uses_quoted_identifier=${options.uses_quoted_identifier?1:0} AND is_schema_bound=${options.is_schema_bound?1:0} AND uses_database_collation=${options.uses_database_collation?1:0} AND ISNULL(execute_as_principal_id,-2147483648)=${options.execute_as_principal_id??-2147483648}) THROW 51917,'B6_REVISION_MODULE_OPTIONS',1;`;
}
function ddlSQL(definition,options=authoredOptions){
 // Avoid SQL's short concatenation type and avoid splitting surrogate pairs.
 const chunks=[];let current='';for(const c of definition){if(current.length+c.length>3000){chunks.push(current);current='';}current+=c;}if(current)chunks.push(current);
 return `SET ANSI_NULLS ${options.uses_ansi_nulls?'ON':'OFF'}; SET QUOTED_IDENTIFIER ${options.uses_quoted_identifier?'ON':'OFF'}; SET @b6_ddl=CAST(N'' AS nvarchar(max))${chunks.map(c=>'+'+lit(c)).join('')}; EXEC sys.sp_executesql @b6_ddl;`;
}
function manifestSQL(projection){
 const groups=Object.groupBy(projection.legacyClosure,r=>r.table);
 return Object.entries(groups).map(([table,rows])=>{const col=table==='work_trade_guard_manifest'||table==='test_purchase_batch_guard_manifest'?'after_hash':'definition_hash';const vals=rows.map(r=>`(${lit(r.name)},${lit(r.hash)})`).join(',');return `IF (SELECT COUNT(*) FROM dbo.${table})<>${rows.length} OR EXISTS(SELECT 1 FROM(VALUES ${vals}) expected(name,hash) FULL OUTER JOIN dbo.${table} actual ON actual.name=expected.name WHERE actual.name IS NULL OR expected.name IS NULL OR ISNULL(actual.${col},'')<>expected.hash) THROW 51917,'B6_REVISION_LEGACY_MANIFEST_DRIFT',1;`;}).join('\n');
}
function mergeGrantMetadata(left,right){const rows=new Map();for(const r of [...left,...right]){const key=JSON.stringify([r.principalName,r.class_desc,r.schemaName,r.objectName,r.minor_id,r.permission_name]);const old=rows.get(key);check(!old||old.state_desc===r.state_desc,'B6_REVISION_PERMISSION_METADATA_CONFLICT');if(!old)rows.set(key,r);}return [...rows.values()];}
function effectivePermissions(before,owner){return owner.permissionSQL.filter(sql=>{const g=/^GRANT (EXECUTE|VIEW DEFINITION) ON OBJECT::dbo\.([A-Za-z0-9_]+) TO \[([^\]]+)\];$/.exec(sql);if(!g)return true;return !(before.grantsJson??[]).some(r=>r.principalName===g[3]&&r.class_desc==='OBJECT_OR_COLUMN'&&r.schemaName==='dbo'&&r.objectName===g[2]&&r.minor_id===0&&r.permission_name===g[1]&&['GRANT','GRANT_WITH_GRANT_OPTION'].includes(r.state_desc));});}
function permissionInverse(before,owner){
 const deltas=[];
 for(const sql of owner.permissionSQL){
  const grant=/^GRANT (EXECUTE|VIEW DEFINITION) ON OBJECT::dbo\.([A-Za-z0-9_]+) TO \[([^\]]+)\];$/.exec(sql);
  if(!grant)continue;
  const [,permission,name,principal]=grant,prior=(before.grantsJson??[]).filter(r=>r.principalName===principal&&r.class_desc==='OBJECT_OR_COLUMN'&&r.schemaName==='dbo'&&r.objectName===name&&r.minor_id===0&&r.permission_name===permission);
  check(prior.length<=1,'B6_REVISION_PERMISSION_BEFORE');const p=prior[0];
  if(p){check(['GRANT','GRANT_WITH_GRANT_OPTION','DENY'].includes(p.state_desc),'B6_REVISION_PERMISSION_STATE');if(p.state_desc==='GRANT'||p.state_desc==='GRANT_WITH_GRANT_OPTION')continue;}
  // New objects lose their grants on DROP. Restore only introduced metadata
  // permissions on retained procedures; preserve existing grants and roles.
  if(['work_trade_assert_ready','work_trade_get_context','work_trade_assert_effects',...CANONICAL_SALE_ACTIVE_READERS].includes(name))deltas.push(`REVOKE ${permission} ON OBJECT::dbo.${name} FROM [${principal}];${p?.state_desc==='DENY'?` DENY ${permission} ON OBJECT::dbo.${name} TO [${principal}];`:''}`);
 }
 return Object.freeze(deltas);
}
function permissionBeforeCAS(before,active=false){
 return ['work_trade_assert_ready','work_trade_get_context','work_trade_assert_effects',...(active?CANONICAL_SALE_ACTIVE_READERS:[])].map(name=>{
  const rows=(before.grantsJson??[]).filter(r=>r.principalName===O.login&&r.class_desc==='OBJECT_OR_COLUMN'&&r.schemaName==='dbo'&&r.objectName===name);
  for(const r of rows)check(Number.isInteger(r.minor_id)&&r.minor_id>=0&&typeof r.permission_name==='string'&&['GRANT','GRANT_WITH_GRANT_OPTION','DENY'].includes(r.state_desc),'B6_REVISION_PERMISSION_BEFORE');
  const actual=`SELECT permission_name,state_desc,minor_id FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(N'dbo.${name}') AND grantee_principal_id=DATABASE_PRINCIPAL_ID(${lit(O.login)})`;
  if(!rows.length)return `IF EXISTS(${actual}) THROW 51917,'B6_REVISION_PERMISSION_BEFORE_DRIFT',1;`;
  const expected=rows.map(r=>`(${lit(r.permission_name)},${lit(r.state_desc)},${r.minor_id})`).join(',');
  return `IF (SELECT COUNT(*) FROM(${actual}) a)<>${rows.length} OR EXISTS(SELECT 1 FROM(VALUES ${expected}) e(permission_name,state_desc,minor_id) FULL OUTER JOIN(${actual}) a ON a.permission_name=e.permission_name AND a.minor_id=e.minor_id WHERE a.permission_name IS NULL OR e.permission_name IS NULL OR a.state_desc<>e.state_desc) THROW 51917,'B6_REVISION_PERMISSION_BEFORE_DRIFT',1;`;
 }).join('\n');
}
function batch(id,sql,kind){return Object.freeze({id,sql,kind,sourceHash:sha(sql)});}
const headerProbeName='dbo.usp_canonical_business_sale_header_probe_v1';
const headerProbeCreate=`CREATE PROCEDURE ${headerProbeName} WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON; SELECT 1 AS b6_header_probe; END;`;
const headerProbeExpected=`CREATE PROCEDURE ${headerProbeName} WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON; SELECT 2 AS b6_header_probe; END;`;
export const CANONICAL_BUSINESS_SALE_HEADER_PROBE=Object.freeze({name:headerProbeName,persistent:false,nativeExecuted:false,createDefinition:headerProbeCreate,alterDefinition:headerProbeExpected.replace(/^CREATE /,'ALTER '),expectedStoredDefinition:headerProbeExpected,createHash:moduleHash(headerProbeCreate),expectedStoredHash:moduleHash(headerProbeExpected)});
function headerProbeSQL(){
 const name=CANONICAL_BUSINESS_SALE_HEADER_PROBE.name;
 const first=CANONICAL_BUSINESS_SALE_HEADER_PROBE.createDefinition,expected=CANONICAL_BUSINESS_SALE_HEADER_PROBE.expectedStoredDefinition;
 return `IF OBJECT_ID(${lit(name)}) IS NOT NULL THROW 51917,'B6_REVISION_HEADER_PROBE_PREEXISTS',1;
${ddlSQL(first)}
DECLARE @b6_header_probe_id int=OBJECT_ID(${lit(name)},N'P');
IF @b6_header_probe_id IS NULL OR ISNULL(${objectHash(name)},'')<>${lit(moduleHash(first))} THROW 51917,'B6_REVISION_HEADER_CREATE_POLICY',1;
${ddlSQL(CANONICAL_BUSINESS_SALE_HEADER_PROBE.alterDefinition)}
IF ISNULL(OBJECT_ID(${lit(name)},N'P'),-1)<>@b6_header_probe_id OR ISNULL(${objectHash(name)},'')<>${lit(moduleHash(expected))} THROW 51917,'B6_REVISION_HEADER_ALTER_POLICY',1;
DROP PROCEDURE ${name};
IF OBJECT_ID(${lit(name)}) IS NOT NULL THROW 51917,'B6_REVISION_HEADER_PROBE_CLEANUP',1;`;
}
const target=`IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' OR IS_SRVROLEMEMBER(N'sysadmin')<>1 OR @@TRANCOUNT<>1 OR XACT_STATE()<>1 THROW 51917,'B6_REVISION_TARGET',1;`;
function build({before,addon,closure,catalog,order,profile,privateProfileHash,raw,activeModules,readerRanges,readerParameters,readerObjectIds,moduleOptions}){
 const capturedProfileHash=canonicalBusinessSaleOwnerProfileHash(profile),active=[];
 if(activeModules){
  check(activeModules.length===14&&Array.isArray(readerRanges)&&Array.isArray(readerParameters?.parametersJson)&&Array.isArray(readerObjectIds),'B6_REVISION_ACTIVE_INPUTS');
  for(const name of CANONICAL_SALE_ACTIVE_READERS){const source=activeModules.find(m=>m.name===name),id=readerObjectIds.filter(m=>m.schemaName==='dbo'&&m.name===name&&m.type.trim()==='P');check(source&&id.length===1&&Number.isSafeInteger(id[0].objectId)&&id[0].objectId>0,'B6_REVISION_ACTIVE_OBJECT_ID');active.push(buildCanonicalBusinessSaleActiveReader({module:{...source,objectId:id[0].objectId},ranges:readerRanges.find(r=>r.name===name),parameters:readerParameters.parametersJson.filter(p=>p.moduleName===name)}));}
  const map=new Map(before.modulesJson.map(m=>[m.name,m]));for(const m of activeModules){const old=map.get(m.name);check(!old||old.definitionHash===m.definitionHash,'B6_REVISION_ACTIVE_BEFORE_DRIFT');map.set(m.name,{...m,objectId:readerObjectIds.find(r=>r.name===m.name).objectId});}before={...before,modulesJson:[...map.values()],grantsJson:mergeGrantMetadata(before.grantsJson??[],readerParameters.grantsJson)};
  check(profile.catalogReaderHash===activeModules.find(m=>'dbo.'+m.name===O.reader).definitionHash,'B6_REVISION_CAPTURE_READER');
  profile={...profile,catalogReaderHash:moduleHash(active.find(m=>m.sourceName===O.reader).successor.definition)};
 }
 const readerClosure=active.length?{captureReaderHash:activeModules.find(m=>'dbo.'+m.name===O.reader).definitionHash,publicDefinitions:Object.fromEntries(active.map(m=>[m.sourceName,moduleHash(m.successor.definition)])),privateClones:active.map(m=>({sourceName:m.sourceName,name:m.name,definitionHash:m.definitionHash}))}:undefined;
 const profileHash=canonicalBusinessSaleOwnerProfileHash(profile);
 const effects=raw?compileCanonicalBusinessSaleEffects({beforeMetadataJSON:raw.beforeMetadataJSON,addonMetadataJSON:raw.auxiliaryMetadataJSON,profileHash}):prepareCanonicalBusinessSaleEffects({before,addon,profileHash});
 const originals=new Map(before.modulesJson.map(m=>[m.name,m]));
 const legacy=Object.keys(clones).map(n=>buildCanonicalBusinessSaleLegacyClone(originals.get(n)));
 const successors=[...effects.successors,...Object.keys(clones).map(name=>{const prefix=prefixForClone(name);return Object.freeze({name,prefix,approvedPrefixHash:sha(prefix),definition:insertCanonicalBusinessSalePrefix(originals.get(name).definition,prefix)});}),...active.map(m=>m.successor)];
 check(successors.length===(active.length?25:11)&&new Set(successors.map(s=>s.name)).size===successors.length,'B6_REVISION_SUCCESSOR_SCOPE');
 const projection=raw?compileCanonicalBusinessSaleOriginalProjection({beforeMetadataJSON:raw.beforeMetadataJSON,legacyClosureJSON:raw.legacyClosureJSON,activeReaderMetadataJSON:raw.activeReaderMetadataJSON,successors}):prepareCanonicalBusinessSaleOriginalProjection({before,closure,successors});
 const effectsPins={guardHash:effects.guardHash,effectsHash:effects.effectsHash,pcaGuardHash:effects.newPcaGuardHash,projectionHash:projection.projectionHash,projectionGuardHash:projection.registryGuardHash,legacyReadyHash:legacy[0].definitionHash,legacyGoal8Hash:legacy[1].definitionHash};
 let owner;
 if(raw)owner=compileCanonicalBusinessSaleOwnerFromFrozenBefore({...raw,profile,effectsPins,readerClosure});
 else{
  const cols=new Map();for(const c of [...before.columnsJson,...addon.columnsJson]){const k=c.tableName+'.'+c.columnName;if(!cols.has(k))cols.set(k,c);}
  const modules=new Map([...before.modulesJson,...addon.modulesJson,...(catalog?.modulesJson??[])].map(m=>[m.name,m]));for(const m of (Array.isArray(order)?order:order?.modulesJson??[]))modules.set(m.name,{...modules.get(m.name),...m});
  owner=compileCanonicalBusinessSaleOwnerSQL({before:{...before,columnsJson:[...cols.values()],modulesJson:[...modules.values()]},profile,effectsPins,readerClosure});
 }
 check(owner.profileHash===profileHash&&JSON.stringify(owner.intentPhases)===JSON.stringify(effects.contract.phases),'B6_REVISION_COMPONENT_CONTRACT');
 check(Array.isArray(moduleOptions),'B6_REVISION_OPTIONS_REQUIRED');const optionMap=new Map();for(const o of moduleOptions){check(o.schemaName==='dbo'&&!optionMap.has(o.name),'B6_REVISION_OPTIONS_METADATA');optionsSQL('dbo.'+o.name,o);optionMap.set(o.name,o);}
 const changed=successors.map(s=>{const options=optionMap.get(s.name);check(options,'B6_REVISION_OPTIONS_REQUIRED');return Object.freeze({name:'dbo.'+s.name,objectId:originals.get(s.name).objectId,beforeHash:originals.get(s.name).definitionHash,afterHash:moduleHash(s.definition),storedDefinition:s.definition,executionDefinition:s.definition.replace(/^CREATE /,'ALTER '),originalDefinition:originals.get(s.name).definition,prefixHash:s.approvedPrefixHash,options});});
 for(const m of changed)check(m.storedDefinition.startsWith('CREATE ')&&m.executionDefinition.startsWith('ALTER '),'B6_REVISION_HEADER_POLICY');
 const modules=[...owner.modules,...legacy,...active,{name:CANONICAL_SALE_PROJECTION,definition:projection.projectionDefinition,definitionHash:projection.projectionHash},{name:CANONICAL_SALE_REGISTRY_GUARD,definition:projection.registryGuardDefinition,definitionHash:projection.registryGuardHash},{name:CANONICAL_SALE_GUARD,definition:effects.guardDefinition,definitionHash:effects.guardHash},{name:CANONICAL_SALE_EFFECTS,definition:effects.effectsDefinition,definitionHash:effects.effectsHash},{name:CANONICAL_SALE_PCA_GUARD,definition:effects.newPcaGuardDefinition,definitionHash:effects.newPcaGuardHash}].map(m=>Object.freeze({...m,options:m.sourceName?optionMap.get(m.sourceName.replace(/^dbo\./,'')):authoredOptions}));
 check(new Set(modules.map(m=>m.name)).size===modules.length&&modules.every(m=>moduleHash(m.definition)===m.definitionHash),'B6_REVISION_NEW_MODULE_HASH');
 const newTables=[O.scope,O.products,O.accounts,O.quotes,O.rates,O.intents,CANONICAL_SALE_REGISTRY],newNames=[...newTables,...modules.map(m=>m.name)];
 const commonManifest=manifestSQL(projection),beforeCAS=before.modulesJson.map(m=>stateSQL(m,m.definitionHash)).join('\n')+'\n'+changed.map(m=>optionsSQL(m.name,m.options)).join('\n');
 const newAbsent=[...newNames,CANONICAL_BUSINESS_SALE_HEADER_PROBE.name].map(n=>`IF OBJECT_ID(${lit(n)}) IS NOT NULL THROW 51917,'B6_REVISION_CREATE_NEW_REQUIRED',1;`).join('\n');
 const immutableNames=new Set(owner.modules.filter(m=>m.name.endsWith('_immutable_v1')).map(m=>m.name));
 const moduleByName=new Map(modules.map(m=>[m.name,m]));
 const createNames=[CANONICAL_SALE_PROJECTION,...legacy.map(m=>m.name),...active.map(m=>m.name),...owner.modules.filter(m=>!immutableNames.has(m.name)).map(m=>m.name),CANONICAL_SALE_GUARD,CANONICAL_SALE_EFFECTS,CANONICAL_SALE_PCA_GUARD];
 const moduleOptionCAS=changed.map(m=>optionsSQL(m.name,m.options)).join('\n')+'\n'+modules.map(m=>optionsSQL(m.name,m.options)).join('\n');
 const afterCAS=before.modulesJson.map(m=>stateSQL(m,changed.find(c=>c.name==='dbo.'+m.name)?.afterHash??m.definitionHash)).join('\n')+'\n'+modules.map(m=>`IF ISNULL(${objectHash(m.name)},'')<>${lit(m.definitionHash)} THROW 51917,'B6_REVISION_NEW_MODULE_DRIFT',1;`).join('\n')+'\n'+moduleOptionCAS;
 const applyBatches=[...(active.length?[]:[batch('active-catalog-closure-block',"THROW 51917,'ACTIVE_CATALOG_PIN_CLOSURE_REQUIRED',1;",'UNRESOLVED_ACTIVE_CONSUMER_HARD_STOP')]),batch('target-before-cas',target+'\n'+newAbsent+'\n'+beforeCAS+'\n'+commonManifest+'\n'+permissionBeforeCAS(before,active.length===14),'READ_ONLY_CAS'),batch('probe-stored-header-policy',headerProbeSQL(),'EPHEMERAL_NEW_OWNED_HEADER_PROBE'),...owner.tables.map((s,i)=>batch('create-private-table-'+i,s,'CREATE_NEW_PRIVATE_METADATA')),batch('create-projection-registry',projection.registryDDL,'CREATE_NEW_PRIVATE_METADATA'),...owner.indexes.map((s,i)=>batch('create-private-index-'+i,s,'CREATE_NEW_PRIVATE_METADATA')),batch('seed-owner-scope',owner.seedSQL,'SEED_PRIVATE_SCOPE_ONLY'),...modules.filter(m=>immutableNames.has(m.name)).map(m=>batch('immutable-'+m.name,ddlSQL(m.definition,m.options),'CREATE_NEW_MODULE')),...createNames.map(n=>batch('create-'+n,ddlSQL(moduleByName.get(n).definition,moduleByName.get(n).options),'CREATE_NEW_MODULE')),...changed.flatMap(m=>[batch('alter-'+m.name,ddlSQL(m.executionDefinition,m.options),'ALTER_EXACT_EXISTING_MODULE'),...(originals.get(m.name.slice(4)).type.trim()==='TR'?[batch('restore-order-'+m.name,restoreOrderSQL(originals.get(m.name.slice(4))),'RESTORE_EXACT_TRIGGER_ORDER')]:[])]),batch('seed-original-projection',projection.registrySeedSQL,'SEED_PRIVATE_SCOPE_ONLY'),batch('seal-original-projection',ddlSQL(projection.registryGuardDefinition),'CREATE_NEW_MODULE'),...effectivePermissions(before,owner).map((s,i)=>batch('narrow-permission-'+i,s,'DECLARED_PERMISSION_DELTA')),batch('after-cas',afterCAS+'\n'+commonManifest+`\nEXEC ${O.ready} @legacy=1;`,'READ_ONLY_CAS')];
 const introducedPermissions=permissionInverse(before,owner);
 const noHistory=`IF EXISTS(SELECT 1 FROM ${O.intents}) OR EXISTS(SELECT 1 FROM dbo.work_trade_requests WHERE JSON_VALUE(payload_json,'$.operationOrigin')=N'CANONICAL_TEST_BUSINESS_SALE' OR JSON_VALUE(payload_json,'$.testProfile')=N'B6-CANONICAL-BUSINESS-SALE-V1') THROW 51917,'B6_REVISION_NATIVE_HISTORY_INVERSE_FORBIDDEN',1;`;
 const dropModules=[...modules].reverse().map(m=>`DROP ${m.definition.startsWith('CREATE TRIGGER ')?'TRIGGER':m.definition.startsWith('CREATE FUNCTION ')?'FUNCTION':'PROCEDURE'} ${m.name};`);
 const dropTables=[O.intents,O.quotes,O.rates,O.accounts,O.products,O.scope,CANONICAL_SALE_REGISTRY].map(t=>'DROP TABLE '+t+';');
 const inverseBatches=[batch('inverse-cas-no-history',target+'\n'+afterCAS+'\n'+commonManifest+'\n'+noHistory,'READ_ONLY_CAS'),...changed.flatMap(m=>[batch('restore-'+m.name,ddlSQL(m.originalDefinition.replace(/^CREATE /,'ALTER '),m.options),'RESTORE_EXACT_EXISTING_MODULE'),...(originals.get(m.name.slice(4)).type.trim()==='TR'?[batch('restore-order-'+m.name,restoreOrderSQL(originals.get(m.name.slice(4))),'RESTORE_EXACT_TRIGGER_ORDER')]:[])]),...introducedPermissions.map((s,i)=>batch('restore-introduced-permission-'+i,s,'RESTORE_EXACT_PERMISSION_DELTA')),...dropModules.map((s,i)=>batch('drop-new-module-'+i,s,'DROP_ONLY_NEW_EMPTY_ARTIFACT')),...dropTables.map((s,i)=>batch('drop-new-table-'+i,s,'DROP_ONLY_NEW_EMPTY_ARTIFACT')),batch('original-cas',beforeCAS+'\n'+commonManifest,'READ_ONLY_CAS')];
 const script=batches=>`SET XACT_ABORT ON; IF @@TRANCOUNT<>0 THROW 51917,'B6_REVISION_NESTED_INSTALL_FORBIDDEN',1; BEGIN TRANSACTION; BEGIN TRY DECLARE @b6_ddl nvarchar(max);\n${batches.map(b=>'-- '+b.id+'\n'+b.sql).join('\n')}\nCOMMIT TRANSACTION; END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;`;
 const appDescriptor=Object.freeze({...(active.length?{readerDefinitions:Object.freeze({...readerClosure.publicDefinitions})}:{}),schemaVersion:'melisa-canonical-business-sale-admission.v1',profileHash,contextDefinitionHash:moduleByName.get(O.context).definitionHash,beginDefinitionHash:moduleByName.get(O.begin).definitionHash,assertDefinitionHash:moduleByName.get(O.assert).definitionHash,effectsDefinitionHash:effects.effectsHash,legacyProof:Object.freeze({readyHash:changed.find(c=>c.name==='dbo.work_trade_assert_ready').afterHash,contextHash:originals.get('work_trade_get_context').definitionHash,effectsHash:originals.get('work_trade_assert_effects').definitionHash})});
 const revisionHash=sha(JSON.stringify({profileHash,privateProfileHash,effectsPins,changed:changed.map(m=>[m.name,m.beforeHash,m.afterHash]),modules:modules.map(m=>[m.name,m.definitionHash]),apply:applyBatches.map(b=>b.sourceHash),inverse:inverseBatches.map(b=>b.sourceHash)}));
 return Object.freeze({schemaVersion:'melisa-canonical-business-sale-revision.v1',status:'SOURCE_ARTIFACT_COMPLETE_INSTALLATION_NOT_VERIFIED',sourceEvidence:raw?'FROZEN_METADATA_HASH_PINNED_PRIVATE_PROFILE_NOT_APPROVAL':'UNVERIFIED_SOURCE_FIXTURE',installable:false,executeAllowed:false,nativeCompiled:false,fullAcceptance:false,blockingChecks:Object.freeze([...(active.length?[]:['ACTIVE_CATALOG_PIN_CLOSURE_REQUIRED']),'NATIVE_SQL_COMPILE_AND_EFFECT_PROOF_REQUIRED','FRESH_BACKUP_RUNTIME_CAS_AND_SCOPE_APPROVAL_REQUIRED','COORDINATED_API_WEB_PACKAGE_READBACK_REQUIRED']),profileHash,capturedProfileHash,profileTransform:Object.freeze({catalogReaderBefore:active.length?readerClosure.captureReaderHash:profile.catalogReaderHash,catalogReaderAfter:profile.catalogReaderHash,otherCapturedFieldsChanged:false}),revisionHash,privateProfileHash,activeReaderClones:Object.freeze(active),scopeCounts:Object.freeze({products:profile.products.length,quotes:profile.quotes.length,accounts:profile.accounts.length,rates:profile.rates.length}),changedModules:Object.freeze(changed),newModules:Object.freeze(modules),headerProbe:CANONICAL_BUSINESS_SALE_HEADER_PROBE,appDescriptor,applyBatches:Object.freeze(applyBatches),inverseBatches:Object.freeze(inverseBatches),applySQL:script(applyBatches),inverseSQL:script(inverseBatches),components:Object.freeze({effects,projection,owner,legacy:Object.freeze(legacy)}),nativePermissionChanges:0,maintenanceFootprint:Object.freeze({apiPort:4144,webPort:5244,nativePort:4146,nativeChanged:false}),legacyManifestWrites:0,commercialRowsCommitted:0});
}

export function prepareCanonicalBusinessSaleRevision(input={}){
 return build({...input,privateProfileHash:sha(JSON.stringify(input.profile))});
}
export function compileCanonicalBusinessSaleRevision(input={}){
 const {privateProfileJSON,privateProfileSHA256,...raw}=input;
 check(typeof privateProfileJSON==='string'&&hex(privateProfileSHA256)&&sha(privateProfileJSON)===privateProfileSHA256,'B6_REVISION_PRIVATE_PROFILE_BYTES');
 const profile=parse(privateProfileJSON),before=parse(raw.beforeMetadataJSON),addon=parse(raw.auxiliaryMetadataJSON),closure=parse(raw.legacyClosureJSON),catalog=parse(raw.catalogReaderMetadataJSON),order=parse(raw.auxiliaryOrderMetadataJSON);
 const pinned=(key,pin)=>{check(typeof raw[key]==='string'&&sha(raw[key])===pin,'B6_REVISION_FROZEN_'+key);return parse(raw[key]);};
 const moduleOptions=pinned('moduleOptionsMetadataJSON',CANONICAL_BUSINESS_SALE_READER_CLOSURE_PINS.options);
 let activeModules,readerRanges,readerParameters,readerObjectIds;
 if(raw.activeReaderMetadataJSON!==undefined){activeModules=frozenCanonicalBusinessSaleActiveReaders(raw.activeReaderMetadataJSON);readerRanges=pinned('readerPredicateRangesJSON',CANONICAL_BUSINESS_SALE_READER_CLOSURE_PINS.ranges);readerParameters=pinned('readerParametersMetadataJSON',CANONICAL_BUSINESS_SALE_READER_CLOSURE_PINS.parameters);readerObjectIds=pinned('readerObjectIdsJSON',CANONICAL_BUSINESS_SALE_READER_CLOSURE_PINS.objectIds);}
 return build({before,addon,closure,catalog,order,profile,privateProfileHash:privateProfileSHA256,raw,activeModules,readerRanges,readerParameters,readerObjectIds,moduleOptions});
}
