export const partyHistorySchema='melisa-business-party-history.v1';
export const partyHistoryError=(code='BUSINESS_PARTY_HISTORY_DATA_INVALID',statusCode=503)=>Object.assign(new Error('Hesap geçmişi doğrulanamadı.'),{code,statusCode});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const money=v=>v===null||typeof v==='string'&&/^-?(?:0|[1-9]\d{0,27})\.\d{1,8}$/.test(v);
const date=v=>typeof v==='string'&&/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00.000Z'))&&new Date(v+'T00:00:00.000Z').toISOString().slice(0,10)===v;
const currencies=['TRY','USD','EUR'];
const fail=()=>{throw partyHistoryError();};
export function parsePartyHistoryQuery(query){
 const allowed=['kind','partyId','accountId','currency','page','dateFrom','dateTo'];
 if(!object(query)||Object.keys(query).some(k=>!allowed.includes(k))||!['customer','supplier'].includes(query.kind)||!id(query.partyId)||!id(query.accountId)||!currencies.includes(query.currency)||query.page!==undefined&&(typeof query.page!=='string'||! /^[1-9]\d{0,5}$/.test(query.page)||Number(query.page)>100000))throw partyHistoryError('BUSINESS_PARTY_HISTORY_QUERY_INVALID',400);
 const dates=['dateFrom','dateTo'].map(k=>{const v=query[k];if(v===undefined||v==='')return null;if(!date(v))throw partyHistoryError('BUSINESS_PARTY_HISTORY_QUERY_INVALID',400);return v;});
 if(dates[0]!==null&&dates[1]!==null&&dates[0]>dates[1])throw partyHistoryError('BUSINESS_PARTY_HISTORY_QUERY_INVALID',400);
 const page=Number(query.page??'1');return {kind:query.kind,partyId:query.partyId,accountId:query.accountId,currency:query.currency,page,limit:25,offset:(page-1)*25,dateFrom:dates[0],dateTo:dates[1]};
}
export function partyHistoryPath(input){const q=parsePartyHistoryQuery({...input,...(typeof input?.page==='number'?{page:String(input.page)}:{})});return `/api/business-party-history/${q.kind}/${q.partyId}/${q.accountId}?`+new URLSearchParams({currency:q.currency,page:String(q.page),dateFrom:q.dateFrom??'',dateTo:q.dateTo??''});}
export function partyHistoryPathAllowed(path){
 if(typeof path!=='string'||path.includes('#')||path.includes('\\'))return false;const match=/^\/api\/business-party-history\/(customer|supplier)\/([1-9]\d{0,18})\/([1-9]\d{0,18})\?([^#]*)$/.exec(path);if(!match)return false;
 try{const p=new URLSearchParams(match[4]);if([...p.keys()].length!==4||new Set(p.keys()).size!==4||[...p.keys()].some(k=>!['currency','page','dateFrom','dateTo'].includes(k)))return false;parsePartyHistoryQuery({kind:match[1],partyId:match[2],accountId:match[3],...Object.fromEntries(p)});return true;}catch{return false;}
}
const count=v=>{if(typeof v!=='string'||! /^(?:0|[1-9]\d*)$/.test(v)||BigInt(v)>BigInt(Number.MAX_SAFE_INTEGER))fail();return Number(v);};
function rowDto(row,q){
 if(!object(row)||!id(row.id)||typeof row.kind!=='string'||!row.kind||row.kind.length>120||!date(row.documentDate)||q.dateFrom!==null&&row.documentDate<q.dateFrom||q.dateTo!==null&&row.documentDate>q.dateTo||!['documentAmountExact','accountAmountExact','balanceEffectExact','legacyBalanceEffectExact'].every(k=>money(row[k]))||typeof row.documentCurrencyRaw!=='string'||row.documentCurrencyRaw.length>10||!(row.accountCurrency===null||row.accountCurrency===q.currency)||![true,false,null].includes(row.affectsBalance)||![row.invoiceId,row.returnId].every(v=>v===null||id(v))||!(row.invoiceNumber===null||typeof row.invoiceNumber==='string'&&row.invoiceNumber.length<=500))fail();
 const documentCurrency=currencies.includes(row.documentCurrencyRaw)?row.documentCurrencyRaw:null;
 const unknown=[];if(documentCurrency===null)unknown.push('documentCurrency');for(const k of ['documentAmountExact','accountAmountExact','balanceEffectExact','affectsBalance'])if(row[k]===null)unknown.push(k);if(row.accountCurrency===null)unknown.push('accountCurrency');
 return {id:row.id,kind:row.kind,documentDate:row.documentDate,documentAmountExact:row.documentAmountExact,documentCurrency,documentCurrencyRaw:row.documentCurrencyRaw,accountAmountExact:row.accountAmountExact,accountCurrency:row.accountCurrency,balanceEffectExact:row.balanceEffectExact,legacyBalanceEffectExact:row.legacyBalanceEffectExact,affectsBalance:row.affectsBalance,invoiceId:row.invoiceId,invoiceNumber:row.invoiceNumber,returnId:row.returnId,unknownFields:unknown};
}
export function partyHistoryResult(raw,q,{readAt,actorId='17'}={}){
 const a=raw?.account;if(!a)throw partyHistoryError('BUSINESS_PARTY_HISTORY_ACCOUNT_CHANGED',409);
 if(!object(a)||a.id!==q.accountId||a.partyId!==q.partyId||a.currency!==q.currency||!(a.partyEntityId===null||id(a.partyEntityId)))throw partyHistoryError('BUSINESS_PARTY_HISTORY_ACCOUNT_CHANGED',409);
 if(a.oppositePartyId!==null)throw partyHistoryError('BUSINESS_PARTY_HISTORY_ROLE_CONFLICT',409);
 const total=count(raw.total),unassignedCount=count(raw.unassignedCount),conflictCount=count(raw.conflictCount);
 if(conflictCount!==0)throw partyHistoryError('BUSINESS_PARTY_HISTORY_LINK_CONFLICT',409);
 if(!Array.isArray(raw.rows)||raw.rows.length!==Math.min(25,Math.max(0,total-q.offset))||actorId!=='17'||typeof readAt!=='string'||!Number.isFinite(Date.parse(readAt)))fail();
 const data=raw.rows.map(row=>rowDto(row,q));if(new Set(data.map(r=>r.id)).size!==data.length)fail();
 for(let n=1;n<data.length;n++){const older=data[n],newer=data[n-1];if(older.documentDate>newer.documentDate||older.documentDate===newer.documentDate&&BigInt(older.id)>=BigInt(newer.id))fail();}
 return {data,meta:{schemaVersion:partyHistorySchema,profile:'ERP-5244-REALDATA-20261027',actorId,readOnly:true,writeAuthorized:false,actualT1:false,atomic:false,freshVega:false,readAt,scope:{kind:q.kind,partyId:q.partyId,accountId:q.accountId,currency:q.currency,dateFrom:q.dateFrom,dateTo:q.dateTo,dateField:'document_date',period:q.dateFrom===null&&q.dateTo===null?'all-native-recorded-dates':'explicit-native-document-dates'},page:q.page,limit:25,total,totalPages:Math.ceil(total/25),unassignedCount,unassignedScope:'party-all-native-recorded-dates',originClassification:'NOT_PERFORMED'}};
}
export function validatePartyHistoryEnvelope(value,input){
 const q=parsePartyHistoryQuery({...input,...(typeof input?.page==='number'?{page:String(input.page)}:{})}),m=value?.meta;
 if(value?.success!==true||m?.schemaVersion!==partyHistorySchema||m.profile!=='ERP-5244-REALDATA-20261027'||m.actorId!=='17'||m.readOnly!==true||m.writeAuthorized!==false||m.actualT1!==false||m.atomic!==false||m.freshVega!==false||m.originClassification!=='NOT_PERFORMED'||m.page!==q.page||m.limit!==25||!Number.isSafeInteger(m.total)||m.total<0||m.totalPages!==Math.ceil(m.total/25)||!Number.isSafeInteger(m.unassignedCount)||m.unassignedCount<0||m.unassignedScope!=='party-all-native-recorded-dates'||!object(m.scope)||!['kind','partyId','accountId','currency','dateFrom','dateTo'].every(k=>m.scope[k]===q[k])||m.scope.dateField!=='document_date'||m.scope.period!==(q.dateFrom===null&&q.dateTo===null?'all-native-recorded-dates':'explicit-native-document-dates'))fail();
 const normalized=partyHistoryResult({account:{id:q.accountId,partyId:q.partyId,currency:q.currency,partyEntityId:null,oppositePartyId:null},total:String(m.total),unassignedCount:String(m.unassignedCount),conflictCount:'0',rows:value.data},q,{readAt:m.readAt});
 for(let n=0;n<normalized.data.length;n++){const expected=normalized.data[n],actual=value.data[n];if(Object.keys(actual).length!==Object.keys(expected).length||Object.keys(expected).some(k=>k==='unknownFields'?!Array.isArray(actual[k])||expected[k].length!==actual[k].length||expected[k].some((v,i)=>v!==actual[k][i]):expected[k]!==actual[k]))fail();}return value;
}
