## 6 November — installed V4 and normal GUI proof

Exact source `770c1e91de1f24b85f718a661bdcacc97e688e58` passed both complete GitHub runs `42263586225` / `42263577462`, including Windows, before the owned local application was stopped. V4 package `adea4bafeee5dfa380f810b944c0a305414e2eb760b2fcf3a1c94a6b5fb3652b` contains225 source files,5 helpers,3 assets. Schema4 and36 tables were retained; no V5 permissions or migration were applied.

The normal green ERP now lists TRY/USD/EUR receipts. Customer2 TRY shows three completed sales and104.32; USD shows invoices13+12, balance2.7354, original invoice13 amount1.164EUR and posted amount1.2804USD with3% discount. Customer3 EUR shows only invoice14,23.28TRY→0.5291EUR. Its zeroUSD account shows no completed sales. History-row buttons opened the correct invoices13 and14. A real page reload restored the normal session; reopening customer2/USD retained the correct two sales. Cancelled sales were excluded from this completed-sales list.

Four independent completed read-only snapshots before/install/GUI/reopen have identical full metadata objects, including all33 business-table row hashes, identity values, schema and security. No persistent business write or permission change occurred. External local proof: `kurulum/r2-v4-installed-gui-proof-v1.json`; screenshots and AX snapshots are retained beside it, including `r2-v4-reopened-customer2-usd.png`. Browser credentials/auth responses were not recorded.

This is technical installed GUI verification on synthetic TEST data, not human, physical-device, LAN, LIVE or all-module acceptance. The final empty business delivery remains pending. Invoice13 is still completed; V5 cancellation is not installed. Older source-only notes below remain historical.

# K04-06: müşteri hesabına göre tamamlanan satışlar — kaynak

Müşteri kartı seçili TRY/USD/EUR hesabının bakiyesini ve yalnız o hesaba işlenen tamamlanmış satışları gösterir. Belge para birimi, cari hesaba işlenen tutar, fiş iskontosu, ürün miktarı/fişteki fiyat ve normal fiş bağlantısı birlikte korunur. İptal edilmiş satışlar tamamlanan satış listesine girmez; bu ekran bütün cari hareketlerin ekstresi değildir.

Normal `customer.view` ve `sales.view` birlikte, aynı tutulan fiziksel SQL işleminde doğrulanır. Salt okunur okuyucu müşteri/entity/account, fiş/hareket currency/tutar/kur snapshot eşliğini kontrol eder; yeni havuz açmaz. DTO tarih/sıra/benzersiz kimlik, satır toplamı/iskonto ve sayfalama sınırlarını doğrular. Seçim değişikliği/oturum kapanışı/geç yanıt ve form kapatma davranışı korunur.

Eski WIP5430704a ve auth düzeltmesi7ede6e05, güncel barkod/V5 e8a34d4f kaynağıyla ayrı feature dalında birleştirildi. `readProductBarcode` ve `readCustomerAccountSales` hem normal-auth binder'da hem ekran core'unda birlikte kaldı. V4 ve V5 normal hesap geçmişi lease testleri aynı assertion'larla geçti. Native/SQL/installer/CI kaynaklarında e8'e göre yeni değişiklik yok.

73 dosyada404 hedefli test,42modül ekran derlemesi, sözdizimi, Gitleaks ve bağımsız salt okunur kaynak incelemesi PASS. İnceleyen ajan SQL/test/runtime çalıştırmadı ve yeni P1/P2 bulmadı. İlk auth düzeltmesi öncesi25 backend ve25 UI kontrolü de ayrı kayıtta korunur. Kayıtlar masaüstü ERP/kurulum içindeki r2-integrated-source-tests-v2.log, r2-integrated-green-build-v1.log ve r2-integrated-source-gitleaks-v1.json dosyalarıdır.

Bu kaynak henüz paketlenmedi/kurulmadı. Exact GitHub CI, gerçek SQL salt okunur gözlem, normal müşteri kartı/fişe dönüş ve insan kabulü bekler. Yeni GRANT, DDL/DML, hesap/parola, SQL servisi, eski ERP/Vega, merkez plan/Excel veya LIVE değişikliği yok. Önce mevcut onaylı V5 fiş13 iptal/kurtarma denemesi tamamlanır; K04-06 ikinci teslimdir.
## Fiş listesi döviz regresyonu

Kurulu V4 normal oturumunda /api/receipts503 DESKTOP_LIST_UNAVAILABLE verdi; eski validator yalnızTRYkabul ediyordu. Yeni USD/EUR fişleri listenin tamamını reddettiriyordu. Regresyon testi önce aynı ret ile RED oldu. Düzeltme yalnız açık V4/V5 profillerinde TRY/USD/EUR okur; V2/3 TRYsınırı, bilinmeyen para birimi reddi, tamtutar ve workflow state kontrolleri korunur. İki readonlydosya; SQL/native/hak/asset değişikliği yok.404test ve bağımsız kaynak review PASS. Bu düzeltme henüz GitHub'a gönderilmedi veya kurulmadı; mevcut f82 CI koşuları bitmeden yeni push yapılmaz. Normal müşteri kartı→sonfiş13 okuması V4'te çalıştı; bu, R2kabulü değildir.
