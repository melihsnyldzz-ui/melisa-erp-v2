# Mal kabul faturası → aynı faturadan iade

3 Ekim 2026. Önceki teknik kabuller yeniden açılmadı. Somut eksik, mal kabulden oluşturulan faturanın iade ekranında seçilememesiydi; ekran farklı, sabit bir TEST faturası kullanıyordu.

Alış listesindeki **Bu faturadan iade aç** artık gerçek fatura ve satır kimliğini taşır. İade ekranı özgün fiyatı, onaylı/bekleyen iadeleri, kalan iade adedini ve ilgili ürün stoğunu SQL'den gösterir. Yetkili onay özgün fatura tutarını kullanır. Aktif mal iadesi varken kaynak faturayı iptal etmek engellenir; önce iade ters kayıtla kapatılır. Alış listesindeki kalan borç da onaylı iadeyi düşer.

## Gerçek kabul kanıtı

Ayrılmış TEST DB: `MELISA_ERP_SIRKET_TEST_20260929_01`. Ekran: `http://127.0.0.1:5194/is-akisi-taslagi.html#purchases`.

- Mevcut kabul #1 üzerinden yeni fatura #25083, `TSTG-LR-13f39770`, kaynak satır #93181: 2 ADET × 60 TRY = 120 TRY. Fiziksel kabulün stoğu ikinci kez artırılmadı.
- Gerçek ekranın fatura bağlantısı, iade taslağı #31'i aynı kaynak satırına bağladı. Taslak stok/borç değiştirmedi; miktarı yalnız kendi satırında ayırdı. Kalan miktarı aşan ve başka fatura kimliği kullanan istekler reddedildi.
- Yetkili ekran onayıyla iade #223: stok 28 → 27; tedarikçi bakiyesi 20 → -40 TRY. Özgün 60 TRY fiyat/maliyet korunur. Tekrar onay ikinci hareket oluşturmaz.
- Aktif iade varken fatura iptali `ACTIVE_RETURN` ile reddedildi. Ekran yenilemesinden sonra kayıt SQL'de kaldı.
- İade ters kaydı: stok 27 → 28, bakiye -40 → 20 TRY. Ardından kaynak fatura iptali bakiye 20 → -100 TRY yaptı; başlangıç stoğu/bakiyesi korundu. Kayıtlar silinmedi.
- İade için iki stok, iki tedarikçi ve iki audit kaydı vardır; hepsi kullanıcı #16 ve kaynak iade #223'e bağlıdır. Kasa/banka hesapları ve hareketlerinin adet/checksum değerleri değişmedi.
- 10 hedefli API testi + 4 hedefli UI testi PASS; gerçek tarayıcı kabul raporunda 14 kontrol PASS. Önceki satış/tahsilat/sayım kabulleri tekrar çalıştırılmadı.

İlk onay TEST audit korumasında reddedildi ve transaction geri alındı. Aynı taslak, audit kapsamı düzeltildikten sonra tamamlandı; yeni deneme belgesi üretilmedi. Ara ekran görüntüleri asenkron yenileme öncesini gösterebilir; ticari etkiler doğrudan SQL ve yenilenmiş ekran geçmişiyle doğrulanır.

## TEST koruması ve paket

`scripts/canonical/enable-linked-purchase-returns.sql` yalnız doğrulanmış TEST DB/server üzerinde mevcut dört trigger'a bağlı TEST faturasının iade/ters kayıt/audit koşullarını ekler. Eski koşullar korunur; ticari ürün, tedarikçi ve faturalar kapsam dışıdır. NULL aktör reddedilir; iade başlığı güncellemesi yalnız değişmez alanları koruyan iptale izin verir. Tek transaction ve kalıcı requestId devam eder. Trigger'lar kapatılmadı, tablo veya kolon oluşturulmadı.

Ek son doğrulamada alış istek geçmişi 27 → 31 kayda çıktı; zaten iptal edilmiş faturanın doğrulaması 30 kayıt üstünde de çalıştı, aynı requestId ikinci kayıt oluşturmadı. Yenilenmiş ekran gerçek fatura/satır kimliğini ve iptal geçmişini gösterdi. Bu üç son kontrol PASS; stok 28 ve tedarikçi bakiyesi -100 TRY kaldı. `request-history-and-refreshed-ui.json` kanıtı yerelde korunur.

Toplam alış istek geçmişindeki 30 kayıt sınırı kaldırıldı: idempotency geçmişinin büyümesi, hatalı bir faturanın ters kaydını kilitlememelidir. Mevcut adlandırılmış ürün/tedarikçi/depo, stok, tutar, kullanıcı ve SQL kapsamı korunur. Diğer TEST modüllerinin mevcut sınırlı kabul kapsamları genişletilmedi.

Son ticari kaynak commit'i: `16bd97f` (fatura–iade bağı `b3b6c0f`, audit kapsamı `f466a19`). Son dokümantasyon paketi: `C:/Sirket/ERP/releases/CANONICAL-LINKED-RETURN-TEST-20261003-05`; tam paket commit'i kendi `release-manifest.json` dosyasındadır. Launcher: `C:/Sirket/ERP/runtime/start-canonical-test.ps1`.

Yerel ayrıntılı kanıtlar `C:/Sirket/ERP/evidence/LINKED-PURCHASE-RETURN-20261003/` altındadır: `browser-acceptance.json`, `actual-sql-effects.json`, `finance-before.txt`, `finance-after.txt`, `final-verification.json`. Orijinal trigger tanımları ve önceki launcher burada korunur. Geri dönüş yalnız TEST uygulama paketini ve gerektiğinde bu korunmuş trigger tanımlarını seçer; SQL iş geçmişi silinmez.

## Personel kabulü

Bu bağlı akış ayrılmış TEST kayıtlarıyla iş kabulüne hazırdır. **Alış faturaları → Kabulden fatura gir → Bu faturadan iade aç → İadeyi incele** sırasını kullanın. Yetkili onayda ilgili ürün stoğu ve tedarikçi borcu değişir; para ödeme/iadesi ayrı işlemdir.

Bu, ERP'nin tüm günlük kapsamının tamamlandığı anlamına gelmez. Sonraki gerçek kaynak eksiği çok satırlı mal kabul/ayrıntılı alış taslağıdır; fiyat kartı yazımı ve fiziksel native kabulü de açık kalır. LIVE geçişi yapılmadı.
