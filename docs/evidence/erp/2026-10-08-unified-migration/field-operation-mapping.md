# Kaynak–hedef alan ve operasyon eşlemesi

8 Ekim 2026 salt okunur envanter. TEST95/source `0c63a58845d8663252f7dfeb0dcd2bd6a53c998c` `/test-health` ve beş mevcut operasyon GET'i ile doğrulandı. Bu inceleme ticari, stok, fiyat, finans veya kaynak SQL yazmadı; Goal8 suite tekrar çalıştırılmadı. Paket checkout'tan ayrıdır; bu dosya LIVE geçiş kabulü değildir.

## Tek alan tablosu

| Alan | Kaynak → hedef | Tam dönüşüm / kimlik kuralı | Uygulanmış kanıt ve kalan |
|---|---|---|---|
| Ürün kimliği | `F0102TBLSTOKLAR.IND` → `products.id`, source key/alias, accepted/source-version bindings | Firma+tablo+IND; frozen `VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/IND`, native eski anahtar `VEGA2026/F0102TBLSTOKLAR/IND`; sürüm anahtarı `VEGA2026/F0102/TBLSTOKLAR/IND`. Tek yön ve ters tekillik gerekir; ad/barkod kimlik yerine geçmez. | Açılış 16.622 ürün; Goal7 49 yeni ürün. 54 ürün hold korunur. Son kaynak yakalaması gerçek T1 değildir. |
| Tam kod / ad | `STOKKODU`, `MALINCINSI` → `stock_code`, `name` | Tam metin / kayıt kimliği; model+marka bileşeninden yeni tahmini kod üretilmez. | Açılış scope doğrulaması ve Goal7 12 mevcut kart değişikliği uygulanmış. Kod değişimindeki eski provenance alias korunur. Bütün kaynak kartları aktarılmış sayılmaz. |
| Marka / tür | `KOD1`, `KOD4` → `brand`, `category` ve doğrulanmış catalog sınıflandırması | Kaynak alanlar kendi rolünde; boş/null değer bilinmiyor. Marka, tedarikçi veya tür adı üzerinden başka karta bağlama yok. | Açılış/Goal7 kart scope ve reader sınıflandırması mevcut. Bu goal bu alanları yeniden yazmaz. |
| Ana birim / çarpan | `ANABIRIM` pointer → `TBLBIRIMLEREX.IND`; `BIRIMADI`, `CARPAN`, ana/varsayılan flags → unit/source-unit tuple | Önce tek pointer, sonra tek ve tutarlı default/main, sonra tek unit. Operasyon scope yalnız doğrulanmış ADET/factor1; eksik birim ADET yapılmaz. Çelişki REVIEW. | Yakalanmış kapsamda 10 birim inceleme kaydı; mevcut stok planı UNKNOWN birimi dışlar. Genel çokbirimli dönüşüm tamamlanmış değildir. |
| Birden çok barkod | `TBLBIRIMLEREX.BARCODE`, unitIND → `product_barcodes`, source aliases | String ve sourceunit kimliği korunur; baştaki sıfır kaybolmaz. Çelişkili veya çokkartlı bağ failclosed; boş barkod ürün kimliğini yok etmez. | Eski açılış makbuzu 8 yeni barkod insert gösterir; bu bütün mevcut barkod sayısı değildir. 6 Ekim kaynak yakalamasında 2.090 çokbarkodlu kart, 3.706 başında sıfır olan barkod satırı, 2.100 barkodsuz kart var (tüm 53.045 kart, kapsam dışı dahil). |
| Depo | `F0102D0007TBLSTOKHAREKETLERI.DEPO` → opening/stock movement `warehouse_name=MERKEZ` | Mevcut parser yalnız tek kaynak depo grubuna izin verir; çokdepoda `MULTI_WAREHOUSE_REQUIRES_EXACT_DECIMAL_SUM` ile durur. | 6 Ekim yakalaması tek depo grubu/7.097 ürün-depo aggregate satırı. MERKEZ eşlemesi mevcut teknik scope'tur; bütün fiziksel depolar ve geçiş günü sayımı kanıtı değildir. |
| Stok miktarı | `SUM(GIREN-CIKAN)`; hareket yoksa `KALAN` → `current_stock_qty` + ledger adjustment | İmzalı decimal8 kaynak; native decimal3 temsilinin tam uygunluğu gerekir. Desired = kaynak miktarı + korunacak native local delta; delta = desired − mevcut effective ledger. NULL bilinmiyor, negatif sıfırlanmaz. | Açılış native/ledger fark0; Goal7 563 ürün/563 movement düzeltmesi, önceki geçmiş korunmuş. 6 Ekim kaynakta 2.005 negatif ve 13 UNKNOWN miktar (tam kaynak). Yeni stok yazısı için ayrı onay/T1 gerekir. |
| Satış fiyat kademesi / birim / döviz | `SATISFIYATI1…6`, `PB1…6`, unitIND → `product_prices` type/tier/currency/unit bindings; card sales scalar yalnız anaunit tier1 native dövizi | Kaynak fiyat+kademesi+birim+döviz ayrı tuple. `$`→USD, `€`→EUR, TL/₺→TRY; bilinmeyen NULL. NULL ve gerçek0 ayrı; kur tahmini veya ikinci dövizle birleştirme yok. | Açılış 63.774 typed native fiyat; Goal7 241 insert/16 update/0 removal. Satış fiyatı değişikliği bu goalin stok/geçmiş bölümünde yetkilendirilmedi. |
| Alış / referans bilgisi | `ALISFIYATI`/`DALISFIYATI`+`APB`+`ALISISKORANI`, doğrulanmış eski alış satırı → ayrı purchase/reference alan sözleşmesi | Dövizi belli TRY için local, foreign için foreign; net/gross ve iskonto kanıtı ayrı. Gerçek geçmiş faturanın maliyeti/kârı yeniden hesaplanmaz. | Bu goal16.668 ayrı immutable TEST metadata satırı uyguladı;7.429 bilinen kart tutarı (7.368 tam+61 kısmi).9.238 bilinmeyen,1 manuel korunmuş,3 kimlik drift dışarıda;6.090 native maliyet korundu. Net/gross kanıtı yok:net referans/iskonto uygulaması0. Normal katalog maliyet taşımaz; ayrı üç izinli opt-in GET. Muhasebe maliyeti/stock/saleprice/finance yazması0. |
| Eski belge / hareket geçmişi | Eski alış/satış/stock/cari hareket kimlikleri → retained readonly history + opening source provenance | Açılış farkı ve eski belgelerin tekrar ticari etkisi ayrılır; geçmiş faturalar yeniden oluşturulmaz. | Eski opening mapped scope native/ledger/stage fark0. 6 Ekim cost export 60.102 pozitif alış satırı/11.334 firma-dönem belge anahtarı içerir; açık veya tamamlanmış iş listesi değildir. |

