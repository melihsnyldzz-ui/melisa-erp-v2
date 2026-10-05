# AI Agent Entry Point

## Karar merkezi ve `devam` — 5 Ekim 2026

Kullanıcı ve ChatGPT iş/ürün kararlarını sohbetten planlar; onaylanan kararlar GitHub'da [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) içinde kalıcılaşır. Codex bu kararları uygular. Bu bölüm eski harita/finish-plan/tek-kırmızı yönlendirmelerinin **günlük sıra ve okuma düzenini** günceller; mevcut kapsam, kabul kanıtları ve işlem sınırları korunur.

Bu görev yalnız proje yönetimi belgeleridir; uygulama geliştirmesini veya duraklatılmış çalışmayı başlatmaz. Kullanıcının ilgili projeye daha sonra doğrudan yazdığı `devam / başla / sıradaki`, mevcut yetkili kapsamda aşağıdaki döngüyü başlatır. Belgedeki örnek komut veya rapor sorusu başlatma talimatı değildir.

1. Kanonik kök, fetch/push origin, aktif feature branch ve dirty durumu doğrula; kullanıcı işini koru. GitHub'daki ilgili doküman PR/commit'i ile okuduğun yerel sürümü eşleştir; eski checkout'u güncel plan sayma, dirty ağacı otomatik pull/merge etme.
2. Sırayla [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) → [DELIVERY_BOARD.md](DELIVERY_BOARD.md) → [STATUS.md](STATUS.md) → [ERP_FINISH_PLAN.md](ERP_FINISH_PLAN.md) oku. Ardından seçilen işin ilgili yerel/merkezi kuralları ve [USER_ACCEPTANCE.md](USER_ACCEPTANCE.md) kaydını oku. Aynı oturumda değişmeyen belgeleri tekrar okuma.
3. Panonun `ŞİMDİ` bölümündeki sırayı öncelik say; bağımlılığı karşılanmış en üstteki **onaylı ve tamamlanmamış** işi seç. Bekleyen insan kabulünü kapanmış sayma. ŞİMDİ içinde tamamlanmamış fakat bağımlılığı hazır olmayan işler varsa somut bağımlılığı kaydet; SONRA ile sıralarını atlama. ŞİMDİ tamamen tamamlandığında zaten onaylı SONRA sırasının ilk işi bağımlılığı hazırsa ŞİMDİ’ye taşı; bu yeni kapsam/öncelik kararı değildir. CANLIDAN SONRA veya sıra değişimi ayrı kullanıcı kararı ister. Panoda az sayıda iş bulunsun; yeni iş/öncelik kullanıcı kararıyla eklenir.
4. Kabul edilmiş işi yeniden yapma. Mevcut kapsam/commit kabulünü kullan; yalnız değişen akış, regresyon veya eksik kabul için hedefli kontrol yap. Kısa bildirimde seçilen iş ID'sini ve kullanıcıya görünen sonucu belirt. Bağımsız işleri açık dosya sahipliğiyle uygun ajanlara dağıt; aynı dosya veya serviste eşzamanlı değişiklik yapma.
5. Seçilen işi gereken kod, hedefli test ve teknik kanıtla tamamla. Teknik sonuç/kanıt ve runtime-kaynak ayrımı yalnız `STATUS.md` içindedir; finish tree'nin ilgili yaprağını güncelle, günlük sıra üretme. Kullanıcının gözle denemesi gerekiyorsa `USER_ACCEPTANCE.md` içine iş ID'si, kısa deneme, ortam/sürüm, kişi/tarih ve `bekliyor / PASS / FAIL` sonucu ekle. Teknik test PASS, kullanıcı PASS değildir.
6. İlgili değişiklikleri dar **branch → commit → push → PR** ile GitHub'a teslim et; uzak PR head ve aynı commit'in mevcut CI sonucunu doğrula. Kullanıcı kabulü beklemek kaynak teslimini durdurmaz. Pano durumunu teknik hazır/kullanıcı kabulü bekliyor/tamam olarak kanıta bağla; status'a karar veya roadmap kopyalama. Somut engelde kalan adımı yaz; onaylı hedef dışında kapsam ekleme.
7. `PROJECT_DECISIONS.md` kararını Codex tek başına değiştiremez. Yeni açık kullanıcı kararı geldiğinde yeni ID ile önceki kararı **supersede** et, gerekçe/tarih/kaynak bağını koru; eski kararın metnini veya geçmişini silme. Çelişkiyi tahminle çözme.

