import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareCanonicalBusinessSaleOriginalProjection as prepare,compileCanonicalBusinessSaleOriginalProjection as compile,insertCanonicalBusinessSalePrefix as insert,canonicalBusinessSaleModuleHash as moduleHash,CANONICAL_SALE_PREFIX_BEGIN as begin,CANONICAL_SALE_PREFIX_END as end} from './canonical-business-sale-admission-sql.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex').toUpperCase();
const old="CREATE TRIGGER dbo.test_guard_sales_invoices ON dbo.sales_invoices AFTER INSERT,UPDATE,DELETE AS BEGIN\n-- Historical actor 15/16 body remains byte exact.\nIF EXISTS(SELECT 1 FROM inserted WHERE created_by NOT IN(15,16)) THROW 51106,'OLD_GUARD',1;\nEND;";
// An inert source delta exercises projection, not a commercial admission branch.
const prefix=begin+'\nDECLARE @fixtureProjectionOnly bit=0;\n'+end;
function fixture(){
 const row={schemaName:'dbo',name:'test_guard_sales_invoices',type:'TR',definition:old,definitionHash:moduleHash(old)};
 const rows=n=>[{name:row.name,after_hash:row.definitionHash},...Array.from({length:n-1},(_,i)=>({name:'unchanged_'+i,after_hash:'A'.repeat(64)}))];
 return {before:{identityJson:{databaseName:'MELISA_ERP_SIRKET_TEST_20260929_01',serverName:'Semih\\MELISADEV'},modulesJson:[row],columnsJson:[{schemaName:'dbo'}],guardManifestJson:rows(22)},closure:{purchaseBatchManifestJson:rows(15),purchaseFxManifestJson:rows(17),goal8ManifestJson:rows(18)},successors:[{name:row.name,prefix,approvedPrefixHash:hash(prefix),definition:insert(old,prefix)}]};
}
const rejects=(fn,code)=>assert.throws(fn,e=>e.code===code);

test('B6 compiles real immutable registry/read-only projection pieces, not a sale installer',()=>{
 const f=fixture(),r=prepare(f);
 assert.equal(r.status,'FULL_ADMISSION_NOT_READY');assert.equal(r.sourceEvidence,'UNVERIFIED_SOURCE_INPUT');assert.equal(r.installable,false);
 assert.equal(r.prefixSemanticsVerified,false);assert.equal(r.requiresCoherentAdmissionCompiler,true);assert.equal(r.legacyReadinessRewrites,0);
 for(const k of ['businessWrites','legacyManifestWrites','grants','successorModuleAlters'])assert.equal(r[k],0);
 assert.equal(r.legacyClosure.length,72);assert.equal(r.entries[0].originalDefinition,old);
 assert.equal(r.entries[0].beforeHash,moduleHash(old));assert.equal(r.entries[0].afterHash,moduleHash(f.successors[0].definition));
 assert.match(r.registryDDL,/CREATE TABLE dbo\.canonical_business_sale_original_definitions_v1/);
 assert.match(r.registrySeedSQL,/@@TRANCOUNT<>1 OR XACT_STATE\(\)<>1/);assert.match(r.registrySeedSQL,/B6_PROJECTION_AFTER_IMAGE_REQUIRED/);
 assert.match(r.registryGuardDefinition,/EXISTS\(SELECT 1 FROM inserted\) OR EXISTS\(SELECT 1 FROM deleted\).*THROW/);
 assert.match(r.projectionDefinition,/CREATE FUNCTION/);assert.match(r.projectionDefinition,/RETURNS nvarchar\(max\)/);
 assert.equal(moduleHash(r.registryGuardDefinition),r.registryGuardHash);assert.equal(moduleHash(r.projectionDefinition),r.projectionHash);
 const all=[r.registryDDL,r.registrySeedSQL,r.registryGuardDefinition,r.projectionDefinition].join('\n');
 assert.doesNotMatch(all,/\bGRANT\b|DISABLE TRIGGER|ALTER PROCEDURE|INSERT dbo\.(?:sales_invoices|work_trade_requests)|UPDATE dbo\.(?:products|customers|party_currency_accounts)/i);
 for(const table of ['work_trade_guard_manifest','test_purchase_batch_guard_manifest','test_purchase_fx_guard_manifest','goal8_day_manifest'])assert.doesNotMatch(all,new RegExp('(?:INSERT|UPDATE|DELETE|TRUNCATE)[^\\n;]*dbo\\.'+table,'i'));
 assert(Object.isFrozen(r)&&Object.isFrozen(r.entries)&&Object.isFrozen(r.entries[0]));
});

