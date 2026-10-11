// Only navigation metadata belongs here. ERP/CRM own identity and business writes.
export const pages = Object.freeze([
  { id: 'erp', title: 'ERP çalışma ekranı', description: 'Satış, alış, stok, tahsilat ve ödeme işlemleri.', path: '/ornek-akis.html', service: 'erp', label: 'ERP’yi aç', icon: 'E', kind: 'test' },
  { id: 'crm', title: 'CRM · Müşterilerim', description: 'Müşteri ürünleri ve sipariş taslaklarını inceleyin.', service: 'crm', label: 'CRM’i aç', icon: 'C', kind: 'crm' },
  { id: 'receiving', title: 'Zebra · Mal kabul', description: 'Gelen malı sayın ve İlker kontrolüne gönderin.', path: '/terminal.html#goods', service: 'terminal', label: 'Mal kabulü aç', icon: 'Z', kind: 'test' },
  { id: 'products', title: 'Zebra · Ürünler', description: 'Barkod okutun; ürün kartını ve stoğu inceleyin.', path: '/terminal.html#products', service: 'terminal', label: 'Ürünleri aç', icon: 'Ü', kind: 'test' },
]);

export const lessons = Object.freeze([
  { id: 'receiving', title: 'Mal kabul', description: 'Sayım → İlker kontrolü → Muhasebe', duration: '3 dk' },
  { id: 'sale', title: 'Satış', description: 'Taslağı hazırlama ve satış fişi', duration: '3 dk' },
  { id: 'purchase', title: 'Alış faturası', description: 'Onaylanan kabulden faturaya', duration: '3 dk' },
  { id: 'collection', title: 'Tahsilat', description: 'Satış fişine bağlı tahsilat', duration: '2 dk' },
  { id: 'payment', title: 'Ödeme', description: 'Tedarikçi borcuna bağlı ödeme', duration: '2 dk' },
  { id: 'return', title: 'İade', description: 'Kaynak belge ve yetkili onayı', duration: '3 dk' },
  { id: 'count', title: 'Sayım', description: 'Fiziksel sayım ve stok farkı', duration: '3 dk' },
  { id: 'crm-order', title: 'CRM siparişi', description: 'Müşteri isteğinden sipariş taslağına', duration: '2 dk' },
]);

export const acceptanceChecks = Object.freeze([
  { title: 'Kendi hesabıyla giriş', detail: 'Personel, İlker ve muhasebe kendi hesaplarıyla açar; yalnız kendi yetkilerini görür.' },
  { title: 'Mal kabulde görev devri', detail: 'Personel sayar ve gönderir. İlker mevcut yetkisiyle kontrol eder. Muhasebe belgeyi, tutarı ve dövizi inceler.' },
  { title: 'Zebra’da fiziksel barkod turu', detail: 'Gerçek cihazda barkod, ürün eşleşmesi ve ekran okunabilirliği birlikte kontrol edilir.' },
  { title: 'CRM’den ERP’ye geçiş', detail: 'Müşteri ve sipariş taslağı incelenir; ERP’de yetkili kişinin kendi hesabıyla giriş yaptığı doğrulanır.' },
  { title: 'Belge ve işlem sonucu', detail: 'Seçilen test senaryosunda bağlı belge, adet ve döviz kontrol edilir; belirsiz sonuçta aynı işlem doğrulanır.' },
  { title: 'Şirket ve ev erişimi', detail: 'Şirkette LAN, evde yetkili Tailscale cihazı ile ekranlar açılır; kullanıcı kabulü ayrıca kaydedilir.' },
]);

export const serviceRows = Object.freeze([
  { id: 'erp', label: 'ERP · paylaşılan test kopyası', page: 'erp' },
  { id: 'crm', label: 'CRM · test', page: 'crm' },
  { id: 'terminal', label: 'Zebra · mal kabul ve ürün', page: 'receiving' },
  { id: 'training', label: '8 kısa eğitim dersi', page: 'training' },
  { id: 'test125', label: 'Orijinal ERP · TEST125', page: 'test125' },
  { id: 'live', label: 'Canlı ekran', page: 'live' },
]);

// Add future approved TEST pages here with root-relative paths. Runtime config
// can also supply vetted links; the UI validates both without accepting HTML.
export const futurePages = Object.freeze([]);
