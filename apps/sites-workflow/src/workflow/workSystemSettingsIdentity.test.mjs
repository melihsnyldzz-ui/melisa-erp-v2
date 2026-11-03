import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function controller(){
 const source=(await readFile(new URL('./workSystemSettings.js',import.meta.url),'utf8'))
  .replace("import './workReports.css';",'')
  .replace("'./workSystemSettingsModel.mjs'",JSON.stringify(new URL('./workSystemSettingsModel.mjs',import.meta.url).href));
 return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createWorkSystemSettings;
}
function summary(displayName){return {environment:'TEST',package:{sourceCommit:'3531ba42',packageId:'OFFLINE-IDENTITY'},currentUser:{id:15,displayName,roleCodes:['sales'],permissionsSummary:['Ürün görüntüleme']},services:[{id:'api',label:'API',status:'ready',checkedAt:'2026-11-03T00:00:00Z'}],terminal:{webReady:true,physicalAcceptance:'pending',lastAccessAt:null},backup:{status:'unknown',lastSuccessAt:null,sizeBytes:null,checksumVerified:null},restore:{status:'unknown',lastSuccessAt:null,sourceDatabaseMatched:null,criticalDataMatched:null},autostart:{erp:{status:'configured',lastCheckAt:null},crm:{status:'unknown',lastCheckAt:null}}};}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
async function mount(data){
 const create=await controller(),button={},calls=[],root={isConnected:true,innerHTML:'',querySelector:()=>button};
 let current=data;
 const ui=create({root,session:{system:async(path,options)=>{calls.push({path,options});return current;}}});ui.mount();await tick();
 return {root,ui,calls,button,setData(value){current=value;}};
}
const userLabel=html=>/<span>Kullanıcı<\/span><b>([\s\S]*?)<\/b>/.exec(html)?.[1];

// Invented fixture labels exercise real name spellings containing the old substrings.
for(const name of ['Demosthenes Papadopoulos','Demokritos','Luca Testa','Maria Testoni','Andrea Contesti','Protesta','DeMoSTHENES','TEST','DEMO','DEBUG','Örnek TEST DEMO DEBUG Kullanıcısı','  Demosthenes  '])test(`settings preserves the authenticated display label ${JSON.stringify(name)}`,async()=>{
 const dto=freeze(summary(name)),before=JSON.stringify(dto),h=await mount(dto);
 try{
  assert.equal(userLabel(h.root.innerHTML),name);assert.equal(JSON.stringify(dto),before);
  assert.deepEqual(h.calls,[{path:'/api/work-system/summary',options:undefined}]);
  assert.match(h.root.innerHTML,/Satış/);assert.doesNotMatch(h.root.innerHTML,/Kaydet|type="password"|data-system-(?:save|restore|user)/);
 }finally{h.ui.dispose();}
});

for(const name of ['', '   ', '\t\n'])test(`blank display label ${JSON.stringify(name)} retains the neutral fallback`,async()=>{
 const dto=freeze(summary(name)),h=await mount(dto);
 try{assert.equal(userLabel(h.root.innerHTML),'Kullanıcı');assert.equal(dto.currentUser.displayName,name);assert.deepEqual(dto.currentUser.roleCodes,['sales']);}finally{h.ui.dispose();}
});

test('name is escaped once as text and its contents cannot add markup or privilege',async()=>{
 const name='Demosthenes <img src=x onerror="DEBUG()"> & \'TEST\'',dto=freeze(summary(name)),h=await mount(dto);
 try{
  assert.equal(userLabel(h.root.innerHTML),'Demosthenes &lt;img src=x onerror=&quot;DEBUG()&quot;&gt; &amp; &#39;TEST&#39;');
  assert.doesNotMatch(h.root.innerHTML,/<img|<script|&amp;lt;/);assert.deepEqual(dto.currentUser,{id:15,displayName:name,roleCodes:['sales'],permissionsSummary:['Ürün görüntüleme']});
  assert.match(h.root.innerHTML,/Satış/);assert.doesNotMatch(h.root.innerHTML,/Yönetici|Kabul edildi/);
 }finally{h.ui.dispose();}
});

test('a display name change affects only the rendered user line after a readonly refresh',async()=>{
 const first=freeze(summary('Ali Örnek')),second=freeze(summary('Demosthenes')),h=await mount(first);
 try{
  const html=h.root.innerHTML;h.setData(second);await h.button.onclick();
  assert.equal(userLabel(h.root.innerHTML),'Demosthenes');assert.equal(h.root.innerHTML,html.replace('<span>Kullanıcı</span><b>Ali Örnek</b>','<span>Kullanıcı</span><b>Demosthenes</b>'));
  assert.deepEqual(h.calls,Array.from({length:2},()=>({path:'/api/work-system/summary',options:undefined})));
  assert.deepEqual(first.currentUser.roleCodes,second.currentUser.roleCodes);assert.equal(first.currentUser.id,second.currentUser.id);
 }finally{h.ui.dispose();}
});

for(const badName of [null,15,{},['Demosthenes']])test(`existing summary validation rejects ${JSON.stringify(badName)} without fabricating an identity`,async()=>{
 const h=await mount(summary(badName));
 try{assert.equal(userLabel(h.root.innerHTML),undefined);assert.match(h.root.innerHTML,/Sistem durumu şu anda okunamıyor/);assert.equal(h.calls.length,1);}finally{h.ui.dispose();}
});

test('a denied refresh clears the prior name and statuses instead of presenting another identity',async()=>{
 const create=await controller(),root={isConnected:true,innerHTML:'',querySelector:()=>button},button={};let deny=false,calls=0;
 const ui=create({root,session:{system:async()=>{calls++;if(deny)throw {status:403};return summary('Demosthenes');}}});
 try{ui.mount();await tick();assert.equal(userLabel(root.innerHTML),'Demosthenes');deny=true;await button.onclick();assert.equal(userLabel(root.innerHTML),undefined);assert.match(root.innerHTML,/yetkiniz yok/);assert.doesNotMatch(root.innerHTML,/Demosthenes|system-service ready/);assert.equal(calls,2);}finally{ui.dispose();}
});
