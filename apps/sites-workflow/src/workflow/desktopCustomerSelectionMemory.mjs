// Per authenticated user object; no browser or server persistence.
import {desktopCustomerCardId} from '../../../../packages/shared/src/desktopCustomerCard.mjs';
export function createDesktopCustomerSelectionMemory({user,getUser}={}){
 if(!user||typeof user!=='object'||typeof getUser!=='function')throw Error('CUSTOMER_SELECTION_MEMORY_INVALID');const entries=new Map();
 const valid=(customerId,kind)=>desktopCustomerCardId(customerId)&&['sales','ledger'].includes(kind);
 return Object.freeze({get(customerId,kind){if(getUser()!==user||!valid(customerId,kind))return null;return entries.get(customerId)?.[kind]??null;},set(customerId,kind,accountId){if(getUser()!==user||!valid(customerId,kind)||(accountId!==null&&!desktopCustomerCardId(accountId)))return false;const old=entries.get(customerId)??{};entries.set(customerId,{...old,[kind]:accountId});return true;}});
}
