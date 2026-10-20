# 19 Ekim — küçük, SQL'siz gerçek Hub başlangıç ve geri dönüş provası

ERP-DEC-066 / `ERP-LIGHT-REHEARSAL-20261019-1253`, mevcut P03 ve PR54 kapsamında tamamlanan dar teknik kanıttır. Yeni ana görev, veritabanı veya takip sistemi kurulmadı. Ortak kurulu TEST korunmuştur; bu prova ortak TEST'e yeni aday kurulumu veya insan kabulü değildir.

## Kaynak ve gerçek yürütme

Başlatıcı kaynağı `1433c96b12ec2b0f5f78025d703b5ed0a6555d50`; ilk Light kaynağı `d175c9ade66426370dc9fecb869387ecc95a380c`. Gerçek uygulama, mevcut Express route factory ve mevcut Hub middleware/statik dosyalarını kullanır. Shared girişinin SQL bootstrap ve terminal başlatması ayrıştırılmadı veya gevşetilmedi; route oluşturma ayrı factory'ye taşındı, Shared Host/socket/CSP/public-scope/terminal sırası regresyon testleriyle korundu.

Gerçek ortak `start-hub-web.ps1` içindeki paket ailesi, source prefix, owner, Node ve dosya/manifest pin kontrolleri çalıştı. Açık `-LightRehearsal` profili yalnız ayrı fiziksel rehearsal kökü ve `127.0.0.1:5354` kabul eder. Light ve Shared manifestleri birbirinin yerine geçmez. `Watch`, `RunId` ve `Attempt` Light için reddedilir. Ortak DB02 bootstrap/adoption ve iki COM gözetmeninin geçişi bu profilde çalıştırılmaz.

| Gerçek faz | Uygulama kaynak kanıtı | Başlatıcı | Sonuç |
| --- | --- | --- | --- |
| Eski | e59e07abf7ae2567cdc2adb93811fe29e0032fe5 | 1433c96b | Başlangıç kimliği ve HTTP doğrulandı; yalnız sahip olunan süreç kapandı. |
| Aday | 01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2 | 1433c96b | Gerçek candidate19 adı/pinleriyle başlangıç ve HTTP doğrulandı; süreç kapandı. |
| Eskiye dönüş | e59e07abf7ae2567cdc2adb93811fe29e0032fe5 | 1433c96b | Eski uygulama dosyaları tekrar başlatılıp doğrulandı; süreç kapandı. |

Her uygulama kaynağı, kendi değişmez paket manifestinden doğrulanan Hub modülü ve dört statik dosyadır; yeni başlatıcı/factory ayrı kaynaktır. Eski paketin tam SQL bağlı giriş programı başlatıldı denmez. Üç faz farklı gerçek child/parent kimliği, doğum zamanı ve tek loopback binding ile doğrulandı. IPC kapanışı ve başarıyla çıkıştan sonra port boşluğu her fazda kontrol edildi. Görev kurulmadı, yabancı PID sahiplenilmedi veya kapatılmadı.

Her fazda gerçek HTTP üzerinden HTML/CSS/iki JS byte hashleri, health kaynak etiketleri, CSP/no-store/nosniff, HEAD, yanlış Host/Origin/forwarded retleri, POST405 ve küçük sentetik okuma/ret sınırları kontrol edildi. Bu 17 kontrol günlük ticari işlem veya normal personel yetki kabulü değildir. Hub `pin=null` çalışır: dış servis probe'u yapmaz; ERP/CRM/terminal/LIVE hazırmış gibi gösterilmez. Normal kullanıcı kimliği ve günlük akış hazır oluşu kanıtlanmış sayılmaz.

## Küçük hedef ve korunmuş hata

