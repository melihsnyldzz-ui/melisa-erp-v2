# 19 Ekim — küçük, SQL'siz gerçek Hub başlangıç ve geri dönüş provası

ERP-DEC-066 / `ERP-LIGHT-REHEARSAL-20261019-1253`, mevcut P03 ve PR54 kapsamında tamamlanan dar teknik kanıttır. Yeni ana görev, veritabanı veya takip sistemi kurulmadı. Ortak kurulu TEST korunmuştur; bu prova ortak TEST'e yeni aday kurulumu veya insan kabulü değildir.

## Kaynak ve gerçek yürütme

Başlatıcı kaynağı `1433c96b12ec2b0f5f78025d703b5ed0a6555d50`; ilk Light kaynağı `d175c9ade66426370dc9fecb869387ecc95a380c`. Gerçek uygulama, mevcut Express route factory ve mevcut Hub middleware/statik dosyalarını kullanır. Shared girişinin SQL bootstrap ve terminal başlatması ayrıştırılmadı veya gevşetilmedi; route oluşturma ayrı factory'ye taşındı, Shared Host/socket/CSP/public-scope/terminal sırası regresyon testleriyle korundu.

Gerçek ortak `start-hub-web.ps1` içindeki paket ailesi, source prefix, owner, Node ve dosya/manifest pin kontrolleri çalıştı. Açık `-LightRehearsal` profili yalnız ayrı fiziksel rehearsal kökü ve `127.0.0.1:5354` kabul eder. Light ve Shared manifestleri birbirinin yerine geçmez. `Watch`, `RunId` ve `Attempt` Light için reddedilir. Ortak DB02 bootstrap/adoption ve iki COM gözetmeninin geçişi bu profilde çalıştırılmaz.

| Gerçek faz | Uygulama kaynak kanıtı | Başlatıcı | Sonuç |
| --- | --- | --- | --- |
| Eski | e59e07abf7ae2567cdc2adb93811fe29e0032fe5 | 1433c96b | Başlangıç kimliği ve HTTP doğrulandı; yalnız sahip olunan süreç kapandı. |
| Aday | 01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2 | 1433c96b | Gerçek candidate19 adı/pinleriyle başlangıç ve HTTP doğrulandı; süreç kapandı. |
| Eskiye dönüş | e59e07abf7ae2567cdc2adb93811fe29e0032fe5 | 1433c96b | Eski uygulama dosyaları tekrar başlatılıp doğrulandı; süreç kapandı. |

Her uygulama kaynağı, kendi değişmez paket manifestinden doğrulanan Hub modülü ve dört statik dosyadır; yeni başlatıcı/factory ayrı kaynaktır. Eski paketin tam SQL bağlı giriş programı başlatıldı denmez. Üç faz farklı gerçek child/parent kimliği, doğum zamanı ve tek loopback binding ile doğrulandı. IPC kapanışı ve başarıyla çıkıştan sonra port boşluğu her fazda kontrol edildi. Görev kurulmadı, yabancı PID sahiplenilmedi veya kapatılmadı.

Her fazda gerçek HTTP üzerinden HTML/CSS/iki JS byte hashleri, health kaynak etiketleri, CSP/no-store/nosniff, HEAD, yanlış Host/Origin/forwarded retleri, POST405 ve küçük sentetik okuma/ret sınırları kontrol edildi. Bu 17 kontrol günlük ticari işlem veya normal personel yetki kabulü değildir. Hub `pin=null` çalışır: dış servis probe'u yapmaz; ERP/CRM/terminal/LIVE hazırmış gibi gösterilmez. Normal kullanıcı kimliği ve günlük akış hazır oluşu kanıtlanmış sayılmaz.

## Küçük hedef ve korunmuş hata

- Başarılı run: `run-0fc2f8a5a4044935a5fcc2a4b07811a3`; 19 Ekim **13:22:56Z / 16:22:56 TR**. Sonuç `LIGHT_HUB_OLD_NEW_OLD_VERIFIED`, üç gerçek faz ve temiz kapanış.
- Yeni run26dosya / **426.366 byte**; ayrı kaynak kontrol paketi5dosya / **51.561 byte**, manifest `04015e3b8b453836764aabb0e363f9bec0fbefc86d8c60c446533a0202fd07dd`. Bu kontrol paketi shared uygulama kurulumu değildir.
- Express bağımlılık kapanışı mevcut immutable adaydan68paket/615dosya SHA ile ayrı pinlendi; node_modules veya Node binary kopyalanmadı. İki sentetik ürün, bir müşteri ve bir tedarikçi yalnız ayrı fixture alanıdır. SQL bağlantısı/SQL kopyası/yeni DB yok.
- İlk gerçek run `run-94163b8f0eda4bdaa6f73a7ab433d7c3`, `P03_LIGHT_HOST_DENIED` ile başarısız ve `cleanupConfirmed:true` olarak korunur. Node24 `fetch` yanlış Host değerini göndermediği için test geçersiz istek üretmişti; bağımsız loopback transport deneyi bunu gösterdi. Yalnız test probu sabit hedefli, süre/boyut sınırlı `node:http.request` ile düzeltildi; sunucunun Host403 şartı kaldırılmadı. Başarısız kayıt silinmedi veya PASS'e çevrilmedi; yeni source ve yeni run kullanıldı.

