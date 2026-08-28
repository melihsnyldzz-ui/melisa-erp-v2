# Melisa ERP v2 Auth, Permission ve Audit Architecture

## Amaç

Bu doküman Melisa ERP v2 için kullanıcı, rol, yetki, session ve audit güvenlik mimarisini tanımlar. Amaç kod yazmak değil; web-admin, Android terminal ve ileride Electron kabuğu için ortak güvenlik kurallarını netleştirmektir.

Ana kararlar:

- Her kullanıcı kendi kullanıcı adı/şifresiyle giriş yapar.
- Yetki kullanıcı/rol bazlı yönetilir.
- Kritik işlemler onay popup'ı ve audit log ile izlenir.
- Kritik işlemde tekrar şifre veya PIN istenmez.
- Audit log sadece admin tarafından görüntülenebilir.
- Terminal cihazları cihaz + kullanıcı bağlamıyla çalışır.

## Kullanıcı Tipleri

### Patron / yönetici

**Amacı:** İşletmenin genel durumunu, satış performansını, stok değerini, müşteri/tedarikçi borçlarını ve kritik uyarıları izler.

**Tipik yetkiler:**

- Dashboard ve raporları görme.
- Stok, satış, alış ve cari listelerini izleme.
- Kritik uyarıları görme.
- Katalog performansını izleme.

**Sınırlar:**

- Günlük operasyon kayıtlarını değiştirme yetkisi ayrı verilebilir.
- Kullanıcı/yetki değişikliği varsayılan olarak admin işidir.

### Patron / kardeş

**Amacı:** Patron benzeri izleme ve operasyonel kontrol yapar; yetki seviyesi işletme kararına göre patron/yönetici ile aynı veya biraz sınırlı olabilir.

**Tipik yetkiler:**

- Dashboard görme.
- Stok, satış, cari ve katalog ekranlarını izleme.
- Bazı raporlara erişme.
- Onay gerektiren işlemleri görme.

**Sınırlar:**

- Fiyat değiştirme, fiş iptal, stok düzeltme gibi kritik aksiyonlar ayrıca yetkilendirilmelidir.

### Muhasebe

**Amacı:** Satış/alış fişleri, cari hareketler, tahsilat/ödeme, rapor ve dışa aktarma operasyonlarını yürütür.

**Tipik yetkiler:**

- Satış fişi oluşturma ve izleme.
- Alış fişi oluşturma ve izleme.
- Cari kart ve ekstre ekranlarını kullanma.
- Rapor dışa aktarma.
- Yetkisi varsa fiyat/iskonto düzenleme.

**Sınırlar:**

- Kullanıcı/yetki yönetimi yapmaz.
- Stok düzeltme ve fiş iptal gibi kritik işlemler ayrı yetkiye bağlıdır.

### Admin

**Amacı:** Sistem, kullanıcı, rol, yetki, audit, terminal cihazları ve kritik ayarları yönetir.

**Tipik yetkiler:**

- Kullanıcı/rol/yetki yönetimi.
- Audit log görüntüleme.
- Terminal cihaz yönetimi.
- Firma, döviz, yazdırma ve sistem ayarları.
- Kritik işlem yetkilerini düzenleme.

**Sınırlar:**

- Admin rolü güçlüdür; tüm admin işlemleri audit'e düşmelidir.

### Terminal kullanıcısı

**Amacı:** Android terminal üzerinde depo/saha operasyonu yapar.

**Tipik yetkiler:**

- Ürün ve müşteri arama.
- Satış fişi oluşturma.
- Yetkisi varsa terminalde fiyat değiştirme.
- Stok sayım veya terminal operasyonları.
- Offline queue ve sync.

**Sınırlar:**

- Terminal App ERP paneli değildir.
- Web-admin kullanımı varsayılan değildir.
- Aynı cihazda farklı kullanıcılar farklı yetkilere sahip olabilir.