- Başarılı run: `run-0fc2f8a5a4044935a5fcc2a4b07811a3`; 19 Ekim **13:22:56Z / 16:22:56 TR**. Sonuç `LIGHT_HUB_OLD_NEW_OLD_VERIFIED`, üç gerçek faz ve temiz kapanış.
- Yeni run26dosya / **426.366 byte**; ayrı kaynak kontrol paketi5dosya / **51.561 byte**, manifest `04015e3b8b453836764aabb0e363f9bec0fbefc86d8c60c446533a0202fd07dd`. Bu kontrol paketi shared uygulama kurulumu değildir.
- Express bağımlılık kapanışı mevcut immutable adaydan68paket/615dosya SHA ile ayrı pinlendi; node_modules veya Node binary kopyalanmadı. İki sentetik ürün, bir müşteri ve bir tedarikçi yalnız ayrı fixture alanıdır. SQL bağlantısı/SQL kopyası/yeni DB yok.
- İlk gerçek run `run-94163b8f0eda4bdaa6f73a7ab433d7c3`, `P03_LIGHT_HOST_DENIED` ile başarısız ve `cleanupConfirmed:true` olarak korunur. Node24 `fetch` yanlış Host değerini göndermediği için test geçersiz istek üretmişti; bağımsız loopback transport deneyi bunu gösterdi. Yalnız test probu sabit hedefli, süre/boyut sınırlı `node:http.request` ile düzeltildi; sunucunun Host403 şartı kaldırılmadı. Başarısız kayıt silinmedi veya PASS'e çevrilmedi; yeni source ve yeni run kullanıldı.

## Ortak TEST'in bağımsız önce–sonra okuması

Kaynak e59 / supervisor13b / CRM6bc kurulumu korunur. Önce ve sonrasında **11 listener bindinginin PID/doğum/adres/port kimliği**, iki mevcut görevin Running/action hashleri, 4184/4186 health source/DB02/copy/T1false alanları ve ERP5234/Hub5234/CRM62700 HTTP200 içerik SHA'ları aynıdır. Prova portu5354boştur. Bu, bütün SQL tablo içeriklerinin karşılaştırılması veya SQL restore/rollback provası değildir; `sqlContentCompared:false` açık tutulur. Driver'daki `sqlCalls:0` / `sharedRuntimeChanged:false` alanları tek başına bağımsız invariant kanıtı olarak kullanılmaz.

Shared SQL/runtime/config/store/task action/kurulum/servis restart, TEST125/veri/roller/karantinalar/LL/yedekler üzerinde işlem yapılmadı. Eski b264 engine `ROLLBACK_READBACK_FAILED/QUARANTINED`, journal/claim/lock kayıtları korunur; bu hafif mod onu READY yapmaz. LIVE/Vega/T1/main/CRM kaynak/gerçek mesaj/ücretli servis yok.

## Test, CI ve kanıt sınırı

İlk birleşik26hedefli kaynak/regresyon testi ve22API güvenlik/projection testi PASS. Son Host/partial-ready değişikliğinin9hedef testi PASS; bağımsız kaynak incelemesi GO. Windows CI yeni Light testini gerçekten çalıştırdı. Bunlar insan kabulü değildir.

- İlk kaynak d175c9ad: [PR CI39258071606](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39258071606) ve [push CI39258063430](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39258063430) SUCCESS.
- Son uygulanan başlatıcı/driver kaynağı1433c96b: [PR CI39259023951](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39259023951) ve [push CI39259015924](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39259015924) SUCCESS.
- Bu kanıt belgesinin teslim commit'i ve otomatik CI'si uygulama source/kurulumdan ayrı kaydedilir.

Bağımsız offline kanıt incelemesi başarılı proof SHA'sını, iki artifact'ın16dosya hashini ve eski/aday manifest kaynak bağlarını, üç gerçek fazı ve root önce–sonra kayıtlarını ayrı doğruladı: GO. İnceleyen ajan runtime/ağ/SQL işlemi yapmadı. Private kanıtlar repo dışındadır:

| Kanıt | SHA256 |
| --- | --- |
| Başarılı run `proof.json` | e870c2e844ca89069a030ca0aa7583bcfd426bba7f4c4354dd70f97b6b00eac2 |
| Başarısız ilk run `proof.json` | 85b31ae749eef30aaaffe7838b7540d730553b9ee8fa2df2b05614d6c842f493 |
| `light-hub-host-transport-1253.json` | 3e82e8b375ff2ad3d88d752590a4f1db90310e49987de0909d194ee9e4706cb3 |
| `light-hub-shared-after-final-1253.json` | 47bf380bc01620f82343c084bd05e672fe7b2823dbec965604893fdcfc684c3d |

Run kökü `C:/Sirket/ERP/rehearsal/ERP-LIGHT-REHEARSAL-20261019-1253/`; root önce/sonra/transport/operator kayıtları `C:/Sirket/ERP/reports/integration-audit-20261019/` altındadır. Ham süreç/SID/özel config/ticari ekran GitHub'a eklenmedi.

