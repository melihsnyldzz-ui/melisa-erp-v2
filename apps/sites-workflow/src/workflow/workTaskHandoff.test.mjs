import test from 'node:test';
import assert from 'node:assert/strict';
import {workTaskHandoff,createReceivingPreparationGuide} from './workTaskHandoff.mjs';
import {readProgress,saveInlineProgress,readInlineProgress} from '../training-guide/progress.mjs';

test('handoff explains counting, authorized approval and accounting review without adding actions',()=>{
 for(const lesson of ['receiving','purchase','count']){
  const html=workTaskHandoff(lesson);
  assert.equal((html.match(/<li>/g)||[]).length,3);
  assert.match(html,/<b>Personel<\/b>/);
  assert.match(html,/<b>İlker<\/b>/);
  assert.match(html,/<b>Muhasebe<\/b>/);
  assert.match(html,new RegExp(`/kullanim-egitimi.html#${lesson}`));
  assert.doesNotMatch(html,/<(?:form|button|input)|on(?:click|submit)=|\/api\//);
 }
 assert.match(workTaskHandoff('count'),/Sayım onayı stok yetkilisindedir/);
 assert.match(workTaskHandoff('purchase'),/mevcut yetkili kişi kesinleştirir/);
});

test('sale help preserves the customer-first workflow and unknown lessons render nothing',()=>{
 const html=workTaskHandoff('sale');
 assert.ok(html.indexOf('Müşteriyi seçin')<html.indexOf('Barkodu okutun'));
 assert.match(html,/Adedi, fiyatı ve dövizi kontrol edin/);
 assert.match(html,/kullanim-egitimi.html#sale/);
 assert.equal(workTaskHandoff('unknown'), '');
 assert.equal(workTaskHandoff('<script>'), '');
 assert.equal(workTaskHandoff('toString'), '');
 assert.equal(workTaskHandoff('__proto__'), '');
 assert.equal(workTaskHandoff(null), '');
});

function guideFixture(){
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const current={available:true,userId:15,scope:'test-a',paused:false,ready:[false,false,false,false]};
 const targets=new Map(),selectors=['[data-count-new]','[data-count-supplier]','[data-count-scan] input[name="scan"], [data-count-product]','[data-count-qty]'];
 for(const selector of selectors){const attrs=new Map([['aria-describedby','existing-help']]),classes=new Set();targets.set(selector,{isConnected:true,disabled:false,value:'preserve-value',attrs,classes,focuses:0,scrolls:0,click(){throw Error('Guide must never click business controls');},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},getAttribute:key=>attrs.get(key)??null,setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key),focus(){this.focuses++;},scrollIntoView(){this.scrolls++;}});}
 let html='',controls=new Map();
 const slot={hidden:false,get innerHTML(){return html;},set innerHTML(value){html=value;controls=new Map();},querySelector(selector){const name=selector.slice(1,-1);if(!html.includes(name))return null;if(!controls.has(name))controls.set(name,{disabled:new RegExp(name+' disabled').test(html),onclick:null});return controls.get(name);}};
 const root={isConnected:true,querySelector:selector=>selector==='[data-receiving-guide]'?slot:targets.get(selector)??null};
 const guide=createReceivingPreparationGuide({root,storage,readState:()=>current});
 const button=action=>slot.querySelector(`[data-guide-${action}]`),click=action=>{const b=button(action);assert.ok(b,action);assert.equal(b.disabled,false,action);b.onclick();};
 return {guide,current,slot,targets,selectors,storage,values,button,click};
}