Panodaki iş bir gelecek çalışma talimatıdır; kendi başına runtime/SQL/Vega/gerçek müşteri gönderimi yetkisi değildir. İlgili görev kapsamı ve mevcut TEST/LIVE, gerçek alıcı, credential sınırları sürer. `devam` main merge/tag/release/LIVE deploy yetkisi vermez. GitHub kaynak teslimi deployment değildir.

Dosyaların rolü ve karar kayıt yöntemi [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) içindedir. [Ortak teslim haritası](MELISA_TESLIM_HARITASI_V1.md) tam teslim bağlamıdır; günlük sırayı pano belirler. Bu belge PR'si main veya diğer açık oturumları kendiliğinden güncellemez.

## GitHub geliştirme ve teslim kuralı — 3 Ekim 2026

- Her geliştirme **branch → commit → push → PR** olarak teslim edilir. Aktif, doğrulanmış geliştirme tabanından devam et; main'e doğrudan yazma, force-push/rebase ile mevcut kayıtları kaybetme.
- Önce [GitHub çalışma düzeni](docs/development/GITHUB_WORKFLOW.md), [sürümleme](docs/development/RELEASES.md) ve [TEST → LIVE / rollback](docs/development/DEPLOY_ROLLBACK.md) belgelerini oku. Kabul edilmemiş mevcut dalları otomatik birleştirme veya kapatma.
- PR'nin tam head commit'i için gerekli CI kontrolleri yeşil olmalıdır. Teknik PASS ve gerçek kullanıcı kabulü ayrı alanlardır; build/unit/secret scan sonucu kullanıcı kabulü sayılmaz.
- Kullanıcının tam PR/commit ve kapsam için kayıtlı kabulü olmadan main merge yok; auto-merge açma. Kabulden sonra değişen kod için etkilenen kontroller/kabul yenilenir.
- İlk ve sonraki sürüm tagleri yalnız kullanıcı tarafından kabul edilmiş, CI kontrolleri geçmiş main commit'inden oluşturulur. Feature dalını tagleme; mevcut görevin kapsamı tag/release/deploy yetkisi değildir.
- Her iş sonunda projenin kanonik STATUS dosyasına tarih, kapsam, teknik sonuç/kanıt, USER_ACCEPTANCE kaydı bağlantısı, branch, commit, PR, TEST/LIVE commitleri ve kalan somut iş yaz. Bilinmeyen bilgiyi `Durum doğrulanmadı` olarak kaydet. Kendi hash'ini içeren commit üretmeye çalışma: teslim commit'ini izleyen status kaydı veya PR head bağlantısı kullan.
- Son raporda branch/commit/PR, CI sonucu, güncellenen status ve kalan kullanıcı kabulünü açıkça belirt. `gh` işlemlerini ajan yürütür; kullanıcıdan komut öğrenmesi veya token paylaşması istenmez.
- CI yalnız GitHub-hosted runner üzerinde offline/sentetik kontrollerdir. Self-hosted runner, LIVE/TEST bağlantısı, gerçek secret, provider/SQL smoke, migration, deployment, gerçek mesaj veya ticari veri testi ekleme.

This repository is the Melisa ERP v2 application repository. It is AI-first, but it is also a live business system. Every AI agent must understand the safety rules before touching code, data, scripts, or documentation.

These instructions apply to Codex, ChatGPT, Claude, and any future AI agent working in this repository.

## Kanonik çalışma kökleri — 3 Ekim 2026

Bu yerel düzen kullanıcı tarafından onaylandı. Mantıksal proje adı Windows yolu değildir. SEMIH üzerinde yeni CRM/ERP geliştirme işleri yalnız aşağıdaki repo köklerinde yürütülür:

- MELISA CRM: `C:\Sirket\CRM\melisa-crm`; origin tam olarak `https://github.com/melihsnyldzz-ui/melisa-crm.git`.
- MELISA ERP: `C:\Sirket\ERP\melisa-erp-v2`; origin tam olarak `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git`.

Git işlemini repo kökünde yap; üst klasörü Git repo sayma. Başlangıçta kök, fetch/push origin, branch ve dirty durumunu doğrula. Aktif feature branch'i kullan; main'e rastgele geçme ve otomatik merge etme. Gerekli feature branch/commit/push/PR bu kaynak düzenleme kapsamındadır. Eski kopyalar yalnız arşiv/kanıttır: değiştirme, taşıma, silme veya snapshot yığınını yeni repoya kopyalama. Mevcut LIVE/TEST runtime, releases, logs, backups ve ticari verilere bu düzenleme işi kapsamında dokunma. Çalışan servis için kaynak repo checkout'u deployment değildir. Sonraki feature/restart/deploy yetkisini kendi görevinin kapsamından doğrula.

Yerel servis ve özel ayarlar kaynak repo dışında kalır. Repo yanında `releases`, `runtime`, `logs`, `backups` dizinleri bulunur; bunlara geçmiş paketler otomatik taşınmaz. Proje config'leri model/ajan varsayılanlarını taşır; host sandbox ve approval politikası korunur.

## CRM / ERP çalışma düzeni — 2026-10-03

Bu bölüm kullanıcının 2026-10-03 tarihli çalışma yetkisini kaydeder. Aşağıdaki eski
kurallar korunur; TEST geliştirme yetkisi, iş sıralaması ve aşağıda belirtilen
salt okunur LIVE inceleme sınırı bakımından bu bölüm geçerlidir. İş kuralları,
credential güvenliği ve LIVE değişikliklerinin onay sınırları sürer.

- Bu proje **ERP**'dir. Kanonik remote: `melihsnyldzz-ui/melisa-erp-v2`.
  CRM ayrı `melihsnyldzz-ui/melisa-crm` reposudur; ERP içindeki eski CRM klasörleri
  yeni CRM çalışmasının hedefi değildir. Diğer projelerde değişiklik yapma.
- Semih PC dahil her bilgisayarda önce `git remote -v`, repo kökü, branch ve
  `git status --short` ile kimliği doğrula. HTTPS/SSH remote aynı kanonik repoya
  çözülmelidir; fetch/push hedefleri farklıysa yazma. Yerel yol, port veya DB
  kimliğini klasör adından, geçmiş rapordan ya da bilgisayar adından varsayma.
- Proje klasörleri, eski çalışmalar ve kullanıcı değişiklikleri korunur. Projects
  alanının ileride yalnız CRM ve ERP olacak şekilde sadeleştirilmesi bu görevin
  silme, taşıma veya arşivleme yetkisi değildir.
- Önce yukarıdaki karar merkezi okuma sırasını izle. Günlük sıra `DELIVERY_BOARD.md`,
  tam kapsam/kabul ağacı `ERP_FINISH_PLAN.md`, teknik kanıt `STATUS.md` içindedir. Ardından aşağıdaki gerekli merkezi/yerel okumaları yap.
  Aynı görevde okunmuş ve değişmemiş belgeleri yeniden okumak gerekmez.
- Çalışan baseline'ı yeniden ispatlayan sprint açma. Mevcut commit, ortam ve kabul
  kapsamıyla uyumlu kanıtı kullan; sadece değişen akış, somut regresyon, hedef
  değişimi veya eksik kabul için ilgili kontrolü çalıştır. Eski kanıt güncel LIVE
  sağlığı değildir; işlem öncesi hedef kimliği kontrolü yine zorunludur.
