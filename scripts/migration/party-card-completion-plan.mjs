// Narrow missing-card preparation using the existing UNKNOWN-aware opening mapper.
// No SQL, filesystem, API, credentials, runtime admission or execution on import/call.
import {TARGET,hash,mapOpening,requireRule as check} from './mapping-opening.mjs';
const id=v=>typeof v==='string'&&/^[1-9]\d{0,17}$/.test(v);
const guid=v=>typeof v==='string'&&(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v)||v.startsWith('{')&&v.endsWith('}')&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v.slice(1,-1)));
const currencies={TL:'TRY',TRY:'TRY','$':'USD',USD:'USD','€':'EUR',EUR:'EUR','₺':'TRY'};

export function prepareMissingPartyCard({proof,company,role,targetConfirmed=false,claimedNativeId=null}){
 const {proofHash,...body}=proof??{};
 check(typeof proofHash==='string'&&hash(body)===proofHash,'PARTY_CARD_PROOF_HASH');
 check(proof.sourceSELECTOnly===true&&proof.sourceWrites===0&&proof.targetWrites===0&&proof.actualT1===false&&proof.identity?.server==='DESKTOP-KSRK0EQ'&&proof.identity.database==='VEGA2026'&&proof.identity.sysadmin===0,'PARTY_CARD_SOURCE_BOUNDARY');
 check(proof.target?.server===TARGET.server&&proof.target.database===TARGET.database,'PARTY_CARD_TEST_TARGET');
 check(role==='customer'&&company==='F0102'||role==='supplier'&&company==='F0103','PARTY_CARD_COMPANY_ROLE');
 check(new RegExp('FROM dbo\\.'+company+'TBLCARI\\b').test(proof.query??''),'PARTY_CARD_SOURCE_TABLE');
 check(Array.isArray(proof.passes)&&proof.passes.length===2&&proof.passes.every(p=>Array.isArray(p)&&p.length===1)&&hash(proof.passes[0])===hash(proof.passes[1]),'PARTY_CARD_TWO_PASS_DRIFT');
 const raw=proof.passes[0][0],sourceId=String(raw.sourceId);
 check(id(sourceId)&&guid(raw.sourceUid)&&typeof raw.code==='string'&&raw.code.length>0&&typeof raw.name==='string'&&raw.name.trim().length>0,'PARTY_CARD_SOURCE_IDENTITY');
 check(!(company==='F0102'&&['324','379'].includes(sourceId)),'PARTY_CARD_LL_EXCLUDED');
 check(new RegExp('\\bWHERE IND\\s*=\\s*'+sourceId+'(?:\\s|$)').test(proof.query),'PARTY_CARD_SOURCE_ID_SCOPE');
 check(raw.code.length<=80&&raw.name.length<=250,'PARTY_CARD_NATIVE_TEXT_LIMIT');
 check([1,2].includes(raw.status)&&raw.deleted!==true,'PARTY_CARD_STATUS_REVIEW');
 check(Array.isArray(proof.native)&&Array.isArray(proof.links)&&Array.isArray(proof.holds),'PARTY_CARD_ABSENCE_PROOF_REQUIRED');
 check(proof.native.length===0&&proof.links.length===0&&claimedNativeId===null,'PARTY_CARD_EXISTING_BINDING_OR_CODE_CONFLICT');
 check(proof.holds.length===0,'PARTY_CARD_HOLD_REMAINS');
 const currency=currencies[raw.currencyRaw]??null;
 check(currency!==null,'PARTY_CARD_CURRENCY_UNKNOWN');
 const sourceKey=`VEGA2026/${company}/TBLCARI/${sourceId}`,nativeSourceKey=`VEGA2026/${company}TBLCARI/${sourceId}`;
 const source={sourceKey,sourceId,sourceUid:raw.sourceUid,company,role,code:raw.code,name:raw.name,isActive:raw.status===1,currency,nativeBalanceMapped:null,sourceSignedBalance:null,sourceCardType:raw.cardType,sourceStatus:raw.status,sourceDeleted:raw.deleted,accounts:[{currencyRaw:raw.currencyRaw,currency,nativeBalanceMapped:null}],balanceEvidence:'UNKNOWN_PENDING_INDEPENDENT_CLOSING'};
 const mapped=mapOpening({products:[],parties:[source]});
 check(mapped.tables.parties.length===1&&mapped.tables.accounts.length===1&&mapped.tables.party_openings.length===0&&mapped.tables.parties[0].balance===null&&mapped.tables.accounts[0].balance===null,'PARTY_CARD_NO_FINANCIAL_EFFECT');
 const table=role==='customer'?'customers':'suppliers',blockers=[];
 if(targetConfirmed!==true)blockers.push('WORKFACE_5244_AND_BUSINESS_DB_NOT_YET_UNIFIED');
 for(const [t,column]of [[table,'balance'],['party_currency_accounts','current_balance']]){
  const definition=proof.columns?.find(c=>c.tableName===t&&c.name===column);
  if(!definition)blockers.push('UNKNOWN_BALANCE_SCHEMA_MISSING:'+t+'.'+column);
  else if(definition.is_nullable!==true)blockers.push('UNKNOWN_BALANCE_NOT_NULL:'+t+'.'+column);
 }
 const result={schemaVersion:'melisa-missing-party-card-preparation.v1',status:blockers.length?'PREPARED_BLOCKED':'OFFLINE_CONTRACT_READY',executionAllowed:false,runtimeInstalled:false,target:{...TARGET,selection:'ASSUMED_TEST125_NOT_USER_WORKFACE_5244',confirmed:targetConfirmed===true},source:{company,table:company+'TBLCARI',role,sourceId,sourceUid:raw.sourceUid,sourceKey,nativeSourceKey,code:raw.code},sourceProofHash:proofHash,mapper:'mapping-opening.mapOpening',mapped,requiredNativeTables:[table,'party_entities','party_currency_accounts','party_source_links'],nativeBalanceIntent:{partyScalar:null,currencyAccount:null,status:'UNKNOWN',currency,explicitNullRequired:true,financialMovements:0},absence:{nativeRows:0,sourceLinks:0,holds:0,evidenceOnly:true,liveRevalidationRequired:true},blockers,requiredBeforeExecution:['Supported new-card insert contract on existing guarded migration path; old frozen opening and approved283 packet must not be replayed or edited','One coherent workface/database and existing actor/permission mapping','Fresh exact source UID/code and target absence/CAS under exclusive owner, current backup and reviewed rollback','UNKNOWN must remain unknown in native storage and every exposed reader; no default-zero insert'],rollback:{beforeCommit:'Existing owner transaction rollback',afterCommit:'Only actual new IDs/row hashes after checking later references; preserve subsequent documents/movements; no database restore/reset'},actualT1:false};
 return {...result,planHash:hash(result)};
}
