# Melisa ERP durumu

4 Ekim 2026 — **Vega açılış migration gerçek TEST provası tamamlandı. Eşlenen kapsam PASS; genel geçiş PARTIAL.** [Migration planı](ERP_MIGRATION_PLAN.md) · [5194 mutabakat özeti](http://127.0.0.1:5194/migration-proof.html).

- Kaynak Vega; eski resmi geçmiş aktarılmadı. Donmuş 30 Eylül kesimi → yalnız `MELISA_ERP_SIRKET_TEST_20260929_01`; run `VEGA-OPENING-TEST-20261004-06` COMMITTED. LIVE/Vega yazımı yok.
- 16.622 ürün, 371 müşteri + 401 tedarikçi, 785 döviz hesabı, 63.774 fiyat ve 8 güvenli yeni barkod uygulandı. Bağımsız kayıt bazlı stok/cari/fiyat/maliyet mutabakatı fark 0. 6.070 maliyet kanıtlı, 10.552 NULL/bilinmeyen; bilinmeyen maliyet sıfıra çevrilmedi.
- 1.493 açılış hareketi, 184.045 immutable kaynak kanıtı. 27 eski geçmiş/finans/terminal tablosu ve 22 SQL guard korunur. Verify/replay ve aynı apply tekrarının güvenli reddi sonrası 37 tablonun tüm count/hash'i aynı; ek yazma 0. COPY_ONLY/CHECKSUM yedeği VERIFYONLY PASS; restore provası yapılmadı.
- Güncel Vega delta gerçekten çıkarıldı: 71 yeni, 341 değişmiş ürün; 74 değişmiş cari. Bu delta TEST açılışına uygulanmadı; okuma atomik cutover kesimi değildir. T0/T1, yazıcı durdurma, yeni batch, delta mutabakatı ve rollback kapıları planda.
- Açık kapılar: 54 ürün ve 122 cari native kabul dışında; 54 eski karantina kartının 22'si aktif/39'u stoklu olduğundan operasyon engeli ayrıca gerekir. Kabul edilen 9.751 üründe döviz uyumsuz scalar alış fiyatı korunur; mevcut fiyat ekranı typed kaynağı okumaz. Eksik maliyet/bakiye/barkod, gerçek kasa/banka sayımı ve güncel kesim kabulü açık. Tam günlük kullanım veya LIVE cutover kabulü verilmedi.
- Gerçek normal API ürün stok/maliyet ve müşteri bakiye okumaları PASS; tedarikçi GET mevcut kullanıcı yetkisiyle 403, yetki genişletilmedi; tedarikçi mutabakatı SQL üzerinden kanıtlı. TEST maliyet gösterimi için NULL koruması eklendi; nihai ekran/paket kabulü kendi kanıt dosyasında tutulur.
- Son paket `CANONICAL-VEGA-MIGRATION-TEST-20261004-06`, launcher `C:\Sirket\ERP\runtime\start-canonical-test.ps1`; tam source commit/hash release manifest'te. Kanıt kökü `C:\Sirket\ERP\evidence\VEGA-MIGRATION-TEST-20261004`; ham ticari veri yalnız erişimi sınırlı private bölümde. `sql-vega`, backend, reviewer ve release kullanıldı.

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
