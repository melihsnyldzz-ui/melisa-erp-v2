# İzole TEST gözetim kararlılığı — 12 Ekim 2026

ERP-COMPLETE01 sürer; insan UA32 bekliyor. TEST125 ve korunan veriler/roller aynı. Yeni ticari veya migration uygulaması yok.

## Gerçek gözlem

f411 core iki processProbe kesintisinden mevcut retry ile toparlandı. Salt okunur yeni paket9ee hazırlığı1845manifest dosyası ve değişmeyen API/native/compiler dosyalarıyla doğrulandı. Paket geçişinden önce exact DB02/copy/server ve aktif kullanıcı SQL transaction0 kontrol edildi. Korumalı diğer listener süreçleri korundu. Durma aracındaki kapatılmış süreç yarışında yalnız kalan exact sahibi/argv/config/creation doğrulanmış Hub durduruldu; mevcut iki Interactive/Limited görevin principal/trigger/settings alanları değişmedi.

9ee core başlatıldı; native ve API readiness kayıtları oluştu. Ardından12Ekim08:38:48Z gözetim Node süreci JS exit recorder üretmeden `-1073740791 / C0000409` ile kapandı. Task Ready/LastResult1 ve altı core listener'ın yokluğu bağımsız gözlendi. Yeni paketi kararlı çalışan teslim saymıyoruz.9ee'ye bağlı Windows kurulum adayı da henüz kullanıcı teslimi değildir.

Makine: Windows10.0.26200/x64, Node24.15.0, V8 `--maglev` varsayılan açık. [Node #62260](https://github.com/nodejs/node/issues/62260) aynı Windows ailesi/kod için Maglev uyumsuzluğu bildiriyor. Bu benzerlik **hipotezdir**, mevcut uygulamanın kök neden kanıtı değildir. Microsoft'un [fast-fail açıklaması](https://learn.microsoft.com/en-us/cpp/intrinsics/fastfail) bu kodun farklı fatal nedenlerde de kullanılabileceğini açıklar.

Veri/uygulama config'i okumayan iki120s yalnız ephemeral-loopback HTTP/fetch/SHA denemesi default7747, `--no-maglev`7750 çevrimle tamamlandı. İkisi de çökmedi; bu fixture sorunu tekrar üretmedi. SQL/ticari/provider yazma0.

## Dar kaynak denemesi

Sabit `--no-maglev` yalnız izole completion supervisoru ve onun mevcut altı Node child profiline eklenir. Aynı binary/hash, SID, timestamp, tam child argv, parent flag/script konumu, manifest/config/copy ve port kontrolleri korunur. Ek flag veya bayraksız eski cohort benimsenmez. Windows güvenlik ayarı, NODE_OPTIONS, rol/secret/SQL/guard/timeout/retry değişmez. Hub ve TEST125/LIVE başlatma kodu değişmedi.

Bağımsız reviewer GO;43 hedefli offline kontrol PASS/0skip, Node syntax ve PowerShell AST0error. Bu kaynak kabulü mitigasyonun çalıştığı anlamına gelmez. Sonraki kanıt: aynı mevcut exact TEST bağlarında yeni immutable paket, tüm core readiness, süre boyunca aynı PID/creation/argv, normal yetkili okuyucular ve cihaz yeniden açılışı. Ticari200 satış veya migration tekrarlanmaz.
