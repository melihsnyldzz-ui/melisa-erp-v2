# CRM06 — mevcut desteklenen ilk tarayıcı giriş yolu incelemesi

14 Ekim 2026. Kullanıcı: “Benden tekrar parola istemeden, yapılanları tekrarlamadan CRM06’yı bitirecek yolu bulup uygulayın.” Aynı CRM06/sabit55/ortak21 kapsamı; uygulama, hesap, parola, rol veya çalışan ortam yeniden kurulmadı. Önceki normal manager API, sağlık, DPAPI ve21tablo kanıtları yeniden üretilmedi.

## Kaynakta bulunan yollar

| Mevcut bileşen | Gerçekte yaptığı | İlk dedicated manager tarayıcı girişini neden sağlamıyor |
| --- | --- | --- |
| `crmAuthService.js` authenticateCrmUser158–176 ve `authController.js` postAuthLogin7–22 | Normal username/password scrypt doğrulamasından sonra user/SID/refresh ailesi oluşturur | Korumalı parola normal forma veya resmi giriş çağrısına güvenli tüketimle ulaşmalı; issuer üyeliği tek başına giriş yetkisi değildir |
| `normalRefreshSession.mjs` issue64 ve rotate70; authController refresh34 / remembered61 | Daha önce alınmış geçerli refresh sırrını döndürür; journal yalnız tokenHash tutar | Hash'ten sır üretilemez. Root'un önceki resmi API test ailesi logout ile kapatıldı; tarayıcıda geçerli grant kurulduğu kanıtı değildir |
| `browserNormalSession.js` ve `semihTestCookie.mjs` | Önceden parola ile doğrulanmış özel Semih hesabının HttpOnly cookie oturumunu sürdürür | Cookie/remembered dalı exact ayrı Semih kimliğine bağlıdır; yeni normal mudur kimliği bu profil değildir. İptal edilen yardımcı yeniden etkinleştirilmez |
| `nativeSessionBridge.js` createNativeSessionBridge2, remember49, resume55; ERP `WorkProtectedSession.kt` | Gerçek native host'taki `MelisaProtectedSession` get/put/clear ile mevcut doğrulanmış grant'i korumalı saklar; yenilemede aynı kullanıcı doğrulanır | Bağlı IAB normal native host değildir. Köprü Windows DPAPI ilk giriş parolasını tüketmez ve önceki doğrulanmış oturum olmadan yetki oluşturmaz |

Kaynak yolları kanonik CRM `apps/gateway/src/controllers`, `apps/gateway/src/services` ve `apps/frontend/src`; Android kaynak `apps/terminal-native/app/src/main/java/com/melisaerp/nativeterminal/WorkProtectedSession.kt`. İncelenen auth/session dosyalarının kurulu CRM5b6 ile içerikleri aynı; yalnız iki dosyada CRLF farkı vardır. Graph yapısal araması fonksiyon adını buldu ancak satır eşlemesi eskiydi; karar exact güncel/kurulu dosya okumalarına dayanır.

## Gerçek bağlı tarayıcının yayımladığı API

CRM sahibi aynı IAB2/tab2 üzerinde güncel Browser Use dokümanı ve belgelenmiş capability listesini okudu: browser `visibility/viewport`; tab `pageAssets/webmcp/cdp`. Normal görünür form “CRM Yönetim Merkezi”; normal password formu ve TEST ADMIN düğmesi var. Müdür/personel doğrulanmış rol işareti yok. WebMCP listesi “No WebMCP tools are available in this document.” Korumalı credential-reference tüketimi veya çağrılabilir browserAuth API yayımlanmıyor; policy metninde browserAuth'dan söz edilmesi bir çağrı metodu değildir.

Bu tarayıcıya ait kanıt [CRM PR3 exact f9fddce browser-supported-path.json](https://github.com/melihsnyldzz-ui/melisa-crm/blob/f9fddce76f735882cad5025a6d35e5e089041402/docs/evidence/crm/2026-10-14-crm06-closure/browser-supported-path.json) içindedir. Input değeri, token, cookie, storage veya gizli uygulama durumu okunmadı. Reader/import/giriş denemesi, alternatif browser, OS komutu, bridge, shared write veya restart yapılmadı.

## Eksik bileşenin kesin kapsamı

Gerekli bileşen **bağlı Browser Use/CUA sağlayıcısının desteklenen korumalı ilk giriş tüketimi**: mevcut encrypted TEST credential referansını güvenilir host katmanında alır, mevcut owner/CurrentUserDPAPI/cipher/actor/copy kontrollerini korur ve doğru origin'deki resmi normal formda kullanır. Parola veya grant modele, çıktıya, source'a, düz metin kayda ya da başka uygulamaya verilmez. Uygulamanın normal password doğrulaması, gerçek user/role/agent/SID kontrolü ve çıkış/iptal davranışı korunur. Sonuç yalnız sır içermeyen doğrulanmış kullanıcı/rol ve işlem durumudur.

Bu bir yeni CRM login endpoint'i, localhost shortcut, magic token, HTTP/clipboard credential köprüsü veya cookie/JWT enjeksiyonu tasarımı değildir. Platformda belgelenmemiş bir API uygulama koduyla varmış gibi gösterilemez. `process` shim/export, başka araç/browser/CDP veya OS yoluyla ret aşılmaz; d3a47 okuyucusunun ACL/DPAPI kontrolleri kaldırılmaz. Mevcut kaynakta, bu sınırlar içinde uygulanabilecek desteklenen ilk giriş bağlantısı bulunamadığından auth/runtime patch uygulanmadı.

Desteklenen capability gerçek bağlı araçta yayımlandığında aynı hazır hesapla resmi normal giriş → me/rol/issuerSID → mevcut müşteri/tek talep/atanmış personel/yenileme/mobil zinciri yürütülebilir. Hesapları yeniden hazırlamak veya önceki API/sağlık/SQL kanıtını tekrarlamak bu eksiği çözmez. Gerçek native/browser üzerinde aynı kimliğe ait geçerli korumalı grant zaten varsa normal resume ancak mevcut desteklenen host yoluyla mümkündür; mevcut görünür form bunu kanıtlamıyor ve böyle bir grant uydurulmadı.

## Sonuç

**Desteklenen ilk tarayıcı girişi: bağlı araçta eksik.** Normal manager CLI/API hazırlığı korunur; bu GUI kabulü değildir. Yeni normal UI login/customer session/interest0; insan kabulü ve CRM06 kapanışı açık, ERP09 başlamadı. Bağımsız salt okunur kaynak incelemesi aynı sonucu verdi. Yeni işlev testi, finans/SQL/stock yazması, credential/reset/rol değişikliği veya servis işlemi yok.
