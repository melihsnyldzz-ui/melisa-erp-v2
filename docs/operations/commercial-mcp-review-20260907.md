# Ticari MCP genişletmesi — 7 Eylül 2026 inceleme raporu

Mevcut Melisa ERP MCP, 25 kontrollü okuma aracı sunacak şekilde genişletildi.
Bu paket **inceleme sürümüdür; canlıya alınmadı**. Görsel eşleme erişimi ve
doğrulanmış işlem maliyeti eksikleri nedeniyle tam canlı kabul tamamlanmış sayılmaz.

## Korunan çalışma ve doğrulanan bağlantı

- Asıl checkout: `erp-terminal-readiness`, `85cb202`. Başlangıç ve sonuç Git
  durumları ile tracked diff aynı; mevcut kullanıcı değişiklikleri korundu.
- Çalışan MCP: aynı reponun `feat/mcp-commercial-readonly` çalışma ağacında
  `cd8cffb`, `127.0.0.1:4113`. Prosesin gerçek çalışma dizini ayrıca okundu.
- İnceleme dalı: `codex/mcp-commercial-coverage-20260907`; aynı Git reposunun
  ayrı worktree'si. Yeni proje kurulmadı. Test yalnız `127.0.0.1:4115` üzerinde.
- 4100 ERP, 4111 Bionic, 4112 gateway ve 4113 MCP süreçleri değiştirilmedi.
- Canlı sunucu 10 araç bildiriyor; bu Codex oturumundaki bağlı Melisa ERP
  uygulaması dört eski aracı gösteriyor. Araç tanımı/keşif uyumsuzluğu gözlendi;
  yalnız önbellekten kaynaklandığı kanıtlanmadı. Mevcut dört bağlı araç ayrıca
  başarılı çağrıldı. Yeni araçların gerçek bağlı istemciden kabulü yayın sonrasıdır.
- Dedicated bağlantı kodu, ortam ayarları ve gerçek SQL kimlik/yetki kontrolü
  `VEGA2026 / F0102 / D0007` değerlerinde uyuştu. INSERT, UPDATE, DELETE,
  ALTER, CREATE TABLE ve EXECUTE etkili izinleri reddediliyor. Normal ERP SQL
  hesabına dönüş yok. Firma/dönem ortam değişkenleri artık açıkça gereklidir;
  eski stok servisindeki sabit F0102 tablo seçimi kaldırıldı.

## Şema, dönem ve servis envanteri

Dedicated hesapla 8.956 Vega nesnesi görünür; katalogda görünmeyen yerel nesneler
ve türetilmiş veri kümeleri dahil 9.043 envanter girdisi var. Bu sayı bütün
girdilerin sorgulanabilir olduğu anlamına gelmez. 84 firma/dönem/veri ailesinin
kayıt sayısı ve tarih aralığı SELECT ile denetlendi; bu envanter okumalarında
engel çıkmadı. Detaylı, satır verisi içermeyen çıktılar `inventory-commercial-mcp.mjs`
ile tekrar üretilebilir: `commercial-datasets.csv`, `commercial-fields.csv`,
`commercial-history.json`.

