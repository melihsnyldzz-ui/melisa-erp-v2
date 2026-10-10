# Kalıcı HTTPS adresi: kaynak hazırlığı

11 Ekim 2026. Bu kayıt çalışan paketin veya ağ ayarının değiştiğini göstermez. PR28 mevcut ERP PR23 tabanını korur; CRM PR3 için ayrı dar kaynak hazırlığı vardır. Eğitim PR27 ve sekiz mevcut ders korunur.

Önerilen adres `https://semih.tail295701.ts.net:8443/melisa-hub/`; yalnız yeni HTTPS8443 Serve handler → loopback5244 edge. Mevcut443 Chatwoot/Funnel ve4112/8083 ayarları korunacak. Device ACL ve anahtar süresi bu çalışmada değiştirilmez. Henüz Serve, unattended, görev, principal, firewall veya reboot uygulanmadı.

Edge yalnız exact Host/HTTPS Origin, loopback peer ve Serve tailnet bağlamıyla sabit namespace'leri taşır. Kurulu Tailscale1.102.2 [proxy kaynak sözleşmesi](https://github.com/tailscale/tailscale/blob/eb67e5dcbe145d63e1128b9b4b630f8a82da101f/ipn/ipnlocal/serve.go#L974) bu başlıkları üretir. Kullanıcı kimliği taşımayan tagged/WhoIs başarısız/Funnel istekleri fail-closed reddedilir; bütün tailnet cihazları açılır iddiası yok. Henüz gerçek8443 bağlantı kanıtı yok.

ERP normal ekranları5234, API4184; CRM `/crm/` ayrı derlemesi ve `/crm/api/live`62700. TEST1255194 bu edge'e bağlanmaz. Stable transport yalnız explicit DB02/kopya/port koşullarıyla açılır; legacy davranış korunur. İsteğe bağlı sonlu şirket LAN bind başarısız olsa bile loopback core çalışır; wildcard bind yok.

ERP ve CRM kendi normal kullanıcı/parola girişlerini, ayrı mevcut token/rol/DB02 kontrollerini kullanır. Remote test-admin/stage4-actor ve CRM test-admin/test-personnel session yolları kapalıdır. Yeni kullanıcı, parola veya rol yaratılmaz. Tedarikçi+döviz, CRM konuşması ve ERP sipariş token başlıkları yalnız ilgili exact kapsamda korunur; bozuk/kısmi/tekrar başlık reddedilir. `x-crm-authorization` browserdan üretilmez: mevcut CRM adapteri doğruladığı CRM Authorization'ı native isteğe dönüştürür. Cookie/Set-Cookie ve forwarded başlıklar uygulamaya geçirilmez. Provider/mesaj/AI/fixture-prepare uçları açılmaz.

HTTPS yeni origin'dir: eski sekmeler, taslaklar ve localStorage yerinde kalır; token/taslak kopyalanmaz ve otomatik replay yapılmaz. Terminal postMessage source/origin/schema kontrolleri korunur. Mevcut stok, fiyat, cari, finans, migration, quarantine ve LL kuralları değişmez.

Kaynak kontrolü: transport/bootstrap/Hub/normal auth/edge ve config-reference grubu44; ERP günlük ekran oturum/topology grubu84 hedefli offline test geçti. Dört HTTP testinde yalnız geçici loopback fixture kullanıldı; canlı API/SQL/provider çağrısı yapılmadı. Normal login401 ve mevcut ERP yetki403 sonuçları aynen taşındı. Mevcut normal personel hesaplarında aktif rol ve desteklenen parola hash'i salt okunur kontrol edildi; gerçek parola ile giriş veya insan kabulü sayılmaz.

`hub-stable-edge.mjs` yeni immutable paket/config/source SHA guard ile5244 bağlar; henüz başlatılmadı. Boot driver, dependency lock, CRM prefix paketleme, gerçek noninteractive SQL/private config erişimi, HTTPS tarayıcı, kontrollü kurtarma/IP değişimi ve açık bakım planıyla reboot hâlâ teslim/kabul bağımlılıklarıdır. Kaynak hazırlığını kesintisiz otomatik kullanım veya insan PASS olarak sunmayın.
