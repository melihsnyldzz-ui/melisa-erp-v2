# B5 finans WEB geçişi — kaynak/offline bağlama

**Durum: kaynak ve offline doğrulama hazır; kurulum, normal GUI ve insan kabulü yapılmadı.** Mevcut PR54 / iki dosyalı `10b6535a` finans teslimi korunur. Yeni auth davranışı, uygulama derlemesi, installer, servis veya owner framework yok.

| Hedef | Kesin bağ |
| --- | --- |
| Değişmeyen API / iki rollback kökü | `C:/Sirket/ERP/releases/CLEAN-ERP-20261026-349fae354e2a-b6de5305-GREENCOMBINED-OFFLINE` |
| API ve eski WEB manifesti | `3aa51a25970b0efe512e865b5572c0378931a5eb848e1ab81ab571f4de19178f` |
| Yeni WEB | `C:/Sirket/ERP/releases/CLEAN-ERP-WEB-20261026-349fae-b6-10b6535a-B5LAZY-OFFLINE` |
| Yeni WEB manifesti | `ebb1ce99867a108f96b7fc2feea39b9904b0b023d052aa47a88c46f07f5150ed` |
| Mevcut normal API başlatıcı / rollback before-image | `75739cbe11e716d6736ccbb80b189d573a7c6f4d0fb3b3051ed704a896f72b21` |
| Yayımlanacak dar WEB başlatıcı | `c73d8c0e7088e6af25ab23ae99275f32b033e0cfe5bb9e09a4e4fe425c06fda3` |

## Mevcut one-off yöntemin kesin girişi

`clean-b5-pair-transition.ps1 -Library -FinanceReadPatch` yalnız mevcut bakım çağrısına sabit kaynak sözleşmesini yükler. `Get-B5Pins` içindeki `root/manifest/source` değişmeyen API349'u; `webRoot/webManifest` yeni WEB'i; `oldApiRoot/oldWebRoot` mevcut349+b6 geri dönüşünü tanımlar. WEB source349 + korunmuş CSSb6 + yalnız iki dosyalı read patch10b'dir; tam10b feature dalı değildir. Pasif WEB adayı ve 53 build çıktısı değiştirilmedi, yeni paket kopyası/derleme gerekmedi.

Mevcut bakım çağrısında yalnız şu bağlar ayrılır: API için `root/manifest`, yeni WEB doğrulama/başlatma/served-asset için `webRoot/webManifest`; context `newManifest` API'nin mevcut manifesti olarak kalır. API kaydı eski packageId ve kaynak/kökünü korur; yakalanmış yeni WEB child kaydı yalnız yeni WEB köküne bağlanır. WEB manifesti `Read-B5Artifact` üzerinden kendi exact hash'i ve tek Sites dependency kontratıyla doğrulanır; eski birleşik API/rollback kontratları değişmez.

API başlatma girişi mevcut `Start-B5OneOffApiWithRecordView` ve normal75739 kopyasıdır. `Get-B5FinanceReadStarterBytes` bu kopyadan yalnız WEB kökü, WEB manifest hash'i ve onun biçim/read-patch denetimi olan **62/63/66. satırları** değiştirir; çıktı c73 pinine eşleşmezse reddeder. Dosyayı çalıştırmaz/yazmaz. Son `Publish-B5HeldControls` için bu c73 byte dizisi kullanılır; API-only75739 dizisini yeni WEB yayını olarak reddeder. Geri alma aynı scope'un exact before-image'ı; rollback normal75739 ve her iki349+b6 köküdür. Eski b9/b89 bu profilin giriş veya geri dönüşü değildir.

Bu **WEB-only canlı değiştirme değildir**: mevcut bakım yöntemi hem API4194 hem WEB5244 kısa stop/start ister; API kodu/kökü aynı kalır. Native4196 ve CRM62800–62803 korunur. Geçmiş attempt02 çağrısı eski PID/kontrol/proof bağlarıyla **aynen çalıştırılamaz**. Finance profilinde kayıt digest'i özellikle boş bırakılır: yeni gerçek held-control byte'ları, karşılaştırılmış süreç/doğum/port kimlikleri ve sürekli sahiplik/koruma tanığı o bakım oturumunda taze alınmalıdır. Bu kaynak turu bunları üretmedi, kabul etmedi veya var saymadı.

`-FinanceReadPatch -Apply` kapalıdır; genel handoff/lease kapıları kaldırılmadı. Get/Assert/Complete handoff, lease, artifact/path/manifest, boundary/ticket, held-child, CAS/inverse, API child capture/start dahil **17 kritik fonksiyonun gövdesi** önceki10b ile satır sonu normalizasyonu dışında birebir aynı. Kontrolleri atlayan yeni kurulum komutu yok; bağımsız delta incelemesi ve taze bakım sahipliği olmadan kurulum GO değildir.

## Dar kanıt

Altı Windows PowerShell5 offline kontrolü **6 PASS / 0 FAIL / 0 SKIP, 7.344 saniye**: exact API/WEB/rollback pinleri ve kapalı genel giriş; DB/env/source/iki-overlay retleri; başlangıç dosyasının LF/CRLF ve değişmeyen diğer byte'ları; aday/rollback kayıt kökleri ve native satır; tek Sites dependency + lock retleri; iki farklı başlatıcı, aynı yayının ikinci etkisiz tekrarı, exact inverse ve mevcut köklere rollback. İlk deneme yalnız test dosyasındaki JS/PowerShell alıntılama sözdizimi nedeniyle başlamadı; düzeltme ve başarılı sonuç ayrı saklandı.

Gerçek pinli75739 kopyası salt veri olarak dönüştürüldü: c73 ile byte-eş, yalnız62/63/66 değişik; PS5 source/çıktı parse geçerli. İki mevcut manifest hash'i ve WEB scope'u okundu; payload/dependency envanteri veya uygulama kodu çalıştırılmadı. Önceki48 finans testi, geniş suite/build ve CI rerun yapılmadı. Bu yeni kaynak commit'inin CI ve bağımsız inceleme sonucu ayrıca değerlendirilir.

Private kanıt: mevcut `ERP-GREENCOMBINED-APIWEB-PREFLIGHT-20261026/private/finance-read-transition-source` içinde `starter-delta.json`, `source-readback.json`, `unchanged-guards.json` ve çalıştırılmamış c73 başlangıç kopyası; hedefli test günlüğü owner worktree `.tmp/b5-finance-read-binding-20261026/targeted-second.tap`. Ham özel kayıt/sır GitHub'a eklenmedi.

Runtime/GUI/TEST HTTP/SQL/CIM/stop/start/kurulum/credential/restore **0**. Kurulu ERP/CRM ve önceki pasif aday aynı. Oturum hatırlama yalnız önceki salt okunur teşhis olarak ayrı; yeni auth kodu yok. C6 ve insan kabulleri **BEKLİYOR**.

## Sonraki dar PRECHECK ve BOM okuyucu düzeltmesi

Koordinatörün ayrı dar PRECHECK talimatında mevcut `erp-processes.json` ham UTF-8 BOM'u, komut oturumundaki JSON dönüşümünü durdurdu. Bu erişim/ownership reddi değildir. İlk başarısız makbuz ve yalnız bellek/okuyucu tanısı private alanda korunur; dosya BOM'suz yeniden yazılmadı. Ardından verilen yalnız-okuyucu düzeltme yetkisiyle `ConvertFrom-B5Records`, decode edilmiş metnin başındaki tek U+FEFF'i ayırır. Girdi byte dizisi, before-image, hash ve CAS/inverse değişmez. Yeni tek offline regresyon PS5 ve PS7'de BOM'lu/BOM'suz üç düz satırı, ham byte eşliğini ve geçersiz kök/çift veya yanlış konumlu BOM reddini doğruladı: **1 PASS / 0 FAIL / 0 SKIP, 1.293 saniye**. Eski6/48 test, paket/build/envanter ve CI rerun tekrarlanmadı.

Düzeltme sonrası aynı dar PRECHECK **bir kez geçti** (26 Ekim10:16:29–10:16:35 UTC). Aktif API349 ve native035 exact package/DB/environment/T1false/izin sağlık kontrolü; mevcut349+b6 WEB'in üç static asset hash'i; yalnız4194/5244/4196/62800–62803 canlı port/PID/executable/doğum kimlikleri; iki gerçek API/WEB birth handle'ı; FileShare.None ile iki kontrol dosyası ve payload'ı okunmadan dokuz mevcut metadata kilidi; aynı pinli üç koruma sorgusunun schema doğrulaması ve final kimlik/byte/metadata eşliği tamamlandı. Genel süreç/servis/görev/hesap/oturum/envanter veya CIM taraması yapılmadı. Süreç kimlikleri ve koruma hash'leri GitHub'a konmadı.

Private makbuz: `finance-read-transition-source/precheck-bom-fixed-20261026T101629806Z.json`, durum `PRECHECK_PASSED_CONTROLS_RELEASED_NOT_APPLIED`. Başarılı PRECHECK sonunda bütün kilit ve handle'lar bırakıldı; bu dosya gelecekte geçerli owner grant değildir. Gerçek bakımda aynı sürekli dışlama/kimlik/koruma tanığı taze alınarak işlem boyunca tutulmalıdır. Desteklenen çağrı ve iki349+b6 geri dönüşü yukarıdakiyle aynı. Stop/start/Apply/yayın/kurulum/runtime ayarı/SQL yazması/restore/credential payload okuması **0**. Kurulum veya normal finans GUI kabulü yapılmadı; kök koordinatörde kalır. Bu yeni okuyucu commit'inin kaynak incelemesi ve exact CI'si önceki dab66 sonucundan ayrı değerlendirilir.
