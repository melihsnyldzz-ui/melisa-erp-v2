# ERP ↔ CRM işletme kapsamı genişletmesi — anonim kaynak kanıtı

Bu kayıt, ayrı DB02 ortak TEST kopyasının doğrulanmış kaynak kapsamını ve izolasyon provası sonuçlarını gösterir. **Geniş ortak insan TEST’i başlatılmadı; uçtan uca çalışan uygulama, GUI, replay ve son CI kanıtları bekliyor.** Kaynak uygunluğu, tamamlanmış işletme kabulü anlamına gelmez.

[Makine tarafından okunabilir anonim özet](scope-summary.json) yalnız adet, işlem sınırı ve durum içerir. Ticari isim, telefon, gerçek fiyat/bakiye, özel kişi verisinin hash’i, erişim ayarı ve ayrıntılı cari dışlama listesi GitHub’a eklenmedi. Bütün ayrıntılı istisnalar yerel tek yönetici raporunda tutulur.

## Doğrulanmış kaynak kapsamı

| İşlem veya kaynak | Kapsam | Anlamı |
| --- | ---: | --- |
| Kaynak ürün envanteri | 16.743 | Kaynak kimliği ve sürüm tanıkları |
| Aktif ve kimliği doğrulanmış ürün | 11.847 | ADET / faktör 1 bağı |
| CRM sipariş taslağı ürünü | 11.843 | Pozitif, tekil ve ana birime bağlı doğrulanmış satış fiyatı |
| Mühürlü mal kabulü profili | 1.158 | Kesin kaynak tedarikçi bağı ve bilinen TRY stok maliyeti; 53 kaynak tedarikçi |
| Alış faturası ürünü | 636 | Aynı tedarikçinin kaynak alış dövizindeki doğrulanmış hesabı; 31 tedarikçi, 4 TRY ve 632 USD ürün |
| Müşteri döviz hesabı | 375 | 43 TRY / 294 USD / 38 EUR |
| Tedarikçi döviz hesabı | 406 | 311 TRY / 95 USD |

Bu kümeler farklı işlemleri anlatır ve örtüşür; adetleri toplanmaz. 11.843 ürünlük CRM kataloğu, 1.158 ürünlük mal kabulü profiline indirgenmez. Kaynakta uygun görünen diğer adaylar mühürlü işlem profiline otomatik eklenmedi.

Aktif ürünlerden dört ürün fiyatlı CRM taslağı dışında tutulur: **36961, 39169, 40331** için pozitif doğrulanmış satış fiyatı yoktur; **301991 / fiyat kaydı 278235** için aynı yerel fiyat tuple’ı iki kez bulunmaktadır. Son kaydın kaynak satır hash’i ve binding tanığı eşleşmektedir; sorun tekilliktir. Satır silme, tahminî fiyat veya kaynak yeniden aktarımı uygulanmadı.

Mal kabulü profilinde 521 ürünün kaynak net alış fiyatı bulunmadığı için fatura uygunluğu yoktur. Bir diğer ürünün kaynak alış dövizi ile hesabı uyuşmaz: **ürün 36010 / tedarikçi 10183**, kaynak alış dövizi TRY, doğrulanmış tedarikçi hesabı USD. Döviz dönüşümü varsayılmadı. Pozitif kaynak alış fiyatı bulunan 637 üründen 636’sı aynı dövizde fatura uygundur.

Genel ürün dışlaması 4.896; işleme göre istisna 11.263; cari döviz hesabı dışlaması 268’dir (106 müşteri / 162 tedarikçi hesabı). Her kayıtta birden fazla neden bulunabilir. **Neden bazındaki adetler örtüşür; toplamları tekil kayıt adedine eşit olmayabilir.** İşleme göre istisna, ürünün bütün işlemlerde kullanılamaz olduğu anlamına gelmez.

## Gerçek kopya, TEST etkisi ve insan kabulü

TEST125’in kabul edilmiş kaynak verisi ve geçmiş tanıkları yeni, ayrı DB02 ortamında korunur. Yeni otomatik veya ekran testlerinin oluşturacağı sayım, kabul, stok, fatura, cari hareket ve CRM taslakları **TEST etkisi** olarak ayrı işlem kökeni ve tekrar deneme günlüğü taşır; gerçek işletme işlemi diye sunulmaz. Önceki sentetik TEST kayıtları da kabul edilmiş kaynak aktarımı olarak yeniden sınıflandırılmaz.

Altı gerçek personel kimliği aktif çalışan/kullanıcı bağıyla doğrulanmıştır. İşlemleri yürüten **15 ve 16** numaralı teknik TEST aktörleri gerçek personelin insan kabulü değildir. Sekiz alternatif ad eşlemesi inceleme bekler. Yerel binding için sonlu izin listesi işlem yetkisini sınırlar; gerçek personel kimliği bağı veya insan kabulü oluşturmaz. Mevcut yetkiler genişletilmedi.

