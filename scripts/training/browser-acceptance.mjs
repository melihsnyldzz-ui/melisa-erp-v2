import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.TRAINING_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.TRAINING_PLAYWRIGHT_MODULE).href : 'playwright');
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=process.argv[2]??'C:/Sirket/ERP/training-mode/screenshots';mkdirSync(dir,{recursive:true});
const health=await (await fetch('http://127.0.0.1:5214/api/health')).json();
assert.equal(health.mode,'training');assert.equal(health.application,'MELISA_ERP_TRAINING_ONLY');assert.equal(health.trainingDatabase,true);
const browser=await chromium.launch({headless:true,channel:'msedge'});
const results=[];
for(const device of [{name:'desktop',viewport:{width:1440,height:1000}},{name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true}]){
 const context=await browser.newContext(device);const page=await context.newPage();const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 const state=async()=>await (await page.request.get('http://127.0.0.1:5214/api/training/state')).json();
 const shot=async(step)=>{await page.screenshot({path:`${dir}/${device.name}-step${step}.png`,fullPage:true});};
 try{
  await page.goto('http://127.0.0.1:5214/egitim.html');await page.locator('[data-screen="goods"]').waitFor();await shot(1);
  await page.locator('[data-screen="goods"]').click();await page.locator('[data-count-new]').waitFor();
  await page.locator('[data-count-new]').click();await page.locator('[data-count-supplier]').selectOption('1');
  for(const [id,qty] of [['32811','2'],['40766','3']]){await page.locator('[data-count-product]').selectOption(id);await page.locator('[data-count-add-product]').click();const inputs=page.locator('[data-count-qty]');await inputs.last().fill(qty);}
  await page.locator('[data-show-target]').click();await shot(2);await page.locator('[data-count-save]').click();await page.locator('[data-count-submit]').waitFor();await page.locator('[data-count-submit]').click();
  await page.waitForFunction(()=>document.querySelector('[data-guide]')?.innerText.includes('ADIM 3')||document.body.innerText.includes('ADIM 3 / 5'));await shot(3);
  assert.equal((await state()).products[0].currentQuantity,'10.000');
  await page.locator('[data-count-approve]').click();await page.locator('[data-count-purchase]').waitFor();await shot(3);
  await page.locator('[data-count-purchase]').click();await page.locator('[data-purchase-entry]').waitFor();
  await page.locator('[data-purchase-receipt]').selectOption({index:1});
  await page.locator('[data-purchase-entry] input[name="number"]').fill('TSTB-EGITIM-001');
  await page.locator('[data-purchase-entry] input[name="date"]').fill('2026-10-09');
  const quantities=page.locator('[data-purchase-qty]');await quantities.nth(0).fill('2');await quantities.nth(1).fill('3');
  await page.locator('[data-purchase-preview]').click();await page.locator('[data-purchase-create]').waitFor();await page.locator('[data-purchase-create]').click();await page.locator('[data-purchase-finalize]').waitFor();
  await page.locator('[data-purchase-finalize]').click();await page.waitForFunction(()=>document.body.innerText.includes('Fatura tedarikçi borcuna işlendi'));await shot(4);
  await page.locator('[data-purchase-supplier]').click();await page.locator('.training-quiz').waitFor();await shot(5);
  await page.locator('[data-quiz-answer][name="stock"][value="save"]').check();await page.waitForFunction(()=>document.body.innerText.includes('Sayım kaydı adetleri saklar'));
  assert.equal(await page.locator('[data-complete-quiz]').isDisabled(),true);
  for(const [name,value] of [['stock','approval'],['invoice','once'],['debt','supplier']]){await page.locator(`[data-quiz-answer][name="${name}"][value="${value}"]`).check();await page.waitForFunction(([name,value])=>document.querySelector(`[data-quiz-answer][name="${name}"][value="${value}"]`)?.checked,[name,value]);await page.waitForFunction(()=>!document.querySelector('[data-quiz-answer]')?.disabled);}
  await page.locator('[data-complete-quiz]').click();await page.locator('.training-success').waitFor();
  const final=await state();assert.deepEqual(final.progress.completedSteps,[1,2,3,4,5]);assert.deepEqual(final.products.map(p=>p.currentQuantity),['12.000','13.000']);assert.equal(final.debt,'500.0000');
  await page.reload();await page.locator('.training-success').waitFor();assert.equal((await state()).exerciseId,final.exerciseId);
  await page.screenshot({path:`${dir}/${device.name}-completed.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(errors.length,0);assert.equal(requests.some(u=>!u.startsWith('http://127.0.0.1:5214/')),false);
  await page.locator('[data-back]').click();await page.waitForFunction(()=>document.body.innerText.includes('ADIM 4 / 5'));assert.equal((await state()).debt,final.debt);
  await page.locator('[data-repeat]').click();await page.waitForFunction(()=>document.body.innerText.includes('ADIM 1 / 5'));
  const repeated=await state();assert.notEqual(repeated.exerciseId,final.exerciseId);assert.deepEqual(repeated.products.map(p=>p.currentQuantity),['10.000','10.000']);assert.equal(repeated.debt,'0.0000');
  results.push({device:device.name,status:'PASS',exerciseId:final.exerciseId,stock:final.products.map(p=>p.currentQuantity),debt:final.debt,completedSteps:final.progress.completedSteps,resume:true,back:true,repeat:true,browserErrors:errors,externalRequests:0,overflow:false});
 }catch(e){await page.screenshot({path:`${dir}/${device.name}-failure.png`,fullPage:true});console.log(await page.locator('body').innerText());throw e;}finally{await context.close();}
}
writeFileSync(dir+'/browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();
