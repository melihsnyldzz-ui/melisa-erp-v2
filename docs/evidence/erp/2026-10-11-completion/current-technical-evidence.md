# Güncel teknik kanıt ve teslim sınırı — 11 Ekim 2026

Bu kayıt yalnız aşağıda çalıştırıldığı belirtilen denetimleri ve mevcut kaynak değişikliklerini özetler. Teknik kontrol, fiziksel barkod kabulü veya işletme sahibi kabulü yerine geçmez. Dört teslimin tümü tamamlanmış değildir; finish sayımı **49 tekil yaprak / 9 tamam / 39 kısmi / 1 açık** olarak korunur. Yapraklar yeniden sayılmadı, yeni satır veya otomatik insan PASS üretilmedi.

## Kaynak ile çalışan sistem ayrı

- Kanonik dal `codex/erp-finish-20261004`, mevcut Git HEAD `d6742c47d5c9552f324b7c7819b3f684c7a9d112`, [ERP PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23). Bu turdaki kaynak değişiklikleri bu HEAD'in üzerine hazırlanmıştır; henüz yeni teslim commit'i veya çalışan paket source'u sayılmaz.
- Korunan ERP API4184/native4186 source `a51b1170ade29494b3b446a44a8a62974eef687b`; hedef `MELISA_ERP_CRM_SHARED_TEST_20261009_02`, `actualT1=false`. Eski TEST125/5194 korunur.
- Mevcut Hub5234 source `466ac2df217d508b3b7f2aedff7c54292f136934`; CRM62700–62703 source `222a95f9a63763c39cb18630373a1f27a55c6f65`; native sipariş62704 source `60e424b61febd062668be0ccf3595c546da263a0`.
- Geçici terminal çalışma yüzü loopback5264'te, USB yönlendirmesinde cihazın gördüğü adres5234 olarak kontrol edildi. Bu bir kalıcı Hub/API değişimi veya yeni ağ/boot aktivasyonu değildir. Kaynak HOME düzeltmesi4184'e kurulmadı.

## Dört teslimin gerçek durumu

| Teslim | Kanıtlanan bölüm | Henüz tamamlanmayan bölüm |
|---|---|---|
| ERP teknik açıkları | HOME izin maskesi kaynakta düzeltildi; gerçek DB02 okuyucusunda kanıtlandı. Normal15/16 kullanıcılarla mal kabul/satış/sayım okumaları geçti. | HOME değişikliğinin çalışan API paketine teslimi; katalog hızının native revision ile izole doğrulanması; geniş günlük işletme ve insan kabulü. |
| Dört görevli Android terminali | Ayrı worktest uygulama kaydı; çevrimdışı build/provenance dosyasında129 unit test, debug assemble ve instrumentation derleme PASS kayıtlı. Normal oturum ve mevcut ERP kayıtlarına erişim gerçek cihaz hazırlığında kullanıldı. | Provenance kaydında instrumentation yürütme ve fiziksel optik okutma NOT_RUN, insan kabulü PENDING. Cihazdaki bütün görevler ve yeni sayım devri fiziksel sonuç olmadan tamam sayılmaz. |
| Dört Türkçe terminal eğitimi | Önceki sekiz ERP dersi ve ekran kanıtları korunur. Bunlar yeni dört terminal görevinin eğitimleri için kullanılabilecek temeldir. | Yeni dört görsel/video dersin tamamı ve personelin uygulamalı sonucu bu kanıtla teslim edilmiş sayılmaz; sekiz eski ders dört yeni terminal videosunun yerine konmaz. |
| Kurulum/veri kontrol/yedek/geri dönüş | Salt okunur denetim gerçekten çalıştı: beş paket,17.655 dosya, dokuz port, dört sağlık cevabı, CRM HTML hash'i ve sekiz eski kanıt doğrulandı. | Yeni9,2GB yedek restore edilmedi; gerçek boot/S4U, finalT1 ve LIVE kabulü yok. Eski izole restore/inverse kanıtı bu yeni yedeğin restore kanıtı değildir. |

Android build durumu `apps/terminal-native/worktest-source-provenance.json` içindeki dar çalışma kaydıdır; metadata tek başına cihazdaki yeni bir optik PASS iddiası üretmez.

## HOME: mevcut API ile yeni kaynağın gerçek DB karşılaştırması

Özel `prove-current-source-home-readonly.mjs`, mevcut korumalı config ve normal İlker16 girişiyle çalıştırıldı. SQL reader kimliğinde exact DB02/server/user ve sysadmin/control/LIVE/TEST125 erişimi0 doğrulandı. HOME copy-store mevcut exact scoped writer kimliğini gerektirdiği için, ikinci bağlantıda aynı mevcut kimlik yalnız okuyucu çağrıları için doğrulandı; rol/izin/parola değiştirilmedi.

Mevcut immutable daily/profit/native-check revision kayıtları veritabanından okunup doğrulandı. Yeni `createHomeSummaryReadStore` bağımlılık enjekte edilen gerçek pool ile çalıştı; mevcut ready/context prosedürleri, güncel aktör/izin ve FK kanıtı ile HOME okuması gerçekleşti. Süre **2.872ms**; bu bir performans iyileşmesi veya aktif API süresi iddiası değildir.