test('inline guide follows four real preparation fields without invoking controls or completing the whole lesson',()=>{
 const f=guideFixture();f.guide.refresh();assert.match(f.slot.innerHTML,/adım adım/);f.click('open');
 assert.match(f.slot.innerHTML,/1 \/ 4 · Yeni sayım/);assert.equal(f.button('next').disabled,true);
 const first=f.targets.get(f.selectors[0]);assert.equal(first.classes.has('work-guide-target'),true);assert.equal(first.focuses,1);
 for(let step=0;step<3;step++){f.current.ready[step]=true;f.guide.refresh();f.click('next');assert.match(f.slot.innerHTML,new RegExp(`${step+2} / 4`));assert.equal(f.targets.get(f.selectors[step]).classes.has('work-guide-target'),false);}
 assert.equal(first.attrs.get('aria-describedby'),'existing-help');assert.equal(f.button('next').disabled,true);
 f.current.ready[3]=true;f.guide.refresh();f.click('next');assert.match(f.slot.innerHTML,/Rehber kayıt, gönderim veya onay yapmadı/);assert.match(f.slot.innerHTML,/gerçek işyeri veya cihaz kabulü değildir/);
 assert.deepEqual(readProgress(f.storage),{completed:[]});assert.equal(readInlineProgress(f.storage,{scope:'test-a',userId:15,lesson:'receiving'}).reviewed,true);
 for(const target of f.targets.values())assert.equal(target.value,'preserve-value');
 f.click('close');f.click('open');assert.match(f.slot.innerHTML,/Hazırlık adımları gözden geçirildi/);
 f.click('restart');assert.match(f.slot.innerHTML,/1 \/ 4/);assert.deepEqual(readInlineProgress(f.storage,{scope:'test-a',userId:15,lesson:'receiving'}),{step:0,reviewed:false});
 f.click('close');assert.equal(first.classes.has('work-guide-target'),false);f.guide.dispose();
});

test('missing and temporarily disabled fields give guidance and cannot advance',()=>{
 const f=guideFixture();saveInlineProgress(f.storage,{scope:'test-a',userId:15,lesson:'receiving'},{step:3,reviewed:false});f.targets.delete(f.selectors[3]);f.current.ready=[true,true,true,true];f.guide.refresh();f.click('open');
 assert.match(f.slot.innerHTML,/Henüz adet alanı yok/);assert.equal(f.button('next').disabled,true);assert.equal(f.button('target').disabled,true);
 f.click('back');assert.match(f.slot.innerHTML,/3 \/ 4/);const product=f.targets.get(f.selectors[2]);product.disabled=true;f.guide.refresh();assert.match(f.slot.innerHTML,/işlem için kapalı/);assert.equal(f.button('next').disabled,true);assert.equal(product.classes.has('work-guide-target'),false);
 product.disabled=false;f.current.paused=true;f.guide.refresh();assert.equal(f.button('next').disabled,true);f.guide.dispose();
});

test('account change, lost permission and disposal clear another account step and highlight',()=>{
 const f=guideFixture();f.current.ready=[true,true,true,true];f.guide.refresh();f.click('open');f.click('next');const oldNext=f.button('next').onclick;
 f.current.userId=16;oldNext();assert.match(f.slot.innerHTML,/adım adım/);assert.doesNotMatch(f.slot.innerHTML,/2 \/ 4/);f.click('open');assert.match(f.slot.innerHTML,/1 \/ 4/);
 const staleNext=f.button('next').onclick;f.current.available=false;staleNext();assert.equal(f.slot.innerHTML,'');assert.equal(f.slot.hidden,true);
 for(const target of f.targets.values())assert.equal(target.classes.has('work-guide-target'),false);
 f.current.available=true;f.guide.refresh();f.click('open');const staleRestart=f.button('restart').onclick;f.guide.dispose();const before=JSON.stringify([...f.values]);staleRestart();assert.equal(f.slot.innerHTML,'');assert.equal(JSON.stringify([...f.values]),before);
});

test('storage refusal does not affect form controls and only receiving opts into the inline panel',()=>{
 const f=guideFixture();f.storage.setItem=()=>{throw Error('unavailable');};f.current.ready[0]=true;f.guide.refresh();f.click('open');f.click('next');assert.match(f.slot.innerHTML,/bu oturumda devam edebilirsiniz/);assert.match(f.slot.innerHTML,/2 \/ 4/);f.guide.dispose();
 assert.match(workTaskHandoff('receiving',{inlineGuide:true}),/data-receiving-guide/);
 for(const lesson of ['receiving','sale','purchase','count'])assert.doesNotMatch(workTaskHandoff(lesson),/data-receiving-guide/);
 assert.doesNotMatch(workTaskHandoff('sale',{inlineGuide:true}),/data-receiving-guide/);
});
