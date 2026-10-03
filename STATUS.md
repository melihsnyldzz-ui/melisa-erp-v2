# MELISA ERP — durum kaydı

## 4 Ekim 2026 — migration prova belgelerinin GitHub teslimi

- Kapsam/ID: `DOCS-MIGRATION-20261004`; yalnız `ERP_MIGRATION_PLAN.md` ve `STATUS.md`. Kanonik repo `C:\Sirket\ERP\melisa-erp-v2`; origin `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git`.
- Kaynak doğrulaması: önceki kaynak/kanıt kopyasındaki iki belge okundu; sayılar, run/hash, replay, korunan geçmiş ve PARTIAL kapıları birbirleriyle ve kullanıcının aktardığı prova özetiyle tutarlı. Ham ticari veri, private kanıt dosyaları ve uygulama kodu GitHub'a aktarılmadı. SQL/API/tarayıcı kabulü bu teslimde yeniden çalıştırılmadı.
- Teslim dalı: `docs/migration`; hedef `main`, belge tabanı `bc0e0d574605b9ff7b389f98404ed23097851244`. [Branch ve teslim commitleri](https://github.com/melihsnyldzz-ui/melisa-erp-v2/commits/docs/migration); PR bağlantısı oluşturulduktan sonra bu kayda eklenecektir.
- Teknik belge kontrolü: kapsam iki Markdown dosyası; main'e karşı uygulama/SQL/config farkı sıfır; yerel belge içerik, bağlantı ve whitespace kontrolü teslim öncesinde doğrulanır. GitHub CI sonucu tam PR head'inin Checks alanında ayrıca kaydedilir; tamamlanmamış kontrol PASS sayılmaz.
- Gerçek kullanıcı kabulü: genel migration/LIVE geçişi **PARTIAL**; bu PR'nin kullanıcı kabulü **BEKLİYOR**. Commit/push/PR yetkisi kullanıcı isteğinden gelir; merge/deploy kabulü değildir.
- TEST kaynak commit: kayıtlı SQL uygulama commit'i `03ca9c122fbe98aca82f6998e4657aa9d63ccce0`; nihai TEST paketi `CANONICAL-VEGA-MIGRATION-TEST-20261004-06`. Paketin tam kaynak commit'i release manifest'inde; bu belge görevinde **Durum doğrulanmadı**. LIVE commit/runtime sağlığı **Durum doğrulanmadı**.
- Kalan iş: 54 ürün/122 cari belirsizliği, eksik maliyetler, dövizli alış fiyatı akışı, güncel delta, işletme/terminal ve geri dönüş kabulü. Merge, release, runtime değişikliği ve LIVE/Vega yazımı yapılmadı.

### Önceki yerel migration prova kaydı

4 Ekim 2026 — **Vega açılış migration gerçek TEST provası tamamlandı. Eşlenen kapsam PASS; genel geçiş PARTIAL.** [Migration planı](ERP_MIGRATION_PLAN.md) · [5194 mutabakat özeti](http://127.0.0.1:5194/migration-proof.html).

- Kaynak Vega; eski resmi geçmiş aktarılmadı. Donmuş 30 Eylül kesimi → yalnız `MELISA_ERP_SIRKET_TEST_20260929_01`; run `VEGA-OPENING-TEST-20261004-06` COMMITTED. LIVE/Vega yazımı yok.
- 16.622 ürün, 371 müşteri + 401 tedarikçi, 785 döviz hesabı, 63.774 fiyat ve 8 güvenli yeni barkod uygulandı. Bağımsız kayıt bazlı stok/cari/fiyat/maliyet mutabakatı fark 0. 6.070 maliyet kanıtlı, 10.552 NULL/bilinmeyen; bilinmeyen maliyet sıfıra çevrilmedi.
- 1.493 açılış hareketi, 184.045 immutable kaynak kanıtı. 27 eski geçmiş/finans/terminal tablosu ve 22 SQL guard korunur. Verify/replay ve aynı apply tekrarının güvenli reddi sonrası 37 tablonun tüm count/hash'i aynı; ek yazma 0. COPY_ONLY/CHECKSUM yedeği VERIFYONLY PASS; restore provası yapılmadı.
- Güncel Vega delta gerçekten çıkarıldı: 71 yeni, 341 değişmiş ürün; 74 değişmiş cari. Bu delta TEST açılışına uygulanmadı; okuma atomik cutover kesimi değildir. T0/T1, yazıcı durdurma, yeni batch, delta mutabakatı ve rollback kapıları planda.
- Açık kapılar: 54 ürün ve 122 cari native kabul dışında; 54 eski karantina kartının 22'si aktif/39'u stoklu olduğundan operasyon engeli ayrıca gerekir. Kabul edilen 9.751 üründe döviz uyumsuz scalar alış fiyatı korunur; mevcut fiyat ekranı typed kaynağı okumaz. Eksik maliyet/bakiye/barkod, gerçek kasa/banka sayımı ve güncel kesim kabulü açık. Tam günlük kullanım veya LIVE cutover kabulü verilmedi.
- Gerçek normal API ürün stok/maliyet ve müşteri bakiye okumaları PASS; tedarikçi GET mevcut kullanıcı yetkisiyle 403, yetki genişletilmedi; tedarikçi mutabakatı SQL üzerinden kanıtlı. TEST maliyet gösterimi için NULL koruması eklendi; nihai ekran/paket kabulü kendi kanıt dosyasında tutulur.
- Son paket `CANONICAL-VEGA-MIGRATION-TEST-20261004-06`, launcher `C:\Sirket\ERP\runtime\start-canonical-test.ps1`; tam source commit/hash release manifest'te. Kanıt kökü `C:\Sirket\ERP\evidence\VEGA-MIGRATION-TEST-20261004`; ham ticari veri yalnız erişimi sınırlı private bölümde. `sql-vega`, backend, reviewer ve release kullanıldı.

## 4 Ekim 2026 — main altyapı PR hazırlığı

- Kapsam: yalnız çalışma düzeni, ajan/CI/dokümantasyon; main tabanı `577c0cb9d0953635b30088fa23e1e887c7b75775` korunur. Uygulama/SQL/manifest/lockfile/test feature farkı sıfırdır.
- Teslim dalı: `codex/erp-clean-main-infra-20261004`; hedef `main`. Tam head commit, PR ve tamamlanan CI sonucu PR'nin Checks alanında kaydedilir; Yerel teknik kontroller **PASS**: API/CI syntax, offline guard, 24 API + 38 sentetik katalog test (62/62), web-admin build ve HEAD geçmiş secret scan (Gitleaks 8.30.1). GitHub CI henüz çalışmadı; sonucu tam PR head commit'inin Checks alanında doğrulanır.
- Kullanıcı PR/commit kabulü: **BEKLİYOR**. Bitiş planındaki eski uygulama kabulleri bu main PR'sinin kabulü değildir.
- TEST/LIVE commit ve runtime sağlığı: **Durum doğrulanmadı**; runtime işlemi yapılmadı.
- Sonraki tek iş: PR'nin tam head CI kontrolleri başarılı olduktan sonra kullanıcı altyapı PR'sini inceler ve main merge kararını verir. Eski PR #19 korunur.

- Altyapı teslimi: [main hedefli PR #20](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/20); [tam güncel head/Checks](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/20/checks). İlk altyapı commit'i `039b56d21353613d5f5d7329e92638d58d440124` için [push CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/37154726148) iki check PASS. Bu status kaydı sonrası son head'in push/PR kontrolleri ayrıca yeşil olmalıdır; güncel head PR'den okunur. Merge/kullanıcı kabulü BEKLİYOR.
