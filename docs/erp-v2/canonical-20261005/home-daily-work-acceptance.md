# B01 — Ana Sayfa / günlük iş sırası

5 Ekim 2026. Yalnız normal `ornek-akis.html#home` değişti. Yeşil menü ve genel düzen korundu. **Teknik hazır; ERP-UA05 insan kabulü bekliyor.** Kullanıcının önceki Ürün & Stok kabulü ERP-UA04 PASS, ERP-D04 mevcut onaylı kapsamda tamamdır.

## Çalışan sürüm

- URL: http://127.0.0.1:5194/ornek-akis.html#home
- TEST paket47: `C:\Sirket\ERP\releases\CANONICAL-HOME-TEST-20261005-47`; uygulama source `236d49b96dbd71b000670254b1699b742f6a9038`.
- Web5194 / API4144 / native4146 → `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`. Named TEST login; sysadmin0, control0, LIVE erişimi0; native salt okunur, dış işlemler kapalı.
- Dal `codex/erp-finish-20261004`, [draft PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23). İzleyen `5d23b89909623170a5ad706901b9575a1d9b74b3` yalnız eski demo guard testini davranış üzerinden doğrular; paketle uygulama dosyaları aynıdır. Son belge commit'i runtime source değildir. Tam son head CI, PR Checks'ten izlenir.
- Exact 5d23 head hosted push37355277039 / PR37355285542 quality-build-test ve secret-scan SUCCESS. İlk236 head'de eski test kaynak metni eşleştirmesi reddetti; davranış testiyle düzeltildi, uygulama davranışı değiştirilmedi. Bu önceki CI hatası gizlenmez.

## Kullanıcının gördüğü yüz

Dört üst özet: bugünkü satış, bekleyen mal kabulü, bekleyen onay, bugünkü tahsilat. Altında en çok5 gerçek bekleyen iş, kısa günlük döküm ve altı büyük bağlantı: Mal Kabul, Satış, Tahsilat, Ürün & Stok, Müşteriler, Tedarikçiler. İş sırası Mal → Kabul → Alış → Satış → Tahsilat / Ödeme → Sayım / İade → Gün sonu olarak gösterilir. TRY/USD/EUR ayrı satırlardır; dövizler toplanmaz veya kura çevrilmez. Bilgi açılmadan sayı üretilmez; örnek localStorage kayıtları okunmaz. Normal Ana Sayfa'da TEST/debug/migration/SQL/commit/PASS-FAIL yazısı bulunmadı.

## Gerçek kaynak ve hazır olmayan bölümler

`GET /api/home/summary` mevcut oturumla yalnız doğrulanmış native TEST DB'yi okur. Gün Europe/Istanbul takvim günüdür; tarih/query override kabul edilmez.

| Bölüm | Kaynak / kapsam | Gerçek gözlem |
| --- | --- | --- |
| Bugünkü satış / iptal | `sales_invoices`, finalized/cancelled, bugünkü document_date | 0 fiş / 0 iptal; satış tutarı için Henüz veri yok |
| Bekleyen mal | `test_goods_receipts`, `test_goods_batches`, goods türündeki `test_daily_drafts` | 0 bekleyen |
| Yapılan tahsilat / ödeme | `customer_movements` collection ve `supplier_movements` payment, bugünkü kayıtlar | Bugün kayıt yok; Henüz veri yok |
| Ters kayıtlar | Tahsilat/ödeme iptal ve para dönüşü hareketleri ayrı | Bugün kayıt yok; brüt tutardan netleştirilmez |
| Sayım / iadeler | Pending count taslakları; günün finalized/cancelled `invoice_returns` kayıtları | 0 bekleyen sayım; bugün iade/iptal0 |
| Onay | Yalnız yetkili mal kabulü, sayım, müşteri/tedarikçi iadesi taslakları | 0; API complete:false, bütün ERP onaylarının tamamı olduğu iddia edilmez |
| Bekleyen tahsilat / tedarikçi ödeme işleri | Güvenilir vade/bekleyen iş kaynağı henüz bağlı değil | Henüz bağlı değil; yapılan hareketler bekleyen borç gibi sunulmaz |
| Kasa bakiyesi | Kanıtlı açılış + hareket + sayım bakiyesi henüz bağlı değil | TRY/USD/EUR ayrı ayrı Henüz bağlı değil; sıfır bakiye uydurulmaz |

Burada “gerçek” doğrudan kalıcı TEST kayıtlarından okuma anlamındadır. Eski operasyon tablolarında ayrılmış sentetik TEST ürün/cari/kur kayıtları vardır; bunlar gerçek ticari LIVE işlemi sayılmaz. B01 bunları değiştirmedi veya boş günü doldurmak için yeni işlem oluşturmadı. 30 Eylül katalog açılışı ve güncel Vega delta ayrı kalır; B01 migration uygulamaz. Katalog16.622 kabul edilmiş/54hold, 3.830 merkezi CONFIRMED fotoğraf,67belirsiz ve karantina kuralları korunur.

## Yetki ve yönlendirme

Yetkiler mevcut aktif SQL kullanıcı/rol can_view satırları ile oturum izinlerinin kesişimidir; permission expansion görünüm hakkı yaratmaz. Bölüm hakkı yoksa sayı/tutar yerine Görüntüleme yetkiniz yok; bağlantı kapalıdır. Mevcut operasyon ekranının ortak okuma önkoşulları eksikse bağlantı da açılmaz. Yeni izin, kullanıcı veya rol yazılmadı.

