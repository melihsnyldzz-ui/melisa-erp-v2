# CRM06 — normal TEST kimliklerinin dar owner hazırlığı

14 Ekim 2026. ERP-DEC-047 / CRM-DEC-011 ve kalıcı çalışma sözleşmesi kapsamında mevcut normal parola/SID mekanizmasının desteklenen startup yapılandırmasına bağlanan operator hazırlığıdır. Yeni auth motoru veya anonim giriş yoktur. CRM06 kapanışı ve insan kabulü ayrı kalır.

Eski korumalı giriş kaydının bulunmaması son engel kabul edilmedi. Kurulu5b6 kaynakta kullanıcı create/reset API'si yoktur; desteklenen kullanıcı kaynağı private startup JSON ve mevcut scrypt yordamıdır. Yeni ayrılmış TEST yönetici mevcut `mudur`, yeni personel mevcut `personel` rolünü temsil eder; var olan hesap veya rol yükseltilmez. Mevcut yedi giriş aynen korunur. Personel gönderim izni etkinse hazırlık reddedilir, kendiliğinden değiştirilmez.

Saf constructor yalnız iki sabit yeni kimliği ekler. Yeni immutable baseline ve safe audit exact kaynak/DB/port/issuer/journal sınırına bağlıdır. Supervisor'ın eski private path/tek issuer guard'ı bypass edilmedi; sadece bu exact TEST hazırlığı için incelenmiş üç private-ref/iki issuer dalı eklendi. Başlangıçta actual pinned baseline'daki dokuz hesap ve eski yedi hash safe receipt ile yeniden karşılaştırılır. Metadata normal auth yetkisi değildir; resmi login, güncel rol ve issuer SID hâlâ gereklidir.

Yeni credential hazırlığı CurrentUser DPAPI, owner/SYSTEM korumalı klasör, sabit actor/copy ve açık cipher SHA kullanır. Sır argv/sohbet/log/source/Git içine alınmaz. Import-safe reader'ın password alanı enumerable değildir; yalnız normal giriş tüketicisinin RAM'inde kullanılabilir. Önceden var olan dosya/reset/adoption yoktur. Yarım hazırlık varsa dosyalar korunur, otomatik temizlenmez.

Supervisor-only immutable bundle mevcut ERP/native7a ve CRM5b uygulama bileşenlerini yeniden build etmez veya değiştirmez. Eski Hub, dependency lock, operasyon/native config ve journal/request-store korunur. Yeni constructor/config bağlantısı ve actual görev kurulumunu ERP sahibi tek yazar olarak yürütür; CRM sahibi normal müşteri/personel/mobil akışı yürütür.

Kaynak incelemesi GO; hedefli guarded constructor10 + credentials3 + projection6 + mevcut supervisor39 = **58/58 PASS**. Bu sayı actual dosya/DPAPI/login veya GUI PASS değildir. Gerçek korumalı hazırlık, runtime preflight ve normal oturum sonuçları STATUS'ta ayrı güncellenir.

Yeni personel için kalıcı refresh henüz desteklenmiş sayılmaz; mevcut sabit agent3 refresh ailesi değiştirilmez. Yeni yönetici mevcut issuer refresh/SID yolunu kullanır. Gerçek müşteri mesajı, ücretli servis, ERP stok/cari/fiş/satış, LIVE/Vega/T1/main veya iptal edilmiş Semih yardımcısı bu kurulumun parçası değildir. Eski kabul/restore yeniden çalıştırılmaz.

## Gerçek operator kurulum sonucu

15:09:57 yerel saat: aynı core görevin yalnız action'ı yeni supervisor7a081 paketine geçirildi. ERP/native7a41 ve CRM5b6 uygulamaları korunur. Scheduler wrapper'ı durdurup çocukları bırakınca kurulum failclosed durdu; exact owner/creation/fullargv/receipt ile gözlenen supervisor ve altı çocuk retained Windows process HANDLE üzerinden, gerçek çıkışı beklenerek kapatıldı. Hiçbir genel PID/tree kill veya SQL yazması yok. Hub görevi ve PID728 korunur; principal/trigger/settings aynı. Taze altı OS guard, DB02/copy kimliği ve native/API health doğrulandı. Bu başlatma, Windows yeniden giriş veya kesinti kabulü değildir.

12:21:44Z resmi normal API: ayrı yönetici mevcut mudur/agent2; issuerSID, refresh aynıSID, kendi logout ve iptal sonrası401 doğrulandı. TEST ADMIN, rol yükseltme, ücretli AI, liveSend ve root ürün talebi0. Diğer kullanıcının ailesi iptal edilmedi. Yeni personelin kalıcı refresh sınırı aynı kalır.

Credential okuyucusu PS7 çağırıcısının module path'ini WindowsPS5.1'e aktarınca failclosed reddetti; bu aşamada giriş yapılmadı. Dar düzeltme sadece ACL/DPAPI alt süreçlerinin system Modules ortamını seçer, global process.env veya uygulama config'ini değiştirmez. Gerçek korumalı manager/staff tüketimi2/2 ve hedefli envelope test3/3 geçti; sırlar çıktıya taşınmadı. Bağımsız kaynak incelemesi GO. Yeni reader immutable consumer teslimi uygulama veya supervisor yeniden kurulumu gerektirmez.

Kamuya açık rapor kimlik/tutar/credential/store içermez. Private hazırlık, encrypted credentials, görev before-image, shutdown snapshot, activation receipt ve normal auth proof repo dışı korumalı runtime alanındadır. Normal müşteri/personel/mobil GUI ve ERP'nin aynı kayıt için no-sale readback'i tamamlanmadan CRM06 veya insan kabulü PASS değildir.
