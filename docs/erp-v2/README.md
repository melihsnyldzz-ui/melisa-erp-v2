# ERP v2 Dokümantasyon İndeksi

Bu klasör Melisa ERP v2 için ana karar, UI/UX, veri, frontend, backend, terminal sync, yetki ve geliştirme yol haritası dokümanlarını içerir.

Stok listesi, stok kartının sistem tarafından kaydedilen değiştirilemez açılış tarihini gösterir; ayrıntılı filtrelerde bu tarih için başlangıç ve bitiş aralığı seçilebilir.
Liste varsayılan olarak kart açılış tarihine göre yeniden eskiye sıralanır; açılış tarihi bulunmayan eski kartlar listenin sonunda gösterilir.

Satış ve alış fişi listeleri; durum, tarih aralığı, para birimi ve tutar aralığını kapsayan ortak bir detaylı arama bölümü kullanır. Satış listesinde personel ve terminal kriterleri de bulunur.

Yeni satış girişinde `Peşin TL`, `Peşin USD` ve `Peşin EUR` carileri görünür kısa yol düğmeleridir; seçim cari ve fiş para birimini birlikte belirler. Satış Fişleri ekranı Vega F0102/D0007 kaynağındaki bütün `StkÇık` satış fişlerini, cari ayrımı yapmadan seçilen tarih aralığına göre yeniden eskiye tek tabloda gösterir ve ilk açılışta son 7 günü getirir. Fiş satırına veya evrak numarasına basıldığında ürün içeriği aynı ekrandaki sağ önizlemede açılır; cari hareket sekmesine yönlendirme yapılmaz. `Peşin TL`, `Peşin USD` ve `Peşin EUR` filtreleri sırasıyla gerçek `2-PEŞİN TL`, `1-PEŞİN $` ve `3-PEŞİN €` carilerini son 7 gün için aynı tablo içinde süzer. Vega listeleme ve fiş ayrıntısı tamamen salt okunurdur; satış başlıkları sayfalandıktan sonra fiş satırları tarih aralığında tek seferde özetlenir.

## Vega yıllık satış karşılaştırması

Raporlar menüsündeki **Yıllık Satış Karşılaştırması**, Vega F0102 kaynağını salt okunur kullanarak 2023–2026 satışlarını karşılaştırır. Dönem eşlemesi 2023/D0004, 2024/D0005, 2025/D0006 ve 2026/D0007 şeklindedir. Satış tutarı cari hareketlerde `IZAHAT = 33`, pozitif borç ve hareket kuru üzerinden hesaplanır; USD, EUR ve TRY birbirine çevrilmeden ayrı gösterilir, LL hariç tutulur.

Varsayılan **Aynı dönem** görünümü, 2026 yılındaki son satış gününü kesim tarihi kabul ederek önceki yılları da aynı ay ve güne kadar sınırlar. **Tam yıl** görünümünde geçmiş yıllar takvim yılı toplamıyla gösterilir; 2026 tamamlanmamış dönem olarak kalır. Rapor Vega verisine hiçbir yazma işlemi yapmaz.

**Satış Performansı** raporu aynı dönem mantığını marka, ürün ve müşteri seviyesine indirir. Marka bilgisi Vega stok kartındaki `KOD1` alanından gelir. Ürün ve marka tutarları satış stok çıkış satırlarından, müşteri bağlantısı aynı fişin cari kaydından alınır; her satırda 2023–2026 tutarı, adet, fiş sayısı ve 2026/2025 değişimi gösterilir.

**Ürün Kârlılığı** raporu Vega F0102 satışlarını F0103 alışlarıyla salt okunur bağlar. Satışın brüt-net farkından satış iskontosu, alışın brüt-net farkından efektif alış iskontosu çıkarılır. Güçlü ürün bağlantısı bulunan alışlar işlem kuru snapshot'ıyla TRY maliyet zincirine alınır; satış anındaki hareketli ağırlıklı net maliyet üzerinden satılan mal maliyeti, brüt ticari kâr ve kâr marjı hesaplanır. Maliyeti bağlanamayan satışlar kâra tahmini değerle eklenmez ve kapsam oranında ayrıca gösterilir. Bu rapor genel giderleri içermeyen operasyonel karar desteğidir; resmi muhasebe veya vergi kârı değildir.

## Vega canlı stok miktarı

