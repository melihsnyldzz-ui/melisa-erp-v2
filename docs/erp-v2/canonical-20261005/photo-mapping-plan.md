# ERP-D03 — Fotoğraf arşivi keşfi ve ürün eşleme planı

5 Ekim 2026. **Salt okunur plan; ERP-UA03 kullanıcı incelemesi bekliyor.** Normal katalog ve performans için ERP-UA02, bu sohbetin kullanıcısının açık kabulüyle PASS olarak kaydedildi. Bu rapor fotoğraf bağlama onayı veya uygulanmış medya import'u değildir. ERP-DEC-004/005, DELIVERY_BOARD ERP-D03 ve mevcut [katalog sözleşmesi](working-catalog-contract.md) esas alındı.

## Sonuç

| Ölçü | Sayı |
| --- | ---: |
| Toplam fotoğraf | 3.897 |
| Kesin eşleşen fotoğraf | 3.830 |
| Kesin eşleşen benzersiz ERP ürün | 3.830 |
| BELİRSİZ / AMBIGUOUS fotoğraf | 67 |
| Eşleşmeyen / UNMATCHED fotoğraf | 0 |
| Birden fazla kesin fotoğrafı olan ürün | 0 |
| Belirsiz adaylar dahil birden fazla fotoğraf adayı olan ürün | 0 |
| Bu arşivde hiçbir fotoğraf adayı bulunmayan ERP ürün | 12.779 |
| Kesin fotoğraf eşleşmesi bulunmayan ERP ürün | 12.846 |
| Kesin fotoğraf eşleşmesi bulunmayan kabul edilmiş açılış ürünü | 12.792 |

Kapsam 16.622 kabul edilmiş açılış ürünü +54 karantina kartı =16.676 karttır; sentetik üç kart kapsam dışında. 12.846 sayısı, 67 belirsiz adayın ürünlerini de **kesin fotoğrafı yok** olarak içerir. Bu yüzden fiziksel fotoğraf adayı bile bulunmayan12.779 ürün sayısıyla karıştırılmaz. **ERP'de bu tur bağlanan fotoğraf sayısı sıfırdır**; mevcut fotoğraf alanı hâlâ missing. Arşiv dışındaki başka fotoğraf kaynakları bu sayıma dahil değildir.

## Arşiv envanteri ve kaynak farkı

Gerçek fiziksel kök: `C:\Users\Xaser\Desktop\Melisa Temiz Stok Fotoğrafları`. 67 marka alt klasöründe3.897 fotoğraf; .jpg3.841 ve .jpeg56. Magic signature bakımından tamamıJPEG;3.897dosyanın boyutları okunabildi, decode hata0. Fotoğraflar toplam1.289.487.799bayt. Tam dosya adları, uzantılar, yollar, boyutlar, SHA256 ve değişiklik zamanı [makine manifestinin](photo-mapping-plan.json) records alanında bulunur.

Fotoğraf sayılmayan5dosya: Ayıklama Özeti.json, Beni Oku.txt, Eksik ve Kontrol Gereken Stoklar.csv, index.html, Stok Fotoğraf Listesi.csv. Toplam3.902dosya. Reparsepoint0; birebir SHA256 kopya grubu0; aynı tam dosya basenameli kayıt0. Byte olarak farklı ama görsel olarak benzer fotoğraflar için tüm arşivde perceptual/OCR benzerlik taraması yapılmadı; böyle bir duplicate yok diye hüküm verilmez. Tek katalog görselindeki renk/poz kolajları ayrı dosya veya ayrı medya adayı sayılmaz.

Arşiv CSV'si4Ekim tarihli11.550aktif kart ve3.897seçim kaydı bildiriyor; bu eski kapsam güncel16.676katalog ile eşdeğer değildir. Diğer eski durumlar7.284eşleşme yok,273temiz sürüm yok,96görsel kontrol. Bunlar bu turdaki67BELİRSİZ sayısı değildir; fotoğrafı olmayan CSV satırları fotoğraf envanterine katılmadı. Eski özetin D:\ hedefi güncel yerleşim kanıtı sayılmadı. CSV'deki3.897relativePath/tamstokcode/bayt, fiziksel arşivle birebir tutarlı; bu kayıtların eski seçim/yöntem açıklamaları bağımsız güncel ürün kabulü sayılmadı. Photo ID arşiv etiketi olup native ERP veya Vega ürün ID'si değildir.

## Eşleme yöntemi

