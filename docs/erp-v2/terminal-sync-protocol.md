# Melisa ERP v2 Terminal Sync Protocol

## Amaç

Bu doküman Melisa ERP v2 Android terminal sistemi için offline çalışma ve sync protokolünü tanımlar. Terminal uygulaması karmaşık ERP paneli olmayacak; ürün/müşteri arama, satış fişi oluşturma, stok sayım, offline queue ve sync işlemlerini sade ve güvenilir şekilde yapacaktır.

Ana kararlar:

- Terminal internet yokken satışa devam edecektir.
- Offline stok sadece bilgi amaçlı olacaktır.
- Offline olmak satış akışını durdurmayacaktır.
- Sync sırasında stok çakışsa bile kayıt kabul edilecektir.
- Stok eksiye düşebilir.
- Eksi stok ve hatalı sync web-admin dashboard üzerinde uyarı üretecektir.

## Terminal Çalışma Mantığı

### Offline-first yaklaşım

Terminal uygulaması ağ bağlantısına bağımlı olmadan temel satış operasyonunu sürdürebilmelidir. Online durum varsa API ile anlık doğrulama ve güncelleme yapılır; internet yoksa terminal local cache ve pending queue ile çalışır.

Offline-first kuralları:

- Ürün ve müşteri arama local cache üzerinden yapılabilir.
- Satış fişi offline oluşturulabilir.
- Offline stok miktarı kullanıcıya bilgi verir ama satışı engellemez.
- İşlem local queue içine yazılır.
- İnternet gelince queue otomatik sync edilir.

### Local cache yapısı

Terminal local cache, sadece terminal operasyonu için gereken minimum veriyi tutar.

Cache kapsamı:

- Aktif ürünler.
- Ürün barkodları.
- Ürün satış fiyatı ve para birimi.
- Ürün son bilinen stok miktarı.
- Aktif müşteriler.
- Müşteri cari kodu, adı ve para birimi.
- Terminal kullanıcısının yetki bilgisi.
- Son sync timestamp bilgileri.

Pasif ürün ve pasif müşteri varsayılan olarak yeni işlemde seçilmemelidir. Geçmiş offline queue kayıtları için gerekli snapshot alanları ayrıca queue payload içinde tutulmalıdır.

### Queue mantığı

Terminalde oluşturulan her offline veya sync bekleyen işlem local pending queue içine yazılır. Queue kaydı API'ye başarılı şekilde işlenene kadar terminalde tutulur.

Queue kaydı en az şu bilgileri taşımalıdır:

- `client_event_id`
- `device_id`
- `user_id`
- `event_type`
- `payload`
- `client_created_at`
- `status`
- `retry_count`
- `last_attempt_at`
- `next_retry_at`
- `last_error_code`
- `last_error_message`

### Sync lifecycle

Sync yaşam döngüsü:

1. Terminal cihazı açılır.
2. Auth token geçerliliği kontrol edilir.
3. Cihaz API'ye `device_ping` gönderir.
4. Bootstrap veya delta cache güncellemesi alınır.
5. Pending queue taranır.
6. Uygun kayıtlar API'ye gönderilir.
7. API idempotency kontrolü yapar.
8. API kayıtları işler ve sonucu döner.
9. Terminal başarılı kaydı `synced` işaretler.
10. Hatalı kayıt retry veya failed durumuna alınır.

## Local Product Cache

**Amacı:** Terminalin barkod ve ürün aramayı internet yokken sürdürebilmesini sağlar.

**İçerik:**

- `product_id`
- `stock_code`
- `name`
- `barcodes`
- `currency_code`
- `sales_price`
- `last_known_stock_qty`
- `is_active`
- `updated_at`

**Kurallar:**

- Sadece aktif ürünler yeni satışta seçilebilir.
- Barkod eşleştirme local cache üzerinden hızlı yapılmalıdır.
- Stok miktarı bilgi amaçlıdır; satış bloklamaz.
- Cache delta sync ile güncellenebilir.
- Ürün seçildiğinde satış fişi satırına ürün adı, stok kodu, barkod ve fiyat snapshot olarak yazılmalıdır.

## Local Customer Cache

**Amacı:** Terminalin müşteri seçimini ve satış fişi müşteri bağlamını offline sürdürebilmesini sağlar.

**İçerik:**

- `customer_id`
- `customer_code`
- `name`
- `currency_code`
- `balance_summary`
- `is_active`
- `updated_at`

**Kurallar:**

