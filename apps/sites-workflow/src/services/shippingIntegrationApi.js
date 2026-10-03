import { download, get, post } from './apiClient.js';

export async function fetchFedexIntegrationStatus() {
  const response = await get('/api/shipping/fedex/status');
  return response.data;
}

export async function createFedexShippingQuote(payload) {
  const response = await post('/api/shipping/fedex/quotes', payload);
  return response.data;
}

export async function fetchFedexProductionRates(shippingQuoteId, expectedCurrency) {
  const response = await post(`/api/shipping/fedex/quotes/${shippingQuoteId}/rates`, { expectedCurrency });
  return response.data;
}

export async function createFedexCustomerQuote(shippingQuoteId, payload) {
  const response = await post(`/api/shipping/fedex/quotes/${shippingQuoteId}/customer-quotes`, payload);
  return response.data;
}

export async function finalizeFedexCustomerQuote(customerQuoteId) {
  const response = await post(`/api/shipping/fedex/customer-quotes/${customerQuoteId}/finalize`, {});
  return response.data;
}

export async function downloadFedexCustomerQuotePdf(customerQuoteId, quoteNumber = customerQuoteId) {
  return download(`/api/shipping/fedex/customer-quotes/${customerQuoteId}/pdf`, `${quoteNumber}.pdf`);
}
