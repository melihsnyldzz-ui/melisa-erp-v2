# K04-06: müşteri hesabına göre tamamlanan satışlar — kaynak

Müşteri kartı seçili TRY/USD/EUR hesabının bakiyesini ve yalnız o hesaba işlenen tamamlanmış satışları gösterir. Belge para birimi, cari hesaba işlenen tutar, fiş iskontosu, ürün miktarı/fişteki fiyat ve normal fiş bağlantısı birlikte korunur. İptal edilmiş satışlar tamamlanan satış listesine girmez; bu ekran bütün cari hareketlerin ekstresi değildir.

Normal `customer.view` ve `sales.view` birlikte, aynı tutulan fiziksel SQL işleminde doğrulanır. Salt okunur okuyucu müşteri/entity/account, fiş/hareket currency/tutar/kur snapshot eşliğini kontrol eder; yeni havuz açmaz. DTO tarih/sıra/benzersiz kimlik, satır toplamı/iskonto ve sayfalama sınırlarını doğrular. Seçim değişikliği/oturum kapanışı/geç yanıt ve form kapatma davranışı korunur.

Eski WIP5430704a ve auth düzeltmesi7ede6e05, güncel barkod/V5 e8a34d4f kaynağıyla ayrı feature dalında birleştirildi. `readProductBarcode` ve `readCustomerAccountSales` hem normal-auth binder'da hem ekran core'unda birlikte kaldı. V4 ve V5 normal hesap geçmişi lease testleri aynı assertion'larla geçti. Native/SQL/installer/CI kaynaklarında e8'e göre yeni değişiklik yok.

73 dosyada402 hedefli test,42modül ekran derlemesi, sözdizimi, Gitleaks ve bağımsız salt okunur kaynak incelemesi PASS. İnceleyen ajan SQL/test/runtime çalıştırmadı ve yeni P1/P2 bulmadı. İlk auth düzeltmesi öncesi25 backend ve25 UI kontrolü de ayrı kayıtta korunur. Kayıtlar masaüstü ERP/kurulum içindeki r2-integrated-source-tests-v1.log, r2-integrated-green-build-v1.log ve r2-integrated-source-gitleaks-v1.json dosyalarıdır.

Bu kaynak henüz paketlenmedi/kurulmadı. Exact GitHub CI, gerçek SQL salt okunur gözlem, normal müşteri kartı/fişe dönüş ve insan kabulü bekler. Yeni GRANT, DDL/DML, hesap/parola, SQL servisi, eski ERP/Vega, merkez plan/Excel veya LIVE değişikliği yok. Önce mevcut onaylı V5 fiş13 iptal/kurtarma denemesi tamamlanır; K04-06 ikinci teslimdir.