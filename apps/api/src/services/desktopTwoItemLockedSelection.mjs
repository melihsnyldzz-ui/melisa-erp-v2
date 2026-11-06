// SOURCE ONLY. The verified sale scope must own a SERIALIZABLE transaction.
// Product and reservation range locks are held until its caller commits or
// rolls back; this reader neither writes a reservation nor creates authority.
import {createDesktopTwoItemSelectionStore} from './desktopTwoItemSelectionStore.mjs';
const fail=()=>{throw Error('DESKTOP_RESERVATION_SELECTION_UNAVAILABLE');};
export const DESKTOP_RESERVED_QUANTITY_SQL=`SELECT CONVERT(varchar(40),CONVERT(decimal(18,3),ISNULL(SUM(quantity),0))) reservedExact3
 FROM dbo.desktop_sale_reservations WITH(UPDLOCK,HOLDLOCK,INDEX(IX_desktop_active_reservations))
 WHERE product_id=TRY_CONVERT(bigint,@productId) AND state='ACTIVE';`;
export function createDesktopTwoItemLockedSelection({sql,verifyScope}={}){
 const select=createDesktopTwoItemSelectionStore({sql,verifyScope});
 return async function read({transaction,scope,customerId,productIds}={}){
  const selected=await select({transaction,scope,customerId,productIds}),reserved=new Map();
  const ordered=[...productIds].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1);
  for(const productId of ordered){
   if(await verifyScope({transaction,scope,customerId,productId})!==true)fail();
   const result=await new sql.Request(transaction).input('productId',sql.NVarChar(20),productId).query(DESKTOP_RESERVED_QUANTITY_SQL);
   const rows=result?.recordset;if(!Array.isArray(rows)||rows.length!==1||typeof rows[0].reservedExact3!=='string'||!/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(rows[0].reservedExact3))fail();
   reserved.set(productId,rows[0].reservedExact3);
  }
  return {...selected,reservedExact3:productIds.map(productId=>reserved.get(productId))};
 };
}
export const DESKTOP_LOCKED_SELECTION_LIMITS=Object.freeze({sourceOnly:true,requiresInstalledReservationSchema:true,requiresSerializableScope:true,realSqlVerified:false});
