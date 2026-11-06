import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDesktopCustomerCreate} from './desktopCustomerCreate.mjs';
import {mountDesktopProductCreate} from './desktopProductCreate.mjs';

test('dirty customer fields block card/navigation replacement until explicit discard; pending request cannot be abandoned',async()=>{
 const events={},nodes=new Map(),form={addEventListener:(name,fn)=>{events[name]=fn;}};let pending=null,cancels=0;const node=s=>{if(!nodes.has(s))nodes.set(s,{hidden:true,disabled:false,textContent:'',addEventListener:(name,fn)=>{events[s+name]=fn;}});return nodes.get(s);};const root={innerHTML:'',querySelector:s=>s==='[data-customer-form]'?form:node(s)};
 const view=mountDesktopCustomerCreate({root,controller:{pending:()=>pending,create:async()=>{},retry:async()=>{}},onCancel:()=>cancels++});assert.equal(view.requestClose(),true);events.input();assert.equal(view.requestClose(),false);const kept=root.innerHTML;events['[data-customer-cancel]click']();assert.equal(node('[data-customer-abandon]').hidden,false);assert.equal(root.innerHTML,kept);assert.equal(cancels,0);events['[data-customer-keep]click']();assert.equal(view.requestClose(),false);assert.equal(node('[data-customer-abandon]').hidden,true);events['[data-customer-cancel]click']();events['[data-customer-discard]click']();assert.equal(cancels,1);assert.equal(view.requestClose(),true);
 events.change();pending={customerCode:'C'};assert.equal(view.requestClose(),false);events['[data-customer-discard]click']();assert.equal(cancels,1);view.dispose();
});

test('committed customer result permits parent list refresh while in-flight fields stay locked',async()=>{
 const original=globalThis.FormData,events={},group={disabled:false},status={textContent:''},button={disabled:false},form={addEventListener:(name,fn)=>{events[name]=fn;}};let finish,accepted=false,view;
 const values={customerCode:'C',name:'Ada',phone:'5',city:'Bursa',country:'Türkiye',currency:'TRY',customerType:'customer'};globalThis.FormData=class{get(k){return values[k];}};
 const root={innerHTML:'',querySelector(s){if(s==='[data-customer-form]')return form;if(s==='[data-customer-fields]')return group;if(s==='[role="status"]')return status;if(s.includes('button'))return button;return null;}};
 try{view=mountDesktopCustomerCreate({root,controller:{pending:()=>null,create:()=>new Promise(resolve=>{finish=resolve;}),retry:async()=>{}},onCommitted:()=>{assert.equal(view.requestClose(),true);accepted=true;view.dispose();}});events.input();events.submit({preventDefault(){},currentTarget:form});assert.equal(group.disabled,true);assert.equal(view.requestClose(),false);finish({state:'COMMITTED'});await new Promise(resolve=>setImmediate(resolve));assert.equal(accepted,true);}finally{globalThis.FormData=original;}
});

function harness(mount,kind,unknown){
 let pending=null,submit,paintCount=0,html='';const status={textContent:''},button={disabled:false};
 const form={values:kind==='customer'?{customerCode:'M1',name:'Ada',phone:'555',currency:'TRY',customerType:'customer',city:'İzmir',country:'Türkiye'}:{stockCode:'P1',name:'Ürün',barcode:'1',unit:'ADET',currency:'TRY',sale:'10',purchase:'5',discount:'0'},addEventListener:(_name,fn)=>{submit=fn;}};
 const root={set innerHTML(v){paintCount++;html=v;},get innerHTML(){return html;},querySelector(selector){if(selector.includes('data-')&&selector.includes('form'))return form;if(selector.includes('retry'))return {addEventListener(){}};if(selector==='[role="status"]')return status;if(selector.includes('button'))return button;return null;}};
 const controller={pending:()=>pending,create:async()=>{if(unknown)pending=kind==='customer'?{customerCode:'M1'}:{stockCode:'P1'};throw Error('synthetic error');},retry:async()=>{}};
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
