# ERP → CRM katalog ve sipariş taslağı sözleşmesi

Goal4 / ERP-DEC-017, 6 Ekim 2026. Katalog kaynağı mevcut [melisa-catalog.v1](working-catalog-contract.md); bu belge ticari kartları kopyalamaz veya yeni ürün gerçeği kurmaz. TEST kapsamı `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`. Gerçek kullanım ve teslim kanıtı STATUS'ta tutulur; bu sözleşme tek başına teknik veya insan kabulü değildir.

## Kaynak ve nullable alanlar

ERP `GET /api/catalog/products`, `/:id` ve `/:id/photo` rotalarının tek sahibidir. Immutable native ID ondalık metindir; CRM yalnız güvenli tamsayı aralığında `erp-<id>` arayüz anahtarı ve `erpProductId` kullanır. `stockCode` tam STOKKODU, `displayCode` yalnız literal KOD1 son ekiyle güvenle ayrılan koddur. Baştaki sıfırlar korunur. Marka ve tür gerçek `classification.brand` (KOD1) / `productType` (KOD4); MALINCINSI ayrıca `sourceName` olarak korunur. İsim, barkod, birim, stok veya fiyat eksikse NULL kalır; sıfır veya türetilmiş ticari değer verilmez.

`stockQuantityExact` native TEST stok değeridir; müşteri için otomatik stok taahhüdü değildir. `salePrices` her satırın `id`, `unitSourceId`, `tier`, `currency`, `priceExact`, `isMainUnit`, `sourceKey` değerlerini taşır. Exact8 fiyat metni ticari doğrulamadır; sayısal UI değeri yalnız gösterim içindir. Birden fazla döviz/birim/kademe varsa seçim açık olmalıdır. Fiyat paylaşımı ve taslak öncesinde kart yeniden okunur; tutarsızlıkta seçim yenilenir. 30 Eylül kaynak snapshot alanları güncel Vega veya LIVE verisi diye sunulmaz.

Fotoğraf yalnız güncel accepted, hold:false ve CONFIRMED merkezi medya bağıdır. Kimliği native ürün ID + provenance sourceKey + orijinal SHA256'dır. ERP preview/thumbnail rotaları yetkili Bearer okumasıdır; CRM yalnız kimliğe bağlı, yetkili HTTP proxy sağlar. Kaynak dosya yolu, token query veya public fiyat uç noktası yoktur. 67 AMBIGUOUS görsel dahil edilmez; karantina ve fotoğraf üstündeki fiyat ticari kaynak olamaz. Fotoğrafsız ürüne temiz boş durum verilir.

CRM'nin aktif okuyucusu ERP HTTP sözleşmesinden beslenir; SQL bağlantısı, Vega worker, HTML scrape, eski fiyat fallback'i veya ikinci ürün DB'si kullanmaz. ERP kimliği/izin/kaynak doğrulanmazsa okuma kapanır ve kullanıcıya “ERP ürün bilgisine şu anda ulaşılamıyor” gösterilir. Katalog listesi 50 satırdır; liste thumbnail, seçilen ürün preview kullanır.

## E02 native taslak

E01 geçmiş dar kayıtları ve eski endpointleri korunur. Yeni authenticated native TEST servisinde:

- `GET /api/test/crm/orders/v2/customers?phone=<normalized-phone>`: kesin telefon eşlemesi veya gerekçeli personel seçimi için revision bağlı, güncel/hold kontrollü müşteri bağlamı.
- `POST /api/test/crm/orders/v2/drafts`: native `sales_orders` / `sales_order_items` içinde yalnız `draft`.
- `GET /api/test/crm/orders/v2/drafts/:requestId`: ayrı ERP readback; aktör kapsamı ve immutable request metadata/native satır tutarlılığı kontrolü.

Gövde: `requestId`, `conversationId`, `peer`, `customerId`, `customerMatch:{basis,phone,revision,reason}`, `documentCurrency`, `exchangeRateExact8`, `items:[{productId,stockCode,quantity,priceId,unitSourceId,tier,currency,priceExact8,priceSourceKey}]`. ERP/CRM yetkileri ayrı ve günceldir. Normal ERP hesabı kullanılır; yeni login sistemi veya geniş kullanıcı izni kurulmaz. CRM aktörü ve konuşma telefonu sunucuda yeniden doğrulanır.

Telefon şirket normalizasyonu ile birincildir. Kesin tek eşleşme yoksa müşteri otomatik seçilmez. Personel mevcut ERP müşterisini gerekçeyle seçer; seçim revision, aktör ve request içinde izlenir. Karantina/hold müşteri ve ürün taslağa alınamaz. Genel toplu cari eşlemesi yapılmaz.

Native işlemde tam ürün kodu, kabul edilmiş provenance, güncel fiyat tuple, birim, para birimi, müşteri ve gerçek aktör yetkisi tekrar doğrulanır. Bir taslak tek döviz taşır. Aynı UUID + aynı tam gövde ve aktör aynı kayıt; farklı gövde/aktör conflict'tir. Tarayıcı gönderimden önce tam gövdeyi aktör/konuşma kapsamında tutar; refresh veya kayıp yanıt yeni UUID üretmeden ayrı GET ile çözülür. Kaynak fiyat revision'ı yalnız kontrol içindir; CRM'de kalıcı ikinci fiyat gerçeği yoktur.

Taslak stok hareketi, cari borç, tahsilat, ödeme veya rezervasyon oluşturmaz. Yeni tablolar yalnız request/kimlik/fiyat snapshot ve replay metadata'sıdır; sipariş gerçeği mevcut native ERP tablolarıdır. Taslak onayı/finalize bu sözleşmenin dışındadır. Yetkisiz personel API ve native SQL seviyesinde reddedilir. Başka müşteri mesajı, LIVE, main merge veya Goal5 kapsamında işlem yoktur.

## AI ve insan kontrolü

AI yalnız bu sözleşmeden gelen exact ürün kimliklerini önerebilir. Model metni fiyat, stok/teslim taahhüdü üretmez; görünür fiyat/photo seçilen aynı ürünün yeniden okunan tuple'ından gelir. Müşteri dili, konuşma revision'ı ve mevcut personel/taslak bağlamı öneriye bağlanır; değişince öneri geçersizleşir. Mevcut T01 orijinal/çeviri ve AÇIK/KAPALI davranışı korunur. AI taslağı insan inceler ve ayrıca Gönder'e basar; otomatik gönderim ve ERP yazma yetkisi yoktur.
