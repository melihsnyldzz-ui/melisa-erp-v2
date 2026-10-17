# Korumalı Windows TEST oturumu ve bağlantı kesintisi — 12 Ekim 2026

ERP-COMPLETE01 / ERP-DEC-047. Kullanıcıdan parola veya manuel giriş istenmez. Paylaşılan hesap/rol, TEST125, migration ve ticari kayıt değişikliği yok. İnsan ERP-UA32 bekliyor.

## Kaynakta hazırlanan davranış

Windows masaüstü uygulamasında açıkça seçilen izole DB02 modu, mevcut normal15/16 oturumlarını Windows safeStorage ile şifreli ve atomik saklar. Korumalı depo öncesinde web5234/API4184/native4186 kaynak commit, DB/copy ve düşük yetki kimlikleri doğrulanır. Normal refresh ve `/me` kimliği belirlemeye devam eder; yönetici alias, parola saklama veya token üretme yok. Varsayılan eski masaüstü başlangıcı değişmedi; izole mod servis başlatmaz.

IPC yalnız doğrulanmış ana ERP/personel frame'ine üç dar işlem sunar. Başlangıçtan itibaren FIFO sağlık/sender/depo adımlarını kapsar; gecikmiş kayıt çıkış temizliğinin arkasından oturumu geri getiremez. Taslak/request journal ayrı kalıcı partition'da korunur, oturum tokenı browser storage'a yazılmaz. X/Alt+F4/çıkış/yüz değiştirme mevcut bekleyen işlem kontrolüne bağlıdır. Gerçek HOME/Onaylar/Stok/Raporlar/Ayarlar dispatcher'ı kendi salt okunur hook'unu kurar; eski dispose yeni sayfanın guard'ını silemez. Yalnız uygulamanın ürettiği exact bağlantı hata yüzü çıkış/yeniden denemeye izin verir; bilinmeyen operasyon yüzü kapatma veya vault istisnası kazanmaz.

Android personel başlangıcında503/ağ hatası parola formu yerine bağlantı kartı ve yeniden deneme sunar. Mevcut korumalı refresh kaydı korunur.401/403 hâlâ normal oturum sonlandırma/temizleme yoludur. Gerçekte eksik kayıt için kimlik uydurulmaz.

Bağımsız reviewer GO;51 hedefli test PASS/0skip: desktop20, protected-device13, personnel15, gerçek read-only dispatcher3. Kaynak/syntax kontrolleri başarılı. **Bu kaynak kanıtı henüz yeni çalışan paket, Electron DPAPI yeniden açılışı, Windows–CRM oturum paylaşımı veya insan kabulü değildir.** Windows CRM bridge ayrı eksik; ERP tokenı CRM iframe'ine aktarılmaz.

## Ölçülen stok kontrolü

Aynı committed200 satır üzerinde yalnız SELECT/HOLDLOCK/SERIALIZABLE karşılaştırması: eski supplier-stock hold predicate48.072ms, aynı raw koşulları tekil kimlik/source çiftleriyle değerlendiren SELECT503ms. İki sonuç aynı; exact native module ve200 satır rowset witness önce/sonra aynı; transaction ROLLBACK doğrulandı. Ticari/DDL yazma0.

Private receipt SHA256 `b74677e960d694c7b234ef4ea305d98db60cf862086acd46e1c69207ecca4635`. İlk salt okunur witness denemesi reserved alias nedeniyle SQL156 ile durdu; yalnız `[rowCount]` sözdizimi düzeltmesiyle mevcut sorgular çalıştırıldı, önceki başarısız kanıtlar korunur. Bu sonuç fiziksel INSERT süresini veya native guard/rol kabulünü tek başına ispatlamaz. Native optimizer uygulaması henüz yapılmadı; güvenlik koşulları kaldırılmadı.

## Çalışan ile hazırlananın ayrımı

Kaynak kontrolü sırasında çalışan ERP f411eb8 / CRM09ca / native60e / Android v22; API4184/native4186/Hub5234/CRM62700–62704, exact DB02/copy `e16b70f0-4057-428b-9abc-6bbcaf35fe82`, actualT1false. İki core processProbe kesintisi mevcut gözetim göreviyle toparlandı. Tanılama a208 paketi hazırlanmış fakat aktive edilmemiştir. Windows/bağlantı düzeltmeleri yeni immutable pakete alınmadan cihaz sonucu veya hız kazancı iddia edilmez.
