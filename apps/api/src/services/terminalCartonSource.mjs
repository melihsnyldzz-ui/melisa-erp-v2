import {createHash} from 'node:crypto';
import {validateCartonSource} from '../../../sites-workflow/src/workflow/cartonModel.mjs';
export function terminalCartonSource(invoice){
 if(invoice?.status!=='finalized')throw Object.assign(new Error('Koli hazırlığı yalnız tamamlanmış satış fişine bağlanır.'),{statusCode:409,code:'CARTON_SOURCE_STATUS'});
 const items=invoice.items.map(i=>({itemId:i.itemId,productId:i.productId,stockCode:i.stockCode,name:i.name,requiredExact3:i.quantityExact3,unit:i.unit,barcodes:i.barcodes??(typeof i.barcode==='string'&&i.barcode?[i.barcode]:[])}));
 const content={schemaVersion:'melisa-carton-source.v1',invoiceId:invoice.id,documentNo:invoice.documentNo,customerName:invoice.customerName??invoice.customerId,status:'FINALIZED',items};
 const revision=createHash('sha256').update(JSON.stringify(content)).digest('hex');return validateCartonSource({...content,revision});
}
