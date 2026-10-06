export const REPORT_KINDS=['sales','collections','purchases','supplier-payments','stock-movements','customer-movements','supplier-movements'];
export const REPORT_SCOPE='Kaynak kapsamı: 30 Eylül açılış verisi + Melisa ERP TEST hareketleri';
export const reportError=(statusCode=400,code='REPORT_FILTER_INVALID')=>Object.assign(new Error(statusCode===403?'Bu rapor için yetkiniz bulunmuyor.':statusCode===503?'Rapor bilgileri şu anda okunamıyor.':'Rapor filtrelerini kontrol edin.'),{statusCode,code});
const date=v=>typeof v==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const shift=(v,n)=>new Date(Date.parse(v+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function reportFilters(query={},now=new Date()){
 const keys=['kind','period','from','to','currency','brand','type','groupBy','offset','limit'];
 if(Object.keys(query).some(k=>!keys.includes(k)||typeof query[k]!=='string'))throw reportError();
 const kind=query.kind||'sales',period=query.period||'today',groupBy=query.groupBy||'none';
 if(!REPORT_KINDS.includes(kind)||!['today','yesterday','last7','month','previous-month','custom'].includes(period)||!['none','brand','type','product'].includes(groupBy))throw reportError();
 if(kind!=='sales'&&(groupBy!=='none'||query.brand||query.type))throw reportError();
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 let from=today,to=today;
 if(period==='yesterday')from=to=shift(today,-1);
 if(period==='last7')from=shift(today,-6);
 if(period==='month')from=today.slice(0,7)+'-01';
 if(period==='previous-month'){to=shift(today.slice(0,7)+'-01',-1);from=to.slice(0,7)+'-01';}
 if(period==='custom'){from=query.from;to=query.to;if(!date(from)||!date(to))throw reportError();}
 if(!date(from)||!date(to)||from>to||Date.parse(to)-Date.parse(from)>365*86400000)throw reportError();
 const currency=query.currency||null;if(currency&&!['TRY','USD','EUR'].includes(currency))throw reportError();
 const brand=query.brand||null,type=query.type||null;
 if([brand,type].some(v=>v!==null&&(v.length>250||/[\u0000-\u001f]/.test(v))))throw reportError();
 const offset=query.offset??'0',limit=query.limit??'50';
 if(!/^\d+$/.test(offset)||!/^\d+$/.test(limit)||Number(offset)>100000||![25,50,100].includes(Number(limit)))throw reportError();
 const fromUtc=new Date(from+'T00:00:00+03:00').toISOString(),toUtcExclusive=new Date(shift(to,1)+'T00:00:00+03:00').toISOString();
 return {kind,period,from,to,currency,brand,type,groupBy,offset:Number(offset),limit:Number(limit),scope:{label:REPORT_SCOPE,timeZone:'Europe/Istanbul',fromDate:from,toDateInclusive:to,fromUtc,toUtcExclusive,historyLimited:true,limitations:['İşlem raporları Melisa ERP içinde oluşturulmuş kayıtlardır. Önceki Vega satış geçmişi bu rapora dahil değildir.','TRY, USD ve EUR ayrı gösterilir. Tarihler kayıtlı işlem gününe göre seçilir.',...(kind==='sales'&&(groupBy!=='none'||brand||type)?['Ürün kırılımı kayıtlı satır tutarlarını gösterir; fiş indirimi ve fiş toplamı ayrı kapsamlardır.']:[])]}};
}
export function reportCapabilities(actor){
 if(!actor?.id||!Array.isArray(actor.permissions))throw reportError(403);
 const has=k=>actor.permissions.includes(k),finance=has('finance.view');
 const permitted={sales:has('sales.view'),purchases:has('purchase.view'),collections:finance&&has('customer.view'),'supplier-payments':finance&&has('supplier.view'),'stock-movements':has('product.view'),'customer-movements':finance&&has('customer.view'),'supplier-movements':finance&&has('supplier.view')};
 const role=String(actor.role?.code||'').toLowerCase(),office=!['terminal_user','sales_user','sales_staff','warehouse_staff'].includes(role);
 return {canViewReports:REPORT_KINDS.some(k=>permitted[k]),canViewCost:finance&&office,kinds:REPORT_KINDS.filter(k=>permitted[k])};
}
export function reportCsvCell(value,numeric=false){
 let s=value==null?'':String(value);
 if(numeric&&s!==''&&!/^-?\d+(?:\.\d+)?$/.test(s))throw reportError(503,'REPORT_VALUE_INVALID');
 if(!numeric&&/^[\s\uFEFF]*[=+@-]/.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
}
export function reportCsv(result){
 const columns=['id','date','reference','party','stockCode','brand','type','quantity','unit','currency','amount','debit','credit','status'];
 const lines=[['Kapsam',result.scope.label],['Başlangıç',result.filters.from],['Bitiş (dahil)',result.filters.to],['Rapor',result.filters.kind],['Para birimi',result.filters.currency||'TRY / USD / EUR ayrı'],['Marka',result.filters.brand],['Ürün türü',result.filters.type],['Gruplama',result.filters.groupBy],...result.scope.limitations.map(v=>['Açıklama',v])].map(r=>r.map(v=>reportCsvCell(v)).join(';'));
 lines.push(columns.map(v=>reportCsvCell(v)).join(';'));
 for(const row of result.rows)lines.push(columns.map(k=>reportCsvCell(row[k],['quantity','amount','debit','credit'].includes(k))).join(';'));
 lines.push('');for(const t of result.currencyTotals)lines.push(['TOPLAM',t.currency,t.amount,t.debit,t.credit,t.recordCount].map((v,i)=>reportCsvCell(v,i>=2)).join(';'));
 return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
