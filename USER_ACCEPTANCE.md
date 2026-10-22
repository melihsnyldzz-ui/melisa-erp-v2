## 18 Ekim — v75 sunumun native kaynak portu; insan kabulü bekliyor

**22 Ekim / ERP-DEC-068 ek teknik kanıtı:** Ayrı, yalnız yapay kayıtlı ERP100a9a5/CRMa24c00d kurulumunda normal API/SQL ürün/fiyat/fotoğraf/sipariş/replay/restart teknik bağlantısı geçti. İki normal giriş sayfası tarayıcıda açıldı; korumalı ilk normal GUI credential devri desteklenmediğinden oturum içi GUI DENENMEDİ/BLOCKED. Bu sonuç mevcut ERP-UA/CRM06/ERP09 insan kabullerini PASS yapmaz, özgün sayaçları artırmaz. Hiçbir yeni kabul ID'si oluşturulmadı. [Kanıt ve sınır](docs/evidence/erp/2026-10-22-clean-shared-install.md).

İş sırası, mal kabul/alış, müşteri bakiyesi–fiş kalan, tahsilat ve iade/onay görünümü güncel teknik adaya taşındı.264offline test+build+bağımsız inceleme insan kabulü değildir; bu adayın normal GUI/mobile kontrolü yönetilen önizleme ortam hatası nedeniyle NOT_RUN. Ortak TEST'e kurulumdan sonra ERP-UA05/07/08/09/10/11/14/16/17/18/32 mevcut adımlarında yetkili kişi/tarih/sonuç alınacak; bu kayıt yeni görev veya PASS yaratmaz. [Kaynak kapsamı ve kalanlar](docs/evidence/erp/2026-10-18-office-layout-v75.md). Önceki gerçek kabuller korunur.

## ERP04 / C09 — normal fiyat kartı ve değişiklik geçmişi — bekliyor

13 Ekim 2026, source59c444f/DB02/5234. Normal Ürün & Stok kartında mevcut fiyatı, kademeyi/dövizi ve Son fiyat değişiklikleri bölümündeki önce/sonra/gerekçeyi inceleyin; Yenile sonrası aynı kaydı kontrol edin. Yeni ticari işlem gerekmez. [Teknik kanıt](docs/evidence/erp/2026-10-13-price-write/README.md): ajan iki gerekçeli kayıtla ilk tutarı korudu, SQL/API replay ikinci etki0. Bu teknik sonuç insan kabulü değildir; ERP-UA26/32 kişi/tarih/sonuç bekliyor, önceki kabuller değişmedi. CRM MANUAL sipariş bağlantısı ayrıca tamamlanmayı bekliyor.

## ERP03 / A01–B02 — son çalışan stok görünümü — bekliyor

13Ekimb79ce51/DB02/5234. Mevcut belirsiz kartta Doğrulanmadı ve bilinmeyen birimi, doğrulanmış negatif kartta işaretli miktarı inceleyin. Yeni işlem gerekmez. [Stok güven durumu kanıtı](docs/evidence/erp/2026-10-13-stock-card-trust/README.md). Teknik4test/2GET/Chrome insan PASS değildir; ERP-UA26/32 ve geçmiş UA02/04 kişi/tarih/sonuç aynı.

## ERP14 / C11 — normal rol ve Onaylar görünümü — bekliyor

13Ekim747ac20/DB02/5234. Onaylar'da İlker görünümü mevcut üç kaynaklı kısmi özeti okur; personel toplam/onay göremez. Kaynak bölümüne geçiş karar yetkisi değildir. Ayrı muhasebe kullanıcı kimliği ve gerçek personel–İlker–muhasebe görev devri henüz doğrulanmadı. [Rol ve modül eşleme kanıtı](docs/evidence/erp/2026-10-13-role-module-binding/README.md). Teknik6test/2GET/Chrome insan kabulü değildir; ERP-UA18/32 ve geçmiş kişi/tarih/sonuç aynı.

## ERP02 / B01 — ERP-UA05/17/32 için son çalışan görünüm — bekliyor

13Ekim e03dcb5/DB02/5234. Ana Sayfa'da Günlük akış özeti ve kapsam notunu, İş günü9Ekim/Son okuma ayrımını inceleyin. Raporları aç ile aynı tarihin daha geniş kayıtlarını; geri dönüş ve Yenile'yi kontrol edin. Kasa bilinmiyor ve doğrulanmamış kayıt bağlantısı kapalıdır. Yeni işlem gerekmez. [Ana Sayfa kapsam kanıtı](docs/evidence/erp/2026-10-13-home-daily-scope/README.md). Teknik21test/API/Chrome insan PASS değildir; geçmiş kişi/tarih/sonuç değişmedi.

## ERP16 / B08 — ERP-UA20 için son çalışan görünüm — bekliyor

13Ekim0270d12/DB02/5234. Ayarlar'da paket, kendi kullanıcı/rol ve bağlantıları okuyun; Kayıtlı kurtarma provası'nın tarihli sınırlı kapsam olduğunu, güncel yedek ve Windows başlangıcının henüz doğrulanmadığını kontrol edin. Yenile aynı salt okunur görünümü getirir. Yeni işlem/restore gerekmez. [Ayarlar okuma kanıtı](docs/evidence/erp/2026-10-13-settings-read/README.md). Teknik11test/API/Chrome insan PASS değildir; eski kişi/tarih/sonuç ve UA20/32 bekliyor durumu korunur.

## ERP15 / B07–C15 — son çalışan raporlar — insan kabulü bekliyor

13Ekim b68/DB02/5234. [Günlük rapor okuma kanıtı](docs/evidence/erp/2026-10-13-daily-report-read/README.md). Raporlar'da8–10Ekim özel aralık, ayrı TRY/USD/EUR, Maliyet kaydı olan/olmayan veCSV; stok ilk/sonraki50 veYenile. Bugün bu copy'nin9Ekim iş günüdür; gerçek bugünkü mağaza toplamı değildir. Yeni işlem gerektirmez. Teknik/native/indirilenCSV gözlemi ERP-UA19/UA32'yi PASS yapmaz; eski kişi/tarih/sonuç aynı.

## ERP13 / C10–C11 — mevcut sayım/iade/ters kayıt görünümü — insan kabulü bekliyor

13Ekim0bf8f7d/DB02/5234. [Sayım–iade okuma kanıtı](docs/evidence/erp/2026-10-13-count-return-read/README.md). Mevcut Sayım→Sayımı incele'de özgün miktar/fark ve ayrı Geri alma gerekçesi; Kapat/Yenile. İadeler→Açıklama'da özgün gerekçe, ayrı geri alma gerekçesi ve yetkiye göre döviz/tutar. Yeni işlem gerektirmez. Teknik gözlem ERP-UA15/16/18/32'yi PASS yapmaz; geçmiş kişi/tarih/sonuç değişmedi.

## ERP12 / C08 — mevcut günlük finans okuması — insan kabulü bekliyor

13Ekim f2f922a/DB02/5234. [Günlük finans okuma kanıtı](docs/evidence/erp/2026-10-13-finance-daily-read/README.md). Tahsilat'ta mevcut açık/kısmi fişi ve ayrı döviz hareketlerini; Tedarikçi Ödeme'de mevcut ödeme→fatura→mal kabulü bağını Yenile ile inceleyin. Hareketneti kasa açılışı değildir; gerçek açılış/banka kabulü ayrı. Yeni işlem gerekmez. Root teknik okuması insan kabulü değildir; ERP-UA14/UA32 ve geçmiş kayıtlar değişmedi.

## ERP11 / C02–C03 — kayıtlı fatura dayanağı — insan kabulü bekliyor

13Ekim f2f922a/DB02/5234. [Alış–mal kabul görünümü kanıtı](docs/evidence/erp/2026-10-13-purchase-receipt/README.md). Mevcut TRY/USD faturayı İncele ile açın; kayıtlı miktar/fiyat/döviz/kur, Bağlı mal kabulü tedarikçi/depo/satır ve Yenile sonrası aynı kaydı kontrol edin. Yeni işlem gerekmez.61teknik test/Chrome/API/native insan kabulü değildir. ERP-UA11/UA32 ve geçmiş kabuller korunur; kişi/tarih/sonuç bekliyor.

## ERP-C05 / ERP09 — açık hesap görünümü — insan kabulü bekliyor

13Ekim çalışan sourcea771afe, DB02/5234. [C05 okuma/görünüm kanıtı](docs/evidence/erp/2026-10-13-open-account/README.md). Müşteriler ekranından mevcut bir kartı açıp doğru müşteri/döviz geçmişini, fiş toplamı/tahsilat/kalan ile ayrı cari bakiyeyi ve Yenile düğmesini inceleyin. İptal fiş sıfır kalanı ödendi değildir; vade kaydı yoksa bilinmiyor kabul edilir. Yeni satış/tahsilat gerekmez. Root tarayıcı/SQL/API ve126teknik kontrol personel kabulü değildir. İnsan kişi/tarih/sonuç: **bekliyor**. ERP-UA32, eski bekleyen/PASS/FAIL kayıtları değişmedi.

## ERP-UA32 / ERP-COMPLETE01 — Android dört görev ve yeni eğitim — bekliyor

