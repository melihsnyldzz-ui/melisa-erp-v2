# Goal8 — D01/D02 ve işletim hazırlığı salt okunur denetimi

7 Ekim 2026. Kaynak incelemesi ve mevcut Goal6/7/7.1/7.2/7.3 kanıtlarının kullanımıdır. Yeni SQL/finans/cari/stok/fiyat işlemi, Vega yakalaması, kart oluşturma, hold kaldırma, backup/restore, restart veya Git işlemi yapılmadı. Ham kimlik, ad ve tutar yayımlanmadı.

## D01: güvenli karantina ile ticari seçimi ayır

54 kart normal katalogda inceleme amacıyla görünür; bu görünüm işlem kabulü değildir. `catalogModel.mjs:30–32` ve `workCatalogModel.mjs:15–22,41,50` held kartta accepted sınıflandırmayı, satış fiyatı, doğrulanmış birim/fiyat seçimi ve fotoğrafı engeller. `personnelTerminal.js:103–104` inceleme durumunu ve işlem başlatılamadığını gösterir. Kaynak kayıtlar immutable hold/manifest ve satır hashleriyle korunur.

`operationQuarantineService.js:53–58` tam entity sonuçlarını doğrular ve held kartı409 ile reddeder; okuyucu eksik/hatalıysa kapanır. `invoiceRoutes.js:22,26,28,32` satış/alış draft kapısında, `invoiceDraftService.js:1672,1791,1907,2267,2630,2755,2937,3180` transaction içinde karantinayı tekrar denetler. `operation-quarantine-sql.mjs:15–45` ürün/fiyat/alias, satış/alış kalemi, stok, mal kabul, sayım ve finans zincirinde37 FIRST guard üretir. `enable-test-daily-count-lines.sql:82–86,142–146` count ürününü ve manifest/guard sayısını denetler. `enable-test-work-inbound-counts.sql:34` mal kabul scope ürün/tedarikçi hold'unu reddeder. `crm-order-v2-sql.mjs:39` CRM native taslakta ürün binding ve native/source hold denetler. Goal7/7.3 mevcut scope/guard korunumu kanıtı tekrar kullanıldı.

Sonuç: Karantina dışındaki mevcut onaylı TEST zincirleri54 ürünü çözmeden çalışabilir; 54 kartın belirsizliği kendi başına bu güvenli kapsamın teknik engeli değildir. Buna rağmen bu tur54 ürünün gerçek günlük işte kullanılmadığına ilişkin işletme kanıtı yoktur. Dolayısıyla koşulsuz genel LIVE nonblocker veya işletmesel gereksizlik sonucu verilmez. CRM provider paylaşımının ERP dışındaki tüm tüketici yolları bu ERP kaynak denetiminde yeniden işletilmedi; mevcut Goal4 kapsamı ayrıca kullanılır.

Normal yeşil yüz için ayrı kritik sınır: `workSales.js:24,41` gerçek katalog kartını yalnız İncele olarak açar; sepete ekleme yalnız `context.scope.products`, müşteri seçimi yalnız scope customer üzerinden olur. `workTradeStore.mjs:4,34,43–49` exact TESTDB/testlogin/LIVE erişimi0, `synthetic:true`, TRY, max2ürün/5adet/500 tutar bağlarını sabitler. Bu mevcut güvenli TEST tasarımıdır. Genel `invoiceRoutes.js` satış/alış ve `nativeTerminalRoutes.mjs:37` native satış API'leri mevcut; yeni modül icadı gereksinimi göstermez. Ancak yeşil normal yüzün gerçek ticari karta bağlanması sadece ortam adı/izin değişikliğiyle kanıtlanmış değildir; mevcut work adapter ve seçici kodu TEST'e bağlıdır. Bu, D01 karantinasından ayrı LIVE çalışma yüzü etkinleştirme/kabul bağımlılığıdır. Bu denetim onu geliştirme yetkisi veya mevcut zinciri yeniden yazma kararı saymaz.

## D02: sınıflandırma hazır, bütün cariler finansal hazır değil

