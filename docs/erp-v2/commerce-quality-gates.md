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
| `npm run test:web-commerce` | Proforma 115, satış listesi 61, stok sayımı 40 kontrolü ve iki muhasebe yükleme testi; ağ ve alt süreç engelli |

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

2026-09-08 ilk doğrulamasında web 235 ve gömülü terminal 115 tip hatası vardı.
Takip paketinde web, API, desktop ve gömülü terminal kaynakları sıfır tanıya
indirildi. Terminal App.js giriş dosyası da kalite kapsamına eklendi.
Katalog Gönder ekranı ve yalnız bu akışa ait catalogService dosyası adları
WhatsApp içermemesine rağmen mesajlaşma kapsamı olduğu için hariçtir.
Ortak dosyalardaki mevcut gönderim işlevleri değiştirilmez veya çalıştırılmaz.

Web build ve lint PASS. Proforma 115/115, satış listesi 61/61, stok sayımı
40/40 ve muhasebe yükleme davranışı 2/2 PASS. Bu sonuçlar SQL işlem kabulü,
Android cihaz kullanımı veya gerçek ticari veri doğrulaması değildir.

Web formları, proforma ve baskı alanları açık tiplerle tanımlandı. Rapor
tipleri API'nin gerçek dönüş tiplerinden türetilir; yalnız derleme zamanında
kullanılır, tarayıcıya sunucu kodu eklemez. Formların boş/sayısal metin değerleri
korunur. Kullanılmayan bileşen parametreleri kaldırıldı. Eksik muhasebe yanıtında
son fatura listeleri artık ekranı çökertmez. Terminal ürün aramasının Enter
işleyicisi klavye olayı yerine mevcut arama metnini kullanır. Titreşim kapalı kalır.

Stok sayımı kontrolü tarihsel P12-STOCK-ADJUST-PERMISSION konusunu bildirmeye
devam eder: mimaride stock.adjust bulunurken mevcut route product.edit kullanır.
Bu paket izin politikasını değiştirmedi; ticari kabulden önce uzlaştırılmalıdır.

Değişiklikler mevcut hata metadata alanlarını, import önizleme alanlarını,
Shipping HTTP istek seçeneklerini, görsel eşleştirme seçeneklerini ve satış
kanıtı metriklerini tip düzeyinde tanımlar. Tarih sıralaması açık `getTime()`
kullanır; satış kanıtının tarih doğrulaması string daraltmasını açık yapar.
Ticari kurallar, HTTP route adları, auth/izin kararları ve veri yazma kapıları
değiştirilmez. Production deploy ve merge ayrıca kullanıcı onayı gerektirir.
