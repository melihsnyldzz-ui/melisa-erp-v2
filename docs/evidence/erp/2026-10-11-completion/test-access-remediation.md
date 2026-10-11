# Korumalı TEST erişimi ve güvenli günlükleme — 11 Ekim 2026

ERP-COMPLETE01, ERP-DEC-047/048. Kullanıcıdan parola veya yeniden manuel giriş istenmedi. Bu kayıt teknik sonuçtur; ERP-UA32 ve personel/İlker insan kabulü bekler.

## Gerçek çalışan teslim

22:54 TR tarihli okuma:

| Bileşen | Kaynak | Paket manifesti / adres |
| --- | --- | --- |
| ERP API, native, yeşil Hub | `571d2d5ad00fc33f320609e78ccaaf106c319452` | `CANONICAL-COMPLETE-TEST-20261011-571d2d5`; SHA256 `4a85b556422cd67a6d1efd0b449a8f885c21421505bc99b57a3c4f2c1e4462ef`; 4184/4186/5234 |
| CRM web/gateway/katalog/sipariş | `09ca1dac346e42037fd02901baf3240aa6ce6285` | Manifest SHA256 `9de545b7c06197d628234c67d6ace60780acde4c02685780207abde677cacc4a`; 62700–62703 |
| CRM native sipariş | `60e424b61febd062668be0ccf3595c546da263a0` | Korunmuş paket /62704 |
| Android çalışma uygulaması | Build source `f3d223be8d9af2ed41888f0e894bd2ba05aa46d9` | v22; APK SHA256 `4cbbde0a389924cf25d4eebb9fdb3692ace15edae4219b348c8df78027803bcf` |

Exact DB02/copy: `MELISA_ERP_CRM_SHARED_TEST_20261009_02` / `e16b70f0-4057-428b-9abc-6bbcaf35fe82`; actualT1=false. Dört sağlık kimliği ve CRM HTML hash'i eşleşti. CRM provider `disabled-preparation`; gerçek mesaj/ücretli AI kapalı. Uygulama source, APK build source ve belge teslim HEAD'i ayrı kimliklerdir.

Kurulum: **http://192.168.1.46:5234/install.html**. İndirilen APK HTTP200,45.326.137byte ve exact SHA256 ile doğrulandı. ERP **http://192.168.1.46:5234/ornek-akis.html**, CRM **http://192.168.1.46:62700/**. Aynı kullanıcı Windows logon görevleri yeni ERP paketi ve korumalı ayarları kullanır; principal/trigger/settings değişmedi. Bilgisayar açık ve Windows oturumu açılmış olmalıdır. Gerçek reboot/logoff ve modem IP rezervasyonu ayrıca bekler; pre-login servis iddiası yok.

## Uygulanan dar giderim

- Olayda araç çıktısına taşınan iki mevcut TEST SQL servis parolası ve ERP JWT imzalama çifti yenilendi. SQL işlemi mevcut iki login'e password-only ALTER, aynı transaction; yeni kullanıcı/grant/rol veya ticari DML yok.
- İki eski parola ile **yeni, nonpooled bağlantı reddedildi**; iki yeni bağlantıda doğru DB02/server/login ve dar yetki doğrulandı. Servis SID/grant/rol eşitliği bağımsız mühürlü before/after hash'inde aynı. Her servisin mevcut bir ek prova TEST DB eşlemesi korunur; yalnız DB02 erişimi var iddiası verilmez.
- Aktif LIVE, TEST125 ve sabit Vega bridge ayarlarında olay sırları/principalleri ortak değil. Dört eski servis için tam config/CWD bağı çözülemedi; evrensel host kapanışı iddiası yok. Mevcut SQL oturum incelemesinde bu dört PID olay login'lerini kullanmıyordu.
- ERP ve CRM native sipariş tüketicilerinin JWT pinleri uyumlu güncellendi. CRM'nin ayrı katalog SQL bağlantısı ve normal giriş sırları aynı; personel/gerçek/shared kullanıcı parolaları veya izinleri değişmedi. Eski özel config'ler tarihsel kanıt olarak korunur ve tekrar kullanılmayacak şekilde karantina kaydına bağlandı.
- Yalnız sahipliği, kaynak/config/yaratılma kimliği doğrulanan izole TEST süreçleri ve iki mevcut logon görevi yeniden başlatıldı. TEST125 ve aktif LIVE port/PID/yaratılma kimlikleri değişmedi. Yedek/restore, migration, finans/stok/fiyat/karantina yazması yok.

## Oturum sonucu

