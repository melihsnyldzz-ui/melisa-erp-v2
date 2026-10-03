# AI Agent Entry Point

This repository is the Melisa ERP v2 application repository. It is AI-first, but it is also a live business system. Every AI agent must understand the safety rules before touching code, data, scripts, or documentation.

These instructions apply to Codex, ChatGPT, Claude, and any future AI agent working in this repository.

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

## Codex Multi-Agent Çalışma Düzeni (2026-10-03)

Bu ek, yukarıdaki mevcut talimatları korur ve kullanıcının bu çalışma için verdiği açık yetkiyi uygular. Konuşmadaki daha dar veya daha yeni kullanıcı sınırı önceliklidir. Eski genel "her işlem için approval" ifadeleri, aşağıda açıkça yetkilendirilmiş TEST işlemleri için yeniden izin isteme gerekçesi değildir; LIVE, secret ve iş kuralı sınırları korunur.

### Başlangıç ve tek iş

- Türkçe çalış ve raporla. Her yeni görevde önce `ERP_FINISH_PLAN.md`, `docs/erp-v2/current-status.md`, ilgili bulgu/kabul kayıtları ve yukarıdaki zorunlu merkezi/yerel talimatları oku. Plan kökte yoksa mevcut kaynak belgelerden türet, tamamlanma veya kabul durumu uydurma.
- Repo kimliğini `git remote -v` üzerinden `melihsnyldzz-ui/melisa-erp-v2` ile doğrula. Başka PC'deki yolları Semih PC yolu varsayma. Erişim yoksa yapılmış gibi raporlama; yalnız gerekli erişim adımını kullanıcıdan iste.
- Git durumunu ve kullanıcı değişikliklerini koru. Ayrı feature branch kullan; main üzerinde uygulama yapma, main'e otomatik merge etme.
- Plan/status içinden tek kırmızı madde seç. Amaç, kapsam, sahip dosyalar, ortam, gerekli regresyon ve gerçek kabul ölçütünü kısaca belirt. Yeni bulgu olmadan kapanmış baseline veya sprintleri yeniden açma; ilgisiz refactor/ürün özelliği ekleme.

### Takım ve dosya sahipliği

- Bağımsız inceleme, uygulama ve review için subagent kullanımı bu kullanıcı göreviyle açıkça yetkilidir. Sonraki plan görevlerinde de bu repo talimatı kapsamında bağımsız işleri subagent'lara böl.
- Ana ajan işi böler, her yazan ajana ayrı dosya sahipliği verir, bağımlılıkları sıralar ve sonuçları ana thread'de birleştirir. Aynı dosyada çakışan paralel yazma verme. Ortak dosyaya ihtiyaç varsa önce ilgili yazarı bitir veya sahipliği açıkça devret.
- `explorer`: salt okunur repo/plan/akış/ortam incelemesi. `backend`: API/gateway/entegrasyon. `frontend`: arayüz ve kullanıcı akışı. `reviewer`: bağımsız salt okunur doğruluk/güvenlik/regresyon incelemesi. `sql-vega`: SQL Server/Vega kaynak ve veri sınırları. `release`: gerektiğinde yayın hazırlığı ve geri dönüş kontrolü.
- Explorer ve reviewer araç izni olsa bile dosya yazmaz, build/restart/commit/push veya API/SQL yazma yapmaz. Parent runtime izin override'ı sandbox ayarını etkileyebilir; sandbox tek başına mutlak salt okunur güvence sayılmaz.
- Model varsayılanı gerçek `model = "gpt-6.1-sol"`, `model_reasoning_effort = "medium"`; reviewer/sql-vega `high`. Astra yalnız çok zor mimari belirsizlikte gerekçeli geçici seçimdir. Kurulum model/effort desteklemiyorsa sınırlamayı açıkça bildir; sessiz farklı model varsayma.

### TEST ve LIVE yetkisi

- Doğrulanmış izole TEST ortamında görevin gerektirdiği restart, build, test, branch, commit ve push için ayrıca izin isteme. Kurulum değişikliklerini doğrulayıp commit/push ve mümkünse PR hazırlamak açıkça yetkilidir; ürün özellikleri bu kurulum kapsamı dışındadır.
- Klasör adı, branch veya port tek başına TEST kanıtı değildir. İşlemden önce repo/branch ve ilgili port → API → veritabanı/runtime kimliğini doğrula. TEST arayüzünün LIVE Vega veya dış servise bağlı olması TEST yetkisi oluşturmaz.
- Bu TEST işlem listesi SQL migration, backup/restore/reset, destructive SQL, gerçek müşteri/ticari kayıt veya gerçek dış mesaj gönderimine otomatik izin vermez. Bu alanlarda mevcut hedef/eylem onayını kontrol et; yoksa gerekli somut onayı al. Vega veri kaynakları SELECT-only kalır.
- LIVE'da geri dönüşü zor değişiklik, veri kaybı, gerçek müşteri/ticari kayıt veya credential riski varsa hedef, eylem, risk ve geri dönüşü belirtip açık insan onayı iste. Önce yapılabilir güvenli hazırlığı ve review'u tamamla; sadece gerçekten gerekli manuel/erişim/onay adımında kullanıcıyı çağır.
- Sırları `.env`, log, ekran, rapor veya repoya koyma; değerler yerine yalnız ad/varlık/owner bilgisi kullan. Kaynaktaki şirket/iş kuralı çelişkisini sessizce çözme.

### Doğrulama ve teslim

- Çalışan baseline'ı gereksiz yeniden ispatlama; değişikliğin etkilediği anlamlı regresyonları çalıştır. Dokümantasyon/ajan kurulumunda yapılandırma, rol yükleme, kaynak/link, diff ve secret sınırı kontrolü yeterlidir; ürün build'i ancak etkilenen davranış gerektiriyorsa çalıştır.
- Gerçek kullanım kabulü olmadan PASS verme. Build/smoke, geçmiş kabul veya ajan TOML yüklenmesi Semih PC operatör/terminal/production kabulünün yerine geçmez. Yapılan, kaynaktan bilinen ve doğrulanamayan kontrolleri ayrı belirt.
- Plan/status kabulünü ancak yeni doğrulanmış kanıtla güncelle. Review bulgularını çöz, yalnız amaçlanan dosyaları commit et, branch/commit/PR değerlerini gerçekten oluştuğunda raporla ve PR'ı çalışmaya iliştir.
- Kısa teslim: değişen dosyalar, roller, ilgili test/kanıt, gerçek kabul eksikleri ve bir sonraki tek komut. Yapılandırma/kullanım ayrıntısı: `docs/ai/codex-multi-agent.md`.