- Pasif müşteri yeni fişte seçilmemelidir.
- Müşteri bakiyesi offline ortamda kesin veri olarak değil, son bilinen özet olarak gösterilir.
- Müşteri seçilemezse terminal misafir/genel müşteri politikası ayrıca backend ayarıyla belirlenmelidir.

## Offline Invoice Creation

**Amacı:** Terminalde internet olmadan satış fişi oluşturulmasını sağlar.

**Offline fiş payload alanları:**

- `client_invoice_id`
- `device_id`
- `user_id`
- `customer_id`
- `customer_snapshot`
- `document_currency`
- `client_created_at`
- `items`
- `totals`
- `price_change_flags`
- `discount`

**Satır snapshot alanları:**

- `product_id`
- `stock_code_snapshot`
- `product_name_snapshot`
- `barcode_snapshot`
- `quantity`
- `unit_price`
- `currency_code`
- `line_total`

**Kurallar:**

- Offline fiş terminalde oluşturulur ve local queue'ya alınır.
- Offline fiş ticari olarak server tarafından işlendiğinde kesinleşmiş satış fişine dönüşür.
- Stok yetersizliği offline fişi engellemez.
- Fiyat değişikliği yetkiye bağlıdır; terminal payload içinde işaretlenir ve backend audit'e yazar.

## Pending Sync Queue

**Amacı:** Server'a gönderilmemiş veya sonucu kesinleşmemiş eventleri saklar.

**Queue statüleri:**

- `pending`
- `syncing`
- `synced`
- `retry_wait`
- `failed`
- `blocked_auth`

**Kurallar:**

- Queue FIFO çalışabilir, ancak auth/device eventleri öncelikli olabilir.
- Aynı event aynı anda iki kez gönderilmemelidir.
- Uygulama kapanıp açılsa bile queue kaybolmamalıdır.
- Kullanıcı queue durumunu sade şekilde görebilmelidir.

## Retry System

Retry sistemi geçici hata ile kalıcı hata ayrımı yapmalıdır.

Retry yapılacak durumlar:

- İnternet yok.
- Timeout.
- 5xx server hatası.
- Geçici SQL/API yoğunluğu.
- Server tarafından `RETRYABLE_ERROR` dönen durumlar.

Retry yapılmayacak durumlar:

- Geçersiz payload.
- Yetkisiz kullanıcı.
- Pasif cihaz.
- Bozuk event schema.
- Idempotency conflict ve farklı payload çakışması.

## Retry / Backoff Mantığı

Önerilen backoff:

| Deneme | Bekleme |
| ---: | --- |
| 1 | 10 saniye |
| 2 | 30 saniye |
| 3 | 1 dakika |
| 4 | 5 dakika |
| 5 | 15 dakika |
| 6+ | 30 dakika veya manuel müdahale |

Kurallar:

- Retry sırasında queue kaydı silinmez.
- Başarısız deneme `retry_count` ve `last_error` alanlarını günceller.
- Uzun süre başarısız kalan kayıt `failed` veya `manual_review` durumuna alınabilir.
- Kullanıcıya teknik hata detayı yerine sade durum gösterilir.

## Failed Sync Handling

**Amacı:** İşlenemeyen sync paketlerinin kaybolmadan izlenmesini sağlar.

Failed durumuna düşebilecek örnekler:

- Payload schema hatası.
- Ürün eşleştirme yapılamaması.
- Müşteri eşleştirme yapılamaması.
- Cihaz pasif.
- Kullanıcı yetkisiz.
- Aynı `client_event_id` ile farklı payload gelmesi.
- Server transaction hatası kalıcı hale gelmesi.

Kurallar:

- Failed kayıt terminalde saklanır.
- Failed kayıt server tarafında `terminal_sync_queue` içinde görünür olmalıdır.
- Web-admin dashboard hatalı terminal sync uyarısı üretir.
- Admin/muhasebe failed kaydı inceleyebilmelidir.
- Manuel düzeltme gerekiyorsa audit log oluşmalıdır.

## Duplicate Prevention

Duplicate prevention için her event benzersiz client id taşımalıdır.

Önerilen anahtarlar:

- `client_event_id`
- `client_invoice_id`
- `device_id`
- `event_type`
- `client_created_at`

Backend idempotency davranışı:

- Aynı `client_event_id` aynı payload ile gelirse önceki başarılı sonuç dönülür.
- Aynı `client_event_id` farklı payload ile gelirse `DUPLICATE_EVENT_CONFLICT` hatası döner.
- Aynı offline fiş iki kez satış fişi oluşturmamalıdır.
- Retry yeni ticari belge üretmemelidir.

