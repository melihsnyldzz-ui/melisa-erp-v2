# Korumalı Semih TEST girişi — destek sınırı — 12 Ekim 2026

ERP-COMPLETE01 içindeki dar erişim incelemesi; ERP-DEC-047 geçerlidir. Yeni yönetici rolü, hesap eşlemesi, izin, gizli giriş veya LAN endpoint kurulmadı. Parola istenmedi. İnceleme, hızlı giriş düğmesini kullanılabilir saymaz.

## Tek somut bağımlılık

**Semih için doğrulanmış normal TEST kimliği/rolü ve hedef Windows cihazında korumalı oturum hattı yok.** Mevcut kapsam yalnız personel15 ve İlker16 kimliklerini mühürler. Native auth/protected refresh bu kimliklerle sınırlı; yeni dört görevli personel yüzü `role.code=admin` DTO'sunu reddeder. Bu, eski native terminal login API'si için genel bir yönetici yasağı değildir. Etiketi Semih yapmak bu kimliği veya yetkiyi üretmez.

| Mevcut destek | Kaynak kanıtı | Sınır |
| --- | --- | --- |
| DB02 actor/role eşlemesi | `isolatedOperationCopyContext.mjs`59/84 | Yalnız15/personel ve16/İlker |
| Normal protected refresh | `authService.js`187/408 | Yalnız mühürlü15/16; genel login scoped operasyon izni değildir |
| Yeni dört görevli personel yüzü | `personnelTerminalModel.mjs`29–30 | `role.code=admin` reddedilir; eski native login yolu ayrı |
| Eski native terminal login API | `authService.js`290–323 | Aktif kullanıcı+rol+employees userId bağı gerekir; listede yoksa parola kontrolünden önce ret |
| Android kendi oturumu | `protectedDeviceSession.mjs`, `WorkTasksActivity.kt` | Exact origin/main-frame bridge ve Android korumalı depo; başka cihaz token'ı taşıma yok |
| Windows tarayıcısı | `apps/desktop`/workflow source incelemesi | Bu bridge'in DPAPI/safeStorage karşılığı bulunmadı; localStorage korumalı cihaz deposu değildir |

Root, çalışan204b63f / exact DB02/copy / sysadmin0-control0-LIVE0-orijinalDB0 ve normal15/me doğrulamasıyla `users`+`roles`+`employees` ilişkisini salt okunur sorguladı. Kullanıcı adı, görünen ad veya personel adında Semih adayı **0** bulundu. Bu, başka adla kayıtlı bir hesabın Semih'e ait olmadığını ispatlamaz; böyle bir kimlik eşlemesi doğrulanmış değildir. Parola/hash okunmadı, employee/role/user kaydı yazılmadı, kendi oturumu logout oldu. Private `readonly-candidates/semih-identity-readonly-result.json` bu sonucu saklar.

Eski native terminal login için eksik/pasif personel bağını supported employee yönetimiyle düzeltme, ancak exact TEST kullanıcısı gerçekten kanıtlanırsa anlamlıdır. Burada böyle bir kullanıcı/bağ saptanmadığından isim tahminiyle userId ataması yapılmadı. Eski login'in çalışması, yeni dört görevli yuzün sealed actor15/16 ve korumalı refresh sözleşmesini genişletmez.

Windows WebView süreçlerinin varlığı ERP'ye ait korumalı oturum bridge'i veya Semih kimliğinin kanıtı değildir. Mevcut korumalı normal15 giriş teslimi ve daha önce doğrulanmış İlker16 oturumu günlük teknik çalışmada kullanılabilir; yöneticiye yükseltilmez. Mevcut genel kullanıcı yönetimi route'u izole shared-copy API kapsamında mounted değildir. Destek dışı route ekleyip rol/seal guard'ını atlamak uygun çözüm değildir.

## Kapanma ölçütü

Doğrulanmış Semih normal TEST kimliği ile gerekli rol, desteklenen kullanıcı yönetimi ve mevcut native copy sözleşmesi üzerinden birlikte tanımlanmalıdır. Ayrı yönetici kapsamı mevcut ERP-DEC-047 personel yetkisinin genişletilmesi sayılmaz; direkt yetki ve güvenli kapsam gerekir. Hedef Windows cihazının kendi korumalı deposu ile normal login/refresh/me kimliği eşleşmeli; ilk açılış, kapat-aç, modül geçişi, logout/kullanıcı değişimi/revoke, başka origin ve başka cihaz retleri gerçek ortamda kanıtlanmalıdır. Android için mevcut bridge yeniden kullanılır; başka oturumun token'ı URL/HTML/QR/localStorage ile dağıtılmaz. LIVE'da geçici kolaylık kapalı olmalıdır.

Bu destek kurulmadan admin açan düğmeye bağımsız review GO yok. Kaynak veya düğme taslağı çalışan giriş diye sunulmadı. Semih helper **BLOCKED / NOT_IMPLEMENTED**, insan kabulü bekler; kullanıcıdan parola veya manuel tekrar giriş istenmez. TEST125/DB02/aktarımlar/roller/LL/holdlar/CRM/LIVE/Vega/T1/main aynı.

## Ana hedef ve bağımsız sıra

Bu sahibi sohbetinde `get_goal` null sonucu ardından kalıcı hedef `create_goal` ile oluşturuldu; araç sonucu **active**, token bütçesi verilmedi. Hedef mevcut tarihli veri temeliyle teknik ERP, dört görevli yeşil terminal, son ekranlara uygun eğitim ve geri dönüşlü geçiş hazırlığıdır. Bu araç kaydı Semih helper'ın veya genel teslimin bittiği anlamına gelmez; LIVE geçişi yetkisi değildir.

49 yaprak /9 tamam /39 kısmi /1 açık sayımı aynı;39 kısmi madde39 eksik kod özelliği veya tüm geliştirme oranı değildir. İnsan kabulü otomatik PASS olmadı. CRM sahibinin çalışması kendi projesinde kalır; burada CRM dosyası veya yönetici hesabı değiştirilmedi.

Normal dedicated TEST personeliyle bağımsız [200 ürün satış/koli provası](source-200-sale-proof.md) sürer. İlk gerçek çağrı sonrası request404 ve tam before-image eşitliği doğrulandı; iki kaynak adının native normalizer ile değişmesi teşhis edildi. Kaynak/TEST paket düzeltmesi ve native tekrar güvenliği tamamlanmadan200 vaka teslim edilmiş sayılmaz. TRY tutar sınırı ve stok yetersizliği gevşetilmez. Son cihaz/video, kişi/açılış işletme kanıtları ve CI hesap engeli ayrı kalır; parola talebi yok.
