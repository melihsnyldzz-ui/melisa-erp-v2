# Melisa ERP v2 Backend API Architecture

## Amaç

Bu doküman Melisa ERP v2 için backend ve API mimarisini yüksek seviyede tanımlar. Amaç kod veya migration yazmak değil; API-first yaklaşımı, SQL Server uyumunu, terminal uygulamasıyla çalışma şeklini ve Vega veri entegrasyonuna uygun servis sınırlarını belirlemektir.

## Backend Yaklaşımı

### API-first yapı

Melisa ERP v2 backend tarafı API-first tasarlanacaktır. React web-admin, ileride Electron kabuğu ve Android terminal uygulaması aynı backend API üzerinden çalışmalıdır. UI davranışı frontend içinde yönetilir; ticari kurallar backend servislerinde merkezi olarak uygulanır.

API-first yaklaşım şu nedenlerle ana standarttır:

- Web-admin ve Electron aynı endpointleri kullanır.
- Terminal uygulaması online/offline sync akışını aynı API üzerinden yürütür.
- Rapor, audit, stok hareketi ve fiş kesinleştirme kuralları tek yerde uygulanır.
- Vega veya başka veri kaynaklarından aktarım yapılacaksa entegrasyon katmanı servis kurallarını bozmadan çalışır.

### SQL Server uyumu

Veri modeli SQL Server uyumlu düşünülmelidir. Transaction, `DECIMAL`, `DATETIME2`, index, unique constraint, JSON payload için `NVARCHAR(MAX)` ve belge numarası gibi alan uzunlukları SQL Server gerçeklerine göre tasarlanmalıdır.

Backend servisleri SQL Server transaction sınırlarını açık yönetmelidir. Özellikle fiş kesinleştirme, stok hareketi üretme, average cost hesaplama, cari bakiye etkisi ve audit log yazımı aynı tutarlı işlem bağlamında ele alınmalıdır.

### Electron frontend ile çalışma

Electron hedefinde frontend yerel kabuk içinde çalışsa bile backend API ayrı ve merkezi kalmalıdır. Electron yalnızca masaüstü kabuğu, yazdırma, cihaz entegrasyonu veya yerel yardımcı yetenekler sağlayabilir; ticari veri yazma kuralları backend API dışına taşınmamalıdır.

### Terminal app ile çalışma

Terminal uygulaması sade operasyon cihazıdır. Terminal; ürün/müşteri cache, satış fişi oluşturma, stok sayım, offline queue ve sync için API ile çalışır. Offline satış akışı durdurulmaz; internet geldiğinde sync kabul edilir.

### Vega veri entegrasyonuna uygunluk

ERP v2 doğrudan Vega kopyası değildir; ancak Vega benzeri yoğun ERP mantığı ve geçmiş veri aktarımı düşünülerek tasarlanmalıdır. Vega entegrasyonu veya import akışları servis katmanına saygılı olmalı, doğrudan tabloya kontrolsüz yazım yapmamalıdır.

## Ana Servis / Modül Yapısı

### auth service

**Amacı:** Kullanıcı girişini, oturum bilgisini ve token/oturum doğrulamasını yönetir.

**Temel endpoint grupları:**

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/refresh`

**İş kuralları:**

- Pasif kullanıcı giriş yapamaz.
- Kullanıcının rol ve yetki bilgisi oturum bağlamında erişilebilir olmalıdır.
- Terminal ve web-admin girişleri aynı kullanıcı modelini kullanabilir ama cihaz bağlamı ayrıca tutulmalıdır.

**İlişkili entity'ler:**

- `users`
- `roles`
- `permissions`
- `terminal_devices`
- `audit_logs`

### user/role/permission service

**Amacı:** Kullanıcı, rol ve yetki yönetimini sağlar.

**Temel endpoint grupları:**

- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PATCH /api/users/:id`
- `GET /api/roles`
- `GET /api/permissions/matrix`
- `PATCH /api/permissions/matrix`

