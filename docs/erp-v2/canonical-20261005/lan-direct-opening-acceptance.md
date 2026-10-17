# ERP-LAN01 — yereldeki gibi doğrudan ağ açılışı

6 Ekim 2026. Açık kullanıcı talimatı: “burdada admin falan kullanmak istemiyorum yereldeki gibi olsun”. ERP-DEC-012, önceki manuel LAN giriş kararını değiştirir. Kalıcı IP işlemi hâlâ ertelenmiştir.

## Sonuç ve ortam

http://192.168.1.46:5194/ornek-akis.html#home boş bir tarayıcı sekmesinde hesap, şifre veya admin seçimi sormadan açılır. Normal sayfada mevcut temiz “Yönetici” etiketi kullanılır; yeni TEST/debug metni veya tasarım değişikliği yok. Sayfa yenilendiğinde mevcut oturum doğrulanır; yeni giriş istenmez. Özellikle seçilmiş manuel kullanıcı oturumu, localhost'taki gibi korunur.

TEST paket49: `C:\Sirket\ERP\releases\CANONICAL-LAN-TEST-20261006-49`. Uygulama source `bb082dfc5b182070b1ebd09de239c7894b89982d`. API4144/web5194 yalnız127.0.0.1 +192.168.1.46, native4146 yalnız127.0.0.1. Gerçek DB: Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01; sysadmin0, databaseControl0, liveDatabaseAccess0, dış işlemler kapalı. Private config hash aynı; modem/IP/firewall değişmedi. LIVE5188/4114/4116 süreç sahipleri aynı. Eski48 paket ve launcher geri dönüş yedeği korunur.

## Uygulama ve sınır

Mevcut uygulama seviyesindeki geçici TEST oturumu LAN'a yalnız configureCanonicalTest doğrulanmış kimliği ve açık listenerPolicy ile uyarlanır. Gerçek socket192.168.1.0/24, exact192.168.1.46:4144 Host ve bootstrap için exacthttp://192.168.1.46:5194 Origin gerekir. Forwarded header kimlik sağlamaz. LAN ayarı yoksa aynı eski loopback sınırı geçerlidir. SQL actor16, mevcut named TEST kayıt korumaları ve gerçek kullanıcı/rol tabloları değiştirilmez. Native/LIVE/başka actor veya DB bu oturumu kabul etmez.

## Kanıt

- 37/37 hedefli offline test ve bağımsız inceleme PASS. Yerel offline Sites107 dosyada506/506 PASS. Paket build8,12s;1301 manifest dosyası ve16977 eski/yeni dependency hash doğrulandı.
- Gerçek boş LAN sekmesinde Ana Sayfa giriş formu olmadan açıldı. Yenilemede auth/me200 ve HOME200; yeni auth/test-admin veya auth/login isteği yok. Network kanıtında yalnız URL/status saklanır; token/credential yok.
- Aynı otomatik oturumdan Ürün & Stok →8023CONCEPT kartı açıldı. CONCEPT/TAKIM,0ADET,15,78USD,3617221176192 ve iki gerçek yüklenmiş ürün görseli doğrulandı.
- API LAN otomatik bootstrap200, actor16 ve localhost ile aynı izinler; native token401, yetkisizHOME401, yanlışHost403, scope dışı productPOST405, Vega403. Başka/eksik Origin istekleri reddedildi. Mevcut CORS katmanı yabancı Origin'e500 döndü; izin verilmedi ve bu turun dışında mevcut hata yanıtı değiştirilmedi.
- 50 katalog satırı/16.622 kabul edilmiş ürün/54 hold, localhost/LAN DTO birebir aynı; thumbnail3213byte. Katalog API ilk1582ms, izleyen1477ms; HOME ilk183ms, sonraki22–38ms. Katalog sorgusu, fotoğraf ve tasarım değiştirilmedi; bu turda hızın önceki733ms ölçümüne eşit kaldığı iddia edilmez.
- Ticari işlem/SQL schema/rol/migration yazması0. Başka fiziksel ağ istemcisi denenmedi; ERP-UA06 insan sonucu bekliyor.

Ham kanıt: `C:\Sirket\ERP\evidence\ERP-LAN-AUTO-20261006`: runtime-switch-auto-49.json, actual-auto-49-first.json, actual-auto-49.json, browser-home.txt, browser-stock.txt, browser-reload-network.json ve eski launcher yedeği.

Ekran görüntüleri: `C:\Users\Xaser\Documents\Codex\2026-10-04\referenced-chatgpt-conversation-this-is-an-6\outputs\ERP-LAN-direct-home.png` ve ERP-LAN-direct-stock.png. Fotoğraflar/secret config GitHub'a eklenmez.

## Teslim / kullanıcı kabulü

Dal codex/erp-finish-20261004 / [PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23). Uygulama bb082df için hosted push37374269222/PR37374274658 quality-build-test SUCCESS; secret-scan sonuçları ve izleyen belge head'inin required CI durumu PR Checks'ten ayrıca doğrulanır. Çalışan paket source ile belge/PR head ayrı tutulur.

ERP-UA06: başka bilgisayarda bu URL'yi yeni sekmede aç; giriş seçimi olmadan Ana Sayfa'yı gör; yenile; Ürün & Stok ve8023fotoğrafını aç. Teknik provayı kullanıcı PASS sayma. B01/UA05 ve önceki kabul edilmiş katalog işleri aynı; başka finish işi başlamaz. Kalıcı IP kullanıcı daha sonra başlatacak.