**Açık kalan:** Tam shared bootstrap/owner geçişi ve guarded ortak rollback bu provanın kapsamı değildir; yeni aday ortak TEST'e kurulmadı. Windows Computer Use mevcut Chrome URL'sini güvenle belirleyemediğinden GUI BLOCKED kaydı korunur, başka UI aracıyla aşılmaz. Yeni yan-yana personel/İlker turu veya insan kabulü PASS yok. Önceki gerçek barkod arama alanına ulaştı, katalog eşleşmesi0; yeni ürün bağı/ticari hareket ve fiziksel tekrar yok. Özgün USER_ACCEPTANCE ve49ERP/25CRM kapanışları aynı.

## Mevcut B264 için ayrı salt-okunur gözlem

19 Ekim16:54TR: tamamlanmış Light provası tekrarlanmadı. Mevcut `p03-pr54-late-old-observe.ps1` içindeki açık `-Generation CurrentB264` dalı, b264 failed attempt'in literal profile/before/settings/consumedclaim/zeroCandidate ve26outer/8recovery hash zincirini doğrular. VarsayılanHistorical639 davranışı/10fonksiyon gövdesi, canonicalFE ve99bV2 engine byte'ları aynıdır. Yeni dal V2'nin mevcut tam raw envanter ve held child/parent lifetime guard'ını kullanır; PID filtreleme/stop listesi genişletme yok. Yalnız exact `DryRun`/`Observe` kabul edilir; case alias IO öncesi reddedilir.

Kaynak **b75cc5e5d9b9b6eb896ae98a8be64618a98d5f1d**, observer SHA **d93f6d159d36b4a9ad2f5456b135189a373c9776be0bbf963cf3cca026b8517b**. 16hedef test PASS; bağımsız kaynak/özel root runner incelemesi GO. [PR CI39263344720](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39263344720) ve [push CI39263333013](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39263333013) exactsource SUCCESS. Root yalnız bu kapılardan sonra gerçek DryRun ve Observe çalıştırdı.

Gerçek sonuç `CURRENT_B264_LATE_OLD_OBSERVED_READY`; `observerOnly:true`, mutation/transitionAuthority/stopAuthority/newGenerationStarted false, locksRetained true. Bu yeni receipt historical engine'e READY event eklemez. Yalnız mevcut B264 transition dizininde `current-b264-late-old-observation-intent.json` ve `current-b264-late-old-observed-ready.json` protected CreateNew yazılmıştır; retry/locksilme/claimreplay/config/servis/SQL/deploy yok.

| Frame | Tam kontrol süresi | İlk tam frame sonrası kararlı süre | Sonuç |
| --- | --- | --- | --- |
| 1 |15.983ms|0ms|OK / aynı digest|
| 2 |14.185ms|14.696ms|OK / aynı digest|
| 3 |14.724ms|29.931ms|OK,30sn dolmadığı için READY yok|
| 4 |13.985ms|44.428ms|OK,4ardışık tam frame ile ayrı receipt|

Zamanlar13:53:48.9525178Z–13:54:49.3639223Z; bunlar sıcak mevcut sistemin yeni gözlemidir. Eski engine15:36:57TR→15:41:57TR beşdakika sonunda FAILED olmuş; son rolün başlamasıyla failure arasında33,150sn vardır. Bugünkü tamframe14–16sn süreleri kontrol maliyetinin anlamlı olduğunu gösterir; eski catch iç hata/timing tutmadığından cold failure'ın kesin sebebi iddia edilmez. Beşdakika veya kimlik kontrolleri gevşetilmedi.

Bağımsız root readback önceki baseline ile11listenerbinding PID/doğum/image/adres/port, ikiRunningtask/actionSHA, e59/DB02/copye16b/T1false health ve3HTTP200 içerikhashini aynı buldu. `sqlContentCompared:false`; tam SQL içerik veya finans/stok mutabakatı iddiası yok. Kurulu e59/13b/6bc korunur; yeni kaynak ortak TEST'e kurulmuş sayılmaz.

| Repo dışındaki kanıt | SHA256 |
| --- | --- |
| B264 `current-b264-late-old-observed-ready.json` |097b43d18467a2d594b04586e7ebb9cbcea4133c7dcd2154c4e24e1c8ed42dcf|
| `current-b264-shared-readback-1349.json` |5d30b52cfceb34b410e915deb3b264e83d347c27a7a32055a24165cf7da9686e|

DryRun/Observe root attempt/results aynı private integration-audit alanında `owner-current-b264-formal-*-1349-*.json`; orijinal runtimejournal/claim/failed event hashleri korunur. Ham süreç/argv/SID/özelconfig/ticari veri yayınlanmaz.

