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

import {buildBusinessSelectedSaleParentRevision,validateBusinessSelectedSaleParentInstall,assertPreparedSelectedParentRevisionArtifact,SELECTED_SALE_PARENT_REGISTRY,SELECTED_SALE_PARENT_IMMUTABLE,SELECTED_SALE_PARENT_MODULES} from './shared-business-selected-sale-parent-revision-sql.mjs';
const normalHeader=s=>s.replace(/^(?:ALTER|CREATE OR ALTER|CREATE  ) PROCEDURE /,'CREATE PROCEDURE ');

test('v8 forward append preserves all v6/v7 and effects pins, with exact no-DROP stored hashes',async()=>{
 const input=await capturedFixture(),snapshot=isolatedCopyJSON(input),{copy,bundle:base}=await compileCapturedBusinessSelectedSaleRevision(input),args={copy,daily:input.daily,profit:input.profit,schema:input.schema},effects=buildBusinessSelectedSaleEffectsRevision(args),bundle=buildBusinessSelectedSaleParentRevision(args);
 assert.equal(isolatedCopyJSON(input),snapshot);assert.deepEqual(bundle.baseSelectedRevision,base.revision);assert.deepEqual(bundle.baseEffectsRevision,effects.revision);assert.equal(bundle.revision.version,8);assert.equal(bundle.revision.baseEffectsRevisionHash,effects.revision.revisionHash);assert.equal(bundle.businessWrites,0);assert.equal(bundle.rolesChanged,false);assert.equal(bundle.nativeChecksUnchanged,true);assert.deepEqual(bundle.replacements.map(m=>m.name),SELECTED_SALE_PARENT_MODULES);assert(!bundle.replacements.some(m=>m.name==='dbo.usp_stage4_copy_effects'));
 for(const m of bundle.replacements){assert.equal(m.beforeHash,(effects.replacements.find(p=>p.name===m.name)??base.replacements.find(p=>p.name===m.name)).afterHash);assert(m.definition.startsWith('CREATE OR ALTER PROCEDURE '));assert.equal(m.storedDefinition,m.definition.replace(/^CREATE OR ALTER PROCEDURE /,'CREATE   PROCEDURE '));assert.equal(m.afterHash,moduleHash(m.storedDefinition));assert.notEqual(m.afterHash,moduleHash(m.definition));assert.deepEqual(Object.keys(bundle.revision.modules.find(p=>p.name===m.name)).sort(),['afterHash','beforeHash','name']);assertBalanced(m.definition);}assertBalanced(bundle.immutableSQL);
 assert.equal(bundle.parentHashes.effects,effects.parentHashes.effects);assert.equal(bundle.parentHashes.context,base.parentHashes.context);assert.equal(bundle.parentHashes.begin,base.parentHashes.begin);assert.notEqual(bundle.parentHashes.ready,effects.parentHashes.ready);assert.equal(validateBusinessSelectedSaleParentInstall(bundle,args),true);
 for(const [artifact,kind] of [[bundle.contextArtifact,'context'],[bundle.writeScopeArtifact,'intent']]){assert.equal(artifact.selectedRevisionHash,base.revision.revisionHash);assert.equal(artifact.selectedEffectsRevisionHash,effects.revision.revisionHash);assert.equal(artifact.selectedParentRevisionHash,bundle.revision.revisionHash);assert.equal(artifact.definitionHash,moduleHash(artifact.storedDefinition));assert.equal(assertPreparedSelectedParentRevisionArtifact(artifact,copy,kind),artifact);assert.throws(()=>assertPreparedSelectedParentRevisionArtifact(structuredClone(artifact),copy,kind),/SERVER_ARTIFACT_REQUIRED/);assert.throws(()=>assertPreparedSelectedParentRevisionArtifact(artifact,copy,kind==='context'?'intent':'context'),/SERVER_ARTIFACT_REQUIRED/);}
 const tampered=structuredClone(bundle);tampered.replacements[0].storedDefinition+='SELECT 0;';assert.throws(()=>validateBusinessSelectedSaleParentInstall(tampered,args),/CANONICAL_INSTALL/);const wrong=structuredClone(input.daily);wrong.replacements[2].definition+='SELECT 0;';assert.throws(()=>buildBusinessSelectedSaleParentRevision({...args,daily:wrong}),/PARENT_DEFINITIONS|PREDECESSOR_PIN/);
});

