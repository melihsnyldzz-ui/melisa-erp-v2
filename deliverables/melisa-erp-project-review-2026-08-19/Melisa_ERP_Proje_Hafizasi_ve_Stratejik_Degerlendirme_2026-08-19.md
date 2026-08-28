# MELİSA ERP v2
## Proje Hafızası, Şirket Verisi Özeti ve Stratejik Değerlendirme Dosyası

**Rapor tarihi:** 19 Ağustos 2026  
**Kapsanan dönem:** Mayıs 2026 – 19 Ağustos 2026  
**Amaç:** Bu dosya, Melisa ERP projesini başka bir yapay zekâya, danışmana veya yöneticiye eksiksiz aktarabilmek için hazırlanmış tekil proje hafızasıdır.  
**Gizlilik:** Şifre, token, API anahtarı ve SQL parolası içermez. Şirket içi ve ticari açıdan hassas bilgiler içerir; kurum dışına kontrolsüz verilmemelidir.

---

## 0. Bu dosya nasıl okunmalı?

Bu raporda dört doğruluk etiketi kullanılır:

- **[CANLI DOĞRULANDI]**: 19 Ağustos 2026 tarihinde çalışan servis, endpoint veya mevcut veri üzerinden kontrol edildi.
- **[KODDA / BELGEDE VAR]**: Kaynak kodda, test paketinde veya proje dokümantasyonunda bulundu; her saha senaryosu canlı kullanıcı tarafından tamamlanmış sayılmaz.
- **[TARİHLİ VERİ ANLIK GÖRÜNTÜSÜ]**: Şirket veritabanından daha önce güvenli, salt okunur sorguyla elde edilmiş sayısal bulgu; tarih ilerledikçe değişir.
- **[PLAN / HEDEF]**: Konuşuldu, tasarlandı veya yol haritasına alındı; tamamlanmış özellik gibi yorumlanmamalıdır.

Bu ayrım kritik önemdedir. Projenin ERP Core bölümü güçlü bir test ve kabul zincirinden geçmiş olsa da üretim ortamı hazırlığı, yedek geri dönüş kanıtı, temiz sürümleme ve bazı saha doğrulamaları hâlâ açıktır.

---

# 1. Yönetici Özeti

Melisa ERP v2, başlangıçta stok, cari, satış, alış ve finans süreçlerini tek yerde toplamak için geliştirilen yerel bir ERP iken; proje ilerledikçe şu bütünleşik yapıya dönüştü:

1. **Web tabanlı ERP yönetim merkezi**
2. **SQL Server tabanlı operasyonel veri katmanı**
3. **Vega ERP’ye salt okunur canlı bağlantı ve karşılaştırmalı raporlama**
4. **Android/Expo el terminali ve yerel cihaz iş akışı**
5. **Electron tabanlı Windows masaüstü kabuğu**
6. **Evolution API + Chatwoot tabanlı WhatsApp CRM**
7. **Stok fotoğrafı, OCR, katalog ve ürün eşleme iş akışları**
8. **Yönetim raporları, satış karşılaştırmaları ve büyüme planları**

Proje sadece ekran geliştirme olmaktan çıkmış; veri bütünlüğü, yetki, denetim izi, taslak/kesin belge ayrımı, döviz, mobil saha kullanımı, WhatsApp satış hunisi ve dış ERP verisini güvenli okuma gibi gerçek şirket süreçlerini kapsayan bir işletim sistemi yaklaşımına evrilmiştir.

### Bugünkü genel durum

- **ERP Core:** İşlevsel olarak final test aşamasını geçmiş, insan kabulünde “uyarılarla kabul” edilmiş durumda. **Üretime tam hazır kabul edilmemeli.**
- **Web ERP:** [CANLI DOĞRULANDI] `5173` portunda çalışıyor.
- **ERP API:** [CANLI DOĞRULANDI] `4100` portunda sağlık kontrolü başarılı.
- **WhatsApp CRM API:** [CANLI DOĞRULANDI] `4200` portunda çalışıyor; gönderim açık ve canlı gönderim onaylı.
- **Chatwoot:** [CANLI DOĞRULANDI] `3100` portunda çalışıyor.
- **Evolution:** [CANLI DOĞRULANDI] `8080` ve ikinci yönetim/köprü yüzeyi `8081` üzerinde çalışıyor.
- **Vega bağlantısı:** [KODDA / BELGEDE VAR] Sadece salt okunur ve 2026 dönemi odaklı tasarlandı; stok, cari, tedarikçi, hareket ve belge uçları bulunuyor.
- **Çalışma ağacı:** Çok sayıda değişiklik commit edilmemiş durumda. Bu, projenin şu anki en büyük teknik ve operasyonel risklerinden biridir.

### Stratejik sonuç

Şirket, reklamsız ve kapıdan giren müşteri modeliyle 2026 baz projeksiyonunda yaklaşık **3,86 milyon USD eşdeğer yıllık ciro** kapasitesine yakın görünmektedir. Doğru stok disiplini, tahsilat kontrolü, WhatsApp-first satış, ülke/personel atama, katalog hızlandırma, web/Instagram/Lead Finder ve dağıtıcı modeli birlikte çalıştırılırsa **10 milyon USD hedefi matematiksel olarak mümkündür**, ancak bu hedef sadece yazılımla değil; çalışma sermayesi, stok devir hızı, tahsilat, satış kadrosu, ülke dağıtıcıları ve katkı marjı yönetimiyle gerçekleşir.

---

# 2. Şirket Vizyonu ve İş Kuralları

## 2.1 Ana vizyon

Melisa Baby’nin hedeflenen konumu:

> Canlı stoğu güçlü, çok markalı, hızlı hazırlık yapan, ihracata hazır, WhatsApp-first çalışan güvenilir bir B2B bebek ve çocuk giyim tedarikçisi.

Uzun vadede buna özel üretim/private label, ülke bazlı münhasırlık ve distribütörlük katmanı eklenebilir.

## 2.2 Değişmemesi gereken ilkeler

