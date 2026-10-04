import {assertOperationQuarantineAllowed} from './operationQuarantineService.js';

// These are native IDs from known write contracts. Source IDs, codes, barcodes,
// movement IDs and document IDs must never be interpreted as master-card IDs.
export function invoiceQuarantineEntities(kind, snapshot) {
 const entity=kind==='sales'?'customer':'supplier',rows=[];
 if(snapshot?.items!=null&&!Array.isArray(snapshot.items))throw Object.assign(new Error('Fiş ürünleri liste olarak gönderilmelidir.'),{code:'MIGRATION_ITEMS_INVALID',statusCode:400});
 if(snapshot?.[`${entity}Id`]!=null)rows.push({entity,nativeId:snapshot[`${entity}Id`]});
 for(const item of snapshot?.items??[])if(item?.productId!=null)rows.push({entity:'product',nativeId:item.productId});
 return rows;
}
export function operationQuarantineGate(contract,assertAllowed=assertOperationQuarantineAllowed){
 return async(req,_res,next)=>{try{
  if(assertAllowed===assertOperationQuarantineAllowed&&process.env.MELISA_CANONICAL_TEST!=='true')return next();
  const body=req.body??{},rows=contract==='sales'||contract==='purchase'?invoiceQuarantineEntities(contract,body):[];
  if(contract==='collection'&&body.customerId!=null)rows.push({entity:'customer',nativeId:body.customerId});
  if(contract==='payment'&&body.supplierId!=null)rows.push({entity:'supplier',nativeId:body.supplierId});
  if(contract==='goods'){if(body.productId!=null)rows.push({entity:'product',nativeId:body.productId});if(body.supplierId!=null)rows.push({entity:'supplier',nativeId:body.supplierId});}
  if(['product','customer','supplier'].includes(contract)&&req.params?.id!=null)rows.push({entity:contract,nativeId:req.params.id});
  if(contract==='stock'&&body.productId!=null)rows.push({entity:'product',nativeId:body.productId});
  await assertAllowed(rows);next();
 }catch(error){next(error);}};
}
