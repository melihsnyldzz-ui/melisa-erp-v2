import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDesktopCustomerCreate,createDesktopCustomerCreate} from './desktopCustomerCreate.mjs';
import {mountDesktopProductCreate} from './desktopProductCreate.mjs';

test('dirty customer fields block replacement until explicit discard; durable pending may leave the view but cannot be discarded',async()=>{
 const events={},nodes=new Map(),form={addEventListener:(name,fn)=>{events[name]=fn;}};let pending=null,cancels=0;const node=s=>{if(!nodes.has(s))nodes.set(s,{hidden:true,disabled:false,textContent:'',addEventListener:(name,fn)=>{events[s+name]=fn;}});return nodes.get(s);};const root={innerHTML:'',querySelector:s=>s==='[data-customer-form]'?form:node(s)};
 const view=mountDesktopCustomerCreate({root,controller:{pending:()=>pending,create:async()=>{},retry:async()=>{}},onCancel:()=>cancels++});assert.equal(view.requestClose(),true);events.input();assert.equal(view.requestClose(),false);const kept=root.innerHTML;events['[data-customer-cancel]click']();assert.equal(node('[data-customer-abandon]').hidden,false);assert.equal(root.innerHTML,kept);assert.equal(cancels,0);events['[data-customer-keep]click']();assert.equal(view.requestClose(),false);assert.equal(node('[data-customer-abandon]').hidden,true);events['[data-customer-cancel]click']();events['[data-customer-discard]click']();assert.equal(cancels,1);assert.equal(view.requestClose(),true);
 // A different tab's durable request cannot erase this view's unsaved fields.
 events.change();pending={customerCode:'C'};assert.equal(view.requestClose(),false);events['[data-customer-cancel]click']();events['[data-customer-discard]click']();assert.equal(cancels,2);assert.deepEqual(pending,{customerCode:'C'});view.dispose();
});

test('actual durable customer command survives UNKNOWN, closing and remount; only same-command success clears it and unreadable recovery blocks leaving',async()=>{
 const original=globalThis.FormData,values={customerCode:'C',name:'Ada',phone:'0000000001',city:'İzmir',country:'Türkiye',currency:'TRY',customerType:'customer'},data=new Map(),sent=[];let finish,newIds=0,mode='unknown';
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},requestId='d6be01f9-fac4-4e9c-b421-e2f070b6beb0';
 const controller=()=>createDesktopCustomerCreate({actorId:'7',storage,locks:{request:async(_k,_o,fn)=>fn({})},newId:()=>{newIds++;return requestId;},submit:async c=>{sent.push(c);if(mode==='unknown')return new Promise(resolve=>{finish=resolve;});return {state:'COMMITTED',requestId:c.requestId,operation:'customer.create',replayed:true,entity:{kind:'local',id:'4',entityId:'5',selectedCurrency:'TRY',accounts:[{id:'8',customerId:'4',currency:'TRY',currentBalanceExact8:'0.00000000'}]}};}});
 function ui(){const events={},form={addEventListener:(k,fn)=>{events[k]=fn;}},root={innerHTML:'',querySelector:s=>s==='[data-customer-form]'?form:{disabled:false,addEventListener:(k,fn)=>{events[s+k]=fn;}}};return {root,form,events};}
 globalThis.FormData=class{get(k){return values[k];}};
 try{
  const a=ui(),first=mountDesktopCustomerCreate({root:a.root,controller:controller()});a.events.input();a.events.submit({preventDefault(){},currentTarget:a.form});assert.equal(first.requestClose(),false);finish({state:'UNKNOWN'});await new Promise(resolve=>setImmediate(resolve));assert.equal(first.requestClose(),true);
  const persisted=[...data.entries()];first.dispose();const b=ui(),second=mountDesktopCustomerCreate({root:b.root,controller:controller()});assert.match(b.root.innerHTML,/C kodlu kaydın sonucu henüz kesin değil/);assert.equal(second.requestClose(),true);assert.deepEqual([...data.entries()],persisted);assert.equal(newIds,1);
  mode='success';b.events['[data-customer-retry]click']();await new Promise(resolve=>setImmediate(resolve));assert.equal(data.size,0);assert.deepEqual(sent[0],sent[1]);assert.equal(newIds,1);
  const broken=ui(),bad=mountDesktopCustomerCreate({root:broken.root,controller:{pending(){throw Error('unreadable');},create:async()=>{},retry:async()=>{}}});assert.equal(bad.requestClose(),false);
 }finally{globalThis.FormData=original;}
});

