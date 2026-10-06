# Goal5 — personel terminali teknik hazırlığı

Tarih: 6 Ekim 2026. Kapsam: kullanıcının **MELISA — UZUN GOAL5** talimatı. İnce personel terminali gerçek ortak TEST tarayıcı zinciriyle teknik hazırdır. [Son teknik kayıt](../../evidence/erp/2026-10-06-goal5/README.md) kaynak/paket, rol, native geri okuma, performans ve CI'ı ayırır. Fiziksel Zebra cihazı bağlı değildir; bu belge cihaz kabulü veya insan PASS kaydı değildir.

## İnce çalışan yüzü

Yeni giriş noktası `apps/sites-workflow/terminal.html`; uygulama `src/workflow/personnelTerminal.js`, görünüm `personnelTerminal.css`, sınırlı rota/oturum/scanner sözleşmesi `personnelTerminalModel.mjs` içindedir. Vite build girdisine terminal eklenir. Kabul edilmiş `ornek-akis.html` masaüstü yüzü korunur.

Terminalin altı günlük aksiyonu vardır:

| Aksiyon | İnce istemcinin kullandığı kaynak | İşlem sınırı |
| --- | --- | --- |
| Mal Kabul | Mevcut `createWorkReceiving` ve ortak ERP API | Personel sayar, miktar/not kaydeder. Fiziksel kabul mevcut yetkili işidir. |
| Satış | Mevcut `createWorkSales` ve UUID journal | Müşteri, ürün, miktar, sepet, fiyat doğrulama ve mevcut taslak/satış davranışı. Teknik prova gerçek ticari satış finalize etmez. |
| Müşterilerim | Aynı hosttaki CRM terminal yüzü | CRM oturumu ve sunucu atama yetkisi; başka personelin konuşmasına geçiş yetkisi oluşturulmaz. |
| Ürünler | `melisa-catalog.v1` ve doğrulanmış medya uçları | Gerçek stok, kod, barkod, marka/tür, satış fiyatı/döviz, fotoğraf; salt okunur. |
| Sayım | Mevcut `createWorkCount` / günlük sayım API | Personel fiziksel farkı kaydeder; stok farkını tek başına onaylayamaz. |
| İade | Mevcut `createWorkSupplierReturns` | Yalnız mevcut izinli kaynak ve başlangıç. Yetkisiz personelin 403 sonucu korunur; yeni iade/finans izni verilmez. |

Yeni ticari veritabanı, bağımsız ürün/fiyat gerçeği veya otomatik offline sync motoru kurulmaz. ERP ticari gerçek, CRM müşteri iletişimi, AI insan kontrollü yardımcıdır. Mevcut browser journal/UUID kayıtları işlem sonucunu yeniden doğrulamak içindir; merkezi ticari gerçeğin yerini almaz.

## Korunan Android kaynağı

`apps/terminal-native` içindeki provenanced Kotlin/Jetpack Compose kaynağı değiştirilmez:

| Kimlik | Korunan değer |
| --- | --- |
| Paket | `com.melisaerp.nativeterminal` |
| Sürüm / versionCode | `1.0.0-candidate.18-t2` / `20` |
| Kaynak turu | `T2-20260917-01` |
| Taban dal / HEAD | `codex/terminal-native-v1-20260914` / `0e14256f13f03d5cf7610a955da7b5ec0a2b52b3` |
| Köken kaydı | [`source-provenance.json`](../../../apps/terminal-native/source-provenance.json) |

Bu Goal5 browser yüzü yeni APK veya eski Android uygulamasıyla uçtan uca kabul anlamına gelmez. `public/terminal-cihaz.html` gömülü görsel demo ve `workflow-terminal.js` demo fiş journal'ı da değiştirilmez; gerçek Goal3/Goal4 teknik kabul yerine kullanılmaz. Fiziksel cihaz geldiğinde uygun browser erişimi ve mevcut native uygulamanın ayrı kimliği açıkça ayırt edilir.

## Ürün / fiyat / medya

Terminal katalog sayfası aynı 50 ürünlük sözleşmeyi tüketir. Barkod string olarak taşınır; baştaki sıfırlar sayıya çevrilmez. Enter önce exact barkod arar; sonuç yoksa izinli uzunluktaki metin mevcut kod/ad aramasına gönderilir. İsim/kod düğmesi ayrıca vardır. KOD1/KOD4 gerçek sınıflandırmadır; boş marka/tür tahminle doldurulmaz. Orijinal STOKKODU ayrıntıda korunur.