test('B6 original projection verifies current after hash, stored original hash and immutable guard hash before substitution',()=>{
 const r=prepare(fixture()),sql=r.projectionDefinition;
 assert.match(sql,/FULL OUTER JOIN/);assert.match(sql,/HASHBYTES\('SHA2_256',actual\.original_definition\).*<>expected\.before_hash/);
 assert.match(sql,/OBJECT_DEFINITION\(OBJECT_ID\(N'dbo\.'\+actual\.module_name\)\).*<>expected\.after_hash/);
 assert.match(sql,/ExecIsTriggerDisabled/);assert(sql.includes(r.registryGuardHash));
 assert.match(sql,/parent_id=OBJECT_ID\(N'dbo\.canonical_business_sale_original_definitions_v1'\)/);assert.match(sql,/sys\.trigger_events/);
 assert.match(sql,/IF @original IS NULL RETURN @current/);assert.match(sql,/HASHBYTES\('SHA2_256',@current\).*<>@after/);
 assert.match(sql,/HASHBYTES\('SHA2_256',@original\).*<>@before RETURN NULL/);
 assert.match(sql,/WRONG|RETURN NULL/);assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|EXECUTE|EXEC)\s+(?:dbo|sys)\./i);
});

test('B6 preserves the whole original definition and rejects extra effects outside the pinned prefix',()=>{
 const f=fixture();assert.equal(f.successors[0].definition.replace('\n'+prefix+'\n',''),old);
 f.successors[0].definition+='\nDELETE dbo.customers;';rejects(()=>prepare(f),'B6_ORIGINAL_BYTES_CHANGED');
 const g=fixture();g.successors[0].definition=g.successors[0].definition.replace('NOT IN(15,16)','NOT IN(15,16,17)');rejects(()=>prepare(g),'B6_ORIGINAL_BYTES_CHANGED');
});

test('B6 prefix must match its separately approved source hash and occur exactly once',()=>{
 const f=fixture();f.successors[0].prefix=prefix.replace('bit=0','bit=1');rejects(()=>prepare(f),'B6_APPROVED_PREFIX_HASH');
 rejects(()=>insert(old,prefix+'\n'+prefix),'B6_PREFIX_SHAPE');rejects(()=>insert(old+begin,prefix),'B6_ORIGINAL_ALREADY_PREFIXED');
 const g=fixture();g.successors[0].definition=insert(old,prefix)+'\n'+prefix;rejects(()=>prepare(g),'B6_ORIGINAL_BYTES_CHANGED');
});

test('B6 rejects wrong target/schema, wrong original module hash, duplicate modules and foreign successors',()=>{
 let f=fixture();f.before.identityJson.databaseName='LIVE';rejects(()=>prepare(f),'B6_TARGET');
 f=fixture();f.before.modulesJson[0].schemaName='archive';rejects(()=>prepare(f),'B6_BEFORE_MODULE_HASH');
 f=fixture();f.before.columnsJson[0].schemaName='fixture';rejects(()=>prepare(f),'B6_DBO_METADATA');
 f=fixture();f.before.modulesJson[0].definitionHash='B'.repeat(64);rejects(()=>prepare(f),'B6_BEFORE_MODULE_HASH');
 f=fixture();f.before.modulesJson.push(f.before.modulesJson[0]);rejects(()=>prepare(f),'B6_BEFORE_MODULE_HASH');
 f=fixture();f.successors[0].name='operation_quarantine_products';rejects(()=>prepare(f),'B6_SUCCESSOR_SCOPE');
 f=fixture();f.successors[0].unexpectedGrant=true;rejects(()=>prepare(f),'B6_SUCCESSOR_SCOPE');
});

test('B6 rejects changed legacy manifest rows/counts and retains all four immutable closure groups',()=>{
 let f=fixture();f.closure.goal8ManifestJson[0].after_hash='B'.repeat(64);rejects(()=>prepare(f),'B6_LEGACY_ORIGINAL_HASH');
 f=fixture();f.closure.purchaseFxManifestJson.pop();rejects(()=>prepare(f),'B6_LEGACY_CLOSURE_COUNT');
 f=fixture();f.before.guardManifestJson[1].name=f.before.guardManifestJson[0].name;rejects(()=>prepare(f),'B6_LEGACY_CLOSURE_NAME');
 const r=prepare(fixture());assert.deepEqual([...new Set(r.legacyClosure.map(x=>x.table))],['work_trade_guard_manifest','test_purchase_batch_guard_manifest','test_purchase_fx_guard_manifest','goal8_day_manifest']);
});

test('B6 raw-byte pinned entrypoint cannot promote synthetic input or wrong encoding to frozen source',()=>{
 rejects(()=>compile({beforeMetadataJSON:'{}',legacyClosureJSON:'{}',successors:[]}),'B6_FROZEN_BEFORE_BYTES');
 rejects(()=>compile({beforeMetadataJSON:JSON.stringify(fixture().before),legacyClosureJSON:'{}',successors:[]}),'B6_FROZEN_BEFORE_BYTES');
 rejects(()=>compile({beforeMetadataJSON:Buffer.from('{}'),legacyClosureJSON:'{}',successors:[]}),'B6_FROZEN_BEFORE_BYTES');
});