**İş kuralları:**

- Rol değişikliği audit log'a yazılmalıdır.
- Kullanıcı silmek yerine pasif yapılmalıdır.
- Fiş iptal, fiyat değiştirme, stok düzeltme, import ve yetki değiştirme ayrı izinler olarak ele alınmalıdır.

**İlişkili entity'ler:**

- `users`
- `roles`
- `permissions`
- `audit_logs`

### product service

**Amacı:** Ürün/stok kartlarını yönetir.

**Temel endpoint grupları:**

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PATCH /api/products/:id`
- `POST /api/products/:id/passive`
- `GET /api/products/:id/movements`
- `GET /api/products/search`

**İş kuralları:**

- Hareket görmüş ürün fiziksel olarak silinmez, pasif yapılır.
- Pasif ürün yeni fişlerde seçilemez.
- Ürün para birimi sabittir.
- Ürün kartı değişiklikleri kritik alana göre audit'e düşebilir.

**İlişkili entity'ler:**

- `products`
- `product_barcodes`
- `product_images`
- `stock_movements`
- `sales_invoice_items`
- `purchase_invoice_items`
- `catalog_items`
- `audit_logs`

### barcode service

**Amacı:** Ürün ana barkodlarını ve ek barkodlarını yönetir.

**Temel endpoint grupları:**

- `GET /api/products/:productId/barcodes`
- `POST /api/products/:productId/barcodes`
- `PATCH /api/product-barcodes/:id`
- `POST /api/product-barcodes/:id/passive`
- `GET /api/barcodes/resolve`

**İş kuralları:**

- Aynı aktif barkod birden fazla ürüne bağlanmamalıdır.
- Barkod web-admin arama, terminal arama ve katalog eşleştirmede kullanılmalıdır.
- Barkod değişiklikleri audit'e yazılmalıdır.

**İlişkili entity'ler:**

- `product_barcodes`
- `products`
- `audit_logs`

### customer service

**Amacı:** Müşteri/cari kartlarını ve müşteri hareket görüntülemelerini yönetir.

**Temel endpoint grupları:**

- `GET /api/customers`
- `GET /api/customers/:id`
- `POST /api/customers`
- `PATCH /api/customers/:id`
- `POST /api/customers/:id/passive`
- `GET /api/customers/:id/statement`
- `GET /api/customers/:id/sales`

**İş kuralları:**

- Hareket görmüş müşteri silinmez, pasif yapılır.
- Pasif müşteri yeni satış fişinde seçilemez.
- Cari para birimi sabittir.
- Cari bakiye ticari takip amaçlıdır; sistem tam muhasebe programı değildir.

**İlişkili entity'ler:**

- `customers`
- `sales_invoices`
- `catalogs`
- `audit_logs`

### supplier service

**Amacı:** Tedarikçi kartlarını ve alış ilişkilerini yönetir.

**Temel endpoint grupları:**

- `GET /api/suppliers`
- `GET /api/suppliers/:id`
- `POST /api/suppliers`
- `PATCH /api/suppliers/:id`
- `POST /api/suppliers/:id/passive`
- `GET /api/suppliers/:id/purchases`
- `GET /api/suppliers/:id/performance`

**İş kuralları:**

- Hareket görmüş tedarikçi silinmez, pasif yapılır.
- Pasif tedarikçi yeni alış fişinde seçilemez.
- Tedarikçi para birimi sabittir.
- Alış fişindeki tedarikçi gerçek alış hareketi olarak kabul edilir.

**İlişkili entity'ler:**

- `suppliers`
- `purchase_invoices`
- `purchase_invoice_items`
- `stock_movements`
- `audit_logs`

### stock movement service

**Amacı:** Stok artış/azalış hareketlerini merkezi ve izlenebilir biçimde üretir.

**Temel endpoint grupları:**

- `GET /api/stock-movements`
- `GET /api/stock-movements/:id`
- `GET /api/products/:id/stock-movements`
- `POST /api/stock-adjustments`
- `GET /api/stock/negative`
- `GET /api/stock/summary`

**İş kuralları:**

- Stok hareketi doğrudan rastgele yazılmamalı; satış, alış, düzeltme veya terminal sync kaynağı olmalıdır.
- Satış fişi kesinleşince `quantity_out` hareketi oluşur.
- Alış fişi kesinleşince `quantity_in` hareketi oluşur.
- Taslak fiş stok hareketi üretmez.
- Eksi stok mümkündür ve dashboard uyarısı üretir.

**İlişkili entity'ler:**

- `stock_movements`
- `products`
- `sales_invoice_items`
- `purchase_invoice_items`
- `terminal_sync_queue`
- `audit_logs`

### sales invoice service

**Amacı:** Satış fişi taslak, kesinleştirme, iptal ve görüntüleme akışını yönetir.

**Temel endpoint grupları:**

- `GET /api/sales-invoices`
- `GET /api/sales-invoices/:id`
- `POST /api/sales-invoices`
- `PATCH /api/sales-invoices/:id`
- `POST /api/sales-invoices/:id/finalize`
- `POST /api/sales-invoices/:id/cancel`
- `GET /api/sales-invoices/drafts`
- `POST /api/sales-invoices/:id/print-preview`

**İş kuralları:**

- Satış fişi `draft`, `finalized`, `cancelled` gibi durumlarla yönetilmelidir.
- Draft fiş stok düşürmez, cari hareket oluşturmaz, kar/maliyet kaydı oluşturmaz.
- Kesinleşme transaction içinde yapılmalıdır.
- Kesinleşince stok düşer, average cost snapshot satıra yazılır, audit log oluşur.
- Kesinleşmiş fiş fiziksel olarak silinmez.
- Fiyat değişikliği ve iskonto yetkiye bağlı olmalıdır.

**İlişkili entity'ler:**

- `sales_invoices`
- `sales_invoice_items`
- `customers`
- `products`
- `stock_movements`
- `currency_rates`
- `terminal_devices`
- `audit_logs`

### purchase invoice service

**Amacı:** Alış fişi taslak, kesinleştirme, iptal ve görüntüleme akışını yönetir.

**Temel endpoint grupları:**

- `GET /api/purchase-invoices`
- `GET /api/purchase-invoices/:id`
- `POST /api/purchase-invoices`
- `PATCH /api/purchase-invoices/:id`
- `POST /api/purchase-invoices/:id/finalize`
- `POST /api/purchase-invoices/:id/cancel`
- `GET /api/purchase-invoices/drafts`

**İş kuralları:**

- Alış fişini muhasebe işler.
- Draft alış fişi stok artırmaz ve cari takip etkisi oluşturmaz.
- Kesinleşince stok artar.
- Kesinleşen alış satırları average cost hesaplamasını tetikler.
- Kesinleşmiş alış fişi fiziksel olarak silinmez.

**İlişkili entity'ler:**

- `purchase_invoices`
- `purchase_invoice_items`
- `suppliers`
- `products`
- `stock_movements`
- `currency_rates`
- `audit_logs`

### currency service

**Amacı:** Döviz kurlarını, kur snapshot mantığını ve para birimi hesaplamalarını destekler.

**Temel endpoint grupları:**

- `GET /api/currencies`
- `GET /api/currency-rates`
- `POST /api/currency-rates`
- `GET /api/currency-rates/latest`
- `POST /api/currency/convert-preview`

**İş kuralları:**

- Ürün ve cari kart para birimleri sabittir.
- Fiş para birimi farklı olabilir.
- Fiş kesinleşirken işlem anı kur snapshot'ı korunur.
- Geçmiş fişler sonradan değişen kurdan etkilenmez.
- Kur değişiklikleri audit'e düşmelidir.

**İlişkili entity'ler:**

- `currency_rates`
- `products`
- `customers`
- `suppliers`
- `sales_invoices`
- `purchase_invoices`
- `audit_logs`

### catalog service

**Amacı:** Genel ve müşteriye özel katalogları yönetir.

**Temel endpoint grupları:**

- `GET /api/catalogs`
- `GET /api/catalogs/:id`
- `POST /api/catalogs`
- `PATCH /api/catalogs/:id`
- `POST /api/catalogs/:id/items`
- `DELETE /api/catalogs/:id/items/:itemId`
- `GET /api/catalogs/:id/performance`
- `GET /api/public/catalogs/:token`

**İş kuralları:**

- Genel katalog ve müşteriye özel katalog ayrılmalıdır.
- Pasif ürün yeni kataloglara eklenmemelidir.
- Katalog item'ları ürün adı, fiyat ve görsel için snapshot alanları tutabilir.
- Stok gösterim modu katalog bazında belirlenmelidir.

**İlişkili entity'ler:**

- `catalogs`
- `catalog_items`
- `products`
- `product_images`
- `customers`
- `audit_logs`

### terminal sync service

**Amacı:** Terminal cihazlarından gelen offline/online operasyon paketlerini kabul eder ve işler.

**Temel endpoint grupları:**

- `POST /api/terminal/auth/login`
- `GET /api/terminal/bootstrap`
- `POST /api/terminal/sync`
- `GET /api/terminal/sync/:id`
- `GET /api/terminal/devices`
- `PATCH /api/terminal/devices/:id`
- `GET /api/terminal/sync-errors`

**İş kuralları:**

- Terminal offline satış fişi oluşturabilir.
- Offline stok kontrolü bilgi amaçlıdır.
- Sync sırasında stok çakışması olsa bile kayıt kabul edilir.
- Stok eksiye düşebilir.
- Aynı paket iki kere işlenmemelidir; idempotency anahtarı zorunlu düşünülmelidir.
- Hatalı sync dashboard uyarısı üretir.
- Terminal App karmaşık ERP paneli olmayacaktır.

**İlişkili entity'ler:**

- `terminal_devices`
- `terminal_sync_queue`
- `users`
- `products`
- `customers`
- `sales_invoices`
- `stock_movements`
- `audit_logs`

### audit service

**Amacı:** Kritik işlem kayıtlarını tutar ve admin için izlenebilir hale getirir.

**Temel endpoint grupları:**

- `GET /api/audit-logs`
- `GET /api/audit-logs/:id`
- `GET /api/audit-logs/entity/:entityName/:entityId`

**İş kuralları:**

- Audit log sadece admin tarafından görülebilmelidir.
- Fiş oluşturma/iptal, fiyat değişikliği, stok düzeltme, import, kullanıcı/yetki değişikliği, para birimi değişikliği ve terminal sync müdahaleleri audit'e düşmelidir.
- Audit log fiziksel olarak silinmemelidir.

**İlişkili entity'ler:**

- `audit_logs`
- `users`
- `terminal_devices`
- Tüm kritik ticari entity'ler

### report service

**Amacı:** Dashboard, ticari raporlar, stok raporları, cari raporları ve dışa aktarma akışlarını üretir.

**Temel endpoint grupları:**

- `GET /api/reports/dashboard`
- `GET /api/reports/sales-daily`
- `GET /api/reports/stock-value`
- `GET /api/reports/customer-balances`
- `GET /api/reports/purchase-movements`
- `GET /api/reports/supplier-performance`
- `POST /api/reports/export`

**İş kuralları:**

- Raporlar filtre, pagination, sorting ve export desteklemelidir.
- Dashboard 30 saniyede bir yenilenebilecek şekilde hafif endpointler kullanmalıdır.
- Stok değeri average cost ve güncel stok miktarına göre hesaplanmalıdır.
- Eksi stok ve hatalı terminal sync dashboard uyarılarına dahil edilmelidir.

**İlişkili entity'ler:**

- `products`
- `stock_movements`
- `sales_invoices`
- `purchase_invoices`
- `customers`
- `suppliers`
- `terminal_sync_queue`
- `catalogs`
- `audit_logs`

## Kritik İş Akışları

### Satış fişi kesinleşince stok düşmesi

Satış fişi finalize akışı transaction içinde çalışmalıdır:

1. Fiş `draft` veya uygun geçici durumdan okunur.
2. Yetki ve durum kontrolü yapılır.
3. Fiş satırları validate edilir.
4. Kur snapshot'ı ve belge toplamları sabitlenir.
5. Her satır için işlem anı `average_cost_try_snapshot` yazılır.
6. `stock_movements` üzerinde çıkış hareketleri oluşturulur.
7. Ürün güncel stok miktarı güncellenir veya hareketlerden hesaplanacak şekilde işaretlenir.
8. Fiş `finalized` yapılır.
9. Audit log yazılır.

Stok yetersizliği ilk kararlara göre terminal sync için reddetme sebebi değildir. Web-admin satışta uyarı verilebilir; eksi stok politikası merkezi ayardan yönetilebilir.

### Alış fişi kesinleşince stok artması

Alış fişi finalize akışı transaction içinde çalışmalıdır:

1. Fiş ve satırlar validate edilir.
2. Kur snapshot'ı sabitlenir.
3. Satırların TRY maliyeti hesaplanır.
4. Ürün average cost değeri güncellenir.
5. `stock_movements` üzerinde giriş hareketleri oluşturulur.
6. Ürün güncel stok miktarı artırılır.
7. Fiş `finalized` yapılır.
8. Audit log yazılır.

### Draft fişlerin ticari etki oluşturmaması

Draft satış veya alış fişi:

- Stok hareketi oluşturmaz.
- Cari hareket/bakiye etkisi oluşturmaz.
- Kar/maliyet kaydı oluşturmaz.
- Raporlarda ticari kesinleşmiş belge gibi sayılmaz.
- Kullanıcı tarafından daha sonra kesinleştirilebilir veya manuel silinebilir.

### Çoklu döviz snapshot mantığı

Fiş oluşturma veya kesinleştirme anında:

- `document_currency`
- `account_currency`
- `exchange_rate_snapshot`
- TRY karşılıkları

alanları sabitlenmelidir. Sonradan kur değişmesi geçmiş fişleri değiştirmemelidir.

### Average cost hesaplama

Average cost ağırlıklı ortalama mantığıyla alış kesinleştiğinde güncellenmelidir. Satış kesinleşirken o anki average cost satış satırına snapshot olarak yazılır. Böylece geçmiş satış kar/maliyet raporu sonradan değişen maliyetten etkilenmez.

Eksi stok durumunda ilk faz için son bilinen average cost snapshot olarak kullanılabilir; eksi stok maliyet politikası rapor notlarında görünür olmalıdır.

### Audit log yazımı

Audit log şu noktalarda yazılmalıdır:

- Başarılı kritik işlem sonunda.
- Transaction içindeki ticari değişiklikle tutarlı olacak şekilde.
- Eski/yeni değer veya özet payload ile.
- Kullanıcı, terminal cihazı ve IP bilgisi mümkünse eklenerek.

Audit yazılamıyorsa kritik transaction'ın davranışı fail-closed olmalıdır; yani fiş iptal, stok düzeltme veya yetki değişikliği audit olmadan sessizce tamamlanmamalıdır.

### Terminal offline sync kabul mantığı

Terminal sync endpointi paketleri kabul ederken:

- Cihaz ve kullanıcı doğrulanır.
- Idempotency anahtarı kontrol edilir.
- Payload schema validate edilir.
- Ürün/cari eşleştirmeleri yapılır.
- Stok çakışması olsa bile paket reddedilmez.
- İşlenebilen paket satış fişine ve stok hareketine dönüşür.
- İşlenemeyen paket `failed` kalır ve dashboard uyarısı üretir.

### Eksi stok uyarı mantığı

Eksi stok, operasyonu durdurmak yerine izlenebilir uyarı üretir.

Kaynaklar:

- Terminal offline sync.
- Web-admin satış kesinleştirme.
- Manuel stok düzeltme.

Uyarı ekranları:

- Dashboard kritik uyarılar.
- Stok listesi filtreleri.
- Rapor servisi stok uyarıları.

## API Standartları

### Response format

Başarılı tek kayıt:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Başarılı liste:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 0
  },
  "meta": {}
}
```

