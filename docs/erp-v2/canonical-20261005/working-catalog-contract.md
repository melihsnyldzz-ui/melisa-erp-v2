# ERP-D02 — normal çalışma kataloğu v1

5 Ekim 2026. Onaylı ERP-DEC-001/004/005 uygulanır. Kullanıcının doğrudan çalışma yüzü talimatı bu teknik teslimi seçmiştir; ERP-UA01/02 insan sonucu kendiliğinden PASS olmaz. CRM reposunda değişiklik yapılmaz.

## Kaynak ve alanlar

`ornek-akis.html#stock` mevcut yeşil liste/sağ kart tasarımında gerçek kataloğu okur. Kapsam 30 Eylül 2026 kabul edilmiş 16.622 açılış ürünü ve 54 karantina kartıdır. Üç sentetik TEST ürünü sayfalama öncesinde dışarıdadır. ERP native stok miktarı okuma anından gelir; kaynak kart/fiyat tarihi 30 Eylül'dür. 71 yeni / 341 değişmiş ürün ve 74 cari Vega deltası uygulanmış sayılmaz.

Kod, ad, barkod ve birim mevcut kimlik/provenance bağından gelir. Bilinmeyen stok/birim/fiyat NULL kalır; gerçek sıfırdan ayrılır. Fiyatlar birim + kademe + döviz kimliğini ve sekiz ondalıklı metni korur. Liste yalnız doğrulanmış ana birim/kademe 1 için tek fiyat varsa tutar gösterir; diğer durumlarda kayıtlı fiyatların sayısını ve kart ayrıntısını gösterir. Döviz dönüştürülmez, USD varsayılmaz. Karantina kartında fiyat gösterilmez.

Fotoğraf yoksa `photo:{status:'missing',url:null,sourceKey:null,verified:false}` korunur. ERP-D04 kapsamında yalnız onaylı CONFIRMED arşiv eşlemeleri için doğrulanmış merkezi medya eklenir. Görsel üstündeki katalog fiyatı ERP fiyatı sayılmaz. Uygulamanın gerçek TEST sonucu [STATUS](../../../STATUS.md) içindedir; sözleşme uygulama kabulünün yerine geçmez.

## İç katalog sözleşmesi

Kimlik doğrulamalı, salt okunur `GET /api/catalog/products` ve `GET /api/catalog/products/:id`. Yalnız kanonik ERP TEST API'sinde kayıtlıdır; genel/LIVE ve native uygulamaya açılmaz. Eski public/WhatsApp katalog rotası değiştirilmez. CRM daha sonra bu API'nin onaylı sürümünü kullanacak; HTML scrape etmez. Bu teslim CRM bağlantısı veya halka açık fiyat yayını değildir.

Liste sorgusu: `search` en fazla 120 karakter; exact `barcode` en fazla 160 karakter, baştaki sıfır/boşluk korunur; `stock=all|positive|zero|negative`; `status=all|active|passive`; `page`; `limit` varsayılan 50, en fazla 50. Normal çalışma yüzü 50 satır ister; API'nin açık 1–50 sınırı korunur. Gerçekten boş barkod filtreyi kaldırır; yalnız boşluk içeren barkod bütün kataloğu açmaz. Belirsiz barkod birden fazla kart döndürebilir; kullanıcı kart seçer.

Yanıt `{success:true,data,meta}`. `meta` içinde `schemaVersion:'melisa-catalog.v1'`, `readOnly:true`, `sourceAsOf:'2026-09-30'`, UTC `readAt`, `freshLive:false`, `total/page/limit/totalPages`, `canViewSalesPrices`, `scopeCounts:{acceptedOpening:16622,quarantinedSource:54,syntheticTest:0}` bulunur. Detay `data` tek kart, liste `data` dizidir.

Kart: native metin `id`, `stockCode`, nullable `productName`, `isActive`, nullable exact8 `stockQuantityExact`, `unit:{label,sourceId,factorExact8,verified}`, `barcodes:[{id,value,isPrimary,sourceKey}]`, `provenance:{kind,sourceKey,runId,sourceAsOf,verified}`, `hold:{blocked,reasons}`, `salePrices`, `photo`. `salePrices` satış kayıtlarından `{id,type:'sale',unitSourceId,tier,currency,priceExact,isMainUnit,sourceKey}` taşır. Currency TRY/USD/EUR, `priceExact` nullable exact8 metindir. Alış fiyatı/maliyet/financial/imageUrl alanları çıktı sözleşmesinde yoktur.

Gerçek DB `product.view` ve HTTP ürün izni zorunludur. Satış fiyatı için gerçek güncel DB `sales.view` **ve** HTTP satış izni birlikte gerekir; `purchase.view` gerekli değildir. Ürün izni olan satış izni olmayan kullanıcı stok/kart okuyabilir, `salePrices:[]`, `canViewSalesPrices:false` alır. Eksik/bozuk kaynak kanıtı 503; geçersiz sorgu 400, oturum 401, izin 403, bulunmayan detay 404. Hata metninde SQL ayrıntısı bulunmaz; hata sahte kayıtla örtülmez.