1. Uzantısı çıkarılmış **tam dosya adı**, güncel ERP stockCode ile ordinal/birebir karşılaştırılır. Numara, marka, Türkçe karakter, apostrof ve bütün boşluklar korunur. 3.831dosyada exact kod adayı bulundu;3.830kabul edilmiş/karantinasız/tekil kimlik kesinleştirildi, bir karantinalı kart BELİRSİZ kaldı.
2. Exact barkod literal metin olarak değerlendirilir; baştaki sıfır atılmaz. Tüm17.773mevcut ERP barkodu kontrol edildi. Exact barkod basenameli dosya0; mevcut barkodu tam sayısal token olarak içeren dosya adı0. Fotoğraf piksellerindeki barkodlara toplu OCR yapılmadı; bu sıfır sayısı görüntü içindeki barkodları kapsamaz.
3. Güncel ERP/Vega sourceKey ve kabul edilmiş açılış bağı, seçilen ERP kimliği için korunur. Fotoğrafın eski CSV ID'sinden ürün ID'si uydurulmaz. Bilinen8023kaynak kanıtı ayrıca karşılaştırıldı.
4. Fuzzy ad/marka/sayı benzerliği kesin eşleme yapmaz. Boşluk/harf/Unicode farkı olan66dosya yalnız inceleme adayıdır; bunun yanında4620LEYLEK karantina nedeniyle BELİRSİZ. Her67kayıtta productId:null ve aday kimlikler candidateProducts içinde; tek aday bulunması kabul değildir. UNMATCHED0, her dosyanın en az bir kimlik adayı bulunduğu anlamına gelir;3897kesin eşleşme anlamına gelmez.

CONFIRMED, yalnız dosya→ürün kimlik eşlemesinin kanıtıdır; bütün fotoğrafların görsel kalitesi veya bütün piksellerinin ayrı ayrı insan kabulü anlamına gelmez. Bu tur10kesin örnek +2belirsiz örnek orijinal dosya açılarak gözle kontrol edildi. Diğer seçimlerin eski CSV görsel inceleme yöntemleri yalnız kaynak notu olarak korunur.

## 10 kesin eşleşme — gerçek dosyalar kontrol edildi

| Tam ürün kodu | Native ERP productId | Tekil ERP barkodu | Dosya | Kanıt |
| --- | --- | --- | --- | --- |
| 8023 CONCEPT | 36724 | 3617221176192 | Fotoğraflar/CONCEPT/8023 CONCEPT.jpg | Tam kod + CSV + doğrulanmış ERP kaynak bağı; görsel kod/marka kontrolü |
| 0161 MOLLY | 34765 | 8697130801618 | Fotoğraflar/MOLLY/0161 MOLLY.jpg | Tam kod + CSV + doğrulanmış ERP kaynak bağı; görsel kod/marka kontrolü |
| 0205 NAYİNOM | 38919 | 020534561235 | Fotoğraflar/NAYINOM/0205 NAYİNOM.jpg | Tam kod + CSV + doğrulanmış ERP kaynak bağı; görsel kod/marka kontrolü |
| 11025 ACABELLA | 37893 | 2241000110254 | Fotoğraflar/ACABELLA/11025 ACABELLA.jpg | Tam kod + CSV + doğrulanmış ERP kaynak bağı; görsel kod/marka kontrolü |
| 1071 ADN | 31099 | 8690159054805 | Fotoğraflar/ADN/1071 ADN.jpg | Tam kod + CSV + doğrulanmış ERP kaynak bağı; görsel kod/marka kontrolü |
| 10076 AGUCUK | 38764 | 8690001100766 | Fotoğraflar/AGUCUK/10076 AGUCUK.jpg | Tam kod + CSV + doğrulanmış ERP kaynak bağı; görsel kod/marka kontrolü |
| 2532 AMANTE | 34225 | — | Fotoğraflar/AMANTE/2532 AMANTE.jpg | Tam kod + CSV + doğrulanmış ERP kaynak bağı; görsel kod/marka kontrolü |
| 10012 BABUSH | 32775 | 86100120 | Fotoğraflar/BABUSH/10012 BABUSH.jpg | Tam kod + CSV + doğrulanmış ERP kaynak bağı; görsel kod/marka kontrolü |
| 2401 BABY AURA | 32811 | 2025240103517 | Fotoğraflar/BABY AURA/2401 BABY AURA.jpg | Tam kod + CSV + doğrulanmış ERP kaynak bağı; görsel kod/marka kontrolü |
| 4607 BABY ROSE | 40766 | 4983201146073 | Fotoğraflar/BABY ROSE/4607 BABY ROSE.jpg | Tam kod + CSV + doğrulanmış ERP kaynak bağı; görsel kod/marka kontrolü |

