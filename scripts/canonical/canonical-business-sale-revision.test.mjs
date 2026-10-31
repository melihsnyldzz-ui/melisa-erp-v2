import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCanonicalBusinessSaleRevision as prepare,compileCanonicalBusinessSaleRevision as compile,projectCanonicalLegacyObjectDefinitions as project,buildCanonicalBusinessSaleLegacyClone as clone,buildCanonicalBusinessSaleActiveReader as reader,canonicalBusinessSaleReaderCloneName as readerName} from './canonical-business-sale-revision.mjs';
import {CANONICAL_BUSINESS_SALE_OWNER as O,CANONICAL_BUSINESS_SALE_REQUIRED_NATIVE_COLUMNS as required} from './canonical-business-sale-owner-sql.mjs';
import {canonicalBusinessSaleModuleHash as hash,CANONICAL_SALE_ACTIVE_READERS as activeReaders,CANONICAL_SALE_PROJECTION as projection} from './canonical-business-sale-admission-sql.mjs';
import {CANONICAL_BUSINESS_SALE_READER_MODULES as runtimeReaders} from '../../apps/api/src/services/canonicalBusinessSessionContext.mjs';
const names={sales_invoices:'test_guard_sales_invoices',sales_invoice_items:'test_guard_sales_invoice_items',products:'test_guard_products',stock_movements:'test_guard_stock_movements',customers:'test_guard_customers',customer_movements:'test_guard_customer_movements',audit_logs:'test_guard_audit_logs',work_sales_links:'work_night_guard_work_sales_links',work_trade_requests:'work_night_guard_work_trade_requests'};
function fixture(){
 const before={identityJson:{databaseName:O.database,serverName:O.server},columnsJson:[],modulesJson:[],grantsJson:[]},addon={columnsJson:[],modulesJson:[]};
 let objectId=100;
 for(const [table,cols]of Object.entries(required))for(const name of cols)before.columnsJson.push({schemaName:'dbo',tableName:table,columnName:name,typeName:'bigint',max_length:8,precision:19,scale:0,is_nullable:true,is_identity:name==='id',is_computed:false});
 const change=(table,column,extra)=>Object.assign(before.columnsJson.find(c=>c.tableName===table&&c.columnName===column),extra);
 for(const col of ['party_entity_id','party_currency_account_id','balance_effect_exact','affects_balance'])before.columnsJson.push({schemaName:'dbo',tableName:'customer_movements',columnName:col,typeName:col==='affects_balance'?'bit':col==='balance_effect_exact'?'decimal':'bigint',max_length:8,precision:col==='balance_effect_exact'?28:19,scale:col==='balance_effect_exact'?8:0,is_nullable:true,is_identity:false,is_computed:false,defaultDefinition:null});
 before.columnsJson.push({schemaName:'dbo',tableName:'stock_movements',columnName:'affects_inventory',typeName:'bit',max_length:1,precision:1,scale:0,is_nullable:false,is_identity:false,is_computed:false,defaultDefinition:'((1))'});
 change('work_trade_requests','request_id',{typeName:'uniqueidentifier',max_length:16});
 for(const [table,name]of Object.entries(names)){
  const definition=`CREATE TRIGGER dbo.${name} ON dbo.${table} AFTER INSERT,UPDATE,DELETE AS BEGIN\nIF 1=0 THROW 51106,'OLD',1; END;`;
  before.modulesJson.push({schemaName:'dbo',name,type:'TR',objectId:objectId++,parentSchema:'dbo',parentTable:table,is_disabled:false,firstInsert:0,firstUpdate:0,firstDelete:0,lastInsert:0,lastUpdate:0,lastDelete:0,triggerEvents:['INSERT','UPDATE','DELETE'].map(type_desc=>({type_desc})),definition,definitionHash:hash(definition)});
 }
 for(const [name,count]of [['work_trade_assert_ready',4],['goal8_day_assert_scope',2],['work_trade_get_context',3],['work_trade_assert_effects',0]]){
  const definition=`CREATE PROCEDURE dbo.${name} WITH EXECUTE AS OWNER AS BEGIN\n${Array.from({length:count},()=>"SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.test_guard_products')); ").join('\n')}\nEND;`;
  before.modulesJson.push({schemaName:'dbo',name,type:'P ',objectId:objectId++,definition,definitionHash:hash(definition)});
 }
 const rows=count=>Array.from({length:count},(_,i)=>{const m=before.modulesJson[i];return {name:m?.name??'unchanged_'+i,after_hash:m?.definitionHash??'A'.repeat(64)};});
 before.guardManifestJson=rows(22);const closure={purchaseBatchManifestJson:rows(15),purchaseFxManifestJson:rows(17),goal8ManifestJson:rows(18)};
 const catalog={modulesJson:[{schemaName:'dbo',name:O.reader.slice(4),type:'P ',definitionHash:O.readerHash}]};
 const profile={date:'2026-10-28',roleCode:O.roleCode,permissionHash:'A'.repeat(64),beforeMetadataHash:'B'.repeat(64),captureHash:'C'.repeat(64),catalogReaderHash:O.readerHash,products:[{productId:'101',sourceHash:'D'.repeat(64),unitSourceId:'1',factorExact8:'1.00000000',costKnown:true}],accounts:[{accountId:'201',customerId:'301',partyEntityId:'401',currency:'TRY',sourceHash:'E'.repeat(64)}],quotes:[{quoteId:'501',productId:'101',sourceHash:'F'.repeat(64)}],rates:[]};
 const moduleOptions=before.modulesJson.map(m=>({schemaName:'dbo',name:m.name,uses_ansi_nulls:true,uses_quoted_identifier:true,is_schema_bound:false,uses_database_collation:false,execute_as_principal_id:-2}));return {before,addon,closure,catalog,order:[],profile,moduleOptions};
}
test('source revision combines real component pins, 11 exact successors and actual descriptor hashes without installation readiness',()=>{
 const f=fixture(),r=prepare(f);assert.equal(r.changedModules.length,11);assert.equal(r.newModules.length,17);assert.equal(r.installable,false);assert.equal(r.executeAllowed,false);assert.equal(r.nativeCompiled,false);assert(r.blockingChecks.includes('ACTIVE_CATALOG_PIN_CLOSURE_REQUIRED'));
 assert.equal(r.applyBatches[0].kind,'UNRESOLVED_ACTIVE_CONSUMER_HARD_STOP');assert.match(r.applyBatches[0].sql,/THROW .*ACTIVE_CATALOG_PIN_CLOSURE_REQUIRED/);
 for(const m of r.changedModules){const old=f.before.modulesJson.find(o=>'dbo.'+o.name===m.name);assert.equal(m.beforeHash,old.definitionHash);assert.equal(hash(m.storedDefinition),m.afterHash);assert(m.executionDefinition.startsWith('ALTER '));assert.equal(m.executionDefinition.replace(/^ALTER /,'CREATE '),m.storedDefinition);}
 const descriptor=r.appDescriptor;assert.equal(descriptor.profileHash,r.components.owner.profileHash);assert.equal(descriptor.effectsDefinitionHash,r.components.effects.effectsHash);assert.equal(descriptor.legacyProof.readyHash,r.changedModules.find(m=>m.name==='dbo.work_trade_assert_ready').afterHash);assert.notEqual(descriptor.legacyProof.readyHash,f.before.modulesJson.find(m=>m.name==='work_trade_assert_ready').definitionHash);
 assert.equal(descriptor.legacyProof.contextHash,f.before.modulesJson.find(m=>m.name==='work_trade_get_context').definitionHash);assert.equal(descriptor.legacyProof.effectsHash,f.before.modulesJson.find(m=>m.name==='work_trade_assert_effects').definitionHash);
 assert.equal(r.maintenanceFootprint.nativeChanged,false);assert.equal(r.nativePermissionChanges,0);assert(Object.isFrozen(r));
});
test('legacy metadata projection rewrites calls only, preserving quoted names, strings, nested comments and actual result metadata elsewhere',()=>{
 const s="SELECT OBJECT_DEFINITION(OBJECT_ID(N'x')); SELECT 'OBJECT_DEFINITION(x)'; -- OBJECT_DEFINITION(x)\n/* OBJECT_DEFINITION(x) /* nested */ */ SELECT [OBJECT_DEFINITION], \"OBJECT_DEFINITION\";";
 const r=project(s);assert.equal(r.replacements,1);assert(r.definition.includes("SELECT dbo.fn_canonical_business_sale_original_definition_v1(OBJECT_ID(N'x'))"));assert(r.definition.includes("'OBJECT_DEFINITION(x)'"));assert(r.definition.includes('-- OBJECT_DEFINITION(x)'));
 const f=fixture(),c=clone(f.before.modulesJson.find(m=>m.name==='work_trade_assert_ready'));assert.equal(c.objectDefinitionRewrites,4);assert.match(c.definition,/@legacy=1/);assert.equal(c.definitionHash,hash(c.definition));assert.throws(()=>project("SELECT 'broken"));
});
test('apply keeps before/after hash and object IDs, explicitly restores trigger order and never modifies immutable legacy manifests',()=>{
 const r=prepare(fixture());assert.match(r.applySQL,/B6_REVISION_CREATE_NEW_REQUIRED/);assert.match(r.applySQL,/B6_REVISION_MODULE_CAS/);assert.match(r.applySQL,/sp_settriggerorder/);assert.match(r.applySQL,/ExecIsFirstInsertTrigger/);assert.match(r.applySQL,/B6_REVISION_PERMISSION_BEFORE_DRIFT/);
 assert(r.applyBatches.findIndex(b=>b.id==='seed-original-projection')>r.applyBatches.findIndex(b=>b.id.startsWith('alter-dbo.')));
 for(const table of ['work_trade_guard_manifest','test_purchase_batch_guard_manifest','test_purchase_fx_guard_manifest','goal8_day_manifest'])assert.doesNotMatch(r.applySQL+r.inverseSQL,new RegExp('(?:UPDATE|INSERT|DELETE|TRUNCATE)[^;\\n]*dbo\\.'+table,'i'));
 assert.doesNotMatch(r.applySQL+r.inverseSQL,/BACKUP|RESTORE DATABASE|DISABLE TRIGGER|CREATE OR ALTER/i);
});
test('inverse rejects any native history before restoration and drops only named newly introduced artifacts',()=>{
 const f=fixture(),r=prepare(f),first=r.inverseBatches[0];assert.match(first.sql,/EXISTS\(SELECT 1 FROM dbo.canonical_business_sale_intents\)/);assert.match(first.sql,/B6_REVISION_NATIVE_HISTORY_INVERSE_FORBIDDEN/);assert.match(first.sql,/B6-CANONICAL-BUSINESS-SALE-V1/);
 for(const m of r.changedModules)assert(r.inverseBatches.some(b=>b.id==='restore-'+m.name));
 for(const name of Object.values(names))assert.doesNotMatch(r.inverseSQL,new RegExp('DROP TRIGGER dbo\\.'+name+';'));
 assert.doesNotMatch(r.inverseSQL,/DELETE dbo\.|TRUNCATE|RESTORE DATABASE/);assert.match(r.inverseSQL,/ROLLBACK TRANSACTION; THROW/);
});
test('source and profile tampering are rejected, component inputs are not mutated, and assembly is deterministic',()=>{
 const f=fixture(),s=JSON.stringify(f),a=prepare(f),b=prepare(f);assert.equal(JSON.stringify(f),s);assert.equal(a.revisionHash,b.revisionHash);assert.equal(a.applySQL,b.applySQL);
 const bad=fixture();bad.before.modulesJson[0].definition+='-- drift';assert.throws(()=>prepare(bad));
 const g=fixture();g.before.modulesJson.find(m=>m.name==='goal8_day_assert_scope').objectId=undefined;assert.throws(()=>prepare(g),{code:'B6_REVISION_OBJECT_ID'});
 assert.throws(()=>compile({privateProfileJSON:'{}',privateProfileSHA256:'A'.repeat(64)}),{code:'B6_REVISION_PRIVATE_PROFILE_BYTES'});
});
function readerFixture(name,{procId=false}={}){
 const header=`CREATE PROCEDURE dbo.${name} @input int,@output int OUTPUT WITH EXECUTE AS OWNER AS BEGIN\n`;
 const predicate="OBJECT_DEFINITION(OBJECT_ID(N'dbo.test_guard_products')) IS NULL OR HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.test_guard_products')))<>0x00";
 const quarantine="(SELECT COUNT(*) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine%' AND HASHBYTES('SHA2_256',OBJECT_DEFINITION(object_id))<>0x00)>0";
 const tail=`SELECT OBJECT_DEFINITION(${procId?'@@PROCID':"OBJECT_ID(N'dbo.test_guard_products')"}) actual_hash;`;
 const definition=header+`IF ${predicate} THROW 51000,'OLD_GUARD',1;\nIF ${quarantine} THROW 51000,'HOLD',1;\n${tail}\nEND;`;
 const calls=[];let at=0;while((at=definition.indexOf('OBJECT_DEFINITION(',at))>=0){let depth=1,end=at+'OBJECT_DEFINITION('.length;for(;depth;end++){if(definition[end]==='(')depth++;if(definition[end]===')')depth--;}calls.push([at,end-at]);at=end;}
 return {module:{schemaName:'dbo',name,type:'P ',definition,definitionHash:hash(definition)},ranges:{name,definitionHash:hash(definition),errors:0,predicates:[[header.length+3,predicate.length],[definition.indexOf(quarantine),quarantine.length]],objectDefinitionCalls:calls},parameters:[{moduleName:name,parameter_id:1,name:'@input',is_output:false},{moduleName:name,parameter_id:2,name:'@output',is_output:true}]};
}
function fullFixture(){
 const f=fixture();f.activeModules=[];f.readerRanges=[];f.readerParameters={parametersJson:[],grantsJson:[]};f.readerObjectIds=[];
 for(const [i,name] of activeReaders.entries()){
  const r=readerFixture(name,{procId:[O.reader.slice(4),'usp_read_supplier_cards','usp_read_stock_products_product_b40b0745_1fa0_4970_b19f_1479cf75d67a'].includes(name)});
  f.activeModules.push(r.module);f.readerRanges.push(r.ranges);f.readerParameters.parametersJson.push(...r.parameters);f.readerObjectIds.push({schemaName:'dbo',name,type:'P ',objectId:500+i});
  f.moduleOptions.push({schemaName:'dbo',name,uses_ansi_nulls:true,uses_quoted_identifier:false,is_schema_bound:false,uses_database_collation:false,execute_as_principal_id:-2});
 }
 f.profile.catalogReaderHash=f.activeModules.find(m=>'dbo.'+m.name===O.reader).definitionHash;
 f.catalog={modulesJson:[f.activeModules.find(m=>'dbo.'+m.name===O.reader)]};
 f.readerParameters.grantsJson.push({principalName:O.login,class_desc:'OBJECT_OR_COLUMN',schemaName:'dbo',objectName:activeReaders[0],minor_id:0,permission_name:'VIEW DEFINITION',state_desc:'GRANT_WITH_GRANT_OPTION'});
 return f;
}
test('active SQL reader closure exactly matches the runtime descriptor ordered finite names',()=>{
 assert.deepEqual(activeReaders.map(n=>'dbo.'+n),runtimeReaders);assert.equal(activeReaders.length,14);assert.equal(new Set(activeReaders).size,14);
 assert.throws(()=>readerName('archived_reader'));for(const name of activeReaders)assert.match(readerName(name),/^dbo\.usp_b6_reader_[a-f0-9]{16}_v1$/);
});
test('reader transform projects only AST guard predicates and fails NULL closed while preserving actual quarantine and result metadata',()=>{
 const f=readerFixture('usp_read_supplier_cards',{procId:true}),r=reader(f);
 assert.equal(r.projectedCalls,2);assert.equal(r.actualQuarantineCalls,1);assert.equal(r.returnedActualCalls,1);assert.equal(r.publicProcIdSubstitutions,1);
 assert(r.definition.includes(`${projection}(OBJECT_ID(N'dbo.test_guard_products')) IS NULL`));assert(r.definition.includes(`COALESCE(${projection}(OBJECT_ID(N'dbo.test_guard_products')),N'B6_INVALID_DEFINITION')`));
 assert(r.definition.includes('OBJECT_DEFINITION(object_id)'));assert(r.definition.includes("SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_read_supplier_cards')) actual_hash"));
 assert.match(r.successor.prefix,/B6_READER_PROJECTION_CLOSED/);assert(r.successor.prefix.includes(`${projection}(OBJECT_ID(N'dbo.usp_read_supplier_cards')) IS NULL THROW`));
 assert(r.successor.prefix.includes('EXEC @b6_reader_return='+r.name+' @input=@input,@output=@output OUTPUT; RETURN @b6_reader_return;'));
 assert.doesNotMatch(r.successor.prefix,/EXEC dbo\.usp_canonical_business_sale_ready/);
 const without=r.successor.definition.replace('\n'+r.successor.prefix+'\n','');assert.equal(without,f.module.definition);
 const bad=structuredClone(f);bad.ranges.definitionHash='A'.repeat(64);assert.throws(()=>reader(bad));bad.ranges=f.ranges;bad.module.definition+='-- drift';assert.throws(()=>reader(bad));
});
test('full named closure produces 25 exact successors, pins all private clones, actual public hashes and only the captured reader profile transform',()=>{
 const f=fullFixture(),snapshot=JSON.stringify(f),r=prepare(f);assert.equal(JSON.stringify(f),snapshot);assert.equal(r.changedModules.length,25);assert.equal(r.newModules.length,31);assert.equal(r.activeReaderClones.length,14);assert.equal(r.installable,false);
 assert(!r.blockingChecks.includes('ACTIVE_CATALOG_PIN_CLOSURE_REQUIRED'));assert(!r.applyBatches.some(b=>b.kind==='UNRESOLVED_ACTIVE_CONSUMER_HARD_STOP'));assert.equal(Object.keys(r.appDescriptor.readerDefinitions).length,14);
 assert.notEqual(r.profileHash,r.capturedProfileHash);assert.equal(r.profileTransform.catalogReaderBefore,f.profile.catalogReaderHash);assert.equal(r.profileTransform.catalogReaderAfter,r.appDescriptor.readerDefinitions[O.reader]);assert.equal(r.profileTransform.otherCapturedFieldsChanged,false);
 const ready=r.newModules.find(m=>m.name===O.ready).definition;
 for(const c of r.activeReaderClones){assert(ready.includes(c.definitionHash));assert(ready.includes(r.appDescriptor.readerDefinitions[c.sourceName]));assert.equal(c.definitionHash,hash(c.definition));}
 assert.equal(r.components.owner.executeGrants,4);assert.equal(r.components.owner.viewDefinitionGrants,21);assert.equal(r.nativePermissionChanges,0);
 for(const n of activeReaders){assert(r.applySQL.includes('ALTER PROCEDURE dbo.'+n));assert(!r.applySQL.includes('ALTER PROCEDURE dbo.'+n+'_archive'));assert(r.inverseSQL.includes('ALTER PROCEDURE dbo.'+n));}
});
test('module option CAS and execution preserve native ANSI/QI and permission inverse never revokes an existing grant option',()=>{
 const f=fullFixture(),r=prepare(f),existing=activeReaders[0];
 const b=r.applyBatches.find(b=>b.id==='alter-dbo.'+existing);assert(b.sql.startsWith('SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER OFF;'));
 assert(r.applyBatches.find(b=>b.id==='after-cas').sql.includes('B6_REVISION_MODULE_OPTIONS'));assert(r.inverseBatches.find(b=>b.id==='restore-dbo.'+existing).sql.startsWith('SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER OFF;'));
 assert(!r.applyBatches.some(b=>b.kind==='DECLARED_PERMISSION_DELTA'&&b.sql===`GRANT VIEW DEFINITION ON OBJECT::dbo.${existing} TO [${O.login}];`));assert(!r.inverseSQL.includes('REVOKE VIEW DEFINITION ON OBJECT::dbo.'+existing+' '));
 assert(r.inverseSQL.includes('REVOKE VIEW DEFINITION ON OBJECT::dbo.'+activeReaders[1]+' '));
 const missing=fullFixture();missing.moduleOptions=missing.moduleOptions.filter(o=>o.name!==existing);assert.throws(()=>prepare(missing),{code:'B6_REVISION_OPTIONS_REQUIRED'});
 const oid=fullFixture();oid.readerObjectIds[0].objectId=0;assert.throws(()=>prepare(oid),{code:'B6_REVISION_ACTIVE_OBJECT_ID'});
 const incomplete=fullFixture();incomplete.activeModules.pop();assert.throws(()=>prepare(incomplete),{code:'B6_REVISION_ACTIVE_INPUTS'});
});
test('native stored-header policy probe is new-owned, exact, fail-closed and precedes every existing module ALTER',()=>{
 const r=prepare(fullFixture()),p=r.headerProbe,index=r.applyBatches.findIndex(b=>b.id==='probe-stored-header-policy'),b=r.applyBatches[index];
 assert.equal(p.name,'dbo.usp_canonical_business_sale_header_probe_v1');assert.equal(p.persistent,false);assert.equal(p.nativeExecuted,false);assert.equal(r.newModules.length,31);
 assert(index>r.applyBatches.findIndex(b=>b.id==='target-before-cas'));assert(index<r.applyBatches.findIndex(b=>b.kind==='ALTER_EXACT_EXISTING_MODULE'));assert(index<r.applyBatches.findIndex(b=>b.kind==='CREATE_NEW_PRIVATE_METADATA'));
 assert(b.sql.startsWith(`IF OBJECT_ID(N'${p.name}') IS NOT NULL THROW 51917,'B6_REVISION_HEADER_PROBE_PREEXISTS',1;`));
 assert(r.applyBatches.find(b=>b.id==='target-before-cas').sql.includes(`IF OBJECT_ID(N'${p.name}') IS NOT NULL THROW`));
 assert.equal(p.createHash,hash(p.createDefinition));assert.equal(p.expectedStoredHash,hash(p.expectedStoredDefinition));assert.notEqual(hash(p.alterDefinition),p.expectedStoredHash);
 assert(p.createDefinition.endsWith('SELECT 1 AS b6_header_probe; END;'));assert(p.expectedStoredDefinition.endsWith('SELECT 2 AS b6_header_probe; END;'));assert.equal(p.alterDefinition.replace(/^ALTER /,'CREATE '),p.expectedStoredDefinition);
 assert(b.sql.includes("B6_REVISION_HEADER_ALTER_POLICY"));assert(b.sql.includes(p.expectedStoredHash));assert.match(b.sql,/OBJECT_ID\(.+,N'P'\),-1\)<>@b6_header_probe_id/);
 assert.equal((b.sql.match(/DROP PROCEDURE /g)||[]).length,1);assert(b.sql.includes('DROP PROCEDURE '+p.name+';'));assert(b.sql.indexOf('B6_REVISION_HEADER_ALTER_POLICY')<b.sql.indexOf('DROP PROCEDURE '));
 assert.doesNotMatch(b.sql,/CREATE OR ALTER|REPLACE\(|UPPER\(|LOWER\(|EXEC dbo\.usp_canonical_business_sale_header_probe/);assert.match(r.applySQL,/IF XACT_STATE\(\)<>0 ROLLBACK TRANSACTION; THROW/);
 assert(!r.inverseSQL.includes(p.name));assert(Object.isFrozen(p));assert.equal(r.nativeCompiled,false);
});
