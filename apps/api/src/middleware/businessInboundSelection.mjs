import {parseBusinessInboundSelection,withBusinessInboundSelection} from './businessInboundSelectionContext.mjs';
export * from './businessInboundSelectionContext.mjs';
export function createBusinessInboundSelectionMiddleware({getContext=async()=>{const db=await import('../config/database.js');return db.isIsolatedOperationCopyRuntime?.()?db.getIsolatedOperationCopyConfig():null;}}={}){
 return async(req,_res,next)=>{try{const copy=await getContext(),selection=parseBusinessInboundSelection(copy,{supplierId:req.get('x-melisa-supplier-id'),currency:req.get('x-melisa-currency')});withBusinessInboundSelection(copy,selection,next);}catch(error){next(error);}};
}
