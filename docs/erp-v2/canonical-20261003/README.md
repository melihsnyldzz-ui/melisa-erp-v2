# Kanonik LIVE kaynağı — 3 Ekim 2026

## Kaynak ve yeniden üretim

Bağımsız checkout: C:\Sirket\ERP\source\canonical-live-20261003. Repo melihsnyldzz-ui/melisa-erp-v2; dal codex/canonical-live-20261003. Başlangıç 19819ce; yalnız bu commit LIVE değildir. API/native src ve packages çalışan production klasöründen byte düzeyinde; web src C:\do-wt\live-fix-4-test-release-20260918\apps\web-admin\src kaynağından alındı. Bunlar temiz bir ağaçta birleştirildi. Eski ana/pilot/production/TEST/Sites kopyalarına yazılmadı.

Node 24.15.0, npm 11.12.1. Web npm ci + Vite 7.3.3; VITE_API_BASE_URL=http://192.168.1.46:4114, VITE_MELISA_PILOT=true, VITE_DEMO_MODE=false, VITE_LOCAL_PASSWORDLESS_LOGIN=false. Dört web dosyasının tamamı LIVE disk hashleriyle birebir; HTTP ile sunulan HTML/JS/CSS de birebir. API npm ci sonucu kurulu bağımlılık sürümleri LIVE ile eşit. node_modules junction kullanılmaz; private config kaynak değildir. LIVE process başlangıcında yüklenmiş tüm modül baytları bellekte introspect edilmedi; disk/runtime başlangıç yolu ve HTTP varlıkları kanıtlandı.

Android apps/terminal-native, origin/codex/native-terminal-source-20260929 kaynağındaki candidate.18-t2 olarak korundu. Native backend artık aynı kaynak ağacındadır. Yeni APK derlemesi, fiziksel TC21 ve ticari kabul bu paketleme çalışmasının sonucu değildir.

## Tekrarlanabilir paketleme

Temiz commit üzerinde: node scripts/canonical/build-package.mjs C:/Sirket/ERP/releases/YENI-BOS-KLASOR

Betik yalnız commit içeriğini git archive ile çıkarır, bağımsız npm ci yapar, önce LIVE webini birebir yeniden üretir, ardından yalnız TEST API hedefiyle webi derler. TEST etiketi paket HTML'ine eklenir. release-manifest.json tam commit ve dosya SHA-256 değerlerini taşır.

Başlatma: scripts/canonical/start-test.ps1 -ReleaseRoot KESIN_PAKET -ConfigPath C:/Sirket/ERP/config/TEST-20260929-01/runtime-private.json

Launcher dosya hashlerini ve port boşluğunu kontrol eder. Yalnız 127.0.0.1:5194/4144/4146; DB MELISA_ERP_SIRKET_TEST_20260929_01. Mevcut config'in salesEnabled alanını kullanmaz; yalnız salt okunur test login'i. SQL kimlik, LIVE DB erişimsizliği ve tablo DML/prosedür çalıştırma yetkisizliği başlangıçta doğrulanır. İş yazıları HTTP 405; dış entegrasyonlar kapalı; ağ yalnız loopback ve izinli TEST/SQL portları; yazdırma ve subprocess kapalı. LIVE betikleri kaynak kanıtı olarak saklanır, bu launcher onları çalıştırmaz.

## Fark sınıflandırması

[Dosya bazlı döküm](difference-classification.json) commerce f787cfe, sadeleştirme aea716f, 19819ce, eski TEST ve Sites v70 kaynaklarını kapsar. Sınıflar dosya kanıtıdır: zaten mevcut = aynı içerik; korunacak yerel düzeltme = baseline veya ayrı TEST/Sites dosyası korunur; gerçekten eksik = referans dosyası baseline içinde yok. Eksik dosya işlevin eksik/bozuk olduğunu tek başına göstermez. Değişen işlevin eski kabulü otomatik aktarılmaz.

Özellikle commerce terminalSaleIdempotency/terminalSaleSubmissionTransaction yardımcıları LIVE'da ayrı dosyalar olarak yok. LIVE nativeTerminalSale.mjs aynı clientEventId için kilit/idempotency ve transaction içeriyor; eski yardımcıların yokluğu terminalde bu özelliğin yokluğu değildir. Public catalog, external readonly/Bionic ve product-brain yardımcıları LIVE paketinin ana günlük akışından ayrı kapsamdır; otomatik eklenmedi. Finance/report yardımcıları ile eski TEST'in testDaily/testPurchase/testPayment/testRefund servisleri hedefli işlev uzlaştırması gerektirir. Eski TEST doğrudan LIVE'ın yerine konulmadı.

Mevcut native kaynaktaki negativeStockAllowed davranışı korunmuştur. 26 Eylül şirket kararına uygunluk bu kaynak toplama işlemiyle kanıtlanmış sayılmaz; ticari davranış değişikliği yapılmadı.

## Sites çalışması korunuyor

[Melisa ERP v2 Sites](https://melisa-erp-v2.melihsnyldzz.chatgpt.site) güncel bulut sürümü 70; kaynak d559243a62080c8de5ce9ba1e2ba2d6231c098b9 araçla doğrulandı. Yerel C:\Sirket\ERP\sites-v70-kaynak kaynakları korunur. 2351 manifest dosyasının 2341'i aynı, 10'u sonradan değiştirilmiş. [Hash raporu](sites-v70-verification.json) farkları içerir. Bu 10 dosya temiz v70 ile ezilmez.

Sites yeşil workflow, seri/parça, mal kabul, açık hesap, mahsup, iade/sayım, koli/sevk ve çıktı çalışmaları değerli ayrı kaynaktır. P01–P07 kabulleri sentetik demo kapsamındadır. v70 teslimi 376 önceki test bildirir; eski STRUCTURAL_STATUS daha erken bir durum belgesidir. Gerçek SQL/native entegrasyonu ve kalıcılık bu demo kabulünden çıkarılamaz. Eski TEST webindeki Sites paketi yerinde korunur; yeni 5194 paketi bu çalışmanın amacı olan yeniden üretilmiş LIVE webidir. Sites iş akışlarını yeni API'ye bağlamak ayrı açık entegrasyon işidir.

## Kanıt sınırı

Hash, npm ci, derleme ve smoke; paket kimliği ve bağlantı güvenliği kanıtıdır. Satış/alış/tahsilat, fiziksel barkod ve cihaz kabulü değildir. LIVE/gerçek ticari kayıtlara yazma, migration, restore, kopya temizleme veya LIVE geçişi yapılmaz. Tek sonraki iş: korunan Sites/TEST iş akışları ile bu baseline'ın hedefli işlev uzlaştırması ve gerçek kullanım kabulü.
