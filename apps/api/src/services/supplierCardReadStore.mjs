import {getCanonicalBusinessSaleDefinitionHash} from './canonicalBusinessSessionContext.mjs';
import {registeredSharedPartyContext,sharedPartyReaderDefinition,assertSharedPartyTransactionIdentity} from './isolatedPartyCardReader.mjs';
import {createHash} from 'node:crypto';
import {supplierCardError,parseSupplierCardId} from './supplierCardModel.mjs';
import {SUPPLIER_DELTA_READ_SQL,attachSupplierDeltas} from './supplierCurrencyDeltaRead.mjs';
import {catalogSourceVersion} from './catalogProductReadStore.mjs';
import {finalPartyContext,readFinalPartyProof,attachFinalPartyProof} from './finalPartyDeltaRead.mjs';
import {configuredCurrentFinanceContext,currentFinanceContext,readCurrentFinanceProof,attachCurrentFinanceProof} from './currentFinanceDeltaRead.mjs';

export const SUPPLIER_CARD_PROC='dbo.usp_read_supplier_cards';
export const SUPPLIER_CARD_RUN='VEGA-OPENING-TEST-20261004-06';
const sourceHash='36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400';
const planHash='18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a';
export const SUPPLIER_CARD_PRESERVED_SQL=`SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(name,N'|',CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(object_id)),2),N'|',is_disabled,N'|',OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger'),N'|',OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger'),N'|',OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger'))),N';') WITHIN GROUP(ORDER BY name)),2) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%' OR name LIKE N'immutable[_]operation[_]%' OR name LIKE N'immutable[_]accepted[_]%'`;
export const SUPPLIER_CARD_READY_SQL=`IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))<>N'Semih\\MELISADEV' THROW 51076,'SUPPLIER_CARD_TARGET_UNAVAILABLE',1;
IF NOT EXISTS(SELECT 1 FROM erp_migration.runs WHERE run_id=N'${SUPPLIER_CARD_RUN}' AND status=N'COMMITTED' AND source_hash='${sourceHash}' AND plan_hash='${planHash}' AND source_as_of=N'2026-09-30') THROW 51076,'SUPPLIER_CARD_SOURCE_UNAVAILABLE',1;
IF (${SUPPLIER_CARD_PRESERVED_SQL})<>'9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E' THROW 51076,'SUPPLIER_CARD_GUARD_UNAVAILABLE',1;
IF (SELECT COUNT(*) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%' AND is_disabled=0 AND OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger')=1)<>37 THROW 51076,'SUPPLIER_CARD_QUARANTINE_UNAVAILABLE',1;
IF NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_manifest WHERE run_id=N'${SUPPLIER_CARD_RUN}' AND source_hash='${sourceHash}' AND plan_hash='${planHash}' AND source_as_of=N'2026-09-30' AND sealed=1 AND seal_hash='69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7' AND source_rows=176 AND native_holds=172 AND not_present=4) THROW 51076,'SUPPLIER_CARD_QUARANTINE_UNAVAILABLE',1;
IF (SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds)<>176 OR (SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds WHERE native_id IS NOT NULL)<>172 OR (SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds WHERE native_id IS NULL)<>4 OR EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT h.entity,h.source_key,h.source_id,h.source_company,h.source_code,h.source_name,h.native_id,h.native_entity_id,h.native_source_key,h.native_code,h.native_name,h.status,h.reasons_json,h.binding_basis FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)<>h.row_hash) THROW 51076,'SUPPLIER_CARD_QUARANTINE_BINDING_DRIFT',1;
IF LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT h.source_key,h.row_hash FROM erp_migration.operation_quarantine_holds h ORDER BY h.source_key FOR JSON PATH)),2))<>'69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7' THROW 51076,'SUPPLIER_CARD_QUARANTINE_BINDING_DRIFT',1;
IF COALESCE(CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_read_customer_cards'))),2),'')<>'7FE6BEE7728312D666FF3B68151CA60A08B84E4A6D5B33B36F300A48381E6C8E' THROW 51076,'SUPPLIER_CARD_C06_READER_DRIFT',1;
IF (SELECT COUNT(*) FROM dbo.test_purchase_batch_guard_manifest)<>15 OR EXISTS(SELECT 1 FROM dbo.test_purchase_batch_guard_manifest m LEFT JOIN sys.triggers t ON t.object_id=OBJECT_ID(N'dbo.'+m.name) WHERE t.object_id IS NULL OR t.is_disabled=1 OR m.after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(t.object_id)),2)) THROW 51076,'SUPPLIER_CARD_LEGACY_GUARD_DRIFT',1;
IF (SELECT COUNT(*) FROM dbo.test_purchase_fx_guard_manifest)<>17 OR EXISTS(SELECT 1 FROM dbo.test_purchase_fx_guard_manifest m LEFT JOIN sys.objects o ON o.object_id=OBJECT_ID(N'dbo.'+m.name) WHERE o.object_id IS NULL OR m.definition_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2) OR (o.type=N'TR' AND COALESCE(OBJECTPROPERTY(o.object_id,'ExecIsTriggerDisabled'),1)<>0)) THROW 51076,'SUPPLIER_CARD_FX_GUARD_DRIFT',1;
IF (SELECT COUNT(*) FROM erp_migration.records WHERE run_id=N'${SUPPLIER_CARD_RUN}' AND entity IN(N'parties',N'accounts') AND JSON_VALUE(payload_json,'$.role')=N'supplier')<>998 OR
(SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(entity,N'|',source_key,N'|',payload_hash,N'|',CONVERT(varchar(64),HASHBYTES('SHA2_256',payload_json),2))),N';') WITHIN GROUP(ORDER BY entity,source_key)),2) FROM erp_migration.records WHERE run_id=N'${SUPPLIER_CARD_RUN}' AND entity IN(N'parties',N'accounts') AND JSON_VALUE(payload_json,'$.role')=N'supplier')<>'59A82329B54B3B08FF5A1AF23B1AC2ED4322ADC2785772604558F1F32BFB8644' THROW 51076,'SUPPLIER_CARD_STAGE_UNAVAILABLE',1;`;