- ERP operasyonel gerçeğin tek merkezi olmalıdır.
- Vega’ya ilk ve mevcut aşamada **hiçbir veri yazılmamalıdır**.
- Taslak belge stok ve cari bakiyeyi etkilememelidir.
- Kesinleşmiş belge kontrollü stok/cari/finans etkisi üretmelidir.
- İptal ve ters kayıt iz bırakmalıdır; sessiz silme yapılmamalıdır.
- Döviz kuru işlem anındaki görüntüsüyle saklanmalıdır.
- Yapay zekâ varsayılan olarak salt okunur analiz yapmalıdır.
- Fiyat, stok, teslim süresi veya ürün özelliği uydurulmamalıdır.
- Kamuya açık katalog ve web alanlarında güvenli ürün alanları kullanılmalı; fiyatlar herkese açık yayınlanmamalıdır.
- Gerçek ürün fotoğrafı, sahte/üretken görsele tercih edilmelidir.
- Son ticari karar insanda kalmalıdır.

---

# 3. Projenin Kronolojik Hikâyesi

## 3.1 Mayıs 2026 – Temel ERP’nin kurulması

İlk aşamada mimari ve web kabuğu oluşturuldu. Ardından stok, ürün kartı, müşteri/tedarikçi, satış, alış, API ve SQL şeması geldi. Gerçek API bağlantıları, CRUD işlemleri, taslak/kesinleştirme, maliyet-kâr mantığı, yetkilendirme, içe aktarma ve görsel kabuk geliştirildi. Terminal temeli ve üretim hazırlığı dokümanları da bu dönemde başlatıldı.

Bu dönemin ana başarısı, birbirinden kopuk ekranlar yerine aynı veri ve iş kuralı omurgasını kullanan bir ERP çekirdeği oluşturmaktı.

## 3.2 Haziran 2026 – Operasyonel güven ve kullanılabilirlik

- Kimlik doğrulama ve kullanıcı erişimi sağlamlaştırıldı.
- Ürün/stok güvenilirliği, müşteri/tedarikçi hareketleri ve satış/alış ticari gerçeği ele alındı.
- Tahsilat, ödeme ve finans kayıtları geliştirildi.
- Yedekleme, geri yükleme ve sıfırlama işlemleri doğrudan çalıştırılmak yerine onay kapılarına bağlandı.
- İçe aktarma önizleme/uygulama ayrımı, operasyonel sağlık, görsel kararlılık, ürün medya akışı ve katalog hazırlığı geliştirildi.
- ERP ekranlarının rota, menü, taşma ve responsive kapsamı sistematik olarak test edildi.

## 3.3 Temmuz 2026 – Test zinciri, kabul, terminal ve CRM sınırı

ERP Core için 43 sprintlik stabilizasyon zinciri tamamlandı. Salt okunur test, kontrollü yazma testi, ekran denetimi, audit kapsamı, terminal senkronizasyonu, final test runbook’u, insan kabulü, üretim kapısı, yedek/geri dönüş planı ve final kapanış kararı dokümante edildi.

İnsan kabul kararı “uyarılarla kabul” olarak kaydedildi. Bu karar ERP Core’un final test için yeterli olduğunu; fakat gerçek üretim geçişi için host, ağ, çevre değişkeni, yedek/geri yükleme ve dağıtım kapılarının kapanması gerektiğini ifade eder.

Aynı dönemde WhatsApp CRM için önce güvenli sınır çizildi, daha sonra Evolution ve Chatwoot entegrasyonu, gelen kutusu, gönderim kontrolü, LID güvenliği ve canlı konuşma akışı geliştirildi.

## 3.4 Ağustos 2026 – Vega canlı veri, yoğun UX çalışması ve büyüme analizi

- Doğru çalışan proje klasörü ve servis sahipliği yeniden doğrulandı.
- Vega 2026 veritabanına salt okunur erişim üzerinden stok, cari, tedarikçi, hareket, satış ve belge analizleri yapıldı.
- Müşteri ve tedarikçi listeleri ERP’de ayrıldı.
- Cari hareket ve belge detayları ayrı pencere/popup mantığıyla geliştirildi.
- Satış sayfasına tüm stok çıkış fişleri, tarih filtresi ve Peşin TL/USD/EUR kısayolları eklendi/tasarlandı.
- Ürün fotoğrafı, OCR, marka-model eşleme ve stok kartına yerel fotoğraf ilişkilendirme akışı geliştirildi.
- ERP için sekiz UX sadeleştirme sprinti, CRM için sekiz dönüşüm sprinti yürütüldü.
- Terminal uygulaması Android Studio/emülatör/cihaz, giriş, IP ayarı, personel seçimi, klavye güvenliği, taslak kurtarma ve yazdırma senaryolarıyla olgunlaştırıldı.
- Şirket verileri üzerinden stok, satış, müşteri performansı, marka performansı ve 10 milyon USD büyüme hedefi analiz edildi.

---

# 4. Sistem Mimarisi

```text
KULLANICILAR
  ├─ Web ERP (React/Vite :5173)
  ├─ Android/Expo El Terminali
  ├─ Windows Electron Masaüstü
  └─ WhatsApp CRM / Chatwoot (:3100)
             │
             ▼
ERP API (Express :4100) ────────────── WhatsApp CRM API (:4200)
  │                                         │
  ├─ MELISA_ERP_V2 SQL Server               ├─ Chatwoot
  ├─ Audit / Yetki / İş Kuralları            ├─ Evolution API (:8080/:8081)
  ├─ Yerel ürün fotoğrafları                 └─ Personel eşleme / görev / teklif
  │
  └─ Vega 2026 salt okunur okuyucu
       ├─ F0102 / D0007: stok, müşteri, satış ve hareketler
       └─ F0103 / D0007: tedarikçiler ve hareketler
```

## 4.1 Teknoloji bileşenleri

| Katman | Teknoloji / görev | Durum |
|---|---|---|
| Web yönetim | React + Vite | [CANLI DOĞRULANDI] |
| ERP API | Node.js + Express | [CANLI DOĞRULANDI] |
| ERP veritabanı | SQL Server / MELISA_ERP_V2 | [KODDA / BELGEDE VAR] |
| Dış ERP kaynağı | Vega 2026, SELECT-only | [KODDA / BELGEDE VAR] |
| Terminal | Expo/React Native + Android native proje | [KODDA / BELGEDE VAR] |
| Masaüstü | Electron, Windows installer | [KODDA / BELGEDE VAR] |
| CRM | Özel CRM UI + CRM API + Chatwoot | [CANLI DOĞRULANDI] |
| WhatsApp sağlayıcı | Evolution API | [CANLI DOĞRULANDI] |
| Medya/OCR | PaddleOCR ve yerel eşleme | [KODDA / BELGEDE VAR] |
| Servis sürekliliği | Yerel supervisor/watchdog | [KODDA / BELGEDE VAR] |

