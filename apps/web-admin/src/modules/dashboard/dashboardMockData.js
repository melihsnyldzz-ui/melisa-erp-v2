export const patronKpis = [
  { label: 'Gunluk satis', value: 'TRY 128.450', detail: '42 fis / 318 satir', tone: 'good', screenId: 'sales-invoice' },
  { label: 'Gunluk kar', value: 'TRY 36.780', detail: 'Tahmini %28,6', tone: 'good', screenId: 'sales-invoice' },
  { label: 'Toplam stok degeri', value: 'TRY 4,82M', detail: 'Average cost TRY', tone: 'info', screenId: 'stock-list' },
  { label: 'Musteri borclari', value: 'TRY 1,34M', detail: '12 riskli cari', tone: 'warn', screenId: 'customer-list' },
  { label: 'Tedarikci borclari', value: 'TRY 842K', detail: '5 vadesi yakin', tone: 'warn', screenId: 'purchase-invoice' },
  { label: 'En cok satan urunler', value: '18 urun', detail: 'Ilk 20 rapor', tone: 'info', screenId: 'stock-list' },
  { label: 'Tedarikci performansi', value: '%91', detail: 'Zamaninda teslim', tone: 'good', screenId: 'purchase-invoice' },
  { label: 'Eksi stok uyarisi', value: '7', detail: 'Operasyon devam', tone: 'danger', screenId: 'stock-list' },
  { label: 'Hatali terminal sync', value: '3', detail: 'Kuyruk kontrol', tone: 'danger', screenId: 'catalog-list' },
  { label: 'Katalog performansi', value: '24 teklif', detail: '8 musteriye ozel', tone: 'info', screenId: 'catalog-list' },
];

export const accountingKpis = [
  { label: 'Gunluk tahsilat', value: 'TRY 74.200', detail: '9 islem', tone: 'good', screenId: 'customer-list' },
  { label: 'Gunluk odeme', value: 'TRY 51.600', detail: '4 tedarikci', tone: 'warn', screenId: 'purchase-invoice' },
  { label: 'Cari hareketler', value: '86', detail: 'Bugun islenen', tone: 'info', screenId: 'customer-list' },
  { label: 'En borclu musteriler', value: '12', detail: 'Risk limit ustu', tone: 'danger', screenId: 'customer-list' },
  { label: 'Tedarikci borclari', value: 'TRY 842K', detail: 'Vade kontrol', tone: 'warn', screenId: 'purchase-invoice' },
  { label: 'Son satis fisleri', value: '42', detail: '6 taslak', tone: 'info', screenId: 'sales-invoice' },
  { label: 'Son alis fisleri', value: '11', detail: '3 taslak', tone: 'info', screenId: 'purchase-invoice' },
  { label: 'Hatali fis/sync', value: '5', detail: 'Mudahale gerekli', tone: 'danger', screenId: 'catalog-list' },
  { label: 'Bugunku toplam satis', value: 'TRY 128.450', detail: 'Kesinlesen', tone: 'good', screenId: 'sales-invoice' },
  { label: 'Cari ekstre kisa ozeti', value: '18 cari', detail: 'Hareket bekliyor', tone: 'warn', screenId: 'customer-list' },
];

export const criticalAlerts = [
  { type: 'Eksi stok', subject: 'Pamuk Battaniye / STK-100509', value: '-8', owner: 'Stok', severity: 'danger' },
  { type: 'Hatali terminal sync', subject: 'Terminal-03 / SF-TEMP-188', value: '3 deneme', owner: 'Muhasebe', severity: 'danger' },
  { type: 'Bakiye yuksek musteri', subject: 'Minik Moda Tekstil Ltd.', value: 'TRY 184.250', owner: 'Cari', severity: 'warn' },
  { type: 'Tedarikci borcu', subject: 'Kardelen Bebe Uretim', value: 'TRY 95.500', owner: 'Alis', severity: 'warn' },
  { type: 'Draft fis', subject: 'Satis taslaklari', value: '18 acik', owner: 'Satis', severity: 'info' },
  { type: 'Sync bekleyen terminal kaydi', subject: 'Terminal-07 offline queue', value: '14 paket', owner: 'Terminal', severity: 'warn' },
];

export const recentTransactions = [
  { time: '09:18', document: 'SF-2026-00518', account: 'Minik Moda Tekstil', type: 'Satis', amount: 'TRY 24.245', status: 'Taslak' },
  { time: '09:42', document: 'AF-2026-00207', account: 'Kardelen Bebe Uretim', type: 'Alis', amount: 'TRY 35.911', status: 'Taslak' },
  { time: '10:05', document: 'SF-2026-00519', account: 'Bebek Sarayi', type: 'Satis', amount: 'TRY 18.900', status: 'Kesinlesti' },
  { time: '10:22', document: 'TH-2026-00119', account: 'Little Steps GmbH', type: 'Tahsilat', amount: 'EUR 2.400', status: 'Islendi' },
  { time: '10:48', document: 'SYNC-TERM-188', account: 'Terminal-03', type: 'Sync', amount: '7 satir', status: 'Uyari' },
];

export const topProducts = [
  { code: 'STK-100612', name: 'Patikli Alt Ust Takim', quantity: 84, sales: 'TRY 16.632', stock: 126 },
  { code: 'STK-100245', name: 'Bebek Zibin Takimi 5 Parca', quantity: 61, sales: 'TRY 17.385', stock: 92 },
  { code: 'STK-100411', name: 'Erkek Bebek Tulum', quantity: 48, sales: 'TRY 11.280', stock: 64 },
  { code: 'STK-100318', name: 'Kiz Bebek Elbise Seti', quantity: 31, sales: 'TRY 13.020', stock: 19 },
  { code: 'STK-100509', name: 'Pamuk Battaniye', quantity: 18, sales: 'TRY 9.720', stock: -8 },
];

export const supplierPerformance = [
  { supplier: 'Kardelen Bebe Uretim', openPurchases: 3, delivery: '%94', defect: '%1,2', debt: 'TRY 95.500' },
  { supplier: 'Cotton Baby Global', openPurchases: 2, delivery: '%88', defect: '%2,4', debt: 'USD 12.880' },
  { supplier: 'Pasif Tedarik Havuzu', openPurchases: 0, delivery: '%72', defect: '%5,8', debt: 'TRY 0' },
  { supplier: 'Bursa Bebek Dokuma', openPurchases: 4, delivery: '%91', defect: '%1,9', debt: 'TRY 212.400' },
];

export const receivables = [
  { customer: 'Minik Moda Tekstil Ltd.', balance: 'TRY 184.250', lastMove: '2026-05-19', risk: 'Yuksek' },
  { customer: 'Anadolu Cocuk Giyim', balance: 'TRY 76.900', lastMove: '2026-05-18', risk: 'Orta' },
  { customer: 'Little Steps GmbH', balance: 'EUR 32.640', lastMove: '2026-05-15', risk: 'Kur takip' },
  { customer: 'Eski Bayi Kaydi', balance: 'TRY 7.100', lastMove: '2026-04-28', risk: 'Pasif cari' },
];