Canlı Vega stok listesinde güncel miktar, 2026 döneminde hareketi bulunan kartlar için `F0102D0007TBLSTOKHAREKETLERI` tablosundaki giriş ve çıkışların netinden hesaplanır. Böylece Vega masaüstü uygulamasında stok kartı açılarak gecikmeli `F0102TBLSTOKLAR.KALAN` alanının yenilenmesi gerekmez. 2026 döneminde hiç hareketi olmayan kartlarda, geçmiş dönemden taşınan miktarı kaybetmemek için karttaki `KALAN` değeri kullanılır. Bu hesap tamamen salt okunurdur ve Vega veritabanına yazmaz.

## Vega stok kartı görselleri

Canlı Vega stok listesindeki bir ürün seçilip **Görsel Ekle** komutu kullanılarak JPG, PNG veya WEBP görseli yüklenebilir. Dosya en fazla 3 MB olabilir ve mevcut ürün görseli bileşeni görsele Melisa filigranını tarayıcıda uygular. Görsel dosyası API'nin `uploads/vega-products` klasöründe, Vega kaynak kimliğiyle bağlantısı ise yalnızca yerel `MELISA_ERP_V2.dbo.vega_product_images` tablosunda saklanır. Vega veritabanına hiçbir görsel veya bağlantı yazılmaz.

Bu özellik `infra/sql/migrations/0015_vega_product_images.sql` geçişini gerektirir. Geçiş yalnızca `MELISA_ERP_V2` hedefinde çalışacak şekilde korumalıdır ve canlı veritabanına ayrıca insan onayı olmadan uygulanmamalıdır. Geçiş yokken stok listesi çalışmaya devam eder, mevcut görsel bağlantısı boş döner ve görsel kaydetme işlemi açık bir kurulum hatası verir.

## Vega stok kartı GTİP taslakları

Vega stok kartlarına ait GTİP sınıflandırmaları Vega veritabanına yazılmaz. Kod, güven seviyesi, malzeme dayanağı, kaynak fiş ve doğrulama durumu yalnızca `MELISA_ERP_V2.dbo.vega_product_customs` tablosunda Vega kaynak kimliğiyle ilişkilendirilir. `draft` kayıtlar ürün etiketi ve gümrük müşaviri doğrulaması tamamlanmadan kesin GTİP olarak kullanılmamalıdır. Stok listesi ve Ürün 360 bu yerel bilgiyi canlı Vega kartıyla birleştirerek gösterir. Vega arayüzündeki `4-ÖK`, teknik olarak stok kartının `KOD4` alanıdır; Melisa ERP stok listesinde ve Ürün 360'ta `4-ÖK (KOD4)` adıyla ayrıca gösterilir ve kategori takma adı korunur.

Proforma akışında yerel GTİP kaydı bulunmayan satırlar ürün adı ve açık malzeme işaretlerinden otomatik taslak kodla tamamlanır. Kayıtlı/doğrulanmış kodlar korunur; otomatik kodlar güven seviyesi ve kural dayanağıyla gösterilir, hiçbir veri kaynağına kendiliğinden yazılmaz ve sevk öncesinde insan doğrulaması gerektirir.

Bu özellik `infra/sql/migrations/0016_vega_product_customs.sql` geçişini gerektirir. Geçiş yalnızca `MELISA_ERP_V2` hedefinde çalışır ve Vega 2026 kaynağını değiştirmez.

## Ana Kaynaklar

