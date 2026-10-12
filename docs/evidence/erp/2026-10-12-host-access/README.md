# Melisa Host korumalı TEST erişimi — dar çalışma

12 Ekim2026. Kullanıcının iletilen doğrudan talimatı yalnız Host üzerinden ERP/CRM korumalı girişidir. Ana ERP-COMPLETE01 Goal ve diğer işler paused; CRM ajanı, migration, eğitim ve ticari prova yeniden başlamaz. Host/port/yerleşim, mevcut servisler/veriler ve roller korunur.

Başlangıç: ERP source73f4b85 / Hub5234 / API4184 / native4186, CRM09ca /62700–04/native60e. Exact DB02/copy e16b70f0-4057-428b-9abc-6bbcaf35fe82, actualT1false; bütün listener'lar başlangıçta canlı. CRM repo0424ac7 içindeki11 staged başka-sahip belge/kanıt dosyası korunur.

Gerçek Windows istemcisi normal terminal adresinde `Bağlantı bekleniyor` gösteriyor; bu başarılı giriş değildir. Mevcut Windows korumalı ERP kayıt dosyası yok. Önceden hazırlanan IPC tanısı yalnız schemaVersion/stage/action/time kaydeder; credential/error/stack/path/user/token içermez. Fixed userData altı no-reparse kontrolü, create-new0600/fsync, best-effort kayıt, original generic ret, FIFO ve sender/health/vault guard'ları korunur. Root ve bağımsız reviewer22/22 hedefli test PASS/0skip; kaynak GO. Gerçek arıza aşaması yeni istemci çalıştırılmadan bilinmiyor.

Kimlik ayrımı: ERP protected grant/vault ve sealed operasyon profili yalnız15/personel ile16/İlker. Bu ID'leri Semih diye aliaslamak uygun değildir. ERP'de doğrulanmış normal Semih kimliği/rolü kanıtlanmadı; desteklenmeyen kullanıcı yönetimi yolu veya yeni geniş izin açılmayacak. CRM normal `crm-semih-test-20261012` / patron / doğrulanmış agent2 hazırlığı ayrı protected DPAPI kaydıyla mevcut; handoff aktiffalse. Bu CRM kimliği ERP kimliğini veya yetkisini üretmez.

Bu kayıt tanı hazırlığıdır; Semih girişinin, DPAPI yeniden açılışının, ERP–CRM geçişinin veya çıkış/iptalin tamamlandığını ileri sürmez. Parola istenmez; paylaşılan hesap reseti, statik HTML/URL tokenı, kimliksiz LAN yönetici girişi, finans/stok/satış/migration yazması yok. Sonuç gerçek ekran ve normal identity/revoke kanıtı ardından ayrıca yazılır.

## Tanı istemcisi derlendi; başlatma engelli

Desktop source `ae250d2639e32c735386a4c071c12d1cd26f964e`, çalışma paketi pin'i `73f4b85597f2036e99c74efe22611a3b0ebedf43` olarak ayrı tutuldu. Yeni dış teslim alanı `C:\Sirket\ERP\deliveries\ERP-HOST-ACCESS-20261012-ae250d2`; paket hazırlayıcı 7 dosyayı doğrulayarak sıfır servis başlattı. Electron39.8.10 / builder26.0.12 NSIS build exit0. Kurulum dosyası95.734.249byte, SHA256 `89122ACB6A5F9A6D295EE486AD6183CC5E3EE9686C6B92522A45B645F05C02F1`.

Masaüstü istemcisini başlatma komutu otomatik güvenlik incelemesince `blocked by policy` olarak reddedildi; ayrıntılı gerekçe dönmedi. Başka araçla başlatma denenmedi. Paket kurulmadı, servis yeniden başlatılmadı; yeni istemcide gerçek giriş hatası aşaması, Semih kimliği, korumalı yeniden açılış ve çıkış kanıtlanmadı. Güncel Windows pencere listesinde Melisa uygulaması yoktu. Ana goal ve CRM ajanı paused kalır.