---

# 5. Başardıklarımız: Modül Modül

## 5.1 ERP çekirdeği

- Kullanıcı girişi, rol ve izin altyapısı
- API güvenlik sınırları ve audit izi
- Stok/ürün, müşteri/tedarikçi, satış, alış ve finans modülleri
- Taslak, kesinleştirme, iptal ve ters kayıt mantığı
- Maliyet, kâr ve döviz görüntüsü
- İçe aktarma önizleme/uygulama kontrolü
- Rapor ve dashboard altyapısı
- Navigasyon ve çoklu sekme çalışma modeli

**Değerlendirme:** ERP Core güçlü bir işlevsel omurgaya sahiptir. Fakat “kabul edildi” ifadesi “üretim riskleri kapandı” anlamına gelmez.

## 5.2 Stok ve ürün kartları

### Ürün kartı deneyimi

- Temel ürün bilgileri, Stok 360 ve hareket alanları yeniden düzenlendi.
- Ürün görseli ve Stok 360 daha kompakt hale getirildi.
- Gereksiz para birimi uyarı bloğu kaldırıldı/sadeleştirildi.
- Kart açılış tarihi sistem tarafından oluşturulan, kullanıcının değiştiremediği alan olarak tasarlandı.
- Stok listesinde kart açılış tarihi ve tarih aralığı filtresi eklendi.
- En yeni açılan kartların üstte görünmesi hedeflendi.

### Veri kalitesi ve hızlı uyarı

- Stok kodu veya barkod yazılırken mevcut kayıt varsa anında kırmızı uyarı verilmesi tasarlandı/uygulandı.
- Toplu stok kartında satır içi mükerrerlik ve veritabanı çakışması kontrolü bulunuyor.
- Marka, kategori ve ana tedarikçi yazılabilir-seçilebilir arama alanına dönüştürüldü.
- Tedarikçi seçildiğinde kayıtlı para biriminin ürün para birimini varsayılan olarak belirlemesi kurgulandı.

### Toplu stok işlemleri

- Alış faturası benzeri satırlı toplu stok kartı ekranı
- 100 karta kadar toplu oluşturma, ön kontrol ve işlem bütünlüğü
- Açılış stoğu hareket/audit izi
- 500 karta kadar güvenli toplu güncelleme; önizleme ve onay
- Kritik alanların sessiz toplu değiştirilmesini engelleyen sınırlar

### Ürün fotoğrafı ve OCR

- Vega’yı etkilemeden, fotoğraflar MELISA_ERP_V2/yerel depoda tutulacak şekilde ürün kartına görsel bağlama
- Ortak klasöre her gün gelen ürün fotoğraflarını tarama
- OCR ile model kodu/marka metni okuma
- Vega stok kodu ve marka ile eşleme
- Emin olunmayan görselleri insan inceleme kuyruğuna alma
- Dry-run ve apply ayrımı
- Stok listesinde “görseli olan/olmayan” filtresi

**Açık kalite notu:** OCR akışı vardır ancak görsel kalitesi, logo biçimi ve model kodu yerleşimine göre eşleme hatası olabilir. İnsan onayı kaldırılmamalıdır.

## 5.3 Müşteriler ve tedarikçiler

- Üst menüde tek “Cari” yerine ayrı **Müşteriler** ve **Tedarikçiler** bölümü
- Vega müşterilerinin canlı, salt okunur listelenmesi
- Vega tedarikçilerinin F0103 üzerinden salt okunur listelenmesi
- Cari hareketleri, borç/alacak, yürüyen bakiye ve para birimi görünümü
- Belge numarasından stok çıkış/alış belgesi satırlarına geçiş
- Belgelerin ana ekranı bozmadan popup/ayrı pencere olarak açılması
- Müşteri ve tedarikçi ayrıntılı filtreleri

Örnek doğrulamalar:

- **KOLI / cari kodu 01:** USD cari; doğrulanmış bakiye yaklaşık **88.745,30 USD**.
- **PAKEL:** Tedarikçi hareketi ve alış faturası örneği üzerinden tedarikçi modülü doğrulandı.

## 5.4 Satış ve alış

- Satış ve alış fişlerinde ayrıntılı arama bölümü
- Tarih, durum, para birimi, tutar, personel ve terminal filtreleri
- Tüm Vega stok çıkış fişlerini cari gözetmeksizin satış ekranında tarih sırasıyla gösterme
- Peşin TL, Peşin USD, Peşin EUR hızlı filtreleri
- Kısayola basınca son bir haftayı otomatik gösterme
- Fiş başlık ve satır içeriğini aynı bağlamda açma
- Satış/alış girişinde ürün arama sonucunun diğer alanların arkasında kalması gibi z-index sorunlarının düzeltilmesi
- Satış fişinde indirim yetkisi/hata mesajlarının anlaşılır hale getirilmesi
- Alış ve toplu alış ekranlarının görev odaklı sadeleştirilmesi

## 5.5 Finans

- Tahsilat ve ödeme girişleri
- Müşteri/tedarikçi finans hareketleri
- Çoklu para birimi ve işlem anı kur görüntüsü
- Günlük kasa, operasyonel bakiye ve rapor altyapısı
- İptal/ters kayıt sınırları

**Önemli:** Muhasebe sağlığı ve operasyon sağlığı ayrı değerlendirilmelidir. Eski bir denetimde sistem operasyonel olarak “OK” görünürken muhasebe kontrolünde kırmızı riskler bulunmuştur. Yönetim dashboard’u bu iki gerçeği tek yeşil etikete indirgememelidir.

## 5.6 Raporlama ve karar desteği

