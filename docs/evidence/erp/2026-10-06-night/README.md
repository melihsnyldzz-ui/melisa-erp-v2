# ERP-NIGHT01 — 6 Ekim 2026 teknik prova kanıtları

SQL hazırlığı ve TEST50/51 gerçek normal ekran teknik provaları aşağıdadır. İnsan kabulü ayrı USER_ACCEPTANCE.md kaydıdır ve bekler.

- `baseline.json`: gece başlangıcında TEST49, aynı LAN oturumu, 50 ürün, üç gerçek ölçüm; ilk sıcak/soğuk örnekler ayrı korunur.
- `sql-validate.json`: gerçek SQL kurulumu transaction içinde, düşük yetkili context okuması, rollback; eski dokuz operasyon alanı fingerprint'i / kullanıcı-yetki / trigger-metadata geri döndü. IDENTITY sayaçları ilerleyebilir; ticari içerik geri döner, reseed yok.
- `sql-apply.json`: aynı incelenmiş kaynağın kontrollü kurulumu; iki ürün, bir müşteri, bir TRY kasa ve iki satış fiyatı sentetik native kayıt. Satış/tahsilat hareketi bu aşamada sıfır.
- `sql-negatives.json`: yalnız sentetik kayıtlarda dokuz gerçek düşük yetkili engelleme; ürün/fiyat/context/journal korumaları; gerçek ticari kart yazma denemesi sıfır.
- `legacy-readers-after-setup.json`: eski TEST49 üzerinde kabul edilmiş katalog ve mevcut alış okuyucuları hâlâ açılır.

SQL kaynağı `scripts/canonical/enable-test-night-workflows.sql`; offline builder önceki guard'ların bağımsız hash'lerini ve gövdelerini saklar. Hiçbir ticari/karantina guard'ı devre dışı bırakılmaz. İki immutable kurulum metadata guard'ı yalnız dış transaction içinde hash sürümü yükseltilirken, fixture yazılmadan önce yeniden etkinleştirilir. Yeni owner prosedürleri bağımsız ready/context/effect pinleri ve gerçek düşük yetkili kullanıcıyla okunur. Uygulama aynı SERIALIZABLE transaction + mevcut global applock üzerinden native satış/finans servislerini kullanır; yeni ticari ürün DB'si yok.

Paket rollback: TEST49 korunur; launcher yalnız kimliği kanıtlanmış üç TEST sürecine geri alınabilir. Eski pakette yeni yazma route'u yok. Native ticari geçmişi/drop/restore yaparak silmek rollback yöntemi değildir. LIVE sahipleri/private config/ağ ayarları değişmez.

## İlk gerçek normal ekran provası / TEST50

`native-before-sale.json` → `native-draft-after-visibility.json` → `native-finalized.json` → `native-first-full-collection.json` → `native-first-full-cancelled.json` → `native-first-sale-cancelled.json`: sentetik belge34617 / NIGHT-cf1a716809c44e4a8df68855,150TRY. Taslak stok/borç/kasa değiştirmez; tamamlanma20→19ikiSKU, borç0→150,kasa0; tam tahsilat borç0/kasa150; tahsilat sonra satış ters kayıtları20/20/0/0.5kalıcı journal/0intent; geçmiş silinmez. `native-draft.json` ilk başarısız ve rollback olan denemeyi kaydeder, başarılı taslak kanıtı değildir.

`sql-visibility-validate.json` / `sql-visibility-apply.json`: caller SQL metadata görünürlüğünden doğan ilk satış reddi giderildi.37karantina/176kaynak/16622ürün/15-17-22pin kontrolleri aynı bağımsız pinli OWNER-ready içinde korunur; gereksiz caller kopyası kaldırılır.9nativeguard eski gövdeleri aynen korur, native guards hiçbir zaman disable olmaz. Sadece3immutable kurulum metadata guard'ı aynı outer transaction'da hash sürümü yükseltilirken geçici kapatılıp owner-ready çağrısından önce yeniden etkinleşir.3ownerpin değişmez, yeni grant/seed/ticari değişiklik yok. SQL negatifleri bu düzeltmeden sonra yeniden gerçek düşük yetkili kullanıcıyla geçti.

`runtime-switch-50.json`: source908ce0cb6f36 TEST50 kurulumu; LIVE sahipleri/ağ/private config aynı, önceki49 ve launcher yedeği korunur. Son UI düzeltmeleri ayrı uygulama commit'i ve TEST51 ile doğrulanacak. Bu ara aşamadaki LAN UUID/kısmi tutar kusurları teknik tamam sayılmadı.530Sites/36hedefli test PASS; kullanıcı kabulü bekler.

## TEST51 normal LAN teknik prova

İki gerçek literal deneme barkodu0000061010001/0000061010002 ile1+1satır150TRY kaydedildi. Belge34618/NIGHT-4f8eb60e24334ae6901f3f40. Yanıt sunucu200sonrasında bekletildi, ekran zaman aşımıyla sonucu belirsiz bıraktı; yenileme ve aynıUUID/aynıbody tekrarından sonra journal7ve19+19stok/150borç/0kasa değişmedi. Yeni işlem gibi farklıUUID yaratılmadı. GeçiciFetch müdahalesi boşpatterns ile kaldırıldı.

50TRYkısmi tahsilat çift tıklamada tek etki(journal8/borç100/kasa50), yenilemede korundu.100TRYkalan tahsilat(journal9/borç0/kasa150); bağlı tahsilat varken satışiptali409/hiçbir değişiklik yok.100ve50tahsilatların tersleri(journal10-11), ardından satıştersi(journal12) sonunda stok20+20/borç0/kasa0. Bütün native kayıtlar korunur. native-lan-*.json gerçek salt okunur SQL before/after kanıtlarıdır.

Müşteri geçmişi kalıcı aynı iki belge ve tahsilatları okur. home-full.json günlük150TRYsatış,300TRYbrüttahsilat/150TRYtersi ayrı; genel kasa bakiyesi unavailable. role-boundaries.json gerçek seller15/ilker16 yetkilerini okur; seller tahsilatpreview403, hesapları boş. Ayrılmış TRY dışı tahsilat/currency açılmadı.1440/1024/390yataytaşma ölçümleri veJPEGkanıtları kaydedildi; yönetilen ekran görüntüsü görünür alanla sınırlı olabilir, gerçekCSSviewport ölçümü ayrıca tutulur.

Son dar paket52: saleCancel bağlı tahsilat409için yalnızallowlisted WORK_COLLECTIONS_ACTIVE kodu temiz kullanıcı mesajına çevrildi. Diğerroute/status/rawsunucumesajları aynı.43hedefli test PASS; finalpaketgerçekekran kanıtı sırada.