SQL okuması SERIALIZABLE işlemde tüm bağımsız procedure pinleri, kaynak/native/binding ve dönen fiyat tuple sahipliği doğrulandıktan sonra tamamlanır. Yeni `dbo.usp_read_work_catalog` ayrı okuyucudur; eski stok prosedürü/iş kayıtları değiştirilmez. Teknik/ekran kanıtı ve uygulama commit'i [STATUS](../../../STATUS.md), insan denemesi [ERP-UA02](../../../USER_ACCEPTANCE.md) kaydındadır.

## Performans doğrulaması — 5 Ekim 2026

## ERP-D04 — doğrulanmış merkezi medya

Kaynak plan `photo-mapping-plan.json`, kayıt SHA256 `5da967d2652aa0d6710ad206ac10b7a5898d5a8af7ff3f45e048669e15d22b6d`; kullanıcı ERP-UA03 ile kabul etti. Yalnız 3.830 CONFIRMED/tekil ürün, her kopyalama öncesi mevcut tam korumalı API kartındaki exact productId/stockCode/sourceKey/runId/accepted/hold:false ve kaynak dosya SHA256 tekrar doğrulanarak uygulanır. 67 AMBIGUOUS ve 4620 LEYLEK dışarıda kalır. Orijinaller salt okunur; fotoğraf üzerinden fiyat türetilmez.

TEST merkezi kök `C:\Sirket\ERP\data\TEST-20260929-01\catalog-media`; sürüm paketleri ve Desktop'tan bağımsızdır. Content-addressed JPEG kopyaları `original/<SHA256>.jpg`, türevleri `thumbnail/<türevSHA>.jpg` ve `preview/<türevSHA>.jpg`; kaynak dosya adı, ürün/kaynak kimliği, doğrulama zamanı/durumu ve hashler `index.json` metadata dosyasındadır. SQL blob, SQL ticari kart değişikliği ve ikinci ticari ürün DB'si yoktur. Bu ERP medya kaynağı ileride ortak tüketim için hazırdır; CRM entegrasyonu bu teslimde yapılmaz.

Kopyalama CLI'si `scripts/catalog/apply-confirmed-photo-plan.mjs --apply-approved-erp-d04 <absolutePlanPath> <privateExistingReaderAccessPath> <absoluteEvidenceDirectory>` açık yetkili bu plan içindir. Arşiv hash sapması kayıt reddidir; herhangi bir reddedilen kayıt varsa product index yayımlanmaz. Başarılı dosyalar silinmez ve tekrar doğrulanarak kullanılabilir. Tam uygulamada index tek atomik/exclusive yayımlama ile oluşturulur. Replay mevcut bütün metadata/bindings ve dosya hashlerini doğrular, aynı index'i değiştirmez. Bu CLI yeni genel medya import yetkisi vermez.

Medya açıkken kartın photo alanı tam olarak `{status:'available',url:'/api/catalog/products/<id>/photo?variant=preview',thumbnailUrl:'/api/catalog/products/<id>/photo?variant=thumbnail',sourceKey,sha256,verified:true}`. `sha256` kaynak/original hashidir; kaynak kimliği güncel kartla aynıdır. Mevcut SQL DTO önce kendi tüm readiness/izin/karantina kontrollerinden geçer; fotoğraf metadata eşlemesi sonra yalnız exact güncel kimlik/accepted/hold:false ile eklenir. SQL okuyucusu ve pinleri değişmez. Sayfa yanıtı yalnız medya reference taşır, JPEG binary içermez.

`GET /api/catalog/products/:id/photo?variant=preview|thumbnail|original` mevcut Bearer oturumu ve ürün izni ister; her istekte aynı tam korumalı detail okuyucusu güncel DB yetkisi/kimlik/karantinayı tekrar doğrular. Public uploads/static, token query string ve Desktop yolu yoktur. Sunulan JPEG hash'i her binary isteğinde kontrol edilir. Hatalar 400/401/403/404/503 ile kapanır; dış dosya yolu/SQL ayrıntısı açıklanmaz. `private, no-store`, JPEG MIME ve `nosniff` korunur.

Başlangıçta yalnız doğrulanmış TEST ERP4144/writes bağlamında merkezi index, tüm 3.830 kayıt ve bütün original/thumbnail/preview bytes doğrulanır. İndeksin ham bytes SHA256 değeri ayrıca özel runtime config'in `catalogMediaIndexSha256` pinine eşit olmalıdır; index'in kendi beyanından beklenen hash üretilmez. Registry yalnız doğrulanmış, değişmez medya metadata map'ini saklar; güncel veri/rol/hold/SQL kanıtı cache değildir. Başka ürünün görsellerini hashleriyle beraber yer değiştiren indeks bu bağımsız pinle reddedilir. Medya yapılandırması yoksa eski missing davranışı sürer; native/LIVE'a açılmaz.