- 2023–2026 yıllık satış karşılaştırması
- Ürün, marka ve müşteri performansı
- En çok satılan ürünler ve ilk markalar
- Ciro, adet ve belge sayısı karşılaştırmaları
- Stok değeri ve hareketsiz stok analizi
- Müşteri ödeme sıklığı, gecikme ve bakiye riski
- Yönetim dashboard’u ve dışa aktarma

Bu raporların değeri, şirketin “hangi ürün satıyor?” sorusundan “hangi müşteri, hangi marka, hangi hızla, hangi tahsilat kalitesiyle katkı sağlıyor?” sorusuna geçmesini sağlamasıdır.

## 5.7 El terminali

- Expo/React Native terminal uygulaması
- Android Studio native proje ve APK üretimi
- Emülatör ve fiziksel Android cihazda çalışma yaklaşımı
- Girişte ERP’de tanımlı personel seçimi ve personel şifresi
- Terminal seçme zorunluluğunun kaldırılması
- Bağlantı/IP ayarlarını ayrı Ayarlar bölümüne taşıma
- Klavye açıldığında giriş alanının görünür kalması
- Yerel veri önbelleği ve senkronizasyon kuyruğu
- Fiş çalışırken otomatik taslak saklama; çökme veya pil bitmesinde kurtarma
- Kaydetmeden çıkışta iki aşamalı yeşil/kırmızı onay
- Kesinleşmiş fişi ERP’nin kurulu olduğu bilgisayardaki yazıcıdan yazdırma mimarisi
- Melisa Baby logo/ikon/splash kullanımı
- Terminal ana sayfasını sadeleştirme ve ikincil araçları tek merkezde toplama
- CRM’nin terminalde personel tarafından kullanılabilmesi

## 5.8 Masaüstü ve yerel sunucu işletimi

- Electron masaüstü kabuğu
- Windows installer/exe paketleme
- Kurulumda değiştirilebilir sunucu IP’si
- Veritabanı ve sırları pakete gömmeme
- ERP, API ve yardımcı servisler için yerel supervisor/watchdog
- Windows başlangıcında gizli çalışma, periyodik kontrol ve LocalAppData logları

## 5.9 WhatsApp CRM

### Amaç

Yurt dışından şirket WhatsApp hattına gelen belirsiz numaraları ülke bilgisiyle tanımak, personele atamak, terminalden yanıtlamak ve ERP ürün kataloglarını hızlı göndermek.

### Kurulan/olgunlaştırılan yapı

- Evolution API ile WhatsApp bağlantısı
- Chatwoot gelen kutusu
- Özel Melisa CRM arayüzü
- Telefon ülke kodundan ülke ve küçük bayrak gösterimi
- Personel atama ve dört kişilik eşleme
- Konuşma listesi, sabit yükseklik ve iç kaydırma
- Mobilde panel geçişi
- CRM müşteri rehberi; ERP carilerinden ayrı CRM müşteri yaşam döngüsü
- Müşteri 360, notlar, etiketler, görevler, satış aşaması
- ERP ürün/katalog arama ve ürün ilgisi
- Teklif taslağı; ERP siparişine otomatik yazmayan insan kontrollü kapı
- Dashboard ve raporlar
- Terminalde CRM görünümü
- İkinci CRM parolasının kaldırılması; `crm.view` yetkili personelin girişi

### 19 Ağustos 2026 canlı durumu

- CRM API çalışıyor.
- Sağlayıcı Evolution.
- Gönderim açık.
- Canlı gönderim onaylı.
- Gelen kutusu kaynağı Chatwoot CRM.
- Chatwoot fallback açık.
- Personel eşleme sayısı 4.
- Gruplar varsayılan olarak görünmüyor.
- PostgreSQL yapılandırılmış.
- İdempotency hâlâ bellekte; Redis/durable yapı sonraki sertleştirme maddesi.

### Güvenlik sınırları

- Doğrulanmamış `@lid` veya grup hedefinden telefon numarası uydurulmamalı.
- Grup ve kişisel hesap geçmişi deneyleri, üretim yeteneği gibi sunulmamalı.
- Şirket hattı ile kişisel hattın verisi kesin ayrılmalıdır.
- WhatsApp geçmişinin tamamını Chatwoot’a alma konusu, platform kısıtları nedeniyle tam ve garantili bir ürün özelliği değildir.

---

# 6. Test, Kabul ve Kalite Kanıtları

## 6.1 ERP Core stabilizasyon zinciri

43 sprintlik seri şu aşamaları kapsadı:

1. Mevcut durum ve güvenlik baz çizgisi
2. Kimlik doğrulama
3. Stok/ürün güvenilirliği
4. Müşteri/tedarikçi hareketleri
5. Satış/alış ticari doğruluğu
6. Finans
7. Yedek/geri yükleme/sıfırlama güvenliği
8. İçe aktarma ve temizlik kontrolü
9. Operasyonel sağlık
10. Görsel kararlılık
11. Ürün medyası
12. Katalog/WhatsApp hazırlığı
13. CRM sınırı
14. Raporlama
15. AI/otomasyon hazırlığı
16–19. ERP Core smoke ve kontrollü yazma testi
20–24. Audit, ekran kapsamı, final smoke ve CRM sınır etiketleri
25–29. Terminal, ayarlar, final test runbook’u ve yönlendirilmiş test
30–33. Onaylı yazma testi, P0/P1 düzeltme, insan kabulü
34–43. Üretim kapısı, dağıtım/yedek planları, host/env sahipliği ve final kapanış

## 6.2 ERP UX sadeleştirme serisi

1. Navigasyon sadeleştirme
2. Satış fişi sadeleştirme
3. Alış ve toplu alış sadeleştirme
4. Tahsilat/ödeme sadeleştirme
5. Müşteri/tedarikçi sadeleştirme
6. Stok/ürün sadeleştirme
7. Rapor/tanım sadeleştirme
8. Final responsive ve görsel regresyon

Kanıtlanan sonuçlar:

- 7/7 UX paketi
- 105/105 kontrol
- Final ERP smoke: 32 başarılı, 0 başarısız, 0 uyarı, 1 güvenli atlama
- 16 canlı viewport kontrolü
- Doküman/ana içerik yatay taşması yok
- 1920×1080, 1536 eşdeğeri, 1366×768 ve 1280×720 görünüm kapsamı

## 6.3 CRM dönüşüm serisi

