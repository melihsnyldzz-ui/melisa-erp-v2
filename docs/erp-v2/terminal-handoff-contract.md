# E1 — mevcut normal oturumlar arasında dar TEST devri

24 Ekim 2026. Bu belge mevcut E1 sözleşmesidir; yeni kimlik, login veya takip sistemi değildir. ERP sağlayıcı kaynağı ve sentetik HTTP testleri hazırdır. Android tüketici, CRM exact kaynakla ortak uçtan uca doğrulama, kurulum ve insan kabulü henüz tamamlanmadı. Kurulu ERP8aa/CRM09a/native035 bu kaynak tesliminde değiştirilmez.

## Otorite ve sınır

ERP'nin mevcut normal Bearer + refresh çifti sunucuda doğrulanır. Aktif kullanıcı/rol/izin/parola fingerprint'i ve mevcut normal oturum ailesi her bağlantı doğrulamasında yeniden okunur. Açık ERP userId → CRM userId → temsilci → revision ilişkisi zorunludur; isim veya istemci iddiasından ilişki üretilmez. CRM kendi aktif hesabını, rolünü, temsilcisini ve mevcut müşteri atamasını ayrıca denetler. İki sunucu arasında atomik veritabanı işlemi iddiası yoktur: CRM yayın öncesi yeniden doğrular, başarısız geçici grant'i geri alır ve her korumalı kullanım/refresh'te bağlantıyı yeniden doğrular.

ERP parola/access/refresh/JWT signing secret'i CRM'ye taşınmaz. Native ayrı CRM korumalı alanında yalnız CRM'nin mevcut normal issuer'ının ürettiği kendi grant'ini saklayabilir. `normalTestSessionId` → `terminalIdentity.erpNormalSessionId` UUIDv4 aile metadatasıdır; kendisi token veya tek başına yetki değildir. URL, postMessage, `confirmed:true`, userId veya bu UUID sunucu doğrulamasının yerine geçmez.

## Yapılandırma ve taşıma

Yalnız exact clean/E662, `MELISA_ERP_CLEAN_TEST_20261022`, synthetic=true/T1=false/externalOperations=false, API4194 ve mevcut korumalı ERP normal-session hedefinde kullanılabilir. Varsayılan kapalıdır. `MELISA_TERMINAL_LINK_ENABLED=true`, ayrı ve JWT anahtarlarından farklı 32-byte base64url `MELISA_TERMINAL_LINK_PEER_KEY` ve açık `MELISA_TERMINAL_LINK_RELATIONS` JSON listesi gerekir. Sırlar bu belgeye veya kaynak/GitHub'a yazılmaz. Relation satırı exact alanları: `erpUserId, crmUserId, chatwootAgentId, bindingRevision, active`. Revision küçük hex SHA256; kimlikler tekil, liste en fazla32. Boş liste hiç kimseyi bağlamaz. Bu kaynak gerçek çalışan ilişkisi tanımlamaz.

Yalnız aynı host çiftleri: ERP `http://127.0.0.1:5244` → CRM `http://127.0.0.1:62800`, veya ERP `http://192.168.1.46:5244` → CRM `http://192.168.1.46:62800`. İstemci başka alıcı seçemez.

Peer RPC doğrudan loopback socket + `x-melisa-terminal-peer` ister; Origin/Forwarded/X-Forwarded-For/Host reddedilir. Bu peer anahtarı native/browser'a verilmez. ERP frontend proxy bu anahtarı eklememelidir. Normal Bearer, peer yetkisi değildir. JSON body, query yokluğu, exact alanlar, boyut sınırı ve mevcut rate/security başlıkları korunur.

## ERP API

Başarılı cevaplar mevcut `{success:true,data:...}` zarfındadır. Hatalar sırsız generic403 `TERMINAL_HANDOFF_INVALID`; kapalı clean front gate operasyonu reddeder. Cache-Control=no-store. Hata ayrıntısı, token veya anahtar echo edilmez.

