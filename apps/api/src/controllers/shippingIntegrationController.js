import { nakliyatShippingClient } from '../services/nakliyatShippingService.js';
import { created, fail, ok } from '../utils/response.js';

function shippingFailure(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Nakliyat/FedEx işlemi tamamlanamadı.',
  );
}

export async function getFedexIntegrationStatus(_req, res) {
  const status = await nakliyatShippingClient.getStatus();
  return ok(res, status, { source: 'nakliyat-readiness' });
}

export async function createFedexShippingQuote(req, res) {
  try {
    const data = await nakliyatShippingClient.createQuote(req.body, req.get('idempotency-key'));
    return created(res, data, { source: 'nakliyat-shipping-quote' });
  } catch (error) {
    return shippingFailure(res, error, 'NAKLIYAT_QUOTE_CREATE_FAILED');
  }
}

export async function getFedexShippingRates(req, res) {
  try {
    const data = await nakliyatShippingClient.getRates(req.params.id, req.body?.expectedCurrency);
    return ok(res, data, { source: 'nakliyat-fedex-production-rates' });
  } catch (error) {
    return shippingFailure(res, error, 'NAKLIYAT_RATE_REQUEST_FAILED');
  }
}

export async function createFedexCustomerQuote(req, res) {
  try {
    const data = await nakliyatShippingClient.createCustomerQuote(req.params.id, req.body);
    return created(res, data, { source: 'nakliyat-customer-quote' });
  } catch (error) {
    return shippingFailure(res, error, 'NAKLIYAT_CUSTOMER_QUOTE_FAILED');
  }
}

export async function finalizeFedexCustomerQuote(req, res) {
  try {
    const data = await nakliyatShippingClient.finalizeCustomerQuote(req.params.id);
    return ok(res, data, { source: 'nakliyat-customer-quote-finalize' });
  } catch (error) {
    return shippingFailure(res, error, 'NAKLIYAT_FINALIZE_FAILED');
  }
}

export async function downloadFedexCustomerQuotePdf(req, res) {
  try {
    const { buffer, contentType } = await nakliyatShippingClient.getCustomerQuotePdf(req.params.id);
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fedex-teklif-${req.params.id}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.send(buffer);
  } catch (error) {
    return shippingFailure(res, error, 'NAKLIYAT_PDF_FAILED');
  }
}