Kanıt zamanı: frozen source 30 Eylül 2026; yeniden kullanılan güncel-source yakalaması **6 Ekim 2026 21:41 UTC**, iki geçişte kararlı fakat atomik T1 değil. 53.045 kartın 86'sı eski yakalamaya göre yeni, 752'si değişmiş. Goal7 makbuzundaki 49/12 yalnız uygulanmış dar kapsamdır; 86/752 farkının tamamının kapanması veya kalan bütün kartların uygulanabilirliği anlamına gelmez.

## Devam eden iş ve gerçek yerel etkiler

**8 Ekim kaynak yenilemesi:** eski capture dışına çıkılarak mevcut SELECT-only Vega2026/F0102–F0103/D0007 sipariş, irsaliye ve fatura tabloları iki geçişle doğrudan okundu. `ALSIP`/`VERSIP` iptal olmayan, kapatma bayrağı kapalı ve satır miktarı sevk edilenden büyük adaylar; `ALIRS`/`SATIRS` iptal olmayan başlıklar; `ALFAT`/`SATFAT` `0<ODENEN<TUTAR` ve `IADE=1` adayları, şirket başına sekiz sorgunun tamamında **0 satır**, iki geçiş hashleri aynı. Bu, belirtilen alan/predicate kapsamındaki kaynak gözlemidir; bütün işletmede açık iş yok veya ödeme/teslim tamam anlamına gelmez. Başka sipariş eklentileri, geçmiş dönem, belge bağlantısı ve alanların iş anlamı aşağıdaki kapsam eksiği olarak korunur. Yeni finans etkisi veya kur dönüşümü üretilmedi. Private `source-discovery.json` ve `source-current-work-candidates.json` sorgu, kaynak kimliği ve zamanı içerir.

