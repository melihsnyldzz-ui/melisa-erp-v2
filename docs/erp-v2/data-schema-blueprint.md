# Melisa ERP v2 Data Schema Blueprint

## Amaç

Bu doküman Melisa ERP v2 için yüksek seviyeli veri mimarisini tanımlar. Amaç migration veya kod yazmak değil; SQL Server uyumlu düşünülecek ana entity/table yapılarını, ilişkileri ve ticari veri kurallarını netleştirmektir.

Melisa ERP v2 tam muhasebe sistemi olmayacaktır. Sistem; stok, satış, alış, cari takip, katalog, terminal sync, dashboard, raporlama ve audit odaklı ticari takip ERP'si olacaktır. Resmi muhasebe fişi, defter, beyanname veya tam muhasebe modülü bu kapsamda değildir.

## Genel Veri Kuralları

- Ana tablolar SQL Server uyumlu `BIGINT IDENTITY` veya `UNIQUEIDENTIFIER` anahtarlarla tasarlanabilir.
- Ticari belgelerde belge numarası, tarih, para birimi, kur snapshot'ı, durum ve audit alanları zorunlu düşünülmelidir.
- Tüm kritik tablolarda `created_at`, `created_by`, `updated_at`, `updated_by` alanları bulunmalıdır.
- Hareket görmüş ürün, müşteri, tedarikçi, fiş ve belge kayıtları fiziksel olarak silinmemelidir.
- Operasyonel silme yerine `is_active`, `is_deleted`, `passive_at`, `passive_reason` gibi pasif/soft delete alanları kullanılmalıdır.
- Kritik değişiklikler `audit_logs` üzerinden izlenmelidir.

## Entity / Table Yapıları

### users

**Amacı:** Web-admin ve terminal kullanıcılarını tutar.

**Kritik alanları:**

- `id`
- `username`
- `password_hash`
- `display_name`
- `role_id`
- `is_active`
- `last_login_at`
- `created_at`, `updated_at`

**İlişkileri:**

- `roles.id` ile ilişkilidir.
- `sales_invoices`, `purchase_invoices`, `audit_logs`, `terminal_sync_queue` kayıtlarında kullanıcı referansı olabilir.

**Dikkat edilmesi gereken kurallar:**

- Pasif kullanıcı yeni giriş yapamaz.
- Geçmiş işlem kayıtlarında kullanıcı referansı korunur.
- Kullanıcı silmek yerine pasif yapılmalıdır.

### roles

**Amacı:** Patron, muhasebe, admin gibi rol gruplarını tanımlar.

**Kritik alanları:**

- `id`
- `code`
- `name`
- `description`
- `is_system_role`
- `is_active`

**İlişkileri:**

- `users.role_id` ile kullanılır.
- `permissions` ile rol-yetki eşleşmesi kurar.

**Dikkat edilmesi gereken kurallar:**

- Sistem rolleri yanlışlıkla silinmemelidir.
- Rol değişikliği audit'e düşmelidir.

### permissions

**Amacı:** Ekran, işlem ve kritik aksiyon bazlı yetkileri tanımlar.

**Kritik alanları:**

- `id`
- `role_id`
- `permission_key`
- `can_view`
- `can_create`
- `can_update`
- `can_delete`
- `can_approve`

**İlişkileri:**

- `roles.id` ile ilişkilidir.
- Kritik işlem kontrollerinde `audit_logs` ile birlikte anlam kazanır.

**Dikkat edilmesi gereken kurallar:**

- Fiyat değiştirme, fiş iptal, stok düzeltme, kullanıcı/yetki düzenleme ayrı yetkiler olmalıdır.
- Yetki değişiklikleri audit'e düşmelidir.

### products

**Amacı:** Stok/ürün kartlarını tutar.

**Kritik alanları:**