**Sonraki gerçek bağımlılık:** mevcut owner-successor modülü yalnız7b predecessor'ına bağlı, claim B264 tarafından tüketilmiş. Bu ayrı gözlem otomatik yeni Apply yetkisi değildir. Yeni exacttuple için B264 FAILED+bu receipt→taze eskitarget identity→tekil yeni claim/admission ve tamShared başlangıç/guardedrollback kapısı gerekir. Eski claim silinmez/replay edilmez; yeni ortam/port/DB yaratılmaz. GUI güvenlik reddi aşılmaz; personel/İlker normal ekran ve insan kabulü özgün ID'lerde BEKLİYOR kalır.

## B264 kapalı kabul kuralları ve gerçek tarihsel okuyucu

19 Ekim17:34TR / aynıP03: [d57b2d719c31e7183f7e60aa11abcbb7893cc95f](https://github.com/melihsnyldzz-ui/melisa-erp-v2/commit/d57b2d719c31e7183f7e60aa11abcbb7893cc95f) yalnız mevcut successor modülüne B264 dalını ve mevcut sharedIO'ya **ayrı salt-okunur** history reader ekledi. Yeni motor/Goal/tracker/DB/port yok. 639/7b kod prefix'i byte-equivalent korunur. Yeni reader, `runPr54SharedOwnerTransition` veya mevcut claimwriter'a seçici olarak bağlanmadı; bu iki yol B264'ü reddetmeye devam eder. Ürün/GUI kodu ve kurulu uygulama paketi değişmedi.

Yeni saf öneri yalnız exactAPP01ef/manifest8754 +CRM6bc/e276 +SUPeb5b37a555cb/manifest1a9 tuple'ını, ayrı `...-b264-successor.json` settings yolunu ve `successor-of-b264...lock.json` öneri yolunu tanır. Mevcut settings/claim dosyası yeniden kullanılmaz. CURRENT OLD, başarısız aday d461/fec değil **e59/ad3/SUP13b**'dir. Paket union'ı current4+new2=exact6; tarihsel d461 yürütülebilir sete sızmaz. Gelecek fresh before/current/ham8rol+2COM/protected/port/parent/taskXML bağları, actual nativeWeakMap continuity ve kazanılmış fiziksel inceleme token'ı zorunludur. Bool/caller digest/generic predecessor seçimi yok;15dkOS ve60sncurrent sınırları korunur. Fonksiyon yalnız öneri baytı üretir, `transitionAuthority:false/applyExecuted:false`; bu tur gerçekcurrent admission/öneri/claim üretimi yapılmadı.

### Gerçek yeni okuma

Exact [PR CI39269586844](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39269586844)/[push CI39269575175](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39269575175) SUCCESS sonrasında root, pinned source dosyalarından no-args `inspectPr54B264PredecessorIO()` çalıştırdı. **14:34:15.885Z B264_PREDECESSOR_HISTORY_VALIDATED**:12named+26outer+8recovery=46literal pin. ACL owner/SYSTEM exact2ACE, hash/no-reparse/hardlink/boyut, eventset ve yeni claim yokluğu önce–sonra doğrulandı. InheritedACL istisnası yalnız iki exactzero recovery/rollbacklock ve aynı protectedparent'tır. ≤8pinbatch/commandlimit/16MiB limitleri; dış ref, duplicate veya fazla event reddi korunur.

Reader çıktısı yalnız tarihsel closure kanıtıdır; canlı current-owner ya da Shared kurulum PASS değildir. `claimCreated:false`, stop/transitionAuthority/apply false; engine hâlâ `ROLLBACK_READBACK_FAILED/QUARANTINED`. Ortak dosya/servis/config/SQL yazması yok; root yalnız mevcut repo dışı audit alanına CreateNew attempt/result kaydetti. Eski source/runtime e59/13b/6bc ve tüm failedjournal/lock/consumedclaim kayıtları korunur.

### Karşılaştırma regresyonu ve dar düzeltmesi

Yeni JS digest'i için tek-frame ad-hoc capture önce `PARITY_DIGEST` ile reddedildi; failure silinmedi. İlk offline ad-hocPS↔JS eşitliği tek başına native uyum sayılmadı. Değişmemiş canonical observer'ın yalnız DryRun'ı actual229f eski özetini doğruladı; ardından immutable tanımların tek-frame native Hash girdisi salt okunur teşhisle alındı. Observe/stabilite döngüsü veya yeni readyreceipt çalıştırılmadı. Üç tanı okuması yeni karşılaştırma regresyonuna özgüdür; kabul edilmiş44sn/Light/CSV tekrarı değildir.

Native4478byte girdisi ile ad-hoc girdisinde owners8 satır/alan/değer/tip/sıra ve COM2 satırın değerleri aynıydı. **Tek fark COM dizisinin sırası:** native Terminal→Hub, ad-hoc/ilkJS Hub→Terminal. YeniJS yalnız bu finitepredecessor için exactTerminal→Hub sırasına düzeltildi; input array sırası sonucu değiştirmez, her isim tekil olmalıdır. Aynı native girdiyle actual229f digest parity PASS. PID/UID/doğum/binding/hash kontrolleri gevşetilmedi. Sistem ownerdrift'i veya hostversiyonu kaynaklı hata iddia edilmez; teknik düzeltme yalnız yeni karşılaştırıcıdadır, historicalengine değişmedi.

Yerel hedefli kontroller:11yeni saf-admission +5yeni readonlyIO +9current-successor +53etkilenenIO/historical =78PASS. Yeni negatifler geçerli başlangıçtan tek alan değişikliğiyle denenir; testfixture alias'ları kopyalandı. Gerçek PS5 sentetik serializer/ACL fixture'ları ve private immutable-history/native-input paritesi yerelde çalıştı. HostedWindowsCI sentetik kontrolleri çalıştırır; private artifact kontrolleri yalnız yerel kanıt olarak ayrıdır. Bağımsız kaynak incelemesi GO; normalGUI/insan kabulü değildir.

| Private kanıt | SHA256 |
| --- | --- |
| `owner-b264-history-admission-read-1434-result.json` |719a77b8cd99642e8d8b15f6dab76354330cc295cab3779b50bfc4900d586864|
| `b264-native-hash-input-1432.json` |6adcdce369676c14c9dd080bbcfdca0979e271b7e35e9ee7e84dde6d8f8d0184|

Repo dışı aynı `reports/integration-audit-20261019/` alanında kaynak/CI pinli operator/attempt ve ilk1421failure/1425diagnostic/tekcanonicalDryRun kaydı saklanır. Ham argv/SID/COM/özelconfig/ticari veriler GitHub'a eklenmez.

**Sonraki tek kapı:** B264 için V2/drainer ve normal physical-inspection çağıranı, tamShared başlangıç ve guardedrollback uyarlanıp kanıtlanmalı. Mevcut mutator FE/7b varsayımlarıyla bu yeni öneriyi yürütemez. Sonrasında taze before/yedek/native/copy/T1false/tek-owner ve exacttuple gerçekten sağlanmadan claim/Apply yok. Bu teslimde büyük kurulum/stop/restart/SQL/gerçek öneri/claim yapılmadı. Yeni kullanıcı parolası veya işletme kararı gerekmiyor; GUI güvenlik engeli ve özgün insan kabulü bekler,49/25 sayıları aynı.


## 20 Ekim — B264 V2 normal salt-okunur inceleme bağlantısı

Kaynak `4cceff0ee77e16e2d5afb0052488ea24e8f0b0d1`, aynı PR54. Bu teslim aynı mevcut TEST'in güvenli sürüm güncellemesine gerekli salt-okunur bağlantıdır; yeni TEST/ikinci sunucu/reset veya CRM6bc tekrar kurulumu değildir.

- Mevcut drainer ve normal observer'da varsayılan Legacy kalır. Yeni explicit B264InspectOnly yalnız Inspect / Shared Physical kabul eder; mutation/proposal/alias/eksik pin girdileri import/OS/COM öncesinde reddedilir.
- V2 `99b90fbd...` ve mevcut helper `e8ec0a37...` hashleri sabit. Exact old e59/13b + CRM6bc/native7a ve yeni01ef/eb5 toplam altı paket; settings,copy,T1false ve15dkbefore sınırı korunur. Observer aynı saf contract'ı yalnız pinned AST definition olarak kullanır.
- Yeni private physical transport gerçek normal observer → gerçek worker Inspect sırasını kurar. Kaynak kodu strictowner/SYSTEM ACL, no-reparse,hash ve deny-write tutamacı altında doğrulanan UTF8buffer'dan çalıştırılır; sonradan değiştirilebilir -File path yürütülmez. İçe aktarma hiçbir runtime IO yapmaz.
- Native worker ProtectedProcesses doğrulaması sonrasında profile'daki typed SQL service envelope frame'e bağlanır. SQL hizmeti normal owner/argv kimliği değildir. Review'ın bulduğu gerçek şema hatası bu şekilde kapandı; yalnız PID varlığına indirgenmedi. Koruma kontrolü gerektiğinde salt-okunur master SELECT yapabilir; gerçek Inspect SQL-free diye sunulmaz.
- Aynı8rol/2watcher, COMXML/enginePID, tam port tuple, strict probe/console classifier korunur. B264 token ayrı private WeakMap'te, orijinal raw/profile/before nesneleri+digest+refs+60sn ile bağlıdır. Validator/fake/clone/eski FE token yetki oluşturmaz.
- 639/7b owner-successor prefix hash'i değişmedi. Eski claimwriter/Apply dispatcher B264'e açılmadı. Frozen FE/V2 motorları ve geçmiş FAILED/QUARANTINED/claim/journal bytes aynı kaldı.

| Kontrol | Sonuç |
| --- | --- |
| Yeni B264 argv/pre-IO/contract/token/launcher/normal V2 observer testleri | 8 PASS |
| Aynı son koşuda etkilenen mevcut hedef kontroller | 98 PASS |
| Toplam yerel hedefli Windows koşusu | 106 PASS /0FAIL /0skip |
| Bağımsız review | SQLshape blocker düzeltildi; final source-only GO |
| Exact kaynak [PR CI39402289664](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39402289664) / [push CI39402283987](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39402283987) | completed SUCCESS; Windows/quality-build/secret-scan başarılı |
| Gerçek B264 current-owner admission / claim / Apply | ÇALIŞTIRILMADI |
| Yeni uygulama paketi / mevcut TEST güncellemesi | YAPILMADI |
| Normal GUI / cihaz / insan kabulü | Yeni PASS yok |

Worker rawSHA `34b490827edb41a5afdc8eb7d5870674f535ec16f347dc7d038ab4299830582c`; observer rawSHA `5ad242c0708eb3e12b35dedb85b365b0c1d6107826fd1704892612d5d4df26c5`. İki PS dosyası için Git -text byte koruması eklendi; source pinleri Windows checkout/archive'da değişmez. Engine FE SHA `fe053b5d070b5aff724c323e51a6a15b9d6f6de9b140f98f1bed81a6ad49e037`, V2 SHA `99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def` aynı.

Yerel log repo dışında `C:/Sirket/ERP/reports/integration-audit-20261020/b264-physical-source-final-0940.txt` (SHA256 `613ecd0890449bfbe9110ebdf3b3d57030be5aee020778f9cb8802e2db81dd09`). İlk fixture hataları (PS otomatik bound scope, VM realm, sentetik doğum saati) ve review SQLshape bulgusu nihai başarılı sonuç yerine geçirilmez. Yeni kaynak için hedefli testler yapıldı; kabul edilmiş44snOLD/Light/CSV ya da bütün işletme testleri yeniden açılmadı.

Güncel salt-okunur port/CIM/iki görev ve API/native test-health okuması: kurulu ERP e59e07ab / CRM6bc / supervisor13b, DB02/copye16b/actualT1false,11listener ve ikiRunninggörev. API/native ok:true; port process release kökleri aynı paketlere aittir. Süreç doğumları20Ekim olduğundan önceki19Ekim229f stable-owner kaydı fresh admission olarak kullanılamaz. Bu tek sağlık ölçümü tam native veri/backup sürekliliği veya normal GUI kabulü değildir. Private config sırları/ticari veriler GitHub'a eklenmedi; canonical kullanıcı dirty package-npm.test.mjs SHA d518d180... aynı kaldı.

**Kalan gerçek kapı:** fullShared başlangıç/guardedrollback ve bugünkü ownership dönemi için taze native/yedek/before/tek-owner kabulü. Tüketilmiş claim tekrar edilmez; eski ready receipt güncel diye sunulmaz. Bu koşullar kanıtlanmadan stop/restart/Apply yok. Mevcut TEST korunarak gerekli sürüm güncellenecek; LIVE/T1/gerçek ticari yazma yetkisi genişletilmedi. Mal kabul/satış/kasa/CRM ve insan/cihaz kabulü bu kontrol kaynağı bitti diye tamam sayılmaz.
