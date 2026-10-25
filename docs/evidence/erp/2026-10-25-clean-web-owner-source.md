# Clean WEB5244: işbirlikçi owner devir bileşeni — SOURCE/OFFLINE

## 25 Ekim / 1644: rollback retry P1 için dar düzeltme

Tamamlanan CRM incelemesi `01a173b4-3cb8-7272-89eb-152ade5512f8`, başlangıç
`56d8ed222d816f554b6a030ab8507ff216a591e5` kaynağına **NO-GO / 1 P1** verdi.
Rollback child doğduktan sonra yayın koruma kontrolü reddedince evre
`CandidateStarted` kalıyor; aynı lease ile tekrar çağrı ikinci child doğuruyordu.
Bu sonuç önceki platform engelinden ayrıdır; erişim onayı anlamına gelmez.

Yeni regresyonda yalnız fixture rollback worker'ı kendi ikinci doğumunda, startup
satırını vermeden önce kendi mutable witness dosyasını değiştirir. Böylece gerçek
child doğar, yayın reddedilir; heartbeat ilk child'ın hâlâ çalıştığını gösterir.
Koruma bozukken tekrar ret, fixture witness geri getirildikten sonra tekrar yayın
denenir. Eski kaynakta test **SECOND_ROLLBACK_CHILD_AFTER_FAILED_PUBLICATION** ile
başarısız oldu: 1 FAIL / 0 PASS, 3734.0777ms.

Dar düzeltme retained `rollback` alanı ve child doğduktan hemen sonraki
`RollbackStarted` evresidir. Tekrar çağrı bu referansı doğrular ve aynı child'ı
yayınlar. Child kayıp/ölüyse doğrulama kapanır; yeni child doğurulmaz. Yeni lease
referansı sıfırlar. Public wrapper ve diğer guard/ACK/yetki kapıları değişmedi.

Hedefli GREEN: **5 PASS / 0 FAIL / 0 SKIP, 12217.9847ms**. Yeni regresyon + mevcut
rollback yanıt kaybı + candidate exit + candidate startup failure + kapalı public
giriş testleri çalıştı. Yeni regresyon aynı PID'yi, iki toplam rollback doğumunu
(ilk baseline + tek replacement), son ACK'ye kadar writer dışlamasını ve ACK/replay
sonrası ikinci child oluşmamasını doğruladı. Diğer eski testler/build/paket/CI
rerun edilmedi. Yerel RED/GREEN logları `.tmp/b5-rollback-retry-1644/` içinde.

Yalnız kendi geçici dosyaları/child/retained handle'ları kullanıldı; kurulu hedefe
bağlantı veya işlem yok. Yeni delta bağımsız incelemesi ve exact commit CI ayrı
bekler. Gerçek host binding/kurulum/GUI ve insan kabulü yapılmadı; **B5 açık**.

Bu teslim yeni bir servis/daemon/gözetmen/kurucu değildir. `start-owned-test.ps1`,
eski DB/4144/4146/5194 yolu, kurulu başlatıcı, pasif paketler ve gerçek süreçler
değişmedi. Normal giriş, veri veya GUI kabulü değildir.

## Okunan mevcut sözleşme

Kabul edilmiş web başlangıcı Node24 ile `vite preview --host 127.0.0.1 --port
5244 --strictPort` ve açık `apps/sites-workflow` CWD kullanıyor. Önceki kaynak
helper'ı PID/JSON kaydı tutuyor; eski süreçten işbirlikçi birth claim, elde
tutulan handle veya kesintisiz writer lease üretmiyor. Bu eksik JSON/mutex,
boş port, CIM CWD tahmini veya mevcut süreci benimsemeyle kapatılmadı.

`clean-web-owner.cs` aynı başlangıç biçimini dar bir **in-process** producer ve
consumer sözleşmesine taşıyor. Süreci doğuran host canlı kalmalı; kapasiteler
yalnız aynı host içindeki nesne referanslarıdır. Yeni IPC sunucusu, keşif veya
kimlik bilgisi paylaşımı yoktur. Başka süreçteki düz JSON bu nesneler değildir.

## Gerçek kaynak uygulaması

- `Child` yalnız `Process.Start` ile kendi oluşturduğu child'ın orijinal kernel
  handle'ını tutar. PID'den tekrar açma/kill veya mevcut süreç adoption API'si
  yoktur. Native creation time, executable ve OS command-line argümanları her
  ilgili eylemde aynı handle üzerinden denetlenir. CWD, o doğumun açık
  `ProcessStartInfo.WorkingDirectory` bağıdır; mevcut sürecin CWD'si tahmin edilmez.
- Claim güncel generation/PID/doğum/exe/CWD/argv/artifact içerir; veri tek başına
  yetki değildir. Lease internal constructor ve owner'ın aktif nesne referansıyla
  bağlıdır. Aynı gerçek `SemaphoreSlim` bütün işbirlikçi writer'larda kullanılır.
  Transition süresince tutulur; süre aşımı veya ACK kaybı otomatik bırakmaz.
- Snapshot dosyaları doğumdan **önce** salt okunur retained stream ile sabitlenir.
  Lease sırasında protection/candidate/rollback pinleri ve kontrol before-image
  tekrar doğrulanır. Kontrol dosyası elde tutulan karşılaştırmalı RW stream ile
  yazılır. Her son stop/start/publish/rollback/ACK sınırı taze lease/koruma ister.
  Korunan dış kapsam için trusted host'un mevcut salt okunur hash witness'ı da
  taze okunur; yeni bir SQL/finans motoru yoktur.
