export const mockScreenContent = {
  'stock-list': {
    title: 'Stok Listesi',
    subtitle: 'Yoğun stok tablo ekranı / mock',
    filters: ['Kod', 'Barkod', 'Ürün adı', 'Kategori', 'Durum'],
    columns: ['Kod', 'Barkod', 'Ürün Adı', 'Depo', 'Miktar', 'Fiyat', 'Durum'],
    rows: [
      ['STK-000128', '8690001000128', 'Bebek Tulum 0-3 Ay Ekru', 'Ana Depo', '124', '₺245,00', 'Aktif'],
      ['STK-000244', '8690001000244', 'Pamuk Battaniye Mavi', 'Ana Depo', '-3', '₺390,00', 'Eksi'],
      ['STK-000311', '8690001000311', 'Zıbın Seti 5 Parça', 'Ana Depo', '58', '₺315,00', 'Aktif'],
      ['STK-000487', '8690001000487', 'Penye Şapka Seti', 'Ana Depo', '11', '₺74,00', 'Kritik'],
    ],
    summary: ['Kayıt: 12.450', 'Filtre: aktif', 'Eksi stok: 7'],
  },
  'product-card': {
    title: 'Ürün Kartı',
    subtitle: 'Temel bilgiler + barkod/fiyat/hareket blokları',
    fields: [
      ['Ürün Kodu', 'STK-000128'],
      ['Ürün Adı', 'Bebek Tulum 0-3 Ay Ekru'],
      ['Kategori', 'Yenidoğan'],
      ['Birim', 'Adet'],
      ['KDV', '%10'],
      ['Durum', 'Aktif'],
    ],
    columns: ['Barkod', 'Birim', 'Liste Fiyatı', 'Döviz', 'Son Hareket'],
    rows: [
      ['8690001000128', 'Adet', '₺245,00', 'TRY', 'Satış'],
      ['8690001000129', 'Paket', '₺1.190,00', 'TRY', 'Alış'],
    ],
    summary: ['Depo stok: 124', 'Ortalama maliyet: ₺168,40', 'Son hareket: bugün'],
  },
  'customer-list': {
    title: 'Cari Listesi',
    subtitle: 'Müşteri / tedarikçi yoğun liste ekranı',
    filters: ['Cari kod', 'Unvan', 'Tip', 'Risk', 'Bakiye'],
    columns: ['Cari Kod', 'Unvan', 'Tip', 'Bakiye', 'Risk Limiti', 'Durum'],
    rows: [
      ['CR-00045', 'Melisa Toptan Alıcı', 'Müşteri', '₺92.100', '₺100.000', 'Aktif'],
      ['CR-00078', 'ABC Kids', 'Müşteri', '₺118.400', '₺90.000', 'Risk'],
      ['TD-00012', 'Bursa Bebek', 'Tedarikçi', '₺48.900', '₺150.000', 'Aktif'],
    ],
    summary: ['Cari: 2.180', 'Riskte: 12', 'Açık bakiye: ₺1.42M'],
  },
  'sales-invoice': {
    title: 'Satış Fişi',
    subtitle: 'Taslak fiş / satır girişi mock ekranı',
    fields: [
      ['Belge No', 'SF-TASLAK-0042'],
      ['Cari', 'MELISA TOPTAN ALICI'],
      ['Depo', 'Ana Depo'],
      ['Para Birimi', 'TRY'],
    ],
    columns: ['Barkod', 'Kod', 'Ürün', 'Miktar', 'Fiyat', 'İsk.', 'Tutar'],
    rows: [
      ['8690001000128', 'STK-000128', 'Bebek Tulum', '12', '₺245,00', '%5', '₺2.793,00'],
      ['8690001000311', 'STK-000311', 'Zıbın Seti', '8', '₺315,00', '%0', '₺2.520,00'],
    ],
    summary: ['Satır: 2', 'Ara toplam: ₺5.460', 'Genel toplam: ₺5.313'],
  },
  'purchase-invoice': {
    title: 'Alış Fişi',
    subtitle: 'Alış girişi / stok artışı mock ekranı',
    fields: [
      ['Belge No', 'AF-TASLAK-0027'],
      ['Tedarikçi', 'BURSA BEBEK'],
      ['Depo', 'Ana Depo'],
      ['Para Birimi', 'TRY'],
    ],
    columns: ['Kod', 'Ürün', 'Miktar', 'Birim Maliyet', 'Döviz', 'Tutar'],
    rows: [
      ['STK-000522', 'Kadife Uyku Tulumu', '24', '₺410,00', 'TRY', '₺9.840'],
      ['STK-000618', 'Yenidoğan Eldiven', '100', '₺28,00', 'TRY', '₺2.800'],
    ],
    summary: ['Satır: 2', 'Stok etkisi: taslak yok', 'Genel toplam: ₺12.640'],
  },
  'catalog-list': {
    title: 'Katalog Listesi',
    subtitle: 'Katalog seçimi ve ürün eşleştirme mock ekranı',
    filters: ['Katalog', 'Müşteri', 'Durum', 'Tarih'],
    columns: ['Katalog No', 'Ad', 'Müşteri', 'Ürün', 'Durum', 'Son Güncelleme'],
    rows: [
      ['KT-2026-001', 'Yaz Sezonu Bebek', 'Genel', '184', 'Aktif', '21.05.2026'],
      ['KT-2026-002', 'ABC Kids Özel', 'ABC Kids', '46', 'Taslak', '20.05.2026'],
      ['KT-2026-003', 'Yeni Doğan Setleri', 'Genel', '72', 'Aktif', '18.05.2026'],
    ],
    summary: ['Aktif katalog: 18', 'Taslak: 4', 'Görsel eşleşmeyen: 11'],
  },
};
