import {createHash,randomUUID} from 'node:crypto';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message)=>{throw Object.assign(new Error(message),{code,statusCode:409});};
export function createCatalogFeed({load,quote,now=Date.now,cacheMs=5000,ttlMs=15*60*1000}){
 let current=null,readAt=0,loading=null;const snapshots=new Map(),plans=new Map();
 async function read(){
  if(current&&now()-readAt<cacheMs)return current;
  if(!loading)loading=(async()=>{const data=await load();data.rows.sort((a,b)=>a.id-b.id);const revision=hash(data),next={...data,revision};
   snapshots.set(revision,next);while(snapshots.size>4)snapshots.delete(snapshots.keys().next().value);
   current=next;readAt=now();return next;})().finally(()=>loading=null);
  return loading;
 }
 return {
  async version(query,actor){
   const next=await read(),base=snapshots.get(query.baseRevision);
   if(next.revision===query.baseRevision)return {changed:false,revision:next.revision};
   const mode=base&&base.priceScope===next.priceScope&&hash(base.rates)===hash(next.rates)&&hash(base.customers)===hash(next.customers)?'delta':'full';
   const previous=new Map((base?.rows||[]).map(r=>[r.id,hash(r)])),ids=new Set(next.rows.map(r=>r.id));
   const rows=mode==='full'?next.rows:next.rows.filter(r=>previous.get(r.id)!==hash(r));
   const removedIds=mode==='full'?[]:base.rows.filter(r=>!ids.has(r.id)).map(r=>r.id);
   for(const [id,p] of plans)if(p.expires<now())plans.delete(id);
   while(plans.size>=6)plans.delete(plans.keys().next().value);
   const planId=randomUUID();
   plans.set(planId,{actorId:Number(actor.id),terminalCode:query.terminalCode,expires:now()+ttlMs,rows,snapshot:next});
   return {changed:true,revision:next.revision,planId,mode,customers:next.customers,total:next.rows.length,changedCount:rows.length,removedIds};
  },
  page(query,actor){
   const plan=plans.get(query.planId);
   if(!plan||plan.expires<now())fail('NATIVE_CATALOG_EXPIRED','Kart güncellemesi yeniden başlatılacak.');
   if(plan.actorId!==Number(actor.id)||plan.terminalCode!==query.terminalCode)fail('NATIVE_CATALOG_OWNER','Kart güncelleme oturumu değişmiş.');
   const customer=plan.snapshot.customers.find(c=>c.id===Number(query.customerId));
   const after=Number(query.afterId||0),limit=Number(query.limit||200);
   if(!customer||!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>200)fail('NATIVE_CATALOG_PAGE','Kart güncelleme sayfası geçersiz.');
   const rows=plan.rows.filter(r=>r.id>after).slice(0,limit+1),quotes=rows.slice(0,limit).map(row=>quote(row,customer,plan.snapshot.rates,actor,query.terminalCode));
   return {revision:plan.snapshot.revision,quotes,nextId:rows.length>limit?quotes.at(-1).productId:null};
  }
 };
}
