// Reuse the existing daily-cash screen and native API. The journal contains
// only this normal user's command, never credentials or a second money ledger.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CashRegisterScreen} from '../modules/finance/CashRegisterScreen.jsx';
import '../styles/cash-register.css';
import {createTradeJournal,tradeUuid} from './workTradeModel.mjs';
import {isCleanCatalogLocation,isCleanCatalogMeta} from './cleanSyntheticCatalogModel.mjs';

export function createWorkCash({root,session,user,storage=globalThis.localStorage,location=globalThis.location,uuid=tradeUuid}={}){
 let view,active=false,busy=false,dirty=false,revision=null,pending;
 const date='2026-10-22',base='/api/finance/cash-register',routes=new Set(['open','close','transfers','expenses'].map(p=>base+'/'+p));
 const journal=createTradeJournal({storage,key:'melisa-work-cash-v1:'+location.host+':'+user.id});
 const error=message=>new Error(message);
 function validateRead(data){
  if(!isCleanCatalogMeta(data?.meta,location)||data.meta.profile!=='B4-CASH-20261023'||data.meta.date!==date||!/^[a-f0-9]{64}$/.test(data.revision??'')||!Array.isArray(data.accounts)||data.accounts.length!==6||typeof data.capabilities?.canOpenOrClose!=='boolean'||typeof data.capabilities?.canRecordExpenseOrTransfer!=='boolean')throw error('Kasa bilgileri doğrulanamadı.');
  const expected=[[2,'TRY','drawer'],[3,'USD','drawer'],[4,'EUR','drawer'],[5,'TRY','main'],[6,'USD','main'],[7,'EUR','main']];
  if(expected.some(([id,currency,kind])=>data.accounts.filter(a=>a.id===id&&a.currency===currency&&a.kind===kind&&/^(0|[1-9]\d*)\.\d{4}$/.test(a.balanceExact4??'')).length!==1))throw error('Kasa hesapları doğrulanamadı.');
  revision=data.revision;return data;
 }
 function validPending(p){return p?.status==='pending'&&routes.has(p.path)&&typeof p.body?.requestId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.body.requestId)&&/^[a-f0-9]{64}$/.test(p.body.expectedRevision??'');}
 async function send(p,fresh=false){
  if(busy||!validPending(p))throw error('Son kasa işlemi doğrulanmadan yeni işlem açılamaz.');
  busy=true;
  try{
   const result=await session.cash(p.path,{method:'POST',body:p.body});
   if(result?.requestId!==p.body.requestId||typeof result.replayed!=='boolean')throw error('Kasa işleminin sonucu doğrulanamadı.');
   pending=journal.done(p,result);return {data:result};
  }catch(e){
   // A denied retry cannot prove that an earlier response was never committed.
   if(fresh&&[400,403,404,409,422].includes(e?.status))pending=journal.done(p,{rejected:true,status:e.status});
   throw e;
  }finally{busy=false;}
 }
 async function mutate(path,body){
  if(!active||busy||pending?.status==='pending'||!revision)throw error('Önce son kasa işlemini yenileyerek doğrulayın.');
  pending=journal.begin(path,{...structuredClone(body),requestId:uuid(),expectedRevision:revision});
  return send(pending,true);
 }
 const api={
  async fetchCashRegister(query){
   if(!active||query?.businessDate!==date||Object.keys(query).length!==1)throw error('Kasa tarihi doğrulanamadı.');
   pending=journal.read();if(pending?.status==='pending')await send(pending);
   return {data:validateRead(await session.cash(base+'?businessDate='+date))};
  },
  openCashRegister:body=>mutate(base+'/open',body),closeCashRegister:body=>mutate(base+'/close',body),
  createCashTransfer:body=>mutate(base+'/transfers',body),createCashExpense:body=>mutate(base+'/expenses',body),
 };
 return {
  mount(){if(!isCleanCatalogLocation(location))throw error('Günlük kasa bağlantısı kullanılamıyor.');active=true;view=createRoot(root);view.render(<CashRegisterScreen api={api} initialDate={date} fixedDate permissions={user.permissions} onDirtyChange={value=>{dirty=value;}}/>);},
  refresh(){return api.fetchCashRegister({businessDate:date});},
  requestClose(){return !busy&&pending?.status!=='pending'&&!dirty;},
  dispose(){active=false;view?.unmount();view=null;},
 };
}