Exact source `ae250d2` PR23 head'inde CI38231481950/38231475189 FAILURE; windows-startup-test annotation işin hesap ödeme/harcama sınırı nedeniyle başlamadığını bildiriyor. Bu CI yeşili değildir. Kullanıcının 11 Ekim TEST erişim kararı sürer: parola istenmez; dedicated TEST hesabı yalnız desteklenen yönetim yoluyla, mevcut doğru rolle hazırlanabilir; gerçek/paylaşılan hesap resetlenmez ve ERP15/16 Semih olarak yeniden adlandırılmaz.

## Ret sonrası salt okunur destek yolu incelemesi

İletilen doğrudan kullanıcı talimatı dar erişim yetkisini yeniden doğruladı; ana goal/CRM ajanı paused kaldı. Reddedilen birleşik PowerShell eylemi üç health GET'i ve yeni `build\win-unpacked\Melisa Çalışma TEST.exe` için `Start-Process -WindowStyle Normal` içeriyordu. Araç yalnız `blocked by policy` döndürdü; hangi alt ifade veya kuralın ret nedeni olduğunu belirtmedi. Bu nedenle imza, kurulum veya izin problemine dair kesin neden üretilmedi. Aynı başlatma alternatif araç/adres/komutla ya da kullanıcıya devredilerek denenmedi.

Salt okunur `/test-health` ile web5234/API4184/native4186 source73f4b85 / exact DB02 / aynı copy / actualT1false doğrulandı. Önceki yanlış `/health` adreslerinin404 sonucu servis kesintisi sayılmadı. Mevcut In-App Browser sekmesi `http://192.168.1.46:5234/#receipts` açıktı; normal yeşil ekran `İşlem tamamlanamadı. Son işlemi doğrulayarak tekrar deneyin.` gösteriyordu. Ekrandaki genel Yönetici etiketi doğrulanmış Semih kimliği/rolü sayılmadı; sekme, taslak veya ticari kayıt değiştirilmedi. Windows protected-session ERP dosyası yok. Eski kurulu Melisa ERP exe'si5Ağustos tarihli; yeni pin'li istemci veya Semih oturum kanıtı olarak kullanılmadı.

Önceki hazır-olma notunun kullanıcı yönetimi route'unun mounted olmadığı açıklaması fazla genişti: gerçek `start-shared-test-copy.mjs` writes dalı `createApp()` üzerinden authAdmin route'larını mount eder. Ancak ÖNCE çalışan `canonicalTestRoutePolicy.mjs` POST/PATCH `/api/auth-admin/users` işlemlerini izinli kapsam dışında bırakır ve405 `STAGE4_WRITE_OUTSIDE_SCOPE` döndürür; native reader dalı yalnız auth/native terminal route'larını mount eder. Hiçbir POST/PATCH ile bu sınır denenmedi. Mevcut yönetim ayrıca `settings.manage` ister; rol yükseltme veya doğrudan SQL ile etrafından dolaşılmadı.

Çalışan paket kaynağındaki actor context, normal protected refresh ve Windows vault yalnız15/personel ile16/İlker sözleşmesindedir. CRM `crm-semih-test-20261012` protected hazırlığı mevcut fakat handoff aktiffalse, supportedOwnerActivationtrue; çalışan CRM pin'i09ca ayrı. CRM patron kimliği ERP personel veya yönetici kimliğinin kanıtı değildir.

**Tek destek kurulum bağımlılığı:** izole ERP'de Semih'e ait doğrulanmış kimlik/rolü, mevcut yetkileri yükseltmeden ve sealed actor/refresh/vault sözleşmelerini atlamadan kurabilecek desteklenen normal yönetim/aktivasyon yolu yok. Kapanma ölçütü bu yolun aynı DB02'de desteklenmesi, normal login→fresh me→cihaza korumalı kayıt→ERP/CRM geçiş→kapat-aç/yenileme→çıkış/revoke sonucunun gerçek izinli istemcide doğrulanmasıdır. Kullanıcıdan parola veya aynı TEST yetkisi için yeniden onay istenmez; bu eksik kurulumu başka aktörü Semih diye etiketleyerek kapatmak uygun değildir. Bu tur kod/runtime/SQL/CRM/rol değişmedi; çalışma burada durur.