- `id`
- `stock_code`
- `name`
- `category`
- `brand`
- `unit`
- `currency_code`
- `sales_price`
- `purchase_price`
- `average_cost_try`
- `current_stock_qty`
- `is_active`
- `passive_at`
- `passive_reason`

**İlişkileri:**

- `product_barcodes.product_id`
- `product_images.product_id`
- `stock_movements.product_id`
- `sales_invoice_items.product_id`
- `purchase_invoice_items.product_id`
- `catalog_items.product_id`

**Dikkat edilmesi gereken kurallar:**

- Hareket görmüş ürün silinmez, pasif yapılır.
- Pasif ürün yeni fişlerde seçilemez.
- Pasif ürün geçmiş fiş, rapor ve katalog geçmişinde görünmeye devam eder.
- Ürün kartının para birimi sabittir.

### product_barcodes

**Amacı:** Ürüne bağlı ana barkod ve ek barkodları tutar.

**Kritik alanları:**

- `id`
- `product_id`
- `barcode`
- `barcode_type`
- `is_primary`
- `is_active`

**İlişkileri:**

- `products.id` ile ilişkilidir.

**Dikkat edilmesi gereken kurallar:**

- Barkodlar terminalde, web-admin aramada ve katalog aramada çalışmalıdır.
- Aynı aktif barkod birden fazla ürüne bağlanmamalıdır.
- Barkod değişiklikleri audit'e düşmelidir.

### product_images

**Amacı:** Ürün görsellerini ve katalogda kullanılacak medya referanslarını tutar.

**Kritik alanları:**

- `id`
- `product_id`
- `file_path` veya `storage_key`
- `is_primary`
- `sort_order`
- `is_active`

**İlişkileri:**

- `products.id` ile ilişkilidir.
- `catalog_items` görsel seçiminde kullanılabilir.

**Dikkat edilmesi gereken kurallar:**

- Görsel dosyası ile ürün ilişkisi koparsa katalog uyarı vermelidir.
- Katalog için varsayılan görsel net seçilmelidir.

### suppliers

**Amacı:** Tedarikçi kartlarını tutar.

**Kritik alanları:**

- `id`
- `supplier_code`
- `name`
- `currency_code`
- `phone`
- `email`
- `address`
- `balance`
- `is_active`
- `passive_at`

**İlişkileri:**

- `purchase_invoices.supplier_id`
- `stock_movements.supplier_id`

**Dikkat edilmesi gereken kurallar:**

- Hareket görmüş tedarikçi silinmez, pasif yapılır.
- Pasif tedarikçi yeni alış fişinde seçilemez.
- Tedarikçi para birimi sabittir.

### customers

**Amacı:** Müşteri/cari kartlarını tutar.

**Kritik alanları:**

- `id`
- `customer_code`
- `name`
- `currency_code`
- `phone`
- `email`
- `address`
- `balance`
- `risk_limit`
- `is_active`
- `passive_at`

**İlişkileri:**

- `sales_invoices.customer_id`
- `catalogs.customer_id`

**Dikkat edilmesi gereken kurallar:**

- Hareket görmüş müşteri silinmez, pasif yapılır.
- Pasif müşteri yeni satış fişinde seçilemez.
- Cari kart para birimi sabittir.
- ERP tam muhasebe olmadığı için cari bakiye ticari takip amaçlıdır.

### stock_movements

**Amacı:** Stok artış/azalış hareketlerinin merkezi kayıt tablosudur.

**Kritik alanları:**

- `id`
- `product_id`
- `movement_type`
- `source_type`
- `source_id`
- `quantity_in`
- `quantity_out`
- `quantity_net`
- `unit_cost_try`
- `average_cost_try_after`
- `document_date`
- `created_at`

**İlişkileri:**

- `products.id`
- `sales_invoice_items.id`
- `purchase_invoice_items.id`
- Gerekirse `suppliers.id` veya `customers.id`

**Dikkat edilmesi gereken kurallar:**

