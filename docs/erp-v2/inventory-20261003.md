# ERP envanteri — 3 Ekim 2026

Bu belge [ERP_FINISH_PLAN.md](../../ERP_FINISH_PLAN.md) için kanıt envanteridir. Tamamı salt okunur keşfe dayanır; bu aşamada deployment ve ticari yazım yapılmadı.

## Kapsam

Doğrudan incelenen host EVDEKIPC / WARD-V2. Documents, Desktop, Downloads ve mevcut Codex worktree yolu tarandı; Git metadata, branch/commit, çalışma ağacı farkları ve worktree kayıtları alındı. Uygulama bağımlılıkları/derleme önbellekleri, cloud drive içerikleri ve kurulu binary uygulamaların içi taranmadı. SEMIH'in dosyaları erişilebilir değildi. **Bu, bütün bilgisayarlardaki tüm ERP kopyalarının envanteri değildir.**

Ham yerel kanıt `work/local-inventory.json` olarak bu sohbetin çalışma dizininde tutulur. Git'e eklenen [sanitized-inventory-20261003.json](sanitized-inventory-20261003.json) secret içermeyen kaynak/commit/dal özetidir. Eski kaynaklarda fetch/checkout/reset yapılmadı. Aşağıdaki inceleme checkout'u yeni oluşturuldu.

## EVDEKIPC kaynakları

Kısaltma: `Documents` = `C:\Users\WARD-V2\Documents`.

| Dizin | Dal | Commit | Yerel fark |
|---|---|---|---|
| Documents/erp | main | 37255fe | Yok |
| Documents/melisa-erp-v2 | main | fc30b25 | Yok |
| Documents/melisa-erp-v2-autonomous-lab | main | 66b067e | Yok |
| Documents/melisa-one | main | 2f6d7ca | Yok |
| Documents/melisa-terminal-app | main | ab0904a | 10 durum satırı |
| Documents/New project | main | 4782505 | 1 durum satırı |
| Documents/GitHub/melisa-bebe-erp | main | 911ff69 | Yok |
| Documents/GitHub/melisa-erp-v2 | codex/erp-ui-modernization | 01946e3 | 14 durum satırı |
| Documents/GitHub/melisa-terminal-app | main | e7697b6 | 19 durum satırı |
| Documents/Codex/2026-06-29/imdi-g-venli-deney-ortam-n/lab | main | 66b067e | 14 durum satırı |
| Bu sohbet/work/erp-source | codex/erp-finish-20261003 | 577c0cb tabanı | Yeni dokümantasyon checkout'u |

“Durum satırı” dosya/klasör kaydıdır; özellik veya kayıp commit sayısı değildir. Her repo kendi `git worktree list --porcelain` kaydıyla tutuldu. Ayrıca Git metadata bulunmayan `Documents/GitHub/melisa-terml-app-v1.8-clean-20260520-014210` kaynak klasörü ve masaüstündeki `Melisa_Bebe_ERP_EXE`, `Melisa_Bebe_ERP_OneFile`, `Melisa_Bebe_ERP_Portable`, `Melisa_Bebe_B2B_ERP_Portable`, `melisa_bebe_mini_erp_paketi_yeni` paketleri bulundu; içerikleri çalıştırılmadı veya silinmedi. Masaüstü `proje` altında eski B2B ERP kaynakları/çıktıları da var; güncel runtime kaynağı oldukları kanıtlanmadı.

`Documents/GitHub/melisa-erp-v2` içindeki `.env.local` dosyasından yalnız izinli alanlar raporlandı: SQL host `100.87.188.3`, port `1433`, database `MELISA_ERP_V2`, development ortamı. **Bu disk yapılandırmasıdır; çalışan süreç bağlantısı veya gerçek DB kimliği kanıtı değildir.** Token/parola değerleri raporlanmadı.

## GitHub dalları ve karşılaştırma