// Local temporary public projections avoid repeated correlated JSON decoding.
// The caller owns a SERIALIZABLE read transaction for readiness, total and page.
export const SUPPLIER_CARD_PROC_SQL=`CREATE PROCEDURE ${SUPPLIER_CARD_PROC}
 @supplier_id bigint=NULL,@search nvarchar(120)=N'',@page int=1,@page_size int=25,@status nvarchar(12)=N'all',@quarantine nvarchar(12)=N'all'
 WITH EXECUTE AS OWNER AS BEGIN
 SET NOCOUNT ON;
 IF @@TRANCOUNT=0 OR NOT EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE session_id=@@SPID AND transaction_isolation_level=4) THROW 51076,'SUPPLIER_CARD_READ_TRANSACTION_REQUIRED',1;
 IF @page IS NULL OR @page<1 OR @page>1000000 OR @page_size IS NULL OR @page_size<1 OR @page_size>100 OR @search IS NULL OR @status IS NULL OR @status NOT IN(N'all',N'active',N'passive') OR @quarantine IS NULL OR @quarantine NOT IN(N'all',N'included',N'excluded') OR (@supplier_id IS NOT NULL AND @supplier_id<1) THROW 51076,'SUPPLIER_CARD_QUERY_INVALID',1;
 ${SUPPLIER_CARD_READY_SQL}
 DECLARE @pattern nvarchar(500)=N'%'+REPLACE(REPLACE(REPLACE(REPLACE(@search,N'~',N'~~'),N'%',N'~%'),N'_',N'~_'),N'[',N'~[')+N'%';
 -- Decode the sealed 998 public party/account projections once. These are local
 -- tempdb query caches, never persistent tables or native/business mutations.
 SELECT r.source_key,JSON_VALUE(r.payload_json,'$.source_id') sourceId,JSON_VALUE(r.payload_json,'$.company') company,JSON_VALUE(r.payload_json,'$.role') role,JSON_VALUE(r.payload_json,'$.code') code,JSON_VALUE(r.payload_json,'$.name') name,JSON_VALUE(r.payload_json,'$.currency_code') currency,JSON_VALUE(r.payload_json,'$.balance_status') balanceStatus,JSON_VALUE(JSON_VALUE(r.payload_json,'$.source_payload_json'),'$.scope') scope
 INTO #C07Parties FROM erp_migration.records r WHERE r.run_id=N'${SUPPLIER_CARD_RUN}' AND r.entity=N'parties' AND JSON_VALUE(r.payload_json,'$.role')=N'supplier';
 SELECT a.source_key,JSON_VALUE(a.payload_json,'$.party_source_key') party_source_key,JSON_VALUE(a.payload_json,'$.role') role,JSON_VALUE(a.payload_json,'$.currency_code') currency,JSON_VALUE(a.payload_json,'$.balance_status') balanceStatus,CONVERT(varchar(50),TRY_CONVERT(decimal(28,8),JSON_VALUE(a.payload_json,'$.balance'))) sourceOpeningBalanceExact
 INTO #C07Accounts FROM erp_migration.records a WHERE a.run_id=N'${SUPPLIER_CARD_RUN}' AND a.entity=N'accounts' AND JSON_VALUE(a.payload_json,'$.role')=N'supplier';
 -- Resolve each immutable hold through the same four identity paths once.
 -- Separate branches prevent the correlated OR/source-link lookup per candidate.
 SELECT b.supplierId,b.holdSourceKey INTO #C07CardHolds FROM (
 SELECT c.id supplierId,h.source_key holdSourceKey FROM dbo.suppliers c JOIN erp_migration.operation_quarantine_holds h ON CONVERT(varbinary(max),h.native_source_key)=CONVERT(varbinary(max),c.source_record_key)
 UNION SELECT c.id,h.source_key FROM dbo.suppliers c JOIN erp_migration.operation_quarantine_holds h ON h.entity=N'supplier' AND h.native_id=c.id
 UNION SELECT c.id,h.source_key FROM dbo.suppliers c JOIN erp_migration.operation_quarantine_holds h ON h.native_entity_id=c.party_entity_id AND c.party_entity_id IS NOT NULL
 UNION SELECT hl.supplier_id,h.source_key FROM dbo.party_source_links hl JOIN erp_migration.operation_quarantine_holds h ON hl.source_company=h.source_company AND CONVERT(varchar(20),hl.source_id)=h.source_id WHERE hl.supplier_id IS NOT NULL
 ) b;
 SELECT c.id INTO #C07Eligible FROM dbo.suppliers c WHERE c.is_deleted=0 AND (@supplier_id IS NULL OR c.id=@supplier_id)
 AND (@status=N'all' OR (@status=N'active' AND c.is_active=1) OR (@status=N'passive' AND c.is_active=0))
 AND (@search=N'' OR c.supplier_code LIKE @pattern ESCAPE N'~' OR c.name LIKE @pattern ESCAPE N'~' OR c.phone LIKE @pattern ESCAPE N'~')
 AND (@quarantine=N'all' OR (@quarantine=N'included' AND EXISTS(SELECT 1 FROM #C07CardHolds h WHERE h.supplierId=c.id)) OR (@quarantine=N'excluded' AND NOT EXISTS(SELECT 1 FROM #C07CardHolds h WHERE h.supplierId=c.id)));
 SELECT id INTO #C07Page FROM #C07Eligible ORDER BY id OFFSET ((@page-1)*@page_size) ROWS FETCH NEXT @page_size ROWS ONLY;
 SELECT l.id,l.party_entity_id,l.supplier_id,l.customer_id,l.source_company,l.source_id,l.source_currency,l.source_record_key,l.migration_run_id INTO #C07Links FROM dbo.party_source_links l JOIN #C07Page pg ON pg.id=l.supplier_id WHERE l.customer_id IS NULL;
 SELECT m.supplier_id,COALESCE(m.account_currency,m.currency_code) currency,
 SUM(CASE WHEN m.source_record_key IS NULL AND m.cutover_source_key IS NULL AND ISNULL(m.affects_balance,1)=1 AND m.balance_effect_exact IS NULL AND m.balance_effect IS NULL THEN 1 ELSE 0 END) localMissing,
 SUM(CASE WHEN ISNULL(m.affects_balance,1)=1 AND m.balance_effect_exact IS NULL AND m.balance_effect IS NULL THEN 1 ELSE 0 END) ledgerMissing,
 SUM(CASE WHEN m.source_record_key IS NULL AND m.cutover_source_key IS NULL AND ISNULL(m.affects_balance,1)=1 THEN COALESCE(m.balance_effect_exact,CONVERT(decimal(28,8),m.balance_effect)) ELSE CONVERT(decimal(28,8),0) END) localDelta,
 SUM(CASE WHEN ISNULL(m.affects_balance,1)=1 THEN COALESCE(m.balance_effect_exact,CONVERT(decimal(28,8),m.balance_effect)) ELSE CONVERT(decimal(28,8),0) END) ledgerBalance
 INTO #C07Ledger FROM dbo.supplier_movements m JOIN #C07Page pg ON pg.id=m.supplier_id GROUP BY m.supplier_id,COALESCE(m.account_currency,m.currency_code);
 SELECT (SELECT COUNT(*) FROM #C07Eligible) total,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@@PROCID)),2) readerDefinitionHash,
 (SELECT JSON_QUERY((SELECT CONVERT(varchar(20),c.id) id,c.supplier_code supplierCode,c.name supplierName,c.phone,c.email,c.address,c.city,c.country,c.currency_code currency,CONVERT(varchar(50),c.balance) scalarBalanceExact,c.is_active isActive,c.is_deleted isDeleted,CONVERT(varchar(20),c.party_entity_id) partyEntityId,c.source_record_key sourceRecordKey,c.migration_run_id migrationRunId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)) supplier,
 JSON_QUERY(COALESCE((SELECT CONVERT(varchar(20),l.id) id,CONVERT(varchar(20),l.party_entity_id) partyEntityId,CONVERT(varchar(20),l.supplier_id) supplierId,l.source_company sourceCompany,CONVERT(varchar(20),l.source_id) sourceId,l.source_currency sourceCurrency,l.source_record_key sourceRecordKey,l.migration_run_id migrationRunId FROM #C07Links l WHERE l.supplier_id=c.id AND l.customer_id IS NULL FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) sourceLinks,
 JSON_QUERY(COALESCE((SELECT r.source_key sourceKey,r.sourceId sourceId,r.company company,r.role role,r.code code,r.name name,r.currency currency,r.balanceStatus balanceStatus,r.scope scope,
 (SELECT COUNT(*) FROM dbo.party_source_links gl WHERE gl.source_id=l.source_id AND gl.source_company=l.source_company AND gl.supplier_id IS NOT NULL AND gl.customer_id IS NULL) globalSourceLinkCount
 FROM #C07Links l JOIN #C07Parties r ON r.sourceId=l.source_id AND r.company=l.source_company WHERE l.supplier_id=c.id AND l.customer_id IS NULL FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) sourceParties,
 JSON_QUERY(COALESCE((SELECT a.source_key sourceKey,a.party_source_key partySourceKey,a.role role,a.currency currency,a.balanceStatus balanceStatus,a.sourceOpeningBalanceExact sourceOpeningBalanceExact
 FROM #C07Accounts a WHERE EXISTS(SELECT 1 FROM #C07Links l JOIN #C07Parties r ON r.sourceId=l.source_id AND r.company=l.source_company WHERE l.supplier_id=c.id AND l.customer_id IS NULL AND a.party_source_key=r.source_key) FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) sourceAccounts,
 JSON_QUERY(COALESCE((SELECT CONVERT(varchar(20),a.id) id,CONVERT(varchar(20),c.id) supplierId,CONVERT(varchar(20),a.supplier_id) nativeOwnerSupplierId,CONVERT(varchar(20),a.party_entity_id) partyEntityId,a.currency_code currency,CONVERT(varchar(50),a.current_balance) nativeBalanceExact,a.balance_status balanceStatus,a.source_record_key sourceRecordKey,a.migration_run_id migrationRunId,
 CONVERT(varchar(50),CASE WHEN COALESCE(e.localMissing,0)>0 THEN NULL ELSE COALESCE(e.localDelta,CONVERT(decimal(28,8),0)) END) localDeltaExact,
 CONVERT(varchar(50),CASE WHEN COALESCE(e.ledgerMissing,0)>0 THEN NULL ELSE COALESCE(e.ledgerBalance,CONVERT(decimal(28,8),0)) END) ledgerBalanceExact
 FROM dbo.party_currency_accounts a LEFT JOIN #C07Ledger e ON e.supplier_id=c.id AND e.currency=a.currency_code WHERE (a.supplier_id=c.id OR (a.supplier_id IS NULL AND a.party_entity_id=c.party_entity_id)) AND a.customer_id IS NULL FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) nativeAccounts,
 JSON_QUERY(COALESCE((SELECT h.entity,CONVERT(varchar(20),h.native_id) nativeId,h.source_key sourceKey,h.status,JSON_QUERY(h.reasons_json) reasons FROM erp_migration.operation_quarantine_holds h JOIN #C07CardHolds ch ON ch.holdSourceKey=h.source_key WHERE ch.supplierId=c.id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) quarantineHolds
 FROM #C07Page pg JOIN dbo.suppliers c ON c.id=pg.id ORDER BY c.id FOR JSON PATH,INCLUDE_NULL_VALUES) rowsJson;
 END;`;
