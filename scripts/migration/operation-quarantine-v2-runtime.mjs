// Transaction-bound additive protection. Importing opens no connection and writes nothing.
import {createHash} from 'node:crypto';
import {guardTables,guardSql,guardSqlV2,guardSqlV1Metadata,readerSqlV2,assertQuarantineV2Sql,QUARANTINE_V2_PROOF_DDL,QUARANTINE_V2_PROOF_TRIGGER,QUARANTINE_V2_COMPAT_DDL,QUARANTINE_V2_COMPAT_TRIGGER,QUARANTINE_V2_MODULES,QUARANTINE_V2_LEGACY_MODULES,QUARANTINE_RESOLVER_V2_HASH} from './operation-quarantine-sql.mjs';
import {targetGuard} from './opening-target-contract.mjs';
const rule=(v,c)=>{if(!v)throw new Error(c);};
export const quarantineSqlHash=s=>createHash('sha256').update(s,'utf16le').digest('hex');
const literal=s=>"N'"+s.replaceAll("'","''")+"'";
const rows=r=>Array.isArray(r)?r:r.recordset??r.rows??[];
const alter=s=>s.replace(/^CREATE (TRIGGER|PROCEDURE) /,'ALTER $1 ');
const originals=guardTables.map(t=>'dbo.operation_quarantine_'+t);
const readers=['dbo.usp_check_operation_quarantine','dbo.usp_list_operation_quarantine'];
export function normalizeQuarantineDefinitions(definitions){return definitions.map(r=>({object_name:r.object_name??r.schema+'.'+r.name,definition_hash:(r.definition_hash??r.hash).toLowerCase()})).sort((a,b)=>a.object_name.localeCompare(b.object_name,'en'));}
export const serializeQuarantineDefinitions=definitions=>JSON.stringify(normalizeQuarantineDefinitions(definitions));
const readSql=names=>`SELECT s.name+N'.'+o.name object_name,OBJECT_DEFINITION(o.object_id) definition,LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2)) definition_hash FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE s.name+N'.'+o.name IN(${names.map(literal).join(',')}) ORDER BY object_name;`;
const permissionSql=`SELECT LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',COALESCE((SELECT * FROM sys.database_permissions ORDER BY class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')),2)) hash;`;
const preservedSql=`IF (SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(name,N'|',CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(object_id)),2),N'|',is_disabled,N'|',OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger'),N'|',OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger'),N'|',OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger'))),N';') WITHIN GROUP(ORDER BY name)),2) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%' OR name LIKE N'immutable[_]operation[_]%' OR name LIKE N'immutable[_]accepted[_]%')<>'9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E' THROW 51076,'QUARANTINE_LEGACY_AGGREGATE_DRIFT',1;`;
const order=t=>['INSERT','UPDATE','DELETE'].map(e=>`EXEC sys.sp_settriggerorder @triggername=N'dbo.operation_quarantine_${t}',@order=N'First',@stmttype=N'${e}';`).join('');
function validateSet(values,names,code){rule(Array.isArray(values)&&values.length===names.length&&new Set(values.map(r=>r.object_name??r.schema+'.'+r.name)).size===names.length&&names.every(n=>values.some(r=>(r.object_name??r.schema+'.'+r.name)===n&&/^[a-f0-9]{64}$/i.test(r.definition_hash??r.hash))),code);}
async function cas(query,expected,names,code){validateSet(expected,names,code);const actual=rows(await query(readSql(names)));rule(serializeQuarantineDefinitions(actual)===serializeQuarantineDefinitions(expected),code);return actual;}
async function start(query){rule(typeof query==='function','QUARANTINE_INSTALL_QUERY_REQUIRED');await query(`${targetGuard} IF IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN())<>1 OR @@TRANCOUNT<1 OR XACT_STATE()<>1 OR NOT EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE session_id=@@SPID AND transaction_isolation_level=4) THROW 51076,'QUARANTINE_INSTALL_TRANSACTION_REQUIRED',1;DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'OPERATION-QUARANTINE-V2',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;IF @lock<0 THROW 51076,'QUARANTINE_INSTALL_LOCK',1;`);}
async function restoreOriginal(query,row){
 rule(/^CREATE TRIGGER /i.test(row.definition),'QUARANTINE_ORIGINAL_CREATE_REQUIRED');
 const grant=rows(await query(`SELECT COUNT(*) count FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(${literal(row.object_name)});`))[0];rule(grant?.count===0,'QUARANTINE_ORIGINAL_OBJECT_GRANTS');
 await query(`DROP TRIGGER ${row.object_name};`);await query(row.definition);await query(order(row.object_name.slice('dbo.operation_quarantine_'.length)));
}
export function additiveQuarantineDefinitions(seal){return new Map([...guardTables.map(t=>['dbo.operation_quarantine_'+t,guardSql(t,seal)]),...guardTables.map(t=>['dbo.supplier_identity_quarantine_v2_'+t,guardSqlV2(t,seal)]),[readers[0],readerSqlV2('check',seal)],[readers[1],readerSqlV2('list',seal)],['dbo.usp_assert_operation_quarantine_v2',assertQuarantineV2Sql()],['erp_migration.immutable_supplier_identity_quarantine_v2',QUARANTINE_V2_PROOF_TRIGGER],['erp_migration.immutable_supplier_identity_quarantine_compat_v2',QUARANTINE_V2_COMPAT_TRIGGER]]);}
async function publishProof(query,{seal,originalRows,previousDefinitions,metadataManifestHash,mode}){
 rule(/^[a-f0-9]{64}$/.test(metadataManifestHash??''),'QUARANTINE_COMPAT_MANIFEST_REQUIRED');
 const defs=additiveQuarantineDefinitions(seal);
 await query(QUARANTINE_V2_PROOF_DDL);await query(QUARANTINE_V2_COMPAT_DDL);
 for(const [name,body]of defs){if(originals.includes(name)||name.startsWith('erp_migration.immutable_'))continue;await query(readers.includes(name)||name==='dbo.usp_assert_operation_quarantine_v2'&&mode==='UPGRADE'?alter(body):body);}
 const observed=rows(await query(readSql(QUARANTINE_V2_MODULES.filter(n=>!n.startsWith('erp_migration.immutable_')))));
 rule(observed.length===77,'QUARANTINE_INSTALL_READBACK_COUNT');
 for(const r of observed){const expected=originalRows.find(p=>p.object_name===r.object_name)?.definition??defs.get(r.object_name);rule(expected&&(r.definition_hash===quarantineSqlHash(expected)||!originals.includes(r.object_name)&&r.definition_hash===quarantineSqlHash(alter(expected))),'QUARANTINE_INSTALL_READBACK_DRIFT');}
 const pins=normalizeQuarantineDefinitions([...observed,...[QUARANTINE_V2_MODULES.at(-2),QUARANTINE_V2_MODULES.at(-1)].map(object_name=>({object_name,definition_hash:quarantineSqlHash(defs.get(object_name))}))]);
 const previous_definitions_json=serializeQuarantineDefinitions(previousDefinitions),original_definitions_json=serializeQuarantineDefinitions(originalRows),new_definitions_json=serializeQuarantineDefinitions(pins);
 const body={mode,historical_manifest_hash:metadataManifestHash,previous_definitions_hash:quarantineSqlHash(previous_definitions_json),original_definitions_hash:quarantineSqlHash(original_definitions_json),new_definitions_hash:quarantineSqlHash(new_definitions_json)},record_json=JSON.stringify(body),record_hash=quarantineSqlHash(record_json);
 await query(`INSERT erp_migration.operation_quarantine_resolver_v2(object_name,definition_hash,resolver_hash,sealed) VALUES ${pins.map(p=>`(${literal(p.object_name)},'${p.definition_hash}','${QUARANTINE_RESOLVER_V2_HASH}',1)`).join(',')};`);
 await query(`INSERT erp_migration.operation_quarantine_compatibility_v2 VALUES(1,${literal(mode)},'${metadataManifestHash}',${literal(previous_definitions_json)},'${body.previous_definitions_hash}',${literal(original_definitions_json)},'${body.original_definitions_hash}',${literal(new_definitions_json)},'${body.new_definitions_hash}',${literal(record_json)},'${record_hash}');`);
 await query(QUARANTINE_V2_PROOF_TRIGGER);await query(QUARANTINE_V2_COMPAT_TRIGGER);await query('EXEC dbo.usp_assert_operation_quarantine_v2;');
 return {resolverHash:QUARANTINE_RESOLVER_V2_HASH,pins,compatibility:{...body,record_hash}};
}
export async function upgradeToAdditiveV2({query,seal,originalDefinitions,currentDefinitions,metadataManifestHash}={}){
 validateSet(originalDefinitions,originals,'QUARANTINE_ORIGINALS_REQUIRED');validateSet(currentDefinitions,QUARANTINE_V2_LEGACY_MODULES,'QUARANTINE_CURRENT41_REQUIRED');
 rule(metadataManifestHash==='4dd3285c2ade83e8823c37e951b01241dea3a9e72ff8bd6a11287bda250a5662'&&quarantineSqlHash(serializeQuarantineDefinitions(currentDefinitions))==='9440b9cb8e73555c020c5c90ee3acb04e74e7ce30f1496680775cd3855bea3d1','QUARANTINE_HISTORICAL_BINDING_REQUIRED');
 rule(quarantineSqlHash(serializeQuarantineDefinitions(originalDefinitions))==='5d9cd41555f027f9dbbb045f1ad6bb7077dda71af9840e23003f716fada3270b','QUARANTINE_ORIGINAL_BINDING_REQUIRED');
 rule(originalDefinitions.every(r=>typeof r.definition==='string'&&quarantineSqlHash(r.definition)===(r.definition_hash??r.hash).toLowerCase()),'QUARANTINE_ORIGINAL_BODY_DRIFT');
 await start(query);await cas(query,currentDefinitions,QUARANTINE_V2_LEGACY_MODULES,'QUARANTINE_CURRENT41_DRIFT');await query('EXEC dbo.usp_assert_operation_quarantine_v2;');
 const oldProof=rows(await query('SELECT object_name,definition_hash,resolver_hash,sealed FROM erp_migration.operation_quarantine_resolver_v2 ORDER BY object_name;'));rule(oldProof.length===41&&oldProof.every(r=>r.resolver_hash===QUARANTINE_RESOLVER_V2_HASH&&r.sealed===true||r.resolver_hash===QUARANTINE_RESOLVER_V2_HASH&&r.sealed===1)&&serializeQuarantineDefinitions(oldProof)===serializeQuarantineDefinitions(currentDefinitions),'QUARANTINE_CURRENT41_PROOF_DRIFT');
 const perms=rows(await query(permissionSql))[0]?.hash;rule(/^[a-f0-9]{64}$/.test(perms??''),'QUARANTINE_PERMISSION_PROOF_REQUIRED');
 await query(`IF OBJECT_ID(N'erp_migration.operation_quarantine_compatibility_v2') IS NOT NULL OR EXISTS(SELECT 1 FROM sys.triggers WHERE name LIKE N'supplier[_]identity[_]quarantine[_]v2[_]%') THROW 51076,'QUARANTINE_ADDITIVE_ALREADY_PRESENT',1;DROP TRIGGER erp_migration.immutable_operation_quarantine_resolver_v2;DROP TABLE erp_migration.operation_quarantine_resolver_v2;`);
 for(const row of originalDefinitions)await restoreOriginal(query,{...row,object_name:row.object_name??row.schema+'.'+row.name});
 const result=await publishProof(query,{seal,originalRows:originalDefinitions,previousDefinitions:currentDefinitions,metadataManifestHash,mode:'UPGRADE'});
 await cas(query,originalDefinitions,originals,'QUARANTINE_ORIGINALS_RESTORE_DRIFT');await query(preservedSql);rule(rows(await query(permissionSql))[0]?.hash===perms,'QUARANTINE_PERMISSION_DRIFT');return result;
}
export async function installQuarantineV2({query,seal,beforeDefinitions,metadataPredicates={},metadataManifestHash}={}){
 rule(/^[a-f0-9]{64}$/.test(metadataManifestHash??''),'QUARANTINE_COMPAT_MANIFEST_REQUIRED');
 validateSet(beforeDefinitions,[...originals,...readers],'QUARANTINE_INSTALL_BEFORE_REQUIRED');await start(query);
 const before=await cas(query,beforeDefinitions,[...originals,...readers],'QUARANTINE_INSTALL_BEFORE_DRIFT');
 await query(`IF OBJECT_ID(N'erp_migration.operation_quarantine_resolver_v2') IS NOT NULL OR OBJECT_ID(N'erp_migration.operation_quarantine_compatibility_v2') IS NOT NULL OR OBJECT_ID(N'dbo.usp_assert_operation_quarantine_v2') IS NOT NULL THROW 51076,'QUARANTINE_INSTALL_ALREADY_PRESENT',1;`);
 const perms=rows(await query(permissionSql))[0]?.hash,originalRows=before.filter(r=>originals.includes(r.object_name));
 rule(/^[a-f0-9]{64}$/.test(perms??''),'QUARANTINE_PERMISSION_PROOF_REQUIRED');
 const result=await publishProof(query,{seal,originalRows,previousDefinitions:before,metadataManifestHash,mode:'INITIAL'});
 for(const [table,predicate]of Object.entries(metadataPredicates)){await query(alter(guardSqlV1Metadata(table,seal,{metadataExceptionSql:predicate})));await query(order(table));await query(alter(guardSqlV2(table,seal,{metadataExceptionSql:predicate})));}
 let finalized=false;
 return {...result,async finalize(){rule(!finalized,'QUARANTINE_INSTALL_FINALIZED');for(const table of Object.keys(metadataPredicates)){await restoreOriginal(query,originalRows.find(r=>r.object_name==='dbo.operation_quarantine_'+table));await query(alter(guardSqlV2(table,seal)));}await cas(query,originalRows,originals,'QUARANTINE_ORIGINALS_RESTORE_DRIFT');await query('EXEC dbo.usp_assert_operation_quarantine_v2;');await query(preservedSql);rule(rows(await query(permissionSql))[0]?.hash===perms,'QUARANTINE_PERMISSION_DRIFT');finalized=true;return result;}};
}