Kanonik repo için mevcut aile: `melihsnyldzz-ui/melisa-erp-v2`. GitHub varsayılan dalı `main`, HEAD `577c0cb9d0953635b30088fa23e1e887c7b75775` (8 Eylül). Bu kaynakta README hâlâ iskelet/mock aşamasını anlatıyordu; gerçek uygulama kodu ve Temmuz kabul kayıtlarıyla çelişen giriş bu dokümantasyon dalında düzeltildi.

| Dal | Tam HEAD | Main'e göre değerlendirme |
|---|---|---|
| codex/commerce-erp-quality-20260908 | f787cfe5ce5e16c1bee5dcaa03a7783b3a0546f1 | Main ancestor; +64 commit, 275 dosya, +12487/-1732 satır |
| review/erp-simplification-20260915 | aea716f184fb00af1c109a9efe6105900949c85e | Main ancestor; +1 commit, 10 dosya, +620/-1160 satır |
| codex/native-terminal-source-20260929 | 552491b22d13f4d87b34d578115ac62b49d28f50 | Main ancestor; +1 commit, 74 dosya, +6475 satır |

Diğer 10 dalın tam isim/HEAD bilgileri JSON envanterinde. Commerce ve sadeleştirme dalları ortak navigation dosyalarını değiştiriyor. Native kaynak dalı Android istemcisini koruyor; [kendi README'si](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/552491b22d13f4d87b34d578115ac62b49d28f50/apps/terminal-native/README.md) uyumlu `/api/native-terminal` backend'inin bu teslimde bulunmadığını açıkça söylüyor. Kaynak sürümü candidate.18-t2 / versionCode 20; köken tabanı `0e14256f13f03d5cf7610a955da7b5ec0a2b52b3`, yerel değişiklikler korunmuş. Bu sürümün bugün cihazda kurulu olduğu henüz ölçülmedi.

Sonuç: GitHub `main`i doğrudan TEST'e kurmak güncel native ERP'yi devralmak anlamına gelmez. SEMIH runtime kaynağı görülmeden toplu merge ve yeniden kurulum yapılmamalı.

## Servis, port ve DB kanıtı

3 Ekim doğrudan gözlemleri:

- EVDEKIPC `Get-NetTCPConnection -State Listen`: 5188/4114/4116/5194/4144/4146/4100 için listener yok. WSL OpenClawGateway'de bu ERP portları görünmedi.
- Tailscale: EVDEKIPC `100.90.192.55`; SEMIH `100.87.188.3`; 2MUHASEBE `100.84.179.20` erişilebilir peer'lar olarak listelendi.
- SEMIH `100.87.188.3:4100/api/health` yanıtı, **2026-10-03 17:25:51 UTC / 20:25:51 İstanbul**: `success:true`, `service:melisa-erp-api`, `status:ok`. `/api/version`: development, version v0.1.0, sql/vega/authDatabase bayrakları true. Bu bayraklar DB adı/sorgu doğruluğu veya ticari kabul değildir.
- Tailscale adreslerinde yapılan kısa TCP denemesinde ERP portlarından yalnız SEMIH 4100 erişildi. 5188/4114/4116/5194/4144/4146'ya bu adreslerden ulaşılamadı. Süreç kapalı sonucu çıkarılmaz; yalnız farklı LAN/loopback arayüzüne bağlı olabilir.
- SEMIH SMB paylaşım listesi mevcut kimlikle Windows “Erişim engellendi” sonucu verdi. Remote shell veya dosya erişimi kurulmadı, credential aranmadı/değiştirilmedi.

Kullanıcının bildirdiği LIVE 5188→4114/4116 ve TEST 5194→4144/4146 düzeni korunacak. Güncel süreçlerin executable/cwd/servis sahibi ve DB hedefi SEMIH'te okunmalı. Web kısayollarındaki `127.0.0.1` her bilgisayarın kendisidir; EVDEKIPC'deki kısayol SEMIH'i açmıyor.

Tarihsel kayıtlar, güncel kanıt sayılmadan tutulur:

- “Mevcut ERP çalışmasını eşleştir” sohbeti, 2 Ekim 10:14:05 UTC: `192.168.1.46:4114` health 200, aynı host loopback 4114 ECONNREFUSED. Bu, arayüz farkı olabileceğini gösterir.
- Aynı sohbet şirket TEST hedefini `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01` olarak kaydetmiş; 4100 foto/ERP DB'sinden ayrı tutulmuş. Güncel DB kimliği henüz doğrudan ölçülmedi.
- Aynı sohbetin 2 Ekim TEST erişim/red ve NOT_DEPLOYED paket kayıtları, 3 Ekim kullanıcı talimatının veya daha yeni CRM kabulünün yerine geçirilmez. Yeni çalışmada eski onay döngüleri tekrar üretilmez.

## Korunan kabul kayıtları

Kayıtlar okundu; bu oturumda testler tekrar çalıştırılmadı. Tarih ve kapsam aynen korunur. Bunların varlığı çalışan SEMIH sürümüne zaten alınmış olduklarını göstermez.

| Akış | Kayıt | Kapsam |
|---|---|---|
| ERP Core insan kabulü | [9 Temmuz kabul günlüğü](final-human-acceptance-log.md) | Melih onayıyla uyarılı kabul; belirtilen eski baseline |
| Alış → satış → tahsilat/ödeme | [8 Eylül web/SQL](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/f787cfe5ce5e16c1bee5dcaa03a7783b3a0546f1/docs/erp-v2/commerce-web-sql-acceptance-20260908.md) | İzole SQL ve gerçek tarayıcı; stok 10→8, cari 60→40, tedarikçi 120→110, net kasa 10 |
| TRY/USD/EUR kasa aç/kapat | [9 Eylül kasa](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/f787cfe5ce5e16c1bee5dcaa03a7783b3a0546f1/docs/erp-v2/commerce-cash-acceptance-20260909.md) | SQL/tarayıcı; çekmece devir 10/5/6; fark nedeni ve dönem kilidi |
| Sayım, yetki, fark | [9 Eylül sayım](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/f787cfe5ce5e16c1bee5dcaa03a7783b3a0546f1/docs/erp-v2/commerce-stock-count-acceptance-20260909.md) | Tarayıcı 5→7→6→8, üç hareket/audit |
| Eksik kur / ayrı döviz tutarı | [9 Eylül kur](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/f787cfe5ce5e16c1bee5dcaa03a7783b3a0546f1/docs/erp-v2/commerce-finance-rates-20260909.md) | SQL/tarayıcı; eksik kurda NULL, yapay kurlarla doğru toplam |
| Kasa kapanışı ile eşzamanlı tahsilat | [10 Eylül yönlendirme](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/f787cfe5ce5e16c1bee5dcaa03a7783b3a0546f1/docs/erp-v2/cash-routing-20260910.md) | Gerçek servis/SQL; tarayıcı/HTTP kabulü olarak sunulmaz |
| İptal/düzeltme/kapalı kasa | [10 Eylül fiş yaşam döngüsü](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/f787cfe5ce5e16c1bee5dcaa03a7783b3a0546f1/docs/erp-v2/invoice-lifecycle-20260910.md) | Gerçek servis/SQL; bütün dövizler ve tam UAT kapsamı değil |
| Terminal tekrar gönderimi | [8 Eylül transaction](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/f787cfe5ce5e16c1bee5dcaa03a7783b3a0546f1/docs/erp-v2/terminal-server-transaction-safety-20260908.md) | Gerçek izole SQL; dört aynı istek tek fiş; hatada birlikte rollback; Expo/native ayrımı korunur |

## Bir sonraki hostta devam

Kullanıcı mevcut sohbeti SEMIH'e geçiremediği için orada yeni sohbet açacak. Bu planı yeniden yazmak veya kullanıcıdan uzun görev metni almak gerekmez. Önce hostun SEMIH ve araç çalışma yolunun orada olduğunu doğrula. Bu dalın dokümantasyonunu çalışan repo üzerine kontrol ederek taşı; uygulama dosyalarını eski GitHub tabanıyla ezme. Çalışan kaynağı envantere ekle, mevcut gerçek kabulleri eşleştir, sonra yalnız açık farkları TEST'te tamamla.