| Alan | Gerçek kaynak ve ERP dayanağı | Doğrulanan kapsam / sınır |
|---|---|---|
| Ürün | `F0102TBLSTOKLAR`, `vegaProductService` | 52.629 kart; aktif/pasif ayrıdır. IND ilişki kimliğidir. |
| Birim, barkod, fiyat | `F0102TBLBIRIMLEREX` | 56.181 birim satırı; BARCODE, CARPAN, SATISFIYATI/PB1–PB6 birlikte okunur. Paket/adet dönüşümü uygulanmaz. |
| Stok miktarı | `F0102D0007TBLSTOKHAREKETLERI`, kart KALAN | 41.134 hareket, 2026-01-01–2026-09-07. Eksik miktar veya karışık/çözümlenemeyen birim null üretir. Hareketsiz kartın KALAN geri dönüşü tarihsel kapanış stoğu değildir. |
| Envanter / rezerv ham alanları | `F0102TBLSTOKENVANTER` | 27.383 satır. Genel sorgudan ham alanlar okunur; rezerv/serbest stok için bağımsız ticari doğruluk iddiası yoktur. Dönem eki taşıyan aynı adlı D0007 tablo boştur. |
| Satış / iade | D0007 stok hareketleri + STKCIK/STKGIR başlıkları | 33/34 sınıflandırması, aynı başlık kimliği, cari ve belge no ilişkisi, iade/iptal durumu korunur. Tüm stok çıkışları satış sayılmaz. |
| Alış | `F0103D0007TBLALFATBASLIK/HAREKET`, `vegaSupplierLedgerService` | 966 başlık, 6.737 satır. F0103 firma seçimi açıktır; F0102 stok kimliğiyle aynı varsayılmaz. |
| Satış faturası | `F0104D0007TBLSATFATBASLIK/HAREKET` | 25 başlık; F0102 stok çıkışlarıyla birleştirilip iki kez satış sayılmaz. |
| Cari / bakiye / vade | `F0102TBLCARI`, D0007 CARIHAREKETLERI | 436 kart, 2.492 hareket. Kayıtlı para birimi ve pozitif işlem kuru korunur. Kapsamdaki net hareket etkisi hesaplanır; tahsilat dağıtımı doğrulanmadan gecikmiş tahsil edilebilir borç üretilmez. |
| Marka / ülke | Stok KOD1; cari KOD1 (`vegaCustomerService`) | Kaydedilmiş etiketlerdir; telefondan/adresten ülke tahmini yapılmaz. Tarihsel etiket snapshot'ı değildir. |
| Maliyet / kâr | Hareket BIRIMMALIYET ve SATISBIRIMMALIYETI; mevcut profitability servisi incelendi | Ham maliyet alanları okunur. F0103 alışını F0102 ürününe bağlayan öneri eşlemeleri doğrulanmış işlem maliyet snapshot'ı sayılmaz. Kesin maliyet/kâr null, durum UNSUPPORTED. |
| Görsel | `MELISA_ERP_V2.dbo.vega_product_images` + API `uploads/vega-products` | Eşleme kaynak kimliği + stok kodu + aktif ana görselle sınırlandırılır. Yerel klasörde 958 dosya gözlendi; bu sayı doğrulanmış ürün eşlemesi sayısı değildir. |

Genel `TBLDONEM` D0001–D0007 için 2020–2026 tanımlarını doğruladı; F0102
D0008/2027 tanımı var fakat okunabilir dönem nesnesi doğrulanmadı ve araç bunu
reddediyor. Dönem adı tarih filtresi değildir: örneğin D0003/2022 stok tablosunda
2010 tarihli, D0001/2020 tablosunda 2021 tarihli hareketler var. Raporlar en fazla
366 günlük açık aralık ister: `dateFrom` dahil, `dateTo` hariç. Farklı dönemler
sessizce birleştirilmez. Zaman damgası sorgu zamanıdır; kaynak tarihinin zaman
dilimi veya tarihsel snapshot garantisi değildir.

## Araç ve güvenlik sözleşmesi

Eski dört araç korunur. Önceki altı katalog/sorgu/belge aracının üzerine:

- `get_commercial_inventory`, `get_stock_quantities`, `get_product_units`,
  `get_product_variants`, `get_stock_movements`;
- `list_commercial_documents`, `list_accounts`, `get_account_ledger`,
  `get_account_balance`, `get_product_prices`, `get_product_costs`;
- `get_sales_report`, `get_inventory_report`, `search_catalog`, `get_product_image`.

Yönetici credential'ı eski ve yeni ticari araçlara erişir. Ayrı ve farklı
customer credential'ı sadece `search_catalog` ve `get_product_image` görür ve
çağırır. `role`, `includePersonalData` veya gizli bir araç adını istemciden
yazmak yönetici yetkisi kazandırmaz. Genel sorgu katmanı da müşteri rolünü
reddeder. Bu çalışma gerçek bir müşteri credential'ı oluşturmadı veya etkinleştirmedi.
Mevcut entegrasyon anahtarı yönetici anahtarı olarak saklanmalı, müşteriye verilmemelidir.

