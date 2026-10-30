# Windows CI gruplarını ayırma önkoşulu

Kaynak snapshot: **35d3eeb267e4292fd0aca3aece1dbaf9e1a7b34a**. Dal:
`codex/windows-ci-isolation-20261030`. Bu teslim yalnız kaynak denetimi,
çevrimdışı envanter testi ve uygulama tasarımıdır. Workflow değiştirilmedi,
Windows grupları ayrı runner'da çalıştırılmadı, hız kazanımı ölçülmedi.

**30 Ekim 09:13 UTC sahiplik bilgisi:** yerel ERP sahibi canonical ve
Business5244 testlerini değiştiriyor. Aynı aktif işte `9558b666` CI workflowunu
da değiştirmiştir. Workflow sahipliği boş değildir. Bu snapshot güncel sahibin
teslimiyle yeniden karşılaştırılmadan uygulanabilir bağımsızlık kanıtı sayılmaz.
Ortak STATUS, workflow, runner, canonical, SQL, servis ve çalışan süreçlere yazı yok.

## Sonuç ve bağımlılık sınırı

İki grup arasında **kaynak fixture bağı** vardır; önceki test adımlarının
ürettiği dosyaya/kuruluma/environment çıktısına bağımlılık saptanmadı. Her
grup tam checkout ve Node 24 ile **ayrı temiz GitHub Windows VM** üzerinde
çalışacak şekilde tasarlanabilir. Bu sonuç aynı VM'de paralel test izni değildir.

- B6 `start-business-5244-owned.test.mjs:278–283`, Business grubundaki
  `business-5244-maintenance-dispatch.test.mjs:3–24` setup metnini çıkarır.
- Business `business-5244-managed-cancel.test.mjs:157`, B6
  `test125-bound-api-quiescence.test.mjs` içindeki `b6Fixture` ve
  `writerFixture` metinlerini; ayrıca retirement-state fixture metnini okur.
- `test125-bound-api-quiescence.ps1:4` → maintenance-plan (`:6`) →
  start-owned-test (`:4`) → canonical-business-sale-maintenance library zinciri.
- `start-business-5244-owned.ps1:4–11`, startup/web/retirement/dispatch
  library'leri ve native C# kaynağını yükler. Installer bazı testlerde
  `-Library` ile yüklenir (`install-business-5244-readpair.ps1:1492` dönüşü).
- Owner bundle producer `:184–189` on iki PS1/CS kaynağı listeler; test
  `:74–78` ek router/installer/producer/recovery kaynaklarını da okur.

Bu nedenle test entry dosyalarını kopyalamak veya sparse checkout yeterli
değildir. Tam checkout korunur; artifact, cache veya job çıktısı aktarılmaz.
Library importları gerçek kurulum/SQL çağrısı yapıldığı anlamına gelmez.
Producer CLI'leri bu incelemede çalıştırılmadı veya import edilmedi.

## Kullanılan kaynaklar

Aşağıdaki adlar `scripts/canonical/` altındadır. Satırlar snapshot'a aittir.
Tablo entry envanterini korur; transitive bağımlılığın otomatik olarak eksiksiz
çıkarıldığı iddia edilmez. Muhafazakâr drift kontrolü tüm 524 canonical dosyasını pinler.

| B6 entry (`.test.mjs`) | Gerçek yerel etki / fixture sınırı |
| --- | --- |
| canonical-business-sale-maintenance | PS5 (`:207`), benzersiz temp, gerçek CAS/journal/hash/stream; inert 1 MiB backup kilidi (`:763`). SQL komut/transaction fixture; SqlClient Closed kalır (`:637`). |
| prepare-business-sale-owner-bundle | `b6-owner-passive-*`, gerçek bundle/fsync, PS AST/library/stream, junction ve kendi Node subprocess'i. git/gh `fakeCp` (`:60–73`); runtime output temp'e taşınır. |
| prepare-business-sale-array-repair-owner | `melisa-array-repair-parser-*` ve PS5 parser (`:41–44`); wrapper yürütmez, producer CLI çağırmaz. |
| test125-bound-api-quiescence | `erp-b6-bound-*`, gerçek Node çocukları/CIM/retained handle/cleanup (`:403–449`), junction. Listener/health/task gözlemleri fixture. |
| test125-bound-maintenance-plan | `b6-refresh-running-*`, test başına dört gerçek Node çocuğu ve cleanup (`:40–46`, `:91`); task/listener/health/COM fixture. Negatif CLI config okumasında durur. |
| start-owned-test-component | Gerçek PS5/library (`:3–5`); PSModulePath çıkarılır; ayar ve HTTP fixture, runtime launcher yok. |
| start-business-5244-owned | `erp-5244-owned-test-*`, gerçek native Job/çocuk, junction, stream, temp Local mutex/pending. Dispatch fixture kaynağına grup dışı bağ (`:278–283`). |
| test125-read2b-pair | `melisa-read2b-*`, gerçek profil/CAS/hash/journal; task/process/listener ve recovery adaptörleri fixture (`:44–53`, `:128–146`). |

