# Melisa Hub — tek başlangıç portalı

11 Ekim 2026; ERP-CRM-HUB01 / ERP-DEC-043. Bu belge kaynak tasarımını kaydeder. Çalışan paket, yeniden başlatma ve kesin bağlantı sonuçları STATUS'taki teknik makbuzda ayrıca tutulur.

## Kullanım

Hedef şirket başlangıcı: `http://192.168.1.46:5234/melisa-hub/`. Portal mevcut ERP web sunucusunun altında çalışır; ERP, Zebra ve sekiz eğitim dersi aynı origin içinde kökten göreli bağlantılarla açılır. CRM, yalnız çalışma ortamında doğrulanmışsa aynı host üzerindeki mevcut 62700 portuna gider. TEST125 kendi korunan 5194 ortamında kalır. Orijinal/canlı ERP kimliği doğrulanmadan LIVE bağlantısı etkinleşmez.

Portal ticari kayıt, kullanıcı oturumu, rol veya insan kabul sonucu üretmez. Uygulama bağlantısı çalışıyor demek veritabanı, bütün iş akışı, fiziksel cihaz ya da insan kabulü PASS demek değildir. Statik kabul turu ve anonim sonuç özeti private yönetici raporu/video yerine geçmez.

## Evden erişim

Ev bilgisayarı Tailscale açıkken 11 Ekim kontrolünde 192.168.1.46 ERP5234, CRM62700 ve eğitim/Zebra HTML sayfaları açıldı. Erişim mevcut onaylı `192.168.1.0/24` subnet router üzerinden sağlanır; bu özel IP'ye sırf Tailscale kurulu olduğu için erişilemez. Ev ve şirket aynı LAN aralığını kullandığından seçilen route ayrıca incelendi. İstemci route seçimi ve router kullanılabilirliği değişirse bu adres çalışmayabilir.

Semih Tailscale IP/MagicDNS üzerinde doğrudan 5234/62700 kontrolü zaman aşımına uğradı; bu adresler çalışıyor diye sunulmaz. Mevcut Semih HTTPS kökü Chatwoot'a aittir ve korunur. Yeni Serve/Funnel, firewall veya tailnet yetki/cihaz politikası bu ilk tasarımın parçası değildir. Gerçek cihaz sınırlaması, mevcut ACL/route üyeliği kanıtı veya ayrıca onaylanan kesin policy ile değerlendirilir.

## Güvenlik ve uzatma

- Host/binding/peer ve uygulama kimlik doğrulama/yetki sınırları korunur. Loopback reverse proxy, uzak kullanıcının LAN kısıtını sessizce geçmesine neden olmamalıdır.
- Browser yalnız aynı origin Hub config/status uçlarını okur. CORS wildcard, yeni test-admin çağrısı, token taşıma, API parolası veya ticari sağlık sorgusu yoktur.
- Özel kanıt dizinleri static webroot'a kopyalanmaz. Yönetici erişimi ayrıca korunmadan rapor veya video yayımlanmaz.
- Yeni ekranlar portalın kontrollü katalog ve doğrulanmış runtime config sözleşmesine eklenir. Javascript/data/file URL'leri, dış origin ve doğrulanmamış LIVE hedefi reddedilir.
- Otomatik başlangıç mevcut paket/port sahibi/launcher kimliğiyle yapılmalıdır. Eski launcher'ı çalıştırmak daha yeni CRM paketini geriye çevirebileceğinden güncel manifest önceden doğrulanır. Tam Windows reboot/logon ve gerçek IP değişimi ayrı kanıttır.

TEST125, önceki 283 cari/16 hesap, migration, Vega/LIVE, ERP PR23, CRM PR3 ve bekleyen Eğitim PR27 bu değişiklik tarafından yeniden uygulanmaz veya kabul edilmiş sayılmaz. İnsan portal kabulü ERP-UA32 bekler.
