import {countGroups,countRows} from './countModel.js';

export const approvalRoles=type=>type==='İndirim'?['Angela','Semih']:['İlker','Semih'];
export const canDecideApproval=(type,actor)=>approvalRoles(type).includes(actor);
export function approvalQueue(s,receipts){
 const rows=[];
 const groups=[...new Set(s.goods.filter(g=>g.state==='pending').map(g=>g.batchId||g.id))];
 for(const id of groups){const lines=s.goods.filter(g=>(g.batchId||g.id)===id),g=lines[0];rows.push({id,type:'Mal kabulü',description:g.supplier+' · '+lines.map(l=>`${l.code}: ${l.qty} adet`).join(', '),reason:g.note,actor:g.createdBy,at:g.at,action:'review-goods',target:g.id})}
 for(const id of countGroups(s)){const lines=countRows(s,id),c=lines[0];if(c.state==='pending')rows.push({id,type:'Sayım',description:lines.map(l=>`${l.code}: fark ${l.difference}`).join(', '),reason:lines.map(l=>l.reason).filter(Boolean).join('; '),actor:c.countedBy,at:c.submittedAt||c.at,action:'review-count',target:id})}
 for(const r of s.supplierReturns||[])if(r.state==='pending')rows.push({id:r.id,type:'Tedarikçi iadesi',description:`${r.supplier} · ${r.code}: ${r.qty} adet · ${r.kind==='uninvoiced'?'Faturasız':'Faturalı'}`,reason:r.reason,actor:r.actor,at:r.at,action:'review-supplier-return',target:r.id});
 for(const r of receipts){if(r.cancelled)continue;
  if(r.discount?.state==='pending')rows.push({id:r.id,type:'İndirim',description:`${r.customer} · %${r.discount.bps/100} · ${r.currency||'USD'}`,reason:r.discount.reason,actor:r.discount.actor,at:r.discount.at,receipt:r.id});
  for(const row of r.returns||[])if(row.state==='pending')rows.push({id:row.id,type:'Müşteri iadesi',description:`${r.customer} · ${row.code}: ${row.qty} adet · ${r.currency||'USD'}`,reason:row.reason,actor:row.actor,at:row.at,receipt:r.id});
 }
 return rows.sort((a,b)=>(a.at||'').localeCompare(b.at||''));
}
export function approvalHistory(s,receipts){
 const result=[],seen=new Set();
 for(const a of s.audit){if(!/Mal kabulü (tamamlandı|reddedildi)|[Ss]ayım (farkı uygulandı|reddedildi)|Tedarikçi iadesi (kabul edildi|reddedildi)/.test(a.type))continue;
  const goods=s.goods.find(g=>g.id===a.id),counts=countRows(s,a.id),ret=(s.supplierReturns||[]).find(r=>r.id===a.id);
  const id=goods?.batchId||a.id,key=[a.type,id,a.actor].join('|');if(seen.has(key))continue;seen.add(key);
  result.push({...a,id,reason:goods?.rejection?.reason||ret?.reason||counts[0]?.rejection?.reason||counts.map(c=>c.reason).filter(Boolean).join('; ')||goods?.note||'',action:goods?'review-goods':counts.length?'review-count':ret?'review-supplier-return':null,target:goods?.id||id});
 }
 for(const r of receipts)for(const h of r.history||[])if(/İndirim (onaylandı|reddedildi|uygulandı)|Müşteri iadesi (kabul edildi|reddedildi)/.test(h.type))result.push({...h,id:r.id,reason:h.details?.reason||(r.returns||[]).find(x=>x.id===h.details?.id)?.reason||'',receipt:r.id});
 return result.sort((a,b)=>(b.at||'').localeCompare(a.at||''));
}