export const SUPPLIER_CARD_PROC_HASH=createHash('sha256').update(SUPPLIER_CARD_PROC_SQL,'utf16le').digest('hex').toUpperCase();

const units=s=>typeof s==='string'&&/^-?\d+\.\d{1,8}$/.test(s)?BigInt(s.replace('.','').replace(/^-/,'')+'0'.repeat(8-s.split('.')[1].length))*(s.startsWith('-')?-1n:1n):null;
const exact=n=>{const s=(n<0n?-n:n).toString().padStart(9,'0');return (n<0n?'-':'')+s.slice(0,-8)+'.'+s.slice(-8);};
export function assembleSupplierCardRaw(raw){
 const {supplier:c,sourceLinks:links,sourceParties:parties,sourceAccounts:sources,nativeAccounts:natives,quarantineHolds:holds}=raw;
 if(!c||![links,parties,sources,natives,holds].every(Array.isArray))throw supplierCardError();
 const single=links.length===1&&parties.length===1,link=links[0],party=parties[0];
 const accepted=single&&party.globalSourceLinkCount===1&&party.role==='supplier'&&party.company==='F0103'&&party.balanceStatus==='SOURCE'&&party.sourceId===link.sourceId&&party.company===link.sourceCompany&&link.partyEntityId===c.partyEntityId&&party.code===c.supplierCode&&party.name===c.supplierName&&party.currency===c.currency&&typeof party.scope==='string'&&party.scope.startsWith('IN_SCOPE');
 c.discountStatus='UNKNOWN';c.discountExact=null;
 raw.linkage={status:accepted?'accepted-opening':links.length>1||parties.length>1||party?.globalSourceLinkCount>1?'ambiguous':links.length===0?'unmapped':'unknown',verified:accepted,sourceLinkCount:links.length,sourcePartyCount:parties.length,reasons:accepted?[]:['SOURCE_IDENTITY_UNVERIFIED']};
 raw.provenance={runId:SUPPLIER_CARD_RUN,sourceHash,planHash,sourceAsOf:'2026-09-30',verified:true,quarantineVerified:true,readOnly:true,sourceFreshLive:false,cutoverAccepted:false};
 for(const source of sources){
  const matches=accepted?sources.filter(s=>s.partySourceKey===party.sourceKey&&s.currency===source.currency):[];
  const accounts=accepted?natives.filter(n=>n.currency===source.currency&&n.partyEntityId===c.partyEntityId&&n.nativeOwnerSupplierId===c.id):[];
  const matched=matches.length===1&&accounts.length===1&&source.partySourceKey===party.sourceKey&&source.role==='supplier'&&['TRY','USD','EUR'].includes(source.currency);
  source.matchStatus=matched?'matched':matches.length>1||accounts.length>1?'ambiguous':'unmatched';source.matchedNativeAccountId=matched?accounts[0].id:null;source.confidence=matched&&source.balanceStatus==='SOURCE'?'source-matched':'unknown';
 }
 for(const n of natives){
  const matches=sources.filter(s=>s.matchedNativeAccountId===n.id),source=matches.length===1?matches[0]:null;
  n.matchStatus=source?'matched':'unmatched';n.sourceAccountKey=source?.sourceKey??null;n.sourceOpeningBalanceExact=source?.sourceOpeningBalanceExact??null;n.expectedNativeBalanceExact=null;
  n.reconciliationStatus='native-unverified';n.confidence='native-unverified';
  if(source?.balanceStatus==='SOURCE'){
   const opening=units(source.sourceOpeningBalanceExact),delta=units(n.localDeltaExact),sourceDelta=n.sourceDeltaVerified===true?units(n.sourceDeltaExact):n.sourceDeltaExact===undefined?0n:null,finalDelta=n.finalSourceDeltaVerified===true?units(n.finalSourceDeltaExact):n.finalSourceDeltaExact===undefined?0n:null,current=units(n.nativeBalanceExact),ledger=units(n.ledgerBalanceExact);
   if([opening,delta,sourceDelta,finalDelta,current,ledger].every(v=>v!==null)){const expected=opening+delta+sourceDelta+finalDelta;n.expectedNativeBalanceExact=exact(expected);n.reconciliationStatus=current===expected&&current===ledger?'reconciled':'drift';n.confidence=n.reconciliationStatus==='reconciled'?'source-matched':'drift';}
  }else if(source){n.reconciliationStatus='unknown';n.confidence='unknown';}
  if(holds.length){n.reconciliationStatus='quarantined';n.confidence='quarantined';}
 }
 return raw;
}

