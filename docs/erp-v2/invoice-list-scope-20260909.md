# Karttan fiş listesine kapsam — 9 Eylül 2026

Ürün ve cari kartından açılan satış listesi; tedarikçi kartından açılan alış listesi artık ilgili Melisa kaydıyla sınırlıdır. Önceki davranış payload kimliğini yok sayıp genel Vega listesini açıyordu. Genel menü girişinde mevcut Vega/Melisa seçimi korunur. Kart kapsamında Melisa kaynağı sabittir; “Genel fiş listesine git” ayrı genel listeyi açar.

Satış GET `/api/sales-invoices`: isteğe bağlı `productId`, `customerId`. Alış GET `/api/purchase-invoices`: `productId`, `supplierId`. Kimlikler pozitif SQL BIGINT olarak doğrulanır; bozuk/değişken türde kimlik 400 `INVOICE_LIST_ID_INVALID` döndürür. Boş veya eksik kimlik kapsam uygulanmadığı anlamına gelir. Kesin kimlik filtresi SQL parametresidir, metin araması değildir. Ürün filtresi EXISTS kullanır; aynı fişin birden fazla eşleşen satırı fişi çoğaltmaz. Kapsamlar ve diğer filtreler birlikte uygulanır. Meta.filters uygulanan kimlikleri içerir. Route, auth, izin ve ticari yazma davranışları değişmedi.

Kart kapsamı tarih/arama temizlemesinden bağımsızdır. Kapsamlı satış listesi ilk açıldığında tüm tarihleri gösterir; genel liste bugünkü varsayılanını korur. Ürün/cari gibi kapsam türleri ve birleşik kimlikler sekme anahtarına katılır; aynı sayısal ürün/cari kimliği iki farklı liste açar. Diğer ekranların sekme anahtarları korunur. Cari kartında satış fişleri görünür Cari 360 eylemlerine eklendi; tedarikçi kartındaki her alış listesi kısayolu aynı kapsamı taşır.

## Doğrulama

- Ağsız 102 API/kimlik testi; önceki 226 web kontrolü; API 149 ve web 184 kök/0 tip tanısı; lint ve web build PASS.
- `node scripts/quality/sql-lab/accept-invoice-scope.mjs`: yalnız mevcut ayrı commerce SQL laboratuvarında 72 gerçek servis/bağımsız SELECT karşılaştırması. Ürün, müşteri, tedarikçi, birleşik filtre, bulunmayan BIGINT kimliği, ALL/FINALIZED ve toplam metası eşleşti. Stok/bakiye/fiş durumu ve hareket sayıları değişmedi. Yeni iş kaydı veya migration yok.
- Gerçek web/API/SQL: TEST-WEB-P1 ürün listesi 12 fiş, kesinleşmiş filtresi 1; ilgisiz ürün araması 0; temizleme sonrası yine 12. Aynı 10002 kimlikli TEST-WEB-C1 cari için ayrı sekme ve 12 fiş. Tedarikçi TEST-WEB-S1 16 alış, kesinleşmiş 1, temizleme sonrası 16. Genel listeye dönüş Vega seçimine izin veriyor. Tarayıcı hata kaydı boş.
- Web testleri normal şifreli oturumla, loopback API ve dış eylem engelleri altında yapıldı. Vega başarı testi yapılmadı. Ayrı test servisleri kapatıldı, SQL diski korundu.

## Açık işler

Tam ERP ve responsive kabulü değildir. Mevcut sade mod temel arama/Temizle panelini gizlediğinden temizleme testi sade mod kapatılarak yapıldı. 1264×626 görünümünde bir cari kısayolunun üzerine başka panel geldi; 1600×1000 boyutta akış doğrulandı. Liste filtre/özet örtüşmeleri ve çok sekmede yatay taşma menü/yerleşim çalışmasında giderilmeli. Fiş listenin mevcut 100 kayıt sınırı ve kısmi liste uyarısı korunur; bu paket tüm veri hacmi performans kabulü değildir. Menü hiyerarşisi henüz uygulanmadı; kaynak/main uzlaştırması, finans/rapor kabulü ve diğer commerce projeleri devam eder.

Ham kanıt ve yönetim kaydı: Melisa Development OS / `audit/commerce-no-messaging-20260908/invoice-list-scope/acceptance.json` ve `reports/ERP_INVOICE_LIST_SCOPE_20260909.md`.
