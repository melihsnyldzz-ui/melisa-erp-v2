# ERP: GitHub çalışma düzeni

3 Ekim 2026 kaynak/GitHub incelemesi. Bu belge uygulama kabulü veya deployment kaydı değildir.

## Kullanıcının göreceği düzen

Sen istediğin değişikliği söylersin. Ajan ayrı çalışma dalında kaydeder, GitHub'a gönderir ve PR açar. PR, “bu değişiklik ana sürüme alınsın mı?” inceleme sayfasıdır. **Files changed** dosya farkını, **Commits** kayıtları, **Checks** otomatik kontrolleri gösterir. Ajan kısa sonucu ve PR bağlantısını sana verir; komut çalıştırman gerekmez.

Günlük sıra: **branch → commit → push → PR → teknik kontrol → kullanıcı kabulü → main**. TEST'te kullanıcı kontrolü gereken işler normal arayüzde yapılır; ek kabul ekranı şart değildir. Main'e almak ve LIVE'a yayınlamak ayrı işlemlerdir.

## Main'den ayrılmış altyapı PR'si — 4 Ekim 2026

| Alan | Doğrulanan kaynak ilişkisi |
| --- | --- |
| Repo | `melihsnyldzz-ui/melisa-erp-v2` |
| Main tabanı | `577c0cb9d0953635b30088fa23e1e887c7b75775` |
| Bu işin dalı | `codex/erp-clean-main-infra-20261004` |
| Bu PR'nin hedefi | doğrudan `main` |
| Yalnız dosya kaynağı | Eski PR #19, commit `5a82c1db00f8f984bb760cca8896e25eebb6726e` |
| Uygulama ilişkisi | Main'in uygulama ağacı korunur; feature dalının uygulama kodu ve geçmişi alınmaz. |

Eski [PR #19](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/19) ve ajan/uygulama dalları kaynak kanıt olarak korunur. Eski PR hedefi değiştirilmez, PR kapatılmaz. Yeni dal main'den açılır; cherry-pick/merge yapılmadan yalnız AGENTS, Codex config/roller, bitiş planı, CI, PR şablonu, exact secret fingerprintleri ve geliştirme belgeleri seçilir. README/status yalnız bu düzen için minimal referans alabilir.

Bu hazırlık runtime, servis, deployment, tag, DB veya ticari kayıt işlemi yapmaz. CI sentetik/offline kontrollerdir; uygulamanın güncel LIVE kabulünü kanıtlamaz. Kabul verilmeden main'e merge veya auto-merge yoktur.
## Yeni işler ve mevcut PR'lerin sırası

- Kısa `feature/...`, `fix/...` veya `codex/...` dalı aç; halen geçerli kaynak tabanını kullan. Aynı işi paralel eski kopyada geliştirme.
- Uygulama feature geçişlerinde PR'ler bağımlı olabilir: önce taban PR kabul edilir, sonra üstteki PR yeni tabana göre incelenir. Alt PR main'e ulaşmadıysa üsttekini main'e retarget ederek dev bir kod farkını onaysız taşıma.
- Kabul edilmiş içerik kaybolmadan eski paralel PR'lerin farklarını karşılaştır. Main'de olup adayda olmayan düzeltmeleri de koru. Birleştirme ve gereksiz PR kapatma ayrı kayıtlı kabul adımıdır.
- Yeni düzen kabul edilip kaynak main'de toplandığında yeni işleri güncel main'den kısa dallara ayır. Ajan rutin Git/gh işlemlerini yürütür.
- Tam PR head commit'i için `quality-build-test` ve `secret-scan` başarılı olmalı. Kırmızı kontrolü atlayıp merge etme. Kontrol henüz koşmadıysa PASS yazma.
- Kullanıcı kabulü kişi/tarih/kapsam/tam commit ile STATUS ve PR'ye yazılır. Ardından açık merge talimatıyla main'e alınır; otomatik merge açılmaz.

## Otomatik kontrol sınırı

[CI workflow](../../.github/workflows/ci.yml) her branch push'unda ve PR'de çalışır. GitHub-hosted Ubuntu, salt okunur token yetkisi, kilitli dependency kurulumu ve yalnız offline/sentetik testler kullanılır. Provider/DB ayarları ve dotenv yüklemesi CI test guard'ıyla engellenir. CI hiçbir yerel servis, TEST/LIVE DB, müşteri hesabı, deployment veya gerçek gönderim kullanmaz.

Build ve syntax temel kalite kontrolüdür; ayrı lint aracı yoksa lint yapılmış gibi raporlanmaz. Native cihaz, SQL integration, Electron/APK, gerçek müşteri/mobil kabulü CI yeşilinin kapsamına girmez. Ayrıntılı kapsam `scripts/ci/` ve STATUS kaydındadır.

Secret scan **tam checkout Git geçmişini** inceler, bütün eşleşme değerlerini maskeler ve bulguda başarısız olur. `.gitleaksignore` yalnız bağımsız incelenmiş sentetik/yanlış pozitif bulguların tam fingerprint'lerini içerir; genel path/rule dışlama yoktur. Yeni bir gerçek secret bulunursa değerini paylaşmadan dur; sahibiyle iptal/yenileme ve gerekirse geçmiş temizliğini ayrı planla.

Branch protection/ruleset veya zorunlu check sunucu ayarı bu görevde değiştirilmedi. AGENTS/PR kuralları çalışma disiplinidir; GitHub tarafında zorunlu merge engeli kuruldu diye sunulamaz.

## Her işin kısa kayıt alanları

Kanonik durum dosyası [STATUS.md](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/5a82c1db00f8f984bb760cca8896e25eebb6726e/STATUS.md); ikinci bir ERP_STATUS oluşturulmaz.

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

## Main CI kapsamı

Main'deki altı API unit test dosyası ve altı bağımsız sentetik katalog unit test dosyası, offline guard olumsuz senaryoları, API/CI syntax kontrolü ve mevcut web-admin build çalışır. `daily_price_quote`, `product_identity_daily_snapshot` ve `product_identity_daily_snapshot_live` testleri Git'te bulunmayan işletme katalog JSON'una bağlıdır; veri veya sahte onay taşınmaz, bu üç suite CI kapsamı dışındadır. Altı sentetik katalog dosyasından biri eksikse CI başarısız olur. Main'de web-admin unit suite ve sites-workflow uygulaması yoktur; bu PR onları eklemez veya test edilmiş saymaz. Native/Electron/terminal build bu CI kapsamı değildir. Manifest ve lockfile'lar main'den aynen kullanılır.

`.gitmodules` yalnız main'deki mevcut `tmp/melisa-os-reference` gitlink'inin URL eşlemesini tamamlar. Pinned actions/checkout, credential cleanup sırasında `git submodule foreach --recursive` çağırır; eşleme olmadan checkout hata verir. Her iki checkout adımında `submodules: false` kalır, submodule indirilmez/başlatılmaz; runtime davranışı değişmez.