- Üretim host bağlantısı yalnız sabit clean DB/environment, WEB5244,
  API4194/native4196 korunumu ve iki sabit paket için tasarlanmıştır. Candidate
  kimliği açıkça **b89+CSSb6**, rollback b89'dur. Node/iki manifest pinleri sabittir.
  Mevcut immutable verifier'ın tam payload/dependency pin seti host precondition'ıdır.
- Gerçek host dalında yayın/ACK yalnız canlı own child + sabit5244 listener PID
  eşliği + immutable `legacy-admin.html` byte geri okumasından sonra yapılabilir.
  TCP/HTTP okumaları authority/admission üretmez. Bu üretim dalı bu tur çalışmadı.
- Child ortamı yalnız OS allowlist'i ve mevcut onaylı beş web ayarından oluşur;
  SQL/JWT/AI gibi parent sırları aktarılmaz. Production logları mevcut host sink'i
  üzerinden asenkron boşaltılır; log hatası sonraki doğrulamayı kapatır.
- Candidate publication, old-retired durumu ve rollback ayrı aşamalardır.
  Gerekçesiz tekrar start/publish/rollback reddedilir. Final ACK dosyaya flush
  edildikten sonra generation artar ve writer açılır. ACK yanıtı kaybında gerçek
  owner'dan outcome okunur; aynı ACK yeni etki üretmez, sonraki generation'da
  eski ACK reddedilir. Outcome dışarıdan değiştirilebilir authority değildir.
- Başlatma hatasında/child kaybında yalnız kendi kayıtlı child'larıyla, taze
  lease ve aynı pinler altında rollback mümkündür. Koruma/süre/IO belirsizliğinde
  otomatik restore veya kontrol dosyası üzerine zorla yazma yoktur. Dosya yazması
  güç kaybına karşı atomik rename/DB transaction garantisi olarak sunulmaz.

## İzole gerçek test ve sınırı

Yeni `clean-web-owner.test.mjs` yalnız kendi `melisa-web-owner-*` temp dizinini,
Node child'larını, retained handle'larını ve dosyalarını kullanır. Gerçek
PID/birth/exe/OS argv ve child'ın kendi stdout CWD tanığı okunur. Port açılmaz;
kurulu5244/API/native/CRM, HTTP/CIM/SQL veya özel env/store/DPAPI okunmaz.
Fixture worker, parent'a konmuş iki **sentetik** env sentinel'inin child'a
aktarılmadığını da gerçekten sınar. Cleanup yalnız kendi scope'u doğrulanmış
temp dizini ve kendi retained child handle'larıdır; production cleanup değildir.

Senaryolar: kapalı installed giriş; sahte PID/doğum/argv/CWD/generation;
gerçek busy writer; expire olmuş lease; publication/ACK kaybı; tek ACK replay;
başka generation; dosya/protection tamper reddi; gerçek child exit; gerçek aday
startup exit ve rollback; ikinci rollback/adoption reddi. Yerel tam sonuç ve
son kaynak hashleri mevcut B5 JSON/STATUS'ta tutulur. İlk sandbox PS policy
reddi, compiler warning ve fixture yol/zamanlama hataları saklandı; bunlar
üretim güvenlik açığına karşı RED kanıtı diye sayılmadı. Eski31/38/87/83 veya
kapanmış B5 iş akışları tekrarlanmadı.

**Görülmeyenler:** sabit5244 TCP/HTTP ready dalı, gerçek production writer/protection
callback'leri, gerçek bootstrap ve kurulum. Fixture başarıları bunlara PASS değildir.
Yeni kaynak için bağımsız inceleme/CI ayrı; insan kabulleri ve sayaçlar aynı.

## Hâlâ gereken tek runtime koşulu

Mevcut kabul edilmiş host, doğrulanmış **yeni başlangıçta** bu producer'ı kendi
child doğumuna bağlamalı ve kendi gerçek writer gate'ini, mevcut immutable paket
verifier'ını, taze salt okunur koruma witness'ını, onaylı web ortamını ve log sink'ini
aynı trusted host bağlamında sağlamalıdır. `CooperativeBirthBinding` normal
caller/JSON tarafından üretilemez; bu kaynakta mevcut runtime için issuer yoktur.
İşbirliği yapmayan eski/başka writer'ların yokluğunu bu bileşen ilan etmez.

Bu bağ kurulmadığı için `Get-InstalledCleanWebHandoff` hâlâ **ilk adımdan**
`B5_SUPPORTED_CLEAN_WRITER_HANDOFF_MISSING` döner. `0102` veya diğer mevcut
uygulama kapıları kaldırılmadı. Eski sürece retrofit/adoption yok; cold bootstrap
kanıtı gereklidir. Bu, kaynak ilerlemesini çalışan owner/kurulum diye göstermeyi
engeller. Yeni plan/ana ajan/finish tree veya genel installer işi açılmadı.

## Mevcut paket kanıtı korunur

61328 manifestli pasif WEBONLY için CRM1055 incelemesi GO/P1-P2=0: 645 kaynak
dosyasının tekil raw Git blobları, payload SHA'ları ve 6637 dependency dosyası
eşleştirilmiş. **Toplam `sourceInventorySha256` serileştirmesi bağımsız olarak
yeniden üretilemedi**; o alanın eşliği iddia edilmez ve tek başına kaynak kanıtı
değildir. Paket bu tur değiştirilmedi/yeniden derlenmedi. Installed=false ve
GUIafterfix=false; B5'in ikinci sonucu açık,1/3/4 teknik kapalı kalır.