## Sync Status Tracking

Terminal ve backend sync durumunu birlikte takip etmelidir.

Terminalde gösterilecek durumlar:

- Online.
- Offline.
- Sync bekliyor.
- Sync devam ediyor.
- Sync tamamlandı.
- Hatalı kayıt var.
- Oturum süresi doldu.

Backendde izlenecek alanlar:

- `terminal_devices.last_seen_at`
- `terminal_devices.last_sync_at`
- `terminal_devices.sync_status`
- `terminal_sync_queue.status`
- `terminal_sync_queue.retry_count`
- `terminal_sync_queue.error_code`

## Sync Event Tipleri

### invoice_created

Terminalde yeni satış fişi oluşturulduğunu bildirir.

Beklenen davranış:

- Backend satış fişi oluşturur.
- Fiş terminal kaynaklı olarak işaretlenir.
- Stok hareketi oluşturulur.
- Gerekirse eksi stok oluşur.
- Audit log yazılır.

### invoice_updated

Terminalde henüz sync edilmemiş veya server tarafından izin verilen bir fişin güncellendiğini bildirir.

Beklenen davranış:

- Sadece uygun durumdaki fişlerde kabul edilir.
- Kesinleşmiş ve server'da işlenmiş fişler terminalden sessizce değiştirilemez.
- Güncelleme audit'e düşmelidir.

### stock_count

Terminalden stok sayım bilgisi gönderir.

Beklenen davranış:

- İlk fazda bilgi/rapor amaçlı veya kontrollü stok düzeltme önerisi olarak ele alınabilir.
- Doğrudan stok düzeltme yapacaksa admin/muhasebe onayı gerekebilir.
- Audit log zorunludur.

### device_ping

Cihazın online olduğunu ve temel durumunu bildirir.

Beklenen davranış:

- `last_seen_at` güncellenir.
- App version, user, battery/network gibi yardımcı durumlar saklanabilir.
- Device offline duration hesaplamasına veri sağlar.

### sync_retry

Terminalin daha önce başarısız olan bir event'i tekrar gönderdiğini belirtir.

Beklenen davranış:

- Idempotency kontrolü yapılır.
- Retry sayısı güncellenir.
- Başarılı olursa kayıt `synced` olur.

### sync_failed

Terminal tarafında kalıcı veya kullanıcı müdahalesi gerektiren hata oluştuğunu bildirir.

Beklenen davranış:

- Backend failed kaydı oluşturur veya mevcut kaydı günceller.
- Dashboard uyarısı üretir.
- Admin/muhasebe incelemesine açılır.

## Terminal Cihaz Mantığı

### Device registration

Cihaz ilk kurulumda backend'e kaydedilmelidir.

Kayıt bilgileri:

- `device_code`
- `device_name`
- `hardware_id` veya güvenli cihaz imzası
- `assigned_user_id`
- `app_version`
- `registered_at`

Admin cihazı aktif/pasif yapabilmelidir.

### Device token

Terminal cihazına kullanıcı auth token'ından ayrı bir device token verilebilir.

Kurallar:

- Device token cihaz kimliğini doğrular.
- Auth token kullanıcı oturumunu doğrular.
- İkisi birlikte terminal sync güvenliği sağlar.
- Cihaz pasifse sync kabul politikası backend tarafından uygulanır.

### Active device tracking

Backend aktif cihazları takip eder.

Takip alanları:

- Son görülme zamanı.
- Son sync zamanı.
- Son başarılı sync event id.
- Bekleyen queue sayısı.
- Failed queue sayısı.
- App version.
- Aktif kullanıcı.

### Last sync timestamp

Terminal her başarılı sync sonrası son sync timestamp bilgisini günceller.

Kullanım:

- Delta product/customer cache almak.
- Dashboard üzerinde cihaz sağlık durumunu göstermek.
- Offline kalma süresini hesaplamak.

### Device offline duration

Offline süre `last_seen_at` veya `last_successful_ping_at` üzerinden hesaplanır.

Örnek uyarı seviyeleri:

- 0-15 dakika: normal.
- 15-60 dakika: dikkat.
- 1-4 saat: uyarı.
- 4+ saat: kritik / cihaz offline.

## Sync Güvenlik Mantığı

### Auth token

Terminal kullanıcı oturumu auth token ile doğrulanır.

Kurallar:

- Token süresi dolarsa terminal yeni sync gönderemez.
- Local queue silinmez.
- Kullanıcı tekrar giriş yapınca queue devam eder.

### Expired session

Oturum süresi dolduğunda:

- Yeni event oluşturma cihaz politikasına göre engellenebilir veya local queue'ya alınabilir.
- Sync denemeleri `blocked_auth` durumuna alınır.
- Kullanıcı login ekranına yönlendirilir.
- Başarılı login sonrası pending queue kaldığı yerden devam eder.

### Replay protection

Replay attack veya eski paketin tekrar oynatılmasını engellemek için:

- `client_event_id` zorunlu olmalıdır.
- Event timestamp kontrol edilmelidir.
- Device token doğrulanmalıdır.
- Çok eski eventler manuel incelemeye alınabilir.

### Duplicate request handling

Duplicate request handling idempotency ile yapılır.

Kurallar:

- Aynı event aynı sonucu döndürür.
- Aynı event farklı payload ile conflict üretir.
- Conflict durumunda terminal kaydı failed/manual review olur.

## Hatalı Sync Senaryoları

| Senaryo | Beklenen davranış |
| --- | --- |
| İnternet yok | Queue pending kalır, retry bekler |
| Timeout | Retry backoff başlar |
| Auth token süresi doldu | Queue silinmez, `blocked_auth` olur |
| Device token geçersiz | Sync reddedilir, admin uyarısı oluşur |
| Cihaz pasif | Sync reddedilir veya manuel incelemeye alınır |
| Ürün bulunamadı | Failed/manual review |
| Müşteri bulunamadı | Failed/manual review veya genel müşteri politikası |
| Stok yetersiz | Kayıt kabul edilir, eksi stok uyarısı oluşur |
| Aynı event tekrar geldi | Önceki sonuç döner |
| Aynı id farklı payload geldi | Duplicate conflict, failed/manual review |
| Server transaction hatası | Retry yapılır veya failed olur |
| Payload bozuk | Retry yapılmaz, failed olur |
| Fiyat değiştirme yetkisi yok | Failed veya fiyat değişikliği reddi; audit gerekir |

## Server Sync İşleme Sırası

Backend terminal event alırken şu sırayı izlemelidir:

1. Request auth token kontrolü.
2. Device token kontrolü.
3. Device aktiflik kontrolü.
4. Payload schema validation.
5. Idempotency kontrolü.
6. Event type routing.
7. Transaction başlatma.
8. Ticari kayıt oluşturma/güncelleme.
9. Stok hareketi ve eksi stok kontrolü.
10. Audit log yazımı.
11. Queue durumunu güncelleme.
12. Response dönme.

## Response Standartları

Başarılı sync:

```json
{
  "success": true,
  "server_sync_id": "123",
  "client_event_id": "device-001-event-0001",
  "status": "synced",
  "warnings": []
}
```

Uyarılı başarılı sync:

```json
{
  "success": true,
  "server_sync_id": "124",
  "client_event_id": "device-001-event-0002",
  "status": "synced",
  "warnings": [
    {
      "code": "NEGATIVE_STOCK_CREATED",
      "message": "Stok eksiye düştü, dashboard uyarısı oluşturuldu."
    }
  ]
}
```

Hatalı sync:

```json
{
  "success": false,
  "client_event_id": "device-001-event-0003",
  "status": "failed",
  "error": {
    "code": "INVALID_PAYLOAD",
    "message": "Sync paketi işlenemedi."
  }
}
```

## Dashboard Warning Üretimi

Dashboard uyarısı üretilecek durumlar:

- Eksi stok oluşması.
- Hatalı terminal sync.
- Uzun süre offline kalan cihaz.
- Aynı event id ile conflict oluşması.
- Terminal app version eski kalması.
- Çok sayıda retry bekleyen kayıt olması.

Uyarılar patron, muhasebe ve admin dashboard'larında role göre görünmelidir.

## Faz 1 Sync Kapsamı

Faz 1 için önerilen kapsam:

1. Device registration.
2. Terminal login.
3. Product/customer bootstrap cache.
4. Offline sales invoice creation.
5. Pending queue.
6. `invoice_created` sync.
7. Idempotency kontrolü.
8. Retry/backoff.
9. Failed sync dashboard uyarısı.
10. Device ping ve last sync tracking.

`invoice_updated`, `stock_count` ve gelişmiş manuel düzeltme akışları Faz 2'ye bırakılabilir.
