# ERP-NIGHT01 — 6 Ekim 2026 teknik prova kanıtları

Bu aşama SQL hazırlığıdır; tarayıcı kabulü henüz kaydedilmedi. İnsan kabulü ayrı USER_ACCEPTANCE.md kaydıdır.

- `baseline.json`: gece başlangıcında TEST49, aynı LAN oturumu, 50 ürün, üç gerçek ölçüm; ilk sıcak/soğuk örnekler ayrı korunur.
- `sql-validate.json`: gerçek SQL kurulumu transaction içinde, düşük yetkili context okuması, rollback; eski dokuz operasyon alanı fingerprint'i / kullanıcı-yetki / trigger-metadata geri döndü. IDENTITY sayaçları ilerleyebilir; ticari içerik geri döner, reseed yok.
- `sql-apply.json`: aynı incelenmiş kaynağın kontrollü kurulumu; iki ürün, bir müşteri, bir TRY kasa ve iki satış fiyatı sentetik native kayıt. Satış/tahsilat hareketi bu aşamada sıfır.
- `sql-negatives.json`: yalnız sentetik kayıtlarda dokuz gerçek düşük yetkili engelleme; ürün/fiyat/context/journal korumaları; gerçek ticari kart yazma denemesi sıfır.
- `legacy-readers-after-setup.json`: eski TEST49 üzerinde kabul edilmiş katalog ve mevcut alış okuyucuları hâlâ açılır.

SQL kaynağı `scripts/canonical/enable-test-night-workflows.sql`; offline builder önceki guard'ların bağımsız hash'lerini ve gövdelerini saklar. Hiçbir ticari/karantina guard'ı devre dışı bırakılmaz. İki immutable kurulum metadata guard'ı yalnız dış transaction içinde hash sürümü yükseltilirken, fixture yazılmadan önce yeniden etkinleştirilir. Yeni owner prosedürleri bağımsız ready/context/effect pinleri ve gerçek düşük yetkili kullanıcıyla okunur. Uygulama aynı SERIALIZABLE transaction + mevcut global applock üzerinden native satış/finans servislerini kullanır; yeni ticari ürün DB'si yok.

Paket rollback: TEST49 korunur; launcher yalnız kimliği kanıtlanmış üç TEST sürecine geri alınabilir. Eski pakette yeni yazma route'u yok. Native ticari geçmişi/drop/restore yaparak silmek rollback yöntemi değildir. LIVE sahipleri/private config/ağ ayarları değişmez.
