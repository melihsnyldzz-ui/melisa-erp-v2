# B5 kişisel hesapların mevcut kalıcı normal oturumuna kabulü

24 Ekim 2026; yalnız ayrı kaynak dalı ve offline sentetik doğrulama.
Taban `095b8ce86f163a5fa5d7cc91620d9f59c5da6a90` (PR59).
PR58/PR59, owner E1/native/handoff ve Sites ekran kaynakları değiştirilmedi.

## Kapanan kaynak eksiği

Mevcut politika yalnız on eski clean aktörünün kalıcı oturumunu kabul ediyordu.
PR59'un yeni kişisel rol30/31/32 hesapları normal parola kontrolünü geçse de bu
aileye giremiyordu. Yeni sabit kişi ID listesi veya başka issuer eklenmedi.

Normal `authService` login ve `getUserById`, yalnız mevcut exact clean TEST ve
korumalı normal oturum yapılandırması açıkken, yeni kişisel aktörün üyelik,
etkin personel, etkin kullanıcı ve onaylı rol bağını tek güncel SELECT ile okur.
Parola doğrulaması mevcut bcrypt ile, JWT/refresh/confirm/family ve çıkış mevcut
mekanizmayla sürer. Kaynak SELECT gerçek SQL'e çalıştırılmadı.

Mevcut `semihTestIdentityPolicy` içinde bu sunucu okumasına bağlı WeakMap tanığı
kullanılır. Tanık, public DTO/JWT alanı değildir; JSON, `confirmed`, role veya
client-selected family bilgisiyle üretilemez. Yanlış hedef, eksik üyelik, yanlış
personel bağı, pasif kişi/rol, uyumsuz parola veya izin satırı ret verir.
İzinler PR59'un aynı rol tanımlarından karşılaştırılır; herkese admin verilmez.

Mevcut fingerprint'e yalnız yeni kişisel hesaplar için kullanıcı, rol, personel
ve izin satırlarının mevcut row_version değerleri ile üyelik bağı eklenir.
Değiştirip geri açılan haklar eski aileyi diriltmez; değişim iki istek arasında
olsa da sonraki okumada sürüm farkı bulunur. Eski on aktörün fingerprint düzeni
ve diğer hedeflerin politikası değişmedi. Grant dosyasının biçimi aynıdır.

Bu dar seçim yeni security-epoch şeması gerektirmez. İlgili kişi/rol/izin
satırında güvenlikle ilgisiz bir düzenleme de row_version değiştirirse mevcut
kişisel oturum yeniden giriş ister. Normal login/refresh yolu bu satırları
yazmadığı için olağan uygulama kapat/aç veya refresh bu etkiyi üretmez.

## Doğrulama

36 hedefli offline kontrol PASS. Yeni yedi senaryo gerçek bcrypt, JWT, auth
servisi ve mevcut geçici private grant dosyasını kullanır; SQL adaptörü yalnız
sentetik SELECT cevabı verir ve her INSERT/UPDATE/DELETE/MERGE/EXEC'i reddeder.

- Rol30/31/32 için normal giriş → refresh → session-confirm → sunucu aile
  okuması; geçici store yeniden açıldığında aynı ailenin korunması.
- Yanlış parola, üyelik/şema yokluğu, pasif personel, yanlış user/employee/rol
  bağı ve bozuk izin/proof karşılığı.
- JSON/DTO veya client alanlarıyla tanık üretilememesi, başka kişi/aile
  eşleştirmesinin ve native oturum opt-in'inin reddi.
- Yanlış hedef ve kapalı varsayılan; parola/rol/etkinlik/personel bağı/izin
  değişimi ve geri açma sonrası eski ailenin reddi.
- Refresh öncesi token ile çıkışın bütün aileyi kapatması, yeni girişin eski
  aileyi yeniden açmaması.
- Mevcut clean örnek, Semih, Shared politikası ve private store regresyonları.

İlk yerel sandbox çalışmasında eski store testleri dahil geçici dosya erişimi
`AUTH_SESSION_STORAGE_UNAVAILABLE` üretti. Aynı testler ve aynı offline guard,
yalnız geçici test dosyaları için yetkili komut ortamında geçti; kodda dosya
koruması kaldırılmadı. Microsoft ScriptDom yeni SELECT'i sıfır sözdizimi hatası
ile parse etti. Bu gerçek SQL izin/şema/yürütme veya kurulu ekran kanıtı değildir.

## Tek sonraki uygulama adımı

ERP sahibi PR58/PR59'un temel hesap ve kişisel iş kabulünü kendi hattında
tamamlar. Bu ayrı kaynak farkını exact CI ve dosya çakışma kontrolünden sonra
normal API adayına alır; kurulmuş gerçek clean şemada mevcut app hesabının bu
salt okunur SELECT'i yapabildiğini ve yeni açık sentetik hesabın normal
login/refresh/confirm/server-family akışını doğrular. Kaynak görevi gerçek
SQL/API/hesap/rol/cihaz veya runtime yapılandırması yazmadı.

CRM kimlik eşlemesi, gerçek kişilerin hesapları ve fiziksel Android kabulü bu
teslimle kapanmaz. B5'in tümü veya E1 tamamlandı iddiası yok; main merge/yayın yok.
