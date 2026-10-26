// PR27's scoped, browser-only lesson progression is reused as a read-only guide.
// No session controller, exercise API, actor or training database is imported.
export const progressKey='melisa-readonly-training:v1:reviewed-lessons';
const ids=new Set(['receiving','sale','purchase','collection','payment','return','count','crm-order']);
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function readProgress(storage){try{const value=JSON.parse(storage.getItem(progressKey));return {completed:Array.isArray(value?.completed)?[...new Set(value.completed.filter(v=>ids.has(v)))]:[]};}catch{return {completed:[]};}}
export function saveProgress(storage,value){try{storage.setItem(progressKey,JSON.stringify({completed:value.completed.filter(v=>ids.has(v))}));return true;}catch{return false;}}

// In-screen preparation is separate from the eight reviewed lessons. Only the
// current environment, numeric account ID and lesson key identify this progress.
const inlineSteps=Object.freeze({receiving:4});
export function inlineProgressKey(identity={}){
 const {scope,userId,lesson}=identity??{};
 const id=String(userId??'');
 if(typeof scope!=='string'||!scope||scope.length>240||!Object.hasOwn(inlineSteps,lesson)||!/^[1-9]\d{0,18}$/.test(id))return null;
 return `${progressKey}:inline:${encodeURIComponent(scope)}:${id}:${lesson}`;
}
const inlineValue=(value,lesson)=>Number.isInteger(value?.step)&&value.step>=0&&value.step<inlineSteps[lesson]&&typeof value.reviewed==='boolean'&&(!value.reviewed||value.step===inlineSteps[lesson]-1);
export function readInlineProgress(storage,identity){
 const key=inlineProgressKey(identity);
 try{const value=key&&JSON.parse(storage.getItem(key));if(inlineValue(value,identity?.lesson))return {step:value.step,reviewed:value.reviewed};}catch{}
 return {step:0,reviewed:false};
}
export function saveInlineProgress(storage,identity,value){
 const key=inlineProgressKey(identity);
 if(!key||!inlineValue(value,identity?.lesson))return false;
 try{storage.setItem(key,JSON.stringify({step:value.step,reviewed:value.reviewed}));return true;}catch{return false;}
}
