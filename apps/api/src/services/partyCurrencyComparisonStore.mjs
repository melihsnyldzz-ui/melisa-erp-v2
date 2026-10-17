import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ROOT='C:\\Sirket\\ERP\\data\\TEST-20260929-01\\party-currency-comparison-goal71';
const schema='melisa-party-currency-comparison.v1';
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const exact=v=>v===null||typeof v==='string'&&/^-?(?:0|[1-9]\d{0,19})\.\d{1,8}$/.test(v);
const id=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=256;
const check=v=>{if(!v)throw Error('PARTY_CURRENCY_COMPARISON_INVALID');};
const clone=v=>JSON.parse(JSON.stringify(v));
const pick=(v,keys)=>Object.fromEntries(keys.map(k=>[k,v[k]]));
const scaled=v=>{const negative=v.startsWith('-'),[w,f]=v.replace(/^-/,'').split('.');return (BigInt(w)*100000000n+BigInt(f.padEnd(8,'0')))*(negative?-1n:1n);};
const direction=v=>v===null?null:scaled(v)===0n?'ZERO':scaled(v)>0n?'B':'A';

export function validatePartyCurrencyComparisonIndex(index){
 check(index?.schemaVersion===schema&&index.source?.server==='DESKTOP-KSRK0EQ'&&index.source.database==='VEGA2026');
 check(hash(index.source.hash)&&typeof index.source.capturedAt==='string'&&Number.isFinite(Date.parse(index.source.capturedAt)));
 check(index.source.dateFrom==='2026-01-01'&&index.source.dateToExclusive==='2026-10-08'&&index.source.atomicSnapshot===false);
 check(hash(index.report?.sha256)&&index.report.dateVerified===false&&index.report.filterVerified===false);
 check(Array.isArray(index.parties)&&index.parties.length<=1200);
 const nativeKeys=new Set(),sourceKeys=new Set();
 for(const p of index.parties){
  check(['customer','supplier'].includes(p.role)&&text(p.sourceKey)&&id(p.sourceId)&&p.sourceCompany===(p.role==='customer'?'F0102':'F0103'));
  check(p.nativeId===null||id(p.nativeId));check(typeof p.identityVerified==='boolean');
  check(typeof p.nativeCode==='string'&&p.nativeCode.length<=120&&Array.isArray(p.accounts)&&p.accounts.length<=30);
  check(!sourceKeys.has(p.sourceKey));sourceKeys.add(p.sourceKey);
  if(p.nativeId!==null){const key=p.role+':'+p.nativeId;check(!nativeKeys.has(key));nativeKeys.add(key);}
  if(p.identityVerified){check(p.nativeId!==null&&['exact-source-link','exact-hold-source-link'].includes(p.identityBasis));if(p.identityBasis==='exact-source-link')check(text(p.sourceRecordKey));}
  for(const a of p.accounts){
   check(a.currency===null||['TRY','USD','EUR'].includes(a.currency));check(a.currencyRaw===null||text(a.currencyRaw));
   for(const key of ['movementCount','openingCandidateCount','periodCount','excludedCodeCount','missingAmountCount','missingRateCount'])check(Number.isSafeInteger(a[key])&&a[key]>=0);
   check(a.openingCandidateCount+a.periodCount+a.excludedCodeCount===a.movementCount);
   for(const key of ['recordedNetExact','openingCandidateNetExact','periodNetExact','excludedNetExact'])check(exact(a[key]));
   check(['RECORDED_NET_ONLY','NO_MOVEMENT','UNKNOWN'].includes(a.status)&&a.direction===direction(a.recordedNetExact));
   if(a.status==='NO_MOVEMENT')check(a.movementCount===0&&a.recordedNetExact===null);
   if(a.status==='RECORDED_NET_ONLY')check(a.movementCount>0&&a.currency!==null&&a.missingAmountCount===0&&a.missingRateCount===0&&a.recordedNetExact!==null);
   if(a.currency===null||a.missingAmountCount||a.missingRateCount)check(a.recordedNetExact===null);
   // An absent opening candidate is unknown, not a proven zero opening.
   if(a.openingCandidateCount===0)check(a.openingCandidateNetExact===null);
  }
 }
 return index;
}

export function createPartyCurrencyComparisonStore(index){
 const data=clone(validatePartyCurrencyComparisonIndex(index));
 const registry=new Map(data.parties.filter(p=>p.identityVerified).map(p=>[p.role+':'+p.nativeId,p]));
 return ({role,raw})=>{
  if(!['customer','supplier'].includes(role))return null;
  const card=raw?.[role],p=registry.get(role+':'+card?.id),code=card?.[role+'Code'];
  if(!p||code!==p.nativeCode||raw.provenance?.verified!==true||raw.provenance.quarantineVerified!==true)return null;
  const links=raw.sourceLinks??[];
  const link=links.length===1&&links[0].sourceCompany===p.sourceCompany&&String(links[0].sourceId)===p.sourceId
   &&String(links[0][role+'Id'])===p.nativeId&&links[0].sourceRecordKey===p.sourceRecordKey
   &&!(raw.sourceParties??[]).some(s=>s.globalSourceLinkCount!==1);
  const hold=(raw.quarantineHolds??[]).some(h=>h.entity===role&&h.nativeId===p.nativeId&&h.sourceKey===p.sourceKey);
  if(!(p.identityBasis==='exact-source-link'?link:hold))return null;
  return clone({schemaVersion:schema,readOnly:true,effectiveBalance:false,
   source:pick(data.source,['server','database','capturedAt','dateFrom','dateToExclusive','atomicSnapshot','hash']),
   report:pick(data.report,['sha256','dateVerified','filterVerified']),
   identity:{role,sourceCompany:p.sourceCompany,sourceId:p.sourceId,basis:p.identityBasis},
   // Never carry raw card BAKIYE, report GeneralBalance, or contact details.
   accounts:p.accounts.map(a=>pick(a,['currency','currencyRaw','movementCount','openingCandidateCount','periodCount','excludedCodeCount','missingAmountCount','missingRateCount','recordedNetExact','openingCandidateNetExact','periodNetExact','excludedNetExact','direction','status']))});
 };
}

let store=null;
export async function configurePartyCurrencyComparisonStore({root,indexSha256,identity,mode,port}){
 store=null;if(root===undefined||root===null)return;
 check(path.win32.normalize(root).toLowerCase()===ROOT.toLowerCase()&&hash(indexSha256));
 check(mode==='erp'&&port===4144&&identity?.serverName==='Semih\\MELISADEV'&&identity.databaseName==='MELISA_ERP_SIRKET_TEST_20260929_01');
 check(identity.sysadmin===0&&identity.databaseControl===0&&identity.liveDatabaseAccess===0);
 const filename=path.join(root,'index.json');check(!(await fs.lstat(root)).isSymbolicLink()&&!(await fs.lstat(filename)).isSymbolicLink());
 const bytes=await fs.readFile(filename);check(bytes.length<=4*1024*1024&&createHash('sha256').update(bytes).digest('hex')===indexSha256.toLowerCase());
 store=createPartyCurrencyComparisonStore(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')));
}
export const readPartyCurrencyComparison=args=>store?.(args)??null;
