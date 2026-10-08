# ERP-MIGUNIFIED01 — birleşik migration dilimi

8 Ekim 2026; ERP-DEC-028 ve PR23/6053236196. Bu dilim ürün kart alış bilgisini ayrı TEST metadata alanına uygular; cari/finans, stok miktarı, satış fiyatı, kasa/banka, Vega, LIVE, CRM ve gerçek T1 yazma yetkisi değildir. Önceki dört UNKNOWN tedarikçi kartı ve Goal7.3'te uygulanmış16 hesap korunur. Genel migration tamamlanmış veya insan kabulü verilmiş sayılmaz.

## Ürün alış bilgisi sözleşmesi

Mevcut `erp_migration` şemasındaki ayrı, immutable run/row/proof tabloları kullanılır; ikinci ürün veritabanı kurulmaz. Kaynak `APB`, `ALISFIYATI`/`DALISFIYATI`, `ALISISKORANI` ve exact ana birim kimliği bağlanır. TRY için yerel alış, USD/EUR için döviz alış alanı kullanılır; APB eksikse TRY uydurulmaz. Eksik alan NULL kalır; bilinen tutar kaybolmaz. Kaynak decimal8, gerektiğinde iskonto sonucu decimal18 string olarak korunur.

Bu kaynakta brüt/net fiyat temeli kanıtlanmadı: kayıtlı iskonto aynen korunur fakat referans/net hesaplanmış ilan edilmez. Bu yüzden gerçek uygulanmış iskonto sayısı0. Salt matematik ve zaten-net koruması offline test edilmiştir; test fixture'ı gerçek kaynak kanıtı yerine kullanılmaz. Muhasebe maliyeti, geçmiş fatura maliyeti/kârı ve `products.average_cost` yeniden hesaplanmaz.

Satış fiyatı/karantina kabulü mevcut native fiyat satırlarının tamamını korur. Alış bilgisini bu satırlara yazarak eski seal'i bozmak yerine ayrı metadata okuyucusu eklenmiştir. Normal katalog API'sine maliyet alanı eklenmez. `GET /api/products/:id/purchase-reference` yalnız mevcut `product.view` **ve** `purchase.view` izinleriyle açılır; normal ürün kartındaki isteğe bağlı düğme aynı sınırı taşır. Liste ve ilk kart açılışı bu okumayı tetiklemez.

Özel plan: `C:/Sirket/ERP/evidence/ERP-MIGUNIFIED01-20261008/private/purchase-reference/prepared-plan.json`; manifest `3417153ade5cc0d7622c17f5d2cbd58425073973ecd56588bba85a8d2a3a9508`, kaynak hash `67f296cd5f8d4b3dd2964b1922c663b47ca0acc6983ab3cab4183edeabcbb6b9`, kaynak zamanı `2026-10-08T06:43:39.841Z`. Uygulama, tekrar okuma, replay ve paket sonuçları aşağıdaki teslim kaydıyla kesinleşir.

## Tek finans onay paketi — uygulanmadı

Mevcut200 cari/209 hesap matrisi ve eski38 hesaplık plan korunmuştur. Plan hash `27aefef1b8fe7e1595a1bdcf3ddf722c706554959c6ba66ee3a0abab5957091a`. Yeni hedef okumasında48/48 aday aynı; kaynakta47/48 aynı. Bir müşteri USD hesabında kaynak belge/tutar değişimi bulunup yalnız bu hesap ertelenmiştir; tarihsel plan yeniden hesaplanmamıştır.

Güncel tek onay kapsamı **37 kanıtı tamam hesap +10 rapora dayalı açılış önerisi =47 hesap**, **44 fark/3 no-op**. İlk grubun35 fark/2 no-op'u eski yöntemle; ikinci grubun9 fark/1 no-op'u `USER_APPROVED_SOURCE_REPORT_OPENING` yöntemiyle sunulur. Yöntem seçimi tutar onayı değildir. Her hesapta kaynak kimliği, rol, döviz, rapor tarihi/hash/özgün satır/B-A, eski açılış, korunacak yerel hareket ve önce–sonra native yönü hesap bazındaki JSON kanıtı ve kullanıcı tablosunda ayrı alanlarla sunulur. Rapor2dp gösterim hassasiyeti açıkça belirtilir;8dp bağımsız rapor veya atomik T1 iddiası yoktur. Fingerprint karşılaştırması teyitli1 Ocak–7 Ekim2026 dönem kapsamındadır; uygulama öncesi aynı47 hesap için taze source/native sürüm kontrolü gerekir.

