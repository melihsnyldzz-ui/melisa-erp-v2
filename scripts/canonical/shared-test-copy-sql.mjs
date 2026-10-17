// Offline finite target adaptation of the existing Stage4 transaction engine.
// Never connects, installs, changes roles, or creates commercial records.
import crypto from 'node:crypto';
import {COPY_DB,COPY_LOGIN,COPY_MUTABLE_TABLES,moduleHash,stage4CopySchema,stage4ReadySQL,stage4BeginSQL,stage4EffectsSQL,stage4NativeGuardSQL,stage4RequestGuardSQL,immutableCopyTrigger,stage4GuardBranch,stage4ReadProcedure,stage4QuarantineProcedure} from './stage4-copy-sql.mjs';
import {stage4ContextSQL} from './stage4-copy-context-sql.mjs';
import {SHARED_COPY_DATABASE,ISOLATED_COPY_SOURCE_DATABASE,ISOLATED_COPY_SERVER,isolatedCopyHash,isolatedCopyJSON,validateIsolatedOperationCopyContext} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {validateCurrentProductCatalogContext} from '../../apps/api/src/services/currentProductCatalogContext.mjs';
import {CATALOG_SQL_PROOF} from '../../apps/api/src/services/catalogSqlProof.mjs';
import {expandPermissions,applyRolePermissionDefaults} from '../../apps/api/src/services/permissionCatalog.js';
export const SHARED_WRITER='melisa_shared_test_rw_20261009_01';
export const SHARED_READER='melisa_shared_test_ro_20261009_01';
const fail=code=>{throw Error(code);};
const check=(ok,code)=>{if(!ok)fail(code);};
const adapt=sql=>sql.replaceAll(COPY_DB,SHARED_COPY_DATABASE).replaceAll(COPY_LOGIN,SHARED_WRITER);
export function sharedActorPermissions(actor,rows){
 check(['15','16'].includes(actor?.id)&&actor.role===(actor.id==='15'?'isolated_test_sales':'isolated_test_ilker')&&Array.isArray(rows)&&rows.length>0,'SHARED_PERMISSION_ROWS');
 for(const row of rows)check(typeof row.permission_key==='string'&&row.permission_key.length>0&&['can_view','can_create','can_update','can_approve'].every(k=>[0,1,false,true].includes(row[k]))&&['can_view','can_create','can_update','can_approve'].some(k=>!!row[k]),'SHARED_PERMISSION_ROW_FLAGS');
 return applyRolePermissionDefaults(expandPermissions(rows),actor.role);
}
const compiled=entry=>{const definition=adapt(entry.definition);return {...entry,definition,afterHash:moduleHash(definition.replace(/^ALTER\b/i,'CREATE'))};};
const table=definition=>definition.match(/\bON\s+(?:\[dbo\]|dbo)\.(?:\[([a-zA-Z0-9_]+)\]|([a-zA-Z0-9_]+))/i)?.slice(1).find(Boolean);
export function preservedAggregate(modules,replacements){
 const rows=modules.filter(m=>m.type_desc==='SQL_TRIGGER'&&/^(operation_quarantine_|immutable_operation_|immutable_accepted_)/.test(m.name)).sort((a,b)=>a.name<b.name?-1:1);
 const first=rows.filter(m=>m.schemaName==='dbo'&&m.name.startsWith('operation_quarantine_'));
 const immutable=['immutable_accepted_price_manifest','immutable_accepted_price_products','immutable_accepted_price_values','immutable_operation_quarantine_manifest','immutable_operation_quarantine_holds'];
 check(rows.length===42&&first.length===37&&first.every(m=>[m.firstInsert,m.firstUpdate,m.firstDelete].every(v=>v===1||v===true))&&immutable.every(name=>rows.some(m=>m.schemaName==='erp_migration'&&m.name===name)),'SHARED_PRESERVED_TRIGGER_COUNT');
 const mapped=new Map(replacements.map(m=>[m.name,m.afterHash]));
 return moduleHash(rows.map(m=>{check((m.isDisabled===false||m.isDisabled===0)&&[m.firstInsert,m.firstUpdate,m.firstDelete].every(v=>[0,1,false,true].includes(v)),'SHARED_PRESERVED_TRIGGER_STATE');return [m.name,mapped.get(m.schemaName+'.'+m.name)||moduleHash(m.definition),0,Number(m.firstInsert),Number(m.firstUpdate),Number(m.firstDelete)].join('|');}).join(';'));
}
export function changedFirstOrders(modules,replacements){return modules.filter(m=>m.type_desc==='SQL_TRIGGER'&&[m.firstInsert,m.firstUpdate,m.firstDelete].some(Boolean)&&replacements.some(r=>r.name===m.schemaName+'.'+m.name)).map(m=>({name:m.schemaName+'.'+m.name,insert:Number(m.firstInsert),update:Number(m.firstUpdate),delete:Number(m.firstDelete)}));}
export function buildSharedCopyBundle(input){
 check(input?.identity?.server===ISOLATED_COPY_SERVER&&input.identity.database===SHARED_COPY_DATABASE,'SHARED_BUNDLE_IDENTITY');
 check(input.recoveryProof?.status==='PASS'&&input.recoveryProof.sourceBeforeAfterEqual===true&&input.recoveryProof.rawCopyMatchesSource===true&&/^[A-Fa-f0-9]{64}$/.test(input.backupSHA??'')&&/^[a-f0-9]{40}$/.test(input.sourceCommit??''),'SHARED_RAW_RESTORE_PROOF');
 const modules=input.modules,schema=input.schema;
 check(Array.isArray(modules)&&modules.length>=177&&Array.isArray(schema)&&schema.length>0&&new Set(modules.map(m=>m.schemaName+'.'+m.name)).size===modules.length,'SHARED_SOURCE_MODULES');
 for(const m of modules)check(typeof m.definition==='string'&&m.definition.length>0&&/^[a-zA-Z0-9_]+$/.test(m.name)&&/^[a-zA-Z0-9_]+$/.test(m.schemaName),'SHARED_SOURCE_MODULE');
 const profile=structuredClone(input.profile);delete profile.sealHash;
 Object.assign(profile,{copyId:crypto.randomUUID(),date:'2026-10-09',sourceDatabase:ISOLATED_COPY_SOURCE_DATABASE,sourceCommit:input.sourceCommit,backupSHA:input.backupSHA.toUpperCase(),target:{server:ISOLATED_COPY_SERVER,database:SHARED_COPY_DATABASE,login:SHARED_WRITER,databaseUser:SHARED_WRITER}});
 check(profile.schemaVersion==='melisa-stage4-isolated-operation-copy.v1'&&profile.operationOrigin==='ISOLATED_TEST_COPY'&&profile.actualT1===false,'SHARED_PROFILE_ORIGIN');
 check(profile.actors?.length===2&&profile.actors.every(a=>['15','16'].includes(a.id)&&a.nativeRoleId===a.id&&a.nativeRoleCode===a.role&&a.role===(a.id==='15'?'isolated_test_sales':'isolated_test_ilker')&&/^[A-Fa-f0-9]{64}$/.test(a.permissionsRowsHash??'')&&Array.isArray(a.permissions)),'SHARED_EXISTING_ACTOR_PINS');
 for(const actor of profile.actors)actor.permissions=sharedActorPermissions(actor,input.actorPermissionRows?.[actor.id]);
 profile.recoveryProof={...input.recoveryProof,schemaVersion:'melisa-shared-test.recovery-comparison.v1',comparedAt:input.recoveryProof.recordedAt};
 const current=validateCurrentProductCatalogContext(input.goal7SourceVersion);
 check(profile.currentProductSourceVersionRunId===current.runId,'SHARED_CURRENT_SOURCE_PIN');
 const replacements=[];
 for(const m of modules.filter(m=>m.schemaName==='dbo'&&m.type_desc==='SQL_TRIGGER')){
  if(/^(operation_quarantine_|supplier_identity_quarantine_v2_)/.test(m.name))replacements.push(compiled(stage4GuardBranch(m,{quarantine:true})));
  else if(COPY_MUTABLE_TABLES.includes(table(m.definition)))replacements.push(compiled(stage4GuardBranch(m)));
 }
 for(const m of modules.filter(m=>m.schemaName==='dbo'&&['usp_assert_operation_quarantine_v2','usp_check_operation_quarantine','usp_list_operation_quarantine'].includes(m.name)))replacements.push(compiled(stage4QuarantineProcedure(m)));
 check(replacements.some(m=>m.name==='dbo.usp_assert_operation_quarantine_v2'),'SHARED_NESTED_QUARANTINE_REQUIRED');
 const guardAggregate=preservedAggregate(modules,replacements);
 for(const name of Object.values(current.procedures)){
  const m=modules.find(m=>'dbo.'+m.name===name&&m.schemaName==='dbo');check(m,'SHARED_CURRENT_READER_REQUIRED');
  replacements.push(compiled(stage4ReadProcedure(m,guardAggregate,replacements)));
 }
 const add=(name,definition,kind='COPY_ONLY_PROOF')=>({name,definition:adapt(definition),afterHash:moduleHash(adapt(definition)),kind});
 const permissionsSQL="INSERT @permissions SELECT DISTINCT CONVERT(nvarchar(160),v.value) FROM OPENJSON(@p,'$.actors') WITH(id bigint '$.id',permissions nvarchar(max) '$.permissions' AS JSON)s CROSS APPLY OPENJSON(s.permissions)v WHERE s.id=@actor_id;";
 const copyContextSQL=stage4ContextSQL().replace("N'2026-10-08'","N'2026-10-09'").replace('INSERT @permissions SELECT DISTINCT permission_key FROM dbo.permissions WHERE role_id=@nativeRole AND can_view=1;',permissionsSQL);
 check(copyContextSQL.includes(permissionsSQL),'SHARED_CONTEXT_PERMISSION_SHAPE');
 const newDefinitions=[add('dbo.usp_stage4_copy_ready',stage4ReadySQL()),add('dbo.usp_stage4_copy_context',copyContextSQL),add('dbo.usp_stage4_copy_begin',stage4BeginSQL()),add('dbo.usp_stage4_copy_effects',stage4EffectsSQL()),add('dbo.usp_stage4_copy_guard',stage4NativeGuardSQL(schema)),add('dbo.stage4_copy_requests_guard',stage4RequestGuardSQL())];
 for(const name of ['stage4_copy_manifest','stage4_copy_module_manifest','stage4_copy_effect_components'])newDefinitions.push(add('dbo.immutable_'+name,immutableCopyTrigger('dbo.immutable_'+name,'dbo.'+name),'COPY_PROOF_IMMUTABLE'));
 for(const name of COPY_MUTABLE_TABLES.filter(name=>schema.some(c=>c.schemaName==='dbo'&&c.tableName===name))){
  newDefinitions.push(add('dbo.stage4_guard_'+name,`CREATE TRIGGER dbo.stage4_guard_${name} ON dbo.${name} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;DECLARE @i nvarchar(max)=(SELECT * FROM inserted FOR JSON PATH,INCLUDE_NULL_VALUES),@d nvarchar(max)=(SELECT * FROM deleted FOR JSON PATH,INCLUDE_NULL_VALUES);EXEC dbo.usp_stage4_copy_guard @table_name=N'${name}',@inserted=@i,@deleted=@d;END;`,'FINITE_COPY_NATIVE_GUARD'));
 }
 profile.sql=Object.fromEntries(Object.entries({ready:'dbo.usp_stage4_copy_ready',context:'dbo.usp_stage4_copy_context',begin:'dbo.usp_stage4_copy_begin',effects:'dbo.usp_stage4_copy_effects'}).map(([key,name])=>[key,{name,hash:newDefinitions.find(m=>m.name===name).afterHash}]));
 const changedHashes=new Map(replacements.map(m=>[m.beforeHash,m.afterHash]));
 profile.catalogProof=Object.fromEntries(Object.entries(CATALOG_SQL_PROOF).map(([key,value])=>[key,key==='preservedGuardHash'?guardAggregate:changedHashes.get(value)||value]));
 const sealHash=isolatedCopyHash(profile);profile.sealHash=sealHash;
 validateIsolatedOperationCopyContext(profile);
 const goal7SourceVersion={...current};for(const [key,procedure] of [['readerDefinitionHash','catalog'],['stockReaderDefinitionHash','stock'],['openingDetailDefinitionHash','detail'],['openingListDefinitionHash','list']])goal7SourceVersion[key]=replacements.find(m=>m.name===current.procedures[procedure]).afterHash;
 const config={host:'127.0.0.1',lanHost:'192.168.1.46',webPort:5224,erpPort:4174,nativePort:4176,server:ISOLATED_COPY_SERVER,database:SHARED_COPY_DATABASE,sqlUser:SHARED_READER,sqlPassword:crypto.randomBytes(48).toString('hex'),salesSqlUser:SHARED_WRITER,salesSqlPassword:crypto.randomBytes(48).toString('hex'),jwtAccessSecret:crypto.randomBytes(48).toString('hex'),jwtRefreshSecret:crypto.randomBytes(48).toString('hex'),copyContext:profile,goal7SourceVersion};
 for(const key of ['catalogMediaRoot','catalogMediaIndexSha256','catalogClassificationRoot','catalogClassificationIndexSha256'])config[key]=input[key];
 return {schemaSQL:adapt(stage4CopySchema()),copyId:profile.copyId,replacements,newDefinitions,moduleManifest:[...replacements,...newDefinitions].map(({name,beforeHash=null,afterHash,kind})=>({name,beforeHash,afterHash,kind})),originalFirstOrder:changedFirstOrders(modules,replacements),profileJSON:isolatedCopyJSON(profile),config,guardAggregate,createdAt:new Date().toISOString(),businessWrites:0,normalRolesChanged:false};
}
