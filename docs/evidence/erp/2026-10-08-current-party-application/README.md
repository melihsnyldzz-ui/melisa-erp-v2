# ERP-CARICOMPLETION01 — onaylı 283 hesabın TEST uygulaması

8 Ekim 2026, ERP-DEC-031. Bu teslim yalnız kullanıcının tekil kimlik ve tutarlarını onayladığı 283 hesap içindir; gerçek final T1 veya LIVE geçişi değildir. Önceki [hazırlık paketi](../2026-10-08-current-party-completion/README.md) değiştirilmedi. Sayısal uygulama onayı insan ekran kabulü değildir; ERP-UA24/25 bekliyor.

## Gerçek sonuç

| İşlem | Sonuç |
| --- | --- |
| Onaylı kapsam | 283 hesap: 138 müşteri, 145 tedarikçi |
| Yeni kaynak farkı | 59: 25 müşteri, 34 tedarikçi; 59 yeni finans hareketi |
| Farksız | 224; yeni finans hareketi yok |
| Hata veya kaynak/hedef değişimi nedeniyle ayrılan | 0 |
| Gerekli hassasiyet | 159 onaylı hesap; iki native bakiye kolonu TEST'te `decimal(28,8)` |
| Ana kart gösterge eşitlemesi | 157 onaylı hesap; ayrı finans hareketi oluşturulmadı |
| Önceki Goal7.3 | 16 hesap ve immutable journal korundu; tekrar uygulanmadı |
| Kapsam dışı | 770 sınıflandırılmış hesap ve iki exact LL dışlaması korundu |

Ana kart SQL UPDATE sayısı kapsam sayısı değildir: 157 gösterge düzeltmesi ile ayrıca normal bakiye farkı nedeniyle değişen 8 doğru ana kart toplam 165 karttır. Toplam 278 onaylı ana döviz kartı kendi hesabıyla eşittir; ek dövizler kartın varsayılan dövizine yazılmaz.

Kaynak ve hedef işlemden hemen önce yeniden doğrulandı. İki geçişli SELECT-only kaynak kontrolü ve commit öncesi son kontrol kullanıldı; yalnız etkilenen hesabın ayrılması uygulanır. Onaylı 283 hesapta değişim bulunmadı. Önceki 16 kapsamındaki sonraki kaynak hareketi ayrı drift olarak tutuldu, yeni pakete eklenmedi.

## Yedek, geri alma ve tekrar uygulama

- Exact hedef: `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`. Vega bağlantısı salt okunur; LIVE bağlantısı yok.
- Yeni COPY_ONLY/CHECKSUM yedek: 8.806.858.752 bayt; fiziksel dosya hash'i ve header yeniden doğrulandı, RESTORE VERIFYONLY başarılı. Aktif veritabanına restore yapılmadı.
- Commit öncesi tam hata enjeksiyonu provasında hassasiyet DDL'i, göstergeler, finans/journal/audit ve dar okuyucu kurulumu tek transaction ile geri alındı. Bağımsız SQL kontrolü başlangıç verisi, eski `18,4` şema ve bütün guardların aynen döndüğünü doğruladı. Erken hata veren önceki denemeler bu tam prova yerine sayılmadı.
- Gerçek uygulama mevcut migration transaction/applock/immutable journal/type-bound effect mekanizmasını kullanır. Yeni ticari veritabanı veya ikinci migration motoru yok.
- Committed aynı paket replay'i çalıştırıldı: **0 yeni etki**. Bağımsız SQL, replay öncesi/sonrası verinin aynı olduğunu doğruladı. Değiştirilmiş body SQL çağrısından önce reddedildi.
- Yedek ve immutable before-image dosyaları geri dönüş için korunur. Bu batch'in commit sonrası inverse uygulaması çalıştırılmadı; önceki sentetik inverse veya atomic rollback kanıtı committed inverse diye sunulmaz. Sonraki yerel hareketleri silen temizleme veya eski tam yedeği otomatik geri yükleme yok.

## Bağımsız veri kontrolü