1. Native → ERP `POST /api/auth/terminal-handoff/prepare`, kendi normal Bearer ile exact body:
   `{refreshToken, requestId, deviceBinding, codeChallenge, erpOrigin, crmOrigin}`.
   Data: `{version:1, code, requestId, expiresAt}`.
2. Native → CRM `POST /api/live/auth/terminal-handoff` → gateway `/auth/terminal-handoff`, exact body:
   `{code, requestId, deviceBinding, codeVerifier, erpOrigin, crmOrigin}`.
   CRM bu altı alanı peer anahtarıyla ERP `POST /api/auth/terminal-handoff/redeem` yoluna iletir.
   ERP data: `{version:1, linkId, linkExpiresAt, terminalIdentity}`.
3. CRM → ERP `POST /api/auth/terminal-handoff/verify`, exact body:
   `{linkId, requestId, deviceBinding, erpOrigin, crmOrigin}`.
   Data: `{version:1, linkExpiresAt, terminalIdentity}`.
4. CRM → ERP `/api/auth/terminal-handoff/revoke`, aynı beş alan; data `{revoked:true}`. Yalnız eşleşen link kapanır. Bağ zaten yoksa da kapanış doğrulanmış kabul edilir; peer/schema/context retleri403kalır. Tekrar kapanış yeni yetki üretmez.

RequestId UUIDv4; deviceBinding native korumalı cihaz psödoniminin küçük hex SHA256 değeridir, kişi kimliği değildir. Code/verifier/linkId canonical32-byte base64url43; challenge SHA256(verifier) base64url43. Code en fazla30s, gerçek ERP erişim/ailesi süresiyle sınırlı ve atomik tek kullanımlıdır. Aynı request+device+origin çifti aile süresince ikinci code üretemez. Yanlış PKCE/request/device/alıcı yetki vermez. Sadece hash ve sırsız metadata process-local, sınırlı map'lerde tutulur; yeni ERP SQL/journal yoktur. Süreç yeniden başlarsa linkler kaybolur ve kullanım reddedilir. Link süresi normal ERP ailesinin sonudur; code30s sınırı değildir. Anahtar değişimi mevcut sağlayıcıyı kapatır; yeni süreç açık kaynak/config doğrulaması gerektirir.

`terminalIdentity` exact11 alan:

`version, environmentId, database, erpOrigin, crmOrigin, erpUserId, erpNormalSessionId, crmUserId, chatwootAgentId, bindingRevision, expiresAt`.

Identity expiresAt her verify'de yeniden üretilir, en fazla30s ve aile ömrüyle sınırlıdır; cache bu kontrolü atlayamaz. Mevcut JS get/put/clear ve parent activate/logout protokolü değişmez. Native ERP çıkış/hesap değişiminde kendi eski CRM ailesini kapatmalı; geç cevap/generation veya kapanış belirsizliği eski kullanıcıyı yayımlamamalıdır. Android'deki bu bağlayıcı henüz bu teslimin sonucu değildir.

## Kanıt

Değişen beş test dosyasında20 kontrol, mevcut CI offline guard ile PASS: doğru aile/11alan, prepare ve redeem yarışlarında tek sonuç, request replay, PKCE/device/alıcı/peer retleri, expiry/revocation/revision/değişen aile, async kapanış, exact clean/config ve gerçek rastgele loopback HTTP route. Mevcut authService sentetik SQL fixture yalnız SELECT yapabilir; normal login/refresh/logout ile aynı hash-store kullanılır. Başta sandbox tempfile-lock/loopback EACCES sonuçları ürün PASS sayılmadı; izinli host çalıştırmasında guard korunarak20/20 doğrulandı.

Bu kanıt gerçek kurulu API, native Keystore/cihaz veya insan kabulü değildir. Sıradaki mevcut E1 halkası CRM exact consumer + native provider bağlantısı ve kaynaklar eşlendikten sonra izinli ortak kurulumdur. B5'in gerçek9kişi bağı tahminle doldurulmaz; özgün kabuller/sayaçlar değişmez.
