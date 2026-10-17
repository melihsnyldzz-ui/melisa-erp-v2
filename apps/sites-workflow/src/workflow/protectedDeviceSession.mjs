const bridges=new WeakMap();
export function createProtectedDeviceSession({host=globalThis.window,timeoutMs=5000}={}){
 const windows=host?.MelisaWindowsProtectedSession;
 if(host?.location?.origin==='http://127.0.0.1:5234' && windows && ['get','put','clear'].every(k=>typeof windows[k]==='function')){
  if(bridges.has(windows))return bridges.get(windows);
  let queue=Promise.resolve();
  const call=(action,value)=>{const p=queue.then(()=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Cihaz oturumu yanıt vermedi.')),timeoutMs);
   Promise.resolve().then(()=>action==='put'?windows.put(value):windows[action]()).then(r=>{clearTimeout(timer);resolve(r??null);},()=>{clearTimeout(timer);reject(Error('Cihaz oturumu kullanılamıyor.'));});
  }));queue=p.catch(()=>{});return p;};
  const bridge={get:()=>call('get'),put:r=>call('put',r),clear:()=>call('clear')};bridges.set(windows,bridge);return bridge;
 }
 if(/MelisaProtectedWork\/1/.test(host?.navigator?.userAgent??'')&&typeof host?.MelisaProtectedSession?.postMessage!=='function'){
  const unavailable=()=>Promise.reject(Error('Cihazın güvenli oturum desteği kullanılamıyor. Uygulamayı güncelleyin.'));
  return {get:unavailable,put:unavailable,clear:unavailable};
 }
 if(!['http://192.168.1.46:5234','http://127.0.0.1:5234'].includes(host?.location?.origin)||typeof host?.MelisaProtectedSession?.postMessage!=='function')return null;
 const native=host.MelisaProtectedSession,pending=new Map();let serial=0,queue=Promise.resolve();
 if(bridges.has(native))return bridges.get(native);
 native.onmessage=e=>{let r;try{r=JSON.parse(e.data);}catch{return;}const p=pending.get(r?.id);if(r?.v!==1||typeof r.ok!=='boolean'||!p)return;pending.delete(r.id);clearTimeout(p.timer);r.ok?p.resolve(r.session??null):p.reject(Error('Cihaz oturumu saklanamadı.'));};
 const call=(action,session)=>new Promise((resolve,reject)=>{const id='erp_'+Date.now()+'_'+(++serial),timer=setTimeout(()=>{pending.delete(id);reject(Error('Cihaz oturumu yanıt vermedi.'));},timeoutMs);pending.set(id,{resolve,reject,timer});try{native.postMessage(JSON.stringify({v:1,id,action,...(action==='put'?{session}:{})}));}catch{pending.delete(id);clearTimeout(timer);reject(Error('Cihaz oturumu kullanılamıyor.'));}});
 const serialCall=(action,session)=>{const result=queue.then(()=>call(action,session));queue=result.catch(()=>{});return result;};
 const bridge={get:()=>serialCall('get'),put:r=>serialCall('put',r),clear:()=>serialCall('clear')};bridges.set(native,bridge);return bridge;
}
