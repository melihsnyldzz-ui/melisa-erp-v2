import fs from 'node:fs/promises';
import path from 'node:path';

// Dependency injection keeps scheduler/failure tests independent of SQL and timers.
export function createVegaCardAutoSync({settingsPath,runSync,resolveActor,assertPermission,
 now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}){
 const intervalMs=60000;
 let settings={version:1,enabled:false,actorId:null},timer=null,activeRun=null,closed=false,generation=0;
 let sourceHash=null;
 let state={running:false,lastCheckedAt:null,lastSuccessAt:null,lastChangedAt:null,nextCheckAt:null,
  updated:0,new:0,changed:0,activeSource:null,durationMs:null,sourceMetrics:null,error:null};
 const status=()=>({...state,enabled:settings.enabled,intervalMs,method:'active-card-sha256',persisted:true});
 const cancelTimer=()=>{if(timer!==null)clearTimer(timer);timer=null;state.nextCheckAt=null;};
 function schedule(){
  cancelTimer();
  if(closed||!settings.enabled||activeRun)return;
  state.nextCheckAt=new Date(now()+intervalMs).toISOString();
  timer=setTimer(()=>{timer=null;void check();},intervalMs);timer?.unref?.();
 }
 async function check(){
  if(activeRun)return activeRun;
  if(closed||!settings.enabled)return status();
  cancelTimer();
  const started=now(),runGeneration=generation;
  const mayApply=()=>!closed&&settings.enabled&&generation===runGeneration;
  state={...state,running:true,error:null};
  activeRun=(async()=>{
   try{
    const actor=await resolveActor(settings.actorId);assertPermission(actor);
    if(!mayApply())return;
    const result=await runSync(actor,sourceHash,mayApply);
    if(!mayApply())return;
    sourceHash=result.sourceHash;
    const at=new Date(now()).toISOString();
    state={...state,lastSuccessAt:at,updated:result.updated,new:result.new,changed:result.changed,
     activeSource:result.activeSource,sourceMetrics:result.sourceMetrics||null,
     lastChangedAt:result.changed?at:state.lastChangedAt,error:null};
   }catch(error){
    if(mayApply())state.error={code:error.code||'CARD_AUTO_FAILED',message:error.code==='CARD_CONFLICT'?error.message:
     error.code?.startsWith('AUTH_')?'Otomatik güncellemeyi açan kullanıcının yetkisi doğrulanamadı.':
     'VEGA kart kontrolü tamamlanamadı. Bağlantıyı ve manuel önizlemeyi kontrol edin.'};
   }finally{
    state.running=false;state.lastCheckedAt=new Date(now()).toISOString();state.durationMs=now()-started;
   }
  })();
  try{await activeRun;}finally{activeRun=null;schedule();}
  return status();
 }
 async function start(){
  try{
   const value=JSON.parse(await fs.readFile(settingsPath,'utf8'));
   if(value.version!==1||typeof value.enabled!=='boolean'||!Number.isSafeInteger(value.actorId)||value.actorId<1)throw Error('INVALID_SETTINGS');
   settings=value;
  }catch(error){
   if(error.code!=='ENOENT')state.error={code:'CARD_AUTO_CONFIG_INVALID',message:'Otomatik güncelleme ayarı okunamadı; güvenli olarak kapalı.'};
  }
  schedule();return status();
 }
 let settingWrite=Promise.resolve();
 function configure(enabled,actor){
  const change=async()=>{
   assertPermission(actor);
   if(typeof enabled!=='boolean')throw Object.assign(new Error('Aç/kapa değeri gerekli.'),{statusCode:400,code:'CARD_AUTO_INVALID'});
   if(settings.enabled===enabled&&settings.actorId===Number(actor.id))return status();
   const next={version:1,enabled,actorId:Number(actor.id),changedAt:new Date(now()).toISOString()};
   await fs.mkdir(path.dirname(settingsPath),{recursive:true});
   const temporary=settingsPath+'.tmp';
   await fs.writeFile(temporary,JSON.stringify(next,null,2),{mode:0o600});
   await fs.rename(temporary,settingsPath);
   generation++;settings=next;sourceHash=null;state.error=null;
   cancelTimer();schedule();
   return status();
  };
  const result=settingWrite.then(change);settingWrite=result.catch(()=>{});return result;
 }
 async function stop(){closed=true;generation++;cancelTimer();if(activeRun)await activeRun;}
 return {start,status,configure,check,stop};
}