| Business5244 entry (`.test.mjs`) | Gerçek yerel etki / fixture sınırı |
| --- | --- |
| business-5244-startup-exclusion | `erp-5244-exclusion-test-*`, PS çocukları, gerçek SID/runtime-hash Global mutex contention/abandonment. Üretim pending yolunda gerçek existence kontrolü vardır. |
| start-business-5244-web | steady/preview/webonly temp JSON/manifest; 4144/5244 listener/HTTP fixture; negatif launch spawn öncesi durur. |
| business-5244-retirement-channel | `erp-5244-retirement-test-*`, gerçek pipe/server/client/SID ACL/handle; runtime literalini temp'e taşıyan C# kopyasından Global mutex/pipe. |
| business-5244-retirement-state | `erp-5244-retirement-state-*`, gerçek Job/çocuk/exclusive stream/CAS/archive; temp Local mutex/pending, CIM/listener fixture. |
| business-5244-maintenance-dispatch | `erp-5244-dispatch-*`, gerçek Job/çocuk/held stream; temp Local mutex, dış launch/preflight/API fixture. |
| business-5244-maintenance-commit | `erp-5244-maintenance-commit-*`, gerçek retirement/publication/archive/native çocuklar; sabit Global startup mutex ve üretim pending existence kontrolü. |
| business-5244-paired-maintenance | `erp-5244-pair-*`, `erp-recovery-loader-*`, gerçek seal/kilit/Job/çocuk, sentetik Node verifier; temp Local mutex; HTTP/TCP/API fixture. |
| business-5244-readpair-router | `erp-readpair-router-*`; mode/argv seçimi; runtime start/read throw ile kapalı, gerçek listener yok. |
| business-5244-readpair-install | `erp-readpair-install-*`, gerçek exclusive file/CAS, disposable pipe/process/observer/mutex; SQL/listener/task/HTTP sağlayıcıları fixture, installer library. |
| business-5244-managed-cancel | `b6-managed-current-*`, `b6-managed-candidate-*`, gerçek PS runspace Stop/finally/native çocuk/preheld mutex/handle cleanup; B6 ve retirement-state kaynak fixture bağı. |
| test125-read2b-prepared-api | `melisa-prepared-api-*`, gerçek seal/query handle/kendi Node çocukları; 4144/4146/5194 listener/task/HTTP fixture, gerçek TCP bind yok. |
| business-5244-readpair-admission | `erp-readpair-admission-*`, gerçek pipe/Job/çocuk/mutex/record CAS; temp runtime hash Global mutex/pipe; HTTP/listener/CIM/API fixture. |

Gerçek host-local mutex ve pending kontrolleri (`business-5244-startup-exclusion.ps1:7`
ve Owner lease girişi) nedeniyle bu testler ERP bilgisayarına veya ortak TEST'e
taşınmamalıdır. Sabit `C:\Sirket` literallerinin tamamı mock değildir. Testlerin
kendi çocuklarını sonlandırması/handle cleanup'ı korunur; çalışan ERP süreci hedef değildir.

Ortak gereksinimler: Windows PowerShell **Desktop 5.1**, yerleşik Management,
Utility, Security, CimCmdlets, NetTCPIP, ScheduledTasks modülleri; .NET/Add-Type,
Job/process handle, SID/ACL/junction yeteneği; Node24 PATH ve yazılabilir
TEMP/TMP/RUNNER_TEMP. Bazı çocuklar environment devralır, çoğu yalnız
SystemRoot/WINDIR/PATH/TEMP/TMP alır. Kurulum/npm/build/node_modules, çalışan ERP
portu, SQL/Vega veya credential gereksinimi saptanmadı. Bazı PS helper'larında
ayrı timeout yoktur; mevcut 20 dakika job sınırından ek süre garantisi çıkarılmaz.

## Hazır dar workflow tasarımı — uygulanmadı

Değişecek tek mevcut workflow: `.github/workflows/ci.yml`, Windows job bölümü.
Envanter/komutlar `scripts/ci/fixtures/windows-isolation/snapshot.json` içindedir.

1. `windows-startup-core`: mevcut diğer **12 adım**, özgün sıra ve komutlarıyla.
   `node scripts/ci/run.mjs windows-process-probe` ve onun mevcut offline
   environment/180 saniye bütçesi aynen kalır; PS test/source dosyaları tam checkout'tadır.
