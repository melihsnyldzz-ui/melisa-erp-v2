# Günlük Sabit Fiyat ve Güvenli Teklif — İlk Güvenlik Katmanı

## Amaç

Bu ilk paket, şirket sahibinin **günlük sabit merkezî fiyat** ve **peşin ödeme** kararları için gerçek teklif, sipariş veya müşteri iletişimi oluşturmayan test edilebilir bir güvenlik çekirdeği kurar. Bu paket fiyat formülünü veya günlük fiyatları onaylamaz.

Paket yalnızca onaylı 30 ürünlük iç ana seçim dosyasını okur. Kaynak dosya SHA256 değeri, İstanbul iş günü, ürün kimliği, fiyat, stok ve para birimi geçerli değilse işlem fail-closed durur.

## İlk sürümün yaptığı

- 31 Ağustos kaynak katalog snapshotındaki satış fiyatlarını aynı İstanbul günü için değişmez teknik test kitaplarına ayırır.
- TRY, USD ve EUR değerlerini teknik başlangıç allowlist'i olarak ayrı tutar; bunu sahip tarafından seçilmiş Avrupa teklif para birimi politikası saymaz ve doğrulanmış kur politikası olmadan dönüşüm yapmaz.
- Birim fiyatı yalnız kilitli kaynaktan alır; kullanıcıdan fiyat, kur, iskonto veya vade kabul etmez.
- Tek para birimli, peşin ödemeli ve **onaysız otomatik iskonto uygulamayan** bir iç inceleme taslağı hesaplar. Bu, şirketin hiç iskonto yapmayacağı anlamına gelmez.
- Navlun alınmadığında kapıya teslim toplam üretmez.
- Paket içeriği doğrulanmamış ürünleri uyarıyla taşır.
- Fiyat, kesin stok, müşteri veya barkod içermeyen bir doğrulama özeti üretir.

## İlk sürümün yapmadığı

- ERP veya Vega veritabanına yazmaz.
- Mevcut `sales_offers` tablolarına teklif kaydetmez.
- Teklifi siparişe veya satış fişine dönüştürmez.
- Stok ayırmaz.
- Ödeme almaz veya ödeme linki üretmez.
- PDF/site yayımlamaz.
- WhatsApp, e-posta veya başka bir kanaldan mesaj göndermez.
- Taşıyıcı fiyatı, teslim tarihi, vergi, Incoterm, iade veya ülke mevzuatı uydurmaz.
- Vega'dan yeni günün fiyatını veya stok durumunu kendiliğinden yenilemez.
- Maliyet, hedef marj veya kârlılık hesabını doğrulamaz.

## İş kuralları

- Çalışma modu: `LOCAL_SYNTHETIC_REVIEW_ONLY`
- Taslak durumu: `DRAFT_ONLY`
- Günlük fiyat onayı: `NOT_APPROVED`
- Fiyat davranışı: `SOURCE_SALE_PRICE_IDENTITY_TEST`; gerçek fiyat formülü henüz yapılandırılmadı.
- Ödeme: `PREPAID`
- Otomatik iskonto: `0`; yalnızca Melisa'nın onaysız iskonto uygulamasını engeller.
- Navlun: `NOT_QUOTED`
- Bölge hedefi: Avrupa; ülke kapsam politikası henüz yapılandırılmadığı için ilk paket hiçbir ülkeyi müşteri-hazır kabul etmez.
- İade yaklaşımı: önce çözüm, iade son seçenek; gerçek telafi veya iade insan onayı gerektirir.
- Geçerlilik: kesin bitiş saati ve iş günü takvimi henüz kararlaştırılmadı. Güvenlik için teknik olarak yalnız kaynak fiyatın alındığı gerçek İstanbul tarihinde çalışır; ertesi gün durur.

## Mevcut veri durumu

31 Ağustos 2026 tarihli donmuş iç ana liste snapshotında 30 ürün vardır: 17 TRY ve 13 USD. O snapshotta sıfır fiyatlı veya stoksuz ürün yoktur; bu ifade güncel canlı stok veya fiyat kanıtı değildir. Paket içeriği fiziksel ya da tedarikçi doğrulaması bekleyen 10 ürün iç taslakta uyarıyla kalır ve müşteri-hazır sayılmaz.

## Çalıştırma

```powershell
node scripts/catalog/daily_price_quote.mjs
node --test scripts/catalog/daily_price_quote.test.mjs
```

CLI tarihi kullanıcıdan kabul etmez; gerçek İstanbul tarihini kullanır. Yalnız onaylı yerel katalog dosyasını okur ve ticari değerleri gizlenmiş sentetik doğrulama özetini terminale yazar. Özetteki `writePerformed: false` benzeri alanlar ayrı bir canlı sistem gözlemi değil, bu CLI'nin kaynak koduyla sınırlandırılmış davranış beyanıdır.

## Sonraki entegrasyon kapısı

Mevcut Teklif Kartı birim fiyatı, kuru ve iskontoyu kullanıcıdan kabul etmekte ve gerçek kayıt/dönüşüm yollarına bağlıdır. Bu güvenlik çekirdeği; sunucu tarafında fiyat kaynağı, güncellik, tek para birimi, sahip onayı ve dış işlem kapıları eklenmeden mevcut teklif yazma uçlarına bağlanmamalıdır.

Sürekli günlük düzen için onaylı ürün kimlik listesi ile her gün ayrı oluşturulacak salt-okunur fiyat/stok snapshotı birbirinden ayrılmalıdır. Günlük snapshot ayrı hash, kaynak zamanı ve şirket sahibi fiyat onayı taşımalıdır. Fiyat formülü, maliyet/marj kaynağı, kesin geçerlilik politikası ve Avrupa ülke kapsamı ayrıca kararlaştırılmadan müşteri-hazır teklif üretilemez.
