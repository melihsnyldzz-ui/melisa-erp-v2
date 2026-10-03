import {get} from './apiClient.js';
export function fetchStockCounts({page=1,pageSize=8,status=''}={},options={}){
 if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>50
  ||!['','counting','submitted','review','closed','compensated'].includes(status))throw Error('Sayım liste filtresi geçersiz.');
 return get('/api/stock-counts',{source:'PROMPT-2-20260923-01',page,pageSize,...(status?{status}:{})},options);
}
export function fetchStockCount(documentId,source,options={}){
 if(typeof documentId!=='string'||!/^[1-9]\d{0,18}$/.test(documentId)||BigInt(documentId)>9223372036854775807n
   ||source!=='PROMPT-2-20260923-01')throw Error('Sayım belge kimliği veya kaynak geçersiz.');
 return get(`/api/stock-counts/${encodeURIComponent(documentId)}`,{source},options);
}

