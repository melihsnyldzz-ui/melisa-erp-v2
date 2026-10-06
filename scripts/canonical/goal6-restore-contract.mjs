export const RESTORE_DATABASE='MELISA_ERP_GOAL6_RESTORE_TEST_20261006_01';
export const RESTORE_SERVER='Semih\\MELISADEV';
export function assertRestoreIdentity(row){
 if(row?.serverName!==RESTORE_SERVER||row.databaseName!==RESTORE_DATABASE||row.isReadOnly!==true||row.state!=='ONLINE')throw new Error('GOAL6_RESTORE_READ_TARGET_INVALID');
}
export function assertRestoreRead(proof){
 assertRestoreIdentity(proof.identity);
 if(proof.catalog.count!=='16622'||proof.catalog.unknownCost!=='10552'||proof.catalog.prices!=='63774')throw new Error('GOAL6_RESTORE_CATALOG_INVALID');
 if(proof.products.length!==2||!proof.products.some(p=>p.productId==='34765'&&p.stockCode==='0161 MOLLY'&&p.barcode==='8697130801618'&&p.price==='9.66000000'&&p.currency==='USD')||!proof.products.some(p=>p.productId==='36724'&&p.stockCode==='8023 CONCEPT'&&p.price==='15.78000000'&&p.currency==='USD'))throw new Error('GOAL6_RESTORE_PRODUCTS_INVALID');
 if(proof.nativeOrder.id!=='9'||proof.nativeOrder.status!=='draft'||proof.nativeOrder.currency!=='USD'||proof.nativeOrder.total!=='25.4400'||proof.nativeLines.length!==2||proof.nativeLines.some(l=>l.quantity!=='1.000'||l.currency!=='USD')||!proof.nativeLines.some(l=>l.productId==='34765')||!proof.nativeLines.some(l=>l.productId==='36724'))throw new Error('GOAL6_RESTORE_NATIVE_DRAFT_INVALID');
 if(!proof.dailyDrafts.some(d=>d.id==='43'&&d.state==='pending')||!proof.dailyDrafts.some(d=>d.id==='44'&&d.state==='pending')||proof.inbound.id!=='7')throw new Error('GOAL6_RESTORE_DAILY_DRAFT_INVALID');
 if(!proof.roles.permissions||!proof.roles.users||!proof.roles.roles)throw new Error('GOAL6_RESTORE_AUTH_METADATA_INVALID');
 return proof;
}
