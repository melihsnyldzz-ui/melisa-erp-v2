import {validateOperationCopyBootstrap} from './isolatedOperationCopyModel.mjs';
const fail=()=>{throw Error('Tedarikçi ve döviz seçimi doğrulanamadı. Son kaydı kontrol edin.');};
const defaults=()=>({profile:globalThis.window?.__MELISA_OPERATION_COPY__??globalThis.__MELISA_OPERATION_COPY__,location:globalThis.window?.location??globalThis.location});
export function createBusinessSupplierSelection({storage=globalThis.localStorage,userId,profile=defaults().profile,location=defaults().location}={}){
 if(location?.port!=='5234')return null;
 validateOperationCopyBootstrap(profile,location);if(profile.scopeKind!=='VERIFIED_BUSINESS_TEST'||!/^\d+$/.test(String(userId)))fail();
 const key=`melisa-work-business-supplier:${location.host??location.hostname+':'+location.port}:${userId}`;
 const members=profile.suppliers,eligible=s=>profile.products.some(p=>p.supplierId===s.id),find=(id,currency)=>members.find(s=>s.id===id&&s.currency===currency&&eligible(s));
 const get=()=>{const raw=storage?.getItem(key);if(!raw){const first=members.find(s=>s.currency==='TRY'&&eligible(s));if(!first)fail();return first;}let value;try{value=JSON.parse(raw);}catch{fail();}const selected=find(value.supplierId,value.currency);if(!selected||value.businessScopeHash!==profile.businessScopeHash)fail();return selected;};
 return {profile,members,eligible,get,key,set(supplierId,currency){const selected=find(supplierId,currency);if(!selected)fail();const raw=JSON.stringify({supplierId,currency,businessScopeHash:profile.businessScopeHash});storage?.setItem(key,raw);if(storage?.getItem(key)!==raw)fail();return selected;},headers(){const selected=get();return {'x-melisa-supplier-id':selected.id,'x-melisa-currency':selected.currency};},journalSuffix(){const s=get();return `:${s.id}:${s.currency}`;}};
}
export function businessSupplierOptions(selection,escape){if(!selection)return '';const current=selection.get();return selection.members.map(s=>`<option value="${s.id}:${s.currency}" ${s.id===current.id&&s.currency===current.currency?'selected':''} ${selection.eligible(s)?'':'disabled'}>${escape(s.code??s.id)} · ${escape(s.name??'Tedarikçi')} · ${s.currency}${selection.eligible(s)?'':' · Ürün bağı doğrulanmadı'}</option>`).join('');}
export function scopedProductChoices(products,search='',limit=50){const query=String(search).trim().toLocaleLowerCase('tr-TR');return products.filter(p=>!query||`${p.stockCode} ${p.name} ${p.barcode??''}`.toLocaleLowerCase('tr-TR').includes(query)).slice(0,Math.min(50,limit));}
