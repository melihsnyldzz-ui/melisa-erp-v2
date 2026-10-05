# ERP teslim panosu

**2026-10-05 kullanıcı önceliği.** Kalıcı kararlar [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md), tam kapsam [ERP_FINISH_PLAN.md](ERP_FINISH_PLAN.md), teknik kanıt [STATUS.md](STATUS.md), insan sonuçları [USER_ACCEPTANCE.md](USER_ACCEPTANCE.md). Bu pano mevcut finish tree'yi daraltmaz; günlük sıra burada tutulur. Bölüm içindeki satır sırası önceliktir. Bu başlangıç kaydı uygulama geliştirmesi/kabul yapmaz.

`Onaylı` iş seçilebilir; bağımlılığı hazır değilse bekler. `Teknik hazır / kullanıcı kabulü bekliyor` tamam değildir; kullanıcı sonucu ilgili UA kaydına bağlanır. `Tamam` yalnız işin tüm kabul ölçütleri ve GitHub teslimi kanıtlıysa kullanılır. Yeni kapsam veya öncelik kullanıcı kararı ister; kabul edilmiş işi yeniden açma. `ŞİMDİ` içinde tamamlanmamış iş varken `SONRA` öne alınmaz. ŞİMDİ tamamen tamamlandığında onaylı SONRA sırasının ilk işi, bağımlılığı hazırsa aynı sırayla ŞİMDİ’ye taşınır; yeni kapsam veya sıra değişimi sayılmaz. Bağımlılık hazır değilse beklenir; CANLIDAN SONRA otomatik taşınmaz.

## ŞİMDİ

| ID | Hedef | Kabul kriteri | Durum | Bağımlılık |
| --- | --- | --- | --- | --- |
| ERP-D01 | Yalnız TEST'te otomatik TEST ADMIN erişimini tamamla/kabul et. | Doğrulanmış TEST'te normal çalışma yüzü TEST ADMIN olarak açılır ve yenilenir; yalnız TEST sınırı hedefli kontrolde doğrulanır, kullanıcı ERP-UA01'i dener. | Teknik hazır / kullanıcı kabulü bekliyor; mevcut kanıt STATUS'ta | TEST kimliği ve mevcut görev yetkisi |
| ERP-D02 | `ornek-akis.html` Ürün & Stok'u kullanılabilir gerçek katalog yap. | ERP-DEC-004 alanları kaynak kimliği/tarihiyle doğrulanır; eksik veri uydurulmaz; normal arama/barkod/detay kullanılabilir; ERP çalışma yüzü ve CRM için ERP-DEC-005 sözleşmesi kaydedilir; ERP-UA02 PASS. Mevcut A01/A02/B02 kanıtları kullanılır. | Onaylı; ERP-D01 bağımlılığı bekliyor | ERP-D01 kullanıcı kabulü; ERP-DEC-001/004/005 |
| ERP-D03 | Fotoğraf arşivini salt okunur keşfet, ürün eşleme planını çıkar. | Arşiv kaynakları ve ürün kimliği bağları raporlanır; belirsiz/eksik eşlemeler açık kalır; hiçbir fotoğraf/ürün kaydı değişmez; kullanıcı ERP-UA03 ile planı inceler. | Onaylı; ERP-D02 bağımlılığı bekliyor | ERP-D02 kabulü; ERP-DEC-004 |

## SONRA

| ID | Hedef | Kabul kriteri | Durum | Bağımlılık |
| --- | --- | --- | --- | --- |
| ERP-D04 | Onaylanan fotoğraf eşleme planını uygula. | A03 kapsamında doğru ürünün gerçek fotoğrafı/eksik fotoğrafı normal ekranda kullanıcıya doğru görünür; değişen kapsam için UA kaydı ve teknik kanıt bağlanır. | Onaylı sıra; plan hazır değil | ERP-D03 plan kabulü ve ilgili uygulama yetkisi |
| ERP-D05 | CRM katalog bağlantısı için ERP sözleşmesini teslim et. | CRM-D02 için onaylı API/sözleşme ve exact kaynak commit bağlantısı teslim edilir; kod/ürün/fiyat/para birimi/fotoğraf kimliği ile eksik/hata alanları belgelenir. CRM tüketimi CRM-D02 kapsamında ayrıca kabul edilir. | Onaylı sıra; bağımlılık bekliyor | ERP-D02/04; ERP-DEC-005 |
| ERP-D06 | 7733 ürün/fiyat/fotoğraf gerçek kabulünü destekle. | CRM-D03 ile yalnız yeni/değişen sözleşme kapsamı telefonda kabul edilir; önceki PASS kayıtları yeniden açılmaz. | Onaylı sıra; bağımlılık bekliyor | ERP-D05; CRM-D03; tam alıcı için mevcut gönderim yetkisi |
| ERP-D07 | Mevcut LIVE teslim haritasının kritik işlerine dön. | Mevcut finish ID'leri ve [ortak harita](MELISA_TESLIM_HARITASI_V1.md) referans alınır; sıradaki somut kritik dilim kullanıcı önceliğiyle ŞİMDİ'ye taşınır, eski kapsam silinmez. | Onaylı dönüş noktası | ERP-D06; ilgili kritik iş bağımlılıkları; yayın ayrıca yetkili |

## CANLIDAN SONRA

| ID | Hedef | Kabul kriteri | Durum | Bağımlılık |
| --- | --- | --- | --- | --- |
| ERP-D08 | Canlı teslimi engellemeyen yeni fikirleri canlıdan sonra değerlendir. | Somut fikir geldiğinde ERP-DEC-007 uyarınca ID/kabul ölçütüyle kaydedilir; uygulama yeni kullanıcı kararıyla başlar. | Bekleyen fikir havuzu; uygulama onayı yok | Mevcut canlı teslim; yeni kullanıcı kararı |