1. UI temeli
2. Gerçek gelen kutusu
3. Customer 360 ve güvenli telefon eşleme
4. İş akışı, kullanıcı ve görevler
5. Ürün/katalog
6. Teklif ve ERP sipariş kapısı
7. Dashboard/raporlama
8. Preflight

**Zaman farkı notu:** Eski preflight görüntüsünde gönderim kapalıydı. 19 Ağustos 2026 canlı sağlık kontrolünde gönderim açık ve onaylıdır.

## 6.4 Kabulün doğru yorumu

- “Accepted with warnings” kaydı vardır.
- Otomatik test ve smoke kapsamı güçlüdür.
- Granüler saha kullanıcı bulguları aynı ayrıntıda kaydedilmemiştir.
- Bu nedenle sonuç: **final test için kabul edilmiş ERP Core**, ancak **tam üretim sertifikası değil**.

---

# 7. Vega 2026 Canlı ve Salt Okunur Entegrasyon

## 7.1 Güvenlik ve dönem sınırı

- Vega kaynağına sadece SELECT/salt okunur erişim
- Ana dönem: F0102 / D0007 / 2026
- Tedarikçi kaynağı: F0103 / D0007
- Sadece `STATUS=1` stok kartları
- Vega’ya fotoğraf, stok, cari veya belge yazılmaz
- Fotoğraflar Melisa ERP’nin yerel verisinde tutulur

## 7.2 Canlı okunan veri aileleri

- Stok kartları, barkodlar, birimler, fiyatlar, özel kodlar
- Envanter ve stok hareketleri
- Müşteriler ve tedarikçiler
- Cari hareketleri ve dövizli bakiye
- Stok çıkış/satış belgeleri
- Alış belgeleri
- Belge başlık ve satır detayları
- Yıllık satış karşılaştırması ve performans raporları

## 7.3 Doğrulanmış cari bakiye formülü

```sql
SUM((BORC - ALACAK) / NULLIF(KUR, 0))
```

Ek kurallar:

- Hareket para birimi cari para birimiyle eşleşmelidir.
- `IZAHAT` 30 ve 31 hariç tutulmalıdır.
- Kaynak şirket+dönem+belge türü+belge numarası/satır kimliği mükerrerlik anahtarı olmalıdır.

## 7.4 Tarihsel aktarım notu

- Vega’da 436 cari bulunmuştu.
- `LL` para birimli 2 cari çıkarıldı.
- 434 cari kaldı: 316 USD, 76 TRY, 42 EUR.
- Bir aşamada 20 stok kartı deneme amaçlı, miktar 0 olarak aktarılmıştı.
- Daha sonra yerel stokların temizlenmesi ve stokta canlı salt okunur Vega görünümüne geçilmesi istendi.

Bu nedenle 434 cari ve 20 stok bilgisi **tarihsel çalışma adımıdır**; bugünkü canlı Melisa ERP kayıt sayısı olarak kullanılmamalıdır.

---

# 8. Şirket Verilerinden Elde Edilen Bulgular

> Aşağıdaki şirket rakamları 18 Ağustos 2026’ya kadar alınmış salt okunur veri görüntüsüdür. 19 Ağustos’taki canlı Vega yenilemesi bu rapor üretimi sırasında yeniden çalıştırılmadığı için rakamlar “tarihli anlık görüntü” olarak kabul edilmelidir.

## 8.1 Satış performansı

### 2026 yılbaşından 18 Ağustos’a kadar

| Para birimi | Ciro | Belge | Aktif müşteri |
|---|---:|---:|---:|
| USD | $1.766.361,31 | 881 | 58 |
| EUR | €461.304,04 | 412 | 16 |
| TRY | ₺2.600.169,42 | 138 | 8 |

Toplam miktar: **483.948,5 adet/birim**.

### Aynı tarihli 2025 karşılaştırması

| Para birimi / ölçü | 2025 aynı dönem | 2026 aynı dönem | Değişim |
|---|---:|---:|---:|
| USD | $1.870.834,33 | $1.766.361,31 | -%5,6 |
| EUR | €402.925,55 | €461.304,04 | +%14,5 |
| TRY | ₺3.272.776,11 | ₺2.600.169,42 | -%20,6 |
| Miktar | 509.648 | 483.948,5 | -%5,0 |

**Yorum:** Euro kanalında büyüme vardır; USD ve TRY kanallarında aynı dönem gerilemesi görülmektedir. Birim/miktar da düştüğü için sorun sadece kur dönüşümü değildir. Müşteri, marka, fiyat ve stok bulunabilirliği kırılımı birlikte incelenmelidir.

### Tam yıl geçmişi

| Yıl | USD ciro | EUR ciro | TRY ciro |
|---|---:|---:|---:|
| 2023 | $3,320 milyon | €515,6 bin | ₺2,967 milyon |
| 2024 | $3,128 milyon | €640,5 bin | ₺2,713 milyon |
| 2025 | $3.019.591,62 | €701.625,23 | ₺4.869.631,78 |

### 2026 baz projeksiyonu

2025 mevsimselliğine göre yaklaşık:

- USD: **$2,85 milyon**
- EUR: **€803 bin**
- TRY: **₺3,87 milyon**

4 Ağustos 2026 resmi kur anlık görüntüsüyle toplam baz yaklaşık **$3,856 milyon USD eşdeğeri** olarak değerlendirilmiştir.

## 8.2 Stok sağlığı

| Gösterge | Kart sayısı |
|---|---:|
| Aktif stok kartı | 11.125 |
| Pozitif stok | 1.843 |
| Sıfır stok | 8.930 |
| Negatif stok | 352 |

- Pozitif stoğun defter maliyeti: yaklaşık **$811 bin**.
- 2026’da hareket görmeyen pozitif stoğun değeri: yaklaşık **$165 bin**.
- Hareketsiz pozitif stok oranı: **%20,3**.

**Yorum:** En kritik stok sorunu kart sayısının yüksekliği değil, 8.930 sıfır kart, 352 negatif kart ve pozitif stoğun beşte birinin hareketsiz olmasıdır. Satış büyümesi öncesi negatif stok sıfırlanmalı, sıfır kartlar arşiv/aktiflik mantığıyla ayrılmalı, $165 bin hareketsiz stok kampanya/paket/ülke bazlı satışla nakde çevrilmelidir.

