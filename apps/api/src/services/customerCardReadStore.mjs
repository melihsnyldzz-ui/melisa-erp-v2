import {createHash} from 'node:crypto';
import {customerCardError,parseCustomerCardId} from './customerCardModel.mjs';
import {catalogSourceVersion} from './catalogProductReadStore.mjs';
import {finalPartyContext,readFinalPartyProof,attachFinalPartyProof} from './finalPartyDeltaRead.mjs';
import {configuredCurrentFinanceContext,currentFinanceContext,readCurrentFinanceProof,attachCurrentFinanceProof} from './currentFinanceDeltaRead.mjs';

export const CUSTOMER_CARD_PROC='dbo.usp_read_customer_cards';
export const CUSTOMER_CARD_RUN='VEGA-OPENING-TEST-20261004-06';
const sourceHash='36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400';
const planHash='18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a';
export const CUSTOMER_CARD_PRESERVED_SQL=`SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(name,N'|',CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(object_id)),2),N'|',is_disabled,N'|',OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger'),N'|',OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger'),N'|',OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger'))),N';') WITHIN GROUP(ORDER BY name)),2) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%' OR name LIKE N'immutable[_]operation[_]%' OR name LIKE N'immutable[_]accepted[_]%'`;
export const CUSTOMER_CARD_READY_SQL=`IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))<>N'Semih\\MELISADEV' THROW 51076,'CUSTOMER_CARD_TARGET_UNAVAILABLE',1;
IF NOT EXISTS(SELECT 1 FROM erp_migration.runs WHERE run_id=N'${CUSTOMER_CARD_RUN}' AND status=N'COMMITTED' AND source_hash='${sourceHash}' AND plan_hash='${planHash}' AND source_as_of=N'2026-09-30') THROW 51076,'CUSTOMER_CARD_SOURCE_UNAVAILABLE',1;
IF (${CUSTOMER_CARD_PRESERVED_SQL})<>'9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E' THROW 51076,'CUSTOMER_CARD_GUARD_UNAVAILABLE',1;
IF (SELECT COUNT(*) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%' AND is_disabled=0 AND OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger')=1)<>37 THROW 51076,'CUSTOMER_CARD_QUARANTINE_UNAVAILABLE',1;
IF NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_manifest WHERE run_id=N'${CUSTOMER_CARD_RUN}' AND source_hash='${sourceHash}' AND plan_hash='${planHash}' AND source_as_of=N'2026-09-30' AND sealed=1 AND seal_hash='69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7' AND source_rows=176 AND native_holds=172 AND not_present=4) THROW 51076,'CUSTOMER_CARD_QUARANTINE_UNAVAILABLE',1;
IF (SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds)<>176 OR (SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds WHERE native_id IS NOT NULL)<>172 OR (SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds WHERE native_id IS NULL)<>4 OR EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT h.entity,h.source_key,h.source_id,h.source_company,h.source_code,h.source_name,h.native_id,h.native_entity_id,h.native_source_key,h.native_code,h.native_name,h.status,h.reasons_json,h.binding_basis FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)<>h.row_hash) THROW 51076,'CUSTOMER_CARD_QUARANTINE_BINDING_DRIFT',1;
IF LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT h.source_key,h.row_hash FROM erp_migration.operation_quarantine_holds h ORDER BY h.source_key FOR JSON PATH)),2))<>'69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7' THROW 51076,'CUSTOMER_CARD_QUARANTINE_BINDING_DRIFT',1;
IF (SELECT COUNT(*) FROM erp_migration.records WHERE run_id=N'${CUSTOMER_CARD_RUN}' AND entity IN(N'parties',N'accounts') AND JSON_VALUE(payload_json,'$.role')=N'customer')<>806 OR
(SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(entity,N'|',source_key,N'|',payload_hash,N'|',CONVERT(varchar(64),HASHBYTES('SHA2_256',payload_json),2))),N';') WITHIN GROUP(ORDER BY entity,source_key)),2) FROM erp_migration.records WHERE run_id=N'${CUSTOMER_CARD_RUN}' AND entity IN(N'parties',N'accounts') AND JSON_VALUE(payload_json,'$.role')=N'customer')<>'4165D239F10C66F0986CE460F8705098FFFF81B0BF3DFF3CAF8DA76037E734C6' THROW 51076,'CUSTOMER_CARD_STAGE_UNAVAILABLE',1;`;

