// Existing permission keys determine visibility; request parameters never do.
export const DESKTOP_SALES_ALL_READ_PERMISSIONS=Object.freeze(['sales.cancel','finance.collection','finance.payment']);
export function desktopSalesReadMode(permissions){
 try{if(!Array.isArray(permissions)||permissions.some(p=>typeof p!=='string')||!permissions.includes('sales.view'))return null;return DESKTOP_SALES_ALL_READ_PERMISSIONS.some(p=>permissions.includes(p))?'all':'own';}catch{return null;}
}
export function desktopSalesReadOwner(creatorId,actorId,mode){
 const valid=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
 try{return valid(actorId)&&(mode==='all'||mode==='own'&&valid(creatorId)&&creatorId===actorId);}catch{return false;}
}
