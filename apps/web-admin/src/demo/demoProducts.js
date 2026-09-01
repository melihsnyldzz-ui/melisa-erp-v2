import { normalizeSearchText } from '../utils/searchText.js';

const demoProducts = [
  {
    id: 101,
    stockCode: 'STK-100245',
    barcodeMasked: '8690001002451',
    productName: 'Bebek Zıbın Takımı 5 Parça',
    brand: 'Melisa Baby',
    category: 'Yenidoğan',
    currency: 'TRY',
    salePrice: 285,
    purchasePrice: 164,
    stockQuantity: 420,
    supplierName: 'Kardelen Bebe Üretim',
    isPassive: false,
    averageCostTry: 164,
    lastPurchaseDate: '2026-05-29',
    lastSaleDate: '2026-05-31',
  },
  {
    id: 102,
    stockCode: 'STK-100318',
    barcodeMasked: '8690001003182',
    productName: 'Kız Bebek Elbise Seti',
    brand: 'Little Star',
    category: 'Elbise',
    currency: 'TRY',
    salePrice: 420,
    purchasePrice: 248,
    stockQuantity: 118,
    supplierName: 'Bursa Bebek',
    isPassive: false,
    averageCostTry: 248,
    lastPurchaseDate: '2026-05-28',
    lastSaleDate: '2026-05-31',
  },
  {
    id: 103,
    stockCode: 'STK-100509',
    barcodeMasked: '8690001005094',
    productName: 'Pamuk Battaniye',
    brand: 'Soft Baby',
    category: 'Battaniye',
    currency: 'TRY',
    salePrice: 540,
    purchasePrice: 371,
    stockQuantity: -3,
    supplierName: 'Cotton Baby Global',
    isPassive: false,
    averageCostTry: 371,
    lastPurchaseDate: '2026-05-21',
    lastSaleDate: '2026-05-31',
  },
  {
    id: 104,
    stockCode: 'STK-OLD-044',
    barcodeMasked: '8690001000044',
    productName: 'Eski Sezon Tulum',
    brand: 'Melisa Baby',
    category: 'Tulum',
    currency: 'TRY',
    salePrice: 190,
    purchasePrice: 150,
    stockQuantity: 64,
    supplierName: 'Bursa Bebek',
    isPassive: true,
    averageCostTry: 150,
    lastPurchaseDate: '2026-02-11',
    lastSaleDate: '2026-03-04',
  },
];

function filterProducts({ search = '', activeOnly = true } = {}) {
  const query = normalizeSearchText(search);
  return demoProducts.filter((product) => {
    const activeMatch = !activeOnly || !product.isPassive;
    const searchMatch = !query || [
      product.stockCode,
      product.barcodeMasked,
      product.productName,
      product.brand,
      product.category,
      product.supplierName,
    ].some((value) => normalizeSearchText(value).includes(query));
    return activeMatch && searchMatch;
  });
}

export function demoProductsResponse(params = {}) {
  const data = filterProducts(params);
  return { success: true, data, meta: { page: 1, limit: data.length, total: data.length } };
}

export function demoProductDetailResponse(id) {
  const product = demoProducts.find((item) => String(item.id) === String(id)) || demoProducts[0];
  return { success: true, data: product };
}

export function demoProductWriteResponse(payload = {}, id = 901) {
  return {
    success: true,
    message: 'Demo işlemi kaydedilmedi; gerçek ürün, fiyat veya stok kaydı değiştirilmedi.',
    data: {
      ...demoProducts[0],
      ...payload,
      id: Number(id) || 901,
      barcodeMasked: payload.barcode || demoProducts[0].barcodeMasked,
      isPassive: Boolean(payload.isPassive ?? false),
    },
  };
}

export function demoProductPassiveResponse(id, isPassive) {
  const product = demoProducts.find((item) => String(item.id) === String(id)) || demoProducts[0];
  return {
    success: true,
    message: 'Demo işlemi kaydedilmedi; gerçek ürün, fiyat veya stok kaydı değiştirilmedi.',
    data: { ...product, isPassive },
  };
}
