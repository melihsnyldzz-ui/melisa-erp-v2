# Normal Wi-Fi terminal teslimi — 11 Ekim 2026

ERP-COMPLETE01 / ERP-DEC-046–048. Gerçek TC21, Android10, ayrı worktest v22 uygulaması. İnsan ERP-UA32 bekliyor; genel ERP/LIVE kabulü verilmedi. **11 Ekim22:54 güncellemesi:** son çalışan ERP571d2d5/CRM09ca/native60e424b ve sır giderimi [tek güncel teslim kaydında](test-access-remediation.md); eski video/ZIP capture pinleri korunur.

## Kullanılabilir teslim

- Kurulum: `http://192.168.1.46:5234/install.html`; v22 APK HTTP200,45.326.137byte, SHA256 `4cbbde0a389924cf25d4eebb9fdb3692ace15edae4219b348c8df78027803bcf`. APK build source `f3d223be8d9af2ed41888f0e894bd2ba05aa46d9`, applicationId `com.melisaerp.nativeterminal.worktest`; çalışan web/API source ile aynı şey değildir.
- Gerçek TC21 Wi-Fi üzerinden dört görev açıldı. ADB yalnız ekran kontrolü/kayıt içindir; reverse listesi boş. USB veya geçici developer oturumu uygulama bağlantısının parçası değildir.
- Mevcut Windows aynı-kullanıcı logon görevleri immutable ERP571d2d5/CRM09ca paketlerini başlatır. Bilgisayar açık ve Windows kullanıcısı giriş yapmış olmalıdır. Gerçek reboot/logoff provası bu son teslimde yapılmadı; oturum açmadan çalışan servis diye sunulmaz. DHCP adresi için modem rezervasyonu kullanıcıca ertelenmiştir.
- Özel yerel teslim kökü: `C:\Sirket\ERP\deliveries\ERP-TERMINAL-20261011`. APK/rehber/eğitim ZIP'i `Melisa-Terminal-v22-egitim-kurulum.zip`,20.074.928byte, SHA256 `9f51dbe5d8a2152d793be8969cc04de0828e411901a5c6f13706d37aa351fefc`;19dosyalı eğitim dizini `egitim-v22-final`, ana sayfa `training-v22-five-clips-four-tasks-final.html`, rehber `terminal-v22-final-install-guide.md`. Kopya hashleri ve ZIP içeriğinin geri okuması doğrulandı. Ham kayıt, kişi verisi ve ayar dosyası GitHub'a alınmaz.

## Gerçek sonuç ve sınırlar

| Görev | Kanıtlanan sonuç | Sınır |
| --- | --- | --- |
| Mal kabul → İlker | Önceki normal personel sayımı oluşturma/barkod/adet düzeltme/kaydet/gönder cihaz kaydı korunur. Güncel cihazda aynı gönderilmiş kayıt geri okundu. Mevcut normal İlker API oturumu aynı pending kabulü ve onay yetkisini gördü. | Yeniden gönderme, yeni İlker onayı, stok kabulü veya fatura oluşturulmadı. Önceki tam çekimin APK pini bilinmiyor; tarihli kaynak5b ile ayrı etiketli. |
| Müşteri seçerek satış | Kaynak bağlı müşteri/TRY hesabı, gerçek kaynak ürün, iki adetlik sentetik DB02 satış taslağı/finalize/aynı fiş readback; bağımsız native stok/cari etkisi bir kez. SOURCE TRY/USD iptal/replay ve yedi negatif önceki teknik kanıtta korunur. | Yeni tahsilat yok. Bu örnek bütün mağaza, bütün birim/döviz/dönem kabulü değildir. |
| Çoklu koli | Aynı tamamlanmış fiş iki koliye1+1, kalan0; ortak READY kaydı/yeniden açılış. Koli öncesi/sonrası seçili ticari snapshot eşit. LAN UUID hatası güvenli RNG ile düzeltildi;10/10 hedefli kontrol/bağımsız review. | Koli kaydı ikinci stok/cari/kasa etkisi üretmez. Büyük fiş/personel kullanım kabulü bekler. |
| Atanmış konuşma | Desteklenen normal dedicated TEST personel oturumu mevcut atanmış liste/geçmişi açtı. Gönderilmemiş taslak kontrollü back/reopen ve ERP→CRM geçişinde korundu.40/40 gerçek adapter/storage/App kontrolü geçti. | `crm.view` kapsamı; mesaj gönderim yetkisi yok. Gerçek WhatsApp ve ücretli AI/otomatik çeviri kapalı. İlk hızlı dönüşte taslak kaybı bir gözlem olarak korunur; tekrar üretilemedi, production fix iddiası yok. |

## TEST erişimi