Kompakt kartın alanları: fotoğraf, gösterim kodu, marka, tür, ürün adı, stok/birim, satış fiyatı/para birimi, kaynak stok kodu ve barkod. Ana fiyat yalnız doğrulanmış ana birimin tek kademe1 fiyatı varsa gösterilir; NULL veya belirsiz fiyat `Fiyat bilinmiyor` kalır. Maliyet/kâr ekranı veya alanı yoktur.

Yalnız mevcut doğrulanmış merkezi medya bağlantısı gösterilir; 3.830 CONFIRMED bağlantı ve 67 AMBIGUOUS dışlama sınırı değişmez. Thumbnail yüklemesi mevcut doğrulanmış lazy loader ile yapılır, detayda fotoğraf ayrı yüklenir. Fotoğraf üzerindeki fiyat satış fiyatı kaynağı değildir. Karantina ürününde inceleme durumu korunur; fiyat veya ticari işlem yetkisi üretilmez.

Gerçek katalog 30 Eylül snapshot ve mevcut TEST stok kaynağıdır; yeni Vega delta/cutover veya LIVE tazeliği iddiası yoktur. Goal3 kaydetme akışları ayrılmış TEST scope ürün/cari/tedarikçilerinde kalır; katalogdaki her gerçek ürünü ticari yazmaya açmaz.

## Personel kimliği ve roller

ERP terminal oturumu desktop oturumundan ayrı `melisa-personnel-terminal:` sessionStorage ad alanını kullanır. Mevcut normal ERP hesabıyla giriş yapılır; parola yalnız giriş sırasında kullanılır ve alan temizlenir. `manual` oturum seçimi zorunludur; admin otomatik açılışına düşmez. Admin kimliği terminal personel yüzünde reddedilir.

Mevcut gerçek roller ve backend izinleri değişmez. Terminal facade finans, tedarikçi ödeme, alış yönetimi, fark onayı/ret/ters kayıt uçlarını personel yüzünden çağırmaz. Görsel düğme veya rota bir API izni değildir. Sayım ve iade yetkisiz negatifleri mevcut sunucu davranışıyla ayrıca doğrulanmalıdır.

Müşteri personele bağlıdır; cihaz müşterinin sahibi yapılmaz. CRM kendi personel hesabını ve gerçek konuşma atamasını doğrular. ERP ve CRM arasında parola, token, kullanıcı seçimi veya rol payload'ı taşınmaz. Tek uygulama hissi oturum/kimlik sınırlamasını kaldırmaz.

## CRM gömme ve vardiya çıkışı

ERP hostu için yalnız onaylı TEST hostları `127.0.0.1`, `localhost`, `192.168.1.46`, port5194 kabul edilir. CRM URL'si tam olarak aynı hostta port62400 köküne gider:

`http://127.0.0.1:62400/?terminal=1&erpOrigin=http%3A%2F%2F127.0.0.1%3A5194`

LAN'da aynı yapı `192.168.1.46` ile kullanılır. Serbest query origin veya dış site hedefi kabul edilmez. İframe ERP işine dönüldüğünde korunur; bu, konuşma/seçili ürün bağlamını yaşatır. CRM teknik menüsü terminal kullanıcı yüzüne taşınmaz.

Sadece yönlendirme ve yaşam döngüsü mesajları kabul edilir. Alıcı hem exact origin hem iframe `contentWindow` kaynağını doğrular; fazladan kimlik/token payload'ı reddedilir:

| Yön | Mesaj |
| --- | --- |
| ERP → CRM | `type: melisa-terminal-parent`, `version: 1`, `action: activate / logout` |
| CRM → ERP | `type: melisa-terminal-child`, `version: 1`, `action: ready / home / unavailable / logged-out` |

İframe URL'sini kaldırmak çıkış sayılmaz. Vardiya çıkışında ERP kendi token'ını temizler, CRM iframe gizlenir ve `logout` gönderilir. CRM kendi terminal oturumunu ve personel bağlamını temizledikten sonra `logged-out` onayı verir. Onay gelmeden yeni personele eski CRM yüzü gösterilmez. Dört saniyelik yanıtsızlıkta CRM kapalı kalır ve kapanış bekleme kaydı refresh boyunca korunur; gizli iframe tekrar yalnız logout için açılır. ERP işleri sürdürülebilir. Sonraki CRM erişimi ancak kapanış onayıyla açılır.

## Scanner, refresh ve kayıt koruması

