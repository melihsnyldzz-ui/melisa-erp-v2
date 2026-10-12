import{semihBrowserRequested,validateSemihBrowserUser}from'./semihBrowserSession.mjs';
export function mountSemihBrowserControls({container,host,document,session,user,onLogout}={}){
 if(!container||!semihBrowserRequested(host?.location))return()=>{};
 try{validateSemihBrowserUser(user);}catch{return()=>{};}
 let active=true,busy=false;
 const group=document.createElement('span'),hub=document.createElement('button'),logout=document.createElement('button'),status=document.createElement('span');
 group.id='semih-session-controls';hub.type=logout.type='button';hub.className=logout.className='btn small';hub.textContent='Melisa Hub';logout.textContent='Çıkış';status.setAttribute('role','status');
 const mayLeave=()=>active&&!busy&&typeof host.MelisaWorkingBeforeNavigate==='function'&&host.MelisaWorkingBeforeNavigate()!==false;
 hub.onclick=()=>{if(mayLeave())host.location.assign(`${host.location.origin}/melisa-hub/?semih=1`);};
 logout.onclick=async()=>{if(!mayLeave())return;busy=true;hub.disabled=logout.disabled=true;status.textContent='Çıkış yapılıyor…';try{await session.logout();if(active){if(typeof host.MelisaWorkingBeforeNavigate==='function'&&host.MelisaWorkingBeforeNavigate()!==false)onLogout?.();else status.textContent='Çıkış yapıldı. Ekrandaki taslak korunuyor.';}}catch{if(active)status.textContent='Çıkış sunucuda doğrulanamadı. Yeniden deneyin.';}finally{busy=false;if(active)hub.disabled=logout.disabled=false;}};
 group.append(hub,logout,status);container.append(group);
 return()=>{active=false;group.remove();};
}