const holds=`(h.entity=N'customer' AND h.native_id=c.id) OR (h.native_entity_id=c.party_entity_id AND c.party_entity_id IS NOT NULL) OR EXISTS(SELECT 1 FROM dbo.party_source_links hl WHERE hl.customer_id=c.id AND hl.source_company=h.source_company AND CONVERT(varchar(20),hl.source_id)=h.source_id)`;
// Local temporary public projections avoid repeated correlated JSON decoding.
// The caller owns a SERIALIZABLE read transaction for readiness, total and page.
export const CUSTOMER_CARD_PROC_SQL=`CREATE PROCEDURE ${CUSTOMER_CARD_PROC}
 @customer_id bigint=NULL,@search nvarchar(120)=N'',@page int=1,@page_size int=25,@status nvarchar(12)=N'all',@quarantine nvarchar(12)=N'all'
 WITH EXECUTE AS OWNER AS BEGIN
 SET NOCOUNT ON;
 IF @@TRANCOUNT=0 OR NOT EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE session_id=@@SPID AND transaction_isolation_level=4) THROW 51076,'CUSTOMER_CARD_READ_TRANSACTION_REQUIRED',1;
 IF @page IS NULL OR @page<1 OR @page>1000000 OR @page_size IS NULL OR @page_size<1 OR @page_size>100 OR @search IS NULL OR @status IS NULL OR @status NOT IN(N'all',N'active',N'passive') OR @quarantine IS NULL OR @quarantine NOT IN(N'all',N'included',N'excluded') OR (@customer_id IS NOT NULL AND @customer_id<1) THROW 51076,'CUSTOMER_CARD_QUERY_INVALID',1;
 ${CUSTOMER_CARD_READY_SQL}
 DECLARE @pattern nvarchar(500)=N'%'+REPLACE(REPLACE(REPLACE(REPLACE(@search,N'~',N'~~'),N'%',N'~%'),N'_',N'~_'),N'[',N'~[')+N'%';
 -- Decode the sealed 806 public party/account projections once. These are local
 -- tempdb query caches, never persistent tables or native/business mutations.
 SELECT r.source_key,JSON_VALUE(r.payload_json,'$.source_id') sourceId,JSON_VALUE(r.payload_json,'$.company') company,JSON_VALUE(r.payload_json,'$.role') role,JSON_VALUE(r.payload_json,'$.code') code,JSON_VALUE(r.payload_json,'$.name') name,JSON_VALUE(r.payload_json,'$.currency_code') currency,JSON_VALUE(r.payload_json,'$.balance_status') balanceStatus,JSON_VALUE(JSON_VALUE(r.payload_json,'$.source_payload_json'),'$.scope') scope
 INTO #C06Parties FROM erp_migration.records r WHERE r.run_id=N'${CUSTOMER_CARD_RUN}' AND r.entity=N'parties' AND JSON_VALUE(r.payload_json,'$.role')=N'customer';
 SELECT a.source_key,JSON_VALUE(a.payload_json,'$.party_source_key') party_source_key,JSON_VALUE(a.payload_json,'$.role') role,JSON_VALUE(a.payload_json,'$.currency_code') currency,JSON_VALUE(a.payload_json,'$.balance_status') balanceStatus,CONVERT(varchar(50),TRY_CONVERT(decimal(28,8),JSON_VALUE(a.payload_json,'$.balance'))) sourceOpeningBalanceExact
 INTO #C06Accounts FROM erp_migration.records a WHERE a.run_id=N'${CUSTOMER_CARD_RUN}' AND a.entity=N'accounts' AND JSON_VALUE(a.payload_json,'$.role')=N'customer';
 SELECT c.id INTO #C06Eligible FROM dbo.customers c WHERE c.is_deleted=0 AND (@customer_id IS NULL OR c.id=@customer_id)
 AND (@status=N'all' OR (@status=N'active' AND c.is_active=1) OR (@status=N'passive' AND c.is_active=0))
 AND (@search=N'' OR c.customer_code LIKE @pattern ESCAPE N'~' OR c.name LIKE @pattern ESCAPE N'~' OR c.phone LIKE @pattern ESCAPE N'~')
 AND (@quarantine=N'all' OR (@quarantine=N'included' AND EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE ${holds})) OR (@quarantine=N'excluded' AND NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE ${holds})));
 SELECT id INTO #C06Page FROM #C06Eligible ORDER BY id OFFSET ((@page-1)*@page_size) ROWS FETCH NEXT @page_size ROWS ONLY;
 SELECT l.id,l.party_entity_id,l.customer_id,l.supplier_id,l.source_company,l.source_id,l.source_currency,l.source_record_key,l.migration_run_id INTO #C06Links FROM dbo.party_source_links l JOIN #C06Page pg ON pg.id=l.customer_id WHERE l.supplier_id IS NULL;
 SELECT m.customer_id,COALESCE(m.account_currency,m.currency_code) currency,
 SUM(CASE WHEN m.source_record_key IS NULL AND m.cutover_source_key IS NULL AND ISNULL(m.affects_balance,1)=1 AND m.balance_effect_exact IS NULL AND m.balance_effect IS NULL THEN 1 ELSE 0 END) localMissing,
 SUM(CASE WHEN ISNULL(m.affects_balance,1)=1 AND m.balance_effect_exact IS NULL AND m.balance_effect IS NULL THEN 1 ELSE 0 END) ledgerMissing,
 SUM(CASE WHEN m.source_record_key IS NULL AND m.cutover_source_key IS NULL AND ISNULL(m.affects_balance,1)=1 THEN COALESCE(m.balance_effect_exact,CONVERT(decimal(28,8),m.balance_effect)) ELSE CONVERT(decimal(28,8),0) END) localDelta,
 SUM(CASE WHEN ISNULL(m.affects_balance,1)=1 THEN COALESCE(m.balance_effect_exact,CONVERT(decimal(28,8),m.balance_effect)) ELSE CONVERT(decimal(28,8),0) END) ledgerBalance
 INTO #C06Ledger FROM dbo.customer_movements m JOIN #C06Page pg ON pg.id=m.customer_id GROUP BY m.customer_id,COALESCE(m.account_currency,m.currency_code);
 SELECT (SELECT COUNT(*) FROM #C06Eligible) total,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@@PROCID)),2) readerDefinitionHash,
 (SELECT JSON_QUERY((SELECT CONVERT(varchar(20),c.id) id,c.customer_code customerCode,c.name customerName,c.phone,c.email,c.address,c.city,c.country,c.currency_code currency,CONVERT(varchar(50),c.balance) scalarBalanceExact,CONVERT(varchar(50),c.risk_limit) riskLimitExact,c.is_active isActive,c.is_deleted isDeleted,CONVERT(varchar(20),c.party_entity_id) partyEntityId,c.source_record_key sourceRecordKey,c.migration_run_id migrationRunId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)) customer,
 JSON_QUERY(COALESCE((SELECT CONVERT(varchar(20),l.id) id,CONVERT(varchar(20),l.party_entity_id) partyEntityId,CONVERT(varchar(20),l.customer_id) customerId,l.source_company sourceCompany,CONVERT(varchar(20),l.source_id) sourceId,l.source_currency sourceCurrency,l.source_record_key sourceRecordKey,l.migration_run_id migrationRunId FROM #C06Links l WHERE l.customer_id=c.id AND l.supplier_id IS NULL FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) sourceLinks,
 JSON_QUERY(COALESCE((SELECT r.source_key sourceKey,r.sourceId sourceId,r.company company,r.role role,r.code code,r.name name,r.currency currency,r.balanceStatus balanceStatus,r.scope scope,
 (SELECT COUNT(*) FROM dbo.party_source_links gl WHERE gl.source_id=l.source_id AND gl.source_company=l.source_company AND gl.customer_id IS NOT NULL AND gl.supplier_id IS NULL) globalSourceLinkCount
 FROM #C06Links l JOIN #C06Parties r ON r.sourceId=l.source_id AND r.company=l.source_company WHERE l.customer_id=c.id AND l.supplier_id IS NULL FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) sourceParties,
 JSON_QUERY(COALESCE((SELECT a.source_key sourceKey,a.party_source_key partySourceKey,a.role role,a.currency currency,a.balanceStatus balanceStatus,a.sourceOpeningBalanceExact sourceOpeningBalanceExact
 FROM #C06Accounts a WHERE EXISTS(SELECT 1 FROM #C06Links l JOIN #C06Parties r ON r.sourceId=l.source_id AND r.company=l.source_company WHERE l.customer_id=c.id AND l.supplier_id IS NULL AND a.party_source_key=r.source_key) FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) sourceAccounts,
 JSON_QUERY(COALESCE((SELECT CONVERT(varchar(20),a.id) id,CONVERT(varchar(20),c.id) customerId,CONVERT(varchar(20),a.customer_id) nativeOwnerCustomerId,CONVERT(varchar(20),a.party_entity_id) partyEntityId,a.currency_code currency,CONVERT(varchar(50),a.current_balance) nativeBalanceExact,a.balance_status balanceStatus,a.source_record_key sourceRecordKey,a.migration_run_id migrationRunId,
 CONVERT(varchar(50),CASE WHEN COALESCE(e.localMissing,0)>0 THEN NULL ELSE COALESCE(e.localDelta,CONVERT(decimal(28,8),0)) END) localDeltaExact,
 CONVERT(varchar(50),CASE WHEN COALESCE(e.ledgerMissing,0)>0 THEN NULL ELSE COALESCE(e.ledgerBalance,CONVERT(decimal(28,8),0)) END) ledgerBalanceExact
 FROM dbo.party_currency_accounts a LEFT JOIN #C06Ledger e ON e.customer_id=c.id AND e.currency=a.currency_code WHERE (a.customer_id=c.id OR (a.customer_id IS NULL AND a.party_entity_id=c.party_entity_id)) AND a.supplier_id IS NULL FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) nativeAccounts,
 JSON_QUERY(COALESCE((SELECT h.entity,CONVERT(varchar(20),h.native_id) nativeId,h.source_key sourceKey,h.status,JSON_QUERY(h.reasons_json) reasons FROM erp_migration.operation_quarantine_holds h WHERE ${holds} FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) quarantineHolds
 FROM #C06Page pg JOIN dbo.customers c ON c.id=pg.id ORDER BY c.id FOR JSON PATH,INCLUDE_NULL_VALUES) rowsJson;
 END;`;
export const CUSTOMER_CARD_PROC_HASH=createHash('sha256').update(CUSTOMER_CARD_PROC_SQL,'utf16le').digest('hex').toUpperCase();

const units=s=>typeof s==='string'&&/^-?\d+\.\d{1,8}$/.test(s)?BigInt(s.replace('.','').replace(/^-/,'')+'0'.repeat(8-s.split('.')[1].length))*(s.startsWith('-')?-1n:1n):null;
const exact=n=>{const s=(n<0n?-n:n).toString().padStart(9,'0');return (n<0n?'-':'')+s.slice(0,-8)+'.'+s.slice(-8);};
export function assembleCustomerCardRaw(raw){
 const {customer:c,sourceLinks:links,sourceParties:parties,sourceAccounts:sources,nativeAccounts:natives,quarantineHolds:holds}=raw;
 if(!c||![links,parties,sources,natives,holds].every(Array.isArray))throw customerCardError();
 const single=links.length===1&&parties.length===1,link=links[0],party=parties[0];
 const accepted=single&&party.globalSourceLinkCount===1&&party.role==='customer'&&party.balanceStatus==='SOURCE'&&party.sourceId===link.sourceId&&party.company===link.sourceCompany&&link.partyEntityId===c.partyEntityId&&party.code===c.customerCode&&party.name===c.customerName&&party.currency===c.currency&&typeof party.scope==='string'&&party.scope.startsWith('IN_SCOPE');
 raw.linkage={status:accepted?'accepted-opening':links.length>1||parties.length>1||party?.globalSourceLinkCount>1?'ambiguous':links.length===0?'unmapped':'unknown',verified:accepted,sourceLinkCount:links.length,sourcePartyCount:parties.length,reasons:accepted?[]:['SOURCE_IDENTITY_UNVERIFIED']};
 raw.provenance={runId:CUSTOMER_CARD_RUN,sourceHash,planHash,sourceAsOf:'2026-09-30',verified:true,quarantineVerified:true,readOnly:true,sourceFreshLive:false,cutoverAccepted:false};
 for(const source of sources){
  const matches=accepted?sources.filter(s=>s.partySourceKey===party.sourceKey&&s.currency===source.currency):[];
  const accounts=accepted?natives.filter(n=>n.currency===source.currency&&n.partyEntityId===c.partyEntityId&&n.nativeOwnerCustomerId===c.id):[];
  const matched=matches.length===1&&accounts.length===1&&source.partySourceKey===party.sourceKey&&source.role==='customer'&&['TRY','USD','EUR'].includes(source.currency);
  source.matchStatus=matched?'matched':matches.length>1||accounts.length>1?'ambiguous':'unmatched';source.matchedNativeAccountId=matched?accounts[0].id:null;source.confidence=matched&&source.balanceStatus==='SOURCE'?'source-matched':'unknown';
 }
 for(const n of natives){
  const matches=sources.filter(s=>s.matchedNativeAccountId===n.id),source=matches.length===1?matches[0]:null;
  n.matchStatus=source?'matched':'unmatched';n.sourceAccountKey=source?.sourceKey??null;n.sourceOpeningBalanceExact=source?.sourceOpeningBalanceExact??null;n.expectedNativeBalanceExact=null;
  n.reconciliationStatus='native-unverified';n.confidence='native-unverified';
  if(source?.balanceStatus==='SOURCE'){
   const opening=units(source.sourceOpeningBalanceExact),delta=units(n.localDeltaExact),finalDelta=n.finalSourceDeltaVerified===true?units(n.finalSourceDeltaExact):n.finalSourceDeltaExact===undefined?0n:null,current=units(n.nativeBalanceExact),ledger=units(n.ledgerBalanceExact);
   if([opening,delta,finalDelta,current,ledger].every(v=>v!==null)){const expected=opening+delta+finalDelta;n.expectedNativeBalanceExact=exact(expected);n.reconciliationStatus=current===expected&&current===ledger?'reconciled':'drift';n.confidence=n.reconciliationStatus==='reconciled'?'source-matched':'drift';}
  }else if(source){n.reconciliationStatus='unknown';n.confidence='unknown';}
  if(holds.length){n.reconciliationStatus='quarantined';n.confidence='quarantined';}
 }
 return raw;
}