## Rol ve Yetki Mantığı

### Role-based access control

Melisa ERP v2 role-based access control kullanır. Roller genel yetki paketlerini belirler; kullanıcıya atanan rol, ekran ve işlem erişimini kontrol eder.

Temel roller:

- `owner_manager`
- `owner_partner`
- `accounting`
- `admin`
- `terminal_user`

Yetki modeli rol bazlı başlar, fakat kullanıcı bazlı override ihtiyacı doğarsa Faz 2'de değerlendirilebilir.

### Ekran bazlı yetki

Ekran bazlı yetki, bir kullanıcının menü ve ekranları görüp göremeyeceğini belirler.

Örnek permission key'leri:

- `dashboard.view`
- `products.view`
- `products.edit`
- `sales_invoices.view`
- `sales_invoices.create`
- `purchase_invoices.create`
- `customers.view`
- `reports.view`
- `terminal.manage`
- `audit.view`
- `settings.manage`

Ekran bazlı yetki frontend menüyü sadeleştirmek için kullanılabilir; ancak güvenlik kontrolü backend servis katmanında da yapılmalıdır.

### İşlem bazlı yetki

İşlem bazlı yetki, ekran içinde kritik aksiyonları kontrol eder.

Kritik işlem yetkileri:

- `price.change`
- `discount.apply`
- `invoice.cancel`
- `stock.adjust`
- `product.passive`
- `product.delete_empty`
- `customer.passive`
- `supplier.passive`
- `currency.change`
- `import.run`
- `permissions.manage`

### Fiyat değiştirme yetkisi

Satış fiyatı ürün kartından otomatik gelir. Yetkili kullanıcı fiyatı değiştirebilir. Terminalde de fiyat değiştirilebilir ama yetkiye bağlıdır.

Kurallar:

- Fiyat değişikliği audit'e düşer.
- Değişen eski fiyat, yeni fiyat, ürün, kullanıcı, fiş ve cihaz bilgisi kaydedilir.
- Yetkisiz kullanıcı fiyat alanını değiştirememelidir.

### İskonto yetkisi

Satışta sadece fiş geneli yüzde iskonto ana kuraldır. İskonto yetkiye bağlıdır.

Kurallar:

- İskonto oranı audit'e düşebilir.
- Yetkisiz kullanıcı iskonto alanını değiştirememelidir.
- Tutar bazlı satış iskontosu ilk karar setinde kullanılmaz.

### Fiş iptal yetkisi

Fiş iptal yetkisi yetki ayarından seçilebilir olmalıdır.

Kurallar:

- Kesinleşmiş fiş fiziksel olarak silinmez.
- İptal işlemi onay popup'ı gerektirir.
- İptal nedeni alınmalıdır.
- Audit log zorunludur.
- Stok ve ticari etki ters hareket veya iptal statüsüyle tutarlı şekilde yönetilmelidir.

### Stok düzeltme yetkisi

Stok düzeltme kritik işlemdir.

Kurallar:

- Sadece yetkili kullanıcı yapabilir.
- Düzeltme nedeni alınmalıdır.
- Eski miktar, yeni miktar, fark, ürün ve kullanıcı audit'e yazılır.
- Düzeltme stok hareketi üretmelidir.

### Ürün silme / pasif yapma yetkisi

Hareket görmüş ürün silinmez, sadece pasif yapılır.

Kurallar:

- Pasif ürün yeni fişlerde seçilemez.
- Pasif ürün geçmiş rapor ve fişlerde görünmeye devam eder.
- Ürün pasifleştirme audit'e düşer.
- Hiç hareket görmemiş yanlış/test ürün için fiziksel silme ayrı ve sınırlı yetki olabilir.

## Session Mimarisi

### Web admin session

Web-admin kullanıcı adı/şifre ile giriş yapar. Başarılı giriş sonrası access token ve refresh token mantığı kullanılabilir.

Kurallar:

