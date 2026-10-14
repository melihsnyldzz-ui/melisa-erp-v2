# CRM06 — normal TEST kimliklerinin dar owner hazırlığı

14 Ekim 2026. ERP-DEC-047 / CRM-DEC-011 ve kalıcı çalışma sözleşmesi kapsamında mevcut normal parola/SID mekanizmasının desteklenen startup yapılandırmasına bağlanan operator hazırlığıdır. Yeni auth motoru veya anonim giriş yoktur. CRM06 kapanışı ve insan kabulü ayrı kalır.

Eski korumalı giriş kaydının bulunmaması son engel kabul edilmedi. Kurulu5b6 kaynakta kullanıcı create/reset API'si yoktur; desteklenen kullanıcı kaynağı private startup JSON ve mevcut scrypt yordamıdır. Yeni ayrılmış TEST yönetici mevcut `mudur`, yeni personel mevcut `personel` rolünü temsil eder; var olan hesap veya rol yükseltilmez. Mevcut yedi giriş aynen korunur. Personel gönderim izni etkinse hazırlık reddedilir, kendiliğinden değiştirilmez.

Saf constructor yalnız iki sabit yeni kimliği ekler. Yeni immutable baseline ve safe audit exact kaynak/DB/port/issuer/journal sınırına bağlıdır. Supervisor'ın eski private path/tek issuer guard'ı bypass edilmedi; sadece bu exact TEST hazırlığı için incelenmiş üç private-ref/iki issuer dalı eklendi. Başlangıçta actual pinned baseline'daki dokuz hesap ve eski yedi hash safe receipt ile yeniden karşılaştırılır. Metadata normal auth yetkisi değildir; resmi login, güncel rol ve issuer SID hâlâ gereklidir.

Yeni credential hazırlığı CurrentUser DPAPI, owner/SYSTEM korumalı klasör, sabit actor/copy ve açık cipher SHA kullanır. Sır argv/sohbet/log/source/Git içine alınmaz. Import-safe reader'ın password alanı enumerable değildir; yalnız normal giriş tüketicisinin RAM'inde kullanılabilir. Önceden var olan dosya/reset/adoption yoktur. Yarım hazırlık varsa dosyalar korunur, otomatik temizlenmez.

Supervisor-only immutable bundle mevcut ERP/native7a ve CRM5b uygulama bileşenlerini yeniden build etmez veya değiştirmez. Eski Hub, dependency lock, operasyon/native config ve journal/request-store korunur. Yeni constructor/config bağlantısı ve actual görev kurulumunu ERP sahibi tek yazar olarak yürütür; CRM sahibi normal müşteri/personel/mobil akışı yürütür.

Kaynak incelemesi GO; hedefli guarded constructor10 + credentials3 + projection6 + mevcut supervisor39 = **58/58 PASS**. Bu sayı actual dosya/DPAPI/login veya GUI PASS değildir. Gerçek korumalı hazırlık, runtime preflight ve normal oturum sonuçları STATUS'ta ayrı güncellenir.

Yeni personel için kalıcı refresh henüz desteklenmiş sayılmaz; mevcut sabit agent3 refresh ailesi değiştirilmez. Yeni yönetici mevcut issuer refresh/SID yolunu kullanır. Gerçek müşteri mesajı, ücretli servis, ERP stok/cari/fiş/satış, LIVE/Vega/T1/main veya iptal edilmiş Semih yardımcısı bu kurulumun parçası değildir. Eski kabul/restore yeniden çalıştırılmaz.
