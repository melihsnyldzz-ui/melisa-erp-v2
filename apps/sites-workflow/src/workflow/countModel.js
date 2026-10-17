import {stockQuantity,findGoodsProduct} from './demoOperationsModel.js';

const check=(ok,message)=>{if(!ok)throw Error(message)};
const counter=actor=>check(['Satış ekibi','İlker','Angela','Semih'].includes(actor),'Sayım için çalışma görünümünü seçin.');
const office=actor=>check(['İlker','Semih'].includes(actor),'Sayımı İlker veya Semih onaylayabilir.');
const quantity=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000;
const audit=(s,type,id,actor)=>s.audit.push({type,id,actor,at:new Date().toISOString()});
export const countRows=(s,id)=>{const row=s.counts.find(c=>c.id===id);const batch=row?.batchId||id;return s.counts.filter(c=>(c.batchId||c.id)===batch)};
export const countGroups=s=>[...new Set(s.counts.map(c=>c.batchId||c.id))];

// Only stock-affecting facts are captured: later payments or price changes
// should not invalidate a count. New movements with zero net effect do.
export function countFingerprint(s,code,receipts=[]){
 return JSON.stringify({opening:s.products.find(p=>p[0]===code)?.[3],
  goods:s.goods.filter(g=>g.code===code&&g.state==='accepted').map(g=>[g.id,g.qty]),
  counts:s.counts.filter(c=>c.code===code&&c.state==='accepted').map(c=>[c.id,c.difference]),
  returns:(s.supplierReturns||[]).filter(r=>r.code===code&&r.state==='approved').map(r=>[r.id,r.qty]),
  sales:receipts.filter(r=>r.items?.some(i=>i.code===code)).map(r=>[r.id,!!r.cancelled,r.items.map((i,index)=>i.code===code?[index,i.qty,(r.returns||[]).filter(x=>x.index===index&&x.state==='approved').map(x=>[x.id,x.qty])]:null)])});
}
export function createCountSession(s,{requestId,repeatOf=null},actor){
 counter(actor);check(typeof requestId==='string'&&requestId.length>=8,'Sayım kimliği gerekli.');
 const old=(s.countSessions||[]).find(d=>d.requestId===requestId);
 if(old){check(old.repeatOf===repeatOf,'Bu kimlik farklı bir sayımda kullanıldı.');return old}
 const previous=repeatOf?countRows(s,repeatOf):[];
 check(!repeatOf||previous.length,'Önceki sayım bulunamadı.');
 check(!previous.some(c=>c.state==='superseded'),'Bu sayımın daha yeni bir tekrarı var.');
 const draft={id:`TS-${String(++s.sequence).padStart(5,'0')}`,requestId,repeatOf,lines:[],unknownScans:[],revision:0,state:'draft',actor,at:new Date().toISOString()};
 (s.countSessions||=[]).push(draft);audit(s,'Toplu sayım başlatıldı',draft.id,actor);return draft;
}
function editable(s,id,revision,actor){counter(actor);const d=(s.countSessions||[]).find(d=>d.id===id);check(d?.state==='draft','Bu sayım taslağı artık düzenlenemez.');check(d.revision===revision,'Sayım başka bir ekranda değişti. Kapatıp taslağı yeniden açın.');return d}
export function updateCountSession(s,id,revision,action,actor,receipts=[]){
 const d=editable(s,id,revision,actor),lines=structuredClone(d.lines);
 if(action.type==='scan'){
  check(quantity(action.quantity)&&action.quantity>0,'Okutma adedi pozitif tam sayı olmalı.');let code;try{code=findGoodsProduct(s,action.input)[0]}catch(e){if(!String(e.message).startsWith('Ürün bulunamadı.'))throw e;const value=String(action.input||'').trim();check(value.length>0&&value.length<=64,'Barkod veya ürün kodu geçerli değil.');d.unknownScans||=[];const unresolved=d.unknownScans.find(x=>x.value===value);if(unresolved)unresolved.quantity+=action.quantity;else d.unknownScans.push({value,quantity:action.quantity,status:'needs_review',at:new Date().toISOString()});d.revision++;d.updatedAt=new Date().toISOString();d.updatedBy=actor;return d;}
  const old=lines.find(l=>l.code===code);
  if(old){check(quantity(old.physical+action.quantity),'Toplam adet sınırı aşıldı.');old.physical+=action.quantity;}
  else{check(lines.length<100,'Bir sayımda en fazla 100 ürün olabilir.');lines.push({code,system:stockQuantity(s,code,receipts),physical:action.quantity,reason:'',fingerprint:countFingerprint(s,code,receipts),at:new Date().toISOString()})}
 }else if(action.type==='remove-unknown'){
  d.unknownScans||=[];const index=d.unknownScans.findIndex(x=>x.value===action.value);check(index>=0,'İncelemedeki okutma bulunamadı.');d.unknownScans.splice(index,1);
 }else{
  const line=lines.find(l=>l.code===action.code);check(line,'Sayım satırı bulunamadı.');
  if(action.type==='quantity'){check(quantity(action.quantity),'Sıfır veya pozitif tam adet girin.');line.physical=action.quantity;}
  else if(action.type==='reason')line.reason=String(action.reason||'').slice(0,500);
  else if(action.type==='remove')lines.splice(lines.indexOf(line),1);
  else throw Error('Sayım işlemi geçersiz.');
 }
 d.lines=lines;d.revision++;d.updatedAt=new Date().toISOString();d.updatedBy=actor;return d;
}
export function submitCountSession(s,id,revision,actor){
 const d=editable(s,id,revision,actor);check(d.lines.length||d.unknownScans?.length,'En az bir ürün okutun.');
 for(const l of d.lines){check(quantity(l.physical),'Sayım adedini kontrol edin.');check(l.physical===l.system||l.reason.trim().length>=3,`${l.code} için fark nedenini yazın.`)}
 const previous=d.repeatOf?countRows(s,d.repeatOf):[];
 check(!previous.some(c=>c.state==='superseded'),'Önceki sayım için yeni bir tekrar zaten gönderildi.');
 if(previous.length){const expected=previous.map(c=>c.code).sort().join('|'),actual=d.lines.map(l=>l.code).sort().join('|');check(expected===actual,'Tekrar sayımda önceki sayımın bütün ürünlerini yeniden sayın.');}
 const at=new Date().toISOString();
 const rows=d.lines.map((l,index)=>({...structuredClone(l),id:`${d.id}-${index+1}`,batchId:d.id,repeatOf:d.repeatOf,difference:l.physical-l.system,state:'pending',countedBy:actor,submittedAt:at}));
 const unknown=(d.unknownScans||[]).map((x,index)=>({id:`${d.id}-U${index+1}`,batchId:d.id,code:x.value,physical:x.quantity,system:null,difference:null,reason:'Stok kartı gerekli',unknown:true,unknownScans:[{value:x.value,quantity:x.quantity,status:'needs_review'}],state:'needs_review',countedBy:actor,submittedAt:at}));
 for(const p of previous)if(p.state==='pending'){p.state='superseded';p.supersededBy=d.id;}
 s.counts.push(...rows,...unknown);d.state='submitted';d.revision++;audit(s,'Toplu sayım onaya gönderildi',d.id,actor);return [...rows,...unknown];
}
export function approveCountBatch(s,id,actor,receipts=[]){
 office(actor);const rows=countRows(s,id);check(rows.length&&rows.every(c=>['pending','needs_review'].includes(c.state)),'Bu sayım artık onay beklemiyor.');check(!rows.some(c=>c.unknown||c.state==='needs_review'),'Stok kartı gerekli okutmalar çözülmeden sayım uygulanamaz.');
 for(const c of rows){check(stockQuantity(s,c.code,receipts)===c.system&&(!c.fingerprint||c.fingerprint===countFingerprint(s,c.code,receipts)),`${c.code}: Sayımdan sonra stok hareketi var. Tekrar sayım açın.`);check(c.physical===c.system||c.reason?.trim().length>=3,'Fark nedeni gerekli.');}
 for(const c of rows){c.state='accepted';c.actor=actor;c.approvedAt=new Date().toISOString();}
 audit(s,'Toplu sayım farkı uygulandı',rows[0].batchId||rows[0].id,actor);return rows;
}
export function rejectCountBatch(s,id,reason,actor){
 office(actor);check(reason?.trim().length>=3,'Ret nedenini yazın.');const rows=countRows(s,id);check(rows.length&&rows.every(c=>['pending','needs_review'].includes(c.state)),'Bu sayım artık onay beklemiyor.');
 for(const c of rows){c.state='rejected';c.rejection={reason:reason.trim(),actor,at:new Date().toISOString()};}
 audit(s,'Sayım reddedildi',rows[0].batchId||rows[0].id,actor);return rows;
}
