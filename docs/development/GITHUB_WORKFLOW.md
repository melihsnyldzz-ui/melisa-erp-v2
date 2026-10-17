# ERP: GitHub çalışma düzeni

5 Ekim karar merkezi: günlük sıra [DELIVERY_BOARD](../../DELIVERY_BOARD.md), onaylı karar [PROJECT_DECISIONS](../../PROJECT_DECISIONS.md), insan sonucu [USER_ACCEPTANCE](../../USER_ACCEPTANCE.md), teknik kanıt [STATUS](../../STATUS.md) ve tam kapsam [ERP_FINISH_PLAN](../../ERP_FINISH_PLAN.md) içinde tutulur. AGENTS güncel devam döngüsünü tanımlar; aşağıdaki 3 Ekim kaynak ilişkisi tarihsel kayıttır.

3 Ekim 2026 kaynak/GitHub incelemesi. Bu belge uygulama kabulü veya deployment kaydı değildir.

## Kullanıcının göreceği düzen

Sen istediğin değişikliği söylersin. Ajan ayrı çalışma dalında kaydeder, GitHub'a gönderir ve PR açar. PR, “bu değişiklik ana sürüme alınsın mı?” inceleme sayfasıdır. **Files changed** dosya farkını, **Commits** kayıtları, **Checks** otomatik kontrolleri gösterir. Ajan kısa sonucu ve PR bağlantısını sana verir; komut çalıştırman gerekmez.

Günlük sıra: **branch → commit → push → PR → teknik kontrol → kullanıcı kabulü → main**. TEST'te kullanıcı kontrolü gereken işler normal arayüzde yapılır; ek kabul ekranı şart değildir. Main'e almak ve LIVE'a yayınlamak ayrı işlemlerdir.

## Bugünkü gerçek kaynak ilişkisi

| Alan | 3 Ekim inceleme sonucu |
| --- | --- |
| Repo | `melihsnyldzz-ui/melisa-erp-v2` |
| Kanonik kök | `C:\Sirket\ERP\melisa-erp-v2` |
| Main | `577c0cb9d0953635b30088fa23e1e887c7b75775` |
| Mevcut geliştirme tabanı | `codex/erp-agents-on-canonical-20261003` / `2d22009ddc186e87c77f28d47c3c4adc2ba9e8cd` |
| Bu işin dalı | `codex/erp-github-workflow-20261003` |
| Bu PR'nin hedefi | `codex/erp-agents-on-canonical-20261003` |
| Main ilişkisi | main aktif kaynağın atasıdır; aktif kaynak 41 commit ileridedir. Bu ilerleme bütün özelliklerin kabul edildiği anlamına gelmez. |

