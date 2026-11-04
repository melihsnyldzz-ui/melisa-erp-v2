import test from 'node:test';
import assert from 'node:assert/strict';
import {HISTORY_SOURCE,HISTORY_EFFECTS,buildHistoryCounts,hashHistorySnapshot,hashHistoryRecord,mapLegacyHistoryRecord,planHistoryImport,validateHistoryRecord,validateHistorySnapshot} from './vegaHistoryCore.mjs';

const approvedSource={database:'VEGA2026',companies:['F0102','F0103'],period:'D0001',dateFrom:'2020-01-01',dateToExclusive:'2021-01-01'};
const table=(company='F0102',part='BASLIK',family='SATFAT')=>`${company}D0001TBL${family}${part}`;
function fixture({company='F0102',part='BASLIK',family='SATFAT',id='0007'}={}){
 const name=table(company,part,family),row={IND:id,TARIH:'2020-02-29T23:59:59.1234567',DOVIZ:'USD',CARI:'0008',NET:'12.34567890',ISKONTO:'0.10000000',IPTAL:false};
 return {input:{legacySourceKey:`VEGA2026/${name}/${id}`,table:name,row,...(part==='HAREKET'?{relation:{status:'LINKED',headerKey:`VEGA2026/${table(company,'BASLIK',family)}/0007`}}:{})},options:{approvedSource,binding:{table:name,evidenceHash:'a'.repeat(64),fields:{sourceId:'IND',date:'TARIH',currency:'DOVIZ',partySourceId:'CARI'}}}};
}
const convert=f=>mapLegacyHistoryRecord(f.input,f.options).record;
function snapshot(records,source=approvedSource){const s={schemaVersion:1,source,records,startedAt:'2026-10-24T00:00:00Z',completedAt:'2026-10-24T00:00:01Z',capture:{ready:true},counts:buildHistoryCounts(records,{approvedSource:source})};s.sourceHash=hashHistorySnapshot(s);return s;}

test('legacy documents retain exact ID, money, full raw timestamp and independent database/period/date metadata',()=>{
 const f=fixture(),r=convert(f);
 assert.equal(r.sourceId,'0007');assert.equal(r.partySourceId,'0008');assert.equal(r.date,'2020-02-29');assert.equal(r.payload.TARIH,f.input.row.TARIH);assert.equal(r.payload.NET,'12.34567890');assert.equal(r.payload.ISKONTO,'0.10000000');assert.equal(r.currency,'USD');
 assert.equal(r.sourceKey,`VEGA2026/F0102/D0001/${f.input.table}/0007`);
 assert.equal(mapLegacyHistoryRecord(f.input,f.options).legacySourceKey,f.input.legacySourceKey);
 assert.deepEqual(r.payload,f.input.row);assert.doesNotThrow(()=>validateHistoryRecord(r,{approvedSource}));assert.throws(()=>validateHistoryRecord(r),{code:'HISTORY_SCOPE_MISMATCH'});
});

test('same numeric ID across companies and periods never merges or links across source scope',()=>{
 const a=convert(fixture()),b=convert(fixture({company:'F0103',family:'ALFAT'}));
 assert.notEqual(a.sourceKey,b.sourceKey);
 const s=snapshot([a,b,convert(fixture({part:'HAREKET',id:'0009'}))]);assert.equal(validateHistorySnapshot(s,{approvedSource}).records.length,3);
 for(const headerKey of ['VEGA2026/F0103D0001TBLSATFATBASLIK/0007','VEGA2026/F0102D0002TBLSATFATBASLIK/0007','VEGA2026/F0102D0001TBLALFATBASLIK/0007']){
  const f=fixture({part:'HAREKET'});f.input.relation.headerKey=headerKey;assert.throws(()=>convert(f),{code:'HISTORY_LEGACY_HEADER_UNRESOLVED'});
 }
 const wrongTable={...a,table:a.table.replace('D0001','D0002')};assert.throws(()=>validateHistoryRecord(wrongTable,{approvedSource}),{code:'HISTORY_SCOPE_MISMATCH'});
});

