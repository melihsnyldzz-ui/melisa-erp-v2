import test from 'node:test';import assert from 'node:assert/strict';
import {hash,TARGET} from './mapping-opening.mjs';
import {prepareMissingPartyCard} from './party-card-completion-plan.mjs';
function fixture({company='F0102',role='customer',nullable=true,status=1}={}){
 const card={sourceId:'5536',sourceUid:'10000000-0000-4000-8000-000000005536',code:'0007',name:'SYNTHETIC CARD',cardType:1,status,deleted:null,currencyRaw:'$'};
 const proof={identity:{server:'DESKTOP-KSRK0EQ',database:'VEGA2026',sysadmin:0},target:{...TARGET},sourceSELECTOnly:true,sourceWrites:0,targetWrites:0,actualT1:false,query:`SELECT identity FROM dbo.${company}TBLCARI WHERE IND=5536`,passes:[[card],[{...card}]],native:[],links:[],holds:[],columns:[{tableName:role==='customer'?'customers':'suppliers',name:'balance',is_nullable:nullable,defaultDefinition:nullable?null:'((0))'},{tableName:'party_currency_accounts',name:'current_balance',is_nullable:true}],evidenceKind:'SYNTHETIC_OFFLINE_FIXTURE'};
 return {company,role,targetConfirmed:true,proof:{...proof,proofHash:hash(proof)}};
}
function change(input,fn){const {proofHash,...body}=input.proof;fn(body);input.proof={...body,proofHash:hash(body)};return input;}
test('UNKNOWN uses existing mapper, preserves leading code/UID and never proposes opening or zero',()=>{
 const p=prepareMissingPartyCard(fixture());assert.equal(p.status,'OFFLINE_CONTRACT_READY');assert.equal(p.executionAllowed,false);assert.equal(p.nativeBalanceIntent.partyScalar,null);assert.equal(p.nativeBalanceIntent.currencyAccount,null);assert.equal(p.mapped.tables.parties[0].balance_status,'UNKNOWN');assert.equal(p.mapped.tables.accounts[0].balance_status,'UNKNOWN');assert.equal(p.mapped.tables.party_openings.length,0);assert.equal(p.source.code,'0007');assert.equal(p.source.sourceUid,'10000000-0000-4000-8000-000000005536');
});
test('real NOT NULL/default-zero schema and unresolved5244 target block materialization',()=>{
 const i=fixture({nullable:false});i.targetConfirmed=false;const p=prepareMissingPartyCard(i);assert.equal(p.status,'PREPARED_BLOCKED');assert.deepEqual(p.blockers,['WORKFACE_5244_AND_BUSINESS_DB_NOT_YET_UNIFIED','UNKNOWN_BALANCE_NOT_NULL:customers.balance']);assert.equal(p.executionAllowed,false);
});
test('source braced GUID is preserved verbatim; wrong query identity and text overflow reject',()=>{
 const p=prepareMissingPartyCard(change(fixture(),p=>p.passes.forEach(a=>a[0].sourceUid='{10000000-0000-4000-8000-000000005536}')));assert.equal(p.source.sourceUid,'{10000000-0000-4000-8000-000000005536}');
 assert.throws(()=>prepareMissingPartyCard(change(fixture(),p=>p.query=p.query.replace('5536','999'))),/PARTY_CARD_SOURCE_ID_SCOPE/);
 assert.throws(()=>prepareMissingPartyCard(change(fixture(),p=>p.passes.forEach(a=>a[0].code='1'.repeat(81)))),/PARTY_CARD_NATIVE_TEXT_LIMIT/);
});
test('passive cards are retained, unknown/deleted status is not invented',()=>{
 assert.equal(prepareMissingPartyCard(fixture({status:2})).mapped.tables.parties[0].is_active,false);
 for(const patch of [p=>{p.passes.forEach(a=>a[0].status=null);},p=>{p.passes.forEach(a=>a[0].deleted=true);}])assert.throws(()=>prepareMissingPartyCard(change(fixture(),patch)),/PARTY_CARD_STATUS_REVIEW/);
});
test('equal names and numeric IDs in different companies keep separate source/native identities',()=>{
 const customer=prepareMissingPartyCard(fixture()),supplier=prepareMissingPartyCard(fixture({company:'F0103',role:'supplier'}));assert.notEqual(customer.source.sourceKey,supplier.source.sourceKey);assert.notEqual(customer.source.nativeSourceKey,supplier.source.nativeSourceKey);assert.equal(supplier.mapped.tables.parties[0].role,'supplier');
 const bad=fixture();bad.role='supplier';assert.throws(()=>prepareMissingPartyCard(bad),/PARTY_CARD_COMPANY_ROLE/);
});
test('existing source binding, code owner, arbitrary local target or hold cannot be adopted',()=>{
 for(const [field,row]of [['native',{id:99}],['links',{customer_id:99}],['holds',{source_id:5536}]])assert.throws(()=>prepareMissingPartyCard(change(fixture(),p=>p[field]=[row])),field==='holds'?/PARTY_CARD_HOLD_REMAINS/:/PARTY_CARD_EXISTING_BINDING_OR_CODE_CONFLICT/);
 const bound=fixture();bound.claimedNativeId='99';assert.throws(()=>prepareMissingPartyCard(bound),/PARTY_CARD_EXISTING_BINDING_OR_CODE_CONFLICT/);
});
test('UID drift, missing UID, tampered capture and foreign target reject',()=>{
 const drift=fixture();change(drift,p=>p.passes[1][0].sourceUid='20000000-0000-4000-8000-000000005536');assert.throws(()=>prepareMissingPartyCard(drift),/PARTY_CARD_TWO_PASS_DRIFT/);
 assert.throws(()=>prepareMissingPartyCard(change(fixture(),p=>p.passes.forEach(a=>a[0].sourceUid=null))),/PARTY_CARD_SOURCE_IDENTITY/);
 const tampered=fixture();tampered.proof.passes[0][0].code='DIFFERENT';assert.throws(()=>prepareMissingPartyCard(tampered),/PARTY_CARD_PROOF_HASH/);
 assert.throws(()=>prepareMissingPartyCard(change(fixture(),p=>p.target.database='MELISA_ERP_CLEAN_TEST_20261022')),/PARTY_CARD_TEST_TARGET/);
});
test('unknown currency and exact LL exclusions never become TRY or a free account',()=>{
 assert.throws(()=>prepareMissingPartyCard(change(fixture(),p=>p.passes.forEach(a=>a[0].currencyRaw='LL'))),/PARTY_CARD_CURRENCY_UNKNOWN/);
 for(const id of ['324','379'])assert.throws(()=>prepareMissingPartyCard(change(fixture(),p=>p.passes.forEach(a=>a[0].sourceId=id))),/PARTY_CARD_LL_EXCLUDED/);
});