async function defaultRuntime(){const db=await import('../config/database.js');if(!db.isCanonicalTest()&&!registeredSharedPartyContext())throw supplierCardError('SUPPLIER_CARD_UNAVAILABLE');return {pool:await db.getSqlPool(),sql:db.getSqlDriver()};}
export function createSupplierCardReadStore({getRuntime=defaultRuntime,getFinalContext=catalogSourceVersion,getCurrentFinanceContext=configuredCurrentFinanceContext,getCopyContext=registeredSharedPartyContext}={}){
 const read=async(id,options={})=>{
  const {search='',page=1,limit=25,status='all',quarantine='all'}=options;
  if(typeof search!=='string'||search.length>120||!Number.isInteger(page)||page<1||page>1000000||!Number.isInteger(limit)||limit<1||limit>100||!['all','active','passive'].includes(status)||!['all','included','excluded'].includes(quarantine))throw supplierCardError('SUPPLIER_CARD_QUERY_INVALID','Geçerli arama ve sayfalama bilgisi gerekli.',400);
  let tx;try{const {pool,sql}=await getRuntime();tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
   const copy=getCopyContext();let readerHash=getCanonicalBusinessSaleDefinitionHash(SUPPLIER_CARD_PROC,SUPPLIER_CARD_PROC_HASH),readerProcedure=SUPPLIER_CARD_PROC;
   if(copy){await assertSharedPartyTransactionIdentity({sql,tx,context:copy});const recipe=sharedPartyReaderDefinition(copy,{role:'supplier',sourceSQL:SUPPLIER_CARD_PROC_SQL});readerHash=recipe.afterHash;readerProcedure=recipe.name;}
   const req=new sql.Request(tx);req.input('supplier_id',sql.BigInt,id??null).input('search',sql.NVarChar(120),search).input('page',sql.Int,page).input('page_size',sql.Int,limit).input('status',sql.NVarChar(12),status).input('quarantine',sql.NVarChar(12),quarantine);
   if(copy)req.input('copy_id',sql.UniqueIdentifier,copy.copyId);
   const result=await req.execute(readerProcedure),row=result.recordset?.[0];
   if(!row||row.readerDefinitionHash!==readerHash||!Number.isSafeInteger(row.total)||row.total<0)throw supplierCardError();
   const parsed=JSON.parse(row.rowsJson??'[]');if(!Array.isArray(parsed))throw supplierCardError();
   const ids=parsed.flatMap(r=>r.nativeAccounts.map(a=>parseSupplierCardId(a.id)));
   if(ids.length){const deltaReq=new sql.Request(tx).input('account_ids',sql.NVarChar(sql.MAX),JSON.stringify(ids));const proof=(await deltaReq.query(SUPPLIER_DELTA_READ_SQL)).recordset;attachSupplierDeltas(parsed,proof);}
   const context=getFinalContext();if(finalPartyContext(context)){const proof=await readFinalPartyProof({sql,tx,ids,context});attachFinalPartyProof(parsed,proof);}
   const currentContext=getCurrentFinanceContext();if(currentFinanceContext(currentContext)){attachCurrentFinanceProof(parsed,await readCurrentFinanceProof({sql,tx,ids,context:currentContext}));}
   const rows=parsed.map(assembleSupplierCardRaw);await tx.commit();return {rows,total:row.total};
  }catch(error){if(tx)try{await tx.rollback();}catch{}if(error?.statusCode===400)throw error;throw supplierCardError('SUPPLIER_CARD_UNAVAILABLE','Tedarikçi kartı okuma kanıtı şu anda kullanılamıyor.',503);}
 };
 return {listSupplierCardRows:options=>read(null,options),readSupplierCardRows:async id=>(await read(parseSupplierCardId(id),{limit:1})).rows[0]??null};
}
const store=createSupplierCardReadStore();
export const listSupplierCardRows=store.listSupplierCardRows;
export const readSupplierCardRows=store.readSupplierCardRows;