| Günlük bağlantı | Mevcut APIa51 | Yeni kaynak / gerçek DB02 okuması |
|---|---|---|
| Satış, müşteri, tahsilat, sayım, iade | Kapalı | Mevcut İlker izinleriyle açık |
| Mal kabul, ürün, tedarikçi, alış, onay | Açık | Korundu |
| Satış/sayım/iade toplamı, finans ve kasa özeti | Doğrulanmış geniş özet yok | `unavailable`; miktar/sayaç NULL, para toplamları boş |

İzin kesişimi korunur: session veya güncel native izin geri alınırsa ilgili bağlantı kapalıdır. Kısa yol açılması finansal aggregate doğrulaması ya da yeni ticari yetki değildir. Kaynak testleri17/17 PASS; no-daily maskesi ve yetki geri-alma negatifleri korunur.

Özel sonuç: `current-source-home-readonly-proof.json`, SHA256 `a96c77f03f551b9cd27678011fa8d6ddaefdbc41d1a55dcb7c0915faf4f45f2f`. Ticari POST0, kalıcı SQL DML0, SQL revision yazması0 ve servis değişikliği0; API source'u okumadan sonra aynı kaldı.

## Katalog regresyonu ve güvenli kaynak adayı

Normal İlker16, aynı4184 API/DB02,50 ürün, üç GET örneği medyanı:

| Okuma | Güncel medyan |
|---|---:|
| İlk50 | 1.627ms |
| Sonraki50 | 1.675ms |
| Tam kod | 1.619ms |
| Baştaki sıfırlı barkod | 1.359ms |
| Ürün kartı | 1.438ms |
| HOME / mevcut API | 3.987ms |

Bunlar HTTP GET süreleridir; tarayıcı ilk paint veya gerçek cold-cache ölçümü değildir. Önceki ortak644ms ilk50 referansına göre regresyon açık kalır. Bu turda yeni çalışan hız sonucu yoktur. Katalog ölçüm dosyasında daha sonraki HOME envelope varsayımı helper hatasıyla tamamlanma bayrağı false kaldı; beş katalog grubunun200/kimlik kontrolleri tamamlandı. HOME ayrı düzeltilmiş helper ile ölçülüp doğrulandı; bu helper hatası ERP hatası sayılmadı.

Native istatistiklerde ağır bölümler: kaynak hesap witness419ms, v4 registry317ms, party scope121ms, v5 registry116ms, fiyat witness90ms.185 modülün SHA kontrolü yaklaşık26ms. Bu değerler birikimli statement ortalamalarıdır; tek isteğe ait atomik trace değildir. Ağır kontrolü kaldıran veya hold/fiyat/izin bilgisini cache'de bayatlatan çözüm uygulanmadı.

`scripts/canonical/shared-business-readiness-query-plan.mjs` yalnız kaynak adayı üretir: aynı çağrıda hesaplanmış seal değerini tekrar kullanır ve iki mevcut fresh existential sorgu için cardinality-aware plan hazırlar. Altı offline test PASS. Güncel aktör, hold, stok, fiyat, registry ve modül kontrolleri korunur. Çıktıda **`executeAllowed=false`, `installAllowed=false`**, `requiresNewAppendOnlyRevisionProof=true`. Yeni immutable revision ve izole native SQL/plan/negatif doğrulaması olmadan DB02'ye kurulamaz. Mevcut SQL tanımı değiştirilmedi.

## Normal personel ve koli kanıtı

Normal personel15 girişi mevcut AUTH15 tesliminin korumalı `credentials.json` referansından, İlker16 girişi mevcut korumalı CRM katalog erişim referansından yapıldı. Parola/token, bağlantı dizesi veya bu dosyaların içeriği bu belgeye/GitHub'a taşınmaz. Eski CRM personel credential drift'i yeni parola reseti yapılarak çözülmüş gibi sunulmaz; mevcut teslim kullanıldı.

Her iki aktörde auth/me, mal kabul context/home/count-drafts, satış context/fiş listesi, sayım context'i ve mevcut tamamlanmış fiş ayrıntısı GET200. Tedarikçi/döviz seçimi server config'in kayıtlı daily account kimliğinden geldi; kimlik tahmini yok. Önceki SQL görüntüsü11 Ekim01:03:53 UTC'de alındı: sekiz native tablonun sayı/maxID bilgisi,39 request kimliği,23 bağlı etki, bir daily ürünün stok göstergesi, iki ayrı cari hesabı ve bir kasa hesabı. Ardışık okuma finalT1 değildir; geniş veri eşitliği iddiası yoktur.

