export function normalizeTestInvoiceList(rows){
 if(!Array.isArray(rows))throw Error('TEST fiş listesi doğrulanamadı.');
 return rows.map(row=>{
  if(!Number.isSafeInteger(Number(row.id))||Number(row.id)<1||typeof row.invoiceNo!=='string'||!row.invoiceNo||typeof row.totalAmount!=='number'||!Number.isFinite(row.totalAmount)||!['FINALIZED','CANCELLED','DRAFT'].includes(row.status))throw Error('TEST fiş yanıtı eksik; tutar sıfır varsayılmadı.');
  return {...row,id:Number(row.id),documentNo:row.invoiceNo,grandTotal:row.totalAmount};
 });
}