| İş | Mevcut kanıt | Kalan |
|---|---|---|
| Açık sipariş / rezervasyon | Güncel D0007 `ALSIP`/`VERSIP` kalan satır ham koşulunda0 aday; source query/iki geçiş kanıtı var. | Diğer dönem/ek modül ve sipariş–sevk/fatura kesin bağları doğrulanmalı; bütün işletmede0 iddiası yok. |
| Teslim edilmemiş mal / açık sevk | Güncel D0007 iptal olmayan `ALIRS`/`SATIRS` ham başlık koşulunda0 aday. Stock aggregate yalnız geçmiş netidir. | Teslim/kapanış alan anlamları ve diğer kaynak kapsamı bilinmiyor; depo neti teslim listesi değildir. |
| Kısmi ödeme | Güncel D0007 `ALFAT`/`SATFAT` `0<ODENEN<TUTAR` ham koşulunda0 aday. | Dövizli settlement/ters kayıt bağları ve diğer dönemler doğrulanmalı; bakiye aktarımı iş kapanışı değildir. |
| Devam eden iade | Güncel D0007 `IADE=1`, iptal olmayan fatura ham koşulunda0 aday. Eski cost export iadeleri kapsamıyordu. | İade–asıl belge/kalan miktar/gerçek durum ve diğer kaynak kapsamı açık; global iade0 denemez. |
| Kasa / banka açılışı | TEST sentetik cash-account ve hareketler kanıt amaçlıdır. | Geçiş günü fiziksel kasa sayımı ve banka hesap/ekstre referansı gerekiyor. Cari toplamından tahmin veya yeni bakiye yazısı yok. |

TEST95 salt okunur operasyon yanıtları: satış/mal kabul/alış/tedarikçi/ödeme context HTTP200. Mal kabulde 4 receipt ve 6 countDraft; alışta 5 draft; tedarikçi contextte 34 movement; ödeme contextte 1 payment görülmesi **scope içindeki TEST kayıtlarıdır**, kaynak gerçek açık iş sayıları değildir. Ödeme UI bilinen açığı bu görev dışında bırakıldı.

## Sentetik etkiler ve LIVE başlangıç planı

Goal8 exact `testProfile`, `testDayId`, request journal, link tabloları ve bağlı native işlem kimlikleri private `synthetic-effect-identifiers.json` içinde tutuldu. Satış, tahsilat, tedarikçi ödeme, sayım, mal kabul/alış ve iade aynı sealed günle ayrıştırılır. Actor, tarih, isim veya UI'da gizleme tek başına exclusion kanıtı değildir. Sonraki aynı profile ait kayıtlar da immutable journal/link closure üzerinden eklenmelidir; tarihi 9-stage makbuz bütün güncel TEST işlerinin tam listesi sayılmaz.

**LIVE'a alınmayacak kapsam:** kanıtı sentetik olan opening/fixture kayıtları ve bunların stock/customer/supplier/cash etkileri. TEST kanıtı silinmez; delete0. Goal7 gerçek kaynak delta run'ları sentetik Goal8 etkisiyle karıştırılmaz. Gerçek native yerel hareketler doğrulanmış kimlik ve ledger etkisiyle korunur.

**Somut kalan:** `target-opening-plan.mjs` local-delta predicate'i `source_record_key IS NULL`/`inventory_cutover_id IS NULL` hareketlerini korur; sentetik request/link ayrımı kendi içinde yoktur. LIVE planı bu formülü körlemesine kullanamaz. Exact synthetic effect exclusion manifesti ve gerçek local remainder proof gerekir. Final collector `excluded` ve approval `exclusionsHash` bağını destekler; bütün sentetik journal closure'ını otomatik üretmez. Bu inceleme exclusion planıdır, uygulanmış cleanup/cutover değildir.

## Kanıt yolları

Kaynak kuralları: `scripts/migration/source-vega-opening-snapshot.mjs`, `mapping-opening.mjs`, `target-opening-plan.mjs`, `goal7-source-native.mjs`, `goal7-test-delta.mjs`, `final-cutover-collector.mjs`.

Private çıktı kökü: `C:/Sirket/ERP/evidence/ERP-MIGUNIFIED01-20261008/private/operations/`:
- `field-operation-inventory-summary.json`: dated counts, reused evidence SHA256, UNKNOWN iş kapsamı.
- `product-field-mapping-private.json`: her kaynak kartın exact alanları, native ID mapping ve dar applied flags; business verisi public değildir.
- `synthetic-effect-identifiers.json`: tarihsel 9-stage kimlik/effect provenance; tüm güncel TEST kayıtları olduğu iddia edilmez.
- `current-test95-operation-readback.json`: fresh TEST95 identity ve beş read-only API yanıtı.
- `current-synthetic-scope-identifiers.json`: fresh scoped receipt/draft/payment IDs; tarihsel Goal8 receipt ve payment halen geri okunuyor. Bu projection tam SQL effect closure yerine geçmez.

Açılış kanıtı `VEGA-MIGRATION-TEST-20261004/private/VEGA-OPENING-TEST-20261004-06/verification-receipt.json`; Goal7 `analysis-private/source-apply-receipt.json` / `stock-apply-receipt.json`; Goal8 `private/day-result.json` korunur. İnsan kabulü verilmedi, LIVE/CRM/source değişmedi.