## 8.3 Müşteri ve tahsilat bulguları

Örnek yüksek risk/uzun ödeme profilleri:

- **NUTSİ:** yaklaşık $141.674 bakiye, yaklaşık 146 gün DSO.
- **YASMİN:** yaklaşık ₺217.490 bakiye, yaklaşık 100 gün DSO.

Bu müşteriler “yüksek ciro = iyi müşteri” diye tek boyutlu yorumlanmamalıdır. Katkı marjı, iade/iskonto, tahsilat süresi, açık bakiye ve satış personeli emeği birlikte ölçülmelidir.

Yaklaşık aktif müşteri sayısı para birimi grupları toplamında 82; müşteri başına ortalama yaklaşık $47 bin eşdeğer hacimdir. 10 milyon USD hedefi sadece mevcut müşterileri büyütmekle değil, yeni tekrarlı perakendeci ve distribütör katmanıyla mümkündür.

## 8.4 Veri kalitesi ve muhasebe riski

Önceki bir denetimde:

- Muhasebe sağlık göstergesi %0 görünmüştü.
- TRY kasa yaklaşık -₺45.974, USD kasa yaklaşık -$200 idi.
- Dört kesinleşmiş satışın fiş numarası “Taslak” kalmıştı.
- Yedi mükerrer/transfer adayı finans hesabı bulunmuştu.

Bu rakamlar tarihli denetim bulgusudur; güncel durum ayrıca doğrulanmalıdır. Ancak sistem tasarımında “operasyon çalışıyor” ile “muhasebe doğru” ayrımının zorunlu olduğunu kanıtlar.

---

# 9. CRM ve Ticari Dönüşüm Hedefi

## 9.1 İstenen müşteri yolculuğu

```text
WhatsApp mesajı
  → ülke/telefon doğrulama
  → yeni müşteri adayı
  → personele atama
  → ihtiyacın kaydı
  → ERP canlı stok/katalog seçimi
  → tek tuşla katalog/ürün gönderimi
  → teklif taslağı
  → insan onayı
  → ERP satış/sipariş süreci
  → hazırlık/teslimat
  → tahsilat
  → tekrar satış ve müşteri 360
```

## 9.2 CRM carilerini ERP carilerinden ayırma kararı

Bu karar doğrudur. Her WhatsApp yazan kişiyi doğrudan muhasebe carisine çevirmek veri kirliliği yaratır. Önerilen statüler:

1. Lead / yeni temas
2. Nitelikli müşteri adayı
3. Teklif aşaması
4. Siparişe dönüşen müşteri
5. ERP carisi açılması onaylanan müşteri

ERP carisi ancak gerçek ticari işleme dönüşünce, gerekli ülke/şirket/vergi/para birimi bilgileri tamamlanınca açılmalıdır.

## 9.3 Yeni özellikten çok işlevsellik odağı

CRM’de öncelik daha fazla ekran eklemek değil:

- gerçek konuşmanın doğru kişiye ait olması,
- mesajın gidip gelmesi,
- ülke/personel atamasının görünür olması,
- müşteri kaydının hızlı yapılması,
- katalog seçiminin hızlı olması,
- görev ve takiplerin kaçmaması,
- mobil/terminal ekranında konuşmanın kullanılabilir olmasıdır.

---

# 10. Büyüme Senaryoları

## 10.1 Pazarlama ve yapay zekâ sistemi sonrası ilk tam yıl

Mevcut reklamsız baz 100 kabul edildiğinde:

| Senaryo | İlk tam yıl büyüme | Şartlar |
|---|---:|---|
| Temkinli | +%20 | Kısmi içerik, sınırlı reklam, CRM disiplininin yavaş oturması |
| Merkezi/gerçekçi | +%42 | Instagram + WhatsApp huni + web + lead finder + düzenli CRM ve stok hazır olma |
| Güçlü | +%70 | Stok, satış kadrosu, ülke kampanyaları, dağıtıcı ve operasyon kapasitesinin birlikte büyümesi |

Merkezi senaryo endeksi:

```text
Bugün 100 → 1. yıl 142 → 2. yıl 185 → 3. yıl 222
```

Bu bir garanti değil; kapasite ve tahsilat kısıtları uygulanmadan sadece lead sayısını artırmak kârlılığı bozabilir.

## 10.2 10 milyon USD hedefinin matematiği

Baz: yaklaşık **$3,856 milyon**.  
Hedef farkı: yaklaşık **$6,144 milyon**.

Gerekli bileşik yıllık büyüme:

- 3 yılda: **%37,4 CAGR**
- 4 yılda: **%26,9 CAGR**
- 5 yılda: **%21,0 CAGR**

Önerilen kontrollü rota:

| Yıl | Hedef ciro |
|---|---:|
| Baz | $3,86m |
| 2027 | $5,0m |
| 2028 | $6,5m |
| 2029 | $8,2m |
| 2030 | $10,0m |

### 10 milyon USD gelir köprüsü

| Kaynak | Hedef katkı |
|---|---:|
| Mevcut müşteriyi koruma ve büyütme | $4,60m |
| 70 yeni tekrarlı perakendeci × $35k | $2,45m |
| 8 distribütör × $250k | $2,00m |
| Private label, geri kazanım, özel koleksiyon | $0,95m |
| **Toplam** | **$10,00m** |

## 10.3 Büyük tedarikçi olmanın operasyonel şartları

- 3.000+ güçlü pozitif stoklu ürün
- Negatif stok: 0
- Hareketsiz stok: <%10
- Sipariş doluluk oranı: >%92
- Zamanında hazırlık: >%95
- 24–48 saat hazırlık standardı
- Dijital kaynaklı cironun 24 ayda %35–50’ye çıkması
- 4–6 pilot ülke, sonra yerel distribütör
- 150–220 aktif B2B müşteri
- Private label payı: ilk yıl %5–10, ikinci yıl %15–20, üçüncü yıl %25–30
- DSO ve açık bakiye limitleri
- Müşteri ve ürün bazında katkı marjı
- Çalışma sermayesi ve stok finansmanı planı

---

# 11. Pazarlama ve Pazar Yaklaşımı

