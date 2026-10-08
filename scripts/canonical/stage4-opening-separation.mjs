// Aşama 4: a dated opening projection in the separately restored TEST copy.
// Importing and planning perform no I/O. No native commercial row is rewritten.
import {createHash} from 'node:crypto';
import {decimal,sumDecimals} from '../migration/mapping-opening.mjs';

export const STAGE4_COPY_TARGET=Object.freeze({server:'Semih\\MELISADEV',database:'MELISA_ERP_STAGE04_COPY_TEST_20261008_01'});
export const STAGE4_SOURCE_TARGET=Object.freeze({server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01'});
export const stage4Hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const fail=(condition,code)=>{if(!condition)throw Error(code);};
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const id=v=>{fail(typeof v==='string'&&/^[1-9]\d{0,17}$/.test(v),'STAGE4_EXACT_ID');return v;};
const qty=v=>{fail(typeof v==='string','STAGE4_EXACT_DECIMAL');return decimal(v);};
const sub=(a,b)=>sumDecimals([qty(a),qty(b).startsWith('-')?qty(b).slice(1):'-'+qty(b)]);
const classes=new Set(['SOURCE_MIGRATION','REAL_LOCAL','SYNTHETIC_LOCAL','UNKNOWN']);
const currency=v=>{fail(['TRY','USD','EUR'].includes(v),'STAGE4_CURRENCY');return v;};
const order=(a,b)=>a.key.localeCompare(b.key,'en');
const key=(domain,entityId,dimension)=>JSON.stringify([domain,entityId,dimension]);
const checkedProof=p=>{fail(p&&p.proof&&hex(p.proofHash)&&stage4Hash(p.proof)===p.proofHash,'STAGE4_EXPLICIT_PROOF');return p;};
const copyIdentity=identity=>fail(identity?.server===STAGE4_COPY_TARGET.server&&identity.database===STAGE4_COPY_TARGET.database,'STAGE4_COPY_ONLY');

/** Normalized inputs contain exact decimal strings and SQL full-row hashes.
 * stock.products: {id,unit,grossExact,rowHash}; stock.movements:
 * {id,productId,warehouse,unit,quantityExact,rowHash}.
 * parties/cash.accounts: {id,currency,grossExact,rowHash}; movements:
 * {table,id,accountId,currency,effectExact,rowHash}.
 * Seeds require an explicit immutable proof, never a residual or NULL-key rule.
 * authority: {domain,entityId,proof,proofHash}, supplied by the source-version or
 * approved account application receipt. Missing authority remains a blocker.
 */
export function buildStage4OpeningPlan(input){
 copyIdentity(input?.identity);
 fail(input.sourceIdentity?.server===STAGE4_SOURCE_TARGET.server&&input.sourceIdentity.database===STAGE4_SOURCE_TARGET.database,'STAGE4_SOURCE_IDENTITY');
 fail(uuid(input.runId)&&typeof input.sourceAsOf==='string'&&/^20\d{2}-\d{2}-\d{2}/.test(input.sourceAsOf),'STAGE4_DATED_RUN');
 fail(Array.isArray(input.classification?.classified)&&Array.isArray(input.authority)&&Array.isArray(input.openingSeeds),'STAGE4_EVIDENCE');
 const classByKey=new Map();
 for(const r of input.classification.classified){fail(classes.has(r.classification)&&hex(r.rowHash)&&typeof r.table==='string'&&Array.isArray(r.proofs)&&r.proofs.length>0,'STAGE4_CLASSIFICATION_PROOF');const k=r.table+'/'+id(r.id);fail(!classByKey.has(k),'STAGE4_DUPLICATE_CLASSIFICATION');classByKey.set(k,r);}
 const authorities=new Map();for(const a of input.authority){checkedProof(a);const k=a.domain+'/'+id(a.entityId);fail(!authorities.has(k),'STAGE4_DUPLICATE_AUTHORITY');authorities.set(k,a);}
 const entities=new Map(),components=[],componentIds=new Set();
 function entity(domain,master,dimension){id(master.id);fail(hex(master.rowHash),'STAGE4_MASTER_SQL_HASH');const k=domain+'/'+master.id;fail(!entities.has(k),'STAGE4_DUPLICATE_ENTITY');const e={domain,entityId:master.id,grossExact:qty(master.grossExact),nativeRowHash:master.rowHash.toUpperCase(),nativeTable:domain==='STOCK'?'products':domain==='PARTY'?'party_currency_accounts':'finance_accounts',dimension,components:[],authority:authorities.get(k)??null};entities.set(k,e);return e;}
 function component(e,r,dimension,effect,kind='MOVEMENT',override=null){
  fail(typeof dimension==='string'&&dimension.length<=180&&hex(r.rowHash),'STAGE4_DIMENSION_OR_HASH');
  const ck=kind+'/'+r.table+'/'+r.id;fail(!componentIds.has(ck),'STAGE4_DUPLICATE_EFFECT');componentIds.add(ck);
  const evidence=override??classByKey.get(r.table+'/'+r.id);
  if(evidence)fail(evidence.rowHash.toUpperCase()===r.rowHash.toUpperCase(),'STAGE4_CLASSIFICATION_SQL_HASH_CHANGED');
  const origin=evidence?.classification??'UNKNOWN';fail(classes.has(origin),'STAGE4_ORIGIN');
  const c={key:stage4Hash([e.domain,e.entityId,dimension,ck]),domain:e.domain,entityId:e.entityId,dimension,sourceTable:r.table,sourceId:r.id,rowHash:r.rowHash.toUpperCase(),kind,origin,effectExact:qty(effect),proofHash:evidence?stage4Hash(evidence.proofs):null};components.push(c);e.components.push(c);return c;
 }
 const stocks=new Map();for(const p of input.stock?.products??[]){fail(typeof p.unit==='string'&&p.unit.length<=40,'STAGE4_STOCK_UNIT');stocks.set(p.id,entity('STOCK',p,p.unit));}
 for(const m of input.stock?.movements??[]){const e=stocks.get(id(m.productId));fail(e,'STAGE4_STOCK_MASTER_MISSING');const warehouse=typeof m.warehouse==='string'&&m.warehouse.length?m.warehouse:'UNKNOWN';const unit=m.unit??e.dimension;component(e,{...m,table:'stock_movements'},JSON.stringify([warehouse,unit]),m.quantityExact);}
 for(const [domain,section]of[['PARTY',input.parties],['CASH',input.cash]]){const accounts=new Map();for(const a of section?.accounts??[])accounts.set(a.id,entity(domain,a,currency(a.currency)));for(const m of section?.movements??[]){const e=accounts.get(id(m.accountId));fail(e&&currency(m.currency)===e.dimension,'STAGE4_LEDGER_ACCOUNT_CURRENCY');component(e,m,e.dimension,m.effectExact);}}
 for(const seed of input.openingSeeds){checkedProof(seed);fail(classes.has(seed.origin),'STAGE4_SEED_ORIGIN');const e=entities.get(seed.domain+'/'+id(seed.entityId));fail(e,'STAGE4_SEED_ENTITY');component(e,{table:seed.sourceTable,id:id(seed.sourceId),rowHash:seed.rowHash},seed.dimension,seed.effectExact,'OPENING_SEED',{classification:seed.origin,rowHash:seed.rowHash,proofs:[seed.proof]});}
 const rows=[],entitySummaries=[];
 for(const e of entities.values()){
  const accounted=sumDecimals(e.components.map(c=>c.effectExact)),residual=sub(e.grossExact,accounted);
  if(residual!=='0.00000000')component(e,{table:e.nativeTable,id:e.entityId,rowHash:e.nativeRowHash},e.domain==='STOCK'?JSON.stringify(['UNKNOWN',e.dimension]):e.dimension,residual,'UNKNOWN_RESIDUAL');
  const byDimension=new Map();for(const c of e.components){const a=byDimension.get(c.dimension)??[];a.push(c);byDimension.set(c.dimension,a);}
  if(!byDimension.size)byDimension.set(e.domain==='STOCK'?JSON.stringify(['UNKNOWN',e.dimension]):e.dimension,[]);
  const ownRows=[];
  for(const [dimension,cs]of byDimension){const sum=origin=>sumDecimals(cs.filter(c=>c.origin===origin).map(c=>c.effectExact)),gross=sumDecimals(cs.map(c=>c.effectExact)),synthetic=sum('SYNTHETIC_LOCAL'),unknownCount=cs.filter(c=>c.origin==='UNKNOWN'&&c.effectExact!=='0.00000000').length,unknownDimension=e.domain==='STOCK'&&JSON.parse(dimension).includes('UNKNOWN');
   const row={key:key(e.domain,e.entityId,dimension),domain:e.domain,entityId:e.entityId,dimension,grossExact:gross,sourceExact:sum('SOURCE_MIGRATION'),realLocalExact:sum('REAL_LOCAL'),syntheticExact:synthetic,unknownExact:sum('UNKNOWN'),unknownComponentCount:unknownCount,projectedExact:sub(gross,synthetic),status:unknownCount?'BLOCKED_UNKNOWN':!e.authority?'BLOCKED_SOURCE_AUTHORITY':unknownDimension?'BLOCKED_DIMENSION':'READY',authorityHash:e.authority?.proofHash??null};rows.push(row);ownRows.push(row);
  }
  const gross=sumDecimals(ownRows.map(r=>r.grossExact)),synthetic=sumDecimals(ownRows.map(r=>r.syntheticExact)),projected=sumDecimals(ownRows.map(r=>r.projectedExact));fail(gross===e.grossExact&&projected===sub(e.grossExact,synthetic),'STAGE4_OPENING_CLOSURE');
  entitySummaries.push({domain:e.domain,entityId:e.entityId,nativeTable:e.nativeTable,nativeRowHash:e.nativeRowHash,grossExact:e.grossExact,syntheticExact:synthetic,projectedExact:projected,status:ownRows.every(r=>r.status==='READY')?'READY':ownRows.find(r=>r.status!=='READY').status,componentCount:e.components.length});
 }
 rows.sort(order);components.sort(order);entitySummaries.sort((a,b)=>(a.domain+'/'+a.entityId).localeCompare(b.domain+'/'+b.entityId,'en'));
 const body={schemaVersion:'melisa-stage4-opening-projection.v1',runId:input.runId,identity:STAGE4_COPY_TARGET,sourceIdentity:STAGE4_SOURCE_TARGET,sourceAsOf:input.sourceAsOf,actualT1:false,liveOpeningAuthorized:false,nativeCommercialWrites:0,classificationHash:stage4Hash(input.classification),inputHash:stage4Hash(input),rows,components,entitySummaries,rowsHash:stage4Hash(rows),componentsHash:stage4Hash(components)};
 return {...body,planHash:stage4Hash(body)};
}

export function verifyStage4OpeningPlan(plan){const {planHash,...body}=plan??{};copyIdentity(body.identity);fail(hex(planHash)&&stage4Hash(body)===planHash&&body.actualT1===false&&body.liveOpeningAuthorized===false&&body.nativeCommercialWrites===0,'STAGE4_PLAN_SEAL');fail(stage4Hash(body.rows)===body.rowsHash&&stage4Hash(body.components)===body.componentsHash,'STAGE4_PROJECTION_SEAL');return plan;}

/** A single document/request may have several stock, party and cash effects.
 * Count unique operation identities within each kind; report linked effects
 * separately and never add overlapping kinds into a fabricated grand total.
 */
export function summarizeStage4Operations(operations){
 fail(Array.isArray(operations),'STAGE4_OPERATION_EVIDENCE');const kinds=new Map();
 for(const op of operations){fail(typeof op.kind==='string'&&typeof op.key==='string'&&op.key.length>0&&classes.has(op.origin)&&Array.isArray(op.proofs)&&op.proofs.length>0&&Array.isArray(op.effectKeys),'STAGE4_OPERATION_PROOF');
  const bucket=kinds.get(op.kind)??new Map(),old=bucket.get(op.key);if(old)fail(old.origin===op.origin,'STAGE4_OPERATION_ORIGIN_CONFLICT');const record=old??{origin:op.origin,effects:new Set()};for(const edge of op.effectKeys){fail(typeof edge==='string'&&edge.length>0,'STAGE4_OPERATION_EDGE');record.effects.add(edge);}bucket.set(op.key,record);kinds.set(op.kind,bucket);
 }
 return [...kinds].sort(([a],[b])=>a.localeCompare(b,'en')).map(([kind,ops])=>({kind,uniqueOperations:ops.size,byOrigin:[...classes].map(origin=>({origin,uniqueOperations:[...ops.values()].filter(o=>o.origin===origin).length,linkedEffectCount:new Set([...ops.values()].filter(o=>o.origin===origin).flatMap(o=>[...o.effects])).size})).filter(o=>o.uniqueOperations),linkedEffectCount:new Set([...ops.values()].flatMap(o=>[...o.effects])).size}));
}

/** A parameterized copy-only materialization. The caller owns the connection.
 * Original ledgers/documents are retained. Replaying an identical fixed plan
 * reads existing projection rows; a different body for the UUID is rejected.
 */
export function stage4OpeningSql(plan){
 verifyStage4OpeningPlan(plan);const payload=JSON.stringify(plan),payloadSqlHash=createHash('sha256').update(payload,'utf16le').digest('hex').toUpperCase();
 const componentColumns='component_key,domain,entity_id,dimension_key,source_table,source_id,row_hash,component_kind,origin_class,effect_exact,proof_hash';
 const rowColumns='row_key,domain,entity_id,dimension_key,gross_exact,source_exact,real_local_exact,synthetic_exact,unknown_exact,unknown_component_count,projected_exact,[status],authority_hash';
 const replayDrift=(temp,table,key,columns)=>{const numeric=new Set(['entity_id','source_id','effect_exact','gross_exact','source_exact','real_local_exact','synthetic_exact','unknown_exact','unknown_component_count','projected_exact']);const changed=columns.split(',').map(raw=>{const c=raw.trim(),diff=numeric.has(c)?`e.${c}<>a.${c}`:`e.${c} COLLATE Latin1_General_100_BIN2<>a.${c} COLLATE Latin1_General_100_BIN2 OR DATALENGTH(e.${c})<>DATALENGTH(a.${c})`;return `(${diff} OR(e.${c} IS NULL AND a.${c} IS NOT NULL) OR(e.${c} IS NOT NULL AND a.${c} IS NULL))`;}).join(' OR ');return `IF EXISTS(SELECT 1 FROM ${temp} e FULL JOIN(SELECT * FROM ${table} WHERE run_id=@run)a ON e.${key}=a.${key} WHERE e.${key} IS NULL OR a.${key} IS NULL OR ${changed}) THROW 51440,'STAGE4_REPLAY_PROJECTION_CHANGED',1;`;};
 const effectTables=['stock_movements','customer_movements','supplier_movements','finance_account_movements'];
 fail(plan.components.filter(c=>c.kind==='MOVEMENT').every(c=>effectTables.includes(c.sourceTable)),'STAGE4_EFFECT_TABLE_ALLOWLIST');
 const effectCas=effectTables.map(table=>`IF EXISTS(SELECT 1 FROM #expectedComponents c LEFT JOIN dbo.${table} m WITH(UPDLOCK,HOLDLOCK) ON m.id=c.source_id WHERE c.component_kind=N'MOVEMENT' AND c.source_table=N'${table}' AND(m.id IS NULL OR CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)<>c.row_hash)) THROW 51440,'STAGE4_NATIVE_EFFECT_CHANGED',1;`).join('\n');
 const sql=`SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${STAGE4_COPY_TARGET.database}' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' THROW 51440,'STAGE4_COPY_ONLY',1;
IF CONVERT(varchar(64),HASHBYTES('SHA2_256',@stage4PlanJson),2)<>@stage4PayloadSqlHash OR ISJSON(@stage4PlanJson)<>1 THROW 51440,'STAGE4_BOUND_PAYLOAD',1;
DECLARE @run uniqueidentifier=TRY_CONVERT(uniqueidentifier,JSON_VALUE(@stage4PlanJson,'$.runId')),@hash char(64)=JSON_VALUE(@stage4PlanJson,'$.planHash');
IF @run IS NULL OR JSON_VALUE(@stage4PlanJson,'$.identity.database')<>DB_NAME() OR JSON_VALUE(@stage4PlanJson,'$.actualT1')<>N'false' THROW 51440,'STAGE4_PLAN_TARGET',1;
SELECT [key] component_key,domain,entityId entity_id,dimension dimension_key,sourceTable source_table,sourceId source_id,rowHash row_hash,kind component_kind,origin origin_class,effectExact effect_exact,proofHash proof_hash INTO #expectedComponents FROM OPENJSON(@stage4PlanJson,'$.components') WITH([key] char(64),domain nvarchar(10),entityId bigint,dimension nvarchar(180),sourceTable nvarchar(128),sourceId bigint,rowHash char(64),kind nvarchar(30),origin nvarchar(30),effectExact decimal(28,8),proofHash char(64));
SELECT [key] row_key,domain,entityId entity_id,dimension dimension_key,grossExact gross_exact,sourceExact source_exact,realLocalExact real_local_exact,syntheticExact synthetic_exact,unknownExact unknown_exact,unknownComponentCount unknown_component_count,projectedExact projected_exact,[status],authorityHash authority_hash INTO #expectedRows FROM OPENJSON(@stage4PlanJson,'$.rows') WITH([key] nvarchar(230),domain nvarchar(10),entityId bigint,dimension nvarchar(180),grossExact decimal(28,8),sourceExact decimal(28,8),realLocalExact decimal(28,8),syntheticExact decimal(28,8),unknownExact decimal(28,8),unknownComponentCount int,projectedExact decimal(28,8),[status] nvarchar(40),authorityHash char(64));
CREATE UNIQUE CLUSTERED INDEX IX_Stage4ExpectedComponents ON #expectedComponents(component_key);
CREATE UNIQUE CLUSTERED INDEX IX_Stage4ExpectedRows ON #expectedRows(row_key);
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.stage4_opening_runs',N'U') IS NOT NULL AND(OBJECT_ID(N'dbo.stage4_opening_components',N'U') IS NULL OR OBJECT_ID(N'dbo.stage4_opening_rows',N'U') IS NULL) THROW 51440,'STAGE4_PARTIAL_INSTALL',1;
IF OBJECT_ID(N'dbo.stage4_opening_runs',N'U') IS NULL BEGIN
 CREATE TABLE dbo.stage4_opening_runs(run_id uniqueidentifier NOT NULL PRIMARY KEY,plan_hash char(64) NOT NULL,payload_sql_hash char(64) NOT NULL,source_as_of nvarchar(40) NOT NULL,rows_hash char(64) NOT NULL,components_hash char(64) NOT NULL,row_count int NOT NULL,component_count int NOT NULL);
 CREATE TABLE dbo.stage4_opening_components(run_id uniqueidentifier NOT NULL REFERENCES dbo.stage4_opening_runs(run_id),component_key char(64) NOT NULL,domain nvarchar(10) NOT NULL,entity_id bigint NOT NULL,dimension_key nvarchar(180) NOT NULL,source_table nvarchar(128) NOT NULL,source_id bigint NOT NULL,row_hash char(64) NOT NULL,component_kind nvarchar(30) NOT NULL,origin_class nvarchar(30) NOT NULL,effect_exact decimal(28,8) NOT NULL,proof_hash char(64) NULL,PRIMARY KEY(run_id,component_key));
 CREATE TABLE dbo.stage4_opening_rows(run_id uniqueidentifier NOT NULL REFERENCES dbo.stage4_opening_runs(run_id),row_key nvarchar(230) NOT NULL,domain nvarchar(10) NOT NULL,entity_id bigint NOT NULL,dimension_key nvarchar(180) NOT NULL,gross_exact decimal(28,8) NOT NULL,source_exact decimal(28,8) NOT NULL,real_local_exact decimal(28,8) NOT NULL,synthetic_exact decimal(28,8) NOT NULL,unknown_exact decimal(28,8) NOT NULL,unknown_component_count int NOT NULL,projected_exact decimal(28,8) NOT NULL,[status] nvarchar(40) NOT NULL,authority_hash char(64) NULL,PRIMARY KEY(run_id,row_key));
END;
IF EXISTS(SELECT 1 FROM dbo.stage4_opening_runs WITH(UPDLOCK,HOLDLOCK) WHERE run_id=@run) BEGIN
 IF NOT EXISTS(SELECT 1 FROM dbo.stage4_opening_runs WHERE run_id=@run AND plan_hash=@hash AND payload_sql_hash=@stage4PayloadSqlHash AND row_count=(SELECT COUNT(*) FROM dbo.stage4_opening_rows WHERE run_id=@run) AND component_count=(SELECT COUNT(*) FROM dbo.stage4_opening_components WHERE run_id=@run)) THROW 51440,'STAGE4_REPLAY_CONFLICT',1;
 ${replayDrift('#expectedComponents','dbo.stage4_opening_components','component_key',componentColumns)}
 ${replayDrift('#expectedRows','dbo.stage4_opening_rows','row_key',rowColumns)}
 COMMIT; SELECT CAST(1 AS bit) replay,@hash planHash; RETURN;
END;
${effectCas}
IF EXISTS(SELECT 1 FROM OPENJSON(@stage4PlanJson,'$.entitySummaries') WITH(domain nvarchar(10),entityId bigint,nativeRowHash varchar(64),grossExact decimal(28,8)) e LEFT JOIN dbo.products p WITH(UPDLOCK,HOLDLOCK) ON e.domain=N'STOCK' AND p.id=e.entityId LEFT JOIN dbo.party_currency_accounts a WITH(UPDLOCK,HOLDLOCK) ON e.domain=N'PARTY' AND a.id=e.entityId LEFT JOIN dbo.finance_accounts f WITH(UPDLOCK,HOLDLOCK) ON e.domain=N'CASH' AND f.id=e.entityId WHERE(e.domain=N'STOCK' AND(p.id IS NULL OR p.current_stock_qty<>e.grossExact OR CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)<>e.nativeRowHash)) OR(e.domain=N'PARTY' AND(a.id IS NULL OR a.current_balance<>e.grossExact OR CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT a.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)<>e.nativeRowHash)) OR(e.domain=N'CASH' AND(f.id IS NULL OR COALESCE(f.balance_exact,CONVERT(decimal(28,8),f.current_balance))<>e.grossExact OR CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT f.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)<>e.nativeRowHash))) THROW 51440,'STAGE4_NATIVE_BASELINE_CHANGED',1;
INSERT dbo.stage4_opening_runs SELECT @run,@hash,@stage4PayloadSqlHash,JSON_VALUE(@stage4PlanJson,'$.sourceAsOf'),JSON_VALUE(@stage4PlanJson,'$.rowsHash'),JSON_VALUE(@stage4PlanJson,'$.componentsHash'),(SELECT COUNT(*) FROM OPENJSON(@stage4PlanJson,'$.rows')),(SELECT COUNT(*) FROM OPENJSON(@stage4PlanJson,'$.components'));
INSERT dbo.stage4_opening_components SELECT @run,[key],domain,entityId,dimension,sourceTable,sourceId,rowHash,kind,origin,effectExact,proofHash FROM OPENJSON(@stage4PlanJson,'$.components') WITH([key] char(64),domain nvarchar(10),entityId bigint,dimension nvarchar(180),sourceTable nvarchar(128),sourceId bigint,rowHash char(64),kind nvarchar(30),origin nvarchar(30),effectExact decimal(28,8),proofHash char(64));
INSERT dbo.stage4_opening_rows SELECT @run,[key],domain,entityId,dimension,grossExact,sourceExact,realLocalExact,syntheticExact,unknownExact,unknownComponentCount,projectedExact,[status],authorityHash FROM OPENJSON(@stage4PlanJson,'$.rows') WITH([key] nvarchar(230),domain nvarchar(10),entityId bigint,dimension nvarchar(180),grossExact decimal(28,8),sourceExact decimal(28,8),realLocalExact decimal(28,8),syntheticExact decimal(28,8),unknownExact decimal(28,8),unknownComponentCount int,projectedExact decimal(28,8),[status] nvarchar(40),authorityHash char(64));
IF EXISTS(SELECT 1 FROM dbo.stage4_opening_rows WHERE run_id=@run AND(gross_exact<>source_exact+real_local_exact+synthetic_exact+unknown_exact OR projected_exact<>gross_exact-synthetic_exact OR([status]=N'READY' AND unknown_component_count<>0))) THROW 51440,'STAGE4_PROJECTION_CLOSURE',1;
COMMIT; SELECT CAST(0 AS bit) replay,@hash planHash;
`;
 return {sql,parameters:{stage4PlanJson:payload,stage4PayloadSqlHash:payloadSqlHash},commercialWrites:0,copyTarget:STAGE4_COPY_TARGET};
}