- Panodan **bağımlılığı hazır en öncelikli onaylı işi** seç; ID, amaç, kabul kriteri, dosya sahipliği ve
  TEST hedefini kaydet. Bağımsız inceleme/backend/frontend işleri alt ajanlara
  böl. Aynı dosyaya eşzamanlı yazma yok; ortak sözleşmeyi önce ana ajan belirler,
  bağımlı işler sırayla ilerler. Plan/status güncellemesi ve entegrasyon ana ajana
  aittir. Alt ajan sonucu otomatik kabul sayılmaz.
- Varsayılan **GPT-6.1 Sol / Medium** (`gpt-6.1-sol`). Zor reviewer/sql-vega
  görevini açık `high` reasoning ile başlat; sıradan inceleme Medium kalır.
  Bu iki rol effort'u dosyada sabitlemez, varsayılanı veya açık spawn effort'unu
  devralır. Astra (`gpt-6-astra`) yalnız çok zor mimari belirsizlik için gerekçeli
  ana ajan/default-agent seçimi; sıradan kodlama ya da SQL için otomatik fallback
  değildir. Model yoksa sessizce başka model kullanma; sınırlamayı raporla.
- `.codex/agents/explorer.toml` salt okunur keşif; `backend.toml` API;
  `frontend.toml` web/terminal; `reviewer.toml` bağımsız salt okunur inceleme;
  `sql-vega.toml` salt okunur SQL/Vega analizi; `release.toml` salt okunur
  sürüm/rollback incelemesidir. Çalışanı yalnız atanmış dosya kapsamına yönlendir.
- İzolasyonu doğrulanmış TEST'te restart/build/test/branch/commit/push için tekrar
  izin isteme. Restart öncesi port → süreç/checkout → API → database/runtime
  eşlemesini doğrula; LIVE veya ortak servisi durdurma. TEST verisi sentetik olmalı.
  Bu yetki LIVE/Vega yazması, gerçek müşteri/ticari kayıt, mesaj gönderimi, veri
  kaybı, credential değişikliği ya da riskli backup/restore/reset yetkisi değildir.
  Bilinmeyen ortam TEST sayılmaz. Bu risklerde hedefi ve işlemi adlandıran açık
  onay, geri dönüş planı ve veri güvenliği gerekir. Salt okunur LIVE inceleme için
  yeniden onay isteme; gereken veriden fazlasını okuma, secret yazdırma.
- Feature branch/worktree kullan; dirty dosyaları devralma, reset/stash ile
  gizleme. İlgili kontroller ve reviewer sonrası dar commit/push yap, mümkünse
  PR aç; main'e otomatik merge veya auto-merge yok. Sandbox/kurumsal izinler
  devralınır; config üzerinden approval ya da credential korumasını kaldırma.
- PASS ancak seçili maddenin gerçek kullanım kabulü, uygun rol/izin, olumsuz
  senaryo ve gerekiyorsa audit/DB/idempotency/cihaz kanıtı tamamlanınca verilir.
  Build, smoke, mock, PR veya commit tek başına PASS değildir. Eksikleri
  PARTIAL/BLOCKED/NOT_VERIFIED olarak ve sonraki somut adımla raporla. Kabulde
  yeni kod gerekiyorsa ilgili testleri yeniden çalıştır; ilgisiz tam baseline yok.

### Tek kelimelik varsayılan — 3 Ekim 2026