- Session kullanıcı, rol ve yetki özetini taşır.
- Yerel sunucu kurulumunda başarılı parola girişinden sonra refresh token bu cihazda saklanır ve oturum 365 güne kadar sessizce yenilenir; kullanıcı `Çıkış` yaptığında refresh token sunucuda iptal edilir ve cihazdaki tokenlar temizlenir.
- Yetki değişirse kullanıcının session'ı yenilenmeli veya yeniden doğrulanmalıdır.
- Pasif kullanıcı yeni token alamaz.
- Kritik işlemde ayrıca tekrar şifre/PIN istenmez; mevcut session ve yetki kontrolü kullanılır.

### Terminal session

Terminal session cihaz + kullanıcı bağlamıyla çalışır.

Kurallar:

- Terminal cihazı kayıtlı olmalıdır.
- Kullanıcı terminalde giriş yapar.
- Device token cihazı, auth token kullanıcıyı doğrular.
- Her sync event'i kullanıcı ve cihaz bilgisiyle ilişkilendirilir.
- Her terminal cihazı tek kullanıcıyla açık kalabilir; aynı cihazda farklı kullanıcılar farklı yetkiyle giriş yapabilir.

### Token expiry

Access token kısa/orta süreli olmalıdır. Refresh token daha uzun süreli olabilir.

Öneri:

- Web-admin access token: kısa süreli.
- Web-admin refresh token: kullanıcı oturumunu sürdürür.
- Terminal access token: offline senaryoyu bozmayacak şekilde dikkatli tasarlanır.
- Terminal token expire olursa local queue silinmez.

### Refresh token mantığı

Refresh token yeni access token almak için kullanılır.

Kurallar:

- Refresh token iptal edilebilir olmalıdır.
- Kullanıcı pasif yapılırsa refresh token geçersiz sayılmalıdır.
- Yetki değişikliklerinde token claim'leri yenilenmelidir.
- Refresh token kullanımı audit veya security log seviyesinde izlenebilir.

### Cihaz bazlı terminal login

Uygulanan terminal başlangıç akışı:

1. Yetkili yönetici ERP'de kullanıcı adı, görünen ad, rol ve ilk şifre ile kullanıcıyı oluşturur.
2. Kullanıcı Personel Tanımları ekranında aktif personele bağlanır ve terminal satışı açılır.
3. Kayıtlı ve aktif terminal cihazı uygun kullanıcıların güvenli listesini alır.
4. Operatör kullanıcıyı seçip şifresini girer; backend hem kullanıcı şifresini hem terminal uygunluğunu doğrular.
5. Şifre değişikliğinde kullanıcının mevcut refresh tokenları iptal edilir.

Terminal istemcisinde şifresiz admin girişi yoktur. Kullanıcı listesi parola, parola hash'i veya token içermez.

Terminal login iki parçalıdır:

- Kullanıcı auth token.
- Cihaz device token.

Backend her terminal isteğinde bu iki bağlamı birlikte kontrol eder. Cihaz pasifse sync kabul politikası backend tarafından belirlenir; kritik durumda sync reddedilir veya manuel incelemeye alınır.

## Audit Log Kuralları

Audit log kritik işlemlerin izlenebilirliğini sağlar. Audit operasyonel verinin yerine geçmez; kimin, ne zaman, hangi işlemle hangi değeri değiştirdiğini gösterir.

Audit kaydında önerilen alanlar:

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

### Fiyat değişikliği

Kaydedilecek bilgiler:

- Ürün.
- Fiş.
- Eski fiyat.
- Yeni fiyat.
- Para birimi.
- Kullanıcı.
- Terminal cihazı varsa cihaz.

### Fiş oluşturma / iptal

Kaydedilecek bilgiler:

- Fiş no.
- Fiş tipi.
- Fiş durumu.
- Kullanıcı.
- Kaynak: web-admin veya terminal.
- İptal nedeni.
- Etkilenen stok hareketleri.

