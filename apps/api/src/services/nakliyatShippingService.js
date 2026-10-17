import { env } from '../config/env.js';

const allowedCurrencies = new Set(['EUR', 'USD', 'GBP']);

function shippingError(code, message, statusCode = 503, details = null) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function cleanIdentifier(value, label) {
  const normalized = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(normalized)) {
    throw shippingError('NAKLIYAT_INVALID_IDENTIFIER', `${label} geçersiz.`, 400);
  }
  return normalized;
}

function normalizeCurrency(value) {
  const currency = String(value || '').trim().toUpperCase();
  if (!allowedCurrencies.has(currency)) {
    throw shippingError('NAKLIYAT_INVALID_CURRENCY', 'Para birimi EUR, USD veya GBP olmalıdır.', 400);
  }
  return currency;
}

function normalizeQuoteInput(input = {}) {
  const packageCount = Array.isArray(input.packages) ? input.packages.length : 0;
  const currency = normalizeCurrency(input.currency);
  if (!String(input.erpOrderId || '').trim()) {
    throw shippingError('NAKLIYAT_ERP_ORDER_REQUIRED', 'ERP sipariş/fiş referansı zorunludur.', 400);
  }
  if (!String(input.customerName || '').trim() || !String(input.destinationCountryCode || '').trim()
    || !String(input.destinationCity || '').trim() || !String(input.destinationPostalCode || '').trim()) {
    throw shippingError('NAKLIYAT_DESTINATION_REQUIRED', 'Alıcı adı, ülke, şehir ve posta kodu zorunludur.', 400);
  }
  if (packageCount < 1 || packageCount > 20) {
    throw shippingError('NAKLIYAT_PACKAGE_COUNT_INVALID', 'Koli sayısı 1 ile 20 arasında olmalıdır.', 400);
  }

  const packages = input.packages.map((item, index) => {
    const values = {
      weightKg: Number(item.weightKg),
      lengthCm: Number(item.lengthCm),
      widthCm: Number(item.widthCm),
      heightCm: Number(item.heightCm),
    };
    if (Object.values(values).some((value) => !Number.isFinite(value) || value <= 0)) {
      throw shippingError('NAKLIYAT_PACKAGE_INVALID', `${index + 1}. koli ağırlık ve ölçüleri sıfırdan büyük olmalıdır.`, 400);
    }
    return values;
  });

  return {
    erpOrderId: String(input.erpOrderId).trim(),
    quote: {
      customerName: String(input.customerName).trim(),
      customerPhone: String(input.customerPhone || '').trim() || null,
      customerEmail: String(input.customerEmail || '').trim() || null,
      destinationCountryCode: String(input.destinationCountryCode).trim().toUpperCase(),
      destinationCity: String(input.destinationCity).trim(),
      destinationPostalCode: String(input.destinationPostalCode).trim(),
      destinationAddressLine: String(input.destinationAddressLine || '').trim() || null,
      orderValue: Number(input.orderValue),
      currency,
      packages,
    },
  };
}

function safeUpstreamMessage(payload, fallback) {
  if (typeof payload?.message === 'string' && payload.message.length <= 300) return payload.message;
  if (typeof payload?.error?.message === 'string' && payload.error.message.length <= 300) return payload.error.message;
  return fallback;
}