Sorgular parametrelidir; genel SQL/yazma aracı, caller JOIN/ifade veya normal SQL
havuzuna fallback yoktur. Katalog alan ve nesne izinleri, hassas alan politikası,
en fazla 50 satır/sayfa, 12 filtre, 40 alan ve şifreli/süreli imleçler korunur.
Veri SELECT süresi 12 saniye, metadata parçaları 15 saniye, araç başına
işbirlikli sorgu bütçesi 90 saniyedir; kimlik/yetki doğrulamasının kendi SQL
zaman aşımı da vardır. Aynı anda iki araç çağrısı, dakikada 180 HTTP isteği,
64 KB girdi ve 192 KB yapılandırılmış metin sınırı vardır. Görsel içeriği ayrıca
en fazla 3 MB özgün dosyadır. Audit rol, araç, zaman ve teknik sonucu tutar;
argüman, müşteri kaydı, SQL metni ve credential tutmaz.

Satış sıralaması tüm filtreye SQL'de uygulanır. Tüm kapsamın eksik satır sayısı
`coverage` içinde bulunur; eksik bir grup sonraki sayfada olsa bile sıralama tam
doğrulanmış gösterilmez. Ölü stok çıktısı sadece istenen pencerede satış
görülmeyen **adaylardır**, ömür boyu ölü stok kararı değildir. Azalan stok net
harekettir; gelecek tahmini değildir. Düşük stok, ancak birimi doğrulanan kayıtlı
eşikle kıyaslanır; bir seri altı kuralı için paket dönüşümü uydurulmaz.

## Bulunmayan veri, erişim engeli ve desteklenmeyen hesaplar

1. **Okundu ve boş bulundu:** mevcut kapsamta yerel `products`,
   `product_barcodes`, `product_images`; F0102 seri tanımları, D0007 seri
   numaraları/asorti tabloları. Son testte kayıtlı düşük eşik raporu da boştu.
   Bunlar LIVE_EMPTY'dir; diğer dönemlerde de boş oldukları söylenmez.
2. **Yetki veya şema görünürlüğü engeli:** dedicated Melisa hesabı yalnız
   products/product_barcodes/product_images/suppliers nesnelerini görüyor.
   Kodda tanımlı 27 ek ticari nesne görünmüyor. Yokluk ile yetki eksikliği bu
   hesapla kesin ayrılamaz. Görsel çağrısı `DATASET_READ_PERMISSION_MISSING`
   ile kapandı; başarısız kaynağı yanıtta ayrıca `failureScope` tanımlar.
3. **Desteklenmeyen/doğrulanmamış:** kesin kâr ve işlem maliyeti snapshot'ı,
   tahsilata dağıtılmış gecikmiş borç, ayrı varyant stoku, tahmini paket/adet
   dönüşümü, tam ömür boyu stok/satış geçmişi. Ham alan okunması bunlara PASS değildir.

## Görselin gerçekten alınması

