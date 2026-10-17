# OPS-02 — TEST başlangıcında doğrulanamayan Windows gözlemi

13 Ekim 2026. ERP-DEC-053 kapsamında dar süreç gözetimi düzeltmesi. İptal edilmiş Hub giriş düğmesi yeniden açılmadı. Yeni ticari kayıt, migration, rol veya hesaplama değişikliği yok.

## Sorun ve değişiklik

Önceki814 başlangıcında `crmServer / processProbe / EXEC_EXIT_NONZERO / exit1 / 2409ms` kaydı oluşmuş, yeni başlatılmış ortak servisler temizlenip yeniden denenmişti. Eski kayıt OS sorgusunun aşamasını içermediği için **tarihsel kesin neden bilinmiyor**; sonradan yapılmış sağlıklı okuma bu nedeni kanıtlamaz.

- Windows okuyucusu yalnız sınırlı aşama, hata kategorisi/türü, sayısal HResult ve gerekirse sınırlı owner return code kaydeder. Ham stderr, mesaj, komut, yol, SID, SQL veya sır kaydetmez.
- NETTCP sorgusunda yalnız doğrulanmış exact no-match kimliği boş sonuç olabilir; erişim ve diğer sorgu hataları kapalı reddedilir. Child/parent owner return sonucu ve SID ayrıca doğrulanır.
- Yalnız bilinen timeout/killed veya tam kontrollü missing-child işareti en fazla iki taze gözlemle tekrar okunur. Ardından mevcut PID/owner/parent/creation/argv/binding ve health/source/config/DB/copy kontrollerinin tamamı gerekir.
- Bilinmeyen veya tükenmiş OS gözleminde gözetici bellekte kalır, durum `degraded/unverified` olur; bu hatadan child kaybı çıkarılıp sağlıklı servisler topluca durdurulmaz veya yeniden başlatılmaz. Otomatik başarıya dönüş yoktur; yeni yetkili aktivasyon gerekir.
- Spawn edilen child, probe/receipt veya log dosyası kapatma hatasından önce izlenir. Durdurma sinyalinin kabulü çıkış kanıtı değildir: gerçek çıkış ve taze port kontrolü gerekir; doğrulanamayan survivor ikinci başlangıcı engeller. Foreign/reused PID öldürülmez.

Mevcut normal ekranların22 dosyası ve API'nin572 dosyası önceki814 paketle byte/hash olarak aynı; değişen uygulama kodu yalnız canonical gözetim katmanındadır.

## Teknik kanıt ve sınır

47 Node +26 Windows PowerShell offline kontrolü geçti. Bağımsız incelemede bulunan spawn sonrası dosya kapatma açığı da hedefli negatifle kapatıldı; final dar inceleme GO. Kaynak sır taramasında onaysız bulgu0. Bu sayılar insan kabulü değildir.

İlk salt okunur gerçek gözlemde mevcut altı core süreç full receipt kimliğiyle, web ve sağlık kimlikleriyle eşleşti. Erken adayın gölge provasındaki hata yalnız bellek içinde üretildi; gerçek OS hatası yeniden üretildi denmedi. Gerçek süreç başlatma/durdurma0, runtime yazması0 ve aynı PID/creation/parent/bindings korundu. Final paket/runtime kanıtı aşağıda ayrıca kaydedilir.

## Final teslim

Uygulama source: **`3517bb8f9455de118cb7c8661a89f416288c9981`**. İmmutable1870 dosyalı paket: `CANONICAL-COMPLETE-TEST-20261011-3517bb8`; manifest SHA256 `eb18c6aa3d52898c9337b3dc65d89feebe90c1ce008b9e05147b5717050f6e92`. Adındaki20261011 mevcut release ailesidir; bu paket13 Ekim teslimidir.

Mevcut task/paket/pin doğrulaması önce salt okunur geçti. Root taze full process guard ile yalnız sahipliği kanıtlanan ortak TEST süreçlerini değiştirdi; diğer dinleyiciler aynı kaldı. Yeni kaynakla altı core ve web üzerinden sekiz port açıldı; ERP5234/4184/4186 ve native sipariş62704 sağlık kimlikleri exact DB02/copy/T1false. CRM09ca/native60e ve korumalı auth referansları aynı. Gözetici6544 `running`, taze heartbeat; son gölge prova sonrasındaki yaklaşık117s gözlemde süreç değişimi veya yeni kaynak failure kaydı yok. Bu kısa gözlem uzun süre garantisi veya Windows reboot kabulü değildir.

**Final paket koduyla gerçek süreç/sağlık üzerinde gölge prova:** altı core full guard geçti. Sonra yalnız gölge driver belleğinde `CHILD_MANAGED / PermissionDenied` gözlem hatası üretildi; `degraded` ve resident quarantine seçildi. Gerçek başlatma/durdurma0, runtime yazması0; taze öncesi/sonrası PID/creation/parent/bindings aynı. Bu hata tarihsel olayın yeniden üretimi veya gerçek supervisor'a fault injection değildir.

Mevcut200 satırlı fiş,50 fiş listesi, koli listesi ve200 satırlı iki kolili fiş normal15 rolüyle yalnız GET okundu. Dört DTO hash'i önceki kanıtla aynı; kendi normal oturumu çıkışla kapatıldı. Süreler sırasıyla13982/5258/5288/4360ms (tekil soğuk/ısınmış loopback gözlemleri). Hız düzeltmesi iddiası yok; OPS-01 açık. Yeni satış/stok/finans yazması0.

LAN kurulum sayfası HTTP200, v22 APK HTTP hash'i ve45326137 baytı exact; normal terminal JS bytes önceki814 ile aynı. Yeni tarayıcı insan kabulü veya TC21 belge/video doğrulaması yapılmadı; önceki814 normal ekran kanıtı yalnız değişmeyen ekran dosyaları için devralındı.

Özel kanıt: `C:\Sirket\ERP\evidence\ERP-COMPLETE01-20261012\private\ops02-running-proof.json`, `ops02-final-shadow-proof.json`, `ops02-owned-stop.json`, `ops02-package-preparation.json`, `afterops02-existing-sales.json`. Ticari DTO'lar ve task/config ayrıntıları repo dışında kalır. Kaynak/teslim commit'i ayrı; PR23 üzerinden devam eder.

TEST: <http://192.168.1.46:5234/ornek-akis.html>, <http://192.168.1.46:5234/terminal.html?worktest=1#packing>, <http://192.168.1.46:5234/install.html>.

Mevcut görevlerin principal/trigger/settings'i, CRM09ca/native60e, TEST125, DB02, korumalı oturumlar ve v22 APK korunur. Windows gerçek reboot/logon, DHCP rezervasyonu, son native belge/video ve insanUA32 ayrı açık. Önceki cihaz kapat/başlat policy reddi tekrarlanmaz. Hosted CI ödeme/harcama engeliyle başlamadı; yerel test ve Vercel sonucu hosted CI yerine geçmez. Genel ERP/LIVE tamamlandı iddiası yoktur.
