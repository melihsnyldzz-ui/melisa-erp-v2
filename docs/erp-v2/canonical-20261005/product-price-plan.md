# C09 — native fiyat yazma ve yeni alışta kullanma planı

5 Ekim 2026. Kullanıcının `devam et` talimatı geliştirmeyi yeniden başlattı. Önceki salt okunur durum fotoğrafı `C:\Sirket\ERP\reports\ERP_CURRENT_STATE_20261005.md` karşılaştırma temeli olarak değiştirilmeden korunur.

## Amaç ve hedef

Normal Yeşil TEST fiyat ekranından desteklenen döviz/birim/kademe tuple'ında fiyat oluşturmak veya değiştirmek; yeni fiyatı gerçek native `dbo.product_prices` kaydından okumak ve yeni sentetik alışın kalıcı fiyat snapshotına bağlamak. Yalnız ekranda duran, ticari belge tüketicisine bağlı olmayan bir overlay C09 kapanışı değildir.

Kaynak `C:\Sirket\ERP\melisa-erp-v2`; origin `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git`; branch `codex/erp-finish-20261004`; başlangıç HEAD `a4ffbaa355b643799a96c26bf1bc2b7f4540d0cc`, çalışma ağacı temiz. Çalışan başlangıç TEST paket24/source `0907cddf9bd7db32da79c42dae22b33ffaa0e640`, web/API/native5194/4144/4146, `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`. Dış işlemler kapalı, LIVE erişimi0; kurulum/restart öncesi bu kimlik yeniden kontrol edilir.

İş durdurulduğunda C09 kaynak çalışması yarım kalmıştır. Teslim haritası/talimat uyarlaması sonrası 5 Ekim yeniden başlama HEAD'i `406ec95410ed1c7adff49757e1c4578280f91f04`; önceki 28 yerel C09 dosyası korunarak devam edilir. Bu belge güncel runtime'a C09'un kurulduğu anlamına gelmez. İlk görev yarım kalan C09'u gerçek TEST kabulü ve GitHub teslimiyle tamamlamaktır.

## Kapsam ve sınırlar

- Yazma yalnız mevcut sentetik ürün301986 ve tedarikçi13373 ile ayrılmış TEST kayıtlarında. Gerçek ticari kartlar salt okunur, RUN06 açılış fiyat satırları ve kaynak bağları değişmez.
- Fiyat `decimal(28,8)` kesin metin; NULL bilinmiyor, gerçek0 ayrıca korunur. Supported tuple listesi sunucudaki kanıttan gelir; istemcinin yeni birim veya kaynak kimliği icat etmesi kabul edilmez. Alış CARD/0; satış kanıtlı birim/kademe; desteklenen döviz TRY/USD/EUR.
- Native unit catalog bulunmadığı için satış birimi, ayrı doğrulanmış ADET×1 ve mevcut kaynak birim kanıtından **sentetik kopya** olarak açık bağlanır. Vega birimi veya güncel ticari fiyat olduğu iddia edilmez.
- Yeni native operasyon fiyatı, version/current metadata ve append-only before/after journal aynı atomik işlemde kaydedilir. UUID+tam payload+actor replay CAS'tan önce; yeni istek eski revision ile reddedilir. A→B→A eski revision'ı geçerli yapmaz.
- Liste alış fiyatı stok maliyeti değildir. Geçmiş mal kabul/fatura/kur snapshotları güncel fiyat değişiminden etkilenmez.
- Yeni fiyat tüketimi ayrı C09 işlem bağıyla, `TDAY-C09-*` belge/marker kapsamındadır. Eski C03 source/intent tablolarına yazılmaz. Mevcut native alış writer kullanılır; mal kabul stok oluşturur, taslak/finalize ikinci stok hareketi oluşturmaz.
- Yeni tüketimde fiziksel1–5 ADET ve200TRY sınırı korunur; NULL/0 fiyat veya sınır/kur/birim dışı seçim yazılamaz. Mevcut sentetik kurlar açıkça etiketlenir; piyasa kuruna veya bugünkü Vega'ya eşitlenmez.
- Eski günlük native guardların ayrılmış `TDAY-*` kolu yeni kapsamı destekliyor. Yeni C09 guard/owner doğrulama eklenir; eski15/17manifest, C03/C07 ve RUN06 tanımları değiştirilmez. Şema kurulumunda kısmi/başka sürüm fail closed olur.
- İlker TEST16'da mevcut `product.edit` yok. Kullanıcı, İlker TEST'e yalnız deneme fiyatı düzenleme iznini açıkça onayladı. Dar `product.price.edit` key'i yalnız bu rolün named TEST fiyat akışına eklenir; genel ürün düzenleme açılmaz. Salt okunur kullanıcılar mevcut görüntüleme yetkileriyle görebilir.
- Main merge, LIVE deploy/restart, Vega yazması, gerçek ticari karta deneme yazması, credential değişikliği ve restore/reset yok.

