// SOURCE ONLY. Caller must use an authenticated, invoice-bound SERIALIZABLE
// sale scope. This reader takes update/range locks and does not dispatch.
import {createDesktopTwoItemLockedSelection} from './desktopTwoItemLockedSelection.mjs';
import {assertDesktopDispatchReadiness} from './desktopDispatchReadiness.mjs';
const fail=()=>{throw Error('DESKTOP_DISPATCH_SNAPSHOT_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const mainSql=`SET NOCOUNT ON;
 SELECT w.state workflowState,i.status invoiceState,CONVERT(varchar(20),i.id) invoiceId
 FROM dbo.desktop_sale_workflows w WITH(UPDLOCK,HOLDLOCK)
 JOIN dbo.sales_invoices i WITH(UPDLOCK,HOLDLOCK) ON i.id=w.invoice_id
 WHERE i.id=TRY_CONVERT(bigint,@invoiceId) AND i.customer_id=TRY_CONVERT(bigint,@customerId);
 SELECT CONVERT(varchar(20),x.id) itemId,CONVERT(varchar(20),x.product_id) productId,CONVERT(varchar(40),x.quantity) quantityExact3
 FROM dbo.sales_invoice_items x WITH(UPDLOCK,HOLDLOCK) WHERE x.sales_invoice_id=TRY_CONVERT(bigint,@invoiceId) ORDER BY x.id;
 SELECT CONVERT(varchar(20),r.item_id) itemId,CONVERT(varchar(20),r.product_id) productId,r.state,CONVERT(varchar(40),r.quantity) quantityExact3
 FROM dbo.desktop_sale_reservations r WITH(UPDLOCK,HOLDLOCK) WHERE r.invoice_id=TRY_CONVERT(bigint,@invoiceId) ORDER BY r.item_id;
 SELECT c.carton_no cartonNo,CONVERT(varchar(20),c.item_id) itemId,CONVERT(varchar(20),c.product_id) productId,CONVERT(varchar(40),c.quantity) quantityExact3
 FROM dbo.desktop_sale_carton_items c WITH(UPDLOCK,HOLDLOCK) WHERE c.invoice_id=TRY_CONVERT(bigint,@invoiceId) ORDER BY c.carton_no,c.item_id;`;
const otherSql=`SELECT CONVERT(varchar(40),CONVERT(decimal(18,3),ISNULL(SUM(quantity),0))) otherReservedExact3
 FROM dbo.desktop_sale_reservations WITH(UPDLOCK,HOLDLOCK,INDEX(IX_desktop_active_reservations))
 WHERE product_id=TRY_CONVERT(bigint,@productId) AND state='ACTIVE' AND invoice_id<>TRY_CONVERT(bigint,@invoiceId);`;
export function createDesktopDispatchSnapshotReader({sql,verifyScope,selectLocked}={}){
 if(selectLocked!==undefined&&typeof selectLocked!=='function')fail();const locked=selectLocked??createDesktopTwoItemLockedSelection({sql,verifyScope});
 return async function read({transaction,scope,invoiceId,customerId,productIds}={}){
  if(!transaction||!scope||!id(invoiceId)||!id(customerId)||!Array.isArray(productIds)||productIds.length<1||productIds.length>2||productIds.some(v=>!id(v))||new Set(productIds).size!==productIds.length)fail();
  for(const productId of productIds)if(await verifyScope({transaction,scope,invoiceId,customerId,productId})!==true)fail();
  const selection=await locked({transaction,scope,customerId,productIds});
  const records=await new sql.Request(transaction).input('invoiceId',sql.NVarChar(20),invoiceId).input('customerId',sql.NVarChar(20),customerId).query(mainSql);
  const rs=records?.recordsets;if(!Array.isArray(rs)||rs.length!==4||rs.some(v=>!Array.isArray(v))||rs[0].length!==1||rs[0][0].invoiceId!==invoiceId||rs[1].length!==productIds.length)fail();
  const products=new Map(selection.products.map(p=>[p.id,p])),others=new Map();
  for(const productId of [...productIds].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)){
   const result=await new sql.Request(transaction).input('productId',sql.NVarChar(20),productId).input('invoiceId',sql.NVarChar(20),invoiceId).query(otherSql);
   if(!Array.isArray(result?.recordset)||result.recordset.length!==1)fail();others.set(productId,result.recordset[0].otherReservedExact3);
  }
  const lines=rs[1].map(line=>{const product=products.get(line.productId);if(!product)fail();return {...line,stockExact3:product.stockExact3,otherReservedExact3:others.get(line.productId)};});
  const snapshot={...rs[0][0],lines,reservations:rs[2],cartonItems:rs[3]};assertDesktopDispatchReadiness(snapshot);return snapshot;
 };
}