- Satış fişi kesinleşince stok düşer.
- Alış fişi kesinleşince stok artar.
- Taslak fiş stok hareketi oluşturmaz.
- Terminal sync sırasında stok çakışması olsa bile kayıt kabul edilir; stok eksiye düşebilir.
- Stok sadece toplam stok olarak takip edilir; ilk fazda depo bazlı karmaşık envanter hedeflenmez.

### sales_invoices

**Amacı:** Satış fişi başlık kayıtlarını tutar.

**Kritik alanları:**

- `id`
- `invoice_no`
- `customer_id`
- `document_date`
- `status`
- `document_currency`
- `account_currency`
- `exchange_rate_snapshot`
- `subtotal`
- `discount_total`
- `grand_total`
- `source`
- `terminal_device_id`
- `finalized_at`
- `cancelled_at`
- `cancel_reason`

**İlişkileri:**

- `customers.id`
- `sales_invoice_items.sales_invoice_id`
- `terminal_devices.id`
- `stock_movements.source_id`
- `audit_logs.entity_id`

**Dikkat edilmesi gereken kurallar:**

- Durumlar en az `draft`, `finalized`, `cancelled` olmalıdır.
- Taslak satış fişi stok düşürmez, cari hareket oluşturmaz, kar/maliyet kaydı oluşturmaz.
- Ticari etki sadece fiş kesinleştiğinde oluşur.
- Kesinleşmiş satış fişi silinmez; iptal akışı audit ile yönetilir.

### sales_invoice_items

**Amacı:** Satış fişi ürün satırlarını tutar.

**Kritik alanları:**

- `id`
- `sales_invoice_id`
- `product_id`
- `stock_code_snapshot`
- `product_name_snapshot`
- `barcode_snapshot`
- `quantity`
- `unit_price`
- `line_total`
- `average_cost_try_snapshot`

**İlişkileri:**

- `sales_invoices.id`
- `products.id`
- `stock_movements.source_id`

**Dikkat edilmesi gereken kurallar:**

- Ürün adı, stok kodu ve barkod snapshot olarak saklanmalıdır.
- Satışta sadece fiş geneli iskonto ana kuraldır; satır iskontosu ilk karar setinde ana model değildir.
- Fiyat değişikliği yetkiye bağlı olmalı ve audit'e düşmelidir.

### purchase_invoices

**Amacı:** Alış fişi başlık kayıtlarını tutar.

**Kritik alanları:**

- `id`
- `invoice_no`
- `supplier_id`
- `document_date`
- `status`
- `document_currency`
- `account_currency`
- `exchange_rate_snapshot`
- `subtotal`
- `discount_total`
- `grand_total`
- `finalized_at`
- `cancelled_at`

**İlişkileri:**

- `suppliers.id`
- `purchase_invoice_items.purchase_invoice_id`
- `stock_movements.source_id`

**Dikkat edilmesi gereken kurallar:**

- Alış fişi web-admin'den girilir.
- Alış fişini muhasebe işler.
- Kesinleşince stok artar ve cari takip etkisi oluşur.
- Kesinleşmiş alış fişi silinmez.

### purchase_invoice_items

**Amacı:** Alış fişi ürün satırlarını tutar.

**Kritik alanları:**

- `id`
- `purchase_invoice_id`
- `product_id`
- `stock_code_snapshot`
- `product_name_snapshot`
- `quantity`
- `unit_price`
- `line_total`
- `unit_cost_try`

**İlişkileri:**

- `purchase_invoices.id`
- `products.id`
- `stock_movements.source_id`

**Dikkat edilmesi gereken kurallar:**

- Ortalama maliyet hesaplaması alış satırları üzerinden güncellenir.
- Alış fiyatı döviz/para birimine göre otomatik gelebilir, muhasebe değiştirebilir.
- Fiyat değişimi audit'e düşmelidir.

### currency_rates

**Amacı:** Döviz kurlarını ve işlem anı kur bilgisini destekler.