### Stok düzeltme

Kaydedilecek bilgiler:

- Ürün.
- Eski stok.
- Yeni stok.
- Fark miktarı.
- Düzeltme nedeni.
- Kullanıcı.

### Para birimi değişikliği

Kaydedilecek bilgiler:

- Entity türü: ürün, cari, tedarikçi, fiş veya kur.
- Eski para birimi/kur.
- Yeni para birimi/kur.
- Kullanıcı.
- Değişiklik nedeni.

### Kullanıcı / yetki değişikliği

Kaydedilecek bilgiler:

- Değişen kullanıcı veya rol.
- Eski yetki seti.
- Yeni yetki seti.
- İşlemi yapan admin.
- Zaman.

### Import işlemleri

Kaydedilecek bilgiler:

- Import tipi.
- Dosya/kaynak özeti.
- Oluşturulan/güncellenen kayıt sayısı.
- Hata sayısı.
- İşlemi yapan kullanıcı.

### Terminal sync hataları

Kaydedilecek bilgiler:

- Cihaz.
- Kullanıcı.
- Event id.
- Event tipi.
- Hata kodu.
- Retry sayısı.
- Manuel müdahale varsa müdahaleyi yapan kullanıcı.

## Kritik İşlem Onayı Mantığı

Kritik işlemler onay popup'ı ile yapılır.

Kritik işlemler:

- Fiş iptal.
- Stok düzeltme.
- Fiyat değiştirme.
- İskonto uygulama.
- Ürün/müşteri/tedarikçi pasifleştirme.
- Para birimi değişikliği.
- Kullanıcı/yetki değişikliği.
- Import çalıştırma.

### Onay popup

Popup şunları göstermelidir:

- İşlemin adı.
- Etkilenecek kayıt.
- Kritik sonuç.
- Gerekirse neden/açıklama alanı.
- Onay ve vazgeç butonları.

### Tekrar şifre / PIN istememe

Karar defterine göre kritik işlemde tekrar şifre veya PIN istenmeyecektir. Güvenlik mevcut session, yetki kontrolü, onay popup'ı ve audit zorunluluğu ile sağlanır.

### Audit'e zorunlu kayıt

Kritik işlem audit yazmadan sessizce tamamlanmamalıdır. Audit yazımı başarısızsa işlem fail-closed davranmalıdır.

## Yetki Matrisi

