import './guide.css';
import {lessons,trainingCompletionNotice} from './lessons.mjs';
import {escapeHtml,readProgress,saveProgress} from './progress.mjs';
const root=document.querySelector('#training-guide');
let progressStorage=null;
try{progressStorage=window.localStorage;}catch{/* Keep the lesson usable without browser storage. */}
let state=readProgress(progressStorage),step=0,answer=null;
const lesson=()=>lessons.find(l=>l.id===location.hash.slice(1))??lessons[0];
const esc=escapeHtml;
const homeLink=new URLSearchParams(location.search).get('terminal')==='1'?'/terminal.html#home':'/ornek-akis.html';
function render(){
 const l=lesson(),s=l.steps[step],question=step===l.steps.length;
 root.innerHTML=`<header class="guide-header"><a href="${homeLink}">MELİSA <span>ERP</span></a><span>Kısa eğitimler</span></header>
 <main class="guide-layout"><aside aria-label="Dersler"><h1>İlk gün rehberi</h1><p>Önce işi öğren, sonra yetkinle uygula.</p><nav>${lessons.map((a,i)=>`<a href="#${esc(a.id)}" ${a.id===l.id?'aria-current="page"':''}><span>${i+1}</span>${esc(a.title)}${state.completed.includes(a.id)?'<small>İncelendi</small>':''}</a>`).join('')}</nav><p class="guide-safety">Bu rehber ticari işlem oluşturmaz. Dersleri incelemek, işyerindeki kullanıcı kabulü yerine geçmez.</p></aside>
 <article><div class="guide-eyebrow">${esc(l.role)} · ${esc(l.duration)}</div><h2>${esc(l.title)}</h2><div class="guide-handoff"><span>Personel<br><b>Sayar, hazırlar, gönderir</b></span><span>İlker / yetkili sorumlu<br><b>Kontrol eder, yetkisiyle onaylar</b></span><span>Muhasebe<br><b>Belge, tutar ve dövizi kontrol eder</b></span></div><p class="guide-authority">Görev devri yetki vermez. Ekranda izin verilmeyen işlem için yetkili sorumluya başvur.</p>
 <div class="guide-stage"><section class="guide-instruction"><p class="guide-eyebrow">${question?'Kısa soru':`Adım ${step+1} / ${l.steps.length}`}</p>${question?`<h3>${esc(l.quiz.question)}</h3><div class="guide-options">${l.quiz.options.map((o,i)=>`<button type="button" data-answer="${i}" class="${answer===i?'chosen':''}" ${answer===l.quiz.answer?'disabled':''}>${esc(o)}</button>`).join('')}</div>${answer!==null?`<p role="status" class="guide-feedback">${answer===l.quiz.answer?'Doğru.':'Bu noktayı tekrar düşün.'} ${esc(l.quiz.explanation)}</p>`:''}`:`<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p><div class="guide-watch"><b>Ekranda bak</b><p>${esc(s.watch)}</p></div><div class="guide-stop"><b>Bu derste işlem yapma</b><p>${esc(s.stop)}</p></div>`}</section><figure><img src="/egitim-gorselleri/${esc(l.image)}" alt="${esc(l.title)} ekranının ilgili bölümü" loading="lazy"><figcaption>İzole çalışma ekranından görünüm. Bu resimde işlem yapılamaz.</figcaption></figure></div>
 <footer class="guide-controls"><button type="button" data-action="back" ${step===0?'disabled':''}>Önceki</button><span>${question?'Bilgini kontrol et':`${step+1} / ${l.steps.length}`}</span><button type="button" data-action="next" ${question&&answer!==l.quiz.answer?'disabled':''}>${question?'Dersi inceledim':'Sonraki'}</button></footer>
 ${state.completed.includes(l.id)?`<p role="status" class="guide-completion">${esc(trainingCompletionNotice)}</p>`:''}
 <details><summary>İşlem yapmadan önce</summary><p>İlk uygulama yalnız ayrılmış deneme ortamında ve yetkili sorumlunun gözetiminde yapılır. Müşteri, tedarikçi, ürün, miktar ve dövizi birlikte kontrol et. Gerçek müşteriye mesaj gönderme.</p><p>Ödeme ve tahsilat stok hareketi değildir. Sipariş taslağı satış değildir. Sayım göndermek stok onayı değildir.</p></details></article></main>`;
 root.querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>{answer=Number(b.dataset.answer);render();}));
 root.querySelector('[data-action="back"]').addEventListener('click',()=>{step=Math.max(0,step-1);answer=null;render();});
 root.querySelector('[data-action="next"]').addEventListener('click',()=>{if(question){if(answer!==l.quiz.answer)return;state.completed=[...new Set([...state.completed,l.id])];saveProgress(progressStorage,state);const next=lessons[lessons.indexOf(l)+1];if(next)location.hash=next.id;else render();}else{step++;answer=null;render();}});
 root.querySelector('img').addEventListener('error',e=>{e.currentTarget.hidden=true;e.currentTarget.parentElement.querySelector('figcaption').textContent='Bu dersin ekran görüntüsü henüz bu pakete eklenmedi.';},{once:true});
}
window.addEventListener('hashchange',()=>{step=0;answer=null;render();});
render();
