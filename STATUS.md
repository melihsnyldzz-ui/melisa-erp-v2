# Melisa ERP durumu

4 Ekim 2026 — Vega açılış migration TEST provası yürütülüyor. Kaynak/delta ve güvenli native plan doğrulandı; gerçek SQL uygulama ve bağımsız mutabakat sonucu henüz tamamlanmadı. [Migration planı](ERP_MIGRATION_PLAN.md). LIVE yazımı yok.

3 Ekim 2026 — **Mal kabulden fatura → aynı faturadan alış iadesi, ayrılmış TEST kayıtlarıyla iş kabulüne hazır.**

- Kanonik kaynak: `C:\Sirket\ERP\source\canonical-live-20261003`, dal `codex/canonical-live-20261003`.
- TEST: [Alış faturaları](http://127.0.0.1:5194/is-akisi-taslagi.html#purchases) → **Bu faturadan iade aç**. API 4144, native 4146 salt okunur; DB `MELISA_ERP_SIRKET_TEST_20260929_01`.
- Yeni fatura ve kendi satırı iade kaynağıdır; fiyat, kalan iade adedi ve ilgili ürün stoğu SQL'den gelir. Taslak etkisiz, yetkili onay stok/borç etkili, tekrar istek tek etkili. Aktif iade varken kaynak fatura iptali engellenir; önce iade ters kaydı yapılır. Alış listesi onaylı iadeyi kalan borçtan düşer.
- Gerçek ekran/SQL kabulü: fatura #25083 → taslak #31 → iade #223. Stok -1, borç -60 TRY; ters kayıt +1/+60 TRY. İade ve fatura sonunda iptal edildi, başlangıç stoku/bakiyesi korunur. Kasa/banka değişmedi; iki stok, iki cari ve iki audit kaydı korunur. 14 hedefli test ve 14 tarayıcı kontrolü PASS.
- TEST SQL'in dört korumasına yalnız bağlı adlandırılmış mal kabul faturası için dar iade/ters kayıt/audit kapsamı eklendi. 30 toplam alış isteği engeli kaldırıldı; geçmiş kayıt sayısı iptal işlemini kilitlemez. Asıl ürün/tutar/stok/yetki sınırları korunur.
- Kesin launcher: `C:\Sirket\ERP\runtime\start-canonical-test.ps1`. Son paket: `CANONICAL-LINKED-RETURN-TEST-20261003-05`; tam commit/hash kendi `release-manifest.json` dosyasında ve yerel `final-verification.json` kanıtındadır. Son ticari kaynak commit'i `16bd97f`; dokümantasyon commit'i ticari kodu değiştirmez.
- LIVE süreç sahipleri aynı; eski paketler/launcher ve orijinal TEST trigger tanımları korunur. LIVE geçişi yapılmadı. Önceki çalışan özelliklerin kabulü tekrar açılmadı.

**Personelin sıradaki kabulü:** TEST alış ekranında aynı faturadan iade bağlantısının kendi günlük işine uygunluğunu görmesi. Bu bağlı akış hazırdır; tüm ERP'nin tamamlandığı iddia edilmez. Sonraki gerçek eksik çok satırlı kabul/ayrıntılı alış taslağıdır. Fiyat kartı yazımı, tüm ticari kartlar ve fiziksel native kabulü açık kalır; USD/EUR için 12 Eylül kayıtlı kurun güncel piyasa kuru olduğu varsayılmaz.

[Bitirme planı](ERP_FINISH_PLAN.md) · [Yeni bağlı akış kabulü](docs/erp-v2/canonical-20261003/linked-purchase-return-acceptance.md) · [Önceki SQL kabulü](docs/erp-v2/canonical-20261003/sql-workflow-acceptance.md) · [Teslim kaydı](docs/erp-v2/canonical-20261003/delivery.json)
