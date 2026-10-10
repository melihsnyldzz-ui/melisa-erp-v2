import {validateOperationCopyBootstrap} from './isolatedOperationCopyModel.mjs';
import {isSharedStableLocation} from './sharedStableTopology.mjs';
export function verifiedCopyPage({profile=globalThis.window?.__MELISA_OPERATION_COPY__,location=globalThis.window?.location}={}){
 try{return validateOperationCopyBootstrap(profile,location);}catch{return null;}
}
export function mountCopyActorSelector({container,session,user,beforeSwitch=()=>true,onChanged=()=>{},profile=globalThis.window?.__MELISA_OPERATION_COPY__,location=globalThis.window?.location}={}){
 const copy=verifiedCopyPage({profile,location});
 if(!copy||!container||!Number.isSafeInteger(user?.id)||user.id<1)return ()=>{};
 if(!isSharedStableLocation(location)&&!copy.actors.some(a=>a.id===String(user?.id)&&a.role===user?.role?.code))return ()=>{};
 const doc=container.ownerDocument,box=doc.createElement('div'),status=doc.createElement('span');
 box.id='working-copy-actors';box.setAttribute('aria-label','Çalışan seçimi');box.style.cssText='display:flex;flex-wrap:wrap;gap:4px;align-items:center';status.setAttribute('role','status');status.style.fontSize='12px';
 if(isSharedStableLocation(location)){
  let active=true;
  const button=doc.createElement('button');button.type='button';button.className='btn small';button.textContent='Oturumu kapat';
  status.textContent='Kullanıcı değişikliği için kendi hesabınızla yeniden giriş yapın.';box.append(button);box.append(status);container.append(box);
  button.onclick=()=>{
   if(!active)return;
   if(beforeSwitch()===false||session.logout?.()!==true){status.textContent='Önce ekrandaki işlemin sonucunu kontrol edin veya taslağı kapatın.';return;}
   button.disabled=true;onChanged(null);
  };
  return ()=>{active=false;button.onclick=null;box.remove();};
 }
 let active=true,busy=false;const buttons=[];
 for(const [id,label] of [['15','Satış'],['16','İlker']]){
  const button=doc.createElement('button');button.type='button';button.className='btn small';button.textContent=label;button.setAttribute('aria-pressed',String(String(user.id)===id));button.disabled=String(user.id)===id;buttons.push(button);box.append(button);
  button.onclick=async()=>{
   if(!active||busy||String(user.id)===id)return;
   if(beforeSwitch()===false){status.textContent='Önce ekrandaki işlemi tamamlayın veya taslağı kapatın.';return;}
   busy=true;buttons.forEach(b=>b.disabled=true);status.textContent='Kullanıcı değiştiriliyor…';
   try{const next=await session.selectCopyActor(id);if(active){user=next;status.textContent='';onChanged(next);}}
   catch{if(active)status.textContent='Kullanıcı değiştirilemedi. Yeniden deneyin.';}
   finally{busy=false;if(active)buttons.forEach((b,i)=>b.disabled=String(user.id)===['15','16'][i]);}
  };
 }
 box.append(status);container.append(box);
 return ()=>{active=false;buttons.forEach(b=>b.onclick=null);box.remove();};
}