| Yetki / Ekran / İşlem | Patron / yönetici | Patron / kardeş | Muhasebe | Admin | Terminal kullanıcısı |
| --- | --- | --- | --- | --- | --- |
| Dashboard görme | Evet | Evet | Evet | Evet | Hayır |
| Patron dashboard | Evet | Evet | Hayır | Evet | Hayır |
| Muhasebe dashboard | Opsiyonel | Opsiyonel | Evet | Evet | Hayır |
| Stok listesi görme | Evet | Evet | Evet | Evet | Terminal cache |
| Ürün kartı oluşturma | Hayır | Opsiyonel | Evet | Evet | Hayır |
| Ürün kartı düzenleme | Hayır | Opsiyonel | Evet | Evet | Hayır |
| Ürün pasif yapma | Hayır | Hayır | Opsiyonel | Evet | Hayır |
| Ürün fiziksel silme, hareket yoksa | Hayır | Hayır | Hayır | Evet | Hayır |
| Barkod ekleme/düzenleme | Hayır | Opsiyonel | Evet | Evet | Hayır |
| Satış fişi görme | Evet | Evet | Evet | Evet | Kendi fişleri |
| Satış fişi oluşturma | Opsiyonel | Opsiyonel | Evet | Evet | Evet |
| Satış fiyatı değiştirme | Opsiyonel | Opsiyonel | Opsiyonel | Evet | Opsiyonel |
| Satış iskonto uygulama | Opsiyonel | Opsiyonel | Opsiyonel | Evet | Opsiyonel |
| Satış fişi iptal | Hayır | Hayır | Opsiyonel | Evet | Hayır |
| Alış fişi görme | Evet | Opsiyonel | Evet | Evet | Hayır |
| Alış fişi oluşturma | Hayır | Hayır | Evet | Evet | Hayır |
| Alış fiyatı değiştirme | Hayır | Hayır | Evet | Evet | Hayır |
| Cari listesi görme | Evet | Evet | Evet | Evet | Terminal cache |
| Müşteri kartı oluşturma | Hayır | Opsiyonel | Evet | Evet | Hayır |
| Tedarikçi kartı oluşturma | Hayır | Hayır | Evet | Evet | Hayır |
| Cari pasif yapma | Hayır | Hayır | Opsiyonel | Evet | Hayır |
| Stok düzeltme | Hayır | Hayır | Opsiyonel | Evet | Hayır |
| Rapor görme | Evet | Evet | Evet | Evet | Hayır |
| Rapor dışa aktarma | Evet | Opsiyonel | Evet | Evet | Hayır |
| Katalog oluşturma | Opsiyonel | Opsiyonel | Evet | Evet | Hayır |
| Katalog performansı görme | Evet | Evet | Evet | Evet | Hayır |
| Terminal cihaz yönetimi | Hayır | Hayır | Opsiyonel | Evet | Hayır |
| Terminal sync hatası görme | Evet | Opsiyonel | Evet | Evet | Hayır |
| Kullanıcı yönetimi | Hayır | Hayır | Hayır | Evet | Hayır |
| Rol/yetki matrisi yönetimi | Hayır | Hayır | Hayır | Evet | Hayır |
| Audit log görme | Hayır | Hayır | Hayır | Evet | Hayır |
| Import çalıştırma | Hayır | Hayır | Opsiyonel | Evet | Hayır |
| Sistem ayarları | Hayır | Hayır | Hayır | Evet | Hayır |

Not: `Opsiyonel` alanlar işletme kararına göre rol bazında açılıp kapatılmalıdır. Varsayılan güvenli yaklaşım, kritik yazma işlemlerini admin veya açıkça yetkilendirilmiş muhasebe kullanıcısıyla sınırlamaktır.

## Güvenlik Anti-patternleri

- Frontend menü gizlemeyi gerçek güvenlik sanmak.
- Backend servis katmanında yetki kontrolü yapmamak.
- Kritik işlemleri audit log olmadan tamamlamak.
- Hareket görmüş kayıtları fiziksel silmek.
- Terminal cihaz token'ı olmadan sadece kullanıcı token'ı ile sync kabul etmek.
- Aynı terminal sync event'ini iki kez ticari kayda çevirmek.
- Yetki değişikliklerini audit'e yazmamak.
- Admin dışı kullanıcıya audit log ekranını açmak.
- Fiyat/iskonto değişikliğini sıradan alan değişikliği gibi görmek.
- Fiş iptalini silme işlemi gibi yapmak.
- Refresh token'ı kullanıcı pasif olduğunda geçerli bırakmak.
- Token içine hassas veri koymak.
- Kullanıcının rolünü yalnızca frontend state'ine güvenerek belirlemek.
- Kritik işlem onayında uzun teknik metinlerle kullanıcıyı körleştirmek.

## Faz 1 Güvenlik Kapsamı

Faz 1 için önerilen kapsam:

1. Web-admin login/session.
2. Terminal login + device token.
3. Temel roller: patron/yönetici, patron/kardeş, muhasebe, admin, terminal kullanıcısı.
4. Ekran bazlı yetki kontrolü.
5. Kritik işlem bazlı yetki kontrolü.
6. Fiyat değiştirme, iskonto, fiş iptal, stok düzeltme yetkileri.
7. Onay popup standardı.
8. Audit log yazımı.
9. Admin audit log görüntüleme.
10. Terminal sync güvenlik kontrolleri.
