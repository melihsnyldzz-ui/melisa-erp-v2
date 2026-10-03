# ERP Codex ajan takımı

2026-10-03 tarihinde mevcut AGENTS kuralları korunarak proje ajan yapılandırması eklendi. Başlangıç kuyruğu [ERP_FINISH_PLAN.md](../../ERP_FINISH_PLAN.md), tarihsel ürün durumu [current-status.md](../erp-v2/current-status.md) üzerinden okunur. Ajan kurulumunun doğrulanması, ERP'nin Semih PC'de gerçek kullanım kabulü değildir.

| Ajan | Model / effort | İş ve yazma sınırı |
|---|---|---|
| Ana ajan | `gpt-6.1-sol` / `medium` | Tek madde planı, ayrı dosya sahipliği, sonuç birleştirme ve kabul |
| explorer | `gpt-6.1-sol` / `medium` | Salt okunur kaynak/ortam/akış incelemesi |
| backend | `gpt-6.1-sol` / `medium` | Atanmış API/gateway/entegrasyon dosyaları |
| frontend | `gpt-6.1-sol` / `medium` | Atanmış arayüz ve kullanıcı akışı dosyaları |
| reviewer | `gpt-6.1-sol` / `high` | Bağımsız salt okunur doğruluk/güvenlik/kanıt review |
| sql-vega | `gpt-6.1-sol` / `high` | SQL/Vega sınırları ve atanmış query/schema kaynakları; Vega SELECT-only |
| release | `gpt-6.1-sol` / `medium` | İhtiyaç halinde yayın/artefact/rollback hazırlığı; deploy izni değildir |

## Yapılandırma ve doğrulama sınırı

[Resmi Subagents belgesi](https://learn.chatgpt.com/docs/agent-configuration/subagents), 2026-10-03 kontrolü: proje rolleri `.codex/agents/*.toml` dosyalarından keşfedilir. Her dosyada `name`, `description`, `developer_instructions`; ayrıca `model`, `model_reasoning_effort`, `sandbox_mode` bulunur. `.codex/config.toml` ana model ve `[agents]` varsayılanlarını kaydeder; aynı rolleri ikinci kez kaydeden eski tablo biçimi kullanılmaz. Bir ana oturumda en fazla üç eşzamanlı subagent vardır.

Semih PC'deki mevcut masaüstü Codex `0.160.0` model kataloğunda `gpt-6.1-sol` için `medium`/`high` ve `gpt-6-astra` desteği doğrulandı. PATH üzerindeki eski `0.152.1` CLI kataloğu Sol göstermedi; farklı binary katalogları aynı kabul edilmez. Yeni PC/oturumda sürüm/model erişimi yeniden kontrol edilir. Desteklenmeyen ortamda sessiz model değişikliği veya ajanlar kullanılmış iddiası yapılmaz; sınırlama raporlanır.

Kurulum doğrulaması (2026-10-03): altı rol TOML'i ayrıştırıldı; zorunlu bağımsız rol metadata alanları ve kalan config katmanı güncel resmi [JSON şemasına](https://developers.openai.com/codex/config-schema.json) göre kontrol edildi. Yerel belge bağlantıları, eski AGENTS içeriğinin korunması ve diff kontrolü temiz; bağımsız review'da somut P1/P2 bulgu çıkmadı. Kullanıcı ayarları korunarak yalnız bu çalışma kopyası için yerel proje güven kaydı eklendi. Masaüstü app-server `config/read`, etkin proje katmanı, Sol Medium ve etkin üç alt ajan sınırını doğruladı.

Native smoke'ta `reviewer` ve `sql-vega` rolleri gerçekten açıldı. Kalıcı oturum kayıtları her iki rol için `gpt-6.1-sol` / `high` ve smoke parent'ının etkili salt okunur dosya/kapalı ağ politikasını doğruladı; alt ajanlar araç/ürün/SQL işlemi yapmadan yanıt verdi. Diğer dört rolün görevleri çalıştırılmadı; bunlar şema/model/sandbox kontrolünden geçti. `sql-vega` normal dosya yazma varsayılanının bu smoke'ta parent salt okunur izniyle sınırlandığı özellikle doğrulandı. Teknik rol smoke'u gerçek ERP operatör/terminal/SQL kabulü değildir.

`gpt-6-astra` yalnız çok zor mimari belirsizlikte ana ajanın gerekçelendirdiği geçici seçimdir; rutin roller Sol kullanır. Özel rol TOML'indeki model/effort ayarı öncelikli olduğundan Astra gerekiyorsa ana oturum veya bu duruma özel genel subagent seçimi kullanılır; rol dosyasındaki Sol'u spawn parametresiyle değiştirdiğini varsayma.

Explorer/reviewer `sandbox_mode = "read-only"`, uygulayıcılar `workspace-write` varsayılanını taşır. Parent oturumun canlı izin override'ları sandbox varsayılanını etkileyebilir; read-only rolün yazmama/restart/build/commit/push yapmama kuralı araç izni olsa da geçerlidir. Dosya sandboxı uzak API/SQL yan etkilerine karşı izin yerine geçmez.

## Kullanım

Kanonik remote'u ve hedef ortamı doğrulayarak repo kökünü Codex projesi olarak aç. Gerekirse proje yapılandırmasının yüklenmesi için yeni ana konuşma başlat; bu doküman eski oturumu otomatik yeniden yüklemiş saymaz. Ana ajan önce plan/status okur, bir açık madde seçer, bağımsız işleri dosya sahipliğiyle dağıtır ve reviewer sonucunu birleştirir.

İzole TEST'te gereken restart/build/test/branch/commit/push kullanıcı tarafından yetkilidir. LIVE, gerçek ticari kayıt, geri dönüşü zor/veri kaybı/credential riski için açık hedef/eylem onayı gerekir. SQL migration/reset/restore/destructive ve gerçek dış mesaj gönderimi bu TEST yetkisine dahil değildir. PR açılır; main otomatik merge edilmez. Sırlar, yerel sabit makine yolları ve runtime verileri repoya girmez.

**“Planındaki sıradaki kırmızı maddeyi bitir. Gereken ajanları kullan; gerçek kabul hazır olunca dön.”**