Normal mevcut TEST aktörüyle login/refresh/me HTTP200. Eski, kontrol anında henüz süresi dolmamış access HTTP401; yeni geçerli normal iddiaların eski anahtarla imzalandığı denial-only canary de401. Yenileme grant'i imzalama anahtarından ayrı korumalı journal'dır: mevcut meşru cihaz grant'i normal refresh200 ile yeni access aldı. Bütün refresh'ler iptal edildi diye sunulmaz.

Kullanılmış grant replay401; logout200 sonrası access401 ve refresh401. Kişi/rol yükseltme, fake SSO veya auth bypass yok. Android Keystore/AES-GCM ayrı ERP/CRM oturumları korunur. Gerçek TC21 uygulama force-stop/yeniden açılışı, normal Personel mal kabul okuması ve ERP→CRM atanmış liste geçişi parolasız yeniden giriş gerektirmeden doğrulandı; yeni ticari işlem/gönderme yapılmadı. ADB reverse boş; ADB yalnız cihaz ekran kontrolü içindir, uygulama bağlantısı şirket Wi-Fi'sidir. İlk dozing ekran uyanma gözlemi ayrı tutulur; power tuşu ve normal swipe sonrası uygulama açıldı, cihaz güvenliği kaldırılmadı.

## Günlük ve tarama sonucu

Merkezi logger yaması PR29'dan kanonik PR23 dalına alındı; bağımsız kaynak incelemesi GO, guarded10/10 test. Yeni gerçek pakette sahte hassas query değerli normal GET401 isteği yapıldı. İki mevcut requestContext finish listener'ının **iki** serialized satırı ayrı incelendi: canary/query yok, UUID/status ve güvenilir `/auth/me` route şablonu var. İlk kontrol tek satır varsayımı nedeniyle başarısızdı; mevcut wrapper/auth çift listener gözlemi korunarak doğrulama düzeltildi. İş davranışı değiştirilmedi.

Exact eski/yeni değerleri yalnız bellekte karşılaştıran dar tarama: ERP2885, CRM479, son teslim22dosya ve APK/ZIP185 açılmış üye; bulgu0. ERP bir >4MiB dosya ve bir eksik tracked dosya bu tarama dışında; runtime/log/release yığınları taranmadı. Git geçmişi Gitleaks taraması ayrı kayıtlanır; hosted CI veya her erişilemeyen uzak ref için temizlik iddiası yok.

Önceki araç çıktısı geri alınmadı; geçmiş loglar bu logger ile geriye dönük temizlenmez. Merkezi logger dışındaki araç/ham config çıktıları güvenli hâle gelmiş sayılmaz. Değer, parça, token veya ticari ham kayıt GitHub'a taşınmadı.

## Özel kanıt ve geri dönüş

Kök: `C:\Sirket\ERP\evidence\ERP-COMPLETION01-20261011\private\recovery-proof`. `incident-sql-rotation-after.json`, `incident-auth-after.json`, `incident-runtime-log-negative.json`, `incident-final-runtime-tuple.json`, `incident-logging-activation-result.json`; cihaz `incident-device-goods-ready.png`, `incident-device-crm.png`. Bağımsız SQL sealed before/post ve dar değer taraması private alanda; özel ayar dosyaları rapor/teslim içine kopyalanmaz.

Kod geri dönüşü gerekirse yeni döndürülmüş korumalı sırlar ve mevcut oturum journal'ları korunmalıdır. Eski config/sırları geri koyan rollback yok; hedefe otomatik restore/reset yok. Önceki ayrı-hedef RESTORE/CHECKDB ve Aşama5 inverse kapsamları [kurtarma](recovery-and-readiness-proof.md) ve [tek geçiş teslim kaydı](transition-package.md) içindedir; bu tur yeniden yürütülmedi. Eski yedekler, sonradan oluşmuş yerel hareketlerin güncel yedeği olarak sunulmaz.

## Kalan

Normal CRM TEST hesabı send yetkisi taşımıyor: atanmış görüşme okuma/gönderilmemiş taslak kapsamındadır. Eğitim HTML browser oynatımı policy-block nedeniyle doğrulanmadı; önceki offline video/kare/ses kanıtları korunur. Eski ZIP/video capture hash'leri değişmedi; yeni runtime tuple'ı ayrı ek kayıttır. İnsan ERP-UA32, gerçek logon/reboot, ertelenen IP rezervasyonu ve GitHub hesap/harcama engeli ayrı kalır. Finish49/9/39/1 ve CRM25/12/13/0 aynı. LIVE/Vega/T1/main, gerçek mesaj veya ücretli AI yok; sonraki ticari prova otomatik başlamaz.