- Kullanıcı ana Codex konuşmasında yalnız `devam`, `başla` veya `sıradaki` yazarsa bunu **ERP DELIVERY_BOARD ŞİMDİ listesindeki bağımlılığı hazır en öncelikli onaylı işi tamamla; gereken subagent'ları kullan, TEST'te gereken teknik işlemleri yap ve gerçek kabul hazır olunca dön** talimatı olarak uygula. Uzun komutu yeniden yazmasını veya rutin iş için tekrar onay vermesini isteme.
- Karar merkezi okuma sırasını ve pano seçimini uygula; finish plan tam kapsam, `STATUS.md` teknik kanıttır. Eski `ERP_STATUS.md` yeni durum kaynağı yapılmaz.
- Seçilen işi yukarıdaki çalışma düzeniyle tamamla: gereken explorer/backend/frontend/reviewer/sql-vega/release subagent'larını açık dosya sahipliğiyle görevlendir, sonuçları birleştir ve doğrulanmış TEST'te gerekli kod düzeltmesi, build, kurulum, restart, test, feature branch/commit/push işlemlerini yürüt. Verilmiş TEST yetkisi için yeni gate, bridge veya approval döngüsü oluşturma; eski genel onay metinleri bu kapsamda tekrar izin isteme gerekçesi değildir.
- Çalışan baseline'ı yeniden ispatlama; yalnız değişen akış, somut regresyon veya eksik kabul için hedefli doğrulama yap. Kullanıcı kabulünü `USER_ACCEPTANCE.md` içine, teknik kanıtını status ve ilgili finish yaprağına bağla. Personelin veya kullanıcının fiziksel kontrolü gerekiyorsa teknik hazırlığı tamamlayıp yalnız kalan somut kabul adımını iste; build/smoke/mock sonucunu gerçek kabul veya PASS yerine koyma.
- Yukarıdaki runtime kimliği, TEST/LIVE, Vega/gerçek ticari kayıt, mesaj gönderimi ve credential sınırları sürer. Kısa komut main'e otomatik merge veya LIVE değişiklik yetkisi vermez; açık madde kalmadıysa tamamlanmış işi yeniden başlatmadan mevcut sonucu bildir.

### Semih PC'de kullanım

Yerel checkout'u remote üzerinden doğrula, ilgili setup branch/PR'yi getir ve
bu repo kökünü ERP projesi olarak aç. Dirty/live checkout'ta branch değiştirme;
izole worktree kullan. Codex'in proje config'ini yüklemesi için projeyi kullanıcı
güvenilir olarak seçmelidir; 3 Ekim kök standardizasyonu yalnız bu iki doğrulanmış repo için yerel proje güvenini kaydeder; host sandbox/approval politikası değişmez.
Yeni oturumda `.codex/config.toml` ve agent keşfini kontrol et. Dosyaların GitHub'da
bulunması Semih PC'de etkinleştiğini veya LIVE'ın hazır olduğunu kanıtlamaz.

Kısa komut: **`devam`**, **`başla`** veya **`sıradaki`**. Ana ajan yukarıdaki varsayılanı otomatik uygular.

## Required Reading Order

Before making any change, read in this order:

1. The central Melisa OS knowledge base:
   - Repository: https://github.com/melihsnyldzz-ui/melisa-os
   - Start with the reading order in `melisa-os/README.md`.
2. Local AI instructions:
   - `docs/ai/README.md`
   - `docs/ai/local-agent-rules.md`
   - `docs/ai/safe-change-protocol.md`
   - `docs/ai/melisa-os-integration.md`
3. ERP product and architecture documentation:
   - `docs/erp-v2/README.md`
   - `docs/erp-v2/karar-defteri.md`
   - `docs/erp-v2/implementation-roadmap.md`
   - `docs/erp-v2/stabilization-roadmap.md`
   - `docs/erp-v2/production-readiness-checklist.md`
4. Current repository state:
   - Inspect `git status` before changing anything.
   - Identify dirty, untracked, or user-owned files.

## Non-Negotiable Rules

- Never expose secrets, tokens, passwords, SQL credentials, WhatsApp keys, or `.env.local` contents.
- Never touch production data, live SQL Server writes, backup/reset actions, external messages, or deployments without explicit human approval.
- Plan before coding, especially for business logic, database, auth, finance, inventory, import, terminal, or external integration changes.
- Make small, safe commits with a single clear purpose.
- Keep documentation updated whenever behavior, workflow, setup, safety rules, or business operations change.
- Never silently change business rules. If a requested change conflicts with `docs/erp-v2/karar-defteri.md` or Melisa OS, report the conflict and ask for human confirmation.
- Do not mix unrelated changes in one commit.
- Do not include tool-specific local folders such as `.claude/` unless explicitly requested.

## Default Work Style

- Prefer documentation-only planning before risky changes.
- Prefer read-only verification before write operations.
- Prefer local/lab/test data over production data.
- If a task requires production access, stop and ask for explicit approval.
- If uncertain whether an action is risky, treat it as risky.