283/283 exact beklenen bakiye ve 283/283 defter kapanışı; 278 ana döviz gösterge eşitliği; 53.217 eski hareket satırı aynen korunmuş; yalnız 59 onaylı yeni hareket. 224 defter no-op için ikinci hareket yok. Kapsam dışındaki 766 mevcut native hesap ve onaysız kartların iş alanları korunmuştur; 770 mantıksal dış kapsamın bazı üyelerinin native kartı zaten yoktur ve bu tur oluşturulmamıştır.

Eski 16 journal, 24 guard tanımı/sırası, roller, karantina, stok ve satış fiyatı koruma hashleri eşittir. Hassasiyet genişletmesi diğer mevcut değerlerde veri kaybı oluşturmadı. Kaynak/authoritative finans etkisi `balance_effect_exact` ve native bakiye 8 ondalık saklanır. Mevcut 4 ondalıklı legacy hareket kolonları yalnız açık uyumluluk projeksiyonudur; bütün eski finans sorgularının 8 ondalığa geçirildiği iddia edilmez. Normal kart okuyucusu authoritative exact etkiyi kullanır.

## Okuyucu ve normal ekran

Mevcut müşteri/tedarikçi kart okuyucusuna yalnız bu sealed 283 hesabın doğrulanmış etkilerini okuyan dar context eklendi. `dbo.usp_read_current_finance_deltas` SELECT-only, tanımı hash ile kilitli ve mevcut TEST okuyucularına yalnız EXECUTE verilmiştir; mevcut roller veya genel yazma izinleri genişletilmedi. Açılış + önceki kaynak farkı + yeni doğrulanmış kaynak farkı + yerel etki bir kez değerlendirilir. Genel Bakiye ile döviz hesabı birleştirilmez.

Normal yeşil kartın mevcut “Kaynak bakiye güncellemesi” satırı önceki ve yeni doğrulanmış kaynak farkını gösterir; açılış/yerel hareketler ayrı kalır. BigInt exact closure ve iki ondalıklı gösterim korunur. Boş, malformed veya kanıtı uyumsuz fark sahte sıfır olarak gösterilmez. Yerleşim, menü ve ticari işlem yüzleri değişmedi.

TEST104'te bağımsız 283/283 API kontrolü geçti. TEST105 son denemesinde cari okuması geçici503 üretti; bağımsız sıralı denemede de tekrarlandı. Direct low-privilege teşhis normal müşteri prosedürünü330–481ms, yeni current proof prosedürünü9.970–9.998ms ölçtü; mevcut10.000ms SQL timeout sınırı korunur. Aynı büyük immutable receipt metadata/effects metni effect başına tekrar çözülüyordu. Dar okuyucu, aynı transaction içinde bu metadata/effects'i bir kez temp tabloya hazırlayarak bütün eski native/audit/döviz/parent/hash kontrollerini korur; cross-request cache veya timeout artışı yok. Uzun/eksik receipt metadata da prefix kabulü olmadan fail-closed kalır. Yeni okuyucunun gerçek SQL/paket/API/normal ekran sonucu son doğrulama kaydında tamamlanır;105 denemesi performance veya tamamlanmış finalAPI PASS sayılmaz.

