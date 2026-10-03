import { normalizeSearchText } from '../utils/searchText.js';

export const demoCustomers = [
  {
    id: 201,
    customerCode: 'CR-RO-001',
    customerName: 'Bucharest Baby SRL',
    phoneMasked: '+40 *** *** 142',
    city: 'Bucharest',
    country: 'Romanya',
    currency: 'USD',
    customerType: 'wholesale',
    balance: 582000,
    isPassive: false,
    lastTransactionDate: '2026-05-29',
  },
  {
    id: 202,
    customerCode: 'CR-BG-014',
    customerName: 'Sofia Mini Wear',
    phoneMasked: '+359 *** *** 810',
    city: 'Sofia',
    country: 'Bulgaristan',
    currency: 'USD',
    customerType: 'wholesale',
    balance: 214000,
    isPassive: false,
    lastTransactionDate: '2026-05-24',
  },
  {
    id: 203,
    customerCode: 'CR-GE-008',
    customerName: 'Tbilisi Kids Market',
    phoneMasked: '+995 *** *** 525',
    city: 'Tbilisi',
    country: 'Gürcistan',
    currency: 'USD',
    customerType: 'wholesale',
    balance: 98000,
    isPassive: false,
    lastTransactionDate: '2026-05-18',
  },
  {
    id: 204,
    customerCode: 'CR-OLD-031',
    customerName: 'Dormant Balkan Buyer',
    phoneMasked: '+381 *** *** 119',
    city: 'Belgrade',
    country: 'Sırbistan',
    currency: 'USD',
    customerType: 'wholesale',
    balance: 0,
    isPassive: true,
    lastTransactionDate: '2026-02-02',
  },
];

export const demoCashCustomers = [
  { id: 211, customerCode: 'PESIN-TL', customerName: 'Peşin TL', phoneMasked: '', city: 'İstanbul', country: 'Türkiye', currency: 'TRY', customerType: 'cash', balance: 0, isPassive: false, lastTransactionDate: '' },
  { id: 212, customerCode: 'PESIN-USD', customerName: 'Peşin USD', phoneMasked: '', city: 'İstanbul', country: 'Türkiye', currency: 'USD', customerType: 'cash', balance: 0, isPassive: false, lastTransactionDate: '' },
  { id: 213, customerCode: 'PESIN-EUR', customerName: 'Peşin EUR', phoneMasked: '', city: 'İstanbul', country: 'Türkiye', currency: 'EUR', customerType: 'cash', balance: 0, isPassive: false, lastTransactionDate: '' },
];

function filterCustomers({ search = '', activeOnly = true } = {}) {
  const query = normalizeSearchText(search);
  return demoCustomers.filter((customer) => {
    const activeMatch = !activeOnly || !customer.isPassive;
    const searchMatch = !query || [
      customer.customerCode,
      customer.customerName,
      customer.phoneMasked,
      customer.city,
      customer.country,
    ].some((value) => normalizeSearchText(value).includes(query));
    return activeMatch && searchMatch;
  });
}

export function demoCustomersResponse(params = {}) {
  const data = [...filterCustomers(params), ...demoCashCustomers.filter((customer) => {
    const query = normalizeSearchText(params.search || '');
    return !query || normalizeSearchText(`${customer.customerCode} ${customer.customerName}`).includes(query);
  })];
  return { success: true, data, meta: { page: 1, limit: data.length, total: data.length } };
}

export function demoCashCustomersResponse() {
  return {
    success: true,
    message: 'Demo peşin carileri hazırlandı; gerçek cari kaydı oluşturulmadı.',
    data: structuredClone(demoCashCustomers),
    meta: { synthetic: true, writePerformed: false },
  };
}

export function demoCustomerDetailResponse(id) {
  const customer = demoCustomers.find((item) => String(item.id) === String(id)) || demoCustomers[0];
  return { success: true, data: customer };
}

export function demoCustomerWriteResponse(payload = {}, id = 901) {
  return {
    success: true,
    message: 'Demo işlemi kaydedilmedi; gerçek müşteri veya cari kaydı değiştirilmedi.',
    data: {
      ...demoCustomers[0],
      ...payload,
      id: Number(id) || 901,
      phoneMasked: payload.phone || demoCustomers[0].phoneMasked,
      balance: 0,
      isPassive: Boolean(payload.isPassive ?? false),
      lastTransactionDate: '',
    },
  };
}

export function demoCustomerPassiveResponse(id, isPassive) {
  const customer = demoCustomers.find((item) => String(item.id) === String(id)) || demoCustomers[0];
  return {
    success: true,
    message: 'Demo işlemi kaydedilmedi; gerçek müşteri veya cari kaydı değiştirilmedi.',
    data: { ...customer, isPassive },
  };
}
