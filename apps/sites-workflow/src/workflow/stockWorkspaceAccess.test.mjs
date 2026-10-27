import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

async function workspace({permissions=['product.view'], authPending=null}={}) {
  const calls=[], events={}, elements=new Map();
  let binds=0;
  const element=id=>{
    if(!elements.has(id)) elements.set(id,{innerHTML:'',textContent:'',style:{},options:id==='mobileScreen'?['home','stock','sales'].map(value=>({value})):[],value:'home',querySelectorAll:()=>[],addEventListener(){}});
    return elements.get(id);
  };
  const location={hash:'#stock',hostname:'127.0.0.1',protocol:'http:',port:'5194'};
  const context=vm.createContext({location,console,URLSearchParams,FormData,AbortSignal,Date,
    sessionStorage:{getItem:key=>key==='melisaTestSessionMode'?'manual':null,setItem(){},removeItem(){}},localStorage:{getItem:()=>null},
    window:{addEventListener:(name,handler)=>events[name]=handler},
    document:{getElementById:element,querySelector:element,title:''},
    fetch:async url=>{
      calls.push(url);
      if(!url.endsWith('/api/auth/me')) throw Error('Unrelated sales/finance service deliberately unavailable');
      if(authPending) await (typeof authPending==='function'?authPending(calls.length):authPending);
      return {ok:true,json:async()=>({success:true,data:{id:1,displayName:'Synthetic reader',permissions,role:{name:'Reader'}}})};
    }});
  const source=readFileSync(new URL('./testSales.js',import.meta.url),'utf8');
  const main=new vm.SourceTextModule(source+'\nexport {refresh,render};',{context,initializeImportMeta:meta=>meta.env={VITE_API_BASE_URL:'http://127.0.0.1:4144'}});
  await main.link(specifier=>{
    if(['./testAdminSession.mjs','./cleanSyntheticCatalogModel.mjs','./businessWorkface.mjs'].includes(specifier))return new vm.SourceTextModule(readFileSync(new URL(specifier,import.meta.url),'utf8'),{context});
    const exports=specifier.endsWith('.css')?[]:[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)].filter(m=>m[2]===specifier).flatMap(m=>m[1].split(',').map(x=>x.trim()));
    return new vm.SyntheticModule(exports,function(){for(const name of exports){
      const fn=name==='createStockProducts'?({permissions:p})=>({html:()=>p.includes('product.view')?'STOCK_READ_WORKSPACE':'STOCK_PERMISSION_DENIED',bind:()=>binds++,dispose(){}}):()=>{throw Error('Unrelated module invoked: '+name);};
      this.setExport(name,fn);
    }},{context});
  });
  await main.evaluate();
  return {calls,events,elements,location,element,main,binds:()=>binds};
}

test('normal stock page restores stock-only session despite unavailable sales and finance',async()=>{
  const w=await workspace();await w.main.namespace.refresh();w.main.namespace.render();
  assert.deepEqual(w.calls,['http://127.0.0.1:4144/api/auth/me']);
  assert.match(w.element('view').innerHTML,/STOCK_READ_WORKSPACE/);assert.equal(w.binds(),1);
  assert.match(w.element('view').innerHTML,/Ürün kartları · Salt okunur/);
  assert.doesNotMatch(w.element('view').innerHTML,/Bağlantı doğrulanamadı/);
  assert.equal(w.element('mobileScreen').value,'stock');
});

test('stock page retains permission-denied view without unrelated privileged requests',async()=>{
  const w=await workspace({permissions:['customer.edit']});await w.main.namespace.refresh();w.main.namespace.render();
  assert.equal(w.calls.length,1);assert.match(w.element('view').innerHTML,/STOCK_PERMISSION_DENIED/);
});

test('leaving stock-only startup requires normal sales initialization and never renders missing stock',async()=>{
  const w=await workspace();await w.main.namespace.refresh();w.main.namespace.render();
  w.location.hash='#sales';w.events.hashchange();
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(w.calls.some(url=>url.endsWith('/api/test-sales/context')));
  assert.match(w.element('view').innerHTML,/TEST verileri doğrulanamadı/);
  assert.doesNotMatch(w.element('view').innerHTML,/STOCK_READ_WORKSPACE/);
  assert.equal(w.element('mobileScreen').value,'sales');
});

test('logout while authentication is pending prevents stale stock session restoration',async()=>{
  let resolve;const authPending=new Promise(r=>resolve=r);
  const w=await workspace({authPending:n=>n===2?authPending:null});
  await w.main.namespace.refresh();w.main.namespace.render();
  const lateRefresh=w.main.namespace.refresh();
  w.element('test-logout').onclick();resolve();await lateRefresh;w.main.namespace.render();
  assert.match(w.element('view').innerHTML,/TEST kullanıcısını değiştir/);
});
