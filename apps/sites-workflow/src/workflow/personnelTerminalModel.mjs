// The terminal is an online thin client. Roles, commercial truth and replay
// journals remain owned by the existing ERP / CRM services.
export const terminalActions=Object.freeze([{id:'goods',label:'Mal Kabul',icon:'▣'},{id:'sales',label:'Satış',icon:'▤'},{id:'crm',label:'Müşterilerim',icon:'☏'},{id:'products',label:'Ürünler',icon:'▧'},{id:'count',label:'Sayım',icon:'✓'},{id:'returns',label:'İade',icon:'↶'}]);
export const terminalRoute=value=>terminalActions.some(a=>a.id===value)?value:'home';
export const terminalWorkActions=Object.freeze([terminalActions[0],terminalActions[1],{id:'packing',label:'Koli Hazırlığı',icon:'▣'},terminalActions[2]]);
export const terminalWorkRoute=value=>terminalWorkActions.some(a=>a.id===value)?value:'home';
export const terminalOfflineText='Bağlantı yok — bu işlem çevrimiçi tamamlanmalıdır.';
// The native WebView can report a zero CSS dvh while its real viewport is visible.
// Only the web header is subtracted; the Android header is outside this viewport.
export function terminalCrmViewportHeight({visualHeight,innerHeight,headerHeight}={}){
 const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
 const viewport=positive(visualHeight)?visualHeight:positive(innerHeight)?innerHeight:480;
 const header=typeof headerHeight==='number'&&Number.isFinite(headerHeight)?Math.max(0,headerHeight):0;
 return Math.max(1,Math.floor(viewport-header));
}
export function terminalCrmUrl(location){
 const pairedPorts={'5194':'62400','5224':'62600','5234':'62700','5244':'62800'};
 if(location?.protocol!=='http:'||!Object.hasOwn(pairedPorts,location?.port??'')||!['127.0.0.1','localhost','192.168.1.46'].includes(location.hostname))throw Error('Müşteri bağlantısı kullanılamıyor.');
 if(location.port==='5244'&&location.origin!==`http://${location.hostname}:5244`)throw Error('Müşteri bağlantısı kullanılamıyor.');
 const origin=`http://${location.hostname}:${pairedPorts[location.port]}`;
 return {origin,url:`${origin}/?${new URLSearchParams({terminal:'1',erpOrigin:location.origin})}`};
}
export function terminalMessage(event,frame,origin){
 return event.source===frame?.contentWindow&&event.origin===origin&&event.data?.type==='melisa-terminal-child'&&event.data.version===1&&['ready','home','unavailable','logged-out'].includes(event.data.action)&&Object.keys(event.data).every(k=>['type','version','action'].includes(k))?event.data.action:null;
}
export function terminalStorage(storage){
 const prefix='melisa-personnel-terminal:';
 return {getItem:key=>key==='melisaTestSessionMode'?'manual':storage.getItem(prefix+key),setItem:(key,value)=>storage.setItem(prefix+key,value),removeItem:key=>storage.removeItem(prefix+key)};
}
export function terminalUser(user){
 if(!user||!Number.isSafeInteger(user.id)||user.id<1||!Array.isArray(user.permissions)||user.role?.code==='admin')throw Error('Personel hesabınızla giriş yapın.');
 return user;
}
export function createTerminalScanGate({now=()=>Date.now(),intervalMs=600}={}){
 let last='',at=-Infinity,busy=false;
 return {accept(value){if(typeof value!=='string'||!value.trim()||busy)return false;const next=value.trim(),time=now();if(next===last&&time-at<intervalMs)return false;last=next;at=time;return true;},setBusy(value){busy=value===true;},reset(){last='';at=-Infinity;busy=false;}};
}
export function createTerminalSessionFacade(session,{online=()=>globalThis.navigator?.onLine!==false}={}){
 const check=()=>{if(!online())throw Object.assign(Error(terminalOfflineText),{status:503});};
 const read=(method)=>(...args)=>{check();return session[method](...args);};
 const write=(method)=>(path,options={})=>{check();if(typeof path!=='string'||/(?:work-collections|supplier-payments|work-purchases|\/approve$|\/reject$|\/cancel$)/.test(path))throw Object.assign(Error('Bu işlem terminal personel yüzünden kullanılamıyor.'),{status:403});return session[method](path,options);};
 return {api:read('api'),media:read('media'),work:write('work'),inbound:write('inbound'),cartons:write('cartons'),businessSupplierSelection:read('businessSupplierSelection')};
}
