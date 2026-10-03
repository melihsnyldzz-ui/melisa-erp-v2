export const fedexMicroExportDemo = {
  mode: 'DEMO',
  reference: 'MX-DEMO-AHM10350',
  invoice: {
    documentNo: 'AHM10350',
    source: 'Vega F0102 / D0007 (salt okunur)',
    currency: 'EUR',
    declaredValue: 3773.30,
    itemCount: 20,
    totalQuantity: 679,
  },
  exporter: {
    company: 'Semih Bebe',
    country: 'Türkiye',
    contact: 'Semih Şenyıldız',
    phone: '+90 538 721 77 33',
    email: 'semih@melisababy.com',
  },
  recipient: {
    company: 'Gonta Commercial',
    contact: 'Semih Şenyıldız',
    addressLine1: '1 Lear',
    city: 'Bailieborough',
    state: 'Co. Cavan',
    postalCode: 'A82 F704',
    country: 'Ireland',
    countryCode: 'IE',
    phone: '+90 538 721 77 33',
    email: 'semih@melisababy.com',
    taxNumber: '77777777',
  },
  defaults: {
    incoterm: 'DAP',
    originCountry: 'Türkiye',
    packageCount: 8,
    packageLengthCm: 60,
    packageWidthCm: 40,
    packageHeightCm: 40,
    packageGrossKg: 18,
  },
};

const syntheticMaterialKeywords = ['VELSOFT', 'POLAR', 'POLYESTER', 'SENTETİK', 'SENTETIK'];

function resolveMaterialRule(productName) {
  const normalizedName = String(productName || '').toLocaleUpperCase('tr-TR');
  const isSynthetic = syntheticMaterialKeywords.some((keyword) => normalizedName.includes(keyword));

  return isSynthetic
    ? { material: 'Sentetik içerik', materialRule: 'Ürün adında sentetik malzeme işareti var' }
    : { material: 'Pamuk içerik', materialRule: 'Aksi belirtilmediği için varsayılan pamuk kuralı' };
}

export const fedexMicroExportItems = [
  ['2004 MELİSA', '5 Lİ SET', 80, 832.00, '6111.20.90.00.00', 'Orta'],
  ['8051 MELİSA', 'BATTANİYE', 5, 29.00, '6301.30.10.00.00', 'Düşük'],
  ['8052 MELİSA', 'BATTANİYE', 5, 29.00, '6301.30.10.00.00', 'Düşük'],
  ['8050 MELİSA', 'BATTANİYE', 5, 29.00, '6301.30.10.00.00', 'Düşük'],
  ['4556 MİOMİNİ', 'ŞIK ERKEK PATİKLİ TULUM', 16, 136.00, '6111.20.90.00.00', 'Orta'],
  ['4607 MY MİO', 'ŞAPKALI TULUM', 40, 352.00, '6111.20.90.00.00', 'Orta'],
  ['056 PAKEL', 'ARABA BASKILI PATİKLİ TULUM', 40, 216.00, '6111.20.90.00.00', 'Orta'],
  ['9245 DEMİRDAĞ', 'KRUVAZE HASTANE ÇIKIŞI', 75, 168.75, '6111.20.90.00.00', 'Düşük'],
  ['1330 PERA BABY', 'TULUM', 100, 400.00, '6111.20.90.00.00', 'Düşük'],
  ['2020 MİNİDAY BABY', 'FLORA ROMPER', 39, 187.20, '6111.20.90.00.00', 'Düşük'],
  ['10410 MURAT BABY', 'BADİ TKM', 16, 81.60, '6111.20.90.00.00', 'Orta'],
  ['10806 MURAT BABY', 'PREMIUM BABY SET', 3, 25.50, '6111.20.90.00.00', 'Orta'],
  ['9998 MURAT BABY', 'KADİFE TULUM', 40, 168.00, '6111.20.90.00.00', 'Orta'],
  ['9889 MURAT BABY', 'KADİFE ŞAPKALI TULUM', 15, 55.50, '6111.20.90.00.00', 'Orta'],
  ['10057 MURAT BABY', 'KADİFE TAKIM', 20, 92.00, '6111.20.90.00.00', 'Orta'],
  ['7994 BUUDE KİDS', 'BATTANİYE', 20, 106.00, '6301.30.10.00.00', 'Düşük'],
  ['261062 BOM-BİBO', 'BADİLİ TAKIM', 45, 173.25, '6111.20.90.00.00', 'Orta'],
  ['261141 BOM-BİBO', 'PREMATÜRE TULUM', 15, 46.50, '6111.20.90.00.00', 'Orta'],
  ['7104 NEHAD', 'VELSOFT TULUM', 60, 396.00, '6111.30.90.00.00', 'Yüksek'],
  ['7090 NEHAD', 'VELSOFT TULUM', 40, 250.00, '6111.30.90.00.00', 'Yüksek'],
].map(([stockCode, productName, quantity, lineTotal, gtip, confidence], index) => ({
  id: index + 1,
  stockCode,
  productName,
  quantity,
  lineTotal,
  gtip,
  confidence,
  ...resolveMaterialRule(productName),
}));

export const fedexMicroExportSteps = [
  { id: 'file', label: 'Dosya', detail: 'Fiş ve uygunluk' },
  { id: 'parties', label: 'Taraflar', detail: 'Gönderici / alıcı' },
  { id: 'products', label: 'Ürün & GTİP', detail: '20 stok kartı' },
  { id: 'packages', label: 'Koli Planı', detail: 'Ölçü ve ağırlık' },
  { id: 'documents', label: 'Belgeler', detail: 'Fatura / çeki' },
  { id: 'fedex', label: 'FedEx', detail: 'Servis taslağı' },
  { id: 'approval', label: 'Son Onay', detail: 'Gönderim kapısı' },
];
