# 18 Ekim 2026 — 75. sürüm ekran düzeninin teknik adaya taşınması

## 19 Ekim — iki Chrome oturumu ve gerçek TC21 barkod aktarımı

Kurulu ERP e59/supervisor13b/CRM6bc değiştirilmedi. API4184/native4186/web5234 aynı `MELISA_ERP_CRM_SHARED_TEST_20261009_02`, copy `e16b70f0-4057-428b-9abc-6bbcaf35fe82`, actualT1=false kimliğini verdi; iki mevcut gözetmen Running kaldı. Kurulum/restart, migration, ticari kayıt veya yetki değişikliği yapılmadı.

İki normal Chrome penceresi 960×1032 boyutunda yan yana açıldı. Solda LAN hostunda personel15, sağda loopback hostunda İlker16 kullanıldı. Bunlar aynı Chrome profilinde farklı host-origin saklama alanlarıyla bağımsız uygulama oturumlarıdır; iki ayrı Chrome profili/incognito değildir. Desteklenen TEST aktör seçimi kullanıldı, giriş sırrı okunmadı veya taşınmadı. Her iki tam sayfa yenilemesi de kendi aktörünü ve mevcut Sayım18→pendingKabul10 bağlantısını korudu. Gönderilmiş miktar alanı iki rolde de salt okunur; onay/ret personelde kapalı, İlker'de açık görüldü. Hiçbir karar düğmesine basılmadı; bu gözlem yeni backend yetki-negatif POST testi değildir.

Bağlı gerçek TC21'de ayrı `com.melisaerp.nativeterminal.worktest` v22 açıldı. Kurulu APK 45.326.137 byte ve SHA256 `4cbbde0a389924cf25d4eebb9fdb3692ace15edae4219b348c8df78027803bcf` ile önceki LAN teslimine eşleşti; APK kaynağı f3d223be, çalışan web/API kaynağı e59'dur. Cihaz wlan0 şirket ağındaydı; ADB reverse listesi boştu. USB yalnız ekran gözlemi ve dokunma için kullanıldı; uygulama bağlantısı LAN5234'tür. Eski LIVE native uygulaması açılmadı.

Kullanıcı gerçek optik okuyucuyla bir kez okuttu ve “Okuttum” yanıtını verdi. Ajan barkod metni girmedi veya tarayıcı/scanner olayı üretmedi. Satıştaki ürün arama alanı `[data-sale-search] [name=search]` doldu; müşteri adı alanı boş kaldı. İlk arama ve mevcut “Barkodla ara” düğmesi sonuç vermedi; normal masaüstü Ürün & Stok exact barkod araması da 16.797 kart içinde 0 ürün gösterdi. Yanlış ürüne bağlama yapılmadı, sepet 0 kaldı. **Fiziksel barkodun doğru alana aktarımı gözlendi; doğru ürün eşleşmesi bu bilinmeyen barkodla doğrulanamadı.** Baştaki sıfır, uyku/uyanma, mal kabul sayım alanına fiziksel okutma ve genel cihaz/insan kabulü bu turun PASS'i değildir.

Ürün aramasını açarken yalnız önceki tamamlanmış satışın yerel sonuç seçimi “Yeni satış” ile kapatıldı; bu düğme yeni native satış/taslak oluşturmaz. Kaydedilmemiş bir taslak silinmedi; Ekle, Taslak kaydet, Satışı tamamla, sayım kaydet/gönder, onay/ret veya finans düğmesi kullanılmadı. Backend ticari journal veya eski belge değiştirilmediği iddiası yeni tam SQL karşılaştırmasıyla değil, bu dar UI eylem kapsamıyla sınırlıdır.

Ham barkod, ekranlar ve APK repo dışında `C:/Sirket/ERP/reports/pr54-7b082195-gui/20261019-roles-terminal` içinde saklandı; GitHub'a ticari veri/ekran/APK alınmadı. Türetilmiş gözlem manifesti SHA256 `677c0a98d164dba8151f5c7efeed6d8f39cae3ca78d10e62f46b32f1043d2e1b`; rol öncesi/sonrası DOM, pencere yerleşimi, TEST health/process ve gerçek cihaz XML/PNG hashlerini içerir. Uygulama kodu değişmediği için kabul edilmiş kod/test/kurulum tekrarlanmadı. Özgün49ERP/25CRM ve UA10/UA11/UA32 insan kabulü BEKLİYOR; genel P05/P11 kapanışı yapılmaz.

## 19 Ekim — mevcut kurulum eşliği ve günlük akışın normal ekran kanıtı

Kullanıcının “kurulu TEST'i koru, bu ekranla eşleştir, sonra günlük akışa geç” talimatıyla var olan ERP e59/13b/CRM6bc kurulumu korundu. V75 port`7abf962a6446eb3a800babd5b54312a8b913d814`, çalışan uygulama`e59e07abf7ae2567cdc2adb93811fe29e0032fe5` kaynağının atasıdır; e59 ile kontrol/doküman313f4b2d arasında API ve Sites kaynak farkı yok. Sunulan `http://127.0.0.1:5234/ornek-akis.html` byte'ları, e59 paketindeki dist-business dosyası ve mevcut `start-shared-test-copy-web.mjs` tarafından yapılan tek stage4-runtime.js eklemesiyle birebir eşleşti: SHA `4f28883acf403759f56bc2a41a87915742e3694fd473b2210924507735cf22fb`. Yeni build/port/paket/servis işlemi yok. Taze10originalUID/ikiRunninggözetmen ve API/native/web DB02/copye16b/T1false/source kimliği okundu; bu18Ekim30sn testi veya Post51 karşılaştırmasının yeniden koşumu değildir.

| Özgün halka | Bu yeni pakette gerçek normal GUI sonucu | Kapsam sınırı |
| --- | --- | --- |
| C01 / ERP-UA10, UA32 | Önceki gönderilmiş Sayım18→pendingKabul10 aynı hesap/döviz/satır/miktar/barkod bağıyla16İlker ve15personel görünümünde okundu. İlker onay/ret düğmeleri açık; personelde ikisi kapalı. İlker bileşen yenilemesi ve personel sayfa reload'u aynı readonly kaydı korudu. | Yeni sayım/gönderim/onay/ret yok; yeni stok etkisi veya backend rol-negatif POST testi değil. |
| C02–C03 / B05, ERP-UA11 | Mevcut finalizedfatura25102→acceptedKabul9 normal listeden görüldü; görünür incele düğmesinin data-purchase-open25102 kimliği okundu. Kayıtlı belge tarihi2026-10-09, TRY/fiyat/kur/dayanak ve bağlı kabul satırı açıldı; normal “Faturayı yenile” aynı kaydı getirdi. | Yeni fatura/finalize/iptal/finans veya stok yazısı yok; eski native tek-etki kanıtı bu turun SQL/replay testi değildir. |

Desteklenen TEST15/16 seçimi mevcut auth/sessionPOST'udur; rol/grant değişikliği veya bütünüyle GET-only tur diye sunulmaz. Tedarikçi seçimi ve gönderilmiş sayımın yerel readonly yedeği browser durumudur; eski ticari kayıt değiştirilmedi. Varsayılan hesapta0kayıt bulunması bütün sistemde kayıt yok anlamına gelmedi; yalnız önceki exact kaynak kanıtındaki hesap/döviz seçildi, vendor taraması yapılmadı. Ham cari adı/tutar/fotoğraf/Görsel dosyalar GitHub'a konmadı.

Repo dışı `reports/pr54-7b082195-gui/20261019-daily` alanında binding proof SHA `c74b3ccecd634f5ef9e1a21020defc1c1b1259958b5f4e6e1cc88ae9d6d2e7a4`, GUI observation SHA `adf83c7b534d6a736020451b45c67eaafec866f3612b3aabd5b6620f22177c6e` ve6ekran PNG'si saklandı. Önceki kurulum/journal/kurtarma kanıtları değişmedi. Bu dar masaüstü GUI kanıtı aşağıdaki tarihli browser NOT_RUN kaydını yalnız gözlenen bu alt kapsam için ilerletir; genel çok satır/ortak belge/gönderen adı-saat/ayrı muhasebe/CRMnormalpersonel/fizikselcihaz/reboot/insan kabulü açık kalır. Native2satır/1–5tamADET sınırı korunur;49ERP/25CRM ve UA kayıtları değiştirilmez.

## Kaynak ve kapsam

Kullanıcının ekran turundan sonraki “her şeyi düzelt”, “programa yetişelim”, “işlemine devam et” talimatlarıyla özel Sites önizlemesindeki v75 sunumu güncel API bağlı ERP çalışma modüllerine uyarlandı. Örnek uygulama bütünüyle kopyalanmadı: örnek controller/native controller farkı gerçek kimlik, yetki, journal ve navigation korumalarını etkiliyordu.

- Kanonik repo: `melihsnyldzz-ui/melisa-erp-v2`.
- Teknik taban: açık PR52 `676c4d086864ecc53315145341665d16dc5fd40d`, `codex/erp-collection-pending-recovery-20261018`.
- Yeni dar feature dalı: `codex/erp-office-layout-v75-20261018`; PR tabanı PR52 dalıdır.
- Tasarım referansı: owner-private Sites v75, kaynak `4cb0cb0df63a1ffc0f6053fc20068f4378ae863a`. Sites yayını ile GitHub/native kurulum ayrı teslimlerdir.
- Özgün eşleme: B01, B03–B06, C01–C02, C05, C08, C10–C11; ERP-UA05/07/08/09/10/11/14/16/17/18/32 kabul durumları değişmez.

## Taşınan sunum

| Çalışma ekranı | Teknik kaynak değişikliği |
| --- | --- |
| İş sırası | Mal kabul ve onay önce; mevcut doğrulanmış dört özet ve altı kısa yol korunur. Yeni kart düğmeleri güncel capability/navigationReady değerini tıklamada da kontrol eder. Günlük finans/stok özeti ikincil ayrıntıdır. |
| Gelen mal | Sınırlı yükseklikte kayıt listesi, kısa ürün özeti ve tam ürün/not ayrıntısı; sayımı açan doğrulanmış hesap ID'si. Bağlı sayımda işaret/not varsa onaydan önce dışarıda uyarı ve açık ayrıntı görünür. |
| Alış | Bekleyen taslaklar ve fatura geçmişi ayrılır; mevcut kabul→alış yolu, kayıtlı tarih/fiyat/döviz ve native miktar sınırları korunur. |
| Satış fişi / Tahsilat | Bu fişte alınan/kalan ile müşterinin kendi dövizli bakiyesi ayrı sunulur. Kaynak-modu API'sinde olmayan cari bakiye gösterilmez. Tahsilat girişi önde; kayıtlı tahsilat ve kasa hareketleri ayrıntıdadır. Kasa bölümünün açık/kapalı tercihi yenileme ve hata sonrasında korunur. |
| Müşteriler | Mevcut arama, döviz hesabı ve iletişim editörü görünür; bakiye ve hareket geçmişi düzenlenir. İletişim sonucu-belirsiz kurtarma yolu korunur. |
| İadeler / Onaylar | Kontrol bekleyen tedarikçi iadeleri geçmişten ayrılır; Onaylar mevcut yetkili kaynaklara açıklamalı kartlarla yönlendirir. Kaynak geçişi karar yetkisi vermez. |
| Ortak sunum | v75 tipografi/boşluk/düğme stilleri, odak görünürlüğü, aktif menü aria-current, modal Tab döngüsü; ürün seçilmeden stok listesi boş inceleme sütununu kullanır. |

## Korunan teknik sınırlar ve açık farklar

API doğrulayıcıları, kayıttaki tutar/kimlik eşleşmeleri, exact döviz matematiği, UUID/pending/replay günlüğü, capability ve beforeNavigate/requestClose korumaları korunur. C06 iletişim kurtarma ve PR52 belirsiz tahsilat/iptal düzeltmeleri tabandadır. Native seçili tahsilat default-off, TRY/500 ve seçili hesap kapsamı değişmedi; genel müşteri/döviz tahsilat yazıcısı tamamlanmış sayılmaz.

v75 örneğinde yerel IndexedDB belge ekleri ve örnek muhasebe kabulü bulunması, ortak native/API belge aktarımını veya ayrı muhasebe kimliğini kanıtlamaz; bu iki özellik bu portta tamamlandı diye taşınmadı. Native bağlam gönderenin adını/saatini sağlamadığında isim/saat uydurulmaz. Mevcut native mal kabul sözleşmesi iki ürün satırıyla sınırlıdır; v75'in 12 ürünlü örnek görünümü native 12 satır kabulü değildir. Sayımın bilinmeyen barkod/needs_review davranışı ve native onay callback'leri korunur; örnekteki boş taslak temizliği native bilinmeyen satırları silmek için kopyalanmadı.

## Doğrulama

- Node `v24.19.0`, tek birleşik hedef kümede **264/264 PASS, 0 FAIL, 0 SKIP**. Değişen sunum, home yetki/navigasyon, mal kabul devri, alış fiyat/döviz, seçili tahsilat/UUID kurtarma, müşteri iletişim kurtarma ve oturum testleri birlikte çalıştırıldı; üst üste binen önceki sayılar toplanmadı.
- Yeni regresyonlar: kart yetkisinin tıklama öncesi geri alınması/başarısız yenilemede eski yönlendirme; kasa ayrıntısının kendi yenilemesi ve gecikmiş hata boyunca kullanıcı seçimini koruması; bağlı sayım işaretinin onaydan önce görünmesi; modal Tab/Shift+Tab döngüsü ve görünmez/devre dışı öğeler.
- `npm --prefix apps/sites-workflow run build` PASS. Var olan büyük chunk uyarısı var; paket ve lock değişmedi.
- Bağımsız read-only inceleme iki P2 sunum sorunu buldu: kasa yenilemesinde ayrıntının kapanması ve sayım işaretlerinin kapalı ayrıntıda kalması. İkisi düzeltildi, iki ilgili dosyada37/37test PASS ve ikinci incelemede engel kalmadı.
- Yeni exact-head GitHub CI sonucu feature PR Checks üzerinden ayrıca izlenir. Yerel hedef test/derleme CI veya gerçek işletim kabulü değildir.
- **Bu yeni adayın browser/mobile görsel kontrolü NOT_RUN.** Yönetilen önizleme başlatılması `bwrap: Can't mount proc on /newroot/proc: Operation not permitted` ortam hatasıyla durdu. Geçici sunum fixture'ları ve dev komutu kaldırıldı; alternatif sunucu/kimlik aşma uygulanmadı. Önceki v75 ekran görüntüleri yeni native adayın kanıtı sayılmaz.

## Bitiş ve sonraki adım

Bu teslim ekran sunumunun incelenmiş kaynak bütünleştirmesidir; ortak TEST kurulumu, belge aktarımı, normal personel/cihaz kabulü ve LIVE değildir. 19 Ekim için ortak TEST kimliği/erişim ve P03 tek-owner güvenli kurulum bağımlılığı; ardından20Ekim incelenmiş adayda normal ekran smoke ve bakiye/tahsilat/devretme doğrulaması sürer. 23Ekim teknik teslim hedefi korunur. P03 Apply NO-GO kaydı bu frontend PR'ıyla kapanmaz.

Özgün **49ERP=9tamam/39kısmi/1açık**, **25CRM=12tamam/13kısmi** ve toplam74/21kapanış aynı. Yeni sayaç/plan/Goal yok; yüzde28,4 yalnız kapanan yaprak oranıdır. Yeni görsel/personel kanıtı gelene kadar ilgili insan kabulü BEKLİYOR. Main merge, runtime/SQL/DB02/Vega/ticari kayıt veya yeni Sites yayını yapılmadı.
