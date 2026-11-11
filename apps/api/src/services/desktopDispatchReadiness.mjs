// Source-only invariant for the first dispatch. Input must be read from locked
// rows in a verified transaction; this function is not an authorization check,
// does not lock SQL, and cannot finalize or change stock by itself.
const fail=()=>{throw Error('DESKTOP_DISPATCH_NOT_READY');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const amount=v=>{if(typeof v!=='string'||!/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(v))fail();return BigInt(v.replace('.',''));};
export function assertDesktopDispatchReadiness(snapshot){
 if(!snapshot||snapshot.workflowState!=='CHECKED'||snapshot.invoiceState!=='draft'||!id(snapshot.invoiceId)||
  !Array.isArray(snapshot.lines)||snapshot.lines.length<1||snapshot.lines.length>2||!Array.isArray(snapshot.reservations)||snapshot.reservations.length!==snapshot.lines.length||
  !Array.isArray(snapshot.cartonItems)||snapshot.cartonItems.length<1||snapshot.cartonItems.length>200)fail();
 const lines=new Map(),products=new Set();
 for(const line of snapshot.lines){
  if(!line||!id(line.itemId)||!id(line.productId)||lines.has(line.itemId)||products.has(line.productId))fail();
  const quantity=amount(line.quantityExact3),stock=amount(line.stockExact3),otherReserved=amount(line.otherReservedExact3);
  if(quantity===0n||stock-otherReserved<quantity)fail();
  lines.set(line.itemId,{productId:line.productId,quantity,packed:0n});products.add(line.productId);
 }
 const seen=new Set();
 for(const reservation of snapshot.reservations){
  const line=lines.get(reservation?.itemId);
  if(!line||seen.has(reservation.itemId)||reservation.productId!==line.productId||reservation.state!=='ACTIVE'||amount(reservation.quantityExact3)!==line.quantity)fail();
  seen.add(reservation.itemId);
 }
 const allocations=new Set();
 for(const part of snapshot.cartonItems){
  const line=lines.get(part?.itemId);
  if(!line||part.productId!==line.productId||!Number.isSafeInteger(part.cartonNo)||part.cartonNo<1||part.cartonNo>2147483647)fail();
  const key=part.cartonNo+':'+part.itemId;if(allocations.has(key))fail();allocations.add(key);
  const quantity=amount(part.quantityExact3);if(quantity===0n)fail();line.packed+=quantity;
 }
 if([...lines.values()].some(line=>line.packed!==line.quantity))fail();
 return true;
}
