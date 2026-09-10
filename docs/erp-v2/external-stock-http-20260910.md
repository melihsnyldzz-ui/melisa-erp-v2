# Dış stok gateway HTTP kabulü

`npm run test:external-stock-http` gerçek externalReadOnlyServer, externalReadOnlyRoutes, externalReadOnlyAuth ve externalReadOnlyStockService kaynaklarını VM içinde yükler. Express gerçek loopback HTTP sunucusudur; yalnız stok/SQL bağımlılıkları sentetik veridir. VM yalnız dört kaynak dosyasına ve tanımlı bağımlılıklara izin verir; gerçek ortam dosyası/SQL driver/messaging route yüklemez. Port işletim sistemi tarafından atanır, adres127.0.0.1; test sonunda tüm bağlantılar ve sunucu kapanır.

17HTTPkontrolPASS: disabled503,eksik/yanlışanahtar401,varsayılanVega200,Melisa200,limitüst sınırı7,geçersiz/çoklusource400,kaynakların ayrı sayımı/tekürünü200,bulunamayan404,yinelenenkod409,yanlışkaynak502,erişilemeyenkaynak503,POSTstock/query404. Reddedilen istekler stok bağımlılıklarına ulaşmaz; özel driver ayrıntısı yanıta sızmaz. GerçekSQL/mesaj/ticariyazma0.

İlk test taslağı, başlangıçta kopyalanan kaynak kapsamının test sırasında env nesnesi değiştirilince değişmesini bekledi; bu test varsayımı yanlıştı ve çıkarıldı. Yanlış şirket/dönem başlangıcı ayrı kaynak birim testinde503olarak doğrulanır. HTTP sonucundan dinamik ayar değiştirme kabulü çıkarılmaz.

Bu test canlı erişim anahtarı, uzak tunnel, gerçek Vega/Melisa verisi veya deployment kabulü değildir. Önceki178ticari test ve kaynak type/build kanıtları ayrıca korunur. Birleşik temanın tarayıcı kontrolü hâlâ açık.
