import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {validateSystemSummary,historicalRecoveryEvidence,systemDate} from './workSystemSettingsModel.mjs';

const valid='2026-10-08T20:32:43.5743848Z';
const fields=[['services',0,'checkedAt'],['terminal','lastAccessAt'],['backup','lastSuccessAt'],['restore','lastSuccessAt'],['autostart','erp','lastCheckAt'],['autostart','crm','lastCheckAt']];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function summary(){return {environment:'TEST',package:{sourceCommit:'1da40872',packageId:'OFFLINE-DATE-INTEGRITY'},currentUser:{id:15,displayName:'Örnek personel',roleCodes:['sales'],permissionsSummary:['Ürün görüntüleme']},services:[{id:'api',label:'API',status:'ready',checkedAt:valid}],terminal:{webReady:true,physicalAcceptance:'pending',lastAccessAt:valid},backup:{status:'success',lastSuccessAt:valid,sizeBytes:null,checksumVerified:true},restore:{status:'success',lastSuccessAt:valid,sourceDatabaseMatched:true,criticalDataMatched:true},autostart:{erp:{status:'configured',lastCheckAt:valid},crm:{status:'unknown',lastCheckAt:valid}}};}
function assign(data,path,value){const parent=path.slice(0,-1).reduce((node,key)=>node[key],data);parent[path.at(-1)]=value;}
function historical(comparedAt){const data=summary();data.backup.lastSuccessAt=comparedAt;data.restore.lastSuccessAt=comparedAt;data.recoveryEvidence={basis:'historical_copy_comparison',comparedAt,coverage:'recorded_copy_scope',currentBackupVerified:false};return data;}
async function controller(){
 const source=(await readFile(new URL('./workSystemSettings.js',import.meta.url),'utf8')).replace("import './workReports.css';",'').replace("'./workSystemSettingsModel.mjs'",JSON.stringify(new URL('./workSystemSettingsModel.mjs',import.meta.url).href));
 return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createWorkSystemSettings;
}

for(const field of fields)test(`impossible ISO day cannot become ${field.join('.')} evidence`,()=>{
 const data=summary();assign(data,field,'2026-02-31T00:00:00Z');const before=JSON.stringify(data);
 assert.throws(()=>validateSystemSummary(data),/Sistem durumu doğrulanamadı/);assert.equal(JSON.stringify(data),before);
});

for(const date of ['2026-02-30T00:00:00Z','2025-02-29T00:00:00Z','1900-02-29T00:00:00Z','2100-02-29T00:00:00Z','2026-04-31T12:00:00+03:00','2026-06-31T23:30:00.123456789-04:00','2026-11-31T00:00:00+14:00'])test(`invalid calendar ${date} is rejected rather than rolled into another day`,()=>{
 assert.equal(Number.isFinite(Date.parse(date)),true,'Counterexample must be accepted and normalized by the old parser');
 const data=summary();data.backup.lastSuccessAt=date;assert.throws(()=>validateSystemSummary(data));
 const evidence=historical(date),before=JSON.stringify(evidence);assert.equal(historicalRecoveryEvidence(evidence),null);assert.throws(()=>validateSystemSummary(evidence));assert.equal(JSON.stringify(evidence),before);
});

const validDates=['2026-01-31T00:00:00Z','2026-04-30T00:00:00Z','2024-02-29T00:00:00Z','2000-02-29T00:00:00Z','2400-02-29T00:00:00Z','1900-02-28T00:00:00Z','0000-02-29T00:00:00Z','0096-02-29T00:00:00Z','+010000-02-29T00:00:00Z','2026-10-08T20:32:43.5Z','2026-10-08T20:32:43.574Z',valid,'2026-10-08T20:32:43.574384899Z','2024-02-29T00:15:00+14:00','2024-02-29T23:45:00-12:00','2026-12-31T23:45:00-03:30','2026-01-01T00:15:00+05:45','2024-02-29T24:00:00Z'];
for(const date of validDates)test(`existing valid timestamp ${date} keeps its original offset and precision`,()=>{
 const data=summary();for(const field of fields)assign(data,field,date);const before=JSON.stringify(data);
 assert.equal(validateSystemSummary(data),data);assert.equal(JSON.stringify(data),before);
 assert.equal(systemDate(date),new Date(date).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}));
});

for(const date of ['2024-02-29T00:15:00+14:00','2024-02-29T23:45:00-12:00','2000-02-29T23:59:59.123456789+03:00',valid])test(`valid historical comparison ${date} remains historical, never current-backup acceptance`,()=>{
 const data=historical(date),before=JSON.stringify(data);assert.equal(validateSystemSummary(data),data);assert.equal(historicalRecoveryEvidence(data),data.recoveryEvidence);assert.equal(data.recoveryEvidence.currentBackupVerified,false);assert.equal(JSON.stringify(data),before);
});

test('null dates and unknown statuses retain their existing presentation',()=>{
 const data=summary();for(const field of fields)assign(data,field,null);data.backup.status='unknown';data.restore.status='unknown';data.services[0].status='unknown';
 data.backup.checksumVerified=null;data.restore.sourceDatabaseMatched=null;data.restore.criticalDataMatched=null;data.recoveryEvidence=null;
 const before=JSON.stringify(data);assert.equal(validateSystemSummary(data),data);assert.equal(historicalRecoveryEvidence(data),null);assert.equal(systemDate(null),'Henüz doğrulanmadı');assert.equal(JSON.stringify(data),before);
});

for(const date of ['2026-10-08','2026-10-08T20:32:43','2026-10-08 20:32:43','2026-10-08t20:32:43z','Thu, 08 Oct 2026 20:32:43 GMT'])test(`existing parseable format ${date} is not narrowed to a new timestamp schema`,()=>{
 const data=summary();data.services[0].checkedAt=date;assert.equal(validateSystemSummary(data),data);assert.equal(data.services[0].checkedAt,date);
});

for(const date of ['2026-00-01T00:00:00Z','2026-13-01T00:00:00Z','2026-01-00T00:00:00Z','2026-01-32T00:00:00Z','not-a-date'])test(`existing rejection of ${date} is preserved`,()=>{
 const data=summary();data.restore.lastSuccessAt=date;assert.throws(()=>validateSystemSummary(data));
});

for(const kind of ['backup','service','historical'])test(`invalid ${kind} timestamp clears the entire production settings summary on readonly refresh`,async()=>{
 const create=await controller(),button={},root={isConnected:true,innerHTML:'',querySelector:()=>button},calls=[];
 let current=kind==='historical'?historical(valid):summary();
 const ui=create({root,session:{system:async(path,options)=>{calls.push({path,options});return current;}}});
 try{
  ui.mount();await tick();assert.match(root.innerHTML,/system-grid/);assert.match(root.innerHTML,/Örnek personel/);
  current=kind==='historical'?historical('2026-02-31T00:00:00Z'):summary();
  if(kind==='backup')current.backup.lastSuccessAt='2026-02-31T00:00:00Z';if(kind==='service')current.services[0].checkedAt='2026-02-31T00:00:00Z';
  const before=JSON.stringify(current);await button.onclick();
  assert.match(root.innerHTML,/Sistem durumu şu anda okunamıyor/);assert.doesNotMatch(root.innerHTML,/system-grid|Örnek personel|system-service ready|Kayıtlı kapsam doğrulandı|03\.03\.2026|3\.03\.2026/);
  assert.equal(JSON.stringify(current),before);assert.deepEqual(calls,Array.from({length:2},()=>({path:'/api/work-system/summary',options:undefined})));
 }finally{ui.dispose();}
});
