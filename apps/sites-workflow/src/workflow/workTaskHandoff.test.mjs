import test from 'node:test';
import assert from 'node:assert/strict';
import {workTaskHandoff} from './workTaskHandoff.mjs';

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
