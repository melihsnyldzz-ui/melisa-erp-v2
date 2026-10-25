import {lessons,trainingCompletionNotice} from '../training-guide/lessons.mjs';
import {escapeHtml,inlineProgressKey,readInlineProgress,saveInlineProgress} from '../training-guide/progress.mjs';

const tasks=Object.freeze({
 receiving:{title:'Mal kabulünde iş sırası',steps:[['Personel','Ürünleri sayar, adetleri kaydeder ve kontrole gönderir.'],['İlker','Sayımı kontrol eder ve mevcut yetkisiyle kabulü onaylar. Stok bu onayda artar.'],['Muhasebe','Belgeyi, tutarı ve dövizi kontrol eder. Fatura işlemini ekrandaki yetkili kişi yapar.']]},
 purchase:{title:'Alış faturasında iş sırası',steps:[['Personel','Gelen ürünlerin fiziksel sayımını kaydeder.'],['İlker','Mal kabulünü kontrol edip onaylar. Faturada stok tekrar artmaz.'],['Muhasebe','Fatura belgesini, tutarı ve dövizi kontrol eder. Kaydı mevcut yetkili kişi kesinleştirir.']]},
 count:{title:'Sayımda iş sırası',steps:[['Personel','Fiziksel adedi ve fark nedenini kaydeder, kontrole gönderir.'],['İlker','Sayımı kontrol eder ve mevcut yetkisiyle onaylar. Stok farkı bu onayda uygulanır.'],['Muhasebe','Sonucu ve ilgili belgeleri kontrol eder. Sayım onayı stok yetkilisindedir.']]},
 sale:{title:'Satışa başlarken',steps:[['Müşteriyi seçin','Satışın yapılacağı müşteriyi seçin.'],['Barkodu okutun','Ürünü bulun ve satışa ekleyin.'],['Kontrol edip kaydedin','Adedi, fiyatı ve dövizi kontrol edin; taslağı kaydedip satışı tamamlayın.']]}
});

// Presentation only: no role grants, request handlers or commercial state.
export function workTaskHandoff(lesson,{inlineGuide=false}={}){
 const task=typeof lesson==='string'&&Object.hasOwn(tasks,lesson)?tasks[lesson]:null;
 if(!task)return '';
 return `<section class="card work-task-handoff" aria-label="${task.title}"><div class="work-task-heading"><h2>${task.title}</h2><a href="/kullanim-egitimi.html#${lesson}">Kısa eğitim</a></div><ol>${task.steps.map(([role,description])=>`<li><b>${role}</b><span>${description}</span></li>`).join('')}</ol>${lesson==='receiving'&&inlineGuide?'<div data-receiving-guide></div>':''}</section>`;
}

const receivingLesson=lessons.find(lesson=>lesson.id==='receiving');
const preparationSteps=Object.freeze([
 {title:'Yeni sayım',selector:'[data-count-new]',text:'Hazırlık için Yeni sayım düğmesini kullanın. Açık sayımınız varsa önce onu inceleyin; rehber sayım açmaz veya silmez.',missing:'Yeni sayım düğmesi şu anda görünmüyor. Gelen mal ekranını yeniden açın.'},
 {title:'Tedarikçi',selector:'[data-count-supplier]',text:receivingLesson.steps[0].text,missing:'Tedarikçi alanı henüz açık değil. Önceki adıma dönüp Yeni sayım düğmesini kullanın.'},
 {title:'Barkod veya ürün',selector:'[data-count-scan] input[name="scan"], [data-count-product]',text:receivingLesson.steps[0].watch+' Barkodu okutun veya mevcut ürün listesinden seçim yapın.',missing:'Ürün alanı henüz açık değil. Önce sayımı ve tedarikçiyi kontrol edin.'},
 {title:'Fiziksel adet',selector:'[data-count-qty]',text:receivingLesson.steps[1].text,missing:'Henüz adet alanı yok. Önceki adımda doğru ürünü sayım satırına ekleyin.'}
]);

// Reuses PR27's pure target highlighting approach, not its session/backend.
function showTrainingTarget(target,{focus=false}={}){
 if(!target||target.isConnected===false||target.disabled)return ()=>{};
 const previous=target.getAttribute?.('aria-describedby');
 target.classList?.add('work-guide-target');
 target.setAttribute?.('aria-describedby',[previous,'receiving-guide-instruction'].filter(Boolean).join(' '));
 if(focus){target.scrollIntoView?.({block:'center',inline:'nearest'});target.focus?.({preventScroll:true});}
 return ()=>{target.classList?.remove('work-guide-target');if(previous===null||previous===undefined)target.removeAttribute?.('aria-describedby');else target.setAttribute?.('aria-describedby',previous);};
}

