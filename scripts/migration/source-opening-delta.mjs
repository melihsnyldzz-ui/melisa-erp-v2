import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x===undefined?{missingField:true}:x)).digest('hex');
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='sourceKey').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return typeof value==='number'?String(value):value;}
export function compareOpeningSnapshots(beforePath,afterPath,directory){
  if(!path.isAbsolute(directory)||!path.resolve(directory).toLowerCase().startsWith('c:\\sirket\\erp\\evidence\\vega-migration-test-20261004\\private'))throw Error('PRIVATE_DIRECTORY_REQUIRED');
  const before=JSON.parse(fs.readFileSync(beforePath)),after=JSON.parse(fs.readFileSync(afterPath));
  if(before.source.database!=='VEGA_CAPTURE_20260930_01'||after.source.database!=='VEGA2026'||after.source.server!=='DESKTOP-KSRK0EQ'||!after.source.permissionProof?.effectiveDMLDenied||!before.captures.every(c=>c.twoPassStable)||!after.captures.every(c=>c.twoPassStable))throw Error('SOURCE_DELTA_IDENTITIES_REJECTED');
  const details={},summary={frozenSnapshotHash:hash(before),currentSnapshotHash:hash(after),frozenSourceAsOf:before.source.sourceAsOf,currentReadFinishedAt:after.exportAt,sourceSELECTOnly:true,atomicCutoverSnapshot:false,cutoverGate:'FINAL_QUIET_CUT_OR_COHERENT_SNAPSHOT_REQUIRED'};
  for(const family of ['products','parties']){
    const key=row=>family==='products'?String(row.sourceId):`${row.company}/${row.sourceId}`;
    const a=new Map(before[family].map(r=>[key(r),canonical(r)])),b=new Map(after[family].map(r=>[key(r),canonical(r)]));const rows=[];
    for(const [id,r]of b){const old=a.get(id);if(!old){rows.push({key:id,status:'NEW',inScope:String(r.scope).startsWith('IN_SCOPE'),afterHash:hash(r)});continue;}if(hash(old)!==hash(r))rows.push({key:id,status:'CHANGED',inScope:String(r.scope).startsWith('IN_SCOPE'),beforeHash:hash(old),afterHash:hash(r),changedFields:[...new Set([...Object.keys(old),...Object.keys(r)])].filter(k=>hash(old[k])!==hash(r[k]))});}
    for(const[id,r]of a)if(!b.has(id))rows.push({key:id,status:'MISSING',inScope:String(r.scope).startsWith('IN_SCOPE'),beforeHash:hash(r)});
    details[family]=rows;summary[family]={before:a.size,after:b.size,new:rows.filter(r=>r.status==='NEW').length,newInScope:rows.filter(r=>r.status==='NEW'&&r.inScope).length,changed:rows.filter(r=>r.status==='CHANGED').length,changedInScope:rows.filter(r=>r.status==='CHANGED'&&r.inScope).length,missing:rows.filter(r=>r.status==='MISSING').length,changedFields:Object.fromEntries([...new Set(rows.flatMap(r=>r.changedFields??[]))].map(k=>[k,rows.filter(r=>r.changedFields?.includes(k)).length]))};
  }
  fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'source-delta-detail.json'),JSON.stringify(details),{flag:'wx'});fs.writeFileSync(path.join(directory,'source-delta-summary.json'),JSON.stringify(summary),{flag:'wx'});return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1').replaceAll('/','\\'))console.log(JSON.stringify(compareOpeningSnapshots(...process.argv.slice(2))));