**11 Ekim v22 güncel teknik teslim:** normal Wi-Fi APK/ERP9cc/CRM09ca; SOURCE satış/iki koli native/readback, aynı mal kabul/İlker pending, atanmış görüşme ve kontrollü gönderilmemiş taslak kanıtlı. Korunmuş tam mal kabul40,9sn ve güncel readonly63sn ayrı; satış95sn/koli87sn/CRM42sn Türkçe eğitimleri mevcut. Oturum yeniden açılışı/görev geçişi/çıkış/korumalı yeniden giriş teknik doğrulandı. Gerçek CRM send yetkisi yok; tarihli mal kabul APK pini bilinmiyor. İlk hızlı taslak kaybı gözlemi korunur, reader fix iddiası yok. Kullanıcı/personel kişi-tarih-sonuç vermedi: **ERP-UA32 bekliyor**. [Kapsam ve insan adımı](docs/evidence/erp/2026-10-11-completion/terminal-v22-delivery.md). Yeni fiziksel barkod tekrarı istenmez; teknik kanıt genel ERP/LIVE kabulü değildir.

**Aşağıdaki kayıtlar önceki paket/çekim kapsamlarının tarihsel sonuçlarıdır; yeni v22 teslimi veya güncel genel kabul yerine kullanılmaz.**

11 Ekim güncel teknik inceleme: yeni APK exacthash, actor16 mevcut normal giriş/fiș-koli okuması/native dört görev ekranı; c198 paket HTTP rol/path negatifleri ve dört video gerçek tarayıcı oynatımı doğrulandı. Bu sonuç personelin öğrenmesi veya genel kabul değildir. Güncel eğitim `training-index-v2.html` /12dosyalı v2ZIP; eski fiziksel tekrar istemleri kaldırıldı. Normal ERP HOME cihaz görseli policy-block nedeniyle NOT_RUN. **ERP-UA32 bekliyor**, yeni insan PASS yok. Teknik kapsam/günlük özet ve performans açıkları [gereksinim denetiminde](docs/evidence/erp/2026-10-11-completion/completion-audit.md).

**11 Ekim / ERP-DEC-045:** Kullanıcı barkod okuyucusunun çalıştığını açıkça teyit etti ve yeni fiziksel okutma istemini kaldırdı. Okuyucu: **kullanıcı teyidi / tekrar istenmiyor**. Teknik denemede barkod elle/ADB metniyle girilecek; yeni fiziksel donanım testi yapılmış diye kaydedilmeyecek. Aşağıdaki geçmiş fiziksel okutma bekleme ifadeleri yeni bir zorunlu tekrar değildir. ERP-UA32'nin personel/günlük kullanım kabulü bekliyor; bu karar bütün kabulü PASS yapmaz.

Kullanıcı/personel fiziksel sonucu ve deneme tarihi henüz bildirilmedi. Gerçek TC21 normal personel oturumu, ayrı worktest uygulaması ve kaynak hedefli testleri teknik kanıttır; insan PASS değildir. USB yönlendirmesi şirket Wi-Fi işletim kabulü değildir. Önceki ERP-UA31 ve diğer bekleyen kabuller korunur.

Normal personel15 ile gerçek TC21 ekranında kontrollü sentetik mal kabul kaydı/İlker'e gönderim, tek satışın sonuç-belirsiz/replay doğrulaması ve iki koli/yeniden açılış teknik denetlendi. CRM'de mevcut ayrı personel oturumuyla22 atanmış konuşma ve gönderilmemiş taslağa dönüş kontrol edildi. Bu teknik denetim insan PASS değildir. Barkod ADB metniyle girildi; yeni uygulamadaki fiziksel optik okutma, Wi-Fi işletimi ve büyük200 satırlı fiş personel kabulü yapılmadı.

Dört yeni gerçek terminal videosu40,9/42/43/33,83sn, Türkçe ses/altyazı/düğme vurgusu ve16 alıştırmayla özel eğitim paketinde hazır. Önceki sekiz ERP dersi bunların yerine sayılmaz. Personel yalnız ayrılmış izole eğitim ortamında mal kabulde okutma/adet düzeltme/gönderim; satışta müşteri/ürün/döviz; koli hazırlığında miktar ve devam; kendi atanmış CRM konuşmasında dışarı göndermeden taslak turunu yapacak. Kişi/tarih ve açık insan sonucu gelene kadar **ERP-UA32 bekliyor**. [Teknik durum](docs/evidence/erp/2026-10-11-completion/current-technical-evidence.md).
## ERP-UA31 / ERP-CRM-LEARN01 — insan eğitim kabulü bekliyor

**Kişi, deneme tarihi ve insan sonucu bildirilmedi; ERP-UA31 bekliyor.** Eğitim kaynağı b5a8ce1, etkin izole web 5234 / DB02. Paket, gerçek tarayıcı ve fiziksel TC21 eğitim ekranı teknik sonuçları [kanıtta](docs/evidence/erp/2026-10-10-training-preparation/README.md) kayıtlıdır. API/native a51b117 ve TEST125 korunur; bu kontroller personelin insan kabulü değildir.

[Kısa eğitim](http://127.0.0.1:5234/kullanim-egitimi.html) üzerinden yalnız mevcut ekranları ve dersleri inceleyin:

1. Sekiz dersin kısa adımlarını ve sorularını okuyup mal kabul/sayımda personelin göndermesiyle İlker'in mevcut yetkisiyle onayı arasındaki farkı anlatın. Muhasebenin belge/tutar/döviz kontrolünün yeni onay yetkisi vermediğini kontrol edin.
2. Satış ve CRM sipariş taslağının tamamlanmış satış olmadığını; alış faturasının kabul edilmiş mala ikinci stok eklemediğini; tahsilat, ödeme ve iadenin ayrı etkilerini derslerden açıklayın.
3. Dövizlerin ayrı tutulduğunu ve bilinmeyen açılışta işlem yapılmaması gerektiğini değerlendirin. Ekran başlıklarının, düğmelerin ve açıklamaların anlaşılmayan kısmını bildirin.

| Kabul | Kişi | Deneme tarihi | İnsan sonucu |
| --- | --- | --- | --- |
| ERP-UA31 / sekiz ders ve görev devri | Bildirilmedi | Bildirilmedi | Bekliyor |

Bu kısa inceleme yeni ticari kayıt gerektirmez. Önceki ERP-UA30/CRM-UA08 ve bütün kabuller korunur. Ders ilerlemesi, otomatik tarayıcı/ADB kontrolü ve quiz sonucu insan PASS değildir; fiziksel barkod, gerçek ticari işlem veya LIVE kabulü sayılmaz.
## ERP-UA30 / ERP-CRM-FINAL01 — tek mağaza günü turu — bekliyor

ERP-DEC-041,10 Ekim2026. Çalışan izole ERP uygulama source **a51b117** / paket **CANONICAL-BUSINESS-TEST-20261010-a51b117**, CRM uygulama source **5f8cb237** / belge teslimi **43ff598**, ortak hedef **DB02**. TEST125 / source edb3c891 ve kabul edilmiş aktarımlar korunur. Native günlük sonlu TRY zinciri 25 kontrol ile, sayım ve alış iadesi ters kayıtları ayrıca SQL/API ve aynı UUID tekrarlarıyla doğrulandı. Personel onayı/ödeme denemesi reddedildi; ikinci stok veya finans etkisi oluşmadı. Normal satış/alış/ödeme, iade ve sayım geçmişi, ayrı dövizli günlük rapor ve CRM 50 ürün / 3.830 görsel kapsamı gerçek ekranda kontrol edildi. Bu teknik kanıt bütün mağaza ve TRY/USD/EUR günlük finans akışlarının kabulü değildir.

**Kişi/tarih/insan sonucu bildirilmedi; ERP-UA30 PASS yok.** CRM-UA08, öncekiUA29/CRM-UA07 ve tüm diğer bekleyen kayıtlar korunur. [15–20 dakikalık tur](docs/evidence/erp/2026-10-10-final-preparation/store-day-tour.md) yalnız mevcut kayıtların gözle incelenmesini hazırlar; yeni insan işlem turu ayrı onayla imzalı TEST seçiminde yapılır. Fiziksel Zebra etiketi, gerçek kişi/İlker eşlemesi ve geniş TRY/USD/EUR kullanımının ayrı kabulü gerekir.

| Kabul | Kişi | Deneme tarihi | İnsan sonucu |
| --- | --- | --- | --- |
| ERP-UA30 / normal günlük ekran turu | Bildirilmedi | Bildirilmedi | Bekliyor |

**Genel işletme TEST'i / LIVE hazır değil; ERP-UA30 ve CRM-UA08 bekliyor.** 18 UNKNOWN belge, gerçek açılışı hazır0/39 native kasa-banka kaydı ve8 kişi/hesap takma adı için işletme kanıtı; fiziksel Zebra/personel/İlker turu ve geniş dövizli günlük kapsam açık. Yeni9,2 GB COPY_ONLY/CHECKSUM yedeği VERIFYONLY PASS, bu yeni yedek restore edilmedi; önceki gerçek izole restore ve Aşama5 inverse kanıtı yeniden kullanıldı. 10 Ekim17:01 TR tarihli atomik olmayan okumada ürün 233 / müşteri döviz hesabı 22 / tedarikçi 28 kaynak farkı; yeniden aktarım veya gerçekT1 yok. Katalog ilk50medyan2.080 sn önceki ortak644 ms'den yavaş; bu regresyon ve CRM'nin önceki15 sn timeoutu saklandı, sonraki darliste200/~2.1 sn. Koruma/timeout kaldırılmadı. GitHub CI hesap/harcama nedeniyle başlamadı; yeşil değil. Vega/LIVE/gerçekT1/main/gerçekWhatsApp/ücretliAI/EğitimPR27 değişimi yok.

## ERP-UA29 / ERP-CRM-EXPAND01 — insan TEST'i başlatılmadı

Durum: **bekliyor**. ERP-DEC-040 teknik genişletme çalışması kullanıcı/İlker/personel kabulü değildir. Tek yönetici raporundaki doğrulanmış ürün/tedarikçi/döviz kapsamıyla personel sayımı → İlker onayı → tek stok etkisi → uygun kaynak fiyatlı alış → ilgili döviz borcu ve CRM native taslak/readback birlikte değerlendirilecektir. Fiziksel Zebra decoder, gerçek personel oturumu ve bağımsız açılış bakiye kabulü ayrı bekler; bilinmeyen cari/personel eşlemesi veya LL hesabı için işlem denenmez. Kişi/deneme tarihi/insan sonucu bildirilmedi. Teknik kaynak/paket/kanıt STATUS'ta tutulur; bu tur geniş insan TEST'i başlatmaz.

## ERP-CRM-PREP01 — ortak TEST hazırlığı / insan kabulü bekliyor

ERP-DEC-039 yeni ortak izole TEST hazırlığını ve dar teknik bağlantı provasını yetkilendirir. Hazırlık, bütünleşik işletme TEST'ini başlatma veya mevcut ERP/CRM insan sonuçlarını PASS yapma onayı değildir. Normal ERP/CRM ekranları ve Zebra/personel→İlker zinciri için teknik kanıt ile kullanıcı/İlker sonucu ayrı kaydedilecektir. Önceki UA18/24–28 ve CRM kabul kayıtları kendi kapsamlarıyla korunur.

Güncel teknik prova yalnız yeni ortak DB/ERP5224/CRM62600: katalog ve native taslak/refresh/replay; gerçek TC21 şirket Wi-Fi personel sayımı → İlker onayı → tek stok → alış kesinleşmesi → ayrı TRY tedarikçi hesabı. Son6c47c37 paketinde gerçek müşteri/tedarikçi listesi ve ayrı döviz kartı da normal ekranda açılır. Normal ekran ve SQL/API kanıtı mevcut; bu tur barkod ADB metniyle girildi. **İnsan kişi/tarih/sonuç bekliyor; yeni PASS yok.** Geniş mağaza/rol/döviz, fiziksel etiket, personel ve İlker kabulü ayrıca yapılacak. Prova tutarları sentetik TEST etkisidir; gerçek satış/ödeme veya LIVE onayı değildir.

## ERP-UA18 / ERP-UA28 — gerçek optik gözlem alındı, insan sonucu bekliyor

9 Ekim2026 ERP-DEC-038/PR23 talimat6079756665; aynı TEST125. Kullanıcıya tek gerçek okutma çağrısından sonra TC21 hardware trigger ve decoder-success görüldü; Codex Bul ile gerçek ürün/kart/stok/USD fiyat/fotoğraf sonucunu kontrol etti. Wi-Fi kısa off/on, uyku/uyanma ve aynı normal personel/yenileme gözlemlendi. Sıfırlı fiziksel etiket DENENMEDİ; otomatik Enter araması kanıtlanmadı. [Teknik kanıt](docs/evidence/erp/2026-10-09-zebra-physical/physical-scan.md).

**İnsan kişi/tarih/sonuç bekliyor; ERP-UA18 ve ERP-UA28 PASS değil.** Gerçek donanım olayı kullanıcı genel kabulü yerine konmadı. Geniş rol, TC26 ve bütün ticari akışlar yeniden denenmedi; yeni işlem veya LIVE onayı yok. Önceki cihaz hazırlığı kayıtları kendi tarihsel gözlemleridir. Bu kapsam sonunda DUR.

## ERP-UA18 / ERP-ZEBRA01 devamı — cihaz ekranı teknik doğrulandı / insan bekliyor

ERP-DEC-037,9 Ekim2026; mevcut TEST125/sourceedb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d. Açık ADB tıklama seçimi sonrası gerçek TC21 Chrome terminali açıldı; mevcut normal TEST personel hesabıyla formdan giriş ve Ürünler görüntülendi. Sıfırlı barkod ADBmetin+Enter/kartta sıfır korunumu, ikinci gerçek fotoğraf/kod, uyku/uyanma ve oturum koruyan Chrome yenileme gözlemlendi. Yenileme aramayı sıfırladı; aynı arama korunumu iddiası yok. [Teknik devam kanıtı](docs/evidence/erp/2026-10-09-zebra-physical/ui-continuation.md).

**Donanım barkod decoder, fiziksel personel ve insan kişi/tarih/sonuç bekliyor; PASS yok.** ADB metin girişi fiziksel optik okuma değildir; tek normal oturum geniş yetki/personel kabulü değildir. Cihazın Ürünler ekranında boş barkod alanı hazır: gereken tek fiziksel işlem etiketi okuyucuya tutup scan düğmesine basmak. Yeni satış/stok/kayıt/CRM işlemi yapılmaz; rol/parola/MDM değişimi yok. ERP-UA28 cihaz durağı ve diğer sonuçlar bekler; teslim sonunda DUR. Aşağıdaki adres açma/ret hazırlığı ilk gözlemin tarihsel kaydıdır.

## ERP-UA18 / ERP-ZEBRA01 — güncel fiziksel Zebra kabulü — bekliyor

ERP-DEC-036, 9 Ekim 2026; normal TEST125/sourceedb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d. Gerçek TC21 bağlantısı ve cihazın Wi-Fi arayüzünden TEST web/API erişimi teknik olarak doğrulandı. Kullanıcının USB/ADB yöntemi seçimi insan sonuç onayı değildir. Otomatik onay incelemesi TEST URL'sini cihaz Chrome'da açmayı çalışmadan reddetti; ekran/giriş/barkod/uyku-uyanma denenmedi. **İnsan kişi/tarih/sonuç bekliyor; PASS yok.** [Teknik kanıt](docs/evidence/erp/2026-10-09-zebra-physical/README.md).

Şimdiki tek fiziksel adım: Zebra Chrome'da **http://192.168.1.46:5194/terminal.html#products** açılıp görünen Ürünler / Personel girişi / hata bildirilir. Ardından mevcut normal personel ve yalnız Ürünler üzerinde barkod/doğru kart, Wi-Fi ve uyku/uyanma gözlemi alınır; yeni satış/stok/ticari kayıt veya CRM işlemi yapılmaz. Özel kısa kart `C:\Sirket\ERP\evidence\ERP-ZEBRA-PHYSICAL-20261009\private\report\zebra-kabul.html` hazırlanmış olup tarayıcı render doğrulaması yapılmadı. ERP-UA28 cihaz durağı da bekler; eski Goal5 geniş talimatı bu turun ticari yazma yetkisi değildir. Paket/rol/parola/DataWedge/MDM ayarları değişmedi. Bu aşama sonunda DUR.

## ERP-UA28 — Aşama 5/6 tek günlük ekran turu — bekliyor

Aşama6/ERP-DEC-035 otomatik normal ekran gözlemi tamamlandı:1–5ve7UYGUNgözlem,6sayım/iade personelKISMİ,8gerçekZebraDENENMEDİ; **insan sonuçlarının tamamı bekliyor**.50gerçek ekran/63örneklenmiş gerçek kare ve tek15–20dakikalık kişi/tarih/sonuç turu özel `C:\Sirket\ERP\evidence\ERP-STAGE06-20261009\private\report\acceptance-report.html` içindedir. [Anonim teknik kanıt](docs/evidence/erp/2026-10-09-stage6/README.md). Normal TEST125 değişmedi; yalnız5204kopya web126 dar rapor etiketiyle güncellendi,4154/4156backend125/roller/DB aynı. Mevcut iptal sayım düğmesinin kapalı görülmesi yeni personel rol testi sayılmaz; gerçek cihaz olmadan Zebra PASS yok. Kullanıcı ve İlker UYGUN/SORUN/DENENMEDİ ile açık kişi/tarih sonucu vermedikçe hiçbir UA PASS olmaz. ERP-UA27/18 ve diğer sonuçlar korunur; yeni işlem ve LIVE onayı değildir.

ERP-STAGE0501 / ERP-DEC-034, 9 Ekim 2026. TEST125/sourceedb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d ve mevcut Stage4 günlük kopyası korunur. [18 dakikalık tek tur](docs/evidence/erp/2026-10-09-stage5/acceptance-tour.md): ürün/barkod, mal kabul/alış, satış/tahsilat, ödeme geçmişi, sayım/iade ve rapor; Zebra yalnız mevcut fiziksel erişim doğrulanırsa. Yeni ticari işlem veya taslak yok; mevcut oturum/taslaklar korunur. Kişi/tarih/insan sonucu **bekliyor**. Fiziksel Zebra erişimi doğrulanamadı; masaüstü gösterim cihaz PASS değildir. Teknik kurtarma ve SQL/API sonuçları insan kabulü yerine geçmez. ERP-UA27, ERP-UA18 ve önceki açık sonuçlar değişmez; bu hazırlık LIVE geçişi onayı değildir.

## ERP-UA27 — Aşama 4 günlük kopya ve deneme ayrımı — bekliyor

ERP-STAGE0401 / ERP-DEC-033,9Ekim2026. Ortam TEST125/sourceedb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d; insan kişi/tarih/sonuç **bekliyor**. Teknik SQL/API/tarayıcı/ajan provası insan PASS değildir. Önceki ERP-UA24/25/26 bekliyor ve kabul edilmiş önceki sonuçlar korunur. [Teknik kanıt ve açılış engelleri](docs/evidence/erp/2026-10-09-stage4/README.md).

1. [Normal ödeme geçmişi](http://127.0.0.1:5194/ornek-akis.html#supplier-payments) içindeki eski deneme geçmişini açıp tarih/döviz/tutar/ters kaydı oku; yenileme aynı geçmişi göstersin. Yeni ödeme oluşturma.
2. [İzole günlük prova](http://127.0.0.1:5204/ornek-akis.html#reports) içinde8–9Ekim özel aralığını kullan; mevcut kabul/alış/satış/tahsilat/ödeme/sayım/iade geçmişi ve raporlarını oku. Bu kopya yalnız bu bilgisayardadır.
3. Kopyada personelin taslak oluşturma ile yetkilinin gerekçeli fark/iade onayı ayrımını ve kaydedilmiş ters kayıtların geçmişi silmediğini incele. İşlem oluşturmak bu kabul hazırlığının parçası değildir.
4. Ana Sayfa iş günü tarihini, TRY/USD/EUR ayrımını ve gerçek kasa açılışının henüz bağlı olmadığını oku; deneme kasa tutarını gerçek şirket açılışı sanma.
5. UNKNOWN kayıt/etki ve temiz açılışın stok16.426/cari273 alt kapsamını değerlendir; bu kaynak/fiziksel mağaza tam mutabakatı veya LIVE geçişi değildir.

Geniş insan kabulü, fiziksel cihaz, gerçek kasa/banka ve bilinmeyen işlem kökeni açık. Teknik teslimin CI hesap engeli STATUS'tadır. Kullanıcı açık sonuç vermedikçe PASS yok; bu aşama sonunda DUR.

## ERP-UA26 — Aşama 3 ürün/stok/barkod/satış fiyatı — bekliyor

İş ERP-PRODUCTCOMPLETION01 / ERP-DEC-032; ortam TEST113 / source 63f0a017ec23e89ca9aab7e44acb051f4e86479a, kaynak 08.10.2026 20:28:57 TR. Kontrol eden kişi/tarih **bekliyor**; sonuç **bekliyor**. Bağımsız SQL, 384 API ve ajanın beş normal kart provası insan PASS değildir. Önceki ERP-UA02/03/04 PASS ve ERP-UA24/25 bekliyor sonuçları korunur. [Aşama 3 kanıtı](docs/evidence/erp/2026-10-08-product-completion/README.md).

Normal [Ürün & stok](http://127.0.0.1:5194/ornek-akis.html#stock) içinde kullanıcı beş kısa kontrol yapar:

1. Stok farkı örneğinde kaynak güncellemesi ve güncel ERP stok miktarını karşılaştırır.
2. Fiyatı değişen kartta tutar, ayrı döviz ve ana birim/kademeyi kontrol eder.
3. Baştaki sıfırlı barkodla doğru kartı bulur; çoklu barkodların korunduğunu görür.
4. Yeni kartta ad/tam stok kodu/marka/tür/birim/stok/fiyatı inceler; bilinmeyen alış/maliyet boş kalır.
5. Eksik alan veya inceleme bekleyen kartta tahmini fiyat/birim/fotoğraf üretilmediğini ve 50 ürün sayfalamasını kontrol eder.

Tam kodlar/önce-sonra tutarlar yalnız kullanıcıya verilen kısa rapor ve private application/expected-five-examples.json içindedir; ham ticari veri GitHub'a taşınmaz. Kaynak snapshot fiziksel mağaza sayımı veya bugünkü tüm Vega hareketlerinin final kesimi değildir. Kullanıcı sonucu açıkça vermedikçe PASS yok. Bu liste yeni satış/fatura/tahsilat, hold kaldırma, başka migration veya LIVE onayı değildir. Bu dar kapsam sonunda DUR.

## ERP-UA24/25 — onaylı 283 hesap TEST uygulaması, insan kabulü bekliyor

8 Ekim2026 / ERP-DEC-031. Kullanıcı sabit283 hesaba TEST uygulama onayı verdi; bu onay geniş insan ekran PASS değildir.59 fark,224 finans no-op,0 ayrılan;159 hassasiyet/157 ana kart göstergesi teknik doğrulandı. Bağımsız SQL/API ve ajan normal ekran provası teknik kanıttır. **ERP-UA24 ve ERP-UA25 sonuçları bekliyor kalır.** Önceki16,770 dış kapsam veikiLL aktarılmadı. [Uygulama kanıtı](docs/evidence/erp/2026-10-08-current-party-application/README.md).

İnsan kontrolü geldiğinde normal [Müşteriler](http://127.0.0.1:5194/ornek-akis.html#customers) ve [Tedarikçiler](http://127.0.0.1:5194/ornek-akis.html#suppliers) kartında ayrı TRY/USD/EUR, B/A yönü ve güncel ERP bakiye incelenir. Açılış, kaynak güncellemesi ve gerçek yerel hareket etkisi ayrı görülür; source capture sonrasındaki Vega hareketi bugünkü bakiye diye iddia edilmez. Bu kayıt yeni ödeme/tahsilat veya başka migration onayı değildir.

Teknik ekran provası son TEST107/source6c31585 üzerinde üç kartla tamamlandı. Bu ajan kanıtı yeni insan kabulü oluşturmaz. Ayrı deneme ödeme geçmişi paneli açılamıyor; bu bölüm PASS sayılmadı. Kullanıcının kapsamlı ekran incelemesi **bekliyor**.

## Tarihsel ERP-UA24/25 — cari ve iki ondalık gösterim hazırlığı

8 Ekim2026 ERP-DEC-030. Kullanıcı yalnız yöntem kararını verdi; yeni283 hesabın tutar onayı veya geniş insan PASS vermedi. 299 hesap onaya hazır/16 önceki korunmuş/283 yeni bekler; LL2 dışarıda. Normal fiyat ve bakiye iki ondalık gösterilir; TRY/USD/EUR/B-A exact yönü ve kaynak hassasiyeti korunur. Yeni tutar/finans/DDL uygulaması0. Paket ve ajan ekran provası teknik kanıttır; ERP-UA24/25 sonuçları **bekliyor** kalır. [Kanıt](docs/evidence/erp/2026-10-08-current-party-completion/README.md). Önceki Goal7.3 dar insan kontrolü ve alış referansı teslimi tarihsel kapsamıyla aşağıda korunur.

## ERP-UA25 / ERP-MIGUNIFIED01 — son net alış, insan kabulü bekliyor

8 Ekim2026 TEST100/sourcecc4c4601ec0a006c2138385859e5167934829adf, ERP-DEC-029 dar uygulaması. Normal [Ürün & Stok](http://127.0.0.1:5194/ornek-akis.html#stock) kartında mevcut üç izinle ayrı "Alış referansını görüntüle" düğmesi. Ajanın API/ekran kontrolü insan kabulü değildir. **Sonuç bekliyor**; ERP-UA24 ve önceki sonuçlar değişmedi.

1. Belge bulunan kartta Son net alış/döviz/birim/kaynak tarihi/Alış belgesi satırlarını incele; eski tarih güncelmiş gibi sunulmasın.
2. Eski beş örnekte kart tutarı ayrı korunur; kanıtı olmayan net alan Bilinmiyor, belgeyle tamamlanan net alan tarihli görünür. Mevcut kart iskontosu net belgeye yeniden düşülmez.
3. Daha yeni belirsiz kaynak örneğinde eski doğrulanmış belge tarihi ve uyarıyı; kısmi kartta "Döviz bilinmiyor" durumunu incele. Manuel alış ve mevcut muhasebe maliyeti korunur.
4. Fotoğraf/stok/satış fiyatı ve50 ürün sayfasını kullan; alış bilgisi yalnız düğmede yüklenir. Ticari işlem oluşturma; bu değer ortalama maliyet veya kesin kâr değildir.

[Teknik rapor](docs/evidence/erp/2026-10-08-last-net-purchase/README.md); eski TEST98 kanıtı [önceki raporda](docs/evidence/erp/2026-10-08-unified-migration/README.md) korunur. Teknik PASS insan PASS sayılmaz.

## Goal7.3 dar insan ekran kontrolü — tamamlandı; ERP-UA24 bekliyor

7 Ekim 2026 / kullanıcı açık sonucu / ERP-DEC-025. TEST86/source769031c üzerinde TRY hesabı, USD hesabı ve aynı tedarikçinin ayrı TRY/USD hesapları birlikte kontrol edildi. Kullanıcı döviz ayrımı, B/A yönü ve Goal7.3 uygulama mantığını doğru buldu; ekrandaki tutarların aktarım anına ait olduğunu, sonraki Vega işlemleriyle değiştiğini belirtti. Bu normal kaynak driftidir; Goal7.3 hatası veya tekrar migration gerekçesi değildir.

Bu dar ekran incelemesi genel güncel Vega mutabakatı değildir. Eski native hareketlerin korunumu önceki SQL kanıtıdır; ekrandaki kaynak hareket özeti tek tek native geçmiş listesinin insan kabulü sayılmadı. **ERP-UA24 PASS yapılmadı.** Diğer insan kabul kayıtları değişmedi. Üç örneğin mevcut ekran kanıtları private Goal7.3 kanıt klasöründe korunur; gerçek cari adları/tutarları burada tekrar yayımlanmaz.

[Final cutover hazırlığı](docs/erp-v2/canonical-20261007/final-cutover-procedure.md) kapsamında son T1, Vega yazımları durduktan sonra alınacak; TRY/USD/EUR ve B/A ayrı tutulacak, Melisa yerel hareketleri korunacak. Şimdi finans yazması ve yeni migration yok.

Aşağıdaki önceki kabul hazırlığı kayıtları tarihsel kapsamdır.

**Goal7.3 — teknik teslim / ERP-UA24 hâlâ bekliyor, 7 Ekim 2026:** ERP-DEC-024 yalnız onaylı16 hesabın TEST uygulamasını yetkilendirdi; insan ekran PASS sonucu değildir.15 fark/1 no-op,SQL/API16/16 ve4normal yeşil ekran teknik kanıtı tamam. [TEST Tedarikçiler](http://127.0.0.1:5194/ornek-akis.html#suppliers),[rapor](docs/erp-v2/canonical-20261005/goal73-supplier-delta.md). Kullanıcı TRY/USD/EUR hesaplarını ayrı, tutar+döviz+B/A yönüyle; açılış/yerel/kaynak farkını ayrı inceleyecek. Kapsam dışı ve no-op hesap korunmuştur. Önceki insan kabulleri ve ERP-UA24 bekliyor durumu değiştirilmedi.

**Goal7.2 rapor mutabakatı — 7 Ekim 2026:** ERP-DEC-023 rapor şirket/dönem/filtre teyididir;ERP-UA24 veya diğer insan ekran kabulünün PASS sonucu değildir. [57hesap karşılaştırması](docs/erp-v2/canonical-20261005/party-currency-report-reconciliation.md) teknik teslim:16strict-ready öneri,gerçekwrite0. TEST84/source07101548 ve mevcut yeşil yüz değişmedi;ERP-UA24bekliyor korunur.

## ERP-UA24 / ERP-MIG07.1 — önceki geniş kabul adımları, hâlâ bekliyor

Aşağıdaki adımlar TEST84/source07101548d4af1f4a9344fe7cf7f19e64ffa26edb ile hazırlanmış önceki geniş kabul kapsamıdır. Güncel TEST86 üzerindeki dar Goal7.3 kontrolünün kullanıcı sonucu üstte kayıtlıdır; tüm ERP-UA24 için PASS verilmedi. [Müşteriler](http://127.0.0.1:5194/ornek-akis.html#customers), [Tedarikçiler](http://127.0.0.1:5194/ornek-akis.html#suppliers). Diğer kabuller değişmez.

1. Müşteri ve tedarikçi listesinde tutar+döviz+B/A ve kimin borcu/alacağı olduğunu incele; farklı dövizlerin tek cari kartında ayrı kaldığını gör.
2. Kartta 30 Eylül kabul edilmiş açılışı, kayıtlı yerel etkiyi ve güncel ERP hesabını ayrı incele; Genel Bakiye eklenmediğini kontrol et.
3. Yakalama tarihli kaynak hareket neti ile açılış adayı/dönem ayrımını incele; bu tutarların ERP hesabına eklenmediğini değerlendir.
4. Karantinalı kart, hareketi olmayan hesap, doğrulanmış sıfır ve küçük ters yön tutarını değerlendir; bilinmeyenin sıfır olmadığını gör.
5. [Aktarım planını](docs/erp-v2/canonical-20261005/party-currency-comparison-plan.md) ve [Goal7.2 hesap kanıtlarını](docs/erp-v2/canonical-20261005/party-currency-transfer-readiness.md) incele. LL'nin eski deneme açıklaması tekrar sorulmaz; kaynak belge kökeni ve kalan ayrı işlem kararı private plandadır. Bu kabul finans aktarımı veya hold kaldırma yetkisi değildir; ERP-UA24 hâlâ bekliyor.

## ERP-UA23 / ERP-MIG07 —bekliyor,7 Ekim2026

Teknik test insanPASS değildir. UA19–22 ve diğer kabuller aynı kalır; insan kişi/tarih/sonuç bildirilmedi. TEST83/sourcee2ffea6c96430699a37e0227c28f76fc66e22851, [Ürün & stok](http://127.0.0.1:5194/ornek-akis.html#stock),[kanıt](docs/evidence/erp/2026-10-07-goal7/README.md).

1. PrivateMelihpaketindeki müşteri/tedarikçi/ürün/barkod/birim/özelkart/döviz/maliyet kararlarını incele.
2. Yeni3157MİRKON ve yenilenmiş4220BEBESSİ kartında kod/ad/barkod/stock/sale dövizini gör; değişmeyen kartlar30Eylül kaynaklı kalır.
3. 8023CONCEPTfotoğraf/0161MOLLYkod/01240465102508sıfır/50sayfa ve4620hold kontrolünü dene.
4. Committedinverse sonrasında yeni nativecount/audit korunumu ve finansdelta uygulanmama gerekçesini incele.
5. T0/T1 writer/terminalcutoff/READONLY için işletme sorumlusu ve gerçek geçiş günü kararını ayrıca ver. Bu goal gerçek geçişi başlatmaz.

# ERP kullanıcı kabulü

Kullanıcının **normal ekranda gözle denemesi** ve kendi sonucu burada tutulur. Teknik test, ajan tarayıcı provası veya CI PASS kullanıcı kabulü değildir; teknik kanıt [STATUS.md](STATUS.md) içindedir. Ayrıntılı kapsam [ERP_FINISH_PLAN.md](ERP_FINISH_PLAN.md), sıra [DELIVERY_BOARD.md](DELIVERY_BOARD.md). Sonuçlar yalnız `bekliyor / PASS / FAIL`; kullanıcı veya kullanıcı kabulünü açıkça doğrulayan kaynak olmadan PASS yazılmaz.

Her sonuçta kişi, tarih, TEST adresi/ortamı, denenen paket/commit ve kanıt bağlantısı eklenir. Bilinmeyen değer `Durum doğrulanmadı` kalır; mevcut URL/PID geçmiş kayıttan güncel sayılmaz. Kabul edilen kapsam değişirse aynı satırdaki geçmişi silmeden yeni deneme kaydı eklenir. Henüz hazır olmayan deneme kullanıcıya hazır diye sunulmaz.

## Yeni/değişen kapsam

## Goal6 — teknik hazır; insan sonucu bekliyor

| ID / kapsam | Kullanıcının deneyeceği işler | Sonuç | Ortam / kanıt |
| --- | --- | --- | --- |
| ERP-UA19 / B07-C15 | Raporlar'da yedi türü aç; Bugün/Son7gün/ay/özel aralık seç; KOD1/KOD4 kırılımını ve bilinmeyen değeri oku; ayrı TRY/USD/EUR toplamlarını CSV ile karşılaştır; kendi rolünde maliyet/finans erişimini değerlendir. | bekliyor | TEST77/source4f918c51 [Raporlar](http://127.0.0.1:5194/ornek-akis.html#reports). Kişi/insan tarih/sonuç bildirilmedi. [Teknik kanıt](docs/evidence/erp/2026-10-06-goal6/README.md). |
| ERP-UA20 / B08 | Ayarlar'da paket ve bağlantıları oku; mevcut kullanıcı/rolünü kontrol et; son backup/ayrı restore provası bilgisini gör; terminalin fiziksel kabulünün beklediğini ve düzenleme/restore butonu olmadığını değerlendir. | bekliyor | Aynı TEST77 [Ayarlar](http://127.0.0.1:5194/ornek-akis.html#settings). Teknik test insan PASS değildir. |
| ERP-UA21 / C13 | İleride gerçek Windows oturum açılışında ERP/CRM URL'lerini aç; doğru paket ve bağlantıyı kontrol et; ikinci açılışın kopya servis oluşturmadığını değerlendir; işyeri uyku/uyanma ve logon kullanımını bildir. | bekliyor | Melisa-ERP-TEST-Canonical + Melisa-CRM-TEST-Completion; gerçek process teknik prova tamam, fiziksel reboot/logon yapılmadı ve bu tur kullanıcıdan istenmedi. |
| ERP-UA22 / C14 | Operatör backup zamanı/kaynak/boyut/bütünlüğünü oku; ayrı READ_ONLY restore DB ve35 kritik tablo/177 guard karşılaştırmasını incele; bağımsız uygulama okumasını ve korunan dosyaları değerlendir; geri dönüş prosedürünü kabul et. | bekliyor | Yeni MELISA_ERP_GOAL6_RESTORE_TEST_20261006_01; activeTEST overwrite yok. [Backup/restore kanıtı](docs/evidence/erp/2026-10-06-goal6/README.md). İnsan kişi/tarih/sonuç bildirilmedi. |


**2026-10-06 Goal5 / ERP-DEC-018 — tarayıcı teknik hazır, insan/fiziksel kabul bekliyor:** ERP TEST74/source5972f847 ince personel terminali mevcut Goal3/Goal4 zincirini kullanır. Gerçek tarayıcıda mal kabul sayımı7, personel sayımı43 ve onaysız iade taslağı; gerçek0161/8023 iki ürünlü25,44USD native taslak9, ayrı GET ve aynı UUID replay teknik kanıtları vardır. Bunlar fiziksel Zebra veya kullanıcı PASS değildir. Mevcut roller/yetkiler ve önceki ERP-UA13–17 `bekliyor`, ERP-UA02/03/04 PASS korunur; yeni ERP-UA18 `bekliyor`. Kişi/insan deneme tarihi/sonucu bildirilmedi. [Teknik kanıt ve ekranlar](docs/evidence/erp/2026-10-06-goal5/README.md).

**Önceki 2026-10-06 Goal4 / ERP-DEC-017 — insan kabulü bekliyor:** Normal ERP TEST71/source9ada67c ve ERP-UA13–17 aynı kalır; bu kullanıcı kabulleri teknik katalog/taslak sonucuyla PASS yapılmaz. ERP-D05 sözleşme teknik teslimi CRM-D02'ye bağlandı; yeni ürün/fotoğraf/fiyat ve native taslak için insan sonucu CRM-UA02/03/04'te bekler. Teknik normal CRM denemesi ERP36724 `8023 CONCEPT`15,78USD/fotoğraf ve ERP30226 `3344 CONCEPT`8,55USD ile iki satırlı32,88USD native sipariş6/7/8, ayrı GET/readback ve aynı UUID refresh gösterdi. Telefon7733 exact ERP müşteri bağı bulunmadı;595 yalnız gerekçeli kontrollü TEST seçimi. Yalnız7733 gerçek8023fotoğraf/fiyat paylaşımı provider201/CRM12273 ayrı GET ile kanıtlı; delivered/read=false, telefon açma veya insan PASS değildir. Normal katalog1440/1024/390 teknik tarayıcı kanıtlı; A05 açık İngilizce yanıt/Türkçe özet gerçek modelle doğrulandı; teknik hazır, insan kabulü bekliyor. [ERP teknik kanıtı](docs/evidence/erp/2026-10-06-goal4/README.md), [CRM kullanıcı kabulü](https://github.com/melihsnyldzz-ui/melisa-crm/blob/codex/crm-agents-on-completion-20261003/USER_ACCEPTANCE.md). Kişi/insan deneme tarihi/sonucu bildirilmedi.

**2026-10-06 ERP-DEC-016 / TEST71 source9ada67ca44947d16226a4894cfcf52aeb6e1c923 — teknik tamam, insan sonucu bekliyor:** Kullanıcının son açık talimatıyla önceki yalnız demo erişim tercihi teknik prova için supersede edildi. Kullanıcıdan parola/manuel giriş/fiziksel işlem istenmeden mevcut normal15/16 ile gerçek ortak TEST sayım39/ayrı telafi42 ve alış iadesi40/native224/ters kaydın native sonuçları, rol/replay/negatifler, güncel hız ve normal ekranlar kanıtlandı. Demo bu teknik kabulün yerine kullanılmadı. İnsan geniş kabulü sona bırakmıştır; **ERP-UA13/14/15/16/17 bekliyor**, PASS yapılmaz. [Teknik kapanış](docs/evidence/erp/2026-10-06-finops/technical-completion-71.json), [kanıt ve ekranlar](docs/evidence/erp/2026-10-06-finops/README.md). Önceki denemeler aşağıda tarihsel korunur.

**2026-10-06 TEST65 / source `cd1eab3960afae31ce64b223f61b96d784edfb6d`:** Sayım/dar fiziksel alış iadesi/normal Ana Sayfa yönlendirmesi kaynak teslimi yapıldı. İade formu izole yerel renderer ile1440/1024/390 ve taslak/onay/ters kayıt görünümünde kontrol edildi; normal5194 adresinde kullanıcı tercihi olan yerel demo açıldı. Bunlar ortak TEST kayıtlarında normal personel/yetkili kabulü değildir. Kullanıcı bu değişikliğe insan PASS vermedi; **ERP-UA13/14/15/16/17 bekliyor**. [Doğrulama sınırı](docs/evidence/erp/2026-10-06-finops/return-screen.json), [güncel paket](docs/evidence/erp/2026-10-06-finops/runtime-65.json).

**2026-10-06 ERP-FINOPS01 — ERP-UA13/14/15/16/17 bekliyor:** Ödeme/kasa TEST62; sayım akışı TEST64/source `100a5286f943baee4f4699229e1bd101452d7dff` teknik olarak hazır. Kullanıcı parola bilmediğini söyledi ve erişim tercihi olarak yalnız yerel demo yolunu seçti. `http://127.0.0.1:5194/ornek-akis.html#count` gerçek ekranda açıldı; görülen veri yerel sentetik örneklerdir ve TEST SQL'e yazılmaz. Bu deneme gerçek rol/SQL sayım kabulü değildir. [Ekran kanıtı](docs/evidence/erp/2026-10-06-finops/count-screen.json), [teknik kanıt](docs/evidence/erp/2026-10-06-finops/README.md). ERP-UA13/14/15/16/17 insan sonucu bekler; eski kabul geçmişi korunur.

**2026-10-06 ERP-UA10/11/12 — bekliyor:** TEST58/source93365d0baf002e93010a2759bd45af2af11040e7; ajan gerçek normal ekran/SQL/role/üç genişlik kanıtı insan PASS değildir. [Kabul paketi](docs/evidence/erp/2026-10-06-inbound/README.md). Sabah Sayım#5 iki satır, #6 bulunamayan barkod kalıcı inceleme için hazır. Genel ticari kartlar salt okunur. Kişi/deneme saati/insan sonuç bildirilmedi.


**2026-10-06 ERP-UA07/08/09 — bekliyor:** Normal satış, müşteri tahsilatı ve günlük sonuçlar yalnız ayrılmış sentetik kapsamda teknik hazır. Paket53/source11f1734; açık34619fişi150TRY/50tahsil/100kalan. Agent SQL/tarayıcı/CI sonucu insan PASS değildir. [Kanıt](docs/evidence/erp/2026-10-06-night/README.md).

**2026-10-06 ERP-UA06 / ERP-LAN01 güncel kapsam — bekliyor:** Kullanıcı LAN'da da yereldeki gibi doğrudan açılış istedi. [Ağ Ana Sayfa](http://192.168.1.46:5194/ornek-akis.html#home), TEST49/sourcebb082dfc5b182070b1ebd09de239c7894b89982d boş gerçek tarayıcı sekmesinde giriş/admin seçimi olmadan açıldı ve yenilendi; stok/8023CONCEPT gerçek fotoğrafı doğrulandı. [Teknik kanıt](docs/erp-v2/canonical-20261005/lan-direct-opening-acceptance.md). Başka fiziksel cihaz/personel denemesi veya insan PASS yok. Önceki manuel LAN giriş kaydı aşağıda tarihsel; yeni ERP-DEC-012 yalnız bu davranışı değiştirir. Kalıcı IP hâlâ ertelenmiştir.

**2026-10-05 ERP-UA06 / ERP-LAN01 — bekliyor:** [LANAnaSayfa](http://192.168.1.46:5194/ornek-akis.html#home), TEST48/source4b46a3fe4597a07c2d971ee3f9307bdca6d7149d. Aynıağdakibaşkafizikselbilgisayardan mevcutERP hesabıyla giriş/Anasayfa/stok/8023fotoğrafı denenir. Ajan buPC'den LANIPlogin ve akışları doğruladı; başka cihaz kabulü veya insanPASSdeğildir. [Kanıt](docs/erp-v2/canonical-20261005/lan-access-acceptance.md). KullanıcıkalıcıIPsabitlemesini erteledi. B01UA05/UA04PASS kapsamları aynı.

**2026-10-05 ERP-UA05 / B01 — bekliyor:** Yalnız normal [Ana Sayfa / İş Sırası](http://127.0.0.1:5194/ornek-akis.html#home), TEST47/source236d49b96dbd71b000670254b1699b742f6a9038 teknik hazır. Dört günlük özet, altı mevcut ekran kısa yolu, boş/bağlı değil durumları ve ayrı TRY/USD/EUR; İlker16/satış15/okuma14 gerçek hesapları ve1440/1024/390 ajan provası [kanıtta](docs/erp-v2/canonical-20261005/home-daily-work-acceptance.md). İnsan denemesi/kişi/sonuç bildirilmedi; PASS yazılmaz. ERP-UA04 PASS ve ERP-D04 tamam aynen korunur.

**2026-10-05 ERP-UA04 kullanıcı kabulü — PASS:** Bu sohbetin kullanıcısı “Kullanıcı mevcut Ürün & Stok ekranını şimdilik kabul etti. ERP-UA04’ü PASS olarak kaydet ve ERP-D04’ü bu kullanıcı kabulü kapsamında tamamla.” talimatını verdi. Kabul normal fotoğraflı/sınıflandırmalı katalog, TEST46/source7da6f2cfa799f6ff5709e0218ab2d28e8c3fc7b5 kapsamındadır. 67 belirsiz, karantina ve CRM ayrı kalır. Kişi adı/ayrı deneme saati bildirilmedi. Önceki bekleyen teknik kayıt aşağıda tarihsel olarak korunur; yeni B01 insan kabulü ayrı ERP-UA05 kaydıdır.

**2026-10-05 ERP-UA04 yeni sınıflandırma kapsamı — bekliyor:** Kullanıcının KOD1/KOD4 düzeltmesi TEST46/source7da6f2cfa799f6ff5709e0218ab2d28e8c3fc7b5 içinde teknik hazır. Marka/tür stok kodundan tahmin edilmez;0161MOLLY'de kaynak alanlar boş,0205NAYİNOM/NAYINOM exact uyuşmazlık olduğundan tam kod kalır. 1440/1024/390 gerçek ekran kontrolü ve süreler [yeni teknik kanıtta](docs/erp-v2/canonical-20261005/catalog-classification-acceptance.md). Önceki UA04/paket42 teknik kaydı aşağıda korunur; kullanıcı sonucu gelmedi, PASS yapılmaz.

**2026-10-05 ERP-UA03 kullanıcı kabulü — PASS:** Bu sohbetin kullanıcısı “Kullanıcı ERP-D03 fotoğraf eşleme planını kabul ediyor” diyerek 3315f3abd0c091512e03182112bd6bdc0168d16e teslimindeki planı kabul etti. Manifest kayıt SHA256: 5da967d2652aa0d6710ad206ac10b7a5898d5a8af7ff3f45e048669e15d22b6d. Kabul yalnız 3.830 CONFIRMED eşleme; 67 AMBIGUOUS ve 4620 LEYLEK karantinası dışarıda. ERP-D04 TEST kopyalama/metadata bağlama ayrıca bu mesajla yetkilendirildi; orijinaller korunur. Bu kabul uygulanmış fotoğraf ekranının insan kabulü değildir.

**2026-10-05 kullanıcı kabulü:** Bu sohbetin kullanıcısı “Kullanıcı normal `ornek-akis.html#stock` kataloğunu ve performansını kabul etti; ERP-UA02 sonucunu buna uygun şekilde kaydet.” talimatını verdi. ERP-UA02 **PASS**, kapsam normal gerçek katalog ve performans; denenen TEST paket40/source `df3de9054cbeb80419976cede6a26f12b1c16e94`, web5194/API4144. Kullanıcının kişi adı ve ayrı deneme saati bildirilmedi; kullanıcı kimliği bu sohbetin sahibidir. Fotoğraf bağlantısı, genel ticari/migration/cihaz kabulü veya ERP-UA01 bu PASS'e dahil değildir.

**Önceki ERP-UA03 inceleme hazırlığı:** [Fotoğraf eşleme planı](docs/erp-v2/canonical-20261005/photo-mapping-plan.md) ve [makine manifesti](docs/erp-v2/canonical-20261005/photo-mapping-plan.json). 3.897fotoğraf:3.830kesin/67belirsiz/0eşleşmeyen; ana görsel seçilmedi, orijinaller değişmedi, ürünlere yazılmadı. Kullanıcı planı görmeden ERP-D04/toplu bağlama başlatılmaz.

Önceki performans teknik denemesi: ERP-UA02 için paket40/sourcedf3de90 ile 50 satırlı normal ekran, kod/ad/leading-zero barkod/sayfalama/kart/stok/satış fiyatı ajan tarafından doğrulandı; STATUS'ta ilk393ms/35sn boşta sonrası ve39paketilk1353ms ara ölçümü korunur. Bu teknik deneme kendi başına insan PASS değildi; izleyen açık kullanıcı kabulü yukarıda ayrıca kaydedildi. O performans turunda fotoğraf işi başlatılmamıştı.

| ID / iş | Kullanıcının gözle deneyeceği şey | Sonuç | Kişi / tarih / ortam-sürüm / kanıt |
| --- | --- | --- | --- |
| ERP-UA18 / ERP-TERM01-C11-C12 | Gerçek personel hesabıyla [Terminal](http://192.168.1.46:5194/terminal.html) veya [yerel Terminal](http://127.0.0.1:5194/terminal.html) aç: altı aksiyonu ve rol sınırlarını değerlendir; donanım scanner ile sıfırlı barkodu/çift Enter tek eklemeyi dene; ayrılmış kayıtta mal kabul/sayım/iade taslağını kaydet-yenile ve yetkisiz onayın kapalı olduğunu kontrol et; kendi atanmış müşteri/çeviri/ürün-fiyat/native taslak akışını incele; Wi-Fi kopma/uyku-uyanma ve vardiya çıkışından sonra sonraki personelin önceki bağlamı görmediğini doğrula. | bekliyor | 2026-10-06 ERP TEST74/source5972f847 tarayıcı teknik hazırlığı; mal kabul7, sayım43, onaysız iade taslağı ve native taslak9/iki gerçek ürün25,44USD/GET/replay teknik kanıttır. 6 Ekim Goal5 sırasında fiziksel Zebra bağlı değildi; 9 Ekim ERP-ZEBRA01 ilk URL-call reddi tarihsel korundu; ERP-DEC-037 açık ADB tıklama yöntemiyle gerçek cihaz Chrome/personel/Ürünler, barkod metni/kart/fotoğraf, uyku/uyanma ve oturum yenileme teknik gözlemi tamamlandı. Donanım decoder/Wi-Fi kopma ve insan kişi/tarih/sonuç bekliyor; PASS değil. [Güncel kanıt](docs/evidence/erp/2026-10-09-zebra-physical/ui-continuation.md). [Teknik kanıt](docs/evidence/erp/2026-10-06-goal5/README.md), [cihaz kabul listesi](docs/erp-v2/canonical-20261006/goal5-personnel-terminal.md). Önceki ERP-UA13–17 bekler; eski PASS kayıtları korunur. |
| ERP-UA13 / ERP-FINOPS01 ödeme ve tedarikçi kartı | Normal Tedarikçi Ödeme'de ayrılmış tedarikçinin borcunu seç; kısmi öde-yenile; kalanı öde; gerekçeli iptal et; borç/hesap geri gelirken stok değişmediğini değerlendir. Tedarikçiler ekranında kabul#39→`TDAY-FINOPS-20261006`→300TRY kalan borç ve bağlı ödeme/ters kayıt geçmişini ayrıca incele; fiziksel kabul zinciriyle kimliklerin karışmadığını gör. | bekliyor | TEST71/source9ada67c normal [Tedarikçi Ödeme](http://127.0.0.1:5194/ornek-akis.html#supplier-payments) / [Tedarikçiler](http://127.0.0.1:5194/ornek-akis.html#suppliers); eski gerçek100+200TRY/ters zinciri ve güncel normal ekran korunur. Teknik proof insan kabulü değildir. [Kanıt](docs/evidence/erp/2026-10-06-finops/README.md). Kullanıcı kişi/deneme tarihi/sonuç bildirmedi. |
| ERP-UA14 / B06-C07-C08 | Normal Tahsilat'ta tahsilat girişi ve ödeme çıkışını; TRY/USD/EUR toplamlarını, ters kayıtları ve belge/hesap/durumu değerlendir. | bekliyor | TEST71/source9ada67c normal [Tahsilat](http://127.0.0.1:5194/ornek-akis.html#collections); TRY/USD/EUR ayrı hareket toplamları; gerçek banka/açılış değildir. Teknik normal ekran/rol kanıtlı; insan sonucu yok. [Kanıt](docs/evidence/erp/2026-10-06-finops/README.md). Kullanıcı kişi/deneme tarihi/sonuç bildirmedi. |
| ERP-UA15 / C10-C11 | Normal TEST hesabı ile: sayım başlat; tam kod/barkod/miktar kaydet-yenile-bitir; taslak stoğu değiştirmesin; mevcut yetkili gerekçeyle uygulasın; bilinmeyen barkod incelemede kalsın. | bekliyor | TEST71/source9ada67c normal [Sayım](http://127.0.0.1:5194/ornek-akis.html#count); personel15 sayım39,16 kalıcı ayrı gerekçeli onay/tek stok; telafi42 ayrı; bilinmeyen41 reddedildi. Gerçek SQL/replay/üç genişlik teknik kanıtı insan PASS değildir. Yeni batch iptali desteklenmez. [Kanıt](docs/evidence/erp/2026-10-06-finops/README.md). Kullanıcı kişi/deneme tarihi/sonuç bildirmedi. |
| ERP-UA16 / C10 fiziksel alış iadesi | Normal yetkili TEST hesabı ile: listede sunulan kaynak alış satırını seç; miktar/gerekçeyle taslak gönder; yetkili onayda stok/tedarikçi etkisini ve özgün faturayı kontrol et; gerekçeli ters kaydı aç-yenile. | bekliyor | TEST71/source9ada67c normal [Tedarikçiye iade](http://127.0.0.1:5194/ornek-akis.html#returns); TEST66/source0383c5 native224 stok/borç/ters kayıt kanıtı güncel pakette native ve normal ekran ile yeniden kontrol. Yalnız mevcut TRY/tek satır linked kaynaklar; genel TSTB/C09 FX iade açık. İnsan sonucu yok. [Kanıt](docs/evidence/erp/2026-10-06-finops/README.md). Kullanıcı kişi/deneme tarihi/sonuç bildirmedi. |
| ERP-UA17 / B01 Goal3 günlük işler | Normal TEST hesabı ile: Ana Sayfa'yı yenile; günlük tahsilat/ödemenin ayrı dövizlerini gör; bekleyen sayım/iade görevinden normal ekrana git; rolün izin vermediği finansın açılmadığını değerlendir. | bekliyor | TEST71/source9ada67c [İş Sırası](http://127.0.0.1:5194/ornek-akis.html#home); mevcut native günlük özet/count/purchase görevleri, normal16 ekranı ve79ms HTTP medyan kanıtlı. Kasa açılışı/banka/vade bağlı değil. İnsan sonucu yok. [Kanıt](docs/evidence/erp/2026-10-06-finops/README.md). Kullanıcı kişi/deneme tarihi/sonuç bildirmedi. |
| ERP-UA10 / C01-C10 | [Mal Kabul](http://192.168.1.46:5194/ornek-akis.html#goods): Sayım#5 iki satırı aç; adedi/notu değiştir-kaydet-yenile; İlker kontrolüne gönder; mevcut yetkili hesabında fiziksel kabulü onayla; #6 barkod0000098765432 çözülmeden gönderilemediğini kontrol et. | bekliyor | 2026-10-06 TEST58/source93365d0. Yalnız301985/325503,13370,ADET,depo1; gerçek kartlarda yazma yok. [Teknik kanıt](docs/evidence/erp/2026-10-06-inbound/README.md). İnsan kişi/tarih/sonuç: Durum doğrulanmadı. |
| ERP-UA11 / C02-C03-B05 | [Alış](http://192.168.1.46:5194/ornek-akis.html#purchases): kabul kaydını aç;60/80TRY taslağı kontrol et; tamamla-yenile ve stok ikinci kez artmadığını incele; iptalde borç ters/stok aynı; kayıtlı USD fiyatı ve4Ekim kuru/EUR bilinmiyor durumunu değerlendir. | bekliyor | Aynı TEST58; önceki25091 ve25092 tam/ters prova kanıtlı. Yeni döviz provası yalnız301986/13373/4Ekim snapshot ve mevcut boundedsource. Yeni kur veya genel ticari yazma açılmaz. |
| ERP-UA12 / B01-C07 | [Tedarikçiler](http://192.168.1.46:5194/ornek-akis.html#suppliers):13370 kabul#3→fatura→140TRY→−140TRY hareketlerini oku; TRY/USD/EUR ayrı ve bağ bilinmiyor durumunu gör; [İş sırası](http://192.168.1.46:5194/ornek-akis.html#home) sayım/alış işlerini aç-yenile; kendi rolünde maliyet/borç erişimini ve dar ekranı değerlendir. | bekliyor | Aynı TEST58; fiziksel scanner/başka ağ cihazı/insan kabulü yapılmadı. Kasa açılış/vade/tedarikçi ödeme kaynağı henüz bağlı değil. EskiUA01/05/06/07/08/09 bekler;UA02/03/04PASS korunur. |
| ERP-UA07 / B04-C04-C05 | Normal [Satış](http://192.168.1.46:5194/ornek-akis.html#sales): deneme müşterisi, iki barkod0000061010001/0000061010002,1adet/ürün;150TRY taslağı kontrol et, tamamla, fişi yenile; stok ve borcu gör. Gerçek katalog inceleme salt okunur. | bekliyor | 2026-10-06 TEST53/source11f17341dc69002aed8c249878c468058afc8da5. Ajan teknik kanıtı [gece kaydı](docs/evidence/erp/2026-10-06-night/README.md); insan kişi/tarih/sonuç bildirilmedi. Yalnız6Ekim/30işlem/500TRY/twoSKU kapsamı. |
| ERP-UA08 / B06-C08 | Normal [Tahsilat](http://192.168.1.46:5194/ornek-akis.html#collections): açık34619 fişinde150toplam/50alınan/100kalan; yetkili hesabında ayrılmışTRYkasa ile kısmi/kalan tamamı, yenileme ve ters kayıt sırasını değerlendir. | bekliyor | Aynı TEST53. Gerçek seller15 satış var/finance yok; İlker16 tahsilat var/satış yok. Genel banka/ödeme/gerçek para/diğer döviz/fiziksel kasa kapsamı açık. |
| ERP-UA09 / ERP-NIGHT01-B01 | [Müşteriler](http://192.168.1.46:5194/ornek-akis.html#customers) içindeTEST-NIGHT-20261006-C ve [İş sırası](http://192.168.1.46:5194/ornek-akis.html#home): kayıtları yenile, stok/borç/tahsilat/ters hareketleri ayrı oku; boş kasa kaynağının bakiye uydurmadığını kontrol et. | bekliyor | Aynı TEST53; üç genişlik/SQL/rol teknik provası vardır. Fiziksel Zebra/başka bilgisayar ve insan kabulü yapılmadı. ÖncekiUA01/05/06 bekler,UA02/03/04PASS korunur. |
| ERP-UA06 / ERP-LAN01 | Aynı ağdaki başka bilgisayarda192.168.1.46:5194/ornek-akis.html#home yeni sekmede aç; giriş/admin seçimi olmadan Ana Sayfa'yı gör; yenile; stok/8023fotoğrafını aç. | bekliyor | TEST49/sourcebb082dfc5b182070b1ebd09de239c7894b89982d,2026-10-06. [Teknik kanıt](docs/erp-v2/canonical-20261005/lan-direct-opening-acceptance.md); fiziksel istemci/insan kişi/sonuç bildirilmedi. |
| ERP-UA05 / B01 | Ana Sayfa'yı aç/yenile; dört özeti ve boş günü oku; altı kısa yolu dene; ayrı TRY/USD/EUR ve bağlı olmayan bakiyeleri kontrol et; kendi hesabındaki erişim/sırayı ve dar ekranı değerlendir. | bekliyor | Teknik2026-10-05 TEST47/source236d49b96dbd71b000670254b1699b742f6a9038. [Beş deneme adımı/kanıt](docs/erp-v2/canonical-20261005/home-daily-work-acceptance.md). İnsan kişi/deneme saati/sonucu: Durum doğrulanmadı. |
| ERP-UA01 / ERP-D01 | TEST'i aç ve yenile; TEST ADMIN oturumu ve normal çalışma yüzü kullanılabilir olsun. | bekliyor | Kullanıcı/deneme tarihi: Durum doğrulanmadı. Mevcut teknik hazırlık: [TEST ADMIN kaydı](docs/erp-v2/canonical-20261005/test-admin-acceptance.md); insan sonucu bu satırda bekler. |
| ERP-UA02 / ERP-D02 | Normal [Ürün & Stok](http://127.0.0.1:5194/ornek-akis.html#stock) gerçek katalog ve performansı. | PASS | Bu sohbetin kullanıcısının yukarıda alıntılanan açık kabulü;2026-10-05,TEST paket40/source df3de9054cbeb80419976cede6a26f12b1c16e94. Önceki teknik denemeler/38paketi ve performans kanıtı STATUS'ta korunur. İnsan adı/ayrı saat bildirilmedi. [v1 kaynak sözleşmesi](docs/erp-v2/canonical-20261005/working-catalog-contract.md). |
| ERP-UA03 / ERP-D03 | [Onaylanan eşleme planı](docs/erp-v2/canonical-20261005/photo-mapping-plan.md): 3.830 kesin kayıt, 67 belirsiz ayrı; orijinaller ve karantina korunur. | PASS | Bu sohbetin kullanıcısının yukarıda alıntılanan kabulü; 2026-10-05, plan commit3315f3abd0c091512e03182112bd6bdc0168d16e. ERP-D04 uygulaması ve yeni ekran kabulü ayrıdır. |
| ERP-UA04 / ERP-D04 | Normal [Ürün & Stok](http://127.0.0.1:5194/ornek-akis.html#stock): Foto/Kod/Marka/Tür/Stok/Satış fiyatı/Durum, kaynak KOD1/KOD4, orijinal kod detayda;3344/8023/0161/0205/2401/4607 örnekleri, Fotoğraflı filtresi,50'li doğal sayfa ve sıfırlı barkod. | PASS | Güncel teknik hazır2026-10-05, TEST46/source7da6f2cfa799f6ff5709e0218ab2d28e8c3fc7b5; altı zorunlu + boş/uyumsuz kaynak ve1440/1024/390 ajan doğrulaması, [yeni kanıt/deneme adımları](docs/erp-v2/canonical-20261005/catalog-classification-acceptance.md). Önceki TEST42/source956fc328e08626f010f23183f4eae1003f60057a:10zorunlu+20rastgele+4belirsiz kart [fotoğraf kanıtı](docs/erp-v2/canonical-20261005/photo-application-acceptance.md) korunur. İzleyen açık kullanıcı kabulü2026-10-05 yukarıda: ERP-UA04 PASS. UA02/03 geçmiş kapsamları korunur. |


## Önceki kapsamın kabul kayıtları

Önceki teknik/kullanıcı kanıtları [finish tree](ERP_FINISH_PLAN.md) ve bağlı modül kabul belgelerinde korunur. Bu kurulum hiçbir eski maddeyi PASS veya FAIL yapmaz; aynı kanıt buraya kopyalanmaz. Yeni görsel denemeler gerektiğinde ilgili iş ID'siyle buraya eklenir. Personel ve fiziksel terminal kabulü teknik TEST sonucu ile kapatılmaz.
