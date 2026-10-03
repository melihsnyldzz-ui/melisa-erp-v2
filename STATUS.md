# Melisa ERP durumu

## CRM sipariş taslağı — 4 Ekim 2026 gerçek TEST kabulü

**PASS — yalnız ayrılmış TEST müşteri/ürün akışı.** Normal CRM'de kullanıcı mevcut ERP hesabıyla giriş yaptı; 41140 SÜPERMİNİ / BÜYÜK ÇİÇEKLER 2 Lİ TAKIM için **2 × 196 = 392 TRY** native draft kaydedildi ve ayrı GET ile ekranda yeniden okundu. Kullanıcı **“Evet, doğru görünüyor; kabul ediyorum”** dedi. Günlük ERP uygulamasının genel kabulü veya LIVE geçişi değildir.

- Kaynak: `codex/crm-order-draft-20261004`, taban `5a82c1d`; uygulama `6ef3506`, sağlık DB DTO `4fb9eab`, audit düzeltmesi `a3fa8fc`. [PR #21](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/21), base `codex/erp-github-workflow-20261003`; main/merge/tag/LIVE deployment yok. CRM karşılığı `8af2134` / [PR #3](https://github.com/melihsnyldzz-ui/melisa-crm/pull/3).
- Kurulu ayrı API paketi **CRM-ORDER-DRAFT-TEST-20261004-02**, source **4fb9eab26cb770a46a9e985ddd64e02b996f2d6f**, loopback62404. Audit SQL `a3fa8fc` ayrıca uygulandı. DB **MELISA_ERP_SIRKET_TEST_20260929_01**, mevcut scoped writer. Günlük ERP4144/native4146/web5194 paketi korunur; LIVE servisleri değiştirilmedi.
- Sözleşme yalnız mevcut sentetik müşteri **593 / TEST-V70-20260929-C**, CRM55/7733. Doğrulanmış eşleme **vega-161466 → native301982**, exact source_record_key VEGA2026/F0102TBLSTOKLAR/161466, TRY196. Diğer ürünler henüz scope'a eklenmedi. Master ürün/müşteri kartları değiştirilmedi.
- İlk gerçek create mevcut audit guard yüzünden rollback oldu; sipariş oluşmadı. Dar insert-only izin doğru DB, draft/request/UUID/hash/aktör/kapsam ve JSON false etkilerini doğrular; eski audit guard gövdesi ve UPDATE/DELETE sınırları korunur. Wrong-hash ve mixed audit INSERT gerçek transaction/rollback kontrollerinde **51070** ile engellendi. Bağımsız reviewer son kaynakta açık P1/P2 bulmadı.
- Gerçek kayıt **id4 / CRM-9B4BFF310FD24137866D5854AF**, UUID **9b4bff31-0fd2-4137-866d-5854aff0a407**, draft / 392TRY. Aynı UUID create/read gerçek scoped SQL writer üzerinden tekrarlandı: tek sipariş ve tek audit; yeni kayıt oluşturmadı. Sonradan farklı UUID ile ikinci TEST taslağı id5 / 1 adet / 196TRY gözlendi; bu ayrı kayıt replay duplikasyonu sayılmadı.
- Önce/sonra stok **96**, TEST müşteri bakiye **0**. Test başlangıcından sonra ilgili ürün/müşteri için stok/cari hareket **0/0**; finalize/satışa dönüştürme yok. Teknik testler ERP13/13 + CRM13/13, TEST frontend build; son API HEAD4fb9eab quality-build-test/secret-scan başarılı. Son belge/SQL HEAD kontrolü PR Checks'te ayrıca izlenir; CI tek başına gerçek kabul değildir.
- Özel yerel kanıtlar `C:\Sirket\ERP\logs\crm-order-draft-20261004` ve `C:\Sirket\CRM\logs\acceptance-20261004\erp-draft-392-real-receipt.png`; Git'e veri/credential/log eklenmedi. [Sözleşme ve runbook](docs/erp-v2/crm-test-order-draft.md).

Kalan: başka ürün/müşteri için exact kaynak eşlemeleri ayrı kapsam ister; ayrı62404 süreç için Windows açılış kurulumu/kabulü yok. Form close/reload recovery offline testli; gerçek browser reload sonrası yeniden giriş kabulü bu tur yapılmadı. Önceki ERP günlük iş/personel kabulleri aşağıda korunur.

## GitHub çalışma düzeni — 3 Ekim 2026

Bu bölüm kaynak/CI hazırlığının güncel kaydıdır. Önceki uygulama/TEST kabul kayıtları aşağıda korunur; bu çalışma uygulama özelliklerinin genel kabulü değildir.

| Alan | Sonuç |
| --- | --- |
| Kapsam | CI workflow, branch/main stratejisi, sürümleme, deploy/rollback, AGENTS ve PR şablonu |
| Teknik sonuç | Yerel **PASS**; 544/544 offline test (API 185 + Sites 354 + web-admin 5), iki frontend build, API/CI syntax; tam HEAD geçmişi secret scan PASS |
| Bağımsız inceleme | PASS; yalnız incelenmiş tekil yanlış pozitif secret fingerprint istisnaları |
| GitHub CI | **PASS** — kaynak/CI teslim commit'i `3b3bfc716b83e9cfdcf3fa41251d3a7cfda8077b` için [PR kontrolü](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/37153297442) ve [push kontrolü](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/37153291238) başarılı; son PR head kontrolleri Checks sekmesinde ayrıca doğrulanır |
| Gerçek kullanıcı kabulü | **BEKLİYOR** — bu PR/commit için kullanıcı kabulü kaydı yok; önceki uygulama kabulleri korunur |
| Branch | `codex/erp-github-workflow-20261003` |
| Taban commit | `2d22009ddc186e87c77f28d47c3c4adc2ba9e8cd` / `codex/erp-agents-on-canonical-20261003` |
| Teslim commit / PR | CI `0c0cc30`; belge `641ddfe`; metadata `92f2d65`; üretim build düzeltmesi `3b3bfc716b83e9cfdcf3fa41251d3a7cfda8077b`; [PR #19](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/19), hedef `codex/erp-agents-on-canonical-20261003`; takip kaydı yalnız bu STATUS sonucudur |
| TEST commit / paket | Bu görevde deployment yapılmadı; mevcut runtime kimliği **Durum doğrulanmadı** |
| LIVE commit / paket | Bu görevde deployment yapılmadı; mevcut runtime kimliği **Durum doğrulanmadı** |
| Release / main | Tag/release/merge yapılmadı; ilk tag yalnız kabul edilmiş main'den |
| Kalan iş | Kullanıcı PR'yi kabul etsin; main'e geçiş ve LIVE ayrıca ele alınır. Son PR head ve kontrollerinin güncel sonucu PR'nin Checks sekmesindedir |

[Çalışma düzeni](docs/development/GITHUB_WORKFLOW.md) · [Sürümleme](docs/development/RELEASES.md) · [Deploy/rollback](docs/development/DEPLOY_ROLLBACK.md).

Mevcut bundle/use-client uyarıları sürer; Android APK, Windows desktop, gerçek SQL/ODBC, fiziksel terminal/print, legacy CRM ve gerçek kullanım kabulü bu CI kapsamında değil. Yerel build doğrulaması kanonik repo altında yok sayılan sentetik kaynak snapshot'ında yapıldı.

İlk GitHub denemesinde mevcut `tmp/melisa-os-reference` Git referansının `.gitmodules` kaydı eksikti; test başlamadan checkout durdu. `92f2d65` yalnız eksik merkezi repo bağlantı metadata'sını ekler, mevcut `c0f2def25aa0ffac88d46d1d3e6638a542521397` pointer'ını korur; CI'de `submodules: false` ile referans başlatılmaz. Sonraki push/PR kontrolleri PASS. `3b3bfc7` CI build'ini production, testleri test modunda tutar; aynı offline güvenlik sınırlarıyla iki üretim build'i ve GitHub kontrolleri PASS.

## Kanonik geliştirme kökü — 3 Ekim 2026

- SEMIH: `C:\Sirket\ERP\melisa-erp-v2`; fetch/push origin `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git`.
- Güncel kaynak tabanı: `codex/canonical-live-20261003` / `e82262b1d120f4c461a2456d67e34c115578d7ba`, [PR #15](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/15). Yerel kaynak ve GitHub HEAD eşleşti.
- Aktif ajan/kök düzenleme dalı: `codex/erp-agents-on-canonical-20261003`. Ajan dosyaları PR #17’den uyarlanır; güncel plan, STATUS ve kabul kanıtları PR #15 tabanından korunur. PR #17’nin eski main tabanı geliştirme tabanı yapılmaz.
- Son kayıtlı teknik TEST paketi: `3eb36e70fddbbf4ff3a090e560153b5bfba7b3b8`; kapsam [kesin teslim](docs/erp-v2/canonical-20261003/delivery.json) ve [SQL akış kabulü](docs/erp-v2/canonical-20261003/sql-workflow-acceptance.md). Bunlar önceki çalışmanın kanıtıdır; kök standardizasyonu yeni uygulama kabulü değildir. Personelin günlük iş kabulü hâlâ bekliyor.
- PR #14 bitiş planı, PR #15 kanonik kaynak ve native PR #13 korunur; main’e merge yapılmadı. Eski kaynak/runtime/release ve dirty farklar aynen kalır.


## Önceki teknik kabul kaydı — kök standardizasyonunda yeniden çalıştırılmadı

3 Ekim 2026 — **Yeşil Sites → kanonik API → gerçek TEST SQL: ayrılmış TEST kayıtları için teknik kabul PASS.**

- Paket kaynağı: `3eb36e70fddbbf4ff3a090e560153b5bfba7b3b8`; dal: `codex/canonical-live-20261003`.
- TEST: [yeşil Sites ekranı](http://127.0.0.1:5194/is-akisi-taslagi.html#home), API 4144; native 4146 salt okunur. DB: `MELISA_ERP_SIRKET_TEST_20260929_01`. LIVE DB erişimi yok.
- Önceki kabul servisleri hedefli olarak kanonik kaynağa alındı. Satış/alış, tahsilat, ödeme, iade ve sayım aynı kanonik invoice/finance/movement servislerini kullanır. İş kayıtları SQL’de; tarayıcı yalnız bekleyen istek/taslak kimliğini tutar. Örnek ekran ayrı kalır.
- Doğrulama: 354 Sites + 27 seçili kanonik test; 31 gerçek API/SQL kontrolü; 8 gerçek ekran yazma kontrolü; 16 ekran; 32 son smoke PASS. SQL dışı on tablonun diğer kayıt kontrol değerleri aynı.
- LIVE 254 dosya hash’i, sunulan HTML/JS/CSS ve süreçler aynı. Ana kirli ağacın 587 durum kaydı korunur. Eski paketler/kopyalar korunur; launcher yalnız bu kesin paketi hedefler.

**Kalan tek iş:** personelin TEST’te normal iş sırasını görerek iş kabulünü vermesi. Teknik kabul, ayrılmış TEST kayıtlarıyla sınırlıdır; tüm ticari kartlar, bütün Sites taslak özellikleri, fiziksel terminal veya LIVE geçişi için genel PASS değildir.

Fiyat/maliyet kanıtı ve geçmiş snapshot davranışı doğrulandı; kart fiyatı yazımı ve ayrıntılı çok satırlı alış taslağı açılmadı. DB’deki son USD/EUR kur tarihi 12 Eylül; güncel piyasa kuru iddiası yok.

[Bitirme planı](ERP_FINISH_PLAN.md) · [Ayrıntılı kabul](docs/erp-v2/canonical-20261003/sql-workflow-acceptance.md) · [Kesin teslim](docs/erp-v2/canonical-20261003/delivery.json)