Kullanıcıdan parola istenmedi. ERP mevcut korumalı actor15 teslimi ve CRM dedicated TEST hesabının Windows DPAPI kaydı kullanıldı; shared kullanıcı parolası/rolü değiştirilmedi. Android Keystore AES-GCM korumalı refresh kayıtları ayrı ERP/CRM kimlikleriyle tutulur; SSO veya kimlik tahmini yapılmaz.

Uygulama force-stop/yeniden açılışı ve ERP→CRM görev geçişi giriş tekrarına gerek bırakmadı. Çıkış sonrası yeniden açılış ERP ve CRM giriş kapılarını gösterdi. Root korumalı normal girişleri yeniden hazırladı; ikinci force-stop/yeniden açılışta atanmış liste/geçmiş açıldı. Çıkışta temizlenen önceki taslak yeni oturumda başka kullanıcıya taşınmadı. Yanlış koordinatla ilk UI giriş denemesi401 oldu; doğru güncel alanlarla normal giriş geçti, parola/rol veya auth düzeltmesi yapılmadı.

Özel kanıtlar `C:\Sirket\ERP\evidence\ERP-COMPLETION01-20261011\private\recovery-proof`: `final-v22-lan-apk-root.json`, `final-safe-runtime-identities.json`, `v22-normal-logout-screen.png`, `v22-normal-after-logout-reopen.png`, `v22-erp-relogin-after-submit-retry2.png`, `v22-crm-after-logout-login-empty.png`, `v22-crm-relogin-success.png`, `v22-final-crm-reopen-protected.png`, `v22-final-crm-history-protected.png`. Secret içeren özel ayarlar teslim/kanıt kopyasına alınmaz.

## Eğitim kontrolü

Beş klip: korunmuş tam mal kabul40,9sn; güncel aynı-kayıt mal kabul63sn; satış95sn; iki koli87sn; atanmış CRM geçmiş/taslak42sn. H264/AAC720×1280, Türkçe yerel ses/altyazı. Tam decode0error; ortalama ses−20,1…−22,4dB; root kare incelemesi yapıldı. Koli v2 türevinde boş koli/adet1 altyazıları gerçek görüntüyle eşleşir. CRM türevinde telefon etiketleri maskelendi; orijinaller değişmedi.

Güncel mal kabul video kapsamı salt okunur/kısmi; oluşturma/gönderme adımları tarihli tam kayıtta gösterilir. İlk iki güncel video ERP2fb/CRM17ff, son ikisi ERP9cc/CRM09ca çekimidir. Tarihli kaynaklar final provenance içinde korunur. Browser file URL politikası nedeniyle yerel HTML oynatımı kontrolü yapılmadı; video/kare/ses offline doğrulandı. İnsan eğitimi/kabulü bekliyor.

## Kaynak / GitHub

Çalışan ERP `571d2d5ad00fc33f320609e78ccaaf106c319452` / manifest `4a85b556422cd67a6d1efd0b449a8f885c21421505bc99b57a3c4f2c1e4462ef`; CRM `09ca1dac346e42037fd02901baf3240aa6ce6285` / manifest `9de545b7c06197d628234c67d6ace60780acde4c02685780207abde677cacc4a`; CRM native `60e424b61febd062668be0ccf3595c546da263a0`. Hub5234/API4184/native4186/CRM62700–62704, DB02 exact copy `e16b70f0-4057-428b-9abc-6bbcaf35fe82`, actualT1false. Günlükleme kod yaması yeni pakette etkin; belge teslim HEAD'i uygulama source değildir. Önceki9cc/video tuple'ı tarihsel çekim referansıdır.

ERP PR23/CRM PR3 kaynak teslimleri devam eder. Exact son head CI sonucu push sonrası makbuz/PR kaydında doğrulanır; mevcut GitHub ödeme/harcama engeli nedeniyle jobs başlamadı, CI yeşil değildir. Yerel PASS ve Vercel bu engelin yerine geçmez. TEST125, aktarımlar, LL dışlamaları, karantina, eski maliyet/fotoğraflar, roller/yedekler korunur; cleanup, yeni migration, LIVE/Vega/T1/main/gerçek müşteri mesajı/ücretliAI yok. Genel finish49/9/39/1 ve CRM25/12/13/0 aynı.

## Kalan somut işler

Normal TEST CRM hesabının mesaj gönderim yetkisi yok; konuşma teslimi okuma/gönderilmemiş taslakla sınırlıdır. Personel/İlker bağımsız insan kabulü, gerçek Windows reboot/logon ve ağ rezervasyonu ayrıca değerlendirilir. Bu dar terminal teslimi genel mağaza günü veya LIVE açılışı değildir. Kullanıcıdan parola/fiziksel barkod tekrar istemi yok; yeni ticari prova bu teslimden sonra kendiliğinden başlatılmaz.