test('daily context and selected readers change only current parent hash expectations',async()=>{
 const input=await capturedFixture(),{copy,bundle:base}=await compileCapturedBusinessSelectedSaleRevision(input),args={copy,daily:input.daily,profit:input.profit,schema:input.schema},effects=buildBusinessSelectedSaleEffectsRevision(args),bundle=buildBusinessSelectedSaleParentRevision(args),daily=bundle.replacements[1].definition;
 const omit=(s,marker)=>normalHeader(s).split('\n').filter(l=>!l.includes(marker)).join('\n');assert.equal(omit(daily,'STAGE4_CONTEXT_MODULE_DRIFT'),omit(base.replacements.find(m=>m.name==='dbo.usp_business_daily_context').definition,'STAGE4_CONTEXT_MODULE_DRIFT'));
 const gate=daily.split('\n').find(l=>l.includes('STAGE4_CONTEXT_MODULE_DRIFT'));for(const name of ['ready','context','begin','effects'])assert(gate.includes(`t.name=N'dbo.usp_stage4_copy_${name}'`));assert(gate.includes(effects.revision.revisionHash));assert.match(gate,/t.before_hash=COALESCE\(\(SELECT e.after_hash/);assert.match(daily,/EXEC dbo.usp_stage4_copy_ready @copy_id/);
 for(const name of SELECTED_SALE_PARENT_MODULES.slice(2)){const updated=bundle.replacements.find(m=>m.name===name).definition,old=effects.replacements.find(m=>m.name===name).definition;assert.equal(omit(updated,'SELECTED_SALE_PARENT_MODULE_DRIFT'),omit(old,'SELECTED_SALE_PARENT_MODULE_DRIFT'));const oldEffects=old.split('\n').find(l=>l.includes("name=N'dbo.usp_stage4_copy_effects'")&&l.includes('SELECTED_SALE_PARENT_MODULE_DRIFT'));assert(updated.includes(oldEffects));assert.match(updated,/t.name=N'dbo.usp_stage4_copy_ready'/);}
});

test('v8 proves native current pins before interpreting immutable v7/v6 before-images',async()=>{
 const input=await capturedFixture(),{copy}=await compileCapturedBusinessSelectedSaleRevision(input),bundle=buildBusinessSelectedSaleParentRevision({copy,daily:input.daily,profit:input.profit,schema:input.schema}),ready=bundle.replacements[0].definition;
 assert(ready.indexOf('SELECTED_PARENT_REVISION_DRIFT')<ready.indexOf('SELECTED_EFFECTS_REVISION_DRIFT'));assert(ready.indexOf('SELECTED_PARENT_REVISION_DRIFT')<ready.indexOf('SELECTED_SUCCESSOR_REVISION_DRIFT'));assert.match(ready,/t.after_hash<>ISNULL\(CONVERT\(varchar\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION\(OBJECT_ID\(t.name\)\)\),2\),''\)/);assert.match(ready,/OBJECT_ID\(t.name,N'P'\) IS NULL/);assert.match(ready,/t.before_hash<>COALESCE\(e.after_hash,s.after_hash\)/);assert.match(ready,/SELECT t.before_hash FROM dbo.stage4_copy_business_selected_sale_parent_revisions/);assert(ready.includes(bundle.baseEffectsRevision.revisionHash));assert(ready.includes(bundle.baseSelectedRevision.revisionHash));assert.match(ready,/SELECTED_PARENT_HISTORY_DRIFT/);
 assert.match(bundle.immutableSQL,/EXISTS\(SELECT 1 FROM deleted\)/);assert.match(bundle.immutableSQL,/COUNT\(\*\) FROM inserted\)<>4/);assert.match(bundle.immutableSQL,/COALESCE\(i.after_hash,e.after_hash,s.after_hash\)<>ISNULL/);assert.match(bundle.immutableSQL,/COUNT\(\*\) FROM dbo.stage4_copy_module_manifest\)<>185/);assert.match(bundle.immutableSQL,/COUNT\(\*\) FROM dbo.stage4_copy_business_daily_revisions\)<>8/);assert.match(bundle.immutableSQL,/COUNT\(\*\) FROM dbo.stage4_copy_business_daily_profit_revisions\)<>3/);assert(bundle.immutableSQL.startsWith('CREATE TRIGGER '+SELECTED_SALE_PARENT_IMMUTABLE));assert(bundle.tableSQL.startsWith('CREATE TABLE '+SELECTED_SALE_PARENT_REGISTRY));assert.match(bundle.tableSQL,/revision=8/);
 for(const m of bundle.replacements)assert.doesNotMatch(m.definition,/DROP PROCEDURE|DISABLE TRIGGER|UPDATE dbo.stage4_copy_business_selected_sale_revisions|UPDATE dbo.stage4_copy_business_selected_sale_effects_revisions|ALTER TABLE/);
});