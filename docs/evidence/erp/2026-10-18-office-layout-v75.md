# 18 Ekim 2026 — 75. sürüm ekran düzeninin teknik adaya taşınması

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
