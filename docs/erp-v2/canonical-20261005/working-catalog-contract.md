# ERP-D02 — normal çalışma kataloğu v1

5 Ekim 2026. Onaylı ERP-DEC-001/004/005 uygulanır. Kullanıcının doğrudan çalışma yüzü talimatı bu teknik teslimi seçmiştir; ERP-UA01/02 insan sonucu kendiliğinden PASS olmaz. CRM reposunda değişiklik yapılmaz.

## Kaynak ve alanlar

`ornek-akis.html#stock` mevcut yeşil liste/sağ kart tasarımında gerçek kataloğu okur. Kapsam 30 Eylül 2026 kabul edilmiş 16.622 açılış ürünü ve 54 karantina kartıdır. Üç sentetik TEST ürünü sayfalama öncesinde dışarıdadır. ERP native stok miktarı okuma anından gelir; kaynak kart/fiyat tarihi 30 Eylül'dür. 71 yeni / 341 değişmiş ürün ve 74 cari Vega deltası uygulanmış sayılmaz.

Kod, ad, barkod ve birim mevcut kimlik/provenance bağından gelir. Bilinmeyen stok/birim/fiyat NULL kalır; gerçek sıfırdan ayrılır. Fiyatlar birim + kademe + döviz kimliğini ve sekiz ondalıklı metni korur. Liste yalnız doğrulanmış ana birim/kademe 1 için tek fiyat varsa tutar gösterir; diğer durumlarda kayıtlı fiyatların sayısını ve kart ayrıntısını gösterir. Döviz dönüştürülmez, USD varsayılmaz. Karantina kartında fiyat gösterilmez.

Fotoğraf alanı `photo:{status:'missing',url:null,sourceKey:null,verified:false}` olarak hazırlanmıştır. Kaynak arşivden eşleme/yazma yapılmamıştır. ERP-D03/04 kapsamındaki doğrulanmış görsel teslimi ayrıca bekler; görsel üstündeki katalog fiyatı ERP fiyatı sayılmaz.

## İç katalog sözleşmesi

Kimlik doğrulamalı, salt okunur `GET /api/catalog/products` ve `GET /api/catalog/products/:id`. Yalnız kanonik ERP TEST API'sinde kayıtlıdır; genel/LIVE ve native uygulamaya açılmaz. Eski public/WhatsApp katalog rotası değiştirilmez. CRM daha sonra bu API'nin onaylı sürümünü kullanacak; HTML scrape etmez. Bu teslim CRM bağlantısı veya halka açık fiyat yayını değildir.

Liste sorgusu: `search` en fazla 120 karakter; exact `barcode` en fazla 160 karakter, baştaki sıfır/boşluk korunur; `stock=all|positive|zero|negative`; `status=all|active|passive`; `page`; `limit` varsayılan 50, en fazla 50. Normal çalışma yüzü 50 satır ister; API'nin açık 1–50 sınırı korunur. Gerçekten boş barkod filtreyi kaldırır; yalnız boşluk içeren barkod bütün kataloğu açmaz. Belirsiz barkod birden fazla kart döndürebilir; kullanıcı kart seçer.

Yanıt `{success:true,data,meta}`. `meta` içinde `schemaVersion:'melisa-catalog.v1'`, `readOnly:true`, `sourceAsOf:'2026-09-30'`, UTC `readAt`, `freshLive:false`, `total/page/limit/totalPages`, `canViewSalesPrices`, `scopeCounts:{acceptedOpening:16622,quarantinedSource:54,syntheticTest:0}` bulunur. Detay `data` tek kart, liste `data` dizidir.

Kart: native metin `id`, `stockCode`, nullable `productName`, `isActive`, nullable exact8 `stockQuantityExact`, `unit:{label,sourceId,factorExact8,verified}`, `barcodes:[{id,value,isPrimary,sourceKey}]`, `provenance:{kind,sourceKey,runId,sourceAsOf,verified}`, `hold:{blocked,reasons}`, `salePrices`, `photo`. `salePrices` satış kayıtlarından `{id,type:'sale',unitSourceId,tier,currency,priceExact,isMainUnit,sourceKey}` taşır. Currency TRY/USD/EUR, `priceExact` nullable exact8 metindir. Alış fiyatı/maliyet/financial/imageUrl alanları çıktı sözleşmesinde yoktur.

