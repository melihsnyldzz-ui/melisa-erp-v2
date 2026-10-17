# ERP-ZEBRA01 — fiziksel Zebra kabul hazırlığı

**Son fiziksel gözlem / ERP-DEC-038:** Gerçek TC21 donanım trigger/decoder, Bul ile doğru ürün, Wi-Fi kısa off/on ve uyku/oturum/yenileme gözlemlendi. [Güncel fiziksel rapor](physical-scan.md), [anonim özet](physical-scan.json). Sıfırlı optik etiket ve otomatik Enter tamamlanmış sayılmaz; insan kabulü bekler. Aşağıdaki devam ve ilk hazırlık kayıtları tarihsel kapsamlarıdır.

**Güncel devam sonucu:** Kullanıcının açık görülen ADB tıklama yöntemi seçimi sonrası gerçek TC21 Chrome terminal/personel girişi/ürün-kart/fotoğraf, sıfırlı barkod metni ve uyku/yenileme teknik gözlemi tamamlandı. [Güncel rapor](ui-continuation.md), [anonim özet](ui-continuation.json). Donanım decoder ve insan kabulü bekler. Aşağıdaki ilk hazırlık/ret tablosu, sonraki ekran kontrolünden önceki tarihsel gözlemdir.

9 Ekim 2026 · ERP-DEC-036 · mevcut PR23/TEST125. **Teknik Wi-Fi erişimi doğrulandı; fiziksel ve insan kabulü tamamlanmadı.** Mevcut TC21 kullanıcı tarafından test için kullanılabilir bildirildi ve gerçekten bağlı bulundu. TC26 cihazı denenmedi. Önceki Aşama6 kanıtı korunur; bu tur yeni ticari işlem/migration değildir.

## Gerçek TEST terminal adresi ve bağlantı

**Zebra Chrome:** <http://192.168.1.46:5194/terminal.html#products>.

5194 normal TEST125 web /4144 TEST API LAN'da aynı şirket bilgisayarında dinler; native4146 yalnız sunucunun loopback arka hizmetidir, Zebra'ya açılması gerekmez. Üç servis source`edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d`, aynı doğrulanmış TEST DB; API/native uygulama rolünde sysadmin/CONTROL/LIVE erişimi0. Kopya5204/4154/4156 bu fiziksel LAN kabulünün hedefi değildir. 62400 ayrı CRM bağımlılığıdır; bu prova CRM bölümüne girmez. DHCP adresi bugün doğrulandı; kalıcı IP rezervasyonu yapıldığı iddia edilmez.

Mevcut yetkili USB/ADB bağlantısında modelTC21/Android13/Wi-Fi UP doğrulandı. **Doğrudan cihazın wlan0 arayüzünden** webhealth ve terminalHTML HTTP200, APIhealth200, katalog GET için CORS preflight204/exact TEST origin doğrulandı. Bunlar sunucudan kendi kendine yapılan istekler değildir. Cihaz Chrome'da sayfa açıldığının veya personel girişinin kanıtı sayılmaz.

## Sonuçların ayrımı

| Kontrol | Teknik sonuç | Fiziksel kullanıcı sonucu |
|---|---|---|
| Şirket Wi-Fi → TEST web/API | DOĞRULANDI — gerçek cihaz wlan0 HTTP200 ve preflight204 | İnsan gözlemi bekliyor |
| Terminal sayfasının cihazda açılması | DENENMEDİ — ekranı açan çağrı çalışmadan engellendi | Bekliyor |
| Donanım barkod okuma | DENENMEDİ | Bekliyor |
| Doğru ürün/kod/marka/fiyat/döviz | DENENMEDİ; önceki katalog kanıtı fiziksel scanner sonucu değildir | Bekliyor |
| Uyku/uyanma/yenileme/tekrar okuma | DENENMEDİ; yalnız ilk Awake durumu okundu | Bekliyor |
| Personel oturumu/kimliği | DENENMEDİ; yeni login veya yetki verilmedi | Bekliyor |

Kullanıcı ayrıca **USB/ADB ile cihaz ekranını kontrol et** yöntemini açıkça seçti. Buna rağmen otomatik onay incelemesi tam TEST URL'sini mevcut Chrome ile açan birleşik çağrıyı ve ardından yalnız adresi açan dar tek çağrıyı **çalışmadan reddetti**. Bildirilen neden `blocked by policy`; ayrıntılı gerekçe yok. Ekran açılmadı, giriş yapılmadı, yöntem değiştirilerek engel aşılmadı. Son salt okunur foreground kontrolü Launcher/Awake; başlangıç gerçek cihaz görüntüsü private alandadır. Bu, ERP/Wi-Fi hatası veya kullanıcı/işletme reddi değildir.