## Ortak TEST'in bağımsız önce–sonra okuması

Kaynak e59 / supervisor13b / CRM6bc kurulumu korunur. Önce ve sonrasında **11 listener bindinginin PID/doğum/adres/port kimliği**, iki mevcut görevin Running/action hashleri, 4184/4186 health source/DB02/copy/T1false alanları ve ERP5234/Hub5234/CRM62700 HTTP200 içerik SHA'ları aynıdır. Prova portu5354boştur. Bu, bütün SQL tablo içeriklerinin karşılaştırılması veya SQL restore/rollback provası değildir; `sqlContentCompared:false` açık tutulur. Driver'daki `sqlCalls:0` / `sharedRuntimeChanged:false` alanları tek başına bağımsız invariant kanıtı olarak kullanılmaz.

Shared SQL/runtime/config/store/task action/kurulum/servis restart, TEST125/veri/roller/karantinalar/LL/yedekler üzerinde işlem yapılmadı. Eski b264 engine `ROLLBACK_READBACK_FAILED/QUARANTINED`, journal/claim/lock kayıtları korunur; bu hafif mod onu READY yapmaz. LIVE/Vega/T1/main/CRM kaynak/gerçek mesaj/ücretli servis yok.

## Test, CI ve kanıt sınırı

İlk birleşik26hedefli kaynak/regresyon testi ve22API güvenlik/projection testi PASS. Son Host/partial-ready değişikliğinin9hedef testi PASS; bağımsız kaynak incelemesi GO. Windows CI yeni Light testini gerçekten çalıştırdı. Bunlar insan kabulü değildir.

- İlk kaynak d175c9ad: [PR CI39258071606](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39258071606) ve [push CI39258063430](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39258063430) SUCCESS.
- Son uygulanan başlatıcı/driver kaynağı1433c96b: [PR CI39259023951](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39259023951) ve [push CI39259015924](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39259015924) SUCCESS.
- Bu kanıt belgesinin teslim commit'i ve otomatik CI'si uygulama source/kurulumdan ayrı kaydedilir.

Bağımsız offline kanıt incelemesi başarılı proof SHA'sını, iki artifact'ın16dosya hashini ve eski/aday manifest kaynak bağlarını, üç gerçek fazı ve root önce–sonra kayıtlarını ayrı doğruladı: GO. İnceleyen ajan runtime/ağ/SQL işlemi yapmadı. Private kanıtlar repo dışındadır:

| Kanıt | SHA256 |
| --- | --- |
| Başarılı run `proof.json` | e870c2e844ca89069a030ca0aa7583bcfd426bba7f4c4354dd70f97b6b00eac2 |
| Başarısız ilk run `proof.json` | 85b31ae749eef30aaaffe7838b7540d730553b9ee8fa2df2b05614d6c842f493 |
| `light-hub-host-transport-1253.json` | 3e82e8b375ff2ad3d88d752590a4f1db90310e49987de0909d194ee9e4706cb3 |
| `light-hub-shared-after-final-1253.json` | 47bf380bc01620f82343c084bd05e672fe7b2823dbec965604893fdcfc684c3d |

Run kökü `C:/Sirket/ERP/rehearsal/ERP-LIGHT-REHEARSAL-20261019-1253/`; root önce/sonra/transport/operator kayıtları `C:/Sirket/ERP/reports/integration-audit-20261019/` altındadır. Ham süreç/SID/özel config/ticari ekran GitHub'a eklenmedi.

**Açık kalan:** Tam shared bootstrap/owner geçişi ve guarded ortak rollback bu provanın kapsamı değildir; yeni aday ortak TEST'e kurulmadı. Windows Computer Use mevcut Chrome URL'sini güvenle belirleyemediğinden GUI BLOCKED kaydı korunur, başka UI aracıyla aşılmaz. Yeni yan-yana personel/İlker turu veya insan kabulü PASS yok. Önceki gerçek barkod arama alanına ulaştı, katalog eşleşmesi0; yeni ürün bağı/ticari hareket ve fiziksel tekrar yok. Özgün USER_ACCEPTANCE ve49ERP/25CRM kapanışları aynı.