test('explicit source is required; snapshot body cannot widen current API default to earlier years',()=>{
 const s=snapshot([convert(fixture())]);assert.throws(()=>validateHistorySnapshot(s),{code:'HISTORY_SCOPE_MISMATCH'});
 const f=fixture();delete f.options.approvedSource;assert.throws(()=>convert(f),{code:'HISTORY_SCOPE_MISMATCH'});
 const current=fixture();current.options.approvedSource=HISTORY_SOURCE;current.input.table='F0102D0007TBLSATFATBASLIK';current.options.binding.table=current.input.table;current.input.legacySourceKey=`VEGA2026/${current.input.table}/0007`;current.input.row.TARIH='2026-01-02';
 const r=convert(current);assert.doesNotThrow(()=>validateHistorySnapshot(snapshot([r],HISTORY_SOURCE)));
});

test('archive replay has no new rows, changed bodies conflict and operational effects remain disabled',()=>{
 const r=convert(fixture()),s=snapshot([r]);const first=planHistoryImport(s,[],{approvedSource});assert.equal(first.mode,'PREVIEW');assert.equal(first.inserts.length,1);assert.equal(first.archiveOnly,true);assert.deepEqual(first.operationalEffects,HISTORY_EFFECTS);
 const existing=[{sourceKey:r.sourceKey,recordHash:hashHistoryRecord(r)}];assert.equal(planHistoryImport(s,existing,{approvedSource}).inserts.length,0);assert.equal(planHistoryImport(s,existing,{approvedSource}).unchanged.length,1);
 const changed=fixture();changed.input.row.NET='12.34567891';const conflict=planHistoryImport(snapshot([convert(changed)]),existing,{approvedSource});assert.equal(conflict.canApply,false);assert.equal(conflict.conflicts.length,1);
});

test('unknown source currency and party stay null; no FIRMANO or TRY fallback is invented',()=>{
 const f=fixture();f.options.binding.fields.currency=null;f.options.binding.fields.partySourceId=null;f.input.row.FIRMANO='999';f.input.row.DOVIZ=null;
 const r=convert(f);assert.equal(r.currency,null);assert.equal(r.partySourceId,null);assert.equal(r.payload.FIRMANO,'999');
 const missing=fixture();delete missing.input.row.CARI;assert.throws(()=>convert(missing),{code:'HISTORY_LEGACY_COLUMN_MISSING'});
});

test('ambiguous, orphan, dual and cancelled source relations are not guessed or replayed commercially',()=>{
 for(const status of ['REVIEW','RELATED_ONLY','UNKNOWN']){const f=fixture({part:'HAREKET'});f.input.relation.status=status;assert.throws(()=>convert(f),{code:'HISTORY_LEGACY_HEADER_UNRESOLVED'});}
 const f=fixture({part:'HAREKET'});f.input.relation.status='EXCLUDE_CANCELLED';f.input.row.IPTAL=true;const line=convert(f);assert.equal(line.payload.IPTAL,true);assert.throws(()=>validateHistorySnapshot(snapshot([line]),{approvedSource}),{code:'HISTORY_ORPHAN_LINE'});
});

test('F0104, missing binding, unproven source dates and inexact numeric payloads fail closed',()=>{
 for(const alter of [f=>{f.input.table=table('F0104');},f=>{f.options.binding=null;},f=>{f.options.binding.evidenceHash='not-hash';},f=>{f.input.row.IND=9007199254740992;},f=>{f.input.row.TARIH='2020-02-30';},f=>{f.input.row.TARIH='2020-01-01T99:00:00';},f=>{f.input.row.NET=12.3;}]){
  const f=fixture();alter(f);assert.throws(()=>convert(f));
 }
 const movement=fixture();movement.input.table='F0102D0001TBLCARIGENELHAREKET';assert.throws(()=>convert(movement),{code:'HISTORY_LEGACY_FAMILY_UNSUPPORTED'});
});
