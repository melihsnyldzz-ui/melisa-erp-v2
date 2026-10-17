import {tradeUuid} from './workTradeModel.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=()=>{throw Error('Son işlem korunamadı. Kayıt gönderilmedi; tekrar deneyin.');};
export function createInboundJournal({storage,key,makeUuid=tradeUuid}={}){
 function read(){try{const raw=storage?.getItem(key);if(!raw)return {version:1,draft:null,request:null};const value=JSON.parse(raw),r=value?.request;if(value?.version!==1||value.draft!==null&&!object(value.draft)||r!==null&&(!object(r)||!['pending','done','rejected'].includes(r.status)||!object(r.body)||!uuid(r.body.requestId)||typeof r.path!=='string'||!/^\/api\/work-(?:receiving|purchases)\/[A-Za-z0-9/-]+$/.test(r.path)))throw Error();return value;}catch{throw Error('Önceki sayım veya işlem okunamıyor. Sonucu kontrol etmeden yeni kayıt göndermeyin.');}}
 function save(value){try{if(!storage?.setItem)throw Error();storage.setItem(key,JSON.stringify(value));return clone(value);}catch{fail();}}
 return {
  read,
  backup(draft){const current=read();if(current.request?.status==='pending')throw Error('Önce son işlemin sonucunu doğrulayın.');if(!object(draft))fail();return save({...current,draft:clone(draft)});},
  begin(path,body){const current=read();if(current.request?.status==='pending')throw Error('Önce son işlemin sonucunu doğrulayın.');if(typeof path!=='string'||!/^\/api\/work-(?:receiving|purchases)\/[A-Za-z0-9/-]+$/.test(path)||!object(body))fail();let request;try{request={path,body:clone({...body,requestId:makeUuid()}),status:'pending'};if(!uuid(request.body.requestId))throw Error();}catch{fail();}return save({...current,request}).request;},
  complete(sent,result,{rejected=false,draft}={}){const current=read(),r=current.request;if(r?.status!=='pending'||r.path!==sent.path||JSON.stringify(r.body)!==JSON.stringify(sent.body))return null;return save({...current,draft:draft===undefined?current.draft:clone(draft),request:{...r,status:rejected?'rejected':'done',result:clone(result)}}).request;},
  clearDraft(){const current=read();if(current.request?.status==='pending')throw Error('Önce son işlemin sonucunu doğrulayın.');return save({...current,draft:null});}
 };
}
