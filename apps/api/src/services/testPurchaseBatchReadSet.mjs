// The selected recent headers and an explicitly named older header share one
// read set. Other suppliers, currencies and copies cannot consume its limit.
export function testBatchHeaderIdsJSON(headers){
 if(!Array.isArray(headers)||headers.length>101)throw Error('TEST_BATCH_HEADER_READ_SET');
 const ids=headers.map(h=>String(h.id));
 if(ids.some(id=>!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))||new Set(ids).size!==ids.length)throw Error('TEST_BATCH_HEADER_READ_SET');
 return JSON.stringify(ids);
}
export const TEST_BATCH_RECEIPT_READ_SQL=`SELECT l.*,b.state FROM dbo.test_goods_batch_lines l JOIN dbo.test_goods_batches b ON b.id=l.batch_id
 WHERE b.id IN(SELECT CONVERT(bigint,value) FROM OPENJSON(@batchHeaderIds))`;
const amount4=value=>typeof value==='string'&&/^(?:0|[1-9]\d*)\.\d{4}$/.test(value)?BigInt(value.replace('.','')):null;
export function testBatchInvoiceTotalsMatch(items,grandTotalExact4){
 const total=amount4(grandTotalExact4);if(total===null||!Array.isArray(items)||items.length<1||items.length>2)return false;
 let sum=0n;for(const item of items){const line=amount4(item.line_total_exact4);if(line===null)return false;sum+=line;}return sum===total;
}