2532AMANTE için ERP barkodu bulunmadığından barcode:null ve barcodes:[]; barkod uydurulmadı. Ayrıca392kesin ürünün birden fazla literal ERP barkodu vardır; bunlarda tek barkod seçilmez, barcode:null ve tüm değerler barcodes dizisinde korunur. Diğer satırlardaki barkodlar görüntüden fiyat/OCR üretimi değildir, mevcut ERP katalog alanıdır. 0161/0205 kodları ve020534561235 barkodunun başındaki sıfırlar korunur.

## 10 BELİRSİZ örnek

ERP kodundaki her boşluk aşağıda **␠** ile görünür kılındı; gerçek JSON string değişmedi. AdayID'ler atanmış productId değildir.

| Fotoğrafın kodu | İnceleme adayı ID | Gerçek ERP kodu — boşluklar görünür | Neden |
| --- | --- | --- | --- |
| 11361 ACABELLA | 41111 | "11361␠ACABELLA␠" | Dosya kodu ile ERP kodu birebir aynı değil; boşluk/harf düzeltmesi onaylanmadı |
| 11381 ACABELLA | 41110 | "11381␠ACABELLA␠" | Dosya kodu ile ERP kodu birebir aynı değil; boşluk/harf düzeltmesi onaylanmadı |
| 4047 BABY MY | 31737 | "4047␠BABY␠MY␠" | Dosya kodu ile ERP kodu birebir aynı değil; boşluk/harf düzeltmesi onaylanmadı |
| 4095 BABY MY | 38268 | "4095␠BABY␠MY␠" | Dosya kodu ile ERP kodu birebir aynı değil; boşluk/harf düzeltmesi onaylanmadı |
| 4154 BABY MY | 41015 | "4154␠BABY␠MY␠" | Dosya kodu ile ERP kodu birebir aynı değil; boşluk/harf düzeltmesi onaylanmadı |
| 4903 BABY ROSE | 34685 | "4903␠BABY␠ROSE␠" | Dosya kodu ile ERP kodu birebir aynı değil; boşluk/harf düzeltmesi onaylanmadı |
| 7849 BABY ROSE | 33250 | "7849␠BABY␠ROSE␠" | Dosya kodu ile ERP kodu birebir aynı değil; boşluk/harf düzeltmesi onaylanmadı |
| 0213 BEBEDEX'S | 35112 | "0213␠BEBEDEX'S␠" | Dosya kodu ile ERP kodu birebir aynı değil; boşluk/harf düzeltmesi onaylanmadı |
| 3975 BEBESSİ | 31396 | "3975␠BEBESSİ␠" | Dosya kodu ile ERP kodu birebir aynı değil; boşluk/harf düzeltmesi onaylanmadı |
| 4620 LEYLEK | 40451 | "4620␠LEYLEK" | Karantina: EXACT_NATIVE_IDENTITY_NOT_PROVEN |

4620LEYLEK fotoğrafında4620/marka görülmesi karantinayı kaldırmaz. 11361ACABELLA görselindeki kod da ERP metnindeki sondaki boşluğu kendiliğinden düzeltme yetkisi değildir. Bu ürünlerin kaynak kartı, alias ve karantina kayıtlarına hiçbir yazma yapılmadı.

## Bilinen8023CONCEPT örneği

Taze tam korumalı katalog detail36724, native36724→Vega161167→8023CONCEPT ve RUN06/kaynak30Eylül/accepted-opening/holdfalse bağını doğruladı. Önceki [kaynak notu](stock-products-acceptance.md) ve [pinned kaynak tanımı](../../../scripts/catalog/create_safe_concept_replacement_core.mjs) aynı kimliği destekler; bu tek örnek diğer ürünlere genellenmedi.

- Desktop adayı Fotoğraflar/CONCEPT/8023 CONCEPT.jpg:152.197bayt,1206×1500, SHA256 e0a01ba0e0382d4bc5f0bc4562e862cbf8ee777655a9ab00295dafd373360c5f; arşivPhotoID72883.
- Önceki doğrulanmış TEST uploads dosyası157.308bayt, SHA256 e3958384a78f3d39ea929dffc2274ce2210dcc5e29c659335d452700d8be9067; dosya bu tur yeniden hash ile kontrol edildi.
- İki görsel de gözle açıldı: aynıConcept8023ürün/katalog düzeni, eski görseldeMelisa filigranı, Desktop adayında filigran yok. **Aynı dosya değildir**; eskiSHA yeni adaya aktarılmadı ve görseller değiştirilmedi.
- Basılı16.90USD katalog fiyatı ürün eşleme/fiyat kaynağı değildir; hiçbir ERP satış fiyatı değiştirilmedi veya fotoğraftan türetilmedi.

