# ERP teslim panosu

2026-10-05 son kullanıcı talimatı: ERP-UA03 PASS, ERP-D03 tamam. Yalnız ERP-D04 TEST fotoğraf uygulaması yürütülür; 3.830 kesin aday merkezi medyaya kopyalanır, 67 belirsiz ve karantina dışarıda. Bu görevden sonra durulur; ERP-D05/CRM başlamaz.

## Önceki plan hazırlığı kaydı

5 Ekim güncel kullanıcı talimatı: ERP-UA02 normal katalog/performans **PASS**; ERP-D02 bu kapsamda tamam. Yalnız ERP-D03 salt okunur arşiv planı hazırlandı; [rapor](docs/erp-v2/canonical-20261005/photo-mapping-plan.md)/[manifest](docs/erp-v2/canonical-20261005/photo-mapping-plan.json) ERP-UA03 incelemesine hazır. Plan kabul edilmeden ERP-D04/toplu fotoğraf bağlama yok; bu tur burada durur. ERP-UA01 için ayrı sonuç beklenir.

Önceki performans teslim kaydı (ERP-D03 talimatından önce): ERP-D02 default50 paket40/sourcedf3de90 teknik teslim edildi; ölçüm STATUS'ta, o anda ERP-UA02 bekliyordu. Performans sonrası fotoğraf işine geçilmedi; kullanıcı daha sonra yukarıdaki açık kabul ve yalnız ERP-D03 talimatını verdi.

**2026-10-05 kullanıcı önceliği.** Kalıcı kararlar [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md), tam kapsam [ERP_FINISH_PLAN.md](ERP_FINISH_PLAN.md), teknik kanıt [STATUS.md](STATUS.md), insan sonuçları [USER_ACCEPTANCE.md](USER_ACCEPTANCE.md). Bu pano mevcut finish tree'yi daraltmaz; günlük sıra burada tutulur. Bölüm içindeki satır sırası önceliktir. Bu başlangıç kaydı uygulama geliştirmesi/kabul yapmaz.

`Onaylı` iş seçilebilir; bağımlılığı hazır değilse bekler. `Teknik hazır / kullanıcı kabulü bekliyor` tamam değildir; kullanıcı sonucu ilgili UA kaydına bağlanır. `Tamam` yalnız işin tüm kabul ölçütleri ve GitHub teslimi kanıtlıysa kullanılır. Yeni kapsam veya öncelik kullanıcı kararı ister; kabul edilmiş işi yeniden açma. `ŞİMDİ` içinde tamamlanmamış iş varken `SONRA` öne alınmaz. ŞİMDİ tamamen tamamlandığında onaylı SONRA sırasının ilk işi, bağımlılığı hazırsa aynı sırayla ŞİMDİ’ye taşınır; yeni kapsam veya sıra değişimi sayılmaz. Bağımlılık hazır değilse beklenir; CANLIDAN SONRA otomatik taşınmaz.

## ŞİMDİ

| ID | Hedef | Kabul kriteri | Durum | Bağımlılık |
| --- | --- | --- | --- | --- |
| ERP-D01 | Yalnız TEST'te otomatik TEST ADMIN erişimini tamamla/kabul et. | Doğrulanmış TEST'te normal çalışma yüzü TEST ADMIN olarak açılır ve yenilenir; yalnız TEST sınırı hedefli kontrolde doğrulanır, kullanıcı ERP-UA01'i dener. | Teknik hazır / kullanıcı kabulü bekliyor; mevcut kanıt STATUS'ta | TEST kimliği ve mevcut görev yetkisi |
| ERP-D02 | `ornek-akis.html` Ürün & Stok'u kullanılabilir gerçek katalog yap. | ERP-DEC-004 alanları kaynak kimliği/tarihiyle doğrulanır; eksik veri uydurulmaz; normal arama/barkod/detay kullanılabilir; ERP çalışma yüzü ve CRM için ERP-DEC-005 sözleşmesi kaydedilir; ERP-UA02 PASS. Mevcut A01/A02/B02 kanıtları kullanılır. | Tamam — kullanıcı2026-10-05 normal katalog/performansı kabul etti; ERP-UA02 PASS,TEST paket40/source df3de90. ERP-UA01 ayrı açık; bu kabul fotoğraf/CRM/migration kapsamını kapatmaz. | ERP-DEC-001/004/005; kullanıcı doğrudan kapsam kabulü |
| ERP-D03 | Fotoğraf arşivini salt okunur keşfet, ürün eşleme planını çıkar. | Arşiv/kimlik bağları raporlandı; belirsizler ayrı, orijinaller korundu; ERP-UA03 PASS. | Tamam — 2026-10-05 kullanıcı planı kabul etti; 3315f3a rapor/manifest teslimi ve CI yeşil. 3.830 kesin/67 belirsiz; plan kabulü fotoğraf ekranı kabulü değildir. | ERP-D02 kabulü; ERP-DEC-004/008 |

## SONRA

| ID | Hedef | Kabul kriteri | Durum | Bağımlılık |
| --- | --- | --- | --- | --- |
| ERP-D04 | Onaylanan 3.830 fotoğrafı merkezi TEST medyaya kopyala ve normal karta bağla. | Her kayıtta taze exact kimlik/hold/hash; 67 belirsiz hariç; tek doğrulanmış aday kartta ana görsel; 50 liste hızları korunur ve gerçek örnekler doğrulanır. | Uygulanıyor — kullanıcı doğrudan ERP-D04 talimatını verdi; kaynak/medya ve yeni ekran kanıtı STATUS ile tamamlanacak. Başka işe geçilmez. | ERP-UA03 PASS; ERP-DEC-008; CRM/LIVE/main merge dışarıda |
| ERP-D05 | CRM katalog bağlantısı için ERP sözleşmesini teslim et. | CRM-D02 için onaylı API/sözleşme ve exact kaynak commit bağlantısı teslim edilir; kod/ürün/fiyat/para birimi/fotoğraf kimliği ile eksik/hata alanları belgelenir. CRM tüketimi CRM-D02 kapsamında ayrıca kabul edilir. | Onaylı sıra; bağımlılık bekliyor | ERP-D02/04; ERP-DEC-005 |
| ERP-D06 | 7733 ürün/fiyat/fotoğraf gerçek kabulünü destekle. | CRM-D03 ile yalnız yeni/değişen sözleşme kapsamı telefonda kabul edilir; önceki PASS kayıtları yeniden açılmaz. | Onaylı sıra; bağımlılık bekliyor | ERP-D05; CRM-D03; tam alıcı için mevcut gönderim yetkisi |
| ERP-D07 | Mevcut LIVE teslim haritasının kritik işlerine dön. | Mevcut finish ID'leri ve [ortak harita](MELISA_TESLIM_HARITASI_V1.md) referans alınır; sıradaki somut kritik dilim kullanıcı önceliğiyle ŞİMDİ'ye taşınır, eski kapsam silinmez. | Onaylı dönüş noktası | ERP-D06; ilgili kritik iş bağımlılıkları; yayın ayrıca yetkili |

## CANLIDAN SONRA

| ID | Hedef | Kabul kriteri | Durum | Bağımlılık |
| --- | --- | --- | --- | --- |
| ERP-D08 | Canlı teslimi engellemeyen yeni fikirleri canlıdan sonra değerlendir. | Somut fikir geldiğinde ERP-DEC-007 uyarınca ID/kabul ölçütüyle kaydedilir; uygulama yeni kullanıcı kararıyla başlar. | Bekleyen fikir havuzu; uygulama onayı yok | Mevcut canlı teslim; yeni kullanıcı kararı |