**Kritik alanları:**

- `id`
- `currency_code`
- `rate_to_try`
- `rate_date`
- `source`
- `created_at`

**İlişkileri:**

- Fişlerde doğrudan referans tutulabilir veya kur snapshot alanlarına değer basılır.

**Dikkat edilmesi gereken kurallar:**

- Ürün kartı para birimi sabittir.
- Cari kart para birimi sabittir.
- Fiş para birimi farklı olabilir.
- Fişte işlem anı kur snapshot'ı korunmalıdır.
- Geçmiş fişler sonradan değişen kurdan etkilenmemelidir.

### catalogs

**Amacı:** Genel veya müşteriye özel katalog başlıklarını tutar.

**Kritik alanları:**

- `id`
- `catalog_no`
- `name`
- `catalog_type`
- `customer_id`
- `language`
- `show_stock_mode`
- `show_price`
- `is_active`
- `public_token`
- `created_at`

**İlişkileri:**

- `customers.id`
- `catalog_items.catalog_id`

**Dikkat edilmesi gereken kurallar:**

- Genel katalog ve müşteriye özel katalog ayrılmalıdır.
- Müşteri adı özel katalog ekranında doğrudan görünmeyebilir; takip link/token üzerinden yapılabilir.
- Stok gösterimi katalog oluştururken seçilebilir.

### catalog_items

**Amacı:** Katalogda yer alan ürün satırlarını tutar.

**Kritik alanları:**

- `id`
- `catalog_id`
- `product_id`
- `product_image_id`
- `stock_code_snapshot`
- `product_name_snapshot`
- `price_snapshot`
- `sort_order`
- `is_active`

**İlişkileri:**

- `catalogs.id`
- `products.id`
- `product_images.id`

**Dikkat edilmesi gereken kurallar:**

- Katalog ürünü snapshot alanları tutmalıdır.
- Pasif ürün yeni kataloglara eklenmemelidir.
- Mevcut katalog geçmişi bozulmamalıdır.

### terminal_devices

**Amacı:** Android terminal cihazlarını ve cihaz durumlarını tutar.

**Kritik alanları:**

- `id`
- `device_code`
- `device_name`
- `assigned_user_id`
- `last_seen_at`
- `app_version`
- `is_active`
- `sync_status`

**İlişkileri:**

- `users.id`
- `terminal_sync_queue.terminal_device_id`
- `sales_invoices.terminal_device_id`

**Dikkat edilmesi gereken kurallar:**

- Terminal App ERP paneli değildir; sade operasyon cihazıdır.
- Her terminal cihazı tek kullanıcıyla açık kalabilir.
- Cihaz pasif yapılırsa sync kabul politikası ayrıca netleştirilmelidir.

### terminal_sync_queue

**Amacı:** Terminalden gelen offline/online işlem paketlerini ve sync durumunu tutar.

**Kritik alanları:**

- `id`
- `terminal_device_id`
- `user_id`
- `queue_type`
- `payload_json`
- `client_created_at`
- `server_received_at`
- `status`
- `retry_count`
- `error_code`
- `error_message`
- `processed_at`

**İlişkileri:**

- `terminal_devices.id`
- `users.id`
- İşlenen kayda göre `sales_invoices.id` veya başka hedef kayıt

**Dikkat edilmesi gereken kurallar:**

- Terminal internet yokken fiş oluşturabilir.
- Offline stok kontrolü bilgi amaçlıdır, satış akışını durdurmaz.
- İnternet gelince otomatik sync yapılır.
- Stok çakışması olsa bile kayıt kabul edilir.
- Hatalı sync dashboard'da uyarı olarak görünmelidir.
- Aynı offline kayıt iki kere işlenmemesi için idempotency anahtarı düşünülmelidir.

### audit_logs

**Amacı:** Kritik işlemleri izler.

**Kritik alanları:**

