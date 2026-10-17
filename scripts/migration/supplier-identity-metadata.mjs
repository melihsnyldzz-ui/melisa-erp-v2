// ERP-DEC-027: identity metadata only. Importing performs no I/O.
import {createHash} from 'node:crypto';
export const TARGET=Object.freeze({server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01'});
export const RUN='ERP-MIGPREP01-CARDS-20261008';
export const SOURCE_PLAN_SHA256='fbd15fcfce49ddd149b57b36d9fabe75f7f491e9afde2b8c5aaf672bb6f2224a';
export const SCHEMA='melisa.supplier-identity-metadata.v1';
export const TABLES=Object.freeze(['party_entities','suppliers','party_currency_accounts','party_source_links']);
export const NATIVE_GUARDS=Object.freeze(['c03_guard_supplier_balance','c09_guard_current_price_supplier_balance','test_guard_suppliers','test_supplier_contact_guard','work_finops_native_supplier_guard']);
export const REQUIRED_GUARDS=Object.freeze([...NATIVE_GUARDS,...TABLES.map(t=>'operation_quarantine_'+t)]);
export const check=(ok,code)=>{if(!ok)throw Error('SUPPLIER_METADATA_'+code);};
export const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const sqlHash=v=>createHash('sha256').update(v,'utf16le').digest('hex').toUpperCase();
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const id=v=>typeof v==='string'&&/^[1-9]\d{0,17}$/.test(v);
const uuid=v=>typeof v==='string'&&/^\{[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}$/i.test(v);
export function identitiesFromPlan(plan){
 check(Array.isArray(plan?.identities)&&plan.identities.length===4,'FOUR_SCOPE');
 const cards=plan.identities.map(x=>{
  const p=x.requiredCardPlan,c=x.sourceCard;
  check(x.company==='F0103'&&x.period==='D0007'&&x.role==='supplier'&&id(x.sourceId),'SOURCE_SCOPE');
  check(x.sourceKey===`VEGA2026/F0103/TBLCARI/${x.sourceId}`&&p?.sourceRecordKey===`VEGA2026/F0103TBLCARI/${x.sourceId}`,'SOURCE_KEY');
  check(c?.IND===Number(x.sourceId)&&uuid(c.UID)&&c.UID===p.sourceUid&&c.FIRMATIPI===1&&c.PARABIRIMI==='TL'&&c.ALIAS===null,'SOURCE_IDENTITY');
  check(p.role==='supplier'&&p.currency==='TRY'&&p.holdPreserved===true&&hex(p.sourcePayloadHash),'CARD_CONTRACT');
  check(typeof p.name==='string'&&p.name.length>0&&p.name===c.FIRMAADI&&p.supplierCode===c.FIRMAKODU,'CARD_FIELDS');
  return {sourceId:x.sourceId,sourceKey:x.sourceKey,nativeKey:p.sourceRecordKey,company:x.company,period:x.period,role:x.role,currency:p.currency,code:p.supplierCode,name:p.name,uid:p.sourceUid,sourcePayloadHash:p.sourcePayloadHash,sourceCard:c,cardHash:hash(c)};
 }).sort((a,b)=>Number(a.sourceId)-Number(b.sourceId));
 check(new Set(cards.map(x=>x.sourceId)).size===4&&new Set(cards.map(x=>x.uid.toUpperCase())).size===4,'DUPLICATE_SOURCE');return cards;
}
export function validateSourceProof(cards,proof,now=Date.now()){
 check(proof?.identity?.server==='DESKTOP-KSRK0EQ'&&proof.identity.database==='VEGA2026'&&proof.identity.sysadmin===0,'SOURCE_SERVER');
 check(proof.permissions&&Object.values(proof.permissions).length>=4&&Object.values(proof.permissions).every(v=>v===0),'SOURCE_SELECT_ONLY');
 check(Array.isArray(proof.first)&&Array.isArray(proof.second)&&proof.first.length===4&&hash(proof.first)===hash(proof.second),'SOURCE_TWO_PASS');
 check(Array.isArray(proof.globalUidCounts)&&proof.globalUidCounts.length===4&&cards.every(c=>proof.globalUidCounts.filter(x=>x.uid===c.uid&&x.count===1).length===1),'SOURCE_UID_CARDINALITY');
 const end=Date.parse(proof.endedAt),start=Date.parse(proof.startedAt);check(Number.isFinite(start)&&Number.isFinite(end)&&start<=end&&end<=now&&now-start<=120000,'SOURCE_FRESH');
 for(const c of cards){const found=proof.first.filter(x=>String(x.IND)===c.sourceId);check(found.length===1&&hash(found[0])===c.cardHash,'SOURCE_DRIFT');}return true;
}
export function metadataRows(card,{entityId=null,supplierId=null,accountId=null,actorId,runId=RUN}={}){
 check(id(actorId)&&runId===RUN,'ACTOR_RUN');const payload=JSON.stringify({company:card.company,period:card.period,sourceId:card.sourceId,sourceUid:card.uid,sourceCard:card.sourceCard,approvedSourcePayloadHash:card.sourcePayloadHash,identityProjectionHash:card.cardHash,financialVerification:'UNKNOWN',metadataOnly:true});
 const provenance={source_record_key:card.nativeKey,migration_run_id:runId,source_payload_hash:hash(payload),source_payload_json:payload,source_document_key:null,original_document_date:null};
 return [
  {table:'party_entities',fields:{role:'supplier',name:card.name,identity_rule:'EXACT_SOURCE_CARD_METADATA_ONLY',country:null,...provenance}},
  {table:'suppliers',fields:{supplier_code:card.code,name:card.name,phone:null,email:null,city:null,country:null,address:null,currency_code:'TRY',balance:'0.0000',is_active:true,is_deleted:false,passive_at:null,passive_reason:null,created_by:actorId,updated_at:null,updated_by:null,purchase_discount_rate:'0.0000',...provenance,party_entity_id:entityId,source_notes:'ERP-DEC-027 identity only; financial verification UNKNOWN',TELEFON1:null,TELEFON2:null,TELEFON3:null,ADRESPOSTA:null,ADRESFATURA:null,ADRESSEVK:null}},
  {table:'party_currency_accounts',fields:{party_entity_id:entityId,currency_code:'TRY',customer_id:null,supplier_id:supplierId,current_balance:null,balance_status:'UNKNOWN',...provenance,source_record_key:card.nativeKey+'/ACCOUNT/TRY'}},
  {table:'party_source_links',fields:{party_entity_id:entityId,party_currency_account_id:accountId,customer_id:null,supplier_id:supplierId,source_company:'F0103',source_id:card.sourceId,source_code:card.code,source_currency:'TRY',source_name:card.name,...provenance}}
 ];
}
export function validateManifest(m){
 const {manifestHash,...body}=m??{};check(hex(manifestHash)&&hash(body)===manifestHash,'MANIFEST_HASH');
 check(m.schemaVersion===SCHEMA&&m.approval==='ERP-DEC-027'&&m.runId===RUN&&m.server===TARGET.server&&m.database===TARGET.database&&m.sourcePlanHash===SOURCE_PLAN_SHA256,'MANIFEST_SCOPE');
 check(id(m.actorId)&&m.cards?.length===4&&m.financialWrites===0&&m.holdChanges===0,'MANIFEST_EFFECT');
 check(m.metadataBlueprintHash===hash(m.cards.map(c=>metadataRows(c,{actorId:m.actorId}))),'METADATA_BODY');
 check(m.protectedBefore&&Object.keys(m.protectedBefore).length>=37&&m.quarantineDefinitions?.length>=39&&m.quarantineDefinitions.every(x=>hex(x.hash)),'BEFORE_PROOF');
 check(m.guardBefore?.length===REQUIRED_GUARDS.length&&new Set(m.guardBefore.map(g=>g.name)).size===REQUIRED_GUARDS.length&&REQUIRED_GUARDS.every(n=>m.guardBefore.some(g=>g.name===n&&g.is_disabled===false&&typeof g.definition==='string'&&sqlHash(g.definition)===g.hash&&TABLES.includes(g.tableName)&&g.firstInsert===(n.startsWith('operation_quarantine_')?1:0)&&g.firstUpdate===(n.startsWith('operation_quarantine_')?1:0)&&g.firstDelete===(n.startsWith('operation_quarantine_')?1:0))),'GUARD_SET');
 check(m.backup?.server===TARGET.server&&m.backup.database===TARGET.database&&m.backup.copyOnly===true&&m.backup.checksum===true&&(m.backup.verifyOnlyPassed===true||m.backup.verifyOnly===true)&&hex(m.backup.sha256)&&typeof m.backup.file==='string'&&m.backup.backupSetUuid,'BACKUP');
 const keys=new Set();for(const c of m.cards){check(id(c.sourceId)&&uuid(c.uid)&&c.company==='F0103'&&c.period==='D0007'&&c.role==='supplier'&&c.currency==='TRY'&&hex(c.cardHash)&&hash(c.sourceCard)===c.cardHash,'MANIFEST_CARD');check(c.nativeKey===`VEGA2026/F0103TBLCARI/${c.sourceId}`&&!keys.has(c.nativeKey),'MANIFEST_CARD_KEY');keys.add(c.nativeKey);}
 return m;
}
export function replayDecision(existing,m){if(!existing)return 'APPLY';check(existing.manifest_hash===m.manifestHash&&existing.source_plan_hash===m.sourcePlanHash&&existing.status==='COMMITTED','REPLAY_BODY_CONFLICT');return 'REPLAY_NOOP';}
export function validateReadback(card,row){
 check(row&&row.sourceId===card.sourceId&&row.nativeKey===card.nativeKey&&['entityId','supplierId','accountId','linkId'].every(k=>id(row[k])),'READBACK_IDENTITY');
 check(row.currency==='TRY'&&row.role==='supplier'&&row.linkCount===1&&row.uid===card.uid&&row.balanceStatus==='UNKNOWN'&&row.currentBalanceIsNull===true&&row.financialMovements===0&&row.held===true,'READBACK_UNKNOWN_HOLD');
 check(Array.isArray(row.images)&&row.images.length===4&&row.images.every(x=>TABLES.includes(x.table)&&id(x.id)&&hex(x.hash)),'READBACK_IMAGES');return row;
}
