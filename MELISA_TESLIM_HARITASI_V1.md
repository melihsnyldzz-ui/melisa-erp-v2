# Melisa Teslim Haritası v1

**Amaç:** Yeni fikir ve yeni altyapı üretmek yerine eldeki CRM/ERP çalışmalarını işyerine teslim edilebilir sürümlere dönüştürmek. Öncelikli yön: **önce CRM, sonra Vega'dan Melisa ERP'ye geçiş**.

**Belge tarihi ve veri kesimi:** 5 Ekim 2026. Durum tabanı, SEMIH bilgisayarında yaklaşık 02:16–02:30 arasında hazırlanıp kullanıcı tarafından paylaşılan iki mevcut durum raporudur. Bu belge yeni SQL, tarayıcı, telefon veya LIVE denetimi değildir.

**Çalışma durumu: GELİŞTİRME DURAKLATILDI.** Bu haritanın GitHub'a kaydedilmesi geliştirmeyi yeniden başlatmaz; servis durdurma/başlatma, mesaj gönderme, migration, main merge, sürüm etiketi veya LIVE yayın yetkisi vermez. Uygulamaya devam edilmesi ayrı kullanıcı talimatına bağlıdır.

**Tek ortak harita:** Bu ERP reposundaki dosya ana kopyadır. CRM reposundaki aynı adlı dosya buraya yönlendirir; ikinci ve çelişen bir teslim planı oluşturulmaz. Ayrıntılı özellik ölçütleri mevcut `CRM_FINISH_PLAN.md`, `ERP_FINISH_PLAN.md`, `ERP_MIGRATION_PLAN.md` ve ilgili STATUS kayıtlarında kalır. Aşağıdaki ilk-sürüm kapsamı bir planlama önerisidir; kullanıcı kapsamı kabul etmeden mevcut gereksinimler silinmez veya tamamlandı sayılmaz.

## 1. Tek sayfalık durum

| Proje | Raporda ölçülen durum | Gerçekte ne anlama geliyor? | Teslim açısından ana açık |
| --- | --- | --- | --- |
| CRM | 25 iş: 12 tamam, 12 kısmi, 1 açık | Masaüstünde gerçek WhatsApp/medya ve katalog/fiyat kabulü var. Genel günlük kullanım henüz kabul edilmedi. | 7733 dışı mesaj alımı, personel/roller, erişim ve Windows açılışı; ERP yeni adayında sürücü hatası |
| ERP | 49 iş: 5 tamam, 20 kısmi, 24 açık | Gerçek veri okuma ve ayrılmış TEST kayıtlarında ticari işlem var. Bütün işletme kartlarıyla günlük çalışma hazır değil. | Genel stok/satış/alış/finans kapsamı, güncel açılış verisi, terminal, geri dönüş ve personel kabulü |

**12/25 ve 5/49, canlıya hazırlık yüzdesi değildir.** Bir satır belge, bir satır bütün terminal veya veri geçişi olabilir; eşit ağırlıklı sayım süreyi ve işletme riskini ölçmez. Kısmi işlerin hepsi bozuk da değildir.

Kaynak: CRM raporu bölümler 1–2, 6 ve 8; ERP raporu bölümler 1–2, 6 ve 8. Ayrıntılı kaynak konumları bölüm 8'dedir.

## 2. Başlangıçtan rapor anına kazanılanlar

Başlangıç, sıfırdan bir yazılım değildir: kullanıcı CRM ile zaten mesaj gönderebiliyordu; ERP'de satış, tahsilat, mal kabul ve diğer akışlar için önceki sınırlı kabuller vardı. Bunları yeni geliştirme diye tekrar sayma. Bu karşılaştırma son toparlama dönemini kapsar; altı aylık bütün emeğin bağımsız denetimi değildir.

| Alan | Korunan başlangıç | Rapor anındaki ek kazanım | Kalan sınır |
| --- | --- | --- | --- |
| CRM mesaj/medya | Mevcut çalışan mesaj gönderimi | 7733 ile iki yönlü fotoğraf, PDF/TXT, MP3/MP4 ve kayıtlı çeviri/ürün-fiyat kabulü | Genel müşteri mesaj alımı ve personel rolleri |
| CRM kullanım | Mevcut konuşma ekranı | Gönderilmemiş metnin aynı sekmede yenilemede korunması; katalogda gerçek ERP ürün/fiyatı | Fiziksel mobil ve tüm ekranların kullanıcı kabulü |
| CRM ERP/AI | Ayrı entegrasyon çalışmaları | 392 TRY TEST sipariş taslağının geri okunması; insanın düzenlediği AI önerisi ve gerçek ürün/fiyat kartı | Genel müşteri/ürün eşlemesi, AI işletme ve dil kabulü |
| ERP görünürlük | Örnek/dar işlem ekranları ve mevcut kaynaklar | 441 native müşteri, 530 native tedarikçi; fiyat/maliyet ve karantina okuma ekranları | Bu listelerin tamamı migration kabulü değildir; genel kart düzenleme açık |
| ERP işlemler | Önceki dar satış/tahsilat/mal kabul kabulleri | Çok satırlı mal kabul/alış taslağı, faturaya bağlı iade ve dar USD/EUR alış provası | Genel ürün/müşteri seçimi, miktar, KDV/iskonto ve günlük personel zinciri |
| Veri geçişi | Vega kaynak, Melisa hedef; açık eşleme ve mutabakat işleri | Donmuş kapsamda 16.622 ürün, 772 cari, 785 döviz hesabı ve 63.774 fiyat için kayıt bazlı fark 0 | Güncel Vega deltasının uygulanması ve gerçek cutover açık |
| Kaynak/teslim | Birden çok klasör, dal ve runtime | Kanonik kökler, kaynak kayıtları, PR/CI ve kesin TEST paketleri | Kodun GitHub'da bulunması çalışan LIVE sürümü olduğu anlamına gelmez |

Kaynak: CRM raporu bölümler 3, 7 ve 9; ERP raporu bölümler 2–4, 7 ve 9.

## 3. Teslim ağacı — kod sayısı değil işletme sonucu

Aşağıdaki satırlar yeni bir 74 maddelik iş listesi değildir; mevcut finish-tree işlerini teslim sonuçları altında gruplar. Bir iş iki yerde anılıyorsa iki kez sayılmaz.

```text
MELISA — İŞYERİNE TESLİM
│
├── 0. DURUMU SABİTLE / KAPSAMI SEÇ
│   ├── [Kayıt var] 5 Ekim CRM ve ERP yerel raporları
│   ├── [Kayıt var] Kaynak ile çalışan paket ayrımı
│   ├── [Öneri] İlk CRM sürümü: günlük iletişim ve katalog
│   └── [Açık] Disk kapasitesi ve kabul için personel/cihaz zamanı
│
├── 1. CRM İLK CANLI TESLİM
│   ├── [Açık] Normal müşterilerden gelen mesajları kaçırmama
│   ├── [Kısmi] Atanan personel ve üç rolün günlük kullanımı
│   ├── [Kısmi] Kabul edilmiş medya/çeviri/katalog akışını koruma
│   ├── [Açık] Hedef cihazdan erişim + Windows açılışı
│   ├── [Karar] İlk sürümde ERP taslağı / AI / mobil kapsamı
│   └── [Açık] Kabul edilen sürüm, geri dönüş ve onaylı yayın
│
├── 2. ERP GÜNLÜK İŞLETME TESLİMİ
│   ├── [Kısmi] Gerçek stok, ürün, müşteri ve tedarikçi ekranları
│   ├── [Kısmi] Mal kabul → alış → satış → tahsilat/ödeme
│   ├── [Kısmi] İade, iptal, sayım, döviz, fiyat ve gerekli raporlar
│   ├── [Açık] Genel ticari kartlar ve gerçek rol/terminal kullanımı
│   ├── [Açık] Kasa/banka açılışı ve gün sonu kontrolü
│   └── [Açık] Çalışan paket, açılış ve gerçek geri dönüş kabulü
│
├── 3. VEGA → MELISA KESİN GEÇİŞ
│   ├── [Kayıtlı TEST] Donmuş 30 Eylül açılışı ve tekrar etkisizliği
│   ├── [Kısmi] Belirsiz kartlarda işlem engeli; iş kararları açık
│   ├── [Açık] Güncel ve tutarlı veri kesimi / yeni kartları kapsayan delta
│   ├── [Açık] Son stok/cari/döviz/fiyat mutabakatı
│   ├── [Açık] Eski veriyi ve yeni işlemleri kaybetmeyen geri dönüş
│   └── [Açık] Tek yazıcı Melisa; Vega salt okunur arşiv
│
└── 4. CANLIDAN SONRA — İLK TESLİMİ BEKLETMEYENLER
    ├── [Kapsam kararıyla] Geniş AI satış otomasyonu
    ├── [Kapsam kararıyla] Geniş CRM → ERP sipariş eşlemesi
    └── Ek rapor/filtre, animasyon ve günlük işi engellemeyen görsel incelikler
```

## 4. CRM — en kısa canlı teslim yolu

**Önerilen ilk sürüm:** personelin müşteriyi görmesi, mesaj/medya alışverişi, atama, çeviri ve doğrulanmış katalog/fiyat paylaşımı. ERP'nin bütün migration işlerini CRM'in otomatik önkoşulu yapma.

| Sıra / sorumlu | Çıkacak işletme sonucu | Mevcut kanıt ve eksik | Bitiş ölçütü |
| --- | --- | --- | --- |
| CRM-1 · Backend + reviewer | Normal müşteri mesajları doğru konuşmaya gelir | 7733 kabulü var; başka müşteriden gelen mesajın görünmemesi ve eski LIVE filtre sınırı raporlu | Yetkili, birden fazla kontrollü test kimliğinde gelen/giden eşleme; kaçan veya çift görünen mesaj yok; başka gerçek müşteriye izinsiz mesaj yok |
| CRM-2 · Frontend + personel | Atanan çalışan kendi konuşmasını görür; yetkisi dışına çıkamaz | Yönetici tarafı atama var; personel ve üç rol kabulü yok | Patron, müdür ve satış personeliyle atama/görünürlük/gönderim akışı gözle kabul edilir |
| CRM-3 · Release + kullanıcı | Hedef işyeri cihazından erişilir; Windows açılınca doğru sürüm başlar | Loopback TEST URL'si var; görev Running ama gerçek reboot/logon kabulü yok | İlk sürüme dahil cihazlarda erişim ve planlı Windows başlangıcı; bağımlılıklar çalışır, geçmiş/ayarlar korunur |
| CRM-4 · Ürün sahibi + lead | Kısmi entegrasyonlar müşteriye bitmiş gibi görünmez | Yeni ERP adayında sqlserver.node eksik; eski paket çalışır. AI öneri var, işletme/dil kabulü açık | İlk sürüme alınan entegrasyonun ilgili hatası/kabulü kapatılır; ertelenen iş kullanıcı onayıyla görünür şekilde kapalı olur |
| CRM-5 · Release + kullanıcı | Günlük kullanılabilir sürüm teslim edilir | TEST A→B→A→B dönüş kanıtı var; main/tag/LIVE henüz yok | Değişen kritik akışlar ve roller kabul; tam commit/paket kaydı; mesaj ve ayar kaybı yaratmayan geri dönüş; ayrı yayın onayı ve yayın sonrası kontrol |

**Önemli kapsam koşulları:**
- Genel müşteri mesaj alımı kapanmadan günlük CRM canlı kabulü verilmez; sağlık yanıtı veya 7733 testi tek başına yetmez.
- ERP taslağı ilk sürümden ertelenebilir, fakat bu kullanıcı kapsam kararıdır. Açık bırakılacaksa yeni native sürücü hatası, müşteri/ürün eşleme ve çok satırlı geri okuma tamamlanmalıdır. Eski paketin health yanıtı yeni SQL/uygulama birleşiminin kabulü değildir.
- AI'nin otomatik gönderimi/sipariş yazımı ilk sürüm şartı yapılmaz. Öneri modu da işletme kuralları ve kullanıcı kabulü tamamlanmadan herkes için hazır diye gösterilmez.
- Telefon/el terminali ilk gün personelin çalışma aracıysa fiziksel mobil kabulü ertelenemez. Yalnız kullanıcı masaüstüyle sınırlı ilk sürümü kabul ederse geniş mobil kapsam sonraya kalabilir.

Kaynak: CRM raporu satırlar 34–36, 42–60, 125–143 ve 164–175. Sıra ve ilk-sürüm önerisi bu haritanın planlama yorumudur; raporun verdiği LIVE onayı değildir.

## 5. ERP — çekirdek işletme ve Vega geçiş yolu

| Sıra / sorumlu | Çıkacak işletme sonucu | Bitiş ölçütü |
| --- | --- | --- |
| ERP-1 · Frontend + backend | Ekranı açınca kendi ürünlerini ve hesaplarını görme | Normal stok/ürün listesi, barkod arama ve detay; müşteri/tedarikçi hesapları. Gerçek, sentetik ve tarihli kaynak açıkça ayrılır; bilinmeyen tutar sıfır yapılmaz |
| ERP-2 · Backend + İlker/satış personeli | Günlük işlem zinciri, tek test kartına bağlı olmadan çalışır | Onaylanmış genel kart kapsamıyla mal kabul→alış→satış→tahsilat/ödeme→gün sonu; stok ikinci kez artmaz, mükerrer istek çift kayıt üretmez, iptal/iade geçmişi korur |
| ERP-3 · Backend + kullanıcı | Fiyat, döviz, kasa ve temel raporlarla iş yürütülebilir | Günlük iş için gerekli fiyat/kart düzenleme, KDV/iskonto, gerçek kur yöntemi, ayrı dövizli kasa/banka ve temel günlük kontrol raporları. Genel fiyat yazımını iş ihtiyacı değerlendirilmeden sonraya atma |
| ERP-4 · SQL-Vega + İlker/kullanıcı | Açılış verisi açıklanabilir ve günceldir | 54 ürün/122 cari, bilinmeyen miktar/maliyet ve negatif stok için belgeli çözüm ya da açıkça kabul edilmiş kapsam dışı tutma; güncel yeni kart/delta provası, tek etkili uygulama ve kayıt bazlı mutabakat |
| ERP-5 · Release + cihaz/personel | Personel gerçek cihazıyla çalışır, sistem açılır ve geri dönebilir | Terminal barkod/offline/senkron, roller, Windows başlangıcı, yeterli disk alanı; ayrı hedefte yedek geri yükleme ve yeni işlemleri kaybetmeyen geri dönüş provası |
| ERP-6 · Kullanıcı + İlker + release | İşletmenin operasyonu Vega'dan Melisa'ya devredilir | Kesim saati/sorumlu; tüm yazıcı ve gecikmiş terminal işlemleri kontrol altında; son tutarlı veri/delta, stok/cari/finans mutabakatı, fiziksel kasa/banka açılışı; onaylı tek yazıcı geçişi ve son kullanım kontrolü |

### Veri geçişinde korunacak sınırlar

Rapor anındaki 16.622 ürün/772 cari/785 hesap/63.774 fiyat kabulü **donmuş 30 Eylül** kapsamıdır. 441 müşteri ve 530 tedarikçi liste sayısı, bu kartların tamamının migration kabulü olduğu anlamına gelmez. Son kayıtlı 71 yeni ürün/341 değişmiş ürün/74 cari farkı 4 Ekim 00:58:47 okumasındandır; bugünkü sayım değildir ve uygulanmamıştır.

RUN06 writer güncel delta veya LIVE aktarım aracı olarak kullanılamaz. Karantina, kayıtları çözmez; yanlış işlemi önler. 10.552 bilinmeyen maliyeti sıfır veya uydurma kurla doldurma. Liste alış fiyatı, kanıtlı maliyet değildir. Bilinmeyen maliyetlerin satış/maliyet/kâr raporuna etkisi işletmeyle karara bağlanır; bütün belirsizlikler otomatik olarak kabul edilmiş sayılmaz.

Yedek için VERIFYONLY ve transaction rollback kaydı, gerçek restore veya uygulanmış batch'i geri alma kabulü değildir. Yeni Melisa işlemleri başladıysa eski DB'yi geri yükleyip bu işlemleri kaybetmek geri dönüş planı olamaz.

Kaynak: ERP raporu satırlar 62–101, 103–141, 173–184 ve 206–221.

## 6. Canlı öncesi / sonrası ayrımı

| Sınıf | İşler | Koşul |
| --- | --- | --- |
| A — Canlı öncesi şart | CRM genel mesaj alımı ve personel yetkileri; ilk gün kullanılacak cihaz/ekranlar; ERP genel günlük zinciri, doğru açılış, temel finans/raporlar, terminal ve geri dönüş | İş kaybı, yanlış stok/bakiye/fiyat, yetkisiz görünürlük ve veri kaybı ilk teslim için açık bırakılamaz |
| B — Kapsam onayıyla sonra | Geniş CRM ERP taslağı, AI satış yardımının ileri kapsamı, ilk gün kullanılmayacak ek mobil özellikler, ilave raporlar | Mevcut akış çalışır kalır; eksik özellik gizlice açık bırakılmaz; ürün sahibi ertelemeyi açıkça kabul eder |
| C — Teslimi bekletmeyen iyileştirme | Animasyon, ek dashboard, ikincil filtreler ve günlük işi engellemeyen görsel incelikler | Stok kartını bulabilme, fiyatı anlayabilme veya dokunmatik kullanım gibi temel kullanılabilirlik bu sınıfa atılmaz |

## 7. Süre, kapasite ve ölçüm

**Bu raporlar güvenilir bir teslim tarihi veya canlı hazırlık yüzdesi hesaplamak için tek başına yeterli değildir.** Aktif Codex süresi, bekleme süresi, kalan işlerin boyutu ve kabul takvimi ölçülmemiştir. Önceki sohbetin CRM %80–85 / ERP %50–60 canlı hazırlık değerlendirmeleri ölçülmüş oran değildir; bu v1'in durum göstergesi veya geçiş onayı olarak kullanılmaz.

Önceki görüşmede CRM için 25–40 aktif saat / 3–6 gün, ERP için 70–120 aktif saat / 10–20 gün ve tam kapsam için 3–6 hafta söylenmişti. Bunlar **kalibre edilmemiş ön tahminlerdir; taahhüt ya da iş emri değildir**. Burada sayısal kesinlik kazandırılmıyor. CRM ve ERP'ye yeni teslim tarihi yazılmadı.

Devam izninden sonra birkaç temsilî iş için ana oturumun gerçek aktif süresi, alt ajan emek toplamı, entegrasyon süresi, insan beklemesi ve tamamlanan sonuç ayrı kaydedilir. Paralel üç ajanın üç saat çalışması dokuz saat emek olabilir; takvimden otomatik dokuz saat düşmez. Tahmin, bağımlılıklı en uzun iş zinciri + kabul/cihaz/geçiş pencereleri + açık belirsizlik payına dayanır. Yeni bulguda aralık güncellenir, eski tahmin sessizce kesin tarih yapılmaz.

Rapor anında C: yaklaşık **4,83 GiB boş**. Önceki disk doluluğu giderilmiş olsa da yeni paket/backup/restore kapasitesi dardır. Çözüm, onaylı kapasite ve paket saklama düzenidir; eski kaynakları veya geri dönüş paketlerini körlemesine silmek değildir.

## 8. Sabit kaynaklar ve izlenebilirlik

Birincil kaynaklar kullanıcının bu görüşmede paylaştığı iki raporun tam metnidir. Yerel dosyalar bu GitHub belge teslimi sırasında şirket bilgisayarından yeniden okunmadı; özel kayıtlar veya raporların tamamı GitHub'a kopyalanmadı.