- `id`
- `user_id`
- `action`
- `entity_name`
- `entity_id`
- `old_values_json`
- `new_values_json`
- `reason`
- `ip_address`
- `terminal_device_id`
- `created_at`

**İlişkileri:**

- `users.id`
- Gerekirse `terminal_devices.id`
- Entity referansları polymorphic tutulabilir: `entity_name` + `entity_id`

**Dikkat edilmesi gereken kurallar:**

- Fiş oluşturma/iptal, fiyat değişikliği, stok düzeltme, import, kullanıcı/yetki değişikliği ve para birimi değişikliği audit'e düşmelidir.
- Audit log sadece admin tarafından görülebilmelidir.
- Audit log fiziksel olarak silinmemelidir.

## Çoklu Döviz Mantığı

Temel kararlar:

- Ürün kartının para birimi sabittir.
- Cari/müşteri/tedarikçi kartının para birimi sabittir.
- Fiş para birimi kart para biriminden farklı olabilir.
- Her fişte işlem anı kur snapshot'ı korunur.
- Raporlama için TRY karşılıkları ayrıca saklanabilir veya hesaplanabilir.

Önerilen alanlar:

- `document_currency`: Fişin para birimi.
- `account_currency`: Cari veya tedarikçi kartının para birimi.
- `exchange_rate_snapshot`: İşlem anındaki kur.
- `amount_try`: Raporlama için TRY karşılığı.
- `average_cost_try`: Ürün ortalama maliyeti.

Geçmiş belge tutarlılığı için sonradan değişen kur, eski fişleri etkilememelidir.

## Stock Movement Yapısı

Stok hareketleri satış, alış, düzeltme ve terminal sync gibi kaynaklardan oluşur. Her hareketin kaynağı açıkça izlenmelidir.

Önerilen kaynak tipleri:

- `sales_invoice`
- `purchase_invoice`
- `stock_adjustment`
- `terminal_sync`
- `manual_correction`

Temel kurallar:

- Kesinleşmiş satış fişi `quantity_out` üretir.
- Kesinleşmiş alış fişi `quantity_in` üretir.
- Taslak fiş hareket üretmez.
- İptal edilen fiş ters hareket veya iptal statüsüyle düzeltilir; fiziksel silme yapılmaz.
- Ürün güncel stok miktarı, hareketlerden hesaplanabilir veya performans için `products.current_stock_qty` üzerinde tutulabilir.

## Average Cost Mantığı

Ortalama maliyet TRY bazında tutulmalıdır: `products.average_cost_try`.

Basit yaklaşım:

- Alış fişi kesinleştiğinde ürünün mevcut stok miktarı ve mevcut ortalama maliyeti dikkate alınır.
- Yeni alış miktarı ve TRY maliyeti eklenerek yeni ağırlıklı ortalama maliyet hesaplanır.
- Satış fişi kesinleştiğinde satış satırına işlem anındaki `average_cost_try_snapshot` yazılır.
- Böylece geçmiş satış kar/maliyet raporu sonradan değişen ürün maliyetinden etkilenmez.

Eksi stok durumunda:

- Terminal sync stok eksiye düşürebilir.
- Eksi stok dashboard uyarısı üretir.
- Eksi stokta ortalama maliyet hesabı ayrıca dikkat ister; ilk fazda son bilinen ortalama maliyet snapshot olarak kullanılabilir.

## Audit Sistemi

Audit sistemi kritik işlem izleme katmanıdır, operasyonel veri yerine geçmez.

Audit'e düşmesi gereken işlemler:

- Fiş oluşturma, kesinleştirme, iptal
- Fiyat değişikliği
- Stok düzeltme
- Ürün, müşteri, tedarikçi pasifleştirme
- Import işlemleri
- Kullanıcı, rol ve yetki değişiklikleri
- Para birimi ve kur değişiklikleri
- Terminal sync hata/manuel müdahale işlemleri

