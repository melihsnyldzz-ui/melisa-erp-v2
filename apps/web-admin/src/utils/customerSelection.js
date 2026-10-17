import { normalizeSearchText, searchTextIncludes } from './searchText.js';

export function customerSelectionLabel(customer) {
  return `${customer.code || '-'} / ${customer.name || ''}`;
}

export function customerMatchesQuery(customer, query) {
  return searchTextIncludes(customerSelectionLabel(customer), query)
    || searchTextIncludes([customer.code, customer.name, customer.currency].join(' '), query);
}

export function resolveCustomerSelection(customers, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;

  const matchesById = new Map();
  for (const customer of customers) {
    if (customer.id === null || customer.id === undefined || String(customer.id).trim() === '') continue;
    const matches = [customer.code, customer.name, customerSelectionLabel(customer)]
      .some((value) => normalizeSearchText(value) === normalizedQuery);
    if (matches) matchesById.set(String(customer.id), customer);
  }

  return matchesById.size === 1 ? matchesById.values().next().value : null;
}

export function clearInvoiceCustomerSelection(invoice) {
  return {
    ...invoice,
    customerId: '',
    customer: '',
    customerCurrency: '-',
    customerBalanceLabel: '-',
  };
}