### Error format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "İşlem tamamlanamadı.",
    "details": []
  },
  "meta": {
    "requestId": "..."
  }
}
```

Hata kodları kısa, sabit ve frontend tarafından güvenilir şekilde eşlenebilir olmalıdır.

### Pagination

Liste endpointleri varsayılan pagination desteklemelidir:

- `page`
- `pageSize`
- `total`
- `hasNext`

Büyük tablolarda server-side pagination veya cursor yaklaşımı değerlendirilebilir.

### Filtering

Filtreler query parametreleriyle taşınabilir:

- `search`
- `status`
- `dateFrom`
- `dateTo`
- `customerId`
- `supplierId`
- `productId`
- `isActive`

Yoğun ERP listelerinde kolon bazlı filtreler backend tarafından desteklenmelidir.

### Sorting

Sıralama standart parametrelerle yapılmalıdır:

- `sortBy`
- `sortDir`

İzin verilen kolonlar backend tarafından whitelist edilmelidir. Kullanıcıdan gelen ham kolon adı doğrudan SQL'e taşınmamalıdır.

### Idempotency

Idempotency özellikle terminal sync, fiş kesinleştirme ve dış sistem import akışlarında gereklidir.

Kurallar:

- Terminal paketleri benzersiz `client_request_id` veya benzeri anahtar taşımalıdır.
- Aynı paket ikinci kez gelirse yeni ticari kayıt oluşturulmamalıdır.
- Finalize endpointlerinde tekrar çağrı aynı sonucu döndürmeli veya güvenli hata üretmelidir.
- Idempotency kayıtları transaction ile tutarlı yazılmalıdır.

### Transaction kullanımı

Transaction gerektiren işlemler:

- Satış fişi kesinleştirme.
- Alış fişi kesinleştirme.
- Fiş iptal.
- Stok düzeltme.
- Terminal sync paketini satış fişine dönüştürme.
- Average cost güncelleme.
- Kullanıcı/rol/yetki kritik değişiklikleri.

Transaction içinde birlikte ele alınacak parçalar:

- Belge durumu.
- Belge satırları.
- Stok hareketleri.
- Ürün stok/average cost güncellemeleri.
- Kur snapshot bilgisi.
- Audit log.

## Güvenlik ve Yetki Notları

- Her endpoint auth bağlamı ile çalışmalıdır.
- Yetki kontrolü servis katmanında yapılmalıdır.
- Admin endpointleri sadece admin rolüne açık olmalıdır.
- Terminal endpointleri cihaz + kullanıcı bağlamı ile doğrulanmalıdır.
- Kritik işlemler için ayrıca işlem yetkisi aranmalıdır.

## Vega Entegrasyon Notları

Vega veri entegrasyonu için ayrı import/adapter katmanı düşünülmelidir. Bu katman:

- Kaynak veriyi normalize eder.
- ERP v2 entity kurallarına göre validate eder.
- Servisleri bypass ederek doğrudan kontrolsüz tablo yazımı yapmaz.
- Import sonuçlarını audit veya import log mantığıyla izlenebilir kılar.

İlk fazda Vega ile canlı çift yönlü muhasebe entegrasyonu hedeflenmez; ERP v2 kendi ticari takip veri modelini korur.