Koli kaynak/store offline kanıtı200 satırın birden fazla koliye bölünmesi, miktar sınırı, exact satır/barkod/birim kimliği, actor ownership, CAS ve aynı UUID replay kontrolünü kapsar. **Bu200 satır gerçek cihazda hazırlanmış200 satırlı fiş değildir.** Gerçek tamamlanmış fiş ayrıntısı GET okunmuştur; yeni koli/sayım fiziksel miktar sonucu ve ortak kayıt kabulü bu belge tarihinde bekler. Liste/kart source kontrolü SERIALIZABLE/HOLDLOCK altında, dosya kaydı actor'a ayrılmış özel alanda; stok/cari/kasa yazımı yapmaz.

Terminal/session/static-route51 hedefli test PASS. Geçici5264'te `terminal.html?worktest=1` gerçek HTML+tek bootstrap script200; eğitim query'si200; yanlış/çift worktest query400 görüldü. Bunlar gerçek optik barkod veya insan kabulü değildir.

Özel `personnel-ui-before-baseline.json` SHA256 `bed41fdec8cf28bae2bf6932ebf0ee7f720bb228d881c090b3aa13aaaaab9271`. Normal auth POST2 dışında ticari POST0, kalıcı SQL DML0; servis/role değişikliği yok.

## Geçiş ve CI

[Çalıştırılmış geçiş denetimi ve eski kurtarma kapsamı](transition-package.md) korunur. Yeni9.204.334.592 byte yedeğin varlık/boyut ve eski VERIFYONLY makbuzu okunmuştur; yeni hash/restore yapılmamıştır. Otomatik eski restore/reset, yeniden migration ve yeni ticari kayıt yoktur.

PR23 head d674 için GitHub tekrar salt okunur kontrol edildi. [Actions38085243131](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/38085243131) ve [38085239161](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/38085239161) `FAILURE`.38085243131'de quality-build-test, windows-startup-test ve secret-scan işlerinin `steps=[]`; annotation hesabın yakın ödemelerinin başarısız olması veya harcama limitinin artırılması gerektiğini bildiriyor. **CI başlamadı/yeşil değil.** Vercel Preview Comments SUCCESS, bu üç gerekli kontrolün yerine geçmez. Yeni teslim commit'i için CI ayrıca kontrol edilmelidir.

Sabit HTTPS/boot donmuş checkpoint'i, eski görevler, ağ ve servis sınırları korunur: bu kanıt kapsamında yeni kalıcı network/task aktivasyonu0. Vega/LIVE/CRM ticari yazması, ücretliAI, gerçekWhatsApp, main merge, finalT1 veya otomatik insan PASS yoktur. İşletme açılış otoritesi, geniş mağaza günü, fiziksel personel/İlker devri ve yeni terminal eğitim kabulü hâlâ ayrı sonuç ister.

Özel kanıtların kökü `C:\Sirket\ERP\evidence\ERP-COMPLETION01-20261011\private` olarak kalır; ham ticari dosyalar bu public belgeyle yüklenmez.

## Son kaynak checkpoint'i — dört görevli terminal

APK SHA256 `8d4f91479f813b81714e6b2829ca50e598698b1f777810af15701bdee35a6fc9` gerçek TC21'de kurulu;129 unit test ve debug build PASS. Normal personel girişi, dört büyük yeşil görev düğmesi ve mevcut ERP okumaları cihazda görüldü. Optik decoder sonucu hâlâ bekliyor; ADB ile metin girişi fiziksel tarama sayılmadı.

Mal kabulde406 mevcut kaynak tedarikçi seçeneğinin ad/kod araması eklendi; seçili hesap ve döviz korunur, açık taslak/pending işleme aynı guard uygulanır.19 ilgili kontrol PASS. Gerçek cihazda CRM iframe DOM'u yüklü fakat `100dvh` yüksekliği0 idi; gerçek viewport/web header ölçüsüyle kaynak düzeltildi,16 sunum/model kontrolü ve web build PASS. Yeni web çıktısının cihazdaki korunmuş eski DOM'a yeniden yüklenmesi ve son görsel kontrolü bekler; auth/URL/rol genişletmesi yapılmadı.

Feature package exact entry/commit/manifest ile13 transitive backend kaynak hash'ini ve bütün dist-business statik dosyalarını doğrular; dosya sunumunda SHA tekrar karşılaştırılır. Kanonik dirty starter başka feature paketinin frontend'ini source id iddiasıyla sunamaz.16 hedefli paket/server kontrolü PASS; varsayılan development modu kaynak geliştirme olarak ayrıdır.

Yeni geçiş rehberi özel `transition-delivery/README.md` ve provenance manifestinde12 basit kesim/geri dönüş adımı içerir. Kurulum/aktivasyon izni false; son kaynak paketi henüz sabitlenmedi. Dört terminal anlatım sesi yerel Tolga ile üretilmiştir; dört tamamlanmış video değildir. İlk mal kabul ham ekran kaydı kaynak dışındaki özel kanıttadır; yanlış tedarikçi kapsamında barkodun bilinmeyen satır kalması gözlendi ve yeni ticari kayıt oluşturulmadı. Bu satır yalnız koordinatörün yeni yerel taslağından vazgeçilerek kaldırıldı; eski belgeler değişmedi.