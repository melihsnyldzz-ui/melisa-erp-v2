# B5 sabit clean API + web geçiş kaynağı — 25 Ekim 2026

Görev: `ERP-B5-CLEAN-TRANSITION-ADAPTER-SOURCE-20261025-0808`.
**SOURCE_PARTIAL / NOT_EXECUTED / INDEPENDENT_REVIEW_PENDING**.

Bu teslim uygulama paketini veya çalışan TEST'i değiştirmedi. Yeni executor
yalnız API4194 + web5244 ve exact `349fae354e2a90852cd0594ada485105bf091e43`
uygulama paketine sabittir; manifest
`9614E9CF5747908D44FB5CEF181BA3D840820878FDBE6CF522BF0176E5C50059`.
Hedef clean DB ve environment kimliği sabittir; synthetic=true, actualT1=false,
externalOperations=false. Yeni DB, görev, watcher veya genel kurulum motoru yok.

## Uygulama kapısı hâlâ kapalı

`Get-B5WriterHandoff` üretimde ilk adımdan
`B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING` ile durur. Yeni mutex, boş port,
JSON onayı veya boş intent tablosu, eski yazarı durdurmuş sayılmaz. Eksik bileşen:
eski clean sahibi/gözetmeniyle işbirliği yapan, eski göreli komutun çalışma
dizinini doğrulayan ve geçiş/geri dönüş boyunca bütün yazarları dışlayıp son
yayın/retirement onayını veren desteklenen devir üreticisi. Bu kaynak o üreticiyi
uydurmaz; çağıran boolean'ı veya receipt'iyle kapı açılamaz.

Bu nedenle `-Apply` dahi ortak mutex, dosya, HTTP, SQL veya süreç işleminden
önce durur. Kurulum ve gerçek geri dönüş izni/kanıtı oluşmadı. Bağımsız kaynak
incelemesini mevcut koordinatör ayrıca devredecek; pasif artifact'in önceki GO
sonucu yeni executor için GO sayılmaz.

## Yeni kaynak ve hedefli kanıt

- Gerçek geçiş sırası ve kısmi geri dönüş kodu; eski b9 API + kabul edilmiş b89
  **B5FINANCEPROFILE** çifti sabit. Eski legacy DB/port doğrulayıcısı değişmedi.
- İleride desteklenen üretici bağlandığında tutulacak aynı-owner mutex,
  işlem/thread ve nesne kimliğine bağlı lease, tek kullanımlık ve süreli sınır
  bileti; her eylemde taze kimlik/koruma/port/intent kontrolü.
- Exact Node/manifest/payload doğrulaması, traversal/reparse reddi, salt okunur
  açık dosya tutamaçları; özel before-image ve kilitli karşılaştırmalı dosya
  yazması. Yazma elektrik kesilmesine karşı atomik rename garantisi değildir.
- PID yerine doğum zamanı doğrulanan retained kernel handle ile sonlandırma;
  kısmi spawn ve çıkış sonrası kayıp stop yanıtı kaydı. Yabancı/yeniden doğmuş
  süreç, değişmiş koruma veya kayıp lease halinde kurtarma da durur.
- Başlatıcı mevcut `-ApiWebOnly` / geri dönüş `-MainApiOnly` yolunu kullanır.
  Yeni child yalnız exact executable/argv/dizin/owner/parent ile yakalanır.
  Normal API kimliği ve loopback web dosyasının byte eşliği geri okunur.

**31/31 yeni hedefli kontrol başarılı**, Windows PowerShell 5 + Node24,
18,356 saniye; atlanan0. Üretim kapısının ilk adımdan kapanması, sahte sahiplik,
yanlış hedef/tip/hash/path, stale ticket, JSON dizi okuması, kısmi stop/spawn,
bozuk served byte, yabancı süreç ve koruma değişimi kapsandı. C# derlendi;
gerçek süreç handle'ı açılmadı veya sonlandırılmadı. Pozitif/geri dönüş akışı
RAM'deki OS/HTTP/SQL/devir yapraklarıyla gerçek orchestration üzerinde koştu.
Bir dosya CAS/freeze denemesi yalnız benzersiz geçici fixture dosyasındadır.

Bu testler gerçek kurulum, rollback, normal GUI, cihaz veya insan kabulü değildir.
Eski 87/83 uygulama testleri, build/paket ve kapanmış kaynak CI tekrar edilmedi.
Yeni Windows CI adımı yalnız bu izole kaynak testlerini çalıştırır.

## Korunan sınırlar

Ortak HTTP/SQL/GUI/login, servis/restart, config/store, hesap/rol/atama,
finans/stok ve ortak runtime yazması0. Son kayıtlı APIb9/webb89/native035/CRM476
bu tur taze sağlık diye sunulmadı; uygulama349 pasif kalır. TEST125/DB02,
Vega/LIVE/T1/main, yedekler ve eski journal'lar değişmedi. İnsan E2 ve özgün
17/74 sayacı aynı. Altı personel,10021 ve özel envanter izinleri genişlemedi.

Son gelen özel Müdür hesap yanıtı mevcut eski soru/hedefle eşleşiyor:
`b5-angela-20261024` daha önce normal formdan oluşturulmuştu. İkinci hesap,
parola yenileme veya tekrar atama yapılmadı; bu yanıt altı personelin onayı değil.

Makine kanıtı: [mevcut B5 kaydı](2026-10-24-b5-normal-access.json),
`cleanPairTransitionSource0808`. Teslim commit'i PR54 head kaydında;
operatör kaynağı commit'i uygulama349 veya kurulu paket source'u değildir.
