# ERP Bitiş Planı

Oluşturma: 2026-10-03. Kanonik kaynak repo: `melihsnyldzz-ui/melisa-erp-v2`.
Bu dosya, kökte bitiş planı bulunmadığı için mevcut belgelerden türetilen ajan çalışma kuyruğudur. Ürün davranışını, eski kabul kayıtlarını veya şirket kararlarını değiştirmez.

## Kaynak ve durum

- [Current Status](docs/erp-v2/current-status.md): ERP Core baseline'ı ve yerel/runtime veri sınırları; eski başlık tarihi ile sonradan eklenmiş sprint kayıtları birlikte değerlendirilir.
- [Production Acceptance Session](docs/erp-v2/production-acceptance-session.md), 2026-07-09: kaydedilmiş karar `READY_FOR_INTERNAL_USE_ONLY`; production go-live kabulü değildir.
- [Final Closure Decision](docs/erp-v2/final-closure-decision.md): Core için yeni özellik zinciri açmak yerine gerçek operasyon bulguları ve production kapılarıyla ilerleme.
- [Final Testing Findings Log](docs/erp-v2/final-testing-findings-log.md): belgede açık bulgu kaydı yok. Bu, bug bulunmadığının yeni kanıtı değildir.
- [Production Readiness Remaining Hardening](docs/erp-v2/production-readiness-remaining-hardening.md), [Production Readiness Checklist](docs/erp-v2/production-readiness-checklist.md): aşağıdaki açık kapıların kaynağı.
- [Master Roadmap v3](docs/erp-v2/master-roadmap-v3.md), [Implementation Roadmap](docs/erp-v2/implementation-roadmap.md), [Stabilization Roadmap](docs/erp-v2/stabilization-roadmap.md): geçmiş kapsam ve sıra. Eski iskelet ifadeleri veya yapılmış sprint önerileri yeni iş olarak tekrar açılmaz.

Bu kurulumda Semih PC'nin ERP runtime'ı, SQL/Vega hedefi, fiziksel terminali veya gerçek kullanıcı akışı kabul edilmedi. Kaynaktaki geçmiş test/acceptance kanıtları yeni ortam için PASS anlamına gelmez. Yeni gerçek kullanım kararı: **Durum doğrulanmadı**.

## Tek kırmızı madde seçme

Her turda yalnız bir açık madde seç; hedef, kapsam, dosya sahipleri, gerekli regresyon ve gerçek kabul ölçütünü kısa plana yaz. Mevcut bulgu kaydında kanıtlı P0/P1 varsa onu önceliklendir. Kaynakta kapalı baseline'ı sebepsiz yeniden test zincirine sokma.

İlk güvenli madde `ERP-ENV-001`: hedef erişim/ortam kimliği. Erişim yoksa yalnız gerekli bağlantı adımını kullanıcıya bildir; yapılmış gibi devam etme. Başka PC'nin yolu veya portu Semih PC için varsayılmaz.

| ID | Açık madde / kaynak dayanağı | Sorumlu rol | Kabul için gereken kanıt |
|---|---|---|---|
| ERP-ENV-001 | Hedef host, erişim, network/HTTPS ve env sahipliği; acceptance gates 1–2 | explorer → release | Semih hedef kimliği ve repo remote; port→API→DB/runtime TEST/LIVE ayrımı; env adları/sahibi/korumalı depolama, değerler gösterilmeden. Host onayı Henüz bulunamadı. |
| ERP-RECOVERY-002 | Backup/restore doğrulaması yapılmamış; closure blocker 1 | sql-vega + release | Tam hedef/eylem onayı, yedek/restore-test kimliği, çalıştırma ve post-restore kanıtı; veri güvenli geri dönüş. Kurulum bu işlemi çalıştırmaz. |
| ERP-MIGRATION-003 | Staging migration provası kanıtlanmamış; closure blocker 2 | sql-vega + backend | Gerçekten izole staging/restore-test hedefi, ayrıca migration yetkisi, doğrulanmış yedek/rollback ve etkilenen regresyon. |
| ERP-ACCESS-004 | SQL least privilege/certificate ile production kullanıcı/permission sign-off açık; gates 5–6 | sql-vega + backend + reviewer | Sırları açmadan mevcut yetki incelemesi ve insan sign-off; LIVE credential/yetki değişimi ayrıca onaylı. |
| ERP-ACCEPTANCE-005 | Hedef ortam final smoke ve operator walkthrough; gates 7–8 | frontend + backend + reviewer | Hedef ortamda gerekli teknik regresyon ve gerçek operatör akışı ayrı kanıt; mevcut kabul kayıtları korunur. Gerçek kabul olmadan PASS yok. |

Bu tablo kaynaklarda kapanmamış görünen kapıları aktarır; güncel eksiklik veya tamamlanma iddiası değildir. Yeni belge/operatör kanıtı geldikçe yalnız ilgili maddeyi güncelle.

## Gerçek kullanım bulguları ve iş kuralı sınırı

Kontrollü kullanımda yeni hata görülürse [bulgu formatını](docs/erp-v2/final-testing-findings-log.md) kullan: ID, tekrar üretim, beklenen/gerçek sonuç, etki, kaynak, TEST/LIVE hedefi, test ve gerçek kabul. Bulgu yoksa sırf ajana iş üretmek için ürün özelliği icat etme. Terminal cihaz kabulü, import eğitimi, monitoring ve görsel iyileştirmeler ancak kanıtlı ilgili ihtiyaç olduğunda ele alınır.

Merkezi [Melisa OS ecosystem decisions](https://github.com/melihsnyldzz-ui/melisa-os/blob/main/docs/operations/ecosystem-decisions.md) ve [decision log](https://github.com/melihsnyldzz-ui/melisa-os/blob/main/docs/operations/decision-log.md) yerel eski kararlarla her konuda eşleşmez: örneğin yerel karar defterindeki eksi stok/offline finalize yaklaşımı merkezi DEC-003/008 ile çelişir. Kurulum bunu uygulama değişikliğiyle çözmez. Böyle bir iş seçilirse ilgili kural ve mevcut kod kanıtını sun, business davranışını sessizce değiştirme ve gereken insan kararını al.

## Sonuç kaydı

Seçilen ID için ana thread sonucu birleştirir: değişen dosyalar, gerçekten oluşan branch/commit/PR, yapılan etkili kontroller, reviewer bulguları, gerçek kullanım kabulü ve doğrulanamayan adım. Build/smoke tek başına bitiş veya production kabulü değildir. Main otomatik merge edilmez.

Kullanım komutu: **“Planındaki sıradaki kırmızı maddeyi bitir. Gereken ajanları kullan; gerçek kabul hazır olunca dön.”**