## Mevcut scanner ve erişim sözleşmesi

`terminal.html#products`, mevcut ince personel browser yüzüdür. Normal personel hesabıyla manuel giriş ve product.view gerekir; fiyat alanı sales.view ile açılır. Admin reddedilir; desktop/admin token'ı terminale kopyalanmaz. Oturum ayrı sessionStorage alanını kullanır. Parola paylaşma, yeni login mekanizması/rol/grant veya cihaz yönetimi değişimi yok.

Ürünler katalog sorgusu/kart/fotoğraf yalnız GET. Barkod string kalır, sıfırlar korunur; aynı hızlı Enter600ms içinde ve sorgu sürerken tekrar engellenir. **Satış barkod alanı sepete ekleyebildiğinden bu prova yalnız Ürünler'dedir.** Bilinmeyen barkoddan stok kartı oluşturulmaz. Kaynak `personnelTerminal.js`, `personnelTerminalModel.mjs`, `workingCatalogSession.mjs` ve mevcut katalog sözleşmesidir; önceki teknik testler yeniden fiziksel PASS sayılmaz.

Cihazda korunan `com.melisaerp.nativeterminal` candidate.18-t2/versionCode20 kurulu, bu gözlemde çalışmıyor. Native kaynak sözleşmesindeki DataWedge intent profili klavye çıktısını kapatır; bu eski APK, bugünkü browser terminalinin yerine seçilmez/açılmaz. Browser scanner klavye çıktısı+Enter/fokus gerektirir; mevcut Chrome/DataWedge profilinin gerçek donanım okuması yapılmadığından uyumluluğu henüz doğrulanmadı. Profil/import/kurulum ayarı değiştirilmedi.

## Hata ve bağlantı kayıtları

Mevcut Chrome ve DataWedge PID'lerinden sınırlı son122log satırında taranan crash/ANR/bağlantı-hatası göstergesi0; native uygulama çalışmadığı için native yeni oturum log'u0. Sunucunun mevcut web/API/native stderr/stdout dosyaları boş; son service-started olayları önceki TEST125 başlama zamanı/süreçleriyle aynı. Yeni erişim/audit log sistemi kurulmadı. **Bütün cihazda hata yok veya scanner çalışıyor iddiası yok.** Ham log, cihaz kimliği, Wi-Fi adresi ve ekran görüntüleri private kalır.

## Tek sonraki fiziksel işlem ve kısa talimat

Şimdiki tek gereken işlem: **Zebra Chrome'da yukarıdaki TEST adresini açıp görünen ekranı — Ürünler / Personel girişi / hata — bildirmek.** Bu, yeni yetki veya ticari işlem onayı değildir. Otomatik kontrol engeli nedeniyle bu ilk fiziksel gözlem kullanıcıya kalmıştır; yeniden aynı otomasyon onayı istenmez.

Tek ekranlık kısa talimat kartı özel `C:\Sirket\ERP\evidence\ERP-ZEBRA-PHYSICAL-20261009\private\report\zebra-kabul.html` dosyasında hazırlanmıştır; yerel HTML'nin tarayıcıda görsel doğrulaması yapılmadı. Kullanıcıya kısa talimat sohbet metni olarak da verilir. Sonraki aynı kısa tur: mevcut personel girişi → Ürünler'de gerçek barkod → doğru kart/döviz →30sn uyku/uyanma/yenileme/tekrar okuma → kişi/tarih/gözlem. Yeni satış/sepete ekleme/kaydet/finalize, gerçek mesaj ve stok hareketi yapılmaz. TC21 fiziksel barkod/insan gözlemi olmadan PASS yok; ERP-UA18 ve UA28 bekler.

Kod, çalışan TEST paketi, servis/özel config/finans/stok/roller, Wi-Fi/DataWedge/MDM ayarları değiştirilmedi. Vega/LIVE/CRM/main/T1 yok. GitHub'a yalnız anonim teknik/durum belgeleri gider. Önceki CI hesap ödeme/harcama engeli bilinir; yeni belge HEAD kontrolleri exact PR23 makbuzunda ayrıca doğrulanır, yeşil gösterilmez. **Bu dar hazırlık sonunda durulur; fiziksel sonuç beklenir.**