// Reads preparation state; owns only its small guide panel and highlight.
// It has no business callback, transport, form setter or simulated click.
export function createReceivingPreparationGuide({root,storage,readState}={}){
 let disposed=false,opened=false,identity=null,key=null,progress={step:0,reviewed:false},clearTarget=()=>{},storageFailed=false;
 const state=()=>{const value=readState?.();return value?.available===true?value:null;};
 function refresh({focus=false}={}){
  clearTarget();clearTarget=()=>{};
  if(disposed||!root?.isConnected)return;
  const value=state(),nextIdentity=value&&{scope:value.scope,userId:value.userId,lesson:'receiving'},nextKey=inlineProgressKey(nextIdentity??{}),slot=root.querySelector('[data-receiving-guide]');
  if(key!==nextKey){key=nextKey;identity=nextIdentity;opened=false;progress=readInlineProgress(storage,identity);storageFailed=false;}
  if(!slot)return;
  if(!value||!key){opened=false;slot.innerHTML='';slot.hidden=true;return;}
  slot.hidden=false;
  const step=preparationSteps[progress.step],target=opened&&!progress.reviewed?root.querySelector(step.selector):null,blocked=value.paused===true||target?.disabled===true;
  const ready=Boolean(target)&&value.ready?.[progress.step]===true&&!blocked;
  slot.innerHTML=opened?`<section class="work-inline-guide" aria-label="Gelen mal hazırlık rehberi"><div class="work-guide-heading"><b>${progress.reviewed?'Hazırlık adımları gözden geçirildi':`${progress.step+1} / ${preparationSteps.length} · ${escapeHtml(step.title)}`}</b><button type="button" class="btn" data-guide-close>Rehberi kapat</button></div><p id="receiving-guide-instruction" role="status" aria-live="polite">${escapeHtml(progress.reviewed?'Bu tur yalnız sayım hazırlığını gösterdi. Rehber kayıt, gönderim veya onay yapmadı.':blocked?'Bu alan şu anda işlem için kapalı. Mevcut işlemin bitmesini bekleyin veya yetkinizi kontrol edin.':!target?step.missing:step.text)}</p>${!progress.reviewed&&progress.step===2?`<p>${escapeHtml(receivingLesson.steps[0].stop)}</p>`:''}<p class="work-guide-note">${escapeHtml(progress.reviewed?trainingCompletionNotice:'Yalnız örnek kayıtlarla çalışın. Rehber düğmeleri formu veya kayıtları değiştirmez.')}</p>${storageFailed?'<p class="work-guide-note" role="status">Rehber adımı bu cihazda hatırlanamadı; bu oturumda devam edebilirsiniz.</p>':''}<div class="work-guide-actions"><button type="button" class="btn" data-guide-restart>Rehberi başa al</button>${progress.reviewed?'':`<button type="button" class="btn" data-guide-back ${progress.step===0?'disabled':''}>Önceki</button><button type="button" class="btn" data-guide-target ${!target||blocked?'disabled':''}>Alanı göster</button><button type="button" class="btn" data-guide-next ${!ready?'disabled':''}>${progress.step===preparationSteps.length-1?'Hazırlığı gözden geçirdim':'Sonraki'}</button>`}</div></section>`:'<button type="button" class="btn" data-guide-open>Ekranda adım adım göster</button>';
  const bind=(selector,action)=>{const button=slot.querySelector(selector);if(button)button.onclick=()=>change(action);};
  for(const action of ['open','close','restart','back','target','next'])bind(`[data-guide-${action}]`,action);
  if(opened&&!progress.reviewed&&!blocked)clearTarget=showTrainingTarget(target,{focus});
 }
 function change(action){
  if(disposed||!root?.isConnected)return;
  const value=state(),currentKey=inlineProgressKey(value&&{scope:value.scope,userId:value.userId,lesson:'receiving'}||{});
  if(!value||!key||key!==currentKey){refresh();return;}
  if(action==='open')opened=true;
  else if(action==='close')opened=false;
  else if(!opened)return;
  else if(action==='restart')progress={step:0,reviewed:false};
  else if(action==='back'&&!progress.reviewed)progress={step:Math.max(0,progress.step-1),reviewed:false};
  else if(action==='next'&&!progress.reviewed){
   const target=root.querySelector(preparationSteps[progress.step].selector);
   if(value.paused===true||!target||target.disabled||value.ready?.[progress.step]!==true){refresh();return;}
   progress=progress.step===preparationSteps.length-1?{step:progress.step,reviewed:true}:{step:progress.step+1,reviewed:false};
  }
  if(['restart','back','next'].includes(action))storageFailed=!saveInlineProgress(storage,identity,progress);
  refresh({focus:!['close'].includes(action)});
 }
 return {refresh,dispose(){disposed=true;opened=false;clearTarget();const slot=root?.querySelector('[data-receiving-guide]');if(slot){slot.innerHTML='';slot.hidden=true;}root=null;}};
}