Normal listenin beş sütunu ve 50'li sayfalaması değişmez; liste açılışında fotoğraf isteği yapılmaz. Kart açılınca yalnız 768px'e kadar önizleme, oturum closure'ındaki Bearer ile alınır ve yerel Blob URL üzerinden gösterilir. 128px thumbnail sonraki uygun tüketim için hazırdır; original listede veya mevcut kartta indirilmez. Kart kapatma/yeni seçim/sayfa/oturum dispose yüklemeyi iptal eder ve Blob URL'yi serbest bırakır. Eksik/başarısız fotoğraf temiz placeholder gösterir. Tek CONFIRMED aday ana kart görseli olabilir; çoklu aday varsa otomatik seçim bu sözleşmede yoktur.

### Önceki katalog performans yöntemi

İstekler arasında veri, yetki, stok veya bütünlük sonucu önbelleğe alınmaz. Bütün ilgili değişiklikleri kapsayan güvenilir bir invalidation sürümü olmadığı için başlangıçta doğrulanmış olmak sonraki isteğin kaynak/guard kanıtının yerine geçmez. Aynı SERIALIZABLE işlemde yinelenen birebir supplier readiness bloğu yalnız bir kez çalışır; tam 998 kaynak/176 hold/seal/37 FIRST ve eski guard kontrolleri korunur.

Sayfadaki ürünlerin bütün native fiyat satırları geçici tabloya bir kez alınır. Yalnız kabul edilmiş satış satırlarıyla sınırlanmaz; bağlanmamış duplicate, alış satırı ve NULL birim de sahiplik sayımına dahil kalır. Kolon sırası/değerler değiştirilmeden `n.*` tam satır hash'i, stage/binding hash'i ve binary/NULL eşit tuple sayımı doğrulanır. Satış fiyatı seçimi, exact8 ve karantina çıktısı aynı sözleşmededir.

Kaynak alias geçici tabloları tüm 54 karantina kartı ve dönen sayfanın kabul edilmiş kartları için oluşturulur. Hem native ürün hem kaynak kimliği yönünden bütün eşleşen satırlar dahil edilir; sayfa dışı duplicate/orphan ve NULL satırların ilgili toplamları korunur. Tüm global readiness kontrolleri sayfa seçildikten sonra, satır doğrulaması ve çıktıdan önce aynı SERIALIZABLE işlemde çalışır. Kanıt doğrulanmadan hiçbir kart dışarı verilmez.

Fiyat, barkod ve iki yönlü ürün kaynak eşlemesi için dört dar nonunique TEST indeksi eklenir; duplicate/NULL veriyi veya iş kurallarını değiştiren unique kısıt eklenmez. İndeks kolon/sıra/include/type/enabled/filter şekli kurulumda ve okumada doğrulanır; sapmış tanım otomatik onarılmaz. İndekslenebilir barkod ön filtresinin ardından binary exact karşılaştırma zorunludur. Seçici sorgular gerçek parametreye göre yeniden planlanır; veri/izin kontrolü atlanmaz. Toplam sayım mevcut transaction içindeki filtrelenmiş geçici sonuçtan gelir; dışarıdan veya önceki sayfadan güvenilen toplam alınmaz.

Kurulum yalnız bilinen önceki `AE8E9F4D…` katalog prosedüründen kontrollü yükseltme yapar; iki mevcut EXECUTE yetkisi aynen kalır. Yükseltme 1 okuyucu + eksik dört indeks metadata değişimidir; tekrar `NOOP`, sıfır yazmadır. Diğer SQL tanımları ve ticari/migration kayıtları değiştirilmez.

Yalnız doğrulanmış yazılabilir ERP TEST 4144 başlangıcında, HTTP sağlık servisi açılmadan önce mevcut aktör16'nın gerçek ürün/satış izinleriyle aynı tam doğrulamalı okuyucudan 50 satır ve bu listeden seçilen kabul edilmiş bir kart okunur. Sonuç atılır; veri, yetki veya bütünlük kanıtı saklanmaz. Başlangıç okuması başarısızsa servis hazır sayılmaz. Bu TEST'in ODBC havuzu mevcut üst sınır10 ve30 saniye boşta süresini koruyarak en az bir bağlantıyı açık tutar; native/LIVE yapılandırması değişmez. Amaç bağlantı kapandığında tekrar oluşan ilk plan derleme maliyetini açılışa taşımaktır. Her normal istek kimliği, gerçek güncel izinleri ve bütün kaynak/karantina kanıtlarını kendi SERIALIZABLE işleminde yeniden doğrular. Yeni havuz bağlantıları veya SQL planının geçersizleşmesi ek derleme maliyeti oluşturabilir; bu yöntem bütün istekler için sabit bir süre garantisi değildir.