2. `windows-b6-profile`: mevcut B6 adımı **verbatim**, 8 entry,
   `--test-concurrency=1`.
3. `windows-business-5244`: mevcut Business adımı **verbatim**, 12 entry,
   `--test-concurrency=1`.

Üçü ayrı `windows-latest` job; her birinde mevcut pinned checkout
`11d5960a326750d5838078e36cf38b85af677262` / `persist-credentials:false`, pinned
setup-node `49933ea5288caeca8642d1e84afbd3f7d6820020` / Node24 ve
`timeout-minutes:20` korunur. Aralarında `needs`, ortak dosya/cache/artifact yok.
Test entry, skip koşulu, guard, retry veya timeout değişikliği yapılmaz.

**Gerekli birleşik sonuç:** `prepare-business-sale-owner-bundle.mjs:190,239–251`,
`prepare-business-sale-array-repair-owner.mjs:48,87` ve
`prepare-business-sale-preview-link-package.mjs:100`, hem push hem PR exact-head
CI'da `windows-startup-test`, `quality-build-test`, `secret-scan` adlarını arar:
her biri tam bir kere, completed/success ve boş olmayan steps. Ek job sayısı yasak değildir.
Bu tüketiciler değişmeden korunmalıdır.

`windows-startup-test` adını yalnız core job'a bırakmak bu sözleşme için yetersizdir.
Bu ad, üç Windows job'unun **tamamına needs** veren bir aggregate olarak korunur:
`if: ${{ always() }}`, `runs-on: windows-latest`, `timeout-minutes:20` ve tek
PowerShell adımı. Adımın üç ayrı environment alanına `${{ needs.<job>.result }}`
verilir; üçü de case-sensitive `success` değilse `throw` eder. Missing/empty,
failure/cancelled/skipped başarılı sayılmaz; `continue-on-error` kullanılmaz.
Job'daki gerçek adım, downstream boş-steps kontrolünü de korur. Çevrimdışı
`aggregateSucceeded` bu şartın modelidir; gerçek YAML'nın doğrulandığı iddiası değildir.

Linux quality/build/secret-scan, workflow triggers/permissions/concurrency,
required-check isimleri ve canonical kabul araçları değişmez. `always()` yalnız
sonucu reddeden aggregate içindir; testleri atlamak veya iptal edilmiş koşuyu
başarılı göstermek için kullanılmaz.

## Tekrarlanabilir kontrol ve kalan kanıt

Repo kökünde:

```sh
node --require ./scripts/ci/offline-guard.cjs --test scripts/ci/windows-isolation-inventory.test.mjs
node scripts/ci/windows-isolation-inventory.mjs
```

Sonuç: **9 test / 9 pass / 0 fail / 0 cancelled / 0 skip / 0 todo**.
Bağımsız salt okunur inceleme: açık P1/P2 bulgu yok; aynı 9 test yeniden geçti.
İkinci komut `snapshot-report.json` çıktısını üretir. Dış API/token/ağ veya
target test/helper importu/çocuk süreç yok; yalnız kaynak okumaları ve testin
kendi geçici küçük dosyaları kullanılır. Yeni test mevcut CI'a eklenmedi;
mevcut quality job yeni MJS dosyalarını yalnız syntax kontrolüne alır.

Snapshot workflow hash'i, tüm canonical ağacının sıralı `[path, raw-byte SHA256]`
kayıtlarının JSON SHA256'sı, dosya sayısı, mevcut runner/offline-guard ve API
carton directory test hash'i korunur. CRLF dahil ham byte farkı konservatif
olarak drift sayılır. Bu seçili kaynak pini tüm repo transitif closure kanıtı
değildir; tam checkout tasarımın koşuludur. Yeni SHA yazmak bağımsızlık
kanıtını yenilemez; değişen kaynak yeniden okunmalıdır.

**Sonraki en küçük iş:** aktif ERP sahibinin teslimi ve workflow sahiplik devri
sonrası yeni exact snapshot'ı karşılaştır; yalnız yukarıdaki Windows bölmesini
tek elde uygula. Aynı exact commit'te eski düzen baseline'ı ile yeni üç temiz VM
sonuçlarını, her komutun test/pass/fail/cancelled/skip/todo adetlerini ve
bekleme/çalışma sürelerini karşılaştır. Eski süre örnekleri farklı snapshot'a
aittir; test eşitliği veya yeni hız kazanımı yerine kullanılamaz. Native ACL,
CIM, junction, Job ve cleanup davranışları gerçekten çalışmadan hazır/PASS yok.