async function defaultRuntime(){const db=await import('../config/database.js');if(!db.isCanonicalTest())throw customerCardError('CUSTOMER_CARD_UNAVAILABLE');return {pool:await db.getSqlPool(),sql:db.getSqlDriver()};}
export function createCustomerCardReadStore({getRuntime=defaultRuntime,getFinalContext=catalogSourceVersion,getCurrentFinanceContext=configuredCurrentFinanceContext}={}){
 const read=async(id,options={})=>{
  const {search='',page=1,limit=25,status='all',quarantine='all'}=options;
  if(typeof search!=='string'||search.length>120||!Number.isInteger(page)||page<1||page>1000000||!Number.isInteger(limit)||limit<1||limit>100||!['all','active','passive'].includes(status)||!['all','included','excluded'].includes(quarantine))throw customerCardError('CUSTOMER_CARD_QUERY_INVALID','Geçerli arama ve sayfalama bilgisi gerekli.',400);
  let tx;try{const {pool,sql}=await getRuntime();tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
   const req=new sql.Request(tx);req.input('customer_id',sql.BigInt,id??null).input('search',sql.NVarChar(120),search).input('page',sql.Int,page).input('page_size',sql.Int,limit).input('status',sql.NVarChar(12),status).input('quarantine',sql.NVarChar(12),quarantine);
   const result=await req.execute(CUSTOMER_CARD_PROC),row=result.recordset?.[0];
   if(!row||row.readerDefinitionHash!==CUSTOMER_CARD_PROC_HASH||!Number.isSafeInteger(row.total)||row.total<0)throw customerCardError();
   const parsed=JSON.parse(row.rowsJson??'[]');if(!Array.isArray(parsed))throw customerCardError();const context=getFinalContext();if(finalPartyContext(context)){const ids=parsed.flatMap(r=>r.nativeAccounts.map(a=>parseCustomerCardId(a.id)));const proof=await readFinalPartyProof({sql,tx,ids,context});attachFinalPartyProof(parsed,proof);}
   const currentContext=getCurrentFinanceContext();if(currentFinanceContext(currentContext)){const ids=parsed.flatMap(r=>r.nativeAccounts.map(a=>parseCustomerCardId(a.id)));attachCurrentFinanceProof(parsed,await readCurrentFinanceProof({sql,tx,ids,context:currentContext}));}
   const rows=parsed.map(assembleCustomerCardRaw);await tx.commit();return {rows,total:row.total};
  }catch(error){if(tx)try{await tx.rollback();}catch{}if(error?.statusCode===400)throw error;throw customerCardError('CUSTOMER_CARD_UNAVAILABLE','Müşteri kartı okuma kanıtı şu anda kullanılamıyor.',503);}
 };
 return {listCustomerCardRows:options=>read(null,options),readCustomerCardRows:async id=>(await read(parseCustomerCardId(id),{limit:1})).rows[0]??null};
}
const store=createCustomerCardReadStore();
export const listCustomerCardRows=store.listCustomerCardRows;
export const readCustomerCardRows=store.readCustomerCardRows;