- [Karar Defteri](karar-defteri.md)
- [UI Blueprint](ui-blueprint.md)
- [UI Referans Görselleri](ui-references/)
- [Menü ve Navigasyon Haritası](menu-navigation-map.md)
- [Data Schema Blueprint](data-schema-blueprint.md)
- [Frontend Architecture](frontend-architecture.md)
- [Backend API Architecture](backend-api-architecture.md)
- [Terminal Sync Protocol](terminal-sync-protocol.md)
- [Auth Permission Architecture](auth-permission-architecture.md)
- [Implementation Roadmap](implementation-roadmap.md)
- [Stabilizasyon Roadmap](stabilization-roadmap.md)
- [QA Stabilization Report](qa-stabilization-report.md)
- [Backup / Restore Plan](backup-restore-plan.md)
- [Backup Restore Verification Plan](backup-restore-verification-plan.md)
- [Backup Restore Evidence Log](backup-restore-evidence-log.md)
- [Backup Restore Dry-Run Preflight](backup-restore-dry-run-preflight.md)
- [Approved Backup Restore Verification Run](approved-backup-restore-verification-run.md)
- [Production Readiness Checklist](production-readiness-checklist.md)
- [Production Deployment Runbook](production-deployment-runbook.md)
- [Production Environment Checklist](production-env-checklist.md)
- [Production Readiness Remaining Hardening](production-readiness-remaining-hardening.md)
- [Production Host Network Checklist](production-host-network-checklist.md)
- [Production Env Ownership Checklist](production-env-ownership-checklist.md)
- [Final Closure Decision](final-closure-decision.md)
- [Production Acceptance Session](production-acceptance-session.md)
- [Windows Desktop Kurulum Paketi](windows-desktop-installer.md)
- [Muhasebe Kabul Test Akisi](accounting-acceptance-test-flow.md)
- [Muhasebe Kabul Test Formu - Word](melisa-erp-muhasebe-kabul-test-formu.docx)
- [Final Testing Runbook](final-testing-runbook.md)
- [Final Testing Findings Log](final-testing-findings-log.md)
- [Guided Final Test Execution Log](guided-final-test-execution-log.md)
- [Final Human Acceptance Log](final-human-acceptance-log.md)
- [Approved ERP Core Write Test Sprint 030 Report](approved-erp-core-write-test-sprint-030-report.md)
- [P0/P1 Findings Fix Pass Sprint 031 Report](p0-p1-findings-fix-pass-sprint-031-report.md)
- [Final Human Acceptance Walkthrough Sprint 032 Report](final-human-acceptance-walkthrough-sprint-032-report.md)
- [Human Acceptance Decision Sprint 033 Report](human-acceptance-decision-sprint-033-report.md)
- [Production Readiness Gate Sprint 034 Report](production-readiness-gate-sprint-034-report.md)
- [Production Deployment Runbook Sprint 035 Report](production-deployment-runbook-sprint-035-report.md)
- [Backup Restore Verification Plan Sprint 036 Report](backup-restore-verification-plan-sprint-036-report.md)
- [Backup Restore Evidence Log Sprint 037 Report](backup-restore-evidence-log-sprint-037-report.md)
- [Backup Restore Dry-Run Preflight Sprint 038 Report](backup-restore-dry-run-preflight-sprint-038-report.md)
- [Approved Backup Restore Verification Run Sprint 039 Report](approved-backup-restore-verification-run-sprint-039-report.md)
- [Production Readiness Remaining Hardening Sprint 040 Report](production-readiness-remaining-hardening-sprint-040-report.md)
- [Production Host Network Checklist Sprint 041 Report](production-host-network-checklist-sprint-041-report.md)
- [Production Env Ownership Checklist Sprint 042 Report](production-env-ownership-checklist-sprint-042-report.md)
- [Final Closure Decision Sprint 043 Report](final-closure-decision-sprint-043-report.md)
- [Reporting Runbook](reporting-runbook.md)
- [AI And Automation Readiness](ai-automation-readiness.md)
- [WhatsApp CRM Architecture](whatsapp-crm-architecture.md)
- [WhatsApp CRM Operational Hardening](whatsapp-crm-operational-hardening.md)
- [WhatsApp CRM Görsel Çalışma Alanı](whatsapp-crm-visual-suite.md)
- [WhatsApp CRM Sprint 001 Report](whatsapp-crm-sprint-001-report.md)
- [WhatsApp CRM Sprint 002 Report](whatsapp-crm-sprint-002-report.md)
- [WhatsApp CRM Sprint 003 Report](whatsapp-crm-sprint-003-report.md)
- [WhatsApp CRM Transformation Sprint 001 - UI Foundation](whatsapp-crm-transformation-sprint-001-report.md)
- [WhatsApp CRM Transformation Sprint 002 - Real Inbox Truth](whatsapp-crm-transformation-sprint-002-report.md)
- [WhatsApp CRM Transformation Sprint 003 - Customer 360](whatsapp-crm-transformation-sprint-003-report.md)
- [WhatsApp CRM Transformation Sprint 004 - Workflow](whatsapp-crm-transformation-sprint-004-report.md)
- [WhatsApp CRM Transformation Sprint 005 - Product and Catalog](whatsapp-crm-transformation-sprint-005-report.md)
- [WhatsApp CRM Transformation Sprint 006 - Quote and Order Gate](whatsapp-crm-transformation-sprint-006-report.md)
- [WhatsApp CRM Transformation Sprint 007 - Dashboard and Reporting](whatsapp-crm-transformation-sprint-007-report.md)
- [WhatsApp CRM Transformation Sprint 008 - Production Preflight](whatsapp-crm-transformation-sprint-008-preflight.md)
- [Local Server Autostart](local-server-autostart.md)
- [Chatwoot Local Installation](chatwoot-local-installation.md)
- [ERP UX Sprint 001 - Navigasyon Sadelestirme](erp-ux-sprint-001-navigation-simplification-report.md)
- [ERP UX Sprint 002 - Satis Fisi Sadelestirme](erp-ux-sprint-002-sales-invoice-simplification-report.md)
- [ERP UX Sprint 003 - Alis Fisi ve Toplu Alis Sadelestirme](erp-ux-sprint-003-purchase-simplification-report.md)
- [ERP UX Sprint 004 - Tahsilat ve Odeme Sadelestirme](erp-ux-sprint-004-finance-entry-simplification-report.md)
- [ERP UX Sprint 005 - Musteri ve Tedarikci Sadelestirme](erp-ux-sprint-005-customer-supplier-simplification-report.md)
- [ERP UX Sprint 006 - Stok Listesi ve Urun Karti Sadelestirme](erp-ux-sprint-006-stock-product-simplification-report.md)
- [ERP UX Sprint 007 - Rapor ve Tanim Ekranlari Sadelestirme](erp-ux-sprint-007-report-definition-simplification-report.md)
- [ERP UX Sprint 008 - Final Responsive ve Gorsel Regresyon](erp-ux-sprint-008-final-regression-report.md)
- [Çoklu Döviz Günlük Kasa](multi-currency-daily-cash.md)
- [Günlük Sabit Fiyat ve Güvenli Teklif](daily-fixed-price-safe-quote.md)
- [Onaylı Ürün Kimliği ve Günlük Fiyat/Stok Snapshotı](product-identity-daily-snapshot.md)
- [Toplu Stok Kartı Oluşturma](bulk-product-create.md)
- [FedEx Mikro İhracat Demo Akışı](fedex-micro-export-demo.md)

