export function dailyDraftCanReverse(row,copy=null,clean=null){
 if(row?.state!=='approved')return false;
 if(clean&&row.kind==='count'&&Array.isArray(row.payload?.lines)){
  if(clean.canReview!==true||String(row.created_by)!=='21'||String(row.decided_by)!=='22'||row.payload.lines.length!==1||row.result?.lines?.length!==1)return false;
  const line=row.payload.lines[0],result=row.result.lines[0];
  return line.productId==='1'&&line.stockCode==='0007 MELISA'&&String(result.productId)==='1'&&Number.isSafeInteger(line.physical)&&line.physical>=0&&Number.isSafeInteger(line.system)&&line.system>=0&&Math.abs(line.physical-line.system)<=5&&result.difference===line.physical-line.system&&(result.movementCreated===false&&result.difference===0||result.movementCreated===true&&result.difference!==0&&Number.isSafeInteger(Number(result.movementId))&&Number(result.movementId)>0);
 }
 if(row.kind==='count'&&Array.isArray(row.payload?.lines)){
  if(!copy||row.payload.lines.length!==1||row.result?.lines?.length!==1||!copy.actors?.some(a=>a.id===String(row.created_by)))return false;
  const line=row.payload.lines[0],result=row.result.lines[0],product=copy.products?.find(p=>p.id===String(line.productId));
  return !!product&&line.stockCode===product.stockCode&&String(result.productId)===product.id&&Number.isSafeInteger(line.physical)&&line.physical>=0&&Number.isSafeInteger(line.system)&&line.system>=0&&Math.abs(line.physical-line.system)<=5&&result.difference===line.physical-line.system&&(result.movementCreated===false&&result.difference===0||result.movementCreated===true&&result.difference!==0&&Number.isSafeInteger(Number(result.movementId))&&Number(result.movementId)>0);
 }
 return ['invoice-return','uninvoiced'].includes(row.kind)||(row.kind==='count'&&(row.result?.movementCreated===false||Number.isSafeInteger(Number(row.result?.movementId))&&Number(row.result?.movementId)>0));
}
export const dailyDraftKindLabel=kind=>({count:'Sayım', 'invoice-return':'Kaynak alış iadesi',uninvoiced:'Faturalanmamış mal iadesi'}[kind]||'İşlem');
export const dailyDraftStateLabel=state=>({pending:'İnceleme bekliyor',approved:'Tamamlandı',rejected:'Reddedildi',cancelled:'Ters kayıtla geri alındı'}[state]||'İnceleme gerekli');
