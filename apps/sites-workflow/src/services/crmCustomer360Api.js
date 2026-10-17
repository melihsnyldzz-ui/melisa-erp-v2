import { fetchCustomers } from './customerApi.js';
import { fetchCustomerDetail } from './customerDetailApi.js';

function phoneDigits(value = '') {
  return String(value || '').replace(/[^\d]/g, '');
}

function comparablePhone(value = '') {
  const digits = phoneDigits(value);
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export async function fetchCrmCustomer360ByPhone(phone) {
  const normalizedPhone = phoneDigits(phone);
  const comparable = comparablePhone(normalizedPhone);

  if (comparable.length < 10) {
    return { status: 'unverified-phone', customer: null };
  }

  const listResponse = await fetchCustomers({
    page: 1,
    limit: 20,
    search: comparable,
    activeOnly: false,
  });
  const candidates = Array.isArray(listResponse?.data) ? listResponse.data : [];
  const matches = candidates.filter((customer) => comparablePhone(customer.phoneMasked) === comparable);

  if (matches.length === 0) {
    return { status: 'not-found', customer: null };
  }

  if (matches.length > 1) {
    return { status: 'ambiguous', customer: null, candidates: matches };
  }

  const detailResponse = await fetchCustomerDetail(matches[0].id);
  return {
    status: 'matched',
    customer: detailResponse?.data || matches[0],
  };
}