Audit log kayıtlarında eski/yeni değer JSON olarak tutulabilir. SQL Server için JSON alanları `NVARCHAR(MAX)` olarak saklanabilir.

## Offline Terminal Sync Yapısı

Terminal uygulaması offline çalışabilir. Terminal, ürün/müşteri cache verisiyle satış fişi oluşturabilir ve işlem paketini `terminal_sync_queue` yapısına taşır.

Sync akışı:

1. Terminal offline fiş oluşturur.
2. Fiş terminal tarafında kuyruğa alınır.
3. İnternet gelince API'ye gönderilir.
4. API `terminal_sync_queue` kaydı oluşturur.
5. Paket doğrulanır.
6. Satış fişi oluşturulur veya güncellenir.
7. Fiş kesinleşirse stok hareketi oluşur.
8. Hata varsa kuyruk kaydı `failed` statüsünde kalır ve dashboard uyarısı üretir.

Kurallar:

- Offline olmak satış akışını durdurmaz.
- Stok çakışması kaydı reddetmek için tek başına sebep değildir.
- Aynı paket iki kez işlenmemelidir.
- Terminal kaynaklı fişlerde `source = terminal` ve `terminal_device_id` tutulmalıdır.

## Draft Invoice Mantığı

Taslak fişler ticari etki yaratmayan geçici belgelerdir.

Kurallar:

- `status = draft` fiş stok düşürmez/artırmaz.
- Taslak satış fişi cari hareket oluşturmaz.
- Taslak satış fişi kar/maliyet kaydı oluşturmaz.
- Kullanıcı daha sonra taslağı açıp kesinleştirebilir.
- Taslak fişler manuel silinebilir; kesinleşmiş fişler silinmez.
- Kaydedilmemiş değişiklik varsa otomatik taslak kaydetme düşünülebilir.

## Passive Record / Soft Delete Mantığı

ERP'de geçmişe etkisi olan kayıtlar fiziksel olarak silinmemelidir. Bunun yerine pasif veya soft delete yaklaşımı kullanılmalıdır.

Kullanılabilecek alanlar:

- `is_active`
- `is_deleted`
- `passive_at`
- `passive_by`
- `passive_reason`
- `deleted_at`
- `deleted_by`

Kural ayrımı:

- Hiç hareket görmemiş ve test/yanlış açılmış kayıtlar kontrollü silinebilir.
- Hareket görmüş ürün, müşteri, tedarikçi ve fişler silinmez.
- Pasif kayıtlar yeni fişlerde seçilemez.
- Pasif kayıtlar geçmiş rapor, fiş, ekstre ve audit ekranlarında görünmeye devam eder.

## Hareket Görmüş Kayıtların Silinmeme Nedeni

Hareket görmüş kayıtlar silinirse:

- Geçmiş fiş satırları anlamsız kalır.
- Stok hareket zinciri bozulur.
- Cari ekstre ve borç/alacak raporları tutarsızlaşır.
- Ortalama maliyet ve kar raporları yanlış çıkar.
- Audit ve kullanıcı sorumluluğu izlenemez.
- Terminal sync ile gelen eski kayıtlar eşleşemeyebilir.

Bu nedenle ERP v2'de hareket görmüş kayıtlar korunur; operasyonel kullanım için pasif yapılır.

## SQL Server Uyum Notları

- Para alanları için `DECIMAL(18, 4)` veya ihtiyaca göre daha yüksek hassasiyet kullanılmalıdır.
- Miktar alanları için `DECIMAL(18, 4)` düşünülmelidir.
- JSON payload ve audit eski/yeni değerleri için `NVARCHAR(MAX)` kullanılabilir.
- Kod ve belge numarası alanları için makul uzunluklar baştan belirlenmelidir.
- Tarihler için `DATETIME2` tercih edilmelidir.
- Kritik alanlara index düşünülmelidir: barkod, stok kodu, belge no, cari kodu, terminal queue status, audit entity.
