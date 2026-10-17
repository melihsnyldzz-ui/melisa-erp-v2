const sourceHash='36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400';
const planHash='18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a';
const types=[['product','Ürün','product.view'],['customer','Müşteri','customer.view'],['supplier','Tedarikçi','supplier.view']];
const reasons=Object.freeze({
 EXACT_NATIVE_IDENTITY_NOT_PROVEN:'Açılış kimlik eşlemesi kabul edilmedi.',
 QUANTITY_OR_UNIT_UNKNOWN:'Kaynak miktarı veya birimi belirsiz.',
 BARCODE_OWNER_CONFLICT_PRODUCT_QUARANTINED:'Barkod sahipliği çakışıyor.',
 INACTIVE_AMBIGUOUS_BARCODE_PRODUCT_QUARANTINED:'Pasif barkodun sahipliği veya kullanımı belirsiz.',
 NATIVE_IDENTITY_CURRENCY_OR_BALANCE_UNPROVEN:'Cari kimliği, dövizi veya bakiyesi açılışta kabul edilmedi.',
 NATIVE_MAIN_ACCOUNT_UNPROVEN:'Cari ana döviz hesabı kabul edilmedi.',
 NATIVE_TARGET_NOT_PRESENT:'Kaynak kartının hedefte karşılığı yok.',
 SOURCE_BALANCE_UNKNOWN:'Kaynak bakiyesi bilinmiyor.',
 SOURCE_CURRENCY_UNKNOWN:'Kaynak dövizi bilinmiyor veya tanınmıyor.'
});
export const quarantineReason=code=>{if(!Object.hasOwn(reasons,code))throw Error('Karantina inceleme nedeni doğrulanamadı.');return reasons[code];};
export const quarantineTypes=permissions=>types.filter(([, ,permission])=>permissions.includes(permission));
export const quarantineSourceName=value=>value===null?'Kaynak adı bilinmiyor':value;
export function quarantineEnvelope(payload,entity){
 const m=payload?.meta;
 if(payload?.success!==true||!Array.isArray(payload.data)||m?.runId!=='VEGA-OPENING-TEST-20261004-06'||m?.sourceHash!==sourceHash||m?.planHash!==planHash||m?.sourceAsOf!=='2026-09-30'||m?.readOnly!==true||m?.sealed!==true||m?.operationGate!==true||!Number.isSafeInteger(m.total)||m.total<0||!Number.isInteger(m.page)||m.page<1||!Number.isInteger(m.limit)||m.limit<1||m.limit>100)throw Error('TEST operasyon karantinası doğrulanamadı.');
 const seen=new Set();
 for(const r of payload.data){
  if(r.entityType!==entity||typeof r.sourceKey!=='string'||!r.sourceKey||seen.has(r.sourceKey)||!Array.isArray(r.reasons)||!r.reasons.length||r.reasons.some(x=>typeof x!=='string'||!x)||typeof r.sourceCode!=='string'||(r.sourceName!==null&&typeof r.sourceName!=='string')||!['blocked','not-present'].includes(r.status)||r.status==='blocked'&&(typeof r.nativeId!=='string'||!/^[1-9]\d*$/.test(r.nativeId))||r.status==='not-present'&&r.nativeId!==null)throw Error('Karantina kaynak ve hedef bağı doğrulanamadı.');
  if(![r.nativeCode,r.nativeName].every(v=>v===null||typeof v==='string'))throw Error('Karantina hedef kartı doğrulanamadı.');
  r.reasons.forEach(quarantineReason);seen.add(r.sourceKey);
 }
 return payload;
}
export function testMigrationQuarantine({api,esc,permissions}){
 const available=quarantineTypes(permissions);
 return {
  html:()=>`<h1>Aktarım karantinası</h1><section class="card panel"><p class="pill green">TEST · Operasyon engeli · Salt okunur</p><p>30 Eylül 2026 açılışında güvenle kabul edilemeyen kaynak kartları burada görünür. Bağlı hedef kartlarında ticari işlem engellenir; hedefte kartı bulunmayan kaynak için tahmini kimlik üretilmez. Bu listeyi görmek veya listede bulunmamak, tüm işletme verisinin kabul edildiği anlamına gelmez.</p>${available.length?`<form id="quarantine-filter" class="test-price-filter"><label>Kart türü<select name="entity">${available.map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label>Kaynak / hedef kodu veya adı<input name="search" maxlength="120" placeholder="Karantina kartı ara"></label><button class="btn primary">Listele</button></form><p id="quarantine-summary"></p><div id="quarantine-results" aria-live="polite">Karantina okunuyor…</div><div><button id="quarantine-prev" class="btn" disabled>Önceki</button> <button id="quarantine-next" class="btn" disabled>Sonraki</button></div>`:'<p>Bu liste için ürün, müşteri veya tedarikçi görüntüleme yetkisi gerekir.</p>'}<p class="test-note">Kartlar bu ekrandan değiştirilmez veya karantinadan çıkarılmaz. Kaynak eşlemesi ve işletme kabulü tamamlanmadan işlem açılmaz. Güncel Vega deltası bu açılış kabulüne uygulanmadı.</p></section>`,
  bind(){
   if(!available.length)return;
   const form=document.getElementById('quarantine-filter'),summary=document.getElementById('quarantine-summary'),result=document.getElementById('quarantine-results'),prev=document.getElementById('quarantine-prev'),next=document.getElementById('quarantine-next');let generation=0,page=1;
   async function load(){const current=++generation;const f=new FormData(form),entity=f.get('entity');summary.textContent='';result.textContent='Karantina okunuyor…';prev.disabled=next.disabled=true;
    try{const p=quarantineEnvelope(await api('/api/migration-quarantine?'+new URLSearchParams({entity,search:f.get('search'),page:String(page),limit:'25'}),{envelope:true}),entity);if(current!==generation||!result.isConnected)return;
     summary.textContent=`${p.meta.total} kaynak kartı · Sayfa ${p.meta.page} · 30 Eylül 2026 kesimi`;
     result.innerHTML=`<div class="tablewrap"><table class="quarantine-table"><thead><tr><th>Kaynak kartı</th><th>Hedef kartı</th><th>Operasyon durumu / neden</th></tr></thead><tbody>${p.data.map(r=>`<tr><td>${esc(r.sourceCode)}<br>${esc(quarantineSourceName(r.sourceName))}<details><summary>Kaynak bağı</summary><small>${esc(r.sourceKey)}</small></details></td><td>${r.nativeId===null?'Hedefte kart yok':`#${esc(r.nativeId)} · ${esc(r.nativeCode)}<br>${esc(r.nativeName)}`}</td><td><b>${r.status==='blocked'?'İşlem engelli':'Aktarım engelli · Hedef kimliği yok'}</b><ul>${r.reasons.map(reason=>`<li>${esc(quarantineReason(reason))}</li>`).join('')}</ul></td></tr>`).join('')||'<tr><td colspan="3">Bu filtrede karantina kartı yok.</td></tr>'}</tbody></table></div>`;
     prev.disabled=page<=1;next.disabled=page*p.meta.limit>=p.meta.total;
    }catch(e){if(current!==generation||!result.isConnected)return;result.innerHTML=`<p class="test-error" role="alert">${esc(e.message)}</p>`;summary.textContent='Karantina doğrulanamadı; boş liste kabul sonucu değildir.';}
   }
   form.onsubmit=e=>{e.preventDefault();page=1;load();};form.elements.entity.onchange=()=>{page=1;load();};prev.onclick=()=>{if(page>1){page--;load();}};next.onclick=()=>{page++;load();};load();
  }
 };
}
