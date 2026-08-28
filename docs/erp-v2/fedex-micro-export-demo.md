# FedEx Mikro İhracat Demo Akışı

## Amaç

Bu ekran, bir satış fişinden FedEx mikro ihracat operasyonuna geçerken gereken veri, belge ve insan kontrollerini ERP içinde canlandırır. İlk senaryo Vega 2026 kaynağındaki `AHM10350` fişi ve İrlanda teslimat adresi için hazırlanmıştır.

## Entegrasyon Mimarisi ve Güvenlik Sınırı

- Tarayıcı FedEx'e veya Nakliyat'a doğrudan bağlanmaz: `ERP web → ERP API → Nakliyat API → FedEx`.
- FedEx anahtarları ERP'de ve tarayıcıda tutulmaz; mevcut Nakliyat servisi FedEx yetkilendirmesinin tek sahibidir.
- Nakliyat sağlık bilgisi salt okunur alınır. Üretim fiyatı, taslak oluşturma, müşteri teklifi ve kesinleştirme ayrı ortam anahtarlarıyla varsayılan kapalıdır.
- Fiyat listesinde yalnızca `PRODUCTION`, `ACCOUNT`, `isStale=false` ve fiş para birimiyle eşleşen kayıtlar kabul edilir.
- FedEx'in `FEDEX_REGIONAL_ECONOMY` ve `FEDEX_REGIONAL_ECONOMY_FREIGHT` servisleri fiyat listesinde **Ekonomik Karayolu** olarak ayrı rozetle gösterilir; seçenek yalnızca canlı FedEx yanıtında bulunduğunda kullanılabilir.
- Bu entegrasyon gönderi, takip numarası, taşıma etiketi veya kurye alımı oluşturmaz; Nakliyat taşıma fiyatı ve müşteri teklif akışını ERP'ye bağlar.
- ETGB ya da başka bir gümrük beyanı göndermez.
- Vega ve Melisa ERP SQL veritabanlarına yazmaz.
- Girilen demo ilerleme durumu yalnızca tarayıcı `localStorage` alanında tutulur.
- Müşteri teklifini kesinleştirme, `sales.finalize` yetkisi, ortam kapısı ve ekranda ikinci insan onayı gerektirir.

## Demo Kaynağı

- Kaynak fiş: `AHM10350`
- Kaynak: Vega `F0102 / D0007`, salt okunur
- Para birimi: EUR
- Beyan değeri: `€3.773,30`
- Ürün: 20 stok kartı
- Miktar: 679 adet
- Hedef ülke: İrlanda

## Ekran Akışı

1. Dosya ön kontrolü
2. Gönderici ve alıcı bilgileri
3. Ürün ve GTİP çalışma listesi
4. Demo koli planı ve ağırlık hesabı
5. Belge paketi kontrolü
6. Nakliyat bağlantı durumu, FedEx hesap fiyatları ve müşteri teklif PDF'i
7. Son onay kapısı

Ekran bir satış fişi gibi ticari belge oluşturmaz. Yalnızca operasyon kontrol listesi ve eğitim senaryosudur.

## Bilinçli Demo Varsayımları

- Koli adedi, ölçüleri ve ağırlıkları gerçek tartım değildir.
- FedEx servis seçimi canlı uygunluk sorgusu değildir.
- Gönderi ücreti ve teslim tarihi üretilmez.
- GTİP kodları yerel çalışma taslağıdır; kesin gümrük sınıflandırması sayılmaz.
- Alıcının vergi/VAT/EORI bilgisi doğrulanmış kabul edilmez.
- `AHM10350` operasyon fişi resmî e-arşiv/e-fatura yerine geçmez.

## Malzeme ve GTİP Varsayılanı

- Aksi açıkça belirtilmedikçe Melisa Baby ürünleri pamuk içerikli kabul edilerek pamuk grubundaki GTİP taslağı seçilir.
- Ürün adında `velsoft`, `polar`, `polyester`, `sentetik` veya eşdeğer açık bir malzeme işareti varsa sentetik içerik grubu seçilir.
- Açık etiket, tedarikçi bilgisi veya ürün teknik belgesi bu varsayımdan üstündür.
- Bu otomatik seçim yalnızca çalışma taslağıdır; gümrük beyanından önce ürün etiketi ve gümrük müşaviri doğrulaması gerekir.

## Ortam Ayarları

API örnek dosyasındaki şu ayarlar kullanılır:

- `NAKLIYAT_ENABLED`
- `NAKLIYAT_API_BASE_URL`
- `NAKLIYAT_SERVICE_EMAIL` ve `NAKLIYAT_SERVICE_PASSWORD`
- `NAKLIYAT_ALLOW_DRAFT_CREATE`
- `NAKLIYAT_ALLOW_PRODUCTION_RATES`
- `NAKLIYAT_ALLOW_CUSTOMER_QUOTE_CREATE`
- `NAKLIYAT_ALLOW_FINALIZE`

Servis hesabı eksikken sağlık durumu görülebilir ancak kimlik doğrulamalı işlemler kapalı kalır. Ortam kapıları tek tek ve kontrollü kabul sonrası açılmalıdır. `Idempotency-Key` ERP referansıyla gönderilir; Nakliyat tarafında kalıcı idempotency henüz garanti edilmediği için çift tıklama/mükerrer istek koruması tamamlanmış sayılmaz.

## Canlı Kullanımdan Önce Kalanlar

- Ayrı ve en az yetkili Nakliyat servis hesabı veya API anahtarı/HMAC
- Nakliyat tarafında `erpOrderId` için kalıcı idempotency garantisi
- Canlı fiyatların fiziksel koli tartımı ve FedEx sözleşme koşullarıyla operasyon ekibi tarafından kabul edilmesi
- Her koli için gerçek net/brüt ağırlık ve ölçü
- Resmî e-arşiv/e-fatura dosyası
- İngilizce commercial invoice ve packing list
- Kesin ürün içerikleri, menşe ve GTİP doğrulaması
- Alıcı VAT/EORI ve ithalatçı bilgilerinin teyidi
- DAP/DDP ve vergi ödeyen tarafın ticari onayı
- Yetki, audit, idempotency ve hata/geri alma tasarımı
- Canlı fiyat ve taşıma koşulları için işlem anı insan onayı

## Kabul Kontrolleri

- `npm.cmd --prefix apps/web-admin run smoke:fedex-micro-export-demo`
- `node scripts/nakliyat-shipping-integration-smoke.mjs`
- `npm.cmd --prefix apps/web-admin run smoke:navigation`
- `npm.cmd --prefix apps/web-admin run build`

Görsel kabul, yetkili ERP oturumu açıldıktan sonra 1366x768 ve 1920x1080 görünümlerinde yapılmalıdır.