**5 held hesap** yalnız koşullu yöntem adayıdır,47 içinde değildir ve karantina kalkmadı. Eski16 uygulama yeniden dahil edilmez. 209 hesabın ayrımı:16 eski uygulanmış,37 güncel hazır,10 açılış önerisi,1 kaynak drift,5 held yöntem adayı,140 kalan. Son140:114 diğer held,12 devir/(-)/rapor-döviz/tutar engeli,6 zaman/sürüm,1 yeni ödeme,1 çözülemeyen EUR rapor–kaynak tutar farkı,2 LL kullanım/arşiv kararı ve4 UNKNOWN yeni kart hesabı. LL anlamı tekrar sorulmaz; tutar/yön çelişkisi açılış yöntemiyle örtülmez.

Kullanıcıya özel tek dosya: `C:/Sirket/ERP/evidence/ERP-MIGUNIFIED01-20261008/private/finance/MELIH_CURRENT_FINANCE_APPROVAL_PACKET.md`. Son scope hash `9644ea1e62b31ec0c1706149a71e963587a50c08758063f32f4564da146b16f5`; packet hash `1f84afb609f68e192fea73a16f9682de30c4715059775acba7f6f1adf0858de4`; yeni fingerprint hash `ef5719b98972d7e2f1b3a6eddd7dd8b3ab8b777399b2a40bd85054ea554f75f1`. Cari/finans uygulaması0; yazar bu packet tarafından yetkilendirilmez.

## Stok, geçmiş, devam eden işler ve deneme etkileri

[Tek kaynak–hedef alan tablosu](field-operation-mapping.md) ürün kimliği/tam kod/KOD1/KOD4/birim/multibarkod/depo/qty/fiyat kademesi/dövizi ve uygulanmış–eksik kapsamı birleştirir. Baştaki sıfırlar, negatif miktar, NULL ve doğrulanmış sıfır ayrımı korunur. 30 Eylül açılışı,6 Ekim yakalaması, önceki Goal7 uygulaması ve8 Ekim okuması ayrı zamanlardır.

Mevcut F0102/F0103 D0007 sipariş/sevk/fatura/iade tabloları gerçekten keşfedilip16 salt okunur sorgu iki geçişte okunmuştur. Kullanılan dar ham aday koşullarında0 satır; bu sonuç bütün işletmede devam eden iş yok demek değildir. Diğer dönem/ek modül durumları ve sipariş–sevk–ödeme kesin kapanış bağları açık kalır. Geçmiş belge salt okunur erişimi açılış etkisine ikinci kez eklenmez.

Goal8 sentetik işlem kimlikleri ve güncel scoped request/link kayıtları özel manifesttedir. TEST kanıtları silinmez. Mevcut local-delta predicate'i sentetik etkileri tek başına ayıramadığından, LIVE başlangıcına tam journal/link/effect exclusion closure ve gerçek yerel hareket remainder kanıtı gerekir. Fiziksel kasa sayımı/banka ekstre referansı da ayrı açık kalır; cari toplamından kasa bakiyesi tahmin edilmez.

## Teknik teslim kaydı

Gerçek TEST batch16.668 metadata satırını kaydetti:7.429 bilinen kart tutarı (7.368 tam döviz/birim+61 kısmi),9.238 bilinmeyen tutar (8.962 eksik/geçersiz+276 açıklanmamış sıfır),1 manuel korunmuş,3 kimlik drift dışlanmış.6.090 native maliyet korunur; hesaplanmış net referans/iskonto uygulaması0. Committed aynı plan replay16.668 satır/metadataWrites0. Finans/stock/salesprice/costWrites0;53 batch koruma grubu eş. Yedek COPY_ONLY/CHECKSUM/VERIFYONLY gerçek;SHA256 2f97c20e4e58e93d91798846869b86c167a19f5fcb60f77363f98535635a1460. İlk lexical-ID readback hatası tam rollback edilmiş; numeric ORDER BY ve ID-map düzeltmesiyle aynı manifest uygulandı. API/native yeni tablolar SELECT-DML0, yalnız API readerEXECUTE1, nativeEXECUTE0; beş SQL tanımı restricted API hesabıyla hash-eş. Paket/sürüm, gerçek ekran, ek46 koruma grubu, hız ve exact CI kaydı teslim sonrası eklenir. Ham maliyetler, cari ad/tutarları, SQL exportları, config/secrets ve yedek Git'e yüklenmez. İnsan kabulü ERP-UA24 ve yeni alış görünümü bekler; teknik test insan PASS değildir.
