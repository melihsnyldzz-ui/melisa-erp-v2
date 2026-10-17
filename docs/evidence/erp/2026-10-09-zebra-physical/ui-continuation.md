# ERP-ZEBRA01 — gerçek cihazda personel girişi ve ürün kontrolü

9 Ekim 2026 · ERP-DEC-037 · TEST125 / PR23. **Gerçek TC21 üzerinde teknik ekran kontrolü tamamlandı; donanım okuyucu ve insan kabulü bekliyor.** İlk bağlantı hazırlığı ve engellenmiş doğrudan URL açma çağrıları [önceki kayıt](README.md) olarak korunur.

## Yöntem ve başlangıç

Kullanıcı ayrıca açıkça **“ekranda ne kullanıcaksan kullan adb ile tıklayarak”** dedi. Aynı araç/onay denetimi altında görülen ekranda tek tek geri/ana ekran/Chrome, adres alanı, metin ve düğme işlemleri çalıştı. Önceden reddedilen doğrudan `am start` çağrısı tekrarlanmadı; onay kontrolleri, kiosk/MDM veya cihaz korumaları değiştirilmedi.

Gözlemlenen başlangıç cihazın Geliştirici seçenekleri ekranı, ardından Chrome yeni sekmesiydi; ERP hata ekranı gözlemlenmedi. Doğru LAN adresi **http://192.168.1.46:5194/terminal.html#products** görünür tarayıcı alanından açıldı ve Personel girişi geldi. Şirket Wi-Fi'sinden web/API HTTP200 tekrar doğrulandı; güncel ağ gözleminde Wi-Fi varsayılan ve VALIDATED idi. Bir ara Android sınırlı bağlantı bildirimi görüldü; bu kalıcı ERP arızası veya kaynak bakiyeleriyle ilgili hata olarak yorumlanmadı.

Mevcut özel TEST erişimindeki normal personel hesabıyla terminalin kendi giriş formu kullanıldı. Parola tool metni/çıktısına veya GitHub'a yazdırılmadı; yeni hesap, parola sıfırlama, rol/grant veya admin oturumu aktarımı yapılmadı. Chrome şifre kaydetme istemi onaylanmadı. Başarılı oturumda normal personel/ön muhasebe etiketi görüldü; bu tek oturum gözlemi genel rol matrisi veya insan kabulü değildir.

## Gerçek cihaz sonuçları

| Kontrol | Teknik gözlem | İnsan / donanım sonucu |
|---|---|---|
| Wi-Fi ve terminal açılışı | TC21 Chrome gerçek LAN terminalini açtı; web/API200. | İnsan sonucu bekliyor. |
| Normal personel girişi | Mevcut TEST personeliyle formdan giriş; Ürünler ve normal personel etiketi görünür. | Genel rol/insan kabulü bekliyor. |
| Başında sıfırlı barkod | ADB metin girdisi + Enter tek doğru ürünü getirdi; kartta barkodun sıfırları korundu. | **Donanım decoder DENENMEDİ.** |
| Ürün kartı ve gerçek veri | Liste/kartta ürün, marka/tür, kaynak stok kodu, barkod, stok ve ayrı fiyat/döviz göründü. | İşletme/fiziksel stok kabulü değildir. |
| Onaylı fotoğraf | İkinci mevcut üründe gerçek küçük ve büyük merkezi fotoğraf açıldı. Görselin üzerindeki fiyat ERP fiyatının yerine kullanılmadı. | Fotoğraf/genel katalog kabulü yeniden verilmedi. |
| Uyku/uyanma | ADB uyku sonrası ilk güç durumu Dozing, uyanma sonrası Awake; aynı personel ve ürün detayı korundu. Komut gözlem damgaları arasında yaklaşık75,6sn; kesintisiz güç durumu kaydı değildir. | Fiziksel güç tuşu/personel gözlemi bekliyor. |
| Chrome yenileme | Aynı personel oturumu ve Ürünler yeniden açıldı. Arama sıfırlanıp genel liste geldi; sonraki ürün kodu araması ve fotoğraf tekrar çalıştı. | Arama/kartın yenilemeyle korunması iddiası yok. |
| Ana ekran → Ürünler | Mevcut menüden iki ekran arasında geçiş çalıştı; son boş barkod alanı odaklandı. | Yeni taslak veya ticari işlem yok. |
| Wi-Fi kopma/geri gelme | Radyo veya ağ ayarı değiştirilmedi. | DENENMEDİ. |

Fiziksel okuyucuyu etikete tutma/decoder olayı ADB metin girişiyle temsil edilemez. Bu nedenle ERP-UA18/UA28 **bekliyor**, C12🟡 ve finish **49 /9🟢 /39🟡 /1🔴** değişmez.

## Korunum ve kanıt sınırı

Normal TEST125/source **edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d** web5194/API4144/native4146 health ve aynı sahipli üç PID ile doğrulandı. Önceki kopya web126, backendler, sekmeler ve taslaklara dokunulmadı. Yeni kod/paket/restart/deploy yok. Yeni satış, ödeme, tahsilat, stok, iade, taslak, mesaj, migration veya Vega/LIVE/CRM/main/T1 işlemi yok. İşlem geçmişi ya da bütün DB satır hashleri yeniden taranmadı.

Çalışan paket `canonical-test-env.mjs` stateless-auth flag'ini true kurar; paket authService aynı mevcut kaynak SHA'sıyla stateless giriş kolunu içerir. Bu kaynak/runtime kontrolü bağımsız bütün auth/DB satır mutabakatı sayılmaz. Native Android paketinin son gözlemde arka plan PID'si vardı, sınırlı yeni log satırı0; hedef foreground Chrome'dur. PID varlığından decoder, profil veya başka uygulama ekranı kabulü türetilmedi.

Son sınırlı Chrome68/DataWedge121 log satırında taranan crash/bağlantı hata göstergesi0. Bütün cihazda hata yok iddiası değildir. Ham cihaz görüntüleri, kod/barkod/tutarlar, hesap bilgileri ve loglar repo dışındaki private kanıtta kaldı. GitHub'a yalnız bu anonim rapor, özet ve ilgili takip belgeleri gider. Önceki CI hesap/harcama engeli açık; yeni belge HEAD CI makbuzu PR23 teslim yorumunda ayrıca doğrulanır.

**Tek kalan fiziksel işlem:** Zebra Ürünler ekranında boş barkod alanı hazırken bir ürün etiketini okuyucuya tutup scan düğmesine basmak. Sonucun gerçekten donanımdan geldiği ve doğru ürünün açıldığı gözlemlenir; satış veya kayıt düğmesi kullanılmaz. Bu dar kapsam sonunda durulur; başka modül veya migration başlamaz.
