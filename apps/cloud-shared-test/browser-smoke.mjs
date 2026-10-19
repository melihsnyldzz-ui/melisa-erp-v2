// Optional real-browser smoke. All data and the server are disposable synthetic fixtures.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {startCloudServer,loadAssets} from './server.mjs';
const [erpBuild,crmBuild,playwrightEntry,chromiumPath,output]=process.argv.slice(2);
if(!output)throw Error('Usage: node browser-smoke.mjs <ERP build> <CRM build> <playwright-core/index.mjs> <Chromium executable> <evidence directory>');
const {chromium}=await import(pathToFileURL(resolve(playwrightEntry)).href);
await mkdir(output,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'melisa-browser-synthetic-'));
const database=join(temp,'synthetic.sqlite');
const assets=await loadAssets({'/erp/':erpBuild,'/crm/':crmBuild});
let host=await startCloudServer({database,assets});
const browser=await chromium.launch({executablePath:chromiumPath,headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
const role=async(id)=>{await page.getByLabel('Sentetik TEST hesabı',{exact:true}).selectOption(String(id));await page.getByRole('button',{name:'Sentetik oturumu aç'}).click();await page.getByRole('status').filter({hasText:String(id)}).first().waitFor();};
const readback=()=>page.evaluate(async()=>{const s=(await(await fetch('/api/cloud-test/session')).json()).data;const r=await fetch('/api/cloud-test/snapshot',{headers:{Authorization:'Bearer '+s.accessToken}});if(!r.ok)throw Error('Snapshot denied');return(await r.json()).data;});
try{
 await page.goto(host.origin+'/terminal/');await role(15);
 await page.locator('[data-count-new]').click();await page.locator('[data-count-supplier]').selectOption('601');await page.locator('[data-count-scan] input').fill('8690000000101');await page.locator('[data-count-scan] button').click();await page.locator('[data-count-qty]').fill('4');await page.locator('[data-count-save]').click();await page.locator('[data-count-submit]:not([disabled])').waitFor();await page.locator('[data-count-submit]').click();await page.getByText('Kontrole gönderildi',{exact:true}).first().waitFor();
 assert.equal((await readback()).products[0].stock3,10000);
 await page.goto(host.origin+'/erp/');await role(16);await page.locator('[data-count-approve]').click();await page.getByText('Kabul #1 · Kabul edildi',{exact:true}).waitFor();assert.equal((await readback()).products[0].stock3,14000);await page.screenshot({path:join(output,'receiving-approved.png'),fullPage:true});
 await page.goto(host.origin+'/crm/');await role(17);await page.getByRole('button',{name:'Kataloğu aç',exact:true}).click();await page.getByRole('button',{name:'SYN-101 Sentetik Ürün A seç',exact:true}).click();await page.getByRole('button',{name:'ERP sipariş taslağı',exact:true}).click();await page.getByLabel('ERP kullanıcı adı',{exact:true}).fill('synthetic');await page.getByLabel('ERP parolası',{exact:true}).fill('synthetic');await page.getByRole('button',{name:"ERP'ye bağlan",exact:true}).click();await page.getByRole('combobox',{name:'ERP müşterisi'}).waitFor();await page.getByRole('dialog').locator('input[type=number]').fill('2');await page.getByRole('button',{name:'ERP taslağını oluştur',exact:true}).click();await page.getByRole('button',{name:'Yeni sipariş taslağı',exact:true}).waitFor();
 let state=await readback();assert.equal(state.orders.length,1);assert.equal(state.sales.length,0);assert.equal(state.products[0].stock3,14000);assert.equal(state.customers[0].balance4,0);await page.screenshot({path:join(output,'crm-draft.png'),fullPage:true});
 await page.getByRole('dialog').getByRole('button',{name:'Kapat',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Taslağı sunucudan aç',exact:true}).click();await page.getByText('ERP’de kayıtlı sipariş taslağı: SYN-CRM-2',{exact:true}).waitFor();
 await page.goto(host.origin+'/erp/');await role(15);await page.locator('[data-cloud-view=crm]').click();await page.locator('[data-cloud-convert]').click();await page.locator('[data-sale-finalize]').waitFor();state=await readback();assert.equal(state.customers[0].balance4,0);assert.equal(state.products[0].stock3,14000);
 await page.locator('[data-sale-finalize]').click();await page.locator('[data-sale-collect]').waitFor();state=await readback();assert.equal(state.products[0].stock3,12000);assert.equal(state.customers[0].balance4,500000);
 await role(16);await page.locator('[data-cloud-view=collections]').click();await page.locator('[data-collection-select]').click();await page.locator('[data-collection-account]').selectOption('701');await page.locator('[data-collection-amount]').fill('20');await page.locator('[data-collection-date]').fill('2026-10-19');await page.locator('[data-collection-preview]').click();await page.locator('[data-collection-save]').click();await page.getByText('Müşteri bakiyesi: 30,00 TRY',{exact:false}).waitFor();assert.equal(await page.getByText('Müşteri bilgisi doğrulanamadı',{exact:false}).count(),0);await page.screenshot({path:join(output,'partial-collection.png'),fullPage:true});
 await page.reload();await page.locator('[data-cloud-view=collections]').click();await page.locator('[data-collection-select]').click();await page.getByText('Müşteri bakiyesi: 30,00 TRY',{exact:false}).waitFor();
 state=await readback();assert.equal(state.products[0].stock3,12000);assert.equal(state.customers[0].balance4,300000);assert.equal(state.sales[0].collections.length,1);assert.equal(state.journal.length,7);
 await host.close();host=await startCloudServer({database,assets});await page.goto(host.origin+'/erp/');await role(16);assert.deepEqual(await readback(),state);
 await role(18);const other=await readback();assert.equal(other.orders.length,0);assert.equal(other.sales.length,0);assert.deepEqual(other.customers.map(c=>c.id),[502]);
 assert.deepEqual(pageErrors,[]);
 const evidence={synthetic:true,viewport:{width:390,height:844},passed:['receiving-count-submit-approval','actual-crm-catalog-native-draft','crm-draft-reopen','erp-order-sale-finalize','partial-collection','page-reload','server-and-sqlite-reopen','other-personnel-scope'],stock3:state.products[0].stock3,balance4:state.customers[0].balance4,journal:state.journal.length,counts:state.counts.length,orders:state.orders.length,sales:state.sales.length,collections:state.sales[0].collections.length,pageErrors};
 await writeFile(join(output,'result.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{await browser.close();await host.close();}