- İlker16: mal kabulü → tahsilat → tedarikçiler önce; mevcut finans görünümü açık.
- Xaser Satış15: mevcut alış/mal kabul görüntüleme hakkı da olduğundan operasyon sırası kullanılır; tahsilat/tedarikçi kısa yolları ve finans bilgileri kapalıdır. Yeni bir satış rolü veya izin seti oluşturulmadı.
- Xaser Okuma14: müşteri → ürün → satış önce; mal kabul/tahsilat kapalı, tedarikçi yalnız mevcut okuma yetkisiyle açılır.
- Yönetici mevcut hakkıyla bekleyen/onay işleri öne alınır. Angela için ayrı bir gerçek hesap/personel kabulü yapılmadı; kişi adı üzerinden rol tahmini yapılmaz.

Gerçek tarayıcıda altı kısa yol tıklandı: ürün normal `#stock` yüzünde; mal kabul/satış/tahsilat/müşteri/tedarikçi mevcut `is-akisi-taslagi.html` gerçek TEST ekranlarında açıldı ve kayıtlar/formlar göründü. Satış/finans yeniden tasarlanmadı. Bu mevcut hedef ekranların eski teknik TEST metinleri korunur; yalnız yeni normal Ana Sayfa sadeleştirildi. Hiçbir kaydet/onay/ödeme/satış düğmesi çalıştırılmadı. Normal sayfa açık bırakıldı.

## Hız ve görünüm kanıtı

- Gerçek tarayıcı navigation→ilk boya161ms, DOMContentLoaded117ms, tek HOMEsummary tamamlanması ve kullanılabilir bağlantılar324ms. Sayfa tüm modüllerin listelerini yüklemez. Mevcut bootstrap'ın ilk iptal edilen otomatik auth isteği ve başarılı auth isteği ayrıca ağ kanıtında tutuldu; yalnız bir HOMEsummary görüldü.
- Altışar API okuması: İlker ilk274ms/medyan63ms; satış15 ilk208ms/medyan18ms; okuma14 ilk196ms/medyan17ms.
- Katalog dar regresyon: eski46 tek50istek648ms; yeni47 başlangıç denemesi1007ms; ısınmış3istek629/670/654ms (medyan654ms). Başlangıç farkı saklandı; birebir daha hızlı iddiası yok. Liste50, kapsam16.622/54, sentetik0; katalog sorgusu/medya/sınıflandırma değiştirilmedi.
- 1440 /1024 /390 hedef CSS genişlikleri kontrol edildi; dikey scrollbar nedeniyle içerik1427/1011/377px, yatay taşma yok. Masaüstü dört özet ve yan yana işler/kısayollar;1024 alt bölümler alt alta;390 iki özet sütunu ve tek kısa yol sütunu. Küçük kısa yollar72px yüksekliğindedir.
- Tarayıcı zoom1,16 olduğundan tam görüntü CDP physical contentSize ile kaydedildi; görüntülerin sağ kenarı kesilmez. Orijinal UI görüntüsüne düzenleme yapılmadı.

Yerel kullanıcıya açık görüntüler:

`C:\Users\Xaser\Documents\Codex\2026-10-04\referenced-chatgpt-conversation-this-is-an-6\outputs\ERP-B01-home-1440.png`

aynı klasörde `ERP-B01-home-1024.png`, `ERP-B01-home-390.png`, `ERP-B01-home-ilker.png`, `ERP-B01-home-readonly.png`, önceki yüz `ERP-B01-before-home.png`. [Kanıt manifesti](home-daily-work-evidence.json) hash/boyutları verir. Ham API/ağ/rol/koruma kanıtı repo dışı `C:\Sirket\ERP\evidence\ERP-HOME-20261005` içindedir; kimlik bilgisi/token GitHub'a taşınmaz.

## Teknik doğrulama / korunanlar

Hedefli API8 + home9 + session15 =32 test PASS; bağımsız incelemede bloklayıcı yok. İzleyen demo guard davranış testleri2/2 PASS. Gerçek API: auth yok401, tarih query400, POST405; finans erişimsiz15/14 hassas tutar döndürmez. READ_COMMITTED ve üç sınırlı SQL isteği; tüm ticari kalıcı veriler salt okunur. Batch-scoped `@HomeSales` agregasyonu kalıcı tablo yazması değildir. SERIALIZABLE, global migration tekrarı veya tam modül liste yüklemesi eklenmedi. Decimal38,4 exact metin; NULL/Bilinmiyor/gerçek0 ayrıdır.

Önce/sonra28 ticari tablo tam SHA/count/maxID,142 SQL modül SHA ve555 SQL permission satırı birebir aynı. Launcher47 dışında private config/merkezi medya/sınıflandırma hashleri korundu. Paket1.296 manifest dosyası ve16.977 dependency doğrulandı. Eski46 ve launcher `start-canonical-test-before-home-47.ps1` saklandı; dönüş eski launcher/paketle yapılabilir, veri veya medya geri dönüşü gerekmez. LIVE süreç sahipleri aynı; CRM/main merge/başka finish işi yok.

## ERP-UA05 için kullanıcı adımları

1. Ana Sayfa'yı aç/yenile; bugünün işlerini ve dört özeti okuyabil.
2. Mal Kabul, Satış, Tahsilat ve cari kısa yollarının beklediğin mevcut ekranı açtığını dene; bu kabul sırasında gerçek ticari işlem yapma zorunluluğu yok.
3. TRY/USD/EUR'nun ayrı kaldığını, henüz bağlı olmayan bakiyelerin sıfır gibi sunulmadığını kontrol et.
4. Kendi mevcut hesabında sıralama/kapalı bağlantıların günlük görevinle uyumunu kontrol et; yeni yetki verilmedi.
5. 1440/1024/390 kullanımını değerlendir ve ERP-UA05 PASS/FAIL bildir. Bu ajan provası insan PASS değildir.

B01 🟡 teknik hazır / insan kabulü bekliyor. Sonraki iş otomatik başlatılmadı; bu tur sonunda durulur.