## 11.1 Konumlandırma

“En ucuz toptancı” yerine:

- canlı stok,
- hızlı hazırlık,
- çok marka,
- ihracata hazır paketleme,
- gerçek fotoğraf,
- WhatsApp üzerinden hızlı insan desteği,
- güvenilir tekrar sipariş

vaadi öne çıkarılmalıdır.

## 11.2 Dijital huni

1. Instagram/TikTok gerçek ürün içerikleri
2. Ülke ve müşteri tipi bazlı reklam
3. Web sitesi güven ve ürün vitrini
4. WhatsApp CTA
5. CRM’de ülke/personel atama
6. İhtiyaca göre katalog
7. Teklif ve takip
8. İlk sipariş
9. Tekrar sipariş otomasyonu değil, zamanında görev hatırlatması

## 11.3 Dış pazar gerçekleri

- Türkiye e-ticareti büyümeye devam etmektedir; giyim/ayakkabı/aksesuar güçlü kategoridir.
- Instagram Türkiye’de çok geniş erişime sahiptir.
- WhatsApp dünyada günlük 2 milyardan fazla kullanıcıya sahip olup işletme sohbeti önemli bir ticari kanaldır.
- AB’ye tekstil satışında lif içeriği etiketi ve ürün güvenliği kuralları dikkate alınmalıdır.
- Bazı hedef pazarlarda tüketim zayıf olabilir; ülke seçimi sadece nüfus/mesaj sayısıyla yapılmamalıdır.

---

# 12. Açık Riskler ve Tamamlanması Gerekenler

## 12.1 Üretim öncesi zorunlu kapılar

1. Gerçek yedek alma ve ayrı veritabanına geri yükleme kanıtı
2. Migration rehearsal / staging-restore provası
3. SQL least-privilege ve sertifika politikasının onayı
4. Üretim kullanıcı/rol/izin doğrulaması
5. Çevre değişkeni sahiplik ve değer kontrolü
6. Host, ağ, HTTPS, firewall ve ters proxy kararı
7. Temiz release branch/tag ve geri dönüş planı
8. Üretim öncesi muhasebe, stok ve belge mutabakatı

## 12.2 Kaynak kod ve sürüm riski

19 Ağustos 2026 tarihinde çalışma ağacında API, web, terminal, desktop, CRM, doküman, altyapı ve script katmanlarında çok sayıda commit edilmemiş değişiklik vardır. Temmuz sonrası birçok yetenek dosyalarda mevcut olsa da tekil temiz bir sürüm etiketi altında değildir.

**Sonuç:** Yeni özellik eklemeden önce:

- değişiklik envanteri,
- hangi dosyanın kullanıcı işi/hangi dosyanın AI işi olduğunun ayrılması,
- güvenli commit grupları,
- smoke/build,
- release candidate etiketi

oluşturulmalıdır.

## 12.3 CRM açıkları

- İdempotency bellekte; servis yeniden başlatıldığında kalıcı olay geçmişi garantisi zayıf.
- Redis veya kalıcı idempotency katmanı gerekli.
- Grup ve kişisel hesap geçmişi içe aktarımı ürün yeteneği değildir.
- Chatwoot ve özel CRM arasındaki konuşma kimliği eşlemesi sürekli denetlenmelidir.
- Dokümanlarda eski “ayrı CRM şifresi” bilgisi ile yeni “ikinci kilit kaldırıldı” bilgisi çelişiyor; eski doküman güncellenmeli.

## 12.4 Veri ve ticari riskler

- 352 negatif stok
- 8.930 sıfır stok kartı
- $165 bin hareketsiz pozitif stok
- Yüksek DSO’lu ciddi bakiyeler
- Marj verisinin doğruluğu ve indirim/masraf/iade etkisi
- Ciro büyürken nakit dönüşünün yavaşlaması
- Tek WhatsApp hattının personel, SLA ve sahiplik disiplinine bağımlılığı

## 12.5 Planlanan ama bu repo içinde tamamlandığı doğrulanmayan alanlar

- Kurumsal web sitesi ve tam dijital katalog yayını
- Instagram içerik fabrikası ve reklam otomasyonu
- Lead Finder’ın üretim satış hunisine bağlanması
- Gelişmiş AI satış koçu/öneri sistemi
- Ülke distribütör portalı
- Tam private label operasyon modülü

---

# 13. Önerilen Önceliklendirme

## İlk 30 gün – Sistemi dondur, ölç, güvenceye al

- Dirty worktree envanteri ve temiz release candidate
- Yedek/geri yükleme gerçek provası
- Güncel stok/cari/belge mutabakatı
- Negatif stok listesi ve kök nedenleri
- CRM idempotency kalıcılaştırma
- Şirket hattı/personel/konuşma sahipliği smoke testi
- Operasyon sağlığı ve muhasebe sağlığını ayrı dashboard göstergeleri yapmak

## 31–90 gün – Ticari sistemi disipline et

- Müşteri segmentasyonu: A/B/C, ülke, potansiyel, DSO, marj
- 70 yeni tekrarlı perakendeci hedef havuzu
- 4–6 pilot ülke
- Hareketsiz stok eritme kampanyaları
- Haftalık katalog ve takip ritmi
- Personel bazlı ilk yanıt süresi ve kapanış oranı
- Satıştan tahsilata uçtan uca KPI tablosu

## 3–12 ay – Ölçekle

- Distribütör pilotları
- Private label başlangıcı
- Çalışma sermayesi ve stok finansmanı
- Depo hazırlık SLA’sı
- Ülke bazlı fiyat/ürün karması
- Dijital kaynaklı ciroyu %35+ seviyesine çıkarma

## 12–24 ay – Büyük tedarikçi modeline geç

- 150–220 aktif B2B müşteri
- 8 distribütör rotası
- 3.000+ güçlü pozitif stok
- 10 milyon USD yol haritasına göre yıllık hedef kontrolü
- Ülke bazlı özel koleksiyon/private label

---

# 14. Yönetim KPI Seti

## Ticari

- Ciro: para birimi ve USD eşdeğeri
- Brüt katkı ve katkı marjı
- Müşteri başına ciro
- Yeni müşteri → ilk sipariş dönüşümü
- Tekrar sipariş oranı
- Ülke/personel/kanal bazlı dönüşüm