`get_product_image` [MCP image content](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#image-content)
döndürür. Dosya yolu veya herkese açık URL yayınlamaz. Kaynak kökü ve eşlemenin
sahibi firma açık yapılandırılır; başka firmaya aynı yerel eşleme taşınmaz.
Path traversal, uzak URL, kök dışına çıkan sembolik bağlantı, uygunsuz dosya
türü ve büyük dosya reddedilir. Yetki kontrolü her eşleme okumasında yapılır.

Gerçek ERP dosyasıyla aktarım bileşeni testinde yetkili HTTP istemcisi 211.749
bayt JPEG aldı; 1198×1600 olarak çözüldü, byte hash eşleşti, yol açığa çıkmadı.
Bu test, SQL ürün eşlemesi yerine kontrollü bir test yanıtı kullandı: **bileşen kanıtıdır**.
Gerçek ürün → SQL eşlemesi → görsel → bağlı istemci zinciri, SQL erişimi
nedeniyle BLOCKED'dır ve canlı uçtan uca PASS değildir.

## Test kanıtı ve tekrar çalıştırma

Sanitize edilmiş kanıtlar `evidence/mcp-20260907/` altındadır. Müşteri satırı,
belge içeriği, credential veya görsel dosyası Git'e eklenmez.

- Yerel/HTTP ve gerçek SQL motorunda yalnız literal VALUES kullanan testler:
  **21/21**, atlanan 0. Bu sayı canlı ticari özellik kapsamı değildir.
- Canlı MCP: **33 PASS_LIVE_READ**, **4 PASS_CONTROL**, **4 LIVE_EMPTY**,
  **1 UNSUPPORTED**, **1 BLOCKED**. `completeLiveAcceptance=false`.
- Stok miktarı, cari net etki, tüm kapsamın satış/iade başlık ilişkileri ve
  ülke raporu satır kapsamı için **4 canlı karşılaştırma geçti**.
- Eski dört gerçek bağlı Melisa ERP aracı başarılı çağrıldı.
- UI/terminal değiştirilmedi; web/terminal build'i bu MCP paketinin kanıtı değildir.

Yerel test:

```powershell
npm.cmd --prefix apps/api run test:mcp-commercial
```

SQL fixture testleri sadece ayrı read-only ortam ayarlarıyla
`MCP_READ_ONLY_SQL_TESTS=true` verildiğinde açılır. Diğer durumda SKIP yazılır.

Canlı kabul için korumalı ortamda `MCP_READ_ONLY_TOKEN` ve aşağıdaki sır
içermeyen ayarlar kullanılır:

```powershell
$env:MCP_READ_ONLY_LIVE_TESTS='true'
$env:MCP_READ_ONLY_VERIFY_URL='http://127.0.0.1:4115/mcp'
$env:MCP_READ_ONLY_VERIFY_DATE_FROM='2026-01-01'
$env:MCP_READ_ONLY_VERIFY_DATE_TO='2026-09-08'
$env:MCP_READ_ONLY_VERIFY_PURCHASE_COMPANY='F0103'
$env:MCP_READ_ONLY_VERIFY_INVOICE_COMPANY='F0104'
node apps/api/scripts/verify-commercial-mcp.mjs
node apps/api/scripts/verify-commercial-reconciliation.mjs
```

Firma/tarihler bu çalışmada metadata ile doğrulanmıştır; sonraki ortamda yeniden
doğrulanmalıdır. `MCP_READ_ONLY_VERIFY_REPORT` ve
`MCP_READ_ONLY_RECONCILE_REPORT` sonuç dosyalarını seçer. Kabul scripti assertion
hatasında 1, bilinen kapsam engelinde 2, tam kabulde 0 koduyla biter.
Envanter için `MCP_READ_ONLY_INVENTORY_DIR` verilip
`node apps/api/scripts/inventory-commercial-mcp.mjs` çalıştırılır.

## Onay sonrası yayın adımları

1. PR önce incelenir; PR #8'in `feat/melisa-erp-readonly-mcp` dalına bağımlılığı
   korunur. Merge ve yayın için ayrı insan onayı alınır.
2. Yönetici, görünmeyen yerel ticari nesnelerin gerçekten varlığını ve gereken
   SELECT kapsamını doğrular. Görsel için öncelikli aday yalnız
   `dbo.vega_product_images` okumasıdır. Önceki REVIEW-ONLY izin scriptinin
   tamamı otomatik uygulanmaz; hiçbir izin veya SQL rolü bu görevde değiştirilmedi.
3. Mevcut credential dosyaları repo dışında tutulur. Doğrulanan
   `BIONIC_VEGA_COMPANY_CODE` / `BIONIC_VEGA_PERIOD_CODE`, audit dizini ve
   `-MediaRoot` / `-MediaCompany` hazırlanır. Müşteri erişimi ancak ayrıca
   onaylanan `mcp-customer.env` credential'ıyla açılır.
4. Aynı commit ayrı loopback portunda tüm kontrollerden geçirilir. Gerçek ürün
   eşlemesinden gelen görsel yetkili istemcide açılmadan görsel kabulü tamamlanmaz.
   Doğrulanmış kâr engeli, kaynak ve snapshot sözleşmesi çözülmeden kapatılmaz.
5. Açık yayın onayıyla sadece sahipliği doğrulanan 4113 MCP süreci değiştirilebilir.
   ERP/gateway süreçleri, SQL yetkileri, firewall veya tünel hedefi kendiliğinden
   değiştirilmez. Bağlantının araç keşfi yenilenir ve gerçek bağlı istemcide yeni
   araçlar, yetki ayrımı ve görsel yeniden sınanır.
6. Geri dönüş, önceki `cd8cffb` MCP runner'ını aynı portta yeniden başlatmaktır.
   Şema/data değişikliği olmadığı için SQL rollback veya restore gerekmez.

Bu rapordaki gözlemler 7 Eylül 2026 ölçümüdür; sonraki ticari işlemler sayıları
değiştirebilir. Test sunucusu iş sonunda kapatılır; canlı hizmet yayını bu PR'ın
hazırlanmasına dahil değildir.
