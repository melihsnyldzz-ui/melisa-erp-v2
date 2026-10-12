// Forward-only v9. The original 185-module manifest and v6/v7/v8 stay immutable.
// This compiler has no SQL connection or file writer; an operator applies its DDL.
import {createHash} from 'node:crypto';
import {moduleHash} from './stage4-copy-sql.mjs';
import {buildBusinessSelectedSaleParentRevision,SELECTED_SALE_PARENT_REGISTRY,SELECTED_SALE_PARENT_IMMUTABLE} from './shared-business-selected-sale-parent-revision-sql.mjs';
import {SELECTED_SALE_REGISTRY,SELECTED_SALE_IMMUTABLE} from './shared-business-selected-sale-revision-contract.mjs';
import {SELECTED_SALE_EFFECTS_REGISTRY,SELECTED_SALE_EFFECTS_IMMUTABLE} from './shared-business-selected-sale-effects-revision-sql.mjs';
import {prepareSupplierItemQuarantineRevision,SUPPLIER_ITEM_QUARANTINE_BASE} from './shared-business-supplier-item-quarantine-revision.mjs';
import {assertIsolatedCopyContext,isolatedCopyHash,isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';

export const SUPPLIER_ITEM_QUARANTINE_REGISTRY='dbo.stage4_copy_supplier_item_quarantine_revisions';
export const SUPPLIER_ITEM_QUARANTINE_IMMUTABLE='dbo.immutable_stage4_copy_supplier_item_quarantine_revisions';
export const SUPPLIER_ITEM_QUARANTINE_MODULES=Object.freeze(['dbo.supplier_identity_quarantine_v2_sales_invoice_items','dbo.usp_stage4_copy_ready','dbo.usp_business_daily_context','dbo.usp_business_selected_sale_context_v2','dbo.usp_business_selected_sale_write_intent_v1']);
export const SUPPLIER_ITEM_QUARANTINE_REVISION_KEYS=Object.freeze(['schemaVersion','version','copyId','baseSealHash','baseSelectedRevisionHash','baseEffectsRevisionHash','baseParentRevisionHash','profileHash','modules','immutableTriggerHash','optimization','transformation','revisionHash']);
const prepared=new WeakMap(),check=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.toSorted().join();
const hex=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const lit=v=>"N'"+String(v).replaceAll("'","''")+"'";
const hash=name=>`CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(${name}))),2)`;
const once=(s,a,b,code)=>{check(s.split(a).length===2,code);return s.replace(a,b);};
const transformationKeys=['sourceUtf8Hash','beforeStatementHash','afterStatementHash','semanticDefinitionHash','prefixHash','suffixHash','productPredicateHash','invoicePredicateHash'];

export function validateSupplierItemQuarantineSource(input){
 const base=SUPPLIER_ITEM_QUARANTINE_BASE;
 check(exact(input,['name','definition','nativeHash','utf8Hash'])&&input.name===base.name&&input.nativeHash===base.definitionSha256.toUpperCase()&&input.utf8Hash===base.sourceUtf8Sha256.toUpperCase(),'SUPPLIER_ITEM_PRIVATE_SOURCE');
 // Exact UTF8 bytes and native UTF16 definition, including the original header.
 check(typeof input.definition==='string'&&createHash('sha256').update(input.definition,'utf8').digest('hex').toUpperCase()===input.utf8Hash,'SUPPLIER_ITEM_PRIVATE_SOURCE_BYTES');
 return prepareSupplierItemQuarantineRevision(input.definition);
}

export function quarantineRevisionHeaders(definition,type){
 check(['PROCEDURE','TRIGGER'].includes(type)&&typeof definition==='string','SUPPLIER_ITEM_HEADER_TYPE');
 const canonical=definition.replace(new RegExp(`^(?:CREATE OR ALTER|CREATE  |ALTER) ${type} `),`CREATE ${type} `);
 check(canonical.startsWith(`CREATE ${type} `)&&!canonical.includes('\r'),'SUPPLIER_ITEM_HEADER');
 return Object.freeze({executionSQL:canonical.replace(`CREATE ${type} `,`CREATE OR ALTER ${type} `),storedDefinition:canonical.replace(`CREATE ${type} `,`CREATE   ${type} `)});
}

export function validateSupplierItemQuarantineRevision(copy,base,effects,parent,revision){
 assertIsolatedCopyContext(copy);
 check(base&&effects&&parent&&exact(revision,SUPPLIER_ITEM_QUARANTINE_REVISION_KEYS)&&revision.schemaVersion==='melisa-supplier-item-quarantine-parent-revision.v1'&&revision.version===9&&revision.copyId===copy.copyId&&revision.baseSealHash===copy.sealHash&&revision.baseSelectedRevisionHash===base.revisionHash&&revision.baseEffectsRevisionHash===effects.revisionHash&&revision.baseParentRevisionHash===parent.revisionHash&&revision.profileHash===isolatedCopyHash(copy)&&revision.optimization==='DISTINCT_AFFECTED_PRODUCT_AND_INVOICE','SUPPLIER_ITEM_BOOT_REVISION');
 check(Array.isArray(revision.modules)&&revision.modules.length===5&&revision.modules.every((m,i)=>exact(m,['name','beforeHash','afterHash'])&&m.name===SUPPLIER_ITEM_QUARANTINE_MODULES[i]&&hex(m.afterHash)&&m.beforeHash===(i===0?SUPPLIER_ITEM_QUARANTINE_BASE.definitionSha256.toUpperCase():parent.modules.find(p=>p.name===m.name)?.afterHash)&&m.beforeHash!==m.afterHash),'SUPPLIER_ITEM_BOOT_PREDECESSOR_PINS');
 const t=revision.transformation,{revisionHash,...body}=revision;
 check(exact(t,transformationKeys)&&transformationKeys.every(k=>hex(t[k]))&&t.sourceUtf8Hash===SUPPLIER_ITEM_QUARANTINE_BASE.sourceUtf8Sha256.toUpperCase()&&t.beforeStatementHash===SUPPLIER_ITEM_QUARANTINE_BASE.statementSha256.toUpperCase()&&hex(revision.immutableTriggerHash)&&hex(revisionHash)&&revisionHash===isolatedCopyHash(body),'SUPPLIER_ITEM_BOOT_SEAL');
 return revision;
}

export function buildSupplierItemQuarantineParentRevision(input){
 const {copy,supplierItemQuarantineSource}=input;assertIsolatedCopyContext(copy);
 const leaf=validateSupplierItemQuarantineSource(supplierItemQuarantineSource),prior=buildBusinessSelectedSaleParentRevision(input),base=prior.baseSelectedRevision,effects=prior.baseEffectsRevision,parent=prior.revision;
 const pins=SUPPLIER_ITEM_QUARANTINE_MODULES.map((name,i)=>({name,beforeHash:i===0?leaf.beforeHash.toUpperCase():parent.modules.find(m=>m.name===name).afterHash}));
 const names=pins.map(m=>lit(m.name)).join(','),values=ms=>ms.map(m=>`(${lit(m.name)},${m.beforeHash?lit(m.beforeHash):'CAST(NULL AS char(64))'},${lit(m.afterHash)})`).join(',');
 const tableSQL=`CREATE TABLE ${SUPPLIER_ITEM_QUARANTINE_REGISTRY}(copy_id uniqueidentifier NOT NULL REFERENCES dbo.stage4_copy_manifest(copy_id),name sysname NOT NULL CHECK(name IN(${names})),revision int NOT NULL CHECK(revision=9),base_seal_hash char(64) NOT NULL,base_selected_revision_hash char(64) NOT NULL,base_effects_revision_hash char(64) NOT NULL,base_parent_revision_hash char(64) NOT NULL,profile_hash char(64) NOT NULL,before_hash char(64) NOT NULL,after_hash char(64) NOT NULL,revision_hash char(64) NOT NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),PRIMARY KEY(copy_id,name));`;
 const schemaColumns=[['copy_id',36,16],['name',231,256],['revision',56,4],...['base_seal_hash','base_selected_revision_hash','base_effects_revision_hash','base_parent_revision_hash','profile_hash','before_hash','after_hash','revision_hash'].map(n=>[n,175,64]),['created_at',42,8]];
 const expectedSchema=`SELECT v.name COLLATE Latin1_General_100_BIN2 name,v.type_id,v.max_length,v.is_nullable FROM(VALUES ${schemaColumns.map(([n,t,l])=>`(${lit(n)},${t},${l},0)`).join(',')})v(name,type_id,max_length,is_nullable)`;
 const actualSchema=`SELECT c.name COLLATE Latin1_General_100_BIN2 name,c.system_type_id,c.max_length,c.is_nullable FROM sys.columns c WHERE c.object_id=OBJECT_ID(N'${SUPPLIER_ITEM_QUARANTINE_REGISTRY}',N'U')`;
 const schemaProof=`IF EXISTS(${actualSchema} EXCEPT ${expectedSchema}) OR EXISTS(${expectedSchema} EXCEPT ${actualSchema}) THROW 51904,'SUPPLIER_ITEM_SCHEMA_DRIFT',1;`;
 const historyProof=[
  [SELECTED_SALE_REGISTRY,SELECTED_SALE_IMMUTABLE,base,6,10,`r.base_daily_revision_hash<>${lit(base.baseDailyRevisionHash)} OR r.base_profit_revision_hash<>${lit(base.baseProfitRevisionHash)}`],
  [SELECTED_SALE_EFFECTS_REGISTRY,SELECTED_SALE_EFFECTS_IMMUTABLE,effects,7,4,`r.base_selected_revision_hash<>${lit(base.revisionHash)}`],
  [SELECTED_SALE_PARENT_REGISTRY,SELECTED_SALE_PARENT_IMMUTABLE,parent,8,4,`r.base_selected_revision_hash<>${lit(base.revisionHash)} OR r.base_effects_revision_hash<>${lit(effects.revisionHash)}`],
 ].map(([table,trigger,rev,version,count,links])=>`IF(SELECT COUNT(*) FROM ${table})<>${count} OR ISNULL(OBJECTPROPERTY(OBJECT_ID(N'${trigger}'),'ExecIsTriggerDisabled'),1)<>0 OR ISNULL(${hash(lit(trigger))},'')<>${lit(rev.immutableTriggerHash)} OR EXISTS(SELECT 1 FROM ${table} r LEFT JOIN(VALUES ${values(rev.modules)})p(name,before_hash,after_hash) ON p.name=r.name WHERE p.name IS NULL OR r.copy_id<>${lit(copy.copyId)} OR r.revision<>${version} OR r.base_seal_hash<>${lit(copy.sealHash)} OR ${links} OR r.profile_hash<>${lit(rev.profileHash)} OR r.revision_hash<>${lit(rev.revisionHash)} OR ISNULL(r.before_hash,'')<>ISNULL(p.before_hash,'') OR r.after_hash<>p.after_hash) THROW 51904,'SUPPLIER_ITEM_HISTORY_DRIFT',1;`).join('\n');
 const baseline=`IF(SELECT COUNT(*) FROM dbo.stage4_copy_manifest)<>1 OR(SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest)<>185 OR(SELECT COUNT(*) FROM dbo.stage4_copy_business_daily_revisions)<>8 OR(SELECT COUNT(*) FROM dbo.stage4_copy_business_daily_profit_revisions)<>3 OR NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_manifest m WHERE m.copy_id=${lit(copy.copyId)} AND m.sealed=1 AND m.seal_hash=${lit(copy.sealHash)} AND CONVERT(varchar(64),HASHBYTES('SHA2_256',m.profile_json),2)=${lit(isolatedCopyHash(copy))}) OR(SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest WHERE name=N'${pins[0].name}' AND after_hash=${lit(pins[0].beforeHash)})<>1 THROW 51904,'SUPPLIER_ITEM_BASELINE_DRIFT',1;`;
 const beforeValues=pins.map(m=>`(${lit(m.name)},${lit(m.beforeHash)})`).join(',');
 const identity=`DB_NAME() COLLATE Latin1_General_100_BIN2<>${lit(copy.target.database)} OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>${lit(copy.target.server)}`;
 const rowsInvalid=alias=>`${alias}.copy_id<>${lit(copy.copyId)} OR ${alias}.revision<>9 OR ${alias}.base_seal_hash<>${lit(copy.sealHash)} OR ${alias}.base_selected_revision_hash<>${lit(base.revisionHash)} OR ${alias}.base_effects_revision_hash<>${lit(effects.revisionHash)} OR ${alias}.base_parent_revision_hash<>${lit(parent.revisionHash)} OR ${alias}.profile_hash<>${lit(parent.profileHash)} OR ${alias}.before_hash<>p.before_hash OR ${alias}.before_hash=${alias}.after_hash OR ${alias}.after_hash<>ISNULL(${hash(alias+'.name')},'') OR ${alias}.revision_hash COLLATE Latin1_General_100_BIN2 LIKE '%[^A-F0-9]%' OR (${alias}.name=N'${pins[0].name}' AND (OBJECT_ID(${alias}.name,N'TR') IS NULL OR ISNULL(OBJECTPROPERTY(OBJECT_ID(${alias}.name),'ExecIsTriggerDisabled'),1)<>0 OR NOT EXISTS(SELECT 1 FROM sys.triggers q WHERE q.object_id=OBJECT_ID(${alias}.name) AND q.parent_id=OBJECT_ID(N'dbo.sales_invoice_items') AND q.is_instead_of_trigger=0))) OR (${alias}.name<>N'${pins[0].name}' AND OBJECT_ID(${alias}.name,N'P') IS NULL)`;
 const immutableSQL=`CREATE TRIGGER ${SUPPLIER_ITEM_QUARANTINE_IMMUTABLE} ON ${SUPPLIER_ITEM_QUARANTINE_REGISTRY} WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;
IF ${identity} OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 OR EXISTS(SELECT 1 FROM deleted) OR(SELECT COUNT(*) FROM inserted)<>5 OR(SELECT COUNT(*) FROM ${SUPPLIER_ITEM_QUARANTINE_REGISTRY})<>5 OR(SELECT COUNT(DISTINCT revision_hash) FROM inserted)<>1 THROW 51904,'SUPPLIER_ITEM_IMMUTABLE',1;
${schemaProof}
${baseline}
${historyProof}
IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN(VALUES ${beforeValues})p(name,before_hash) ON p.name=i.name WHERE p.name IS NULL OR ${rowsInvalid('i')}) THROW 51904,'SUPPLIER_ITEM_IMMUTABLE_PIN',1;
END;`;
 const triggerHash=moduleHash(immutableSQL),currentProof=`IF ${identity} THROW 51904,'SUPPLIER_ITEM_TARGET',1;
${schemaProof}
${baseline}
IF(SELECT COUNT(*) FROM ${SUPPLIER_ITEM_QUARANTINE_REGISTRY})<>5 OR(SELECT COUNT(DISTINCT revision_hash) FROM ${SUPPLIER_ITEM_QUARANTINE_REGISTRY})<>1 OR ISNULL(OBJECTPROPERTY(OBJECT_ID(N'${SUPPLIER_ITEM_QUARANTINE_IMMUTABLE}'),'ExecIsTriggerDisabled'),1)<>0 OR ISNULL(${hash(lit(SUPPLIER_ITEM_QUARANTINE_IMMUTABLE))},'')<>${lit(triggerHash)} OR EXISTS(SELECT 1 FROM ${SUPPLIER_ITEM_QUARANTINE_REGISTRY} r LEFT JOIN(VALUES ${beforeValues})p(name,before_hash) ON p.name=r.name WHERE p.name IS NULL OR ${rowsInvalid('r')}) THROW 51904,'SUPPLIER_ITEM_REVISION_DRIFT',1;
${historyProof}`;
 const project=(actual,name)=>`COALESCE((SELECT q.before_hash FROM ${SUPPLIER_ITEM_QUARANTINE_REGISTRY} q WHERE q.copy_id=@copy_id AND q.revision=9 AND q.name=${name} AND q.base_parent_revision_hash=${lit(parent.revisionHash)} AND q.after_hash=${actual}),${actual})`;
 const source=name=>prior.replacements.find(m=>m.name===name).storedDefinition;
 let ready=source('dbo.usp_stage4_copy_ready'),projections=0;
 ready=ready.replace(/CONVERT\(varchar\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION\((@@PROCID|OBJECT_ID\(([a-z]+\.name)\)|o\.object_id)\)\),2\)/g,(actual,object,alias)=>{projections++;return project(actual,object==='@@PROCID'?lit('dbo.usp_stage4_copy_ready'):object==='o.object_id'?'p.name':alias);});
 check(projections>0&&ready.includes(project(hash('e.name'),'e.name')),'SUPPLIER_ITEM_READY_PROJECTION');
 const opening=ready.includes('AS BEGIN SET NOCOUNT ON;')?'AS BEGIN SET NOCOUNT ON;':'AS BEGIN ';
 ready=once(ready,opening,opening+'\n'+currentProof+'\n','SUPPLIER_ITEM_READY_GATE');
 const v6=name=>`(SELECT after_hash FROM ${SELECTED_SALE_REGISTRY} WHERE copy_id=@copy_id AND revision=6 AND name=N'${name}')`;
 const v7=name=>`COALESCE((SELECT e.after_hash FROM ${SELECTED_SALE_EFFECTS_REGISTRY} e JOIN ${SELECTED_SALE_REGISTRY} s ON s.copy_id=e.copy_id AND s.name=e.name AND s.revision=6 AND s.after_hash=e.before_hash WHERE e.copy_id=@copy_id AND e.revision=7 AND e.name=N'${name}' AND e.base_selected_revision_hash=${lit(base.revisionHash)}),${v6(name)})`;
 const v8=name=>`COALESCE((SELECT t.after_hash FROM ${SELECTED_SALE_PARENT_REGISTRY} t WHERE t.copy_id=@copy_id AND t.revision=8 AND t.name=N'${name}' AND t.base_selected_revision_hash=${lit(base.revisionHash)} AND t.base_effects_revision_hash=${lit(effects.revisionHash)} AND t.before_hash=${v7(name)}),${v7(name)})`;
 const v9=name=>`COALESCE((SELECT q.after_hash FROM ${SUPPLIER_ITEM_QUARANTINE_REGISTRY} q WHERE q.copy_id=@copy_id AND q.revision=9 AND q.name=N'${name}' AND q.base_parent_revision_hash=${lit(parent.revisionHash)} AND q.before_hash=${v8(name)}),${v8(name)})`;
 let daily=source('dbo.usp_business_daily_context');
 for(const name of ['ready','context','begin','effects'].map(k=>'dbo.usp_stage4_copy_'+k))daily=once(daily,v8(name),v9(name),'SUPPLIER_ITEM_DAILY_ANCHOR');
 const reader=name=>once(source(name),v8('dbo.usp_stage4_copy_ready'),v9('dbo.usp_stage4_copy_ready'),'SUPPLIER_ITEM_READER_ANCHOR');
 const definitions=[leaf.definition,ready,daily,reader(SUPPLIER_ITEM_QUARANTINE_MODULES[3]),reader(SUPPLIER_ITEM_QUARANTINE_MODULES[4])];
 const replacements=pins.map((m,i)=>{const h=quarantineRevisionHeaders(definitions[i],i===0?'TRIGGER':'PROCEDURE');return {...m,afterHash:moduleHash(h.storedDefinition),definition:h.executionSQL,executionSQL:h.executionSQL,storedDefinition:h.storedDefinition,...(i===0?{semanticDefinition:leaf.definition,semanticDefinitionHash:leaf.afterHash.toUpperCase()}: {})};});
 const transformation={sourceUtf8Hash:SUPPLIER_ITEM_QUARANTINE_BASE.sourceUtf8Sha256.toUpperCase(),beforeStatementHash:leaf.beforeStatementHash.toUpperCase(),afterStatementHash:leaf.afterStatementHash.toUpperCase(),semanticDefinitionHash:leaf.afterHash.toUpperCase(),...Object.fromEntries(['prefixHash','suffixHash','productPredicateHash','invoicePredicateHash'].map(k=>[k,leaf.proof[k].toUpperCase()]))};
 const body={schemaVersion:'melisa-supplier-item-quarantine-parent-revision.v1',version:9,copyId:copy.copyId,baseSealHash:copy.sealHash,baseSelectedRevisionHash:base.revisionHash,baseEffectsRevisionHash:effects.revisionHash,baseParentRevisionHash:parent.revisionHash,profileHash:parent.profileHash,modules:replacements.map(({name,beforeHash,afterHash})=>({name,beforeHash,afterHash})),immutableTriggerHash:triggerHash,optimization:'DISTINCT_AFFECTED_PRODUCT_AND_INVOICE',transformation},revision={...body,revisionHash:isolatedCopyHash(body)};
 const parentHashes={...prior.parentHashes,ready:replacements[1].afterHash};
 const expectedCurrent=replacements.map(m=>`(${lit(m.name)},${lit(m.beforeHash)},${lit(m.afterHash)})`).join(',');
 // Separate operator proof SQL is not embedded into READY's self-hash. The
 // fresh path cannot repair an unknown installation; replay requires all five
 // exact applied pins and every immutable predecessor, not a self-report.
 const preflightSQL=`IF ${identity} OR @copy_id IS NULL OR @copy_id<>${lit(copy.copyId)} OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 OR OBJECT_ID(N'${SUPPLIER_ITEM_QUARANTINE_REGISTRY}') IS NOT NULL OR OBJECT_ID(N'${SUPPLIER_ITEM_QUARANTINE_IMMUTABLE}') IS NOT NULL THROW 51904,'SUPPLIER_ITEM_FRESH_INSTALL_REQUIRED',1;
${baseline}
${historyProof}
IF EXISTS(SELECT 1 FROM(VALUES ${beforeValues})p(name,before_hash) WHERE p.before_hash<>ISNULL(${hash('p.name')},'')) OR ISNULL(OBJECTPROPERTY(OBJECT_ID(N'${pins[0].name}'),'ExecIsTriggerDisabled'),1)<>0 OR ISNULL(${hash(lit('dbo.usp_stage4_copy_effects'))},'')<>${lit(prior.parentHashes.effects)} THROW 51904,'SUPPLIER_ITEM_BEFORE_NATIVE_DRIFT',1;`;
 const installedProofSQL=`IF @copy_id IS NULL OR @copy_id<>${lit(copy.copyId)} THROW 51904,'SUPPLIER_ITEM_COPY_REQUIRED',1;
${currentProof}
IF EXISTS(SELECT 1 FROM ${SUPPLIER_ITEM_QUARANTINE_REGISTRY} r LEFT JOIN(VALUES ${expectedCurrent})p(name,before_hash,after_hash) ON p.name=r.name WHERE p.name IS NULL OR r.before_hash<>p.before_hash OR r.after_hash<>p.after_hash OR r.revision_hash<>${lit(revision.revisionHash)}) OR ISNULL(${hash(lit('dbo.usp_stage4_copy_effects'))},'')<>${lit(prior.parentHashes.effects)} THROW 51904,'SUPPLIER_ITEM_INSTALLED_NATIVE_DRIFT',1;`;
 const artifact=(old,kind)=>{const m=replacements.find(m=>m.name===old.name),a=Object.freeze({...old,definition:m.executionSQL,executionSQL:m.executionSQL,storedDefinition:m.storedDefinition,definitionHash:m.afterHash,parentHashes:Object.freeze(parentHashes),supplierItemQuarantineRevisionHash:revision.revisionHash});prepared.set(a,{copy,kind});return a;};
 validateSupplierItemQuarantineRevision(copy,base,effects,parent,revision);
 return {schemaVersion:'melisa-supplier-item-quarantine-parent-install.v1',target:copy.target,copyId:copy.copyId,baseSealHash:copy.sealHash,baseSelectedRevision:base,baseEffectsRevision:effects,baseParentRevision:parent,revision,tableSQL,immutableSQL,preflightSQL,installedProofSQL,replacements,parentHashes,contextArtifact:artifact(prior.contextArtifact,'context'),writeScopeArtifact:artifact(prior.writeScopeArtifact,'intent'),businessWrites:0,rolesChanged:false,nativeChecksUnchanged:true,openingHumanAccepted:false};
}

export function assertPreparedSupplierItemQuarantineArtifact(artifact,copy,kind){const value=prepared.get(artifact);check(value?.copy===copy&&value.kind===kind,'SUPPLIER_ITEM_SERVER_ARTIFACT_REQUIRED');return artifact;}
export function validateSupplierItemQuarantineInstall(bundle,input){check(isolatedCopyJSON(bundle)===isolatedCopyJSON(buildSupplierItemQuarantineParentRevision(input)),'SUPPLIER_ITEM_CANONICAL_INSTALL');return true;}