| Kaynak | Rapor konumu / kanıt tabanı |
| --- | --- |
| ERP mevcut durum | `C:\Sirket\ERP\reports\ERP_CURRENT_STATE_20261005.md`; kaynak kök `C:\Sirket\ERP\melisa-erp-v2`; rapor anı HEAD `a4ffbaa355b643799a96c26bf1bc2b7f4540d0cc`; çalışan paket24/source `0907cddf9bd7db32da79c42dae22b33ffaa0e640`; son uygulama değişikliği `95bef876362374c00e8f3cbd0522efe1b791533f` |
| CRM mevcut durum | `C:\Sirket\CRM\reports\CRM_CURRENT_STATE_20261005.md`; kaynak kök `C:\Sirket\CRM\melisa-crm`; rapor anı HEAD `f81f8012948aa1eb6c1b8a5cadabf39cfa8ca566`; çalışan CRM C/source `aa85448e6959441d19af3adc1ba71759a35064f2` |
| CRM ERP bağımlılığı | ERP PR24/HEAD `ed10c71a7e3f016eef4edb48fb27e53e41e40517`; yeni native aday `c563c485d10581687c2f962ad1a6b12cb21efd34` açılmadı, önceki native `4fb9eab26cb770a46a9e985ddd64e02b996f2d6f` çalışıyor |

[ERP rapor tabanındaki STATUS](https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/a4ffbaa355b643799a96c26bf1bc2b7f4540d0cc/STATUS.md) · [CRM rapor tabanındaki STATUS](https://github.com/melihsnyldzz-ui/melisa-crm/blob/f81f8012948aa1eb6c1b8a5cadabf39cfa8ca566/CRM_STATUS.md) · [ERP PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23) · [CRM PR3](https://github.com/melihsnyldzz-ui/melisa-crm/pull/3) · [ERP taslak bağımlılığı PR24](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/24).

Raporlar kaynakların remote ile eşleştiğini ve kendi HEAD kontrollerinin başarılı olduğunu bildirir. Bu bilgiler o anın kayıtlarıdır; bu haritanın CI sonucu, yeni runtime doğrulaması veya bugünkü LIVE kabulü değildir. Ham ticari kayıt, müşteri mesajı, credential, DB yedeği ve özel runtime ayarları GitHub'a taşınmaz.

## 9. Devam izni verildiğinde uygulanacak teslim disiplini

Bu harita mevcut güvenlik/izin sınırlarını kaldırmaz. Kullanıcının yeniden başlatma talimatından sonra ana ajan, ilk canlı kapsamıyla uyumlu tek somut sonucu seçer. Bağımsız frontend/backend/veri incelemeleri uygun mevcut alt ajanlara ayrılabilir; paylaşılan dosya, paket ve SQL yazımı tek sorumluda kalır. Mevcut salt okunur rol, görev devriyle kendiliğinden yazıcı yapılmaz.

Çalışan özellikler yeni geliştirme gibi sayılmaz. Yalnız değişiklikten etkilenen, kaynağı farklılaşan veya somut hatası bulunan akışın kabulü yenilenir. Kullanıcıdan rutin Git komutu, prompt taşıma veya yeni onay paneli istenmez.

Her teslimde kod/test ve izinli belge değişiklikleri commit edilir, GitHub'a gönderilir, remote SHA doğrulanır; uygun PR açılır/güncellenir ve son HEAD'in gerçek CI sonucu kaydedilir. Kullanıcı kabulü bekleyen kod da geliştirme dalında saklanır. Push başarısızsa 'yerelde hazır, GitHub teslimi eksik' denir; 'tamamlandı' denmez. Main'e birleştirme ve LIVE yayın ayrı onaylı aşamalardır.

Kısa kullanıcı raporu: **Ne değişti? / Nereden görebilirim? / Gerçek veri mi, TEST mi? / GitHub branch–commit–PR / Kalan gerçek engel / Sıradaki iş.** Uygulanmamış öneri, yazılmış ama kurulmamış kod ve insan kabulü bekleyen özellik birbirinden ayrılır.

**v1 son kararı:** Ortada korunacak ciddi çalışma var; iki sistem de rapor anında genel LIVE kabulü almış değil. Yeni kapsam üretmeden, CRM'in günlük iletişim çekirdeğini önce teslim etmeyi; ERP'yi gerçek günlük iş zinciri ve tutarlı Vega geçişi üzerinden tamamlamayı öneriyoruz. Bu belge öneriyi ve kanıt sınırlarını kayda alır; geliştirme halen duraklatılmıştır.