export function createNakliyatShippingClient(config = env.nakliyat, fetchImpl = globalThis.fetch) {
  let accessToken = '';
  let accessTokenExpiresAt = 0;

  function assertEnabled() {
    if (!config.enabled) throw shippingError('NAKLIYAT_DISABLED', 'Nakliyat/FedEx entegrasyonu kapalı.', 503);
    if (!config.baseUrl) throw shippingError('NAKLIYAT_NOT_CONFIGURED', 'Nakliyat API adresi tanımlı değil.', 503);
  }

  function assertGate(gate, code, message) {
    if (!config[gate]) throw shippingError(code, message, 403);
  }

  async function request(path, { method = 'GET', body, authenticated = false, retryAuth = true, headers = {} } = {}) {
    assertEnabled();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 20000);
    try {
      const requestHeaders = { Accept: 'application/json', ...headers };
      if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
      if (authenticated) requestHeaders.Authorization = `Bearer ${await getAccessToken()}`;
      const response = await fetchImpl(new URL(path, config.baseUrl), {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        let payload = null;
        if (contentType.includes('application/json')) payload = await response.json().catch(() => null);
        if (response.status === 401 && authenticated && retryAuth) {
          accessToken = '';
          accessTokenExpiresAt = 0;
          return request(path, { method, body, authenticated, retryAuth: false, headers });
        }
        throw shippingError(
          'NAKLIYAT_UPSTREAM_ERROR',
          safeUpstreamMessage(payload, `Nakliyat servisi ${response.status} hatası döndürdü.`),
          response.status >= 400 && response.status < 500 ? response.status : 503,
        );
      }
      if (contentType.includes('application/pdf')) {
        return { buffer: Buffer.from(await response.arrayBuffer()), contentType };
      }
      return response.json();
    } catch (error) {
      if (error?.code) throw error;
      if (error?.name === 'AbortError') throw shippingError('NAKLIYAT_TIMEOUT', 'Nakliyat servisi zaman aşımına uğradı.', 504);
      throw shippingError('NAKLIYAT_UNREACHABLE', 'Nakliyat servisine ulaşılamadı.', 503);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getAccessToken() {
    if (accessToken && accessTokenExpiresAt > Date.now() + 30000) return accessToken;
    if (!config.serviceEmail || !config.servicePassword) {
      throw shippingError('NAKLIYAT_SERVICE_AUTH_MISSING', 'Nakliyat servis hesabı tanımlı değil.', 503);
    }
    const payload = await request('/api/auth/login', {
      method: 'POST',
      body: { email: config.serviceEmail, password: config.servicePassword },
    });
    if (!payload?.token) throw shippingError('NAKLIYAT_LOGIN_FAILED', 'Nakliyat servis oturumu açılamadı.', 503);
    accessToken = payload.token;
    accessTokenExpiresAt = Date.now() + 10 * 60 * 1000;
    return accessToken;
  }

  async function getStatus() {
    const gates = {
      productionRates: Boolean(config.allowProductionRates),
      draftCreate: Boolean(config.allowDraftCreate),
      customerQuoteCreate: Boolean(config.allowCustomerQuoteCreate),
      finalize: Boolean(config.allowFinalize),
    };
    if (!config.enabled) return { integration: 'DISABLED', connected: false, authenticated: false, gates };
    try {
      const ready = await request('/api/ready');
      return {
        integration: 'ENABLED',
        connected: ready?.status === 'ready',
        authenticated: Boolean(config.serviceEmail && config.servicePassword),
        service: { status: ready?.status, database: ready?.database, environment: ready?.environment },
        fedex: ready?.fedex || null,
        gates,
      };
    } catch (error) {
      return { integration: 'ENABLED', connected: false, authenticated: false, error: { code: error.code, message: error.message }, gates };
    }
  }

  async function createQuote(input, idempotencyKey) {
    assertGate('allowDraftCreate', 'NAKLIYAT_DRAFT_CREATE_LOCKED', 'Nakliyat taslak oluşturma izni kapalı.');
    const normalized = normalizeQuoteInput(input);
    const key = String(idempotencyKey || `erp-${normalized.erpOrderId}`).trim().slice(0, 160);
    const result = await request('/api/shipping-quotes', {
      method: 'POST', authenticated: true, body: normalized.quote, headers: { 'Idempotency-Key': key },
    });
    return { ...result, erpOrderId: normalized.erpOrderId, idempotencyKey: key, upstreamIdempotencyGuaranteed: false };
  }

  async function getRates(id, expectedCurrency) {
    assertGate('allowProductionRates', 'NAKLIYAT_PRODUCTION_RATES_LOCKED', 'Canlı FedEx fiyat sorgusu izni kapalı.');
    const currency = normalizeCurrency(expectedCurrency);
    const result = await request(`/api/shipping-quotes/${cleanIdentifier(id, 'Gönderi taslağı')}/rates`, {
      method: 'POST', authenticated: true, body: {},
    });
    const rates = (Array.isArray(result?.rates) ? result.rates : []).filter((rate) => (
      rate?.environment === 'PRODUCTION'
      && rate?.rateType === 'ACCOUNT'
      && rate?.isStale === false
      && String(rate?.currency || '').toUpperCase() === currency
    ));
    if (!rates.length) {
      throw shippingError('NAKLIYAT_SAFE_RATE_NOT_FOUND', `Üretim, hesap fiyatı, güncel ve ${currency} koşullarını sağlayan güvenli fiyat bulunamadı.`, 409);
    }
    return { quote: result.quote, rates, rejectedRateCount: Math.max(0, (result?.rates?.length || 0) - rates.length) };
  }

  async function createCustomerQuote(id, input) {
    assertGate('allowCustomerQuoteCreate', 'NAKLIYAT_CUSTOMER_QUOTE_LOCKED', 'Müşteri teklifi oluşturma izni kapalı.');
    const carrierRateId = cleanIdentifier(input?.carrierRateId, 'FedEx fiyatı');
    return request(`/api/shipping-quotes/${cleanIdentifier(id, 'Gönderi taslağı')}/customer-quotes`, {
      method: 'POST', authenticated: true, body: { ...input, carrierRateId },
    });
  }

  async function finalizeCustomerQuote(id) {
    assertGate('allowFinalize', 'NAKLIYAT_FINALIZE_LOCKED', 'Müşteri teklifini kesinleştirme izni kapalı.');
    return request(`/api/customer-quotes/${cleanIdentifier(id, 'Müşteri teklifi')}/finalize`, {
      method: 'POST', authenticated: true, body: {},
    });
  }

  async function getCustomerQuotePdf(id) {
    return request(`/api/customer-quotes/${cleanIdentifier(id, 'Müşteri teklifi')}/pdf`, { authenticated: true });
  }

  return { getStatus, createQuote, getRates, createCustomerQuote, finalizeCustomerQuote, getCustomerQuotePdf };
}

export const nakliyatShippingClient = createNakliyatShippingClient();