TEST ekranları: [Müşteriler](http://127.0.0.1:5194/ornek-akis.html#customers), [Tedarikçiler](http://127.0.0.1:5194/ornek-akis.html#suppliers). İnsan PASS verilmedi.

## Son okuyucu düzeltmesinin gerçek SQL sonucu

SQL'in `CREATE OR ALTER` tanım başlığını yeniden yazması ilk metadata hash kontrolünü reddetti; o transaction geri alındı. Açık `ALTER` ile güncellenen tanım bu SQL sürümünde `CREATE` başlığıyla saklanır. Kod yalnız aynı tam gövdenin iki sabit CREATE/ALTER hash'ini kabul eder; başka metin, whitespace veya gövde değişikliği fail-closed kalır. Genel hash normalizasyonu veya bilinmeyen sürüm kabulü yok.

Yeni dar SELECT okuyucunun tam metadata rollback provası **PASS**: 283/283 aynı exact etki,159ms; eski prosedür tanımı geri döndü. Gerçek okuyucu güncellemesi **PASS**:283/283,149ms. Her iki işlemde15 iş tablosunun önce/sonra count+hashleri ve prosedür ACL'i aynı, finans yazması0; CREATE/DROP/reGRANT veya yeni rol verilmedi. İlk ağır sorgu~9.998ms idi. Bu süre SQL kanıt okumasıdır, tarayıcı paint veya bütün ERP performans kabulü değildir.

Son immutable paket **TEST107**, uygulama source `6c31585efa5bde23047a1776fb61c3ab0bbcd7f3`, `CANONICAL-TEST-6c31585efa5b`,1505 manifest dosyası/baselineReproducedtrue. Writer'ın gerçek finans uygulaması source967cba5 ile gerçekleşmişti;107 yalnız normal kart sunumu ve dar SELECT reader teslimidir. TEST101/104/105 ve kurulmadan korunmuş102/103/106 paketleri silinmedi. Exact uygulama source PR CI run37803123289 ve push37803112209 üçer job SUCCESS; son doküman HEAD ayrı doğrulanır.

## Son normal API ve ekran sonucu

TEST107 üzerinde bağımsız normal müşteri/tedarikçi API kontrolü **283/283 doğru, 0 hata**. Aynı 11 sıralı, 100 satırlık GET isteği TEST104'te 9.640–10.664 ms / ortalama 9.997 ms iken TEST107'de **290–640 ms / ortalama 476 ms** oldu. Müşteri 5 sayfa ortalama 469 ms, tedarikçi 6 sayfa ortalama 483 ms. Exact bakiye, hesap kimliği, döviz, B/A, reconciled kapanışı ve korunmuş yerel etki kontrolleri gevşetilmedi. Bu HTTP/SQL ölçümüdür; tarayıcı paint veya insan performans kabulü değildir.

Normal yeşil çalışma yüzünde üç gerçek kart açıldı: bir USD müşteri, bir TRY tedarikçi ve bir USD tedarikçi. Beklenen iki ondalıklı bakiye ve B/A yönü, açılış/yerel etki/kaynak güncellemesinin ayrı sunumu doğrulandı. Tedarikçilerin kanıtı olmayan diğer döviz hesapları **Bilinmiyor** kaldı; dövizler toplanmadı. Üç DOM ve ekran görüntüsü private kanıtta korunur. Kullanıcının mevcut sekmeleri, oturumu ve taslakları korunmuş; yalnız ajan kontrol sekmesi kapatılmıştır. Ticari ekran işlemi oluşturulmadı.

Önceki TEST101 gözleminde de açık olan ayrı deneme tedarikçi ödeme geçmişi paneli hâlâ açılamıyor. Bu panel bu teslimde PASS veya düzeltilmiş sayılmadı; dar 283 hesap uygulamasını yeni modül geliştirmesine genişletmedik. İnsan **ERP-UA24/25 bekliyor**.

Anonim makine özeti: [delivery-summary.json](delivery-summary.json). Kaynak CI ve son doküman HEAD CI ayrı teslimlerdir; son HEAD makbuzu PR23'te doğrulanır.

## Private kanıt sınırı

Ham cari adları, tutarlar, hesap anahtarları, kaynak dosyalar ve ekran görüntüleri yalnız ACL korumalı `C:\Sirket\ERP\evidence\ERP-CARICOMPLETION01-20261008\private` altında. GitHub yalnız anonim sonuç, uygulama/okuyucu kodu ve teknik testleri içerir. Yedek `C:\Sirket\ERP\backups\ERP-CARICOMPLETION01-20261008` altında tutulur. Orijinal onay paketi ve önceki runtime/paketler korunmuştur.

Bu teslimden sonra **DUR**. Başka hesap, modül veya finish-tree işi başlamaz; Vega/LIVE/CRM/stok/satış fiyatı/main değişikliği yok.