## Dosya sahipliği

| Sahip | Kaynak kapsamı |
| --- | --- |
| Backend ajanı | Yeni fiyat model/service/store/routes ve testler; yeni current-price purchase tüketicisi; `invoiceDraftService` C09 owner doğrulama dalı |
| Frontend ajanı | Normal `testPrices` ve yeni editör/model/stiller; `testPurchase`/view ve yeni tüketici UI/testleri |
| SQL ajanı | Yeni C09 installer generator/SQL/offline testleri; native fiyat/version/audit ve işlem bağları; DB yazması yapmaz |
| Root | Ortak route/navigation wiring, izin katalog kaydı, teknik kurulum/paket/restart, gerçek TEST kabulü, entegrasyon, plan/status/Git/CI |
| Bağımsız reviewer/release | Uygulama tamamlanınca ayrı salt okunur inceleme; eski korumalar ve geri dönüş/paket kaydı |

Aynı dosyada paralel yazma yapılmaz. Ortak API/SQL DTO ayrıntıları backend ve SQL arasında eşlenir; frontend bu sözleşmeyi kullanır.

## API çekirdeği

`GET/POST /api/products/:productId/current-prices`. Getter ürün, server-owned capabilities/supportedTuples, context revision, native price IDs/current version/provenance ve son değişiklikleri döndürür. POST yalnız `requestId`, `expectedRevision`, `priceId`, `tuple`, `priceExact`, `reason` kabul eder. Tutarlar Number üzerinden dönüştürülmez. POST aynı UUID için tarihsel cevabı döndürür; UI güncel fiyatı ayrıca yenileyebilir.

SQL owner getter/setter tek satır `{context_json,replayed}` döndürür. Hizmet ve SQL hedef kimliği, sentetik kapsam, actual native row witness, yetki ve replay/CAS bağını doğrular. Read-only/unauthorized/stale/unknown sonucu kullanıcıya açık gösterilir.

Yeni current-price purchase context/preview/receipt/draft/finalize/cancel, native fiyat sürümünü ve belge snapshotını doğrular. Eski C03 fiyat seçimi ayrı kalır. Normal alış ekranı güncel TEST fiyatını ve30 Eylül açılış kopyasını farklı etiketler; eski belge, kendi kayıtlı sürümüyle gösterilir.

## Kabul kriterleri

1. Normal fiyat ekranında supported tuple create/edit; SQL native satır ve immutable audit doğru. Sayfa yenilendiğinde değer ve kaynak sürümü aynı. NULL/0/precision ayrımı, invalid tuple/decimal/extra field reddi.
2. Aynı istek ikinci etki üretmez; farklı payload/actor reddedilir; eski revision409; belirsiz sonucu aynı istekle doğrulama çalışır. Read-only/unauthorized ve gerçek kartta edit yok.
3. Yeni fiyatla normal alış önizlemesi → fiziksel kabul → kalıcı native taslak → finalize/iptal; fiyat ve kur snapshotı tutarlı, borç bir kez, taslak/finalize ek stok0. Sonraki fiyat edit'i eski belgeyi değiştirmez.
4. Eski RUN06/migration/karantina/fiyat okuyucu/C03/C07 mühürleri ve ticari tablolar korunur; yalnız açık C09 sentetik etkileri fark olarak kaydedilir. Negatif/replay ek etki0.
5. Normal fiyat editörü ve yeni alış akışı1440/1024/390'da kullanılabilir; büyük işlemler, kesin tutar ve hata/readonly/stale durumu açık. Fiziksel cihaz veya personel kabulü ayrıca kaydedilir.

Uygun model/API/UI/SQL-generator hedefli testleri ve gerekli build, bağımsız review, actual TEST API/UI/SQL kanıtı tamamlanmadan teknik PASS verilmez. Kullanıcı/personel kabulü bulunmazsa modül 🟡 kalır; genel C09 veya ERP tamamlandı denmez. Commit→push→mevcut DraftPR23 teslimi ve tam head CI; STATUS/finish tree root tarafından güncellenir.