test('committed customer result permits parent list refresh while in-flight fields stay locked',async()=>{
 const original=globalThis.FormData,events={},group={disabled:false},status={textContent:''},button={disabled:false},form={addEventListener:(name,fn)=>{events[name]=fn;}};let finish,accepted=false,view;
 const values={customerCode:'C',name:'Ada',phone:'5',city:'Bursa',country:'Türkiye',currency:'TRY',customerType:'customer'};globalThis.FormData=class{get(k){return values[k];}};
 const root={innerHTML:'',querySelector(s){if(s==='[data-customer-form]')return form;if(s==='[data-customer-fields]')return group;if(s==='[role="status"]')return status;if(s.includes('button'))return button;return null;}};
 try{view=mountDesktopCustomerCreate({root,controller:{pending:()=>null,create:()=>new Promise(resolve=>{finish=resolve;}),retry:async()=>{}},onCommitted:()=>{assert.equal(view.requestClose(),true);accepted=true;view.dispose();}});events.input();events.submit({preventDefault(){},currentTarget:form});assert.equal(group.disabled,true);assert.equal(view.requestClose(),false);finish({state:'COMMITTED'});await new Promise(resolve=>setImmediate(resolve));assert.equal(accepted,true);}finally{globalThis.FormData=original;}
});

test('another tab pending before submit or between precheck and storage lock preserves this unsent form and the other exact command',async()=>{
 const original=globalThis.FormData,fields={customerCode:'A',name:'Ada',phone:'0000000001',city:'İzmir',country:'Türkiye',currency:'TRY',customerType:'customer'},other={...fields,customerCode:'B',name:'Başka sekme'};
 globalThis.FormData=class{get(k){return fields[k];}};
 try{for(const arrivesDuringSubmit of [false,true]){
  const data=new Map(),events={},nodes=new Map(),form={addEventListener:(k,fn)=>{events[k]=fn;}};let idsA=0,calls=0,cancelled=0,paints=0,html='';
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},locks={request:async(_k,_o,fn)=>fn({})};
  const common={actorId:'7',storage,locks,submit:async()=>{calls++;return {state:'UNKNOWN'};}},a=createDesktopCustomerCreate({...common,newId:()=>{idsA++;return 'd6be01f9-fac4-4e9c-b421-e2f070b6beb0';}}),b=createDesktopCustomerCreate({...common,newId:()=> '2d563464-cd1f-4348-8b18-449b327075e5'});
  const node=s=>{if(!nodes.has(s))nodes.set(s,{hidden:true,disabled:false,textContent:'',addEventListener:(k,fn)=>{events[s+k]=fn;}});return nodes.get(s);};
  const root={get innerHTML(){return html;},set innerHTML(v){html=v;paints++;},querySelector:s=>s==='[data-customer-form]'?form:node(s)};
  const controller=arrivesDuringSubmit?{...a,async create(v){await b.create(other);return a.create(v);}}:a;
  const view=mountDesktopCustomerCreate({root,controller,onCancel:()=>cancelled++});events.input();if(!arrivesDuringSubmit)await b.create(other);const originalHtml=html;
  events.submit({preventDefault(){},currentTarget:form});await new Promise(resolve=>setImmediate(resolve));assert.equal(html,originalHtml);assert.equal(paints,1);assert.match(node('[role="status"]').textContent,/bilgiler.*korunuyor/);assert.equal(view.requestClose(),false);assert.equal(idsA,0);assert.equal(calls,1);assert.equal(b.pending().customerCode,'B');const durable=[...data.entries()];
  events['[data-customer-cancel]click']();events['[data-customer-discard]click']();assert.equal(cancelled,1);assert.deepEqual([...data.entries()],durable);assert.equal(b.pending().requestId,'2d563464-cd1f-4348-8b18-449b327075e5');
 }}finally{globalThis.FormData=original;}
});

