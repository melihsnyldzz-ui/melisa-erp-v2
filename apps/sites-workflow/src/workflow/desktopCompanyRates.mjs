import {desktopCompanyRateDate,isDesktopCompanyRates} from '../../../../packages/shared/src/desktopCompanyRates.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountDesktopCompanyRates({root,load,initialDate}={}){
 if(!root||typeof root.querySelector!=='function'||typeof load!=='function')throw Error('COMPANY_RATES_CONFIGURATION');
 const now=new Date();let date=desktopCompanyRateDate(initialDate??[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')),live=true,sequence=0;
 root.innerHTML=`<section class="card panel" style="padding:20px" aria-label="Şirket günlük kurları"><h2>Şirket günlük kurları</h2><p>Seçilen tarih için şirket içinde belirlenen TRY karşılıkları.</p><form><label>Kur tarihi <input type="date" data-company-rate-date value="${esc(date)}" required></label><button class="btn" type="submit">Kurları göster</button></form><div data-company-rate-result><p role="status">Tarihi seçip kurları gösterin.</p></div></section>`;
 const input=root.querySelector('[data-company-rate-date]'),button=root.querySelector('button'),output=root.querySelector('[data-company-rate-result]');
 input.addEventListener('change',()=>{if(!live)return;sequence++;button.disabled=false;output.innerHTML='<p role="status">Tarih değişti. Kurları yeniden gösterin.</p>';});
 root.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();if(!live)return;const current=++sequence,selected=input.value;try{desktopCompanyRateDate(selected);}catch{output.innerHTML='<p role="alert">Geçerli bir takvim tarihi seçin.</p>';return;}button.disabled=true;output.innerHTML='<p role="status">Şirket kurları okunuyor…</p>';
  try{const rates=await load(selected);if(!live||sequence!==current||input.value!==selected)return;if(!isDesktopCompanyRates(rates,selected))throw Error();output.innerHTML=`<p>${esc(selected)} tarihli şirket kurları</p><dl class="desktop-product-details">${rates.rates.map(r=>`<div><dt>${esc(r.currency)}</dt><dd>${r.defined?`1 ${esc(r.currency)} = ${esc(r.rateExact8)} TRY${r.currency==='TRY'?'':` · Kur kaynağı: ${r.source?esc(r.source):'belirtilmemiş'}`}`:'Bu tarih için kur tanımlı değil.'}</dd></div>`).join('')}</dl>`;
  }catch{if(live&&sequence===current&&input.value===selected)output.innerHTML='<p role="alert">Şirket kurları okunamadı. Tarihi, oturumu ve bağlantıyı kontrol edip tekrar deneyin.</p>';}
  finally{if(live&&sequence===current)button.disabled=false;}
 });
 return Object.freeze({dispose(){live=false;sequence++;}});
}