## Stok

- Pozitif/sıfır/negatif kart
- Stok devir hızı
- 90/180/365 gün hareketsiz değer
- Doluluk/fill rate
- Eksik teslim ve iptal oranı

## Tahsilat

- DSO
- Vadesi geçmiş bakiye
- Kredi limiti aşımı
- Tahsilat tahmini/doğruluğu
- Müşteri risk skoru

## CRM

- İlk yanıt süresi
- Atamasız konuşma
- Açık görev
- Katalog → teklif → sipariş dönüşümü
- Kaybedilme nedeni
- Personel başına aktif konuşma ve kapanış

## Operasyon

- Sipariş hazırlama süresi
- Zamanında hazırlık
- Senkronizasyon hatası
- API/CRM/Chatwoot/Evolution uptime
- Yedekten geri dönüş süresi ve son doğrulama tarihi

---

# 15. Başka Bir Yapay Zekâ İçin Değerlendirme Talimatı

Aşağıdaki metin, bu dosyayla birlikte başka bir yapay zekâya verilebilir:

> Bu raporu Melisa Baby’nin ERP, CRM, terminal, Vega entegrasyonu ve büyüme programının proje hafızası olarak incele. “Canlı doğrulandı”, “kodda/belgede var”, “tarihli veri” ve “plan/hedef” ayrımlarını koru. Önce rapordaki sayıların ve statülerin iç tutarlılığını kontrol et. Daha sonra şu başlıklarda eleştirel değerlendirme yap:
>
> 1. En güçlü 10 kazanım nedir?
> 2. Üretime geçişi engelleyen ilk 10 risk nedir?
> 3. Hangi özellikler gereksiz karmaşıklık yaratıyor veya birleştirilmeli?
> 4. Veri bütünlüğü, muhasebe, stok ve tahsilat açısından kör noktalar nelerdir?
> 5. CRM’nin müşteri kazanımı ve tekrar satışta gerçek darboğazı nedir?
> 6. 10 milyon USD hedefinin en zayıf varsayımları nelerdir?
> 7. 30/90/365 günlük somut uygulama planı öner.
> 8. Her öneriyi etki, efor, risk ve ölçülebilir KPI ile puanla.
> 9. Şirketin mevcut insan/sermaye/operasyon kapasitesi bilinmediğinde varsayım yaptığın yerleri açıkça yaz.
> 10. Yeni özellik önermekten önce var olan sistemin sadeleştirilmesi, güvenilirliği ve saha kullanımını değerlendir.

---

# 16. Kaynak ve Dayanak Özeti

## İç kaynaklar

- Melisa OS merkezi kurallar ve karar defteri
- ERP v2 mimari, karar defteri, uygulama ve stabilizasyon yol haritaları
- Sprint 001–043 raporları
- ERP UX Sprint 001–008 raporları
- CRM Sprint 001–008 raporları
- API route/service dosyaları
- Web, terminal, desktop ve CRM kaynak kodu
- Git geçmişi: 244 commit
- 19 Ağustos 2026 yerel servis sağlık kontrolleri
- 18 Ağustos 2026’ya kadar Vega salt okunur analiz görüntüsü

## Dış kaynaklar

- T.C. Ticaret Bakanlığı, Türkiye’de E-Ticaretin Görünümü 2025
- DataReportal, Digital 2026: Turkey
- Meta, WhatsApp işletme sohbeti güncellemeleri
- Avrupa Komisyonu, Romanya ekonomik tahmini
- Your Europe, tekstil etiketleme kuralları
- Avrupa Komisyonu, genel ürün güvenliği
- T.C. Ticaret Bakanlığı ihracat/e-ihracat destekleri ve alım heyetleri
- İHKİB aylık ihracat bilgi notları
- TCMB kur arşivi

### Dış bağlantılar

- https://icticaret.ticaret.gov.tr/haberler/turkiyede-e-ticaretin-gorunumu-raporu-2025in-ingilizce-versiyonu-yayimlandi
- https://datareportal.com/reports/digital-2026-turkey
- https://about.fb.com/news/2025/04/ways-to-manage-your-businesses-chats-on-whatsapp/
- https://economy-finance.ec.europa.eu/economic-surveillance/eu-member-states/country-pages-including-country-reports/romania/economic-forecast-romania_en
- https://europa.eu/youreurope/business/product-rules-compliance/textiles-and-footwear/textile-label/index_en.htm
- https://commission.europa.eu/business-economy-euro/doing-business-eu/eu-product-safety-and-labelling/product-safety_en
- https://www.ticaret.gov.tr/destekler
- https://ticaret.gov.tr/destekler/e-ihracat-destekleri
- https://ticaret.gov.tr/haberler/ticaret-bakanligindan-ihracata-yonelik-onemli-hamle-ozel-nitelikli-alim-heyetleri-ile-kuresel-alicilar-turk-ihracatcilariyla-bulusuyor
- https://www.ihkib.org.tr/bilgi-bankasi/raporlar/aylik-ihracat-bilgi-notlari
- https://www.tcmb.gov.tr/kurlar/kurlar_tr.html

---

# 17. Sonuç

Melisa ERP v2, kısa sürede yalnızca bir stok programından çok daha büyük bir yapıya dönüştü. ERP çekirdeği, mobil terminal, yerel masaüstü, Vega canlı veri okuma, WhatsApp CRM, ürün fotoğrafı ve yönetim raporları aynı iş hedefinde birleşti: şirketin daha hızlı, ölçülebilir, güvenilir ve uluslararası ölçekte satış yapabilmesi.

En büyük başarı, iş süreçlerinin görünür ve ölçülebilir hale gelmesidir. En büyük risk ise aynı hızla büyüyen kod, servis ve değişikliklerin temiz bir üretim sürümü altında henüz dondurulmamış olmasıdır.

Bir sonraki doğru adım yeni özellik eklemek değil; mevcut sistemi temiz bir release candidate’a dönüştürmek, yedek/geri dönüş ve muhasebe/stok mutabakatını kanıtlamak, CRM ve terminali gerçek personel senaryosunda ölçmek ve ardından 10 milyon USD ticari planını KPI’larla işletmektir.

