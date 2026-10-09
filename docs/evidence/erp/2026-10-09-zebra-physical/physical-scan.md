# ERP-ZEBRA01 — fiziksel okuyucu gözlemi

9 Ekim 2026 · ERP-DEC-038 · [PR23 talimatı](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6079756665). Aynı mevcut görev, TEST125/source `edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d`; başlangıç kaynak HEAD `71e8e14aee3b79a66af7ea159bece494554ec80e`. Yeni uygulama paketi veya servis restartı yok.

## Gerçek sonuç

| Kontrol | Sonuç | Kanıt ve sınır |
|---|---|---|
| Gerçek TC21 okuyucusu | UYGUN teknik gözlem | Kullanıcıya tek fiziksel okutma çağrısından sonra 14:24:21.232 HardKeyDown; 14:24:21.822 decoded-success; 14:24:22.185 HardKeyUp. Tarama penceresinde ADB metin/Enter yok. |
| Barkod → ürün | UYGUN, Bul ile | Alanın ilk gözleminde kısmi değer vardı; sonra tam barkod ve tek ürün görüldü. Codex Bul düğmesine bastı. Tam barkodun otomatik Enter ile aramayı bitirdiği kanıtlanmadı; ek tıklama kullanım eksiği açık. |
| Ürün/kart/stok/fiyat/fotoğraf | UYGUN teknik gözlem | Gerçek cihazda liste ve büyük fotoğraf, tam kaynak stok kodu, barkod, stok ve USD satış fiyatı görüldü. Bağımsız SELECT: tek aktif barkod, doğru ürün, stok, USD kademe1 fiyat adayı ve aynı ürün CONFIRMED medya bağı. Fiziksel mağaza miktarı veya bütün fiyat/birim API matrisi kabulü değildir. |
| Başında sıfırlı fiziksel etiket | DENENMEDİ | Okutulan etiket sıfırla başlamıyor. Önceki ADB sıfırlı metin kontrolü tarihsel korunur, optik sıfır testi yerine sayılmaz. |
| Wi-Fi kesinti/geri geliş | UYGUN teknik gözlem | Yetkili bağımsız USB bağlantısı ve enable komutu önce doğrulandı. Radyo kısa süre kapatıldı; wifi_on0 ve wlan0 HTTP000. finally ile açıldı; wifi_on1, web/API200 ve gerçek Chrome yeniden bağlandı bildirimi. Aynı oturum/kart korundu. Uzun kesinti, satış/offline işlem testi yok. |
| Kısa uyku/uyanma | UYGUN teknik gözlem | Dozing→Awake; yaklaşık5sn bekleme, normal kilitsiz ekran kaydırılarak açıldı. Aynı personel/kart görüldü; koruma/parola/MDM değişmedi. Uzun uyku veya fiziksel güç tuşu insan kabulü değildir. |
| Yenileme/yeniden okuma | UYGUN teknik gözlem | Chrome yenilemesinde aynı personel ve genel Ürünler döndü; arama sıfırlanır. Aynı barkod bu ayrı aşamada ADB metin+Enter ile tekrar aranıp aynı ürün bulundu. Bu ikinci arama optik ikinci tarama olarak raporlanmaz. |
| Personel/rol | KISMİ | Mevcut normal ön muhasebe oturumu korundu. Users/roles/permissions tam satır hash'leri aynı. Yeni yetki verilmedi; bütün yetki matrisi ve yetkisiz ticari POST negatifleri bu salt okuma turunda yeniden çalıştırılmadı. |
| İnsan kabulü | BEKLİYOR | Donanım olayı gerçek gözlemlendi; ayrı kişi/tarih/sonuç ve açık kullanıcı kabulü henüz alınmadı. ERP-UA18/UA28 PASS değil. |

## Veri ve runtime korunum kanıtı

14:23:18–14:28:22 TR dar önce/sonra karşılaştırması:10 ticari tablonun partition satır sayısı ve3 kullanıcı/rol/izin tam satır hash'i aynı; TEST125 web5194/API4144/native4146 kaynak/DB ve PID/başlangıç zamanları aynı. İlk geniş ticari hash denemesi30sn timeout verdi; geçerli kanıt sayılmadı ve tekrarlanmadı. Sayı eşitliği ticari UPDATE olmadığının veya bütün DB hash eşitliğinin kanıtı değildir.

Agent yalnız ürün okuması/SELECT yaptı; yeni satış, stok, cari, kasa, taslak, ödeme, tahsilat, belge, migration veya mesaj oluşturmadı. Vega/LIVE/CRM/main/gerçekT1, mevcut roller, DataWedge profile seçenekleri ve MDM değiştirilmedi. Wi-Fi geçici kapatılıp yeniden açıldı; son durum başlangıç gibi açık. Bağlantı katmanında scanner-status broadcast uyarıları vardı; bunlar decoder-success ve gerçek ürün sonucuna rağmen bütün cihazın hatasız olduğu şeklinde yorumlanmadı.

Ham ekranlar/loglar/barkodlar/tutarlar/cihaz kimliği yalnız repo dışı `C:\Sirket\ERP\evidence\ERP-ZEBRA-PHYSICAL-20261009\private\physical` altında. Anonim özet [physical-scan.json](physical-scan.json). Son gerçek ekran ürün detayıdır. TC26, sıfırlı optik etiket, çoklu tekrar/uzun kesinti ve geniş insan kabulü denenmedi. C12🟡; finish49/9🟢/39🟡/1🔴 korunur. CI kesin belge HEAD için PR teslim makbuzunda ayrıca doğrulanır; hesap/harcama engeli yeşil sayılmaz. Bu kapsam sonunda DUR.
