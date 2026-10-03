# Melisa ERP durumu

## GitHub çalışma düzeni — 3 Ekim 2026

Bu bölüm kaynak/CI hazırlığının güncel kaydıdır. Önceki uygulama/TEST kabul kayıtları aşağıda korunur; bu çalışma uygulama özelliklerinin genel kabulü değildir.

| Alan | Sonuç |
| --- | --- |
| Kapsam | CI workflow, branch/main stratejisi, sürümleme, deploy/rollback, AGENTS ve PR şablonu |
| Teknik sonuç | Yerel **PASS**; 544/544 offline test (API 185 + Sites 354 + web-admin 5), iki frontend build, API/CI syntax; tam HEAD geçmişi secret scan PASS |
| Bağımsız inceleme | PASS; yalnız incelenmiş tekil yanlış pozitif secret fingerprint istisnaları |
| GitHub CI | PR/push kontrolleri gönderim sonrası beklenecek; henüz PASS denmiyor |
| Gerçek kullanıcı kabulü | **BEKLİYOR** — bu PR/commit için kullanıcı kabulü kaydı yok; önceki uygulama kabulleri korunur |
| Branch | `codex/erp-github-workflow-20261003` |
| Taban commit | `2d22009ddc186e87c77f28d47c3c4adc2ba9e8cd` / `codex/erp-agents-on-canonical-20261003` |
| Teslim commit / PR | PR açıldıktan sonra bu bölümün takip kaydına yazılır |
| TEST commit / paket | Bu görevde deployment yapılmadı; mevcut runtime kimliği **Durum doğrulanmadı** |
| LIVE commit / paket | Bu görevde deployment yapılmadı; mevcut runtime kimliği **Durum doğrulanmadı** |
| Release / main | Tag/release/merge yapılmadı; ilk tag yalnız kabul edilmiş main'den |
| Kalan iş | Son PR head CI sonucunu kaydet; kullanıcı PR'yi kabul etsin; main'e geçiş ve LIVE ayrıca ele alınır |

[Çalışma düzeni](docs/development/GITHUB_WORKFLOW.md) · [Sürümleme](docs/development/RELEASES.md) · [Deploy/rollback](docs/development/DEPLOY_ROLLBACK.md).

Mevcut bundle/use-client uyarıları sürer; Android APK, Windows desktop, gerçek SQL/ODBC, fiziksel terminal/print, legacy CRM ve gerçek kullanım kabulü bu CI kapsamında değil. Yerel build doğrulaması kanonik repo altında yok sayılan sentetik kaynak snapshot'ında yapıldı.

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