Cari hesapların makine kaynak tanığı vardır; açılış bakiyeleri bağımsız insan kabulü olmadan kabul edilmiş bakiye diye sunulmaz. Bilinmeyen eşlemeler, karantina ve dört kaynak belge mutabakatı bekleyen hesap ayrı tutulur. **İki LL müşteri hesabı dışlanır.** TRY görünümü, kaynak LL hesabını uygulanabilir kılmaz.

USD/EUR işlem kur tanıkları **12 Eylül 2026** tarihli kaynak anlık görüntüsüdür; güncel piyasa kuru diye sunulmaz. Bu anonim kayıtta kaynak kur veya ticari tutar değerleri yayımlanmaz. TRY kimlik kuru ayrı tanımlıdır. Fiyat ve bakiye ekranlarında en fazla iki ondalık gösterilir; işlem doğrulaması kesin ondalık değerlerle yapılır.

Belge başına en fazla iki farklı ürün satırı, satır başına 1–5 fiziksel ADET ve belge dövizinde 20.000 tutar TEST sınırı geçerlidir. TRY stok maliyeti ile belge alış dövizi/fiyatı ayrı tutulur.

## Korunan kabul geçmişi ve izolasyon provası

| Korunan kanıt | Adet |
| --- | ---: |
| Kabul edilmiş ürün / fiyat | 16.622 / 63.774 |
| Cari aktarım etkisi / tedarikçi döviz etkisi | 283 / 16 |
| Karantina bekletme kaydı / FIRST kontrolü | 176 / 37 |
| DB02 ilk kopya ve çekirdek kurulumunda karşılaştırılan ticari tablo | 51 |
| Değişmeden tutulan temel modül manifesti | 185 |
| Kaynak SQL tanımı / kaynak CHECK pini | 337 / 227 |

Kabul edilmiş aktarımlar yeniden uygulanmadı. İlk DB02 kurulumunda 51 ticari tablonun önce/sonra özeti eşleşti; ticari yazı sıfırdı. Eski ortak TEST, TEST125, LIVE/Vega ve kaynak tarihçesi korunur.

Geniş profilin tekrarlı JSON ayrıştırması için yalnız DB02 `ready` doğrulamasına ayrı, eklemeli bir revizyon hazırlanmıştır. Profil mührü, kopya kimliği, temel 185 manifest kaydı, diğer üç işlem prosedürü, karantina ve kaynak koşulları değiştirilmez. Yerel tablo değişkenleri JSON ve tam UTF8 kaynak hash’lerini bir kez hazırlar; mevcut NULL, kaynak, döviz, tekillik ve hesap koşulları korunur.

**Revizyon provası PASS ve rollback tamamlandı:** aynı 51 ticari tablo, 389 korunan SQL tanımı ve 312 mevcut CHECK önce/sonra eşleşti; kapatılan guard ve değiştirilmiş mevcut rol sıfırdır. Ayrı kayıt yalnız bir `ready` revizyonunu yetkilendirir. Gerçek kaynak tanıklarıyla sekiz koşul temizdir. Altı yalnız yerel sahte profil denemesi (NULL maliyet, yanlış tedarikçi, yanlış ürün tanığı, yanlış satış fiyatı, yanlış hesap tanığı, LL dövizi) reddedilmiştir. Bu sonuçlar uçtan uca uygulama veya insan kabulü değildir.

## Pending proof — son çalışma kanıtları

Root, aşağıdaki alanları son kanıtları aldıktan sonra doldurur. Bu taslak testlerin çalışmış veya geçmiş olduğunu ileri sürmez.

- Ready revizyonu actual Apply ve iki en az yetkili bağlantının metadata / aktif guard kanıtı: **bekliyor**.
- Çalışan ERP, native ve CRM paket kimlikleri; yeni TEST adreslerinin API erişimi: **bekliyor**.
- Geniş katalog, müşteri/tedarikçi döviz hesabı, mal kabulü ve alış faturası için toplu API/SQL kontrolleri: **bekliyor**.
- Tek stok, tek cari borç, seçili hesap bağı ve aynı/farklı gövdeli replay sonucu: **bekliyor**.
- GUI, fiyat/bakiye iki ondalık gösterimi, yetki ve bilinmeyen eşleme ekranları: **bekliyor**.
- Fiziksel Zebra okutması, İlker ve personel ortak insan kabulü: **bekliyor; başlatılmadı**.
- ERP PR #23 / CRM PR #3 için ayrı son commit, push ve tam head CI sonucu: **bekliyor**.

Ücretli AI, gerçek WhatsApp gönderimi, gerçek T1, LIVE değişikliği ve main merge yapılmaz. Eğitim Modu PR #27 beklemede kalır. Yerel teknik başarı, CI veya insan kabulü yerine yazılmaz.
