const demoSuppliers = [
  {
    id: 501,
    supplierCode: 'SUP-DEMO-501',
    supplierName: 'Kardelen Bebe Uretim',
    phoneMasked: '0212****01',
    city: 'Istanbul',
    country: 'Turkiye',
    currency: 'TRY',
    balance: 95500,
    isPassive: false,
  },
  {
    id: 502,
    supplierCode: 'SUP-DEMO-502',
    supplierName: 'Bursa Bebek',
    phoneMasked: '0224****18',
    city: 'Bursa',
    country: 'Turkiye',
    currency: 'TRY',
    balance: 68400,
    isPassive: false,
  },
  {
    id: 503,
    supplierCode: 'SUP-DEMO-503',
    supplierName: 'Cotton Baby Global',
    phoneMasked: '+90****44',
    city: 'Izmir',
    country: 'Turkiye',
    currency: 'TRY',
    balance: 42000,
    isPassive: false,
  },
];

function filterSuppliers({ search = '', activeOnly = true } = {}) {
  const query = String(search || '').toLowerCase();

  return demoSuppliers.filter((supplier) => {
    const activeMatch = !activeOnly || !supplier.isPassive;
    const searchMatch = !query || [
      supplier.supplierCode,
      supplier.supplierName,
      supplier.phoneMasked,
      supplier.city,
      supplier.country,
    ].some((value) => String(value || '').toLowerCase().includes(query));

    return activeMatch && searchMatch;
  });
}

export function demoSuppliersResponse(params = {}) {
  const data = filterSuppliers(params);
  return { success: true, data, meta: { page: 1, limit: data.length, total: data.length } };
}

export function demoSupplierDetailResponse(id) {
  const supplier = demoSuppliers.find((item) => String(item.id) === String(id)) || demoSuppliers[0];
  return { success: true, data: supplier };
}
