# WhatsApp'sız ticaret kalite kontrolleri

Bu paket ERP'nin mevcut kaynak kopyası üstündeki izole inceleme dalıdır. Ana dal,
çalışan ERP ve f639 güvenlik varyantıyla birleşmiş sürüm olarak kabul edilmez.

Kök dizinde `npm ci --ignore-scripts` kalite araçlarını kurar. Uygulama
bağımlılıkları kendi kilit dosyalarıyla ayrıca kurulmalıdır. Hiçbir gerçek ortam
dosyası veya kimlik bilgisi test alanına kopyalanmamalıdır.

| Komut | Kapsam |
|---|---|
| `npm run lint` | API, web, gömülü terminal ve desktop kaynak doğruluğu; mesajlaşma yolları hariç |
| `npm run typecheck` | Dört uygulama için checkJs; bütün hatalar bitmeden başarısız çıkar |
| `npm run typecheck -- api` | API kaynakları ve test dosyaları |
| `npm run typecheck -- desktop` | Electron kaynakları |
| `npm run typecheck -- web-admin` | Web kaynakları |
| `npm run typecheck -- terminal-app` | Gömülü terminal kaynakları |
| `npm run test:commerce` | Açık listelenmiş 47 ağsız API davranış testi |

Typecheck bağımlılık bildirimlerini `skipLibCheck` ile dışarıda tutar; uygulama
JavaScript dosyalarında `allowJs`, `checkJs`, `noEmit` kullanır. Eski JavaScript
kodu henüz strict TypeScript dönüşümü olarak sunulmaz. Kaynak kökleri ve hatalar
`QUALITY_REPORT_DIR` verilirse JSON olarak yazılır. İçe aktarılan mesajlaşma
dosyalarının tanıları kapsam dışı tutulur ve adetleri ayrıca raporlanır.

React Native tipleri için `preserveSymlinks` kullanılır; bu, mevcut bağımlılıkları
izole alana bağlarken React tiplerinin asıl çalışma ağacında yanlış çözülmesini
önler. `.wav` bildirimi Metro'nun sayısal asset sözleşmesini tanımlar.

Test runner yalnız incelenmiş sekiz API test dosyasını çalıştırır. Çocuk test
süreçlerine ticari ortam değişkenleri verilmez. TCP/TLS/UDP, fetch ve alt süreç
çağrıları reddedilir; SQL veya mesaj gönderim testi bulunmaz. Görsel temizleme
testi yalnız kendi geçici dosyasını oluşturup temizler. Bu kontrol gerçek SQL
transaction, ticari UAT, Android cihaz veya canlı Product Brain kabulü değildir.

2026-09-08 doğrulaması: API ve desktop typecheck PASS; 47/47 test PASS; lint PASS;
web build PASS. Web ve gömülü terminal typecheck hataları açık olduğundan genel
typecheck henüz FAIL'dir. Desktop paket/cihaz kabulü bu sonuçtan çıkarılamaz.

Değişiklikler mevcut hata metadata alanlarını, import önizleme alanlarını,
Shipping HTTP istek seçeneklerini, görsel eşleştirme seçeneklerini ve satış
kanıtı metriklerini tip düzeyinde tanımlar. Tarih sıralaması açık `getTime()`
kullanır; satış kanıtının tarih doğrulaması string daraltmasını açık yapar.
Ticari kurallar, HTTP route adları, auth/izin kararları ve veri yazma kapıları
değiştirilmez. Production deploy ve merge ayrıca kullanıcı onayı gerektirir.