## Tasarım Standardı

ERP v2 arayüzü modern boş SaaS paneli gibi değil; Vega/Wolvox tarzı yoğun, desktop-first ve masaüstü ERP hissinde tasarlanır.

Üst menüde genel `Cari` başlığı kullanılmaz. Müşteri cari ekranları `Müşteriler`, tedarikçi cari ekranları ise `Tedarikçiler` ana bölümü altında birbirinden ayrı gösterilir.

## Vega Cari Hareketleri

Vega Cari Listesi'nde seçilen herhangi bir aktif cari `Hareketleri Aç` düğmesiyle veya satıra çift tıklanarak canlı hareket defterinde incelenebilir. `Cari > Vega Cari Hareketleri` ekranı seçim yapılmadan açılırsa kullanıcıyı cari listesine yönlendirir.

Stok çıkış hareketlerinde evrak numarası tıklandığında listeyi kaydırmayan, Vega masaüstü kullanımına benzer bağımsız bir fiş penceresi açılır. Pencere `X`, `Kapat`, arka alan veya `Esc` ile kapanır. Ürün, stok kodu, barkod, miktar, birim, dövizli birim fiyat ve satır toplamları bu pencerede gösterilir. Fiş ayrıntısı cari kaynak kimliği, cari hareket kimliği, evrak numarası, tarih ve hareket türü birlikte doğrulanarak okunur. Ürün ara toplamıyla cari fiş toplamı arasında vergi, iskonto veya yuvarlama kaynaklı fark varsa iki tutar ve fark ayrı gösterilir. Bütün sorgular Vega 2026 döneminde salt okunurdur; Vega veritabanına yazma yapılmaz.

## Vega Tedarikçi Carileri

Tedarikçi Cari Listesi, müşteri carilerinden ayrı olarak Vega `F0103TBLCARI` kartlarını canlı ve salt okunur gösterir. Yalnızca aktif (`STATUS=1`), silinmemiş ve `LL` dışındaki kartlar listelenir. 2026 bakiyesi `F0103D0007TBLCARIHAREKETLERI` üzerinden hareket para birimi kart para birimiyle eşleştirilerek hesaplanır; `30` ve `31` izahat kodları hesaba katılmaz.

Bir tedarikçi seçildiğinde hareketler eski tarihten yeni tarihe yürüyen bakiye ile açılır. `Alış Faturası` evrak numarası, `F0103D0007TBLALFATBASLIK` ve `F0103D0007TBLALFATHAREKET` satırlarını ayrı fiş penceresinde gösterir. Bu akış Vega tarafında `SELECT` dışında hiçbir işlem yapmaz; yerel tedarikçi kartlarını veya Vega kayıtlarını değiştirmez.

## Kodlamaya Başlamadan Önce

Yeni geliştirme veya stabilizasyon sprintinden önce [Implementation Roadmap](implementation-roadmap.md) ve [Stabilizasyon Roadmap](stabilization-roadmap.md) kontrol edilmelidir.