function harness(mount,kind,unknown){
 let pending=null,submit,paintCount=0,html='';const status={textContent:''},button={disabled:false};
 const form={values:kind==='customer'?{customerCode:'M1',name:'Ada',phone:'555',currency:'TRY',customerType:'customer',city:'İzmir',country:'Türkiye'}:{stockCode:'P1',name:'Ürün',barcode:'1',unit:'ADET',currency:'TRY',sale:'10',purchase:'5',discount:'0'},addEventListener:(_name,fn)=>{submit=fn;}};
 const root={set innerHTML(v){paintCount++;html=v;},get innerHTML(){return html;},querySelector(selector){if(selector.includes('data-')&&selector.includes('form'))return form;if(selector.includes('retry'))return {addEventListener(){}};if(selector==='[role="status"]')return status;if(selector.includes('button'))return button;return null;}};
 const controller={pending:()=>pending,create:async()=>{if(unknown){pending=kind==='customer'?{customerCode:'M1'}:{stockCode:'P1'};return {state:'UNKNOWN'};}throw Error('synthetic error');},retry:async()=>{}};
 mount({root,controller});return {root,form,status,button,run:()=>submit({preventDefault(){},currentTarget:form}),get paintCount(){return paintCount;}};
}
test('local failure keeps customer and product input; uncertain request still opens recovery',async()=>{
 const original=globalThis.FormData;globalThis.FormData=class {constructor(form){this.values=form.values;}get(k){return this.values[k];}};
 try{for(const [mount,kind] of [[mountDesktopCustomerCreate,'customer'],[mountDesktopProductCreate,'product']]){
  const local=harness(mount,kind,false);local.run();await new Promise(resolve=>setImmediate(resolve));assert.equal(local.paintCount,1);assert.equal(local.form.values.name,kind==='customer'?'Ada':'Ürün');assert.match(local.status.textContent,/alanları kontrol/);
  const unknown=harness(mount,kind,true);unknown.run();await new Promise(resolve=>setImmediate(resolve));assert.equal(unknown.paintCount,2);assert.match(unknown.root.innerHTML,/aynı istekle yeniden doğrulayın/i);
 }}finally{globalThis.FormData=original;}
});

test('product fields are locked while a request is in flight and unlocked after the result',async()=>{
 const original=globalThis.FormData;let submit,finish;
 const group={disabled:false},button={disabled:false},status={textContent:''},form={addEventListener:(_event,fn)=>{submit=fn;}};
 const fields={stockCode:'P1',name:'Ürün',barcode:'1',unit:'ADET',currency:'TRY',sale:'10',purchase:'5',discount:'0'};
 globalThis.FormData=class{get(k){return fields[k]??null;}};
 const root={innerHTML:'',querySelector(s){if(s==='[data-product-form]')return form;if(s==='[data-product-fields]')return group;if(s==='[role="status"]')return status;if(s.includes('button'))return button;return null;}};
 try{
  mountDesktopProductCreate({root,controller:{pending:()=>null,create:()=>new Promise(resolve=>{finish=resolve;}),retry:async()=>{}}});
  submit({preventDefault(){},currentTarget:form});assert.equal(group.disabled,true);
  finish({state:'UNKNOWN'});await new Promise(resolve=>setImmediate(resolve));assert.equal(group.disabled,false);
 }finally{globalThis.FormData=original;}
});