`codex/erp-finish-20261003` [PR #14](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/14) → `codex/canonical-live-20261003` [PR #15](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/15) → ajan dalı [PR #18](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/18) → bu çalışma. PR #18 kanonik kaynak dalını hedefler. Main hedefli #16/#17 eski ajan hazırlıklarıdır; kanonik tabana dönmek yerine bunları başlangıç seçme. Native #13 ve diğer özellik PR'leri kendi kabul kapsamlarında ayrı değerlendirilir.

Mevcut çalışan/kabul kayıtları korunur; branch adı veya son commit tarihi LIVE kanıtı değildir. Bu görev main'e merge, dal silme, force-push, tag veya runtime değişikliği yapmaz.

## Yeni işler ve mevcut PR'lerin sırası

- Kısa `feature/...`, `fix/...` veya `codex/...` dalı aç; halen geçerli kaynak tabanını kullan. Aynı işi paralel eski kopyada geliştirme.
- Bugünkü geçişte PR'ler bağımlı olabilir: önce taban PR kabul edilir, sonra üstteki PR yeni tabana göre incelenir. Alt PR main'e ulaşmadıysa üsttekini main'e retarget ederek dev bir kod farkını onaysız taşıma.
- Kabul edilmiş içerik kaybolmadan eski paralel PR'lerin farklarını karşılaştır. Main'de olup adayda olmayan düzeltmeleri de koru. Birleştirme ve gereksiz PR kapatma ayrı kayıtlı kabul adımıdır.
- Yeni düzen kabul edilip kaynak main'de toplandığında yeni işleri güncel main'den kısa dallara ayır. Ajan rutin Git/gh işlemlerini yürütür.
- Tam PR head commit'i için `quality-build-test` ve `secret-scan` başarılı olmalı. Kırmızı kontrolü atlayıp merge etme. Kontrol henüz koşmadıysa PASS yazma.
- Kullanıcı kabulü kişi/tarih/kapsam/tam commit ile STATUS ve PR'ye yazılır. Ardından açık merge talimatıyla main'e alınır; otomatik merge açılmaz.

## Otomatik kontrol sınırı

4 Ekim ERP finish dalı, güncel kanonik uygulama `e0c18e3` üzerine PR #19'daki portable CI/ajan dosyalarını seçerek taşır; eski feature veya main uygulaması merge edilmez. API/web-admin/Sites sentetik kontrollerine dört açıkça seçilmiş migration model suite'i eklenir: accepted-opening-prices, mapping-opening, operation-quarantine ve target-native-opening. `target-native-opening-identity.test.mjs` gerçek SQL integration testidir; CI'ye alınmaz. Offline guard, yanlışlıkla SQL/provider çağıran herhangi bir testi güvenle durdurur. Son tam head'in iki check'i başarılı olmadan CI PASS kaydı verilmez.

[CI workflow](../../.github/workflows/ci.yml) her branch push'unda ve PR'de çalışır. GitHub-hosted Ubuntu, salt okunur token yetkisi, kilitli dependency kurulumu ve yalnız offline/sentetik testler kullanılır. Provider/DB ayarları ve dotenv yüklemesi CI test guard'ıyla engellenir. CI hiçbir yerel servis, TEST/LIVE DB, müşteri hesabı, deployment veya gerçek gönderim kullanmaz.

Build ve syntax temel kalite kontrolüdür; ayrı lint aracı yoksa lint yapılmış gibi raporlanmaz. Native cihaz, SQL integration, Electron/APK, gerçek müşteri/mobil kabulü CI yeşilinin kapsamına girmez. Ayrıntılı kapsam `scripts/ci/` ve STATUS kaydındadır.

Secret scan **tam checkout Git geçmişini** inceler, bütün eşleşme değerlerini maskeler ve bulguda başarısız olur. `.gitleaksignore` yalnız bağımsız incelenmiş sentetik/yanlış pozitif bulguların tam fingerprint'lerini içerir; genel path/rule dışlama yoktur. Yeni bir gerçek secret bulunursa değerini paylaşmadan dur; sahibiyle iptal/yenileme ve gerekirse geçmiş temizliğini ayrı planla.

Branch protection/ruleset veya zorunlu check sunucu ayarı bu görevde değiştirilmedi. AGENTS/PR kuralları çalışma disiplinidir; GitHub tarafında zorunlu merge engeli kuruldu diye sunulamaz.

## Her işin kısa kayıt alanları

Kanonik durum dosyası [STATUS.md](../../STATUS.md); ikinci bir ERP_STATUS oluşturulmaz.

| Alan | Yazılacak bilgi |
| --- | --- |
| Tarih / kapsam | Ne değişti, ne korunuyor |
| Teknik sonuç | PASS / PARTIAL / FAIL / Durum doğrulanmadı; test ve CI bağlantısı |
| Gerçek kullanıcı kabulü | BEKLİYOR / KABUL / RET; kişi, tarih, akış, tam commit |
| Teslim | branch, commit, PR bağlantısı |
| TEST / LIVE | Ayrı tam commit, paket, kimlik ve kanıt; bilinmiyorsa Durum doğrulanmadı |
| Kalan iş | Somut eksik, kabul adımı, rollback sınırı |

STATUS'a kendi commit hash'ini aynı commit içinde yazmak mümkün değildir. İlk kayıtta teslim commit'ini izleyen güncelleme veya PR head bağlantısı kullan; sırf hash değişti diye sonsuz status commit döngüsü kurma.

İlgili belgeler: [Sürümleme](RELEASES.md), [deploy/rollback](DEPLOY_ROLLBACK.md).