Private `account-transfer-plan.json` salt okunur agregasyonu:200 cari/209 hesap;59müşteri/150tedarikçi hesabı;91TRY/106USD/10EUR/2UNKNOWN(LL);205kimliği kanıtlı/4hedefsiz;125held hesap.125 hesap122 karantina carisiyle aynı sayım birimi değildir.83hareketsiz hesabı kullanılmıyor veya sıfır saymak yanlıştır; planda işletmesel kullanım/exclusion kanıtı bulunmaz.

Private dört kart planı4ayrı F0103 tedarikçi/TRY/NEW_CARD_REQUIRED/targetExists:false sonucunu taşır; source UID/hash/rol/holdPreserved/balanceStatus/createAuthorized/linkAuthorized alanları vardır. Kartcreate/link/balanceopening uygulanmadı, hold korunur. Bunların mevcut olmadığı araştırması bitmiştir; yeni arama döngüsü gerekmez.

Goal7.2 rapor mutabakatındaki57 hesap:16exact-ready(Goal7.3'te15fark+1no-op TEST uygulanmış),30gösterim-hassasiyet,7zaman/sürüm,1tutar/yön,3(-) anlamı eksik. Ayrıca27explicitcarry eksik,4yeni kart ve2LL ayrı kalır; bu gruplar122cariden çıkarılarak yanlış bakiye/cari toplamı üretilmez. TRY/USD/EUR birleştirilmez; rol ve B/A yönü korunur; UNKNOWN/(-)/LL/NULL sıfır veya TL yapılmaz. LL'nin eski deneme açıklaması yeniden sorulmaz; ayrı hesap işlemi insan kararı gerektirir.

D02 kırmızıdan sarıya ancak **hesap bazlı sınıflandırma, karar/oluşturma/kanıt planı teknik hazır; insan ve finans kapsamı açık** anlamıyla taşınabilir.122 belirsiz carinin finansal kabulü, bütün migration veya LIVE nonblocker sonucu değildir. İşletmede kullanılan bir cari bu kalanlarda ise doğru kimlik/döviz/açılış/rapor mutabakatı veya açık işletme dışlama kararı LIVE öncesi gerekir. Kullanılmayan/sonraya bırakılabilen kapsam kanıtlanmadığından CANLIDAN SONRA ataması yapılmadı.

## Terminal, autostart, backup/restore

Fiziksel Zebra/scanner/Wi-Fi/uyku/logon/reboot ve gerçek personel kabulü hâlâ pending; Goal5 browser ve Goal6 process provaları tekrar insan PASS yapılmadı.

Bu tur salt okunur startup config/task/manifest: TEST86 `CANONICAL-GOAL73-TEST-20261007-86`, source769031cb88de8ab26720266c62ce0e63d62d0877, manifestBEE4640F2979B773BD8A5AB0BC64EE4B7CCF2607DC0221E78B69E155A5F7BD9D; dosya hash/source eşleşir. `Melisa-ERP-TEST-Canonical` task mevcut, Hidden launcher `scripts/canonical/start-owned-test.ps1`, runtime config path mevcut; Limited/Interactive. Manifest write scope `existing-named-test-records`. Goal6 pinned launcher sınırlı recovery/ownership yapısı current config ile geçerlidir; servis yeniden başlatılmadı ve fiziksel reboot kanıtlanmadı.

Goal6 backup/restore kanıtı tarihsel olarak geçerli: ayrı ONLINE/READ_ONLY restore DB,35kritik tablo/177guard/ayrı uygulama okuması. Goal7.3 daha yeni COPY_ONLY/CHECKSUM/VERIFYONLY yedek makbuzu vardır. Bu iki kanıt TEST86'nın yeni snapshot'ını restore etmiş sayılmaz.

`goal6-backup-restore.ps1:5–13` Goal6'ya ait sabit eski backup/restore hedefini taşır ve var olan hedefi reddeder. `goal6-restore-read.mjs:13–14` TEST74/source5972 connector'üne bağlı, `goal6-restore-contract.mjs:8–9`16622/63774/eskifiyat doğrular. Dolayısıyla eski komutlar tarihsel kanıt okuma/guard açısından geçerlidir; TEST86 güncel restore kabulünü otomatik üretmez ve hedef yeniden kullanılmaz. Yeni testte yeni ayrı restore hedefi ve güncel source/snapshot sözleşmesi gerekir; bu denetimde çalıştırılmadı.
