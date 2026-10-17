# ERP04 / A02–C09 — alış referansı teslimi ve fiyat yazma bağımlılığı

13 Ekim 2026. ERP-DEC-050/053 kapsamındaki mevcut ana iş. Alış referansının DB02 okuması teknik hazır; genel fiyat yazma tamamlanmadı. Kabul edilmiş satış, stok, restore ve C09 fixture provası tekrar edilmedi. İnsan ERP-UA26/32 bekliyor.

## Çalışan teslim

- Uygulama source: `c3a84d0cbdfb5612851e2e5ca5ae4da255c7474c`.
- Paket: `CANONICAL-COMPLETE-TEST-20261011-c3a84d0`; 1.879 dosya.
- Manifest SHA256: `df89806415e42c71051829d46c533879ac7831920ac90219e1949f973a7d8581`.
- Web5234 / API4184 / native4186; `Semih\MELISADEV / MELISA_ERP_CRM_SHARED_TEST_20261009_02`, copy `e16b70f0-4057-428b-9abc-6bbcaf35fe82`, actualT1=false.
- Normal ekran: <http://192.168.1.46:5234/ornek-akis.html#stock>. Ürün kartındaki **Alış referansını görüntüle** mevcut yetkili oturumla çalışır.

Kopyadaki V1/V2 alış referansı metadata ve SQL modül/trigger kimlikleri başlangıçta doğrulanır. Her GET'te current actor, SQL izinleri, exact DB/copy, kaynak bağı, ürün hash'i, hold ve manuel değişiklik kontrolleri SERIALIZABLE transaction içinde sürer. Eski guard/procedure, DML, grant, şema ve rol değişmedi.

Hedefli kaynak testleri 26/26, bağımsız inceleme GO; paket ve gerçek DB02 başlangıç preflight'ı geçti. Normal yetkili API ve gerçek yeşil Chrome kartı aynı tarihli belge referansını gösterdi. Kart alış fiyatı ve belge net tutarı ayrı; kart iskontosu net tutara ikinci kez uygulanmadı. Referans ortalama maliyet veya gerçekleşmiş kâr diye sunulmadı. Yeni ticari yazma 0. Bu kanıt teknik kabul olup insan kabulü değildir.

Altı süreç/dört health kimliği, özgün TEST125, CRM'nin mevcut paketleri ve sahibinin 11 satırlık yerel çalışması önceki teslim kanıtıyla korunur. Ham ürün/tutar ve özel ayarlar GitHub'a alınmadı. Private kanıt: `C:/Sirket/ERP/evidence/ERP-COMPLETE01-20261013/private/a02-price-write/`; `after-price-api.json`, `delivery/running-proof.json`, `delivery/package-reader-preflight.json`, `delivery/HANDOFF.md`. Gerçek tarayıcı görüntüsü araç oturumunda görüldü; bu klasörde ayrıca ekran görüntüsü dosyası varmış gibi raporlanmaz.

## Genel fiyat yazma neden açık?

Normal kart ve ayrılmış deneme ürünü için `current-prices` GET'i DB02'de 404. Bu, parola veya insan kabulü engeli değildir. Mevcut İlker rolündeki `product.price.edit` izni onaylı sentetik C09 kapsamına aittir; genel kart yetkisi değildir. Hedef uygulama/SQL sözleşmesi de genel yazmayı desteklemiyor.

| Katman | Mevcut sınır | Açılması için gereken |
| --- | --- | --- |
| Shared bootstrap/router | C09 fiyat router'ı bağlı değil. | Desteklenen copy-specific fiyat sözleşmesi ve başlangıç proof'u. |
| Route policy/model/store | Yalnız product301986, actor16, original canonical TEST DB. | Eski C09 sınırını değiştirmeden ayrı doğrulanmış DB02 capability. |
| C09 metadata | Current CHECK301986; request/version CHECK16; scope/units/manifest immutable. | Genel kartların sürüm, CAS, UUID/full-body replay ve audit sözleşmesi. |
| DB02 SQL | product_prices/C09 tabloları mutable listede değil; genel fiyat DML/owner EXEC yok. | İncelenmiş dar owner procedure ve metadata revision; genel DML izni değil. |
| Kaynak fiyat okuması | Native ID, tuple, exact8 ve tam satır hash'i kaynak binding mühürlü. | Kaynağı değiştirmeyen güncel sürüm tüketimi; eski belgelerin snapshotları sabit. |

Dayanaklar: `testProductPriceModel.mjs`, `testProductPriceStore.mjs`, `canonicalTestRoutePolicy.mjs`, `start-shared-test-copy.mjs`; `scripts/canonical/enable-test-product-prices.mjs`, `stage4-copy-sql.mjs`, `shared-business-copy-install.ps1`, `shared-business-native-guards.mjs`, `goal7-source-catalog-readers.mjs`. Bağımsız salt okunur kaynak incelemesi aynı engeli doğruladı.

Yalnız router eklemek yeterli değildir; mevcut fixture/original DB pinleri DB02 genel kartlarını kapalı reddeder. Kaynak fiyat UPDATE ise kaynak witness drift üretir. Aynı tuple'a ikinci native satır eklemek de tek tuple kontrolünü bozar. Bu tur guard kaldırılmadı, genel yazma açılmadı, kaydetme/readback/unauthorized/replay kanıtı üretilmiş sayılmadı. A02 ve C09 kısmi kalır; toplam49/9tamam/39kısmi/1açık değişmedi.

## GitHub / ayrı takip

Branch `codex/erp-finish-20261004`, [PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23). Source c3a84d0 için altı GitHub CI kontrolü FAILURE; job'lar hesap ödemesi/harcama sınırı nedeniyle başlamadı. [Kaynak run](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/38372342542). Vercel SUCCESS, bu kontrollerin yerine geçmez. Doküman teslim commit'i çalışan source'tan ayrıdır.

Diğer bilgisayardaki sabit55 yönetici takip kaydı bu repoda bulunmuyor. Bu teslimin ERP04 karşılığı: **alış referansı teknik hazır; genel fiyat yazımı somut uygulama/SQL bağımlılığı; insan kabulü bekliyor**. Yeni ikinci55 listesi oluşturulmadı ve uzaktaki kayıt güncellenmiş sayılmadı. CRM paused, Hub giriş işi iptal, cihaz ret sınırı aynı. Bağımsız yetkili sıradaki çalışma mevcut fiş/koli GET gecikmesi; LIVE/Vega/T1/main/gerçek mesaj/ücretli servis yok.
