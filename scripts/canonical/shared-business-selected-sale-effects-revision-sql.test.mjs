import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleHash,COPY_MUTABLE_TABLES} from './stage4-copy-sql.mjs';
import {businessCopyContextSQL} from './shared-business-copy-sql.mjs';
import {dailyContextSQL,dailyGuardSQL} from './shared-business-daily-revision-sql.mjs';
import {buildDailyProfitRevision} from './shared-business-daily-profit-revision.mjs';
import {selectedSaleFixture} from '../../apps/api/src/services/businessSelectedSalePreview.test.mjs';
import {businessDailyNativeCheckReadSQL} from '../../apps/api/src/services/businessDailyNativeCheck.mjs';
import {isolatedCopyHash,isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {selectBusinessSaleWriteIntent} from '../../apps/api/src/services/businessSelectedSaleWriteIntent.mjs';
import {compileCapturedBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-capture.mjs';
import {buildBusinessSelectedSaleRevision,validateBusinessSelectedSaleInstall,assertPreparedSelectedRevisionArtifact,SELECTED_SALE_CONTEXT,SELECTED_SALE_BEGIN,SELECTED_SALE_GUARD,selectedSaleInvoiceRevisionSQL} from './shared-business-selected-sale-revision-sql.mjs';

const registry='dbo.stage4_copy_business_daily_revisions';
const sealed=body=>({...body,revisionHash:isolatedCopyHash(body)});
const schema=COPY_MUTABLE_TABLES.flatMap(tableName=>['id','request_id','product_id','customer_id','supplier_id','currency_code','created_by','current_stock_qty','balance','current_balance','updated_at','row_version','state','decided_by','decided_at','reason'].map(columnName=>({schemaName:'dbo',tableName,columnName,typeName:columnName==='id'?'bigint':'nvarchar'})));
// Entirely synthetic proof and source rows. These scaffolds exercise canonical
// predecessor binding; they do not represent a native compilation or rehearsal.
async function capturedFixture(count=1){
 const f=selectedSaleFixture(raw=>{
  const original=structuredClone(raw.products[0]);
  raw.products=Array.from({length:count},(_,i)=>{const id=String(444+i),quotes=original.quotes.map((q,k)=>({...q,quoteId:String(100+i*3+k)}));return {...structuredClone(original),id,stockCode:`OFFLINE-${id}`,sourceKey:['VEGA2026','F0102TBLSTOKLAR',id].join('/'),barcodes:[`00${id}`],quotes,priceIds:quotes.map(q=>q.quoteId)};});
 });
 const self=`COALESCE((SELECT z.after_hash FROM ${registry} z WHERE z.copy_id=w.copy_id AND z.revision=4 AND z.name=w.name AND z.before_hash=w.after_hash),w.after_hash)`;
 let nativeContext=businessCopyContextSQL().replace("IF @domain<>N'inbound' THROW 51904,'BUSINESS_DOMAIN_NOT_VERIFIED',1;","IF @domain IN(N'trade',N'payment',N'daily',N'report') BEGIN EXEC dbo.usp_business_daily_context @copy_id,@actor_id,@domain;RETURN;END;\nIF @domain<>N'inbound' THROW 51904,'BUSINESS_DOMAIN_NOT_VERIFIED',1;");
 nativeContext=nativeContext.replaceAll('OBJECT_DEFINITION(@@PROCID)',"OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_context'))");
 const definitions=[
  `CREATE PROCEDURE dbo.usp_stage4_copy_ready AS BEGIN IF(SELECT COUNT(*) FROM ${registry})<>8 PRINT N'fixture';IF EXISTS(SELECT 1 FROM ${registry} d WHERE d.after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(d.name))),2)) PRINT N'fixture';SELECT COALESCE(d.after_hash,COALESCE(w.after_hash,v.after_hash,r.after_hash,p.after_hash));SELECT ${self}; END;`,
  nativeContext,
  "CREATE PROCEDURE dbo.usp_stage4_copy_begin AS BEGIN IF @operation IN(N'sale_draft') PRINT N'fixture';END;",
  "CREATE PROCEDURE dbo.usp_stage4_copy_guard AS BEGIN IF ISJSON(@inserted)<>1 OR ISJSON(@deleted)<>1 THROW 51904,'STAGE4_TRIGGER_ROWSETS_REQUIRED',1;END;",
  "CREATE PROCEDURE dbo.usp_stage4_copy_effects AS BEGIN IF @before IS NULL THROW 51904,'STAGE4_EFFECT_INTENT_REQUIRED',1;IF EXISTS(SELECT 1 FROM dbo.customer_movements m WHERE m.id>@maxCustomerId AND NOT EXISTS(SELECT 1 WHERE 1=0)) THROW 51904,'fixture',1;END;",
  dailyContextSQL(),
  'CREATE PROCEDURE dbo.usp_business_daily_begin AS BEGIN SELECT 1;END;',
  dailyGuardSQL(schema),
 ];
 const replacements=f.revision.modules.map((m,i)=>({...m,afterHash:moduleHash(definitions[i]),definition:definitions[i]}));
 const {revisionHash:ignored,...base}=f.revision;
 const revision=sealed({...base,modules:replacements.map(({definition,...m})=>m)});
 const daily={schemaVersion:'melisa-business-copy-daily-install.v1',target:f.c.target,revision,replacements,businessWrites:0},profit=buildDailyProfitRevision(daily);
 const current=name=>(profit.revision.modules.find(m=>m.name===name)??revision.modules.find(m=>m.name===name)).afterHash;
 const proof=structuredClone(f.proof);
 for(const rows of proof)for(const row of rows)row.actualHash=current(row.name);
 for(const row of proof[3]){const m=revision.modules.find(m=>m.name===row.name);Object.assign(row,{afterHash:m.afterHash,revisionHash:revision.revisionHash});}
 const profitProof=profit.revision.modules.map(m=>({copyId:f.c.copyId,name:m.name,revision:5,baseSealHash:f.c.sealHash,baseDailyRevisionHash:revision.revisionHash,dailyScopeHash:revision.dailyScopeHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:profit.revision.revisionHash,actualHash:m.afterHash,immutableTriggerHash:profit.revision.immutableTriggerHash,triggerDisabled:0}));
 const native=(await f.pool.request().query(businessDailyNativeCheckReadSQL())).recordsets;
 return {readOnly:true,context:structuredClone(f.c),base:f.base,performance:f.performance,effects:f.effects,dailyRevision:revision,profitRevision:profit.revision,proofs:{daily:proof,profit:profitProof,native},schema,daily,profit};
}
function assertBalanced(sql){let depth=0,quote=false,comment=false;for(let i=0;i<sql.length;i++){const c=sql[i];if(comment){if(c==='\n')comment=false;continue;}if(quote){if(c==="'"){if(sql[i+1]==="'")i++;else quote=false;}continue;}if(c==="'"){quote=true;continue;}if(c==='-'&&sql[i+1]==='-'){comment=true;i++;continue;}if(c==='(')depth++;if(c===')'){depth--;assert(depth>=0);}}assert.equal(depth,0);assert.equal(quote,false);}

import {buildBusinessSelectedSaleEffectsRevision,validateBusinessSelectedSaleEffectsInstall,assertPreparedSelectedEffectsRevisionArtifact,optimizeSelectedSaleEffectsSQL,SELECTED_SALE_EFFECTS_REGISTRY,SELECTED_SALE_EFFECTS_IMMUTABLE,SELECTED_SALE_EFFECTS_MODULES} from './shared-business-selected-sale-effects-revision-sql.mjs';

test('v7 appends four canonical modules and preserves v6 business/source/guard pins',async()=>{
 const input=await capturedFixture(),snapshot=isolatedCopyJSON(input),{copy,bundle:base}=await compileCapturedBusinessSelectedSaleRevision(input),args={copy,daily:input.daily,profit:input.profit,schema:input.schema},bundle=buildBusinessSelectedSaleEffectsRevision(args);
 assert.equal(isolatedCopyJSON(input),snapshot);assert.deepEqual(bundle.baseSelectedRevision,base.revision);assert.equal(bundle.revision.version,7);assert.equal(bundle.revision.baseSelectedRevisionHash,base.revision.revisionHash);assert.equal(bundle.businessWrites,0);assert.equal(bundle.rolesChanged,false);assert.equal(bundle.nativeChecksUnchanged,true);assert.deepEqual(bundle.replacements.map(m=>m.name),SELECTED_SALE_EFFECTS_MODULES);
 for(const m of bundle.replacements){assert.equal(m.beforeHash,base.replacements.find(p=>p.name===m.name).afterHash);assert.notEqual(m.afterHash,m.beforeHash);assert(m.definition.startsWith('CREATE OR ALTER PROCEDURE '));assert(m.storedDefinition.startsWith('CREATE   PROCEDURE '));assert.equal(m.storedDefinition,m.definition.replace(/^CREATE OR ALTER PROCEDURE /,'CREATE   PROCEDURE '));assert.equal(m.afterHash,moduleHash(m.storedDefinition));assert.notEqual(m.afterHash,moduleHash(m.definition));assert.deepEqual(Object.keys(bundle.revision.modules.find(p=>p.name===m.name)).sort(),['afterHash','beforeHash','name']);assertBalanced(m.definition);assertBalanced(m.storedDefinition);}assertBalanced(bundle.immutableSQL);
 assert.equal(validateBusinessSelectedSaleEffectsInstall(bundle,args),true);assert.equal(bundle.contextArtifact.selectedRevisionHash,base.revision.revisionHash);assert.equal(bundle.writeScopeArtifact.selectedRevisionHash,base.revision.revisionHash);assert.equal(bundle.contextArtifact.selectedEffectsRevisionHash,bundle.revision.revisionHash);
 for(const artifact of [bundle.contextArtifact,bundle.writeScopeArtifact]){assert.equal(artifact.executionSQL,artifact.definition);assert.equal(artifact.storedDefinition,artifact.executionSQL.replace(/^CREATE OR ALTER PROCEDURE /,'CREATE   PROCEDURE '));assert.equal(artifact.definitionHash,moduleHash(artifact.storedDefinition));}
 assert.equal(bundle.parentHashes.context,base.parentHashes.context);assert.equal(bundle.parentHashes.begin,base.parentHashes.begin);assert.notEqual(bundle.parentHashes.ready,base.parentHashes.ready);assert.notEqual(bundle.parentHashes.effects,base.parentHashes.effects);
 assert.equal(assertPreparedSelectedEffectsRevisionArtifact(bundle.contextArtifact,copy,'context'),bundle.contextArtifact);assert.equal(assertPreparedSelectedEffectsRevisionArtifact(bundle.writeScopeArtifact,copy,'intent'),bundle.writeScopeArtifact);assert.throws(()=>assertPreparedSelectedEffectsRevisionArtifact(structuredClone(bundle.contextArtifact),copy,'context'),/SERVER_ARTIFACT_REQUIRED/);assert.throws(()=>assertPreparedSelectedEffectsRevisionArtifact(bundle.contextArtifact,copy,'intent'),/SERVER_ARTIFACT_REQUIRED/);assert.throws(()=>assertPreparedSelectedEffectsRevisionArtifact(bundle.contextArtifact,structuredClone(copy),'context'),/SERVER_ARTIFACT_REQUIRED/);
 const tampered=structuredClone(bundle);tampered.replacements[1].definition+='SELECT 0;';assert.throws(()=>validateBusinessSelectedSaleEffectsInstall(tampered,args),/CANONICAL_INSTALL/);
 const changedStored=structuredClone(bundle);changedStored.replacements[1].storedDefinition+='SELECT 0;';assert.throws(()=>validateBusinessSelectedSaleEffectsInstall(changedStored,args),/CANONICAL_INSTALL/);
 const wrong=structuredClone(input.daily);wrong.replacements[2].definition+='SELECT 0;';assert.throws(()=>buildBusinessSelectedSaleEffectsRevision({...args,daily:wrong}),/PARENT_DEFINITIONS|PREDECESSOR_PIN/);
});

test('selected max extraction is exact bigint substitution with identical effect predicates',async()=>{
 const {bundle:base}=await compileCapturedBusinessSelectedSaleRevision(await capturedFixture()),original=base.replacements.find(m=>m.name==='dbo.usp_stage4_copy_effects').definition,optimized=optimizeSelectedSaleEffectsSQL(original);
 let restored=optimized;for(const k of ['Stock','Customer','Supplier','Finance']){const expression=`TRY_CONVERT(bigint,JSON_VALUE(@selected_effect_before,'$.max${k}Id'))`,declaration=`DECLARE @selected_effect_max${k}Id bigint=${expression};`;assert.equal(optimized.split(expression).length,2);assert(optimized.indexOf(declaration)>optimized.indexOf('IF @selected_effect_intent IS NOT NULL BEGIN'));restored=restored.replace(declaration,'').replaceAll(`@selected_effect_max${k}Id`,expression);}restored=restored.replace('IF @selected_effect_intent IS NOT NULL BEGIN\n\n','IF @selected_effect_intent IS NOT NULL BEGIN\n');assert.equal(restored,original);
 const rowsets=optimized.split('\n').find(l=>l.includes("'SELECTED_SUCCESSOR_EFFECT_ROWSETS'"));assert(!rowsets.includes('JSON_VALUE'));assert.match(rowsets,/COUNT\(\*\) FROM dbo.stock_movements WHERE id>@selected_effect_maxStockId/);assert.match(optimized,/customer_movements m WHERE m.id>@selected_effect_maxCustomerId/);assert.match(optimized,/SELECTED_SUCCESSOR_EFFECT_SINGLE_POST/);assert.match(optimized,/SELECTED_SUCCESSOR_TRANSACTION/);
 assert.throws(()=>optimizeSelectedSaleEffectsSQL(original.replace("'$.maxStockId'","'$.changed'")),/MAX_ANCHOR/);assert.throws(()=>optimizeSelectedSaleEffectsSQL(original.replace('IF @selected_effect_intent IS NOT NULL BEGIN','IF @selected_effect_intent IS NOT NULL BEGIN /* changed */')),/BRANCH_ANCHOR/);
});

test('READY retains historical checks and only projects verified current v7 module hashes',async()=>{
 const input=await capturedFixture(),{copy,bundle:base}=await compileCapturedBusinessSelectedSaleRevision(input),bundle=buildBusinessSelectedSaleEffectsRevision({copy,daily:input.daily,profit:input.profit,schema:input.schema}),ready=bundle.replacements[0].definition;
 assert.match(ready,/SELECTED_EFFECTS_BASE_DRIFT/);assert.match(ready,/SELECTED_EFFECTS_REVISION_DRIFT/);assert.match(ready,/SELECTED_SUCCESSOR_REVISION_DRIFT/);assert.match(ready,/COUNT\(\*\) FROM dbo.stage4_copy_business_selected_sale_revisions\)<>10/);assert.match(ready,/OBJECT_ID\(e.name,N'P'\) IS NULL/);assert.match(ready,/e.after_hash<>ISNULL\(CONVERT/);assert.match(ready,/s.after_hash=e.before_hash/);assert.match(ready,/SELECT e.before_hash FROM dbo.stage4_copy_business_selected_sale_effects_revisions e WHERE e.copy_id=@copy_id AND e.revision=7/);assert(ready.includes(base.revision.revisionHash));assert(ready.includes(base.revision.immutableTriggerHash));
 assert.match(bundle.immutableSQL,/COUNT\(\*\) FROM inserted\)<>4/);assert.match(bundle.immutableSQL,/EXISTS\(SELECT 1 FROM deleted\)/);assert.match(bundle.immutableSQL,/COUNT\(\*\) FROM dbo.stage4_copy_module_manifest\)<>185/);assert.match(bundle.immutableSQL,/COUNT\(\*\) FROM dbo.stage4_copy_business_daily_revisions\)<>8/);assert.match(bundle.immutableSQL,/COUNT\(\*\) FROM dbo.stage4_copy_business_daily_profit_revisions\)<>3/);assert.match(bundle.immutableSQL,/COALESCE\(i.after_hash,s.after_hash\)<>ISNULL/);assert.match(bundle.tableSQL,/revision=7/);assert(bundle.tableSQL.startsWith('CREATE TABLE '+SELECTED_SALE_EFFECTS_REGISTRY));assert(bundle.immutableSQL.startsWith('CREATE TRIGGER '+SELECTED_SALE_EFFECTS_IMMUTABLE));
 for(const m of bundle.replacements)assert.doesNotMatch(m.definition,/DISABLE TRIGGER|UPDATE dbo.stage4_copy_business_selected_sale_revisions|DELETE dbo.stage4_copy_business_selected_sale_revisions|ALTER TABLE/);
});
