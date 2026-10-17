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

test('coherent append retains all historical definitions and brands only canonical artifacts',async()=>{
 const input=await capturedFixture(),snapshot=isolatedCopyJSON(input),{copy,bundle}=await compileCapturedBusinessSelectedSaleRevision(input),args={copy,daily:input.daily,profit:input.profit,schema};
 assert.equal(isolatedCopyJSON(input),snapshot);assert.equal(bundle.replacements.length,10);assert.equal(bundle.revision.version,6);assert.equal(bundle.businessWrites,0);assert.equal(bundle.rolesChanged,false);assert.equal(bundle.nativeChecksUnchanged,true);
 assert.equal(validateBusinessSelectedSaleInstall(bundle,args),true);
 assert.equal(assertPreparedSelectedRevisionArtifact(bundle.contextArtifact,copy,'context'),bundle.contextArtifact);
 assert.throws(()=>assertPreparedSelectedRevisionArtifact(structuredClone(bundle.contextArtifact),copy,'context'),/SERVER_ARTIFACT_REQUIRED/);
 assert.throws(()=>assertPreparedSelectedRevisionArtifact(bundle.contextArtifact,copy,'intent'),/SERVER_ARTIFACT_REQUIRED/);
 const mutated=structuredClone(input.daily);mutated.replacements[2].definition+='SELECT 0;';assert.throws(()=>buildBusinessSelectedSaleRevision({...args,daily:mutated}),/PARENT_DEFINITIONS|PREDECESSOR_PIN/);
 const tampered=structuredClone(bundle);tampered.replacements[0].definition+='SELECT 0;';assert.throws(()=>validateBusinessSelectedSaleInstall(tampered,args),/CANONICAL_INSTALL/);
 for(const m of bundle.replacements){assert.equal(moduleHash(m.definition.replace(/^ALTER PROCEDURE /,'CREATE PROCEDURE ')),m.afterHash);assertBalanced(m.definition);}assertBalanced(bundle.immutableSQL);
});
test('all SOURCE products remain selectable, with native canonical selection hashing and full document bounds',async()=>{
 const input=await capturedFixture(201),{copy,bundle}=await compileCapturedBusinessSelectedSaleRevision(input),begin=bundle.replacements.find(m=>m.name===SELECTED_SALE_BEGIN).definition;
 const match=begin.match(/@sealedSources nvarchar\(max\)=N'((?:[^']|'')*)',@currency_source/);assert(match);
 const fragments=JSON.parse(match[1].replaceAll("''","'")),ids=copy.products.slice(0,200).map(p=>p.id),selection=selectBusinessSaleWriteIntent(copy,{customerId:'100',currency:'USD',productIds:ids});
 const reconstructed={copyId:copy.copyId,sealHash:copy.sealHash,currency:'USD',customer:fragments.USD.customers['100'],productIds:selection.productIds,products:selection.productIds.map(id=>fragments.USD.products[id]),rate:fragments.USD.rate};
 assert.equal(Object.keys(fragments.USD.products).length,201);assert.equal(isolatedCopyHash(reconstructed),selection.sourceSelectionHash);assert.equal(fragments.USD.policyHash,selection.policyHash);
 assert.match(begin,/NOT BETWEEN 1 AND 200/);assert.match(begin,/quantityExact3<>FLOOR/);assert.match(begin,/@document_total>20000/);assert.match(begin,/STRING_AGG/);
 assert.doesNotMatch(begin,/purchaseQuote|purchasePriceExact8|20043|maxQuantityPerLine|BETWEEN 1 AND 5/);
 assert.throws(()=>selectBusinessSaleWriteIntent(copy,{customerId:'100',currency:'USD',productIds:copy.products.map(p=>p.id)}),{code:'SELECTED_SALE_ITEMS'});
});
test('preview is read-only and view-authorized; owner begin and intent retain exclusive same transaction proof',async()=>{
 const {bundle}=await compileCapturedBusinessSelectedSaleRevision(await capturedFixture());
 const context=bundle.contextArtifact.definition,begin=bundle.replacements.find(m=>m.name===SELECTED_SALE_BEGIN).definition,intent=bundle.writeScopeArtifact.definition;
 assert.match(context,/NOT IN\(N'Shared',N'Exclusive'\)/);assert.match(context,/transaction_isolation_level/);assert.match(context,/N'sales.view'/);assert.doesNotMatch(context,/N'sales.create'/);assert.match(context,/200 maxItems/);assert.match(context,/CAST\(0 AS bit\) writable/);assert.match(context,/a.current_balance\)\) balanceExact4/);
 for(const sql of [begin,intent]){assert.match(sql,/<>N'Exclusive'/);assert.match(sql,/CURRENT_TRANSACTION_ID\(\)/);assert.match(sql,/selectedSaleIntent/);}
 assert.match(begin,/INSERT @context_rows EXEC dbo.usp_business_selected_sale_context_v2/);assert.match(begin,/SOURCE_POLICY_HASH/);assert.match(begin,/CREATION_HEADER/);assert.match(begin,/CREATION_LINES/);assert.match(begin,/ROW_NUMBER\(\) OVER\(ORDER BY l.id\)/);
 assert.doesNotMatch(context,/INSERT dbo.stage4_copy_intents/);
});
test('guard and effects enforce exact currency account, immutable creation, one posting and native precision',async()=>{
 const {bundle}=await compileCapturedBusinessSelectedSaleRevision(await capturedFixture()),guard=bundle.replacements.find(m=>m.name===SELECTED_SALE_GUARD).definition,effects=bundle.replacements.find(m=>m.name==='dbo.usp_stage4_copy_effects').definition,ready=bundle.replacements[0].definition;
 assert.match(guard,/MAIN_CARD_CURRENCY/);assert.match(guard,/EXACT_ACCOUNT/);assert.match(guard,/HEADER_PROFIT/);assert.match(guard,/NOT\(@operation=N'sale_finalize' AND COALESCE\(x\.\[key\],y\.\[key\]\)=N'estimated_profit_try'\)/);
 assert.match(guard,/CONVERT\(decimal\(18,6\),CASE WHEN amount.amount\*@rate>0 THEN CONVERT\(decimal\(28,12\),amount.amount\*@rate-source.costExact4\*chosen.quantityExact3\)\/CONVERT\(decimal\(28,12\),amount.amount\*@rate\)/);
 assert.match(effects,/EFFECT_SINGLE_POST/);assert.match(effects,/EFFECT_MAIN_CARD/);assert.match(effects,/EFFECT_ROWSETS/);assert.match(ready,/COUNT\(\*\) FROM dbo.stage4_copy_business_daily_revisions\)<>8/);assert.match(ready,/COUNT\(\*\) FROM dbo.stage4_copy_business_daily_profit_revisions\)<>3/);assert.match(ready,/OBJECT_ID\(s.name\) IS NULL/);assert.match(bundle.immutableSQL,/EXISTS\(SELECT 1 FROM deleted\)/);
 assert.match(selectedSaleInvoiceRevisionSQL,/j.operation=N'sale_draft'/);assert.match(selectedSaleInvoiceRevisionSQL,/n.session_id=@@SPID/);assert.match(selectedSaleInvoiceRevisionSQL,/creationPayloadHash/);assert.doesNotMatch(selectedSaleInvoiceRevisionSQL,/HASHBYTES\([^\n]*response_json|effect_proof_json/);
});
