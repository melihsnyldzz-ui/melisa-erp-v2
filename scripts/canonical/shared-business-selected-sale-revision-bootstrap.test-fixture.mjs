import {moduleHash,COPY_MUTABLE_TABLES} from './stage4-copy-sql.mjs';
import {businessCopyContextSQL} from './shared-business-copy-sql.mjs';
import {dailyContextSQL,dailyGuardSQL} from './shared-business-daily-revision-sql.mjs';
import {buildDailyProfitRevision} from './shared-business-daily-profit-revision.mjs';
import {selectedSaleFixture} from '../../apps/api/src/services/businessSelectedSalePreview.test.mjs';
import {businessDailyNativeCheckReadSQL} from '../../apps/api/src/services/businessDailyNativeCheck.mjs';
import {isolatedCopyHash,isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {STOCK_PREDICATE_TRIGGER_ORDER} from './shared-business-stock-predicate-distinct-source.mjs';
import {STOCK_PREDICATE_REVISION_PROOF_SQL,OPERATION_QUARANTINE_REVISION_PROOF_SQL,SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL} from './shared-business-selected-sale-revision-bootstrap.mjs';
const registry='dbo.stage4_copy_business_daily_revisions';
const sealed=body=>({...body,revisionHash:isolatedCopyHash(body)});
const schema=COPY_MUTABLE_TABLES.flatMap(tableName=>['id','request_id','product_id','customer_id','supplier_id','currency_code','created_by','current_stock_qty','balance','current_balance','updated_at','row_version','state','decided_by','decided_at','reason'].map(columnName=>({schemaName:'dbo',tableName,columnName,typeName:columnName==='id'?'bigint':'nvarchar'})));
// Entirely synthetic proof and source rows. These scaffolds exercise canonical
// predecessor binding; they do not represent a native compilation or rehearsal.
export async function capturedFixture(count=1,mutateRaw=()=>{},{stockPredicateCompatible=false}={}){
 const f=selectedSaleFixture(raw=>{
  const original=structuredClone(raw.products[0]);
  raw.products=Array.from({length:count},(_,i)=>{const id=String(444+i),quotes=original.quotes.map((q,k)=>({...q,quoteId:String(100+i*3+k)}));return {...structuredClone(original),id,stockCode:`OFFLINE-${id}`,sourceKey:['VEGA2026','F0102TBLSTOKLAR',id].join('/'),barcodes:[`00${id}`],quotes,priceIds:quotes.map(q=>q.quoteId)};});
  mutateRaw(raw);
 });
 const self=`COALESCE((SELECT z.after_hash FROM ${registry} z WHERE z.copy_id=w.copy_id AND z.revision=4 AND z.name=w.name AND z.before_hash=w.after_hash),w.after_hash)`;
 let nativeContext=businessCopyContextSQL().replace("IF @domain<>N'inbound' THROW 51904,'BUSINESS_DOMAIN_NOT_VERIFIED',1;","IF @domain IN(N'trade',N'payment',N'daily',N'report') BEGIN EXEC dbo.usp_business_daily_context @copy_id,@actor_id,@domain;RETURN;END;\nIF @domain<>N'inbound' THROW 51904,'BUSINESS_DOMAIN_NOT_VERIFIED',1;");
 nativeContext=nativeContext.replaceAll('OBJECT_DEFINITION(@@PROCID)',"OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_context'))");
 const definitions=[
  `CREATE PROCEDURE dbo.usp_stage4_copy_ready AS BEGIN${stockPredicateCompatible?' SET NOCOUNT ON;':''} IF(SELECT COUNT(*) FROM ${registry})<>8 PRINT N'fixture';IF EXISTS(SELECT 1 FROM ${registry} d WHERE d.after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(d.name))),2)) PRINT N'fixture';SELECT COALESCE(d.after_hash,COALESCE(w.after_hash,v.after_hash,r.after_hash,p.after_hash));SELECT ${self}; END;`,
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

// Synthetic query responses only. Historical captures may supply the source
// metadata, but these modeled responses are not a native rehearsal or a grant.
export function stockPredicateProofFixture({copy,input,state,bundle,nativeReadOnly=false,reader}){
 const v6=bundle.baseSelectedRevision,v7=bundle.baseEffectsRevision,v8=bundle.baseParentRevision,v9=bundle.baseSupplierItemQuarantineRevision,v10=bundle.baseOperationQuarantineRevision,v11=bundle.revision;
 const meta={db:copy.target.database,server:copy.target.server,login:nativeReadOnly?reader:copy.target.login,databaseUser:nativeReadOnly?reader:copy.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0,sessionId:91,transactionId:'1001',transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Shared',manifestRows:1,moduleManifestRows:185,copyId:copy.copyId,sealHash:copy.sealHash,backupSHA:copy.backupSHA,profileHash:isolatedCopyHash(copy),queryPlanRegistryExists:false};
 const current=name=>[v11,v10,v9,v8,v7,v6,state.profit.revision,state.daily.revision].map(r=>r.modules.find(m=>m.name===name)).find(Boolean)?.afterHash;
 const shared=(revision,m)=>({copyId:copy.copyId,name:m.name,revision:revision.version,baseSealHash:copy.sealHash,profileHash:revision.profileHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:revision.revisionHash,actualHash:current(m.name),immutableTriggerHash:revision.immutableTriggerHash,triggerDisabled:0});
 const framed=rows=>({recordsets:[[structuredClone(meta)],rows,[structuredClone(meta)]]});
 const nativeSchema=state.schema.filter(r=>r.schemaName==='dbo'&&COPY_MUTABLE_TABLES.includes(r.tableName)).map(r=>Object.fromEntries(['schemaName','tableName','columnName','typeName'].map(k=>[k,r[k]])));
 const result={recordsets:[[structuredClone(meta)],...structuredClone(input.proofs.daily),structuredClone(input.proofs.profit),...structuredClone(input.proofs.native),v6.modules.map(m=>({...shared(v6,m),baseDailyRevisionHash:v6.baseDailyRevisionHash,baseProfitRevisionHash:v6.baseProfitRevisionHash})),nativeSchema,[structuredClone(meta)]]};
 for(const group of result.recordsets.slice(1,6))for(const row of group)if(current(row.name))row.actualHash=current(row.name);
 const effects=framed(v7.modules.map(m=>({...shared(v7,m),baseSelectedRevisionHash:v7.baseSelectedRevisionHash}))),parents=framed(v8.modules.map(m=>({...shared(v8,m),baseSelectedRevisionHash:v8.baseSelectedRevisionHash,baseEffectsRevisionHash:v8.baseEffectsRevisionHash}))),supplier=framed(v9.modules.map((m,i)=>({...shared(v9,m),baseSelectedRevisionHash:v9.baseSelectedRevisionHash,baseEffectsRevisionHash:v9.baseEffectsRevisionHash,baseParentRevisionHash:v9.baseParentRevisionHash,moduleType:i===0?'TR':'P',moduleDisabled:0,parentName:i===0?'dbo.sales_invoice_items':null,baseManifestHash:i===0?m.beforeHash:null}))),operation=framed(v10.modules.map((m,i)=>({...shared(v10,m),baseSelectedRevisionHash:v10.baseSelectedRevisionHash,baseEffectsRevisionHash:v10.baseEffectsRevisionHash,baseParentRevisionHash:v10.baseParentRevisionHash,baseSupplierItemQuarantineRevisionHash:v10.baseSupplierItemQuarantineRevisionHash,moduleType:'P',baseManifestHash:i===0?m.beforeHash:null}))),stock=framed(v11.modules.map((m,i)=>({...shared(v11,m),baseOperationQuarantineRevisionHash:v11.baseOperationQuarantineRevisionHash,objectId:state.stockPredicateSource.objectIds[m.name],moduleType:m.type,moduleDisabled:0,parentName:i===0?'dbo.stock_movements':null,baseManifestHash:i===0?m.beforeHash:null,...STOCK_PREDICATE_TRIGGER_ORDER})));
 const results=new Map([[STOCK_PREDICATE_REVISION_PROOF_SQL,stock],[OPERATION_QUARANTINE_REVISION_PROOF_SQL,operation],[SUPPLIER_ITEM_QUARANTINE_REVISION_PROOF_SQL,supplier],[BUSINESS_SELECTED_SALE_PARENT_REVISION_PROOF_SQL,parents],[BUSINESS_SELECTED_SALE_EFFECTS_REVISION_PROOF_SQL,effects],[BUSINESS_SELECTED_SALE_REVISION_PROOF_SQL,result]]),calls=[];
 return {results,calls,request:{query:async sql=>{calls.push(sql);if(!results.has(sql))throw Error('SYNTHETIC_STOCK_PREDICATE_QUERY');return structuredClone(results.get(sql));}}};
}
