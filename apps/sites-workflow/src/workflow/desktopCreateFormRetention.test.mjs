import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDesktopCustomerCreate} from './desktopCustomerCreate.mjs';
import {mountDesktopProductCreate} from './desktopProductCreate.mjs';

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
