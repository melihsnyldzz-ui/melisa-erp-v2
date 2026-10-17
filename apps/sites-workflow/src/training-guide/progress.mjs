// PR27's scoped, browser-only lesson progression is reused as a read-only guide.
// No session controller, exercise API, actor or training database is imported.
export const progressKey='melisa-readonly-training:v1:reviewed-lessons';
const ids=new Set(['receiving','sale','purchase','collection','payment','return','count','crm-order']);
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function readProgress(storage){try{const value=JSON.parse(storage.getItem(progressKey));return {completed:Array.isArray(value?.completed)?[...new Set(value.completed.filter(v=>ids.has(v)))]:[]};}catch{return {completed:[]};}}
export function saveProgress(storage,value){try{storage.setItem(progressKey,JSON.stringify({completed:value.completed.filter(v=>ids.has(v))}));return true;}catch{return false;}}
