// Reuses the existing locked SQL selector within one verified transaction.
// Reservation totals and the lifecycle store are separate, required inputs.
import {createDesktopSaleSelectionStore} from './desktopSaleSelectionStore.mjs';
const fail=()=>{throw Error('DESKTOP_TWO_ITEM_SELECTION_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
export function createDesktopTwoItemSelectionStore({sql,verifyScope}={}){
 const select=createDesktopSaleSelectionStore({sql,verifyScope});
 return async function selectTwo({transaction,scope,customerId,productIds}={}){
  if(!transaction||!scope||!id(customerId)||!Array.isArray(productIds)||productIds.length!==2||productIds.some(v=>!id(v))||new Set(productIds).size!==2)fail();
  // Acquire product locks in deterministic numeric order to reduce deadlocks.
  const ordered=[...productIds].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1),rows=new Map();let customer;
  for(const productId of ordered){
   const row=await select({transaction,scope,customerId,productId});
   if(!row?.customer||!row?.product||row.product.id!==productId||row.customer.id!==customerId)fail();
   if(customer&&JSON.stringify(customer)!==JSON.stringify(row.customer))fail();
   customer=row.customer;rows.set(productId,row.product);
  }
  return {customer,products:productIds.map(productId=>rows.get(productId))};
 };
}