Gerçek DB `product.view` ve HTTP ürün izni zorunludur. Satış fiyatı için gerçek güncel DB `sales.view` **ve** HTTP satış izni birlikte gerekir; `purchase.view` gerekli değildir. Ürün izni olan satış izni olmayan kullanıcı stok/kart okuyabilir, `salePrices:[]`, `canViewSalesPrices:false` alır. Eksik/bozuk kaynak kanıtı 503; geçersiz sorgu 400, oturum 401, izin 403, bulunmayan detay 404. Hata metninde SQL ayrıntısı bulunmaz; hata sahte kayıtla örtülmez.

SQL okuması SERIALIZABLE işlemde tüm bağımsız procedure pinleri, kaynak/native/binding ve dönen fiyat tuple sahipliği doğrulandıktan sonra tamamlanır. Yeni `dbo.usp_read_work_catalog` ayrı okuyucudur; eski stok prosedürü/iş kayıtları değiştirilmez. Teknik/ekran kanıtı ve uygulama commit'i [STATUS](../../../STATUS.md), insan denemesi [ERP-UA02](../../../USER_ACCEPTANCE.md) kaydındadır.

## Performans doğrulaması — 5 Ekim 2026

İstekler arasında veri, yetki, stok veya bütünlük sonucu önbelleğe alınmaz. Bütün ilgili değişiklikleri kapsayan güvenilir bir invalidation sürümü olmadığı için başlangıçta doğrulanmış olmak sonraki isteğin kaynak/guard kanıtının yerine geçmez. Aynı SERIALIZABLE işlemde yinelenen birebir supplier readiness bloğu yalnız bir kez çalışır; tam 998 kaynak/176 hold/seal/37 FIRST ve eski guard kontrolleri korunur.

Sayfadaki ürünlerin bütün native fiyat satırları geçici tabloya bir kez alınır. Yalnız kabul edilmiş satış satırlarıyla sınırlanmaz; bağlanmamış duplicate, alış satırı ve NULL birim de sahiplik sayımına dahil kalır. Kolon sırası/değerler değiştirilmeden `n.*` tam satır hash'i, stage/binding hash'i ve binary/NULL eşit tuple sayımı doğrulanır. Satış fiyatı seçimi, exact8 ve karantina çıktısı aynı sözleşmededir.

Kaynak alias geçici tabloları tüm 54 karantina kartı ve dönen sayfanın kabul edilmiş kartları için oluşturulur. Hem native ürün hem kaynak kimliği yönünden bütün eşleşen satırlar dahil edilir; sayfa dışı duplicate/orphan ve NULL satırların ilgili toplamları korunur. Tüm global readiness kontrolleri sayfa seçildikten sonra, satır doğrulaması ve çıktıdan önce aynı SERIALIZABLE işlemde çalışır. Kanıt doğrulanmadan hiçbir kart dışarı verilmez.

Fiyat, barkod ve iki yönlü ürün kaynak eşlemesi için dört dar nonunique TEST indeksi eklenir; duplicate/NULL veriyi veya iş kurallarını değiştiren unique kısıt eklenmez. İndeks kolon/sıra/include/type/enabled/filter şekli kurulumda ve okumada doğrulanır; sapmış tanım otomatik onarılmaz. İndekslenebilir barkod ön filtresinin ardından binary exact karşılaştırma zorunludur. Seçici sorgular gerçek parametreye göre yeniden planlanır; veri/izin kontrolü atlanmaz. Toplam sayım mevcut transaction içindeki filtrelenmiş geçici sonuçtan gelir; dışarıdan veya önceki sayfadan güvenilen toplam alınmaz.

Kurulum yalnız bilinen önceki `AE8E9F4D…` katalog prosedüründen kontrollü yükseltme yapar; iki mevcut EXECUTE yetkisi aynen kalır. Yükseltme 1 okuyucu + eksik dört indeks metadata değişimidir; tekrar `NOOP`, sıfır yazmadır. Diğer SQL tanımları ve ticari/migration kayıtları değiştirilmez.
