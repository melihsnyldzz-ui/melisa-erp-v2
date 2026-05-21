export const modules = [
  'Ana Sayfa',
  'Stok',
  'Satış',
  'Alış',
  'Cari',
  'Katalog',
  'Raporlar',
  'Terminal',
  'Ayarlar',
  'Yetki / Audit',
];

export const sidebarGroups = [
  {
    title: 'Stok İşlemleri',
    items: ['Stok Listesi', 'Ürün Kartı', 'Barkodlar', 'Stok Hareketleri', 'Pasif Ürünler'],
  },
  {
    title: 'Satış / Alış',
    items: ['Yeni Satış Fişi', 'Taslak Satışlar', 'Alış Fişleri', 'Terminalden Gelenler'],
  },
  {
    title: 'Hızlı Filtreler',
    items: ['Eksi Stok', 'Bugünkü Fişler', 'Hatalı Sync', 'Borç Riski'],
  },
];

export const tabs = [
  { label: 'Dashboard', active: true },
  { label: 'Stok Listesi', active: false },
  { label: 'Satış Fişi: Taslak', active: false, dirty: true },
  { label: 'Cari Ekstre', active: false },
];
