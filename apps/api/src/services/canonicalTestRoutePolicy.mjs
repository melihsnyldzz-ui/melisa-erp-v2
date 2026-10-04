// These routes add authentication/permissions and validate the existing named
// TEST scope before calling the canonical invoice, finance and movement services.
export function isCanonicalTestWriteAllowed(method,path,{writes=false,mode='native'}={}){
 if(method==='POST'&&/^\/api\/auth\/(?:login|terminal-login)$/.test(path))return true;
 if(!writes||mode!=='erp'||method!=='POST')return false;
 return /^\/api\/sales-invoices\/(?:test-complete|[1-9]\d*\/cancel)$/.test(path)
  || /^\/api\/finance\/collections(?:\/[1-9]\d*\/(?:cancel|refund))?$/.test(path)
  || path==='/api/test-finance/preview'
  || /^\/api\/test-purchase\/(?:goods(?:\/[1-9]\d*\/(?:approve|reject))?|invoices(?:\/[1-9]\d*\/cancel)?)$/.test(path)
  || /^\/api\/test-purchase\/(?:batches(?:\/[1-9]\d*\/(?:approve|reject))?|invoice-drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)$/.test(path)
  || /^\/api\/test-purchase-fx\/(?:preview|receipts(?:\/[1-9]\d*\/(?:approve|reject))?|invoice-drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)$/.test(path)
  || /^\/api\/test-refund\/(?:prepare|receive|[1-9]\d*\/cancel)$/.test(path)
  || /^\/api\/test-payment\/payments(?:\/[1-9]\d*\/cancel)?$/.test(path)
  || /^\/api\/test-daily\/(?:purchase|sales|fx|count|count-cancel|return-cancel)\/(?:prepare|draft|approve|reject|cancel|collect|preview|reverse|prepare-partial-goods|sale|purchase)$/.test(path);
}
