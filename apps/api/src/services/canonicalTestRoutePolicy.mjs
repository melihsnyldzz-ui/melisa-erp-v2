// These routes add authentication/permissions and validate the existing named
// TEST scope before calling the canonical invoice, finance and movement services.
export function isCanonicalTestWriteAllowed(method,path,{writes=false,mode='native',protectedNormalAuth=false}={}){
 if(method==='POST'&&/^\/api\/auth\/(?:login|terminal-login)$/.test(path))return true;
 if(!writes||mode!=='erp'||method!=='POST')return false;
 if(protectedNormalAuth===true&&/^\/api\/auth\/(?:refresh|logout|session-confirm)$/.test(path))return true;
 if(/^\/api\/work-supplier-payments\/(?:preview|payments(?:\/[1-9]\d*\/cancel)?)$/.test(path))return true;
 if(/^\/api\/work-purchases\/fx\/(?:preview|receipts(?:\/[1-9]\d*\/(?:approve|reject))?|drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)$/.test(path))return true;
 if(/^\/api\/work-receiving\/(?:count-drafts(?:\/[1-9]\d*\/(?:update|submit|cancel))?|receipts\/[1-9]\d*\/(?:approve|reject))$/.test(path)||/^\/api\/work-purchases\/(?:preview|drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)$/.test(path))return true;
 if(/^\/api\/work-sales\/(?:selected-context|selected-preview|preview|drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)$/.test(path)||/^\/api\/work-collections(?:\/preview|\/[1-9]\d*\/cancel)?$/.test(path))return true;
 if(/^\/api\/customers\/[1-9]\d*\/contact$/.test(path))return true;
 return /^\/api\/sales-invoices\/(?:test-complete|[1-9]\d*\/cancel)$/.test(path)
  || /^\/api\/finance\/collections(?:\/[1-9]\d*\/(?:cancel|refund))?$/.test(path)
  || path==='/api/test-finance/preview'
  || /^\/api\/test-purchase\/(?:goods(?:\/[1-9]\d*\/(?:approve|reject))?|invoices(?:\/[1-9]\d*\/cancel)?)$/.test(path)
  || /^\/api\/test-purchase\/(?:batches(?:\/[1-9]\d*\/(?:approve|reject))?|invoice-drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)$/.test(path)
  || /^\/api\/test-purchase-fx\/(?:preview|receipts(?:\/[1-9]\d*\/(?:approve|reject))?|invoice-drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)$/.test(path)
  || path==='/api/test-supplier-cards/13373/contact'
  || path==='/api/products/301986/current-prices'
  || /^\/api\/test-current-price-purchase\/(?:preview|receipts(?:\/[1-9]\d*\/(?:approve|reject))?|invoice-drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)$/.test(path)
  || /^\/api\/test-refund\/(?:prepare|receive|[1-9]\d*\/cancel)$/.test(path)
  || /^\/api\/test-payment\/payments(?:\/[1-9]\d*\/cancel)?$/.test(path)
  || /^\/api\/test-daily\/(?:purchase|sales|fx|count|count-cancel|return-cancel)\/(?:prepare|draft|approve|reject|cancel|collect|preview|reverse|prepare-partial-goods|sale|purchase)$/.test(path);
}