- HID/klavye scanner ve elle yazım aynı string input yolunu kullanır; cihaz türü tahmini yapılmaz.
- Enter sonrası exact sorgu veya mevcut scope ürün ekleme uygulanır. Aynı değer için hızlı ikinci Enter600ms içinde engellenir; API yazması veya ürün sorgusu sürerken yeni scanner Enter işlenmez.
- Sayım bilinmeyen barkodu `Stok kartı gerekli / inceleme gerekli` olarak korur; sahte kart oluşturulmaz.
- Mevcut Goal3 UUID/body journal'ı yeniden yazılmaz. Bekleyen write veya doğrulanmamış sayım varsa başka ekrana geçiş engellenir.
- Refresh, aynı UUID/body replay, farklı body conflict ve yanıt kaybı teknik kabulde ayrı kanıtlanmalıdır. Local test sonucu gerçek native etki/readback yerine geçmez.
- CRM native ERP taslak akışı Goal4 sözleşmesini kullanır: taslak stok, cari, tahsilat/ödeme veya rezervasyon etkisi yaratmaz. Terminal ayrı draft motoru üretmez.

## Offline ve bağımlılık hataları

Offline durumda açık kullanıcı metni: **Bağlantı yok — bu işlem çevrimiçi tamamlanmalıdır.** Yeni ağ isteği/yazma veya sonradan otomatik uygulama kuyruğu oluşturulmaz. Görünür eski ürün kartı merkezi güncel fiyat doğrulaması sayılmaz; bu sürümde yeni bağımsız ürün cache motoru yoktur.

| Bağımlılık | Kullanıcı davranışı / sınır |
| --- | --- |
| ERP erişilemiyor | Ürün/stok/fiyat/taslak işlemi doğrulanamaz; hata gösterilir. CRM kendi mesaj geçmişi kullanılabiliyorsa devam eder. |
| CRM erişilemiyor | Müşteri bölümünde sade bağlantı mesajı ve yeniden deneme; ERP ana ekranındaki işler devam eder. |
| AI erişilemiyor | İnsan mesaj yazabilir; AI ana ERP/CRM işlemini bloke etmez. AI gönderim/fiyat/finalize yetkisi kazanmaz. |
| Offline | Online gerektiren işlem engellenir; kullanıcı bağlantı metnini görür. |
| NULL fiyat / fotoğraf yok | Bilinmeyen fiyat / temiz eksik fotoğraf durumu; demo değer eklenmez. |
| Başka personelin konuşması | CRM sunucu atama/rol denetimiyle erişim reddi; terminal başka personele geçiş yetkisi vermez. |

Çeviri kontrolü CRM terminal yüzündedir. Açık/Kapalı ve orijinal/çeviri görünümü mevcut T01 sınırını korur. Kapalı çeviride sessiz dönüştürme yoktur; orijinal mesaj saklanır. Ürün/fiyat paylaşımı bilinçli personel aksiyonudur, gönderim öncesi ERP fiyat doğrulaması gerekir. AI yalnız öneri/çeviri yardımcısıdır; otomatik müşteri gönderimi veya ERP finalize yoktur.

## Teknik kanıt ile insan kabulü ayrımı

Dokuz terminal modeli testi rota, pinned origin/iframe Referer, ayrı oturum/admine kapalı normal rol, scanner leading-zero/çift Enter, offline ve finance/approval facade sınırlarını kapsar. Yedi personel DTO testi sayım/iade kaynak kimliği korunurken maliyet ve finans alanlarının GET/taslak/replay yanıtından çıkmasını doğrular. CRM güncel atama/session/body-journal, konuşma sürekliliği ve belirsiz gönderim korumaları hedefli testlerde ve exact source CI'da ayrıca kontrol edilir. Test/CI insan kabulü değildir.

Gerçek TEST kimliği, 360/390/1024/1440 ölçümleri, normal rol, pozitif/negatif/replay, native readback ve süreler [teknik kanıtta](../../evidence/erp/2026-10-06-goal5/README.md) kayıtlıdır. Bekleyen insan/cihaz kabulünün tek kaydı `USER_ACCEPTANCE.md` olarak kalır. C12🟡 ve CRM M01🟡 otomatik yeşil yapılmaz.

### Teknik teslim kaydı

| Alan | Durum |
| --- | --- |
| TEST URL / exact çalışan paket | http://127.0.0.1:5194/terminal.html ; ERP TEST74/source5972f847. CRM final source4eadb51 ve değişmeyen native62404/source0940c49 aynı TEST DB zincirinde; exact manifest/READY ayrı [runtime kaydında](../../evidence/erp/2026-10-06-goal5/runtime.json). |
| Tarayıcı uçtan uca tur / ekran görüntüleri | Altı aksiyon, ortak kayıtlar7/43/44, gerçek0161/8023 ürün/fiyat/fotoğraf, CRM55/çeviri/menü sürekliliği, native9/25,44USD; 360/390/1024/1440, [ekranlar](../../evidence/erp/2026-10-06-goal5/README.md). |
| Negatifler / native yazma-readback / replay | Personel finans/onay403, CRM foreign753403/oturumsuz401, held4620, bilinmeyen barkod, eksik döviz fiyatı, fotoğraf yok, offline/AI/ERP/CRM kesintileri; native9 aynı UUID replay, farklı body409 ve sıfır ticari etki. LiteralNULL sale kaydı katalogda0 bulundu; gerçek NULL örneği uydurulmadı. |
| On performans ölçümü | ERP HOME21/barkod343/kart172/sepet context37/sayım59ms; CRM final4ead fazı sohbet208/atanmış684/seçici759/kart409/nativeGET256ms; gerçek çeviri1957/nativecreate5914ms eski ebe8/ERP73 fazı olarak ayrı. Son source fazı [CRM JSON](../../evidence/erp/2026-10-06-goal5/crm-performance.json); HTTP/browser/cihaz ölçümleri karıştırılmaz. |
| ERP ve CRM exact commit / PR / CI | ERP application5972f847 / PR23; CRM application4eadb51 / PR3. Exact source CI ve belge HEAD'i [runtime](../../evidence/erp/2026-10-06-goal5/runtime.json) ve STATUS'ta ayrı; main merge yok. |
| Rollback noktası | Normal ERP önceki TEST71/source9ada67c ve eski launcher korunur; en yakın74→73 before launcher da repo dışında. CRM önceki95465/9c62702 paket/config switch geçmişi ve Goal5 öncesi ad01203 korunur; native62404 süreç/paket değişmez. Özel config/credentials GitHub'a konmaz. |
| Fiziksel Zebra / gerçek personel kabulü | Bekliyor; bağlı fiziksel cihaz yok. |

## Fiziksel Zebra geldiğinde kısa kabul listesi

1. Cihaz modeli/Android sürümü, Wi-Fi ve doğru TEST/LAN URL erişimini doğrula; LIVE'a bağlanma.
2. Gerçek personel girişini dene; başka cihazda aynı hesabın kendi müşterilerini göstermesini, başka personelin müşterisinin gizli/engelli olmasını doğrula.
3. Scanner trigger, HID/DataWedge ayarı ve input odağını kontrol et; barkodun baştaki sıfırlarıyla tek parça düşmesini doğrula.
4. Donanım Enter suffix'iyle tek okutmanın tek sorgu/ekleme yaptığını, hızlı ikinci Enter veya çift dokunmanın ikinci ticari kayıt oluşturmadığını doğrula.
5. Mal Kabul'de adet/not, bilinmeyen barkod, kaydedip devam ve refresh; personelin kabul onayını yapamaması.
6. Satışta müşteri, fotoğraf/stok/fiyat/döviz, miktar/sepet ve mevcut izinli tamamlama akışını ayrılmış TEST kaydıyla dene.
7. Müşterilerim'de mesaj geçmişi, çeviri Açık/Kapalı, orijinal/çeviri, ürün/fiyat önizleme ve native taslak geri okuma; yalnız izinli7733 gerçek gönderim gerekiyorsa ilgili onaylı kapsamı kullan.
8. Sayım fark kaydı ve yetkisiz onay engeli; izinli iade başlangıcı, yetkisiz finans/ödeme engeli.
9. Kamera izin/erişim davranışını cihaz üzerinde kontrol et; browser yüzünde bulunmayan kamera özelliğini çalışıyor sayma.
10. Gerçek ekran boyutu, sistem yazı ölçeği, ekran klavyesi, tek elle dokunma, yatay taşma ve modal/kart kapanışını kontrol et.
11. Uyku/uyanma, ekran kilidi, Wi-Fi kopma/geri gelme, refresh ve vardiya boyunca oturum/konuşma bağlamını doğrula; offline yazma oluşmadığını kontrol et.
12. Vardiya çıkışında ERP/CRM oturumunun kapanması ve sonraki personelin önceki kişinin mesaj/taslak/sepetini görememesi.
13. Cihazda ana ekran, barkod, kart, sepet, müşteri listesi/konuşma, çeviri, ürün seçici, taslak ve sayım sürelerini ölç; browser bilgisayar ölçümünü cihaz performansı sayma.

Goal5 teslimi sonunda durulur. Goal6 rapor/ayar/autostart/backup, Goal7 migration, LIVE deploy, main merge, Vega write ve7733 dışı gerçek mesaj bu belgenin kapsamı değildir.
