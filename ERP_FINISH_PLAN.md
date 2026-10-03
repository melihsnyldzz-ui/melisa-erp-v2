# Melisa ERP — bitiş planı

Güncelleme: 2026-10-03. Kanonik repo: `melihsnyldzz-ui/melisa-erp-v2`.
Bu dosya açık işlerin ve bitiş sırasının source of truth'udur. İş kuralları
`AGENTS.md`, merkezi Melisa OS ve yerel karar belgelerinde kalır.

## Mevcut kanıt ve sınırı

- Başlangıç: GitHub `main`, `577c0cb9d0953635b30088fa23e1e887c7b75775`.
- [Current status](docs/erp-v2/current-status.md), [closure decision](docs/erp-v2/final-closure-decision.md)
  ve [production acceptance](docs/erp-v2/production-acceptance-session.md) mevcut
  ERP Core baseline'ını ve `READY_FOR_INTERNAL_USE_ONLY` kararını kaydeder.
  Bu tarihsel karardır; bu kurulum güncel runtime veya production kabulü değildir.
- Çalışan baseline'ı sırf yeni plan/ajan kuruldu diye baştan ispatlama. Eski
  port/database/yol veya genel checklist maddesi tek başına yeni regresyon değildir.
  Somut bulgu, ilgili kod değişimi, hedef değişimi veya eksik gerçek kabul varsa
  yalnız ilgili akışı yeniden doğrula.
- Semih PC checkout/port/API/SQL kimliği henüz bu görevde doğrulanmadı. Hiçbir
  LIVE/TEST servis, database, terminal veya müşteri kaydı bu kurulumda değiştirilmez.
- [Final findings log](docs/erp-v2/final-testing-findings-log.md) ve kullanıcıdan
  gelen daha yeni doğrulanmış bulgu bu plana kanıtıyla işlenir. Önceden kapanmış
  işi otomatik yeniden açma; eski belgedeki açık kutuyu güncel failure sayma.

## Tek iş seçimi ve kabul

Ana ajan plan/status okur, tek kırmızı ID'yi seçer ve dosya sahipliğini belirler.
Bağımsız işler explorer/backend/frontend'e bölünür, SQL gerekiyorsa sql-vega
inceler; reviewer bağımsız kontrol eder. Plan/status ana ajan tarafından güncellenir.
Ortak dosyalar sırayla yazılır. Blokeli LIVE adımın hazırlığı tamamlanır; somut
hedef/işlem/rollback için onay istenir, başka kırmızı iş aynı anda açılmaz.

PASS: yalnız seçilen maddenin gerçek kullanım kabulü ve gerekli kanıtları tamam.
PARTIAL: ilgili kod/kontrol hazır, gerçek kullanım kabulü eksik.
BLOCKED: adlandırılmış erişim/onay/bağımlılık eksik.
NOT_VERIFIED: güncel kanıt yok. Build/mock/commit/PR uygulama PASS'i değildir.

## Kırmızı sıra

Bu sıra mevcut production kabul boşluklarını tek kuyruğa taşır; yeni feature
sprintleri açmaz. İlk madde Semih'de işlem yapmadan önce hedef kimliği içindir.
Sonraki maddelerin 2026-07-09 kaynaklarında eksik olması bugün hâlâ eksik
olduklarını ispatlamaz; varsa daha yeni kanıtla kapat, baseline tekrarı yapma.

