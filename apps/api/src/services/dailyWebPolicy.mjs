import {AsyncLocalStorage} from 'node:async_hooks';

// Only server-owned runtime policy and route matching can open this context.
// It scopes daily web/customer and currency checks, never terminal or product/stock policy.
const dailyWebContext = new AsyncLocalStorage();
const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const dailyFinanceWrites = new Set([
  '/payments',
  '/cash-register/open',
  '/cash-register/expenses',
  '/cash-register/transfers',
  '/cash-register/close',
]);

export function resolveDailyWebPolicy(config = {}) {
  for (const key of ['dailyWebEnabled', 'automaticCardSyncEnabled', 'invoiceExportEnabled']) {
    if (config[key] !== undefined && typeof config[key] !== 'boolean') {
      throw new Error(`Invalid boolean runtime policy: ${key}`);
    }
  }
  const dailyWebEnabled = config.dailyWebEnabled === true;
  return Object.freeze({
    dailyWebEnabled,
    automaticCardSyncEnabled: config.automaticCardSyncEnabled ?? !dailyWebEnabled,
    invoiceExportEnabled: config.invoiceExportEnabled ?? !dailyWebEnabled,
  });
}

export function isDailyWebCorePath(path) {
  return typeof path === 'string' && (/^\/(?:customers|sales-invoices|purchase-invoices)(?:\/|$)/i.test(path)
    || /^\/work-sales\/(?:preview|drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)$/.test(path));
}

export function dailyWebScopeMiddleware(policy) {
  const enabled = policy.dailyWebEnabled === true;
  return (req, _res, next) => dailyWebContext.run(
    enabled && (isDailyWebCorePath(req.path)
      || (req.method === 'POST' && /^\/finance\/(?:collections|payments)$/i.test(req.path))), next,
  );
}

export const isDailyWebRequest = () => dailyWebContext.getStore() === true;
export const isDailyWebCustomerScope = isDailyWebRequest;

export function assertDailyWebCurrency(accountCurrency, documentCurrency) {
  if (!['TRY', 'USD', 'EUR'].includes(accountCurrency) || accountCurrency !== documentCurrency) {
    throw Object.assign(new Error('Cari ve işlem para birimi aynı olmalı; çapraz döviz cari işlemi bu kapsamda desteklenmiyor.'), {
      code: 'DAILY_WEB_CURRENCY_UNSUPPORTED', statusCode: 409,
    });
  }
}

export function assertDailyWebCustomer(row, documentCurrency) {
  if (!row || !row.is_active || row.is_deleted) {
    throw Object.assign(new Error('Günlük satış için aktif, silinmemiş bir müşteri gerekli.'), {
      code: 'DAILY_WEB_CUSTOMER_UNAVAILABLE', statusCode: 409,
    });
  }
  // The invoice service validates and persists both currency amounts/rate snapshots.
  if (!['TRY', 'USD', 'EUR'].includes(row.currency_code) || !['TRY', 'USD', 'EUR'].includes(documentCurrency)) {
    throw Object.assign(new Error('Cari ve işlem para birimi TRY, USD veya EUR olmalıdır.'), { code: 'DAILY_WEB_CURRENCY_UNSUPPORTED', statusCode: 409 });
  }
}

export function pilotFinanceRequestAllowed(method, path, policy) {
  return readMethods.has(method)
    || (method === 'POST' && path === '/collections')
    || (policy.dailyWebEnabled === true && method === 'POST' && dailyFinanceWrites.has(path));
}

export function pilotCardSyncRequestAllowed(method, policy) {
  return readMethods.has(method) || policy.automaticCardSyncEnabled === true;
}

export function pilotCustomerRoutesRequestAllowed(method,path,policy){
 if(readMethods.has(method))return true;
 if(policy.dailyWebEnabled!==true)return false;
 return (method==='POST'&&path==='/')
  || (method==='PUT'&&(path==='/assignments'||/^\/[1-9]\d*$/.test(path)));
}