## Makine manifesti ve kullanılma sınırı

[photo-mapping-plan.json](photo-mapping-plan.json) schemaVersion melisa-erp.photo-mapping-plan.v1; bir fotoğraf dosyası başına bir records kaydı. Gerekli productId/stockCode/barcode/filePath/matchBasis/confidence/status alanları ve dosyaSHA, relativePath, sourceprovenance, hold, candidateProducts bulunur. Status yalnız CONFIRMED/AMBIGUOUS/UNMATCHED. Confidence EXACT_IDENTITY/UNRESOLVED/NONE kategorisidir; istatistiksel olasılık veya görsel kalite puanı değildir. Tekil barkod seçilemediğinde barcode:null; bütün gerçek barkodlar barcodes dizisinde. Hiçbir kayıtta ana görsel seçilmedi: isPrimary:null; applicationAllowed:false ve bulkApplyAuthorized:false.

İleride aynı ürüne birden çok fotoğraf gelirse her dosya ayrı medya adayı olarak korunur; sıralama veya tek dosya olması ana fotoğraf kararına dönüşmez. Bu plan bugünkü arşiv/hash ve katalog source snapshot içindir; daha sonra uygulama öncesi dosya hash ve güncel ürün/rol/karantina kimlikleri tekrar doğrulanmalıdır.

## Kanıt ve değişiklik sınırı

Katalog, mevcut readonly aktör14ile334ardışık50satırlık tam korumalı API sayfasından toplandı;16.676unique productId/sourceKey,son26,fixtures0. Uygulama source df3de9054cbeb80419976cede6a26f12b1c16e94/paket40; Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01; kimlik başlangıç ve sonunda doğrulandı. Kart/fiyat kaynağı30Eylül; güncel Vega71/341ürün+74cari deltası bu çalışmada uygulanmadı. Stok/fiyat/financial bu eşleme manifestine kopyalanmadı.

Tüm3.902dosya için başlangıç/son relativePath,size,mtime,SHA256 karşılaştırması aynı; fark0. Scratchkanıtlar repo dışında work/erp-d03 altında. Arşiv before/after treeSHA: b79c3a8ccc802713e17d3865bf58202d517dbf6b387b54107dc4a2cc23752837. Katalog minimum kimlik snapshotSHA: e6831cab84eb18ab51d5cd868dc89925846d0db48fac9a2bd79d7dd59b0533b7. ArşivCSV SHA: 9b55c9d3a2c89303fb8075cb8ffeb5dd7c4f8a518a6e21feaf8bba11e659e6d3. JSONrecords SHA: 5da967d2652aa0d6710ad206ac10b7a5898d5a8af7ff3f45e048669e15d22b6d.

Orijinallere taşıma/silme/rename/edit yok; fotoğraf veya ürün/SQL/migration yazması0. Runtime restart/build/deploy yok; CRM reposu değişmedi. GitHub'a yalnız bu rapor/manifest ve gerekli kabul/durum belgeleri gider; fotoğraf bytes veya thumbnails yüklenmez. Çalışan paket40/source aynen kalır; doküman commit'i runtime deployment değildir.

## ERP-UA03 kullanıcı incelemesi

1. Kesin10örnekte fotoğraf→tamkod→ERPproductId zincirini incele;0161/0205başındaki sıfırları kontrol et.
2. BELİRSİZ tablosunda boşluk/harf farkları ve4620LEYLEK karantinasını incele; adayları otomatik kabul sayma.
3. 8023CONCEPT için yeni/eski dosya farkını ve basılı fiyatın ERP fiyatı sayılmadığını kontrol et.
4. Eksik12.779ürün, belirsiz67fotoğraf ve ana görsel seçilmemesi sınırını değerlendir; plan için kabul/red veya satır bazlı düzeltme belirt.

ERP-UA03 sonucu **bekliyor**. Kullanıcı bu planı görüp kabul etmeden ERP-D04/toplu fotoğraf bağlama başlamaz. Bu tur burada durur.