| ID | Durum | Amaç ve gerçek kabul | Kaynak / sahip rol |
|---|---|---|---|
| ERP-01 | 🔴 NOT_VERIFIED | Semih'de kanonik checkout remote/fetch/push, branch/dirty durum ve izole TEST port → süreç → API → DB kimliği; yanlış/LIVE hedefe işlem yok. Yeni yerel yollar yalnız keşiften alınır. | AGENTS.md; explorer + ana ajan |
| ERP-02 | 🔴 NOT_VERIFIED | Mevcut backup/restore kabul kanıtını bul; yoksa adı belirli izole hedefte onaylı restore, gerekli tutarlılık kontrolleri ve geri dönüş kanıtı. LIVE/veri kaybı riski açık onay gerektirir. | [Restore evidence](docs/erp-v2/backup-restore-evidence-log.md); sql-vega + release |
| ERP-03 | 🔴 NOT_VERIFIED | Migration yolunun doğrulanmış sentetik TEST/staging hedefinde backup/rollback ve ilgili ticari tutarlılık kabulü. LIVE migration bu çalışma yetkisinin dışında. | [Acceptance gates](docs/erp-v2/production-acceptance-session.md); sql-vega + backend |
| ERP-04 | 🔴 NOT_VERIFIED | SQL least privilege ve certificate/trust policy için mevcut kanıt veya kaynaklı boşluk; production grant/credential değişimi ancak açık onayla. | [SQL review](docs/erp-v2/production-readiness-remaining-hardening.md); sql-vega + reviewer |
| ERP-05 | 🔴 NOT_VERIFIED | Gerçek operator rol/izin kabulü; yetkisiz kritik işlem reddi ve audit kanıtı, gerçek kayda onaysız yazma yok. | [Acceptance gates](docs/erp-v2/production-acceptance-session.md); backend + frontend + reviewer |
| ERP-06 | 🔴 NOT_VERIFIED | Hedef host/network/HTTPS ve env isim/sahip/saklama konumu kanıtı; secret değerleri raporlanmaz. Deploy/credential/LIVE riski ayrıca onaylı. | [Host checklist](docs/erp-v2/production-host-network-checklist.md), [Env ownership](docs/erp-v2/production-env-ownership-checklist.md); explorer + release |
| ERP-07 | 🔴 NOT_VERIFIED | Yalnız kapanan değişimlerin hedef ortamda ilgili smoke ve gerçek operator yürüyüşü; kritik failure/eksik kabul olmadan nihai karar. Terminal işi seçildiyse fiziksel scan/sync kabulü gerekir. | [Testing runbook](docs/erp-v2/final-testing-runbook.md), [Human log](docs/erp-v2/final-human-acceptance-log.md); frontend + reviewer + ana ajan |

## Korunan kapsam

Yeni CRM, AI, Mission Control ve gereksiz ERP modülleri bu kuyruğu büyütmez.
Kanonik CRM ayrı repodadır. Merkezi/yerel eski iş kurallarında çelişki görülürse
yeni kural uydurma; ilgili güncel karar kaynağını göster, kapsamlı business-rule
değişimini kullanıcıyla çöz. Örneğin tarihsel offline/eksi stok kararlarını yeni
ajan düzeni kurarken kod davranışına dönüştürme.

TEST restart/build/test/branch/commit/push tekrar onay gerektirmez; hedef izolasyonu
zorunludur. LIVE geri dönüşü zor değişiklik, gerçek müşteri/ticari kayıt, veri kaybı,
mesaj, credential ve riskli restore/reset adımı açık onaylıdır. AI doğrudan SQL
yazmaz; korumalı uygulama/service/procedure sözleşmesi ve audit sınırı korunur.

## Ajan kurulumu kaydı

Bu görev yalnız geliştirme düzenidir: mevcut AGENTS korunup birleştirildi;
`.codex/config.toml`, explorer/backend/frontend/reviewer/sql-vega/release rolleri
eklendi. Release rolü production/rollback kuyruğu nedeniyle gereklidir.
Model varsayılanı GPT-6.1 Sol Medium; zor reviewer/sql-vega spawn High. Bu rollerde
effort sabitlenmediği için açık High seçimi etkilidir. Astra yalnız gerekçeli çok
zor mimari belirsizlikte ana ajan/default-agent seçimiyle kullanılır.

Semih PC'de repo kökünü ERP projesi olarak aç, remote ve branch'i doğrula, proje
trust/config/agent keşfini yeni oturumda kontrol et. Kurulum branch/PR'si review
içindir; main merge/auto-merge yok. Projects klasörleri/eskiler temizlenmez.

Kurulum kontrolleri (2026-10-03): Codex CLI 0.152.1 strict başlangıç ve gerçek
`initialize → config/read` ile yalnız geçici, izole doğrulama profilinde trusted
proje config'i yüklendi; ana/alt ajan Sol Medium, enabled ve eşzamanlılık 3 görüldü.
Altı TOML rol tanımı geçerli, loader'da config/agent uyarısı yok; geçici bozuk
rolün reddi discovery loader'ının çalıştığını doğruladı. Bağlantılar ve dar diff
kontrol edildi. Bağımsız incelemede P0/P1 yok; bir onay metni belirsizliği düzeltildi.
Global config/trust değiştirilmedi; model çağrısı veya gerçek rol spawn yapılmadı.
Semih PC aktivasyonu, model erişimi ve gerçek ERP kullanımı henüz doğrulanmadı.
Bu dosya uygulama PASS'i veya go-live kararı vermez.

## Her iş sonrası kayıt

Seçilen ID; branch/commit/PR; atanmış dosyalar; gerçek TEST kimliği; ilgili
kontrol/kabul sonucu; kanıt kaynağı; kalan somut boşluk. Plan ve status aynı
sonucu göstermeli. Secret veya gerçek müşteri kayıt içeriği bu kayda girmez.

## Ana konuşma komutu

> Planındaki sıradaki kırmızı maddeyi bitir. Gereken ajanları kullan, gerçek kabul hazır olunca dön.
