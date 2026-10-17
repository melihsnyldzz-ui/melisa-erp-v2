# Seçilen satışın mevcut native motora bağlanması — kaynak checkpoint'i

11 Ekim 2026, ERP-COMPLETE01 / ERP-DEC-044. Bu teslim mevcut invoice/currency motoruna seçilen müşteri döviz hesabının dar bağlantısını ekler. **Genel günlük satış henüz çalıştırılmadı; yeni paket veya ortak DB02 aktivasyonu yoktur.** Önceki native önizleme kanıtı tekrar yapılmadı.

## Kaynakta tamamlanan bağlantılar

- SOURCE ürün kimliği, ana birim, satış fiyatı, maliyet ve tarihli kur ile müşteri/döviz hesabı için deterministik seçim/policy bağı. Kasa, tedarikçi veya alış fiyatı satış önkoşulu değildir. Hazırlanan policy en çok200 ayrı ürün ve20000 belge dövizi tutarını kapsar; yalnız pozitif tam ana birim miktarı. Bu hazırlık tek başına write grant değildir; eski iki ürün/beş miktar önizlemesi aynı kalır.
- Ayrı owner intent okuyucusu yalnız mevcut Exclusive/SERIALIZABLE transaction'da çalışabilir. Aynı SPID/TX, DB/login/profil, etkili native pinler, aktör/yetki, sealed before-image, istek/hash, seçilen hesap/ürün/fiyat/kur ve güncel revision doğrulanır. Çağıran DTO'su veya read-only preview yetki vermez. Kapsam işlem bitince kapanır; gecikmiş callback veya farklı transaction onu kullanamaz.
- Satış oluşturma journal'ı ile link/request/invoice/aktör ve immutable header/satırlar karşılaştırılır. Döviz hesabı ve selection creation journal'ından türetilir; farklı aktörün kaydı, coherent rehash ile değiştirilmiş seçim, yanlış kur/fiyat/birim/barkod/maliyet reddedilir. Utility yalnız selection/creation döndürür, yetki üretmez.
- Mevcut native draft/finalize/cancel ve customer currency posting kodları verified same-TX seçimi kullanır. USD satışının TL ana kart göstergesini değiştirmemesi için kartın dövizi eşleşir; seçilen döviz hesabına posting ayrı kalır. Eski TRY500, alış ve diğer operasyon yolları korunur. HTTP body'nin server policy/identity alanlarını doldurması reddedilir.

## Doğrulama ve açık sınır

65 hedefli offline kontrol geçti (37 seçilen satış/currency +28 mevcut inbound/initial snapshot/store regresyonu): yeni scope/journal/SQL hazırlaması, mevcut currency regressions ve gerçek invoice/currency fonksiyonlarını çağıran dokuz yeni engine kontrolü. Engine kontrollerinde SQL request'leri sentetiktir; draft/header ve finalize/cancel/card sınırında kontrollü durulur. Bunlar tam SQL satış/iptal/replay veya gerçek ekran kabulü değildir. Yeni engine testi canonical CI listesine, API testleri mevcut recursive listeye bağlandı.

Yeni intent okuyucusunun exact CREATE metni mevcut restricted `MELISA_ERP_READINESS_PROOF_TEST_20261011_01` kopyasında gerçek SQL Server'da derlendi; stored definition/hash birebir karşılaştırıldı. CREATE rollback yapıldı; bütün module tanımları, SQL izinleri ve rol üyelikleri başlangıçla eşit. Reader body veya ticari prosedür çalıştırılmadı. Ticari yazma, commit ve ortak DB02 yazması0. Bu metadata eşitliği 751 tablonun tekrar veri taraması veya ticari zincir kanıtı diye sunulmaz.

| Kanıt | Pin |
|---|---|
| Native derleme/rollback makbuzu `selected-sale-write-scope-compilation-2026-10-11T115519854Z.json` | SHA256 `7d9e96aaef8d2a25e069a93087bb9bfb007718b96c0b56aca8ad5780b735ee58` |
| Exact SOURCE intent reader definition | `A2787AE626440C153B65AE480A7997D07E8C10393EC22400C47BC6FA571AAC54` |

Ham profil, hesaplar ve config repo dışındaki private kanıt alanındadır. Kaynak dosya pinleri makbuzda bulunur. Yeni DB/restore/yedek oluşturulmadı; eski prova temizliğinde korunmuş yedekler silinmedi.

**Mevcut runtime bu yeni scope'a giremez:** eski v4/v5 begin, korumalı `before_state_json.selectedSaleIntent` kanıtını üretmez. Kapsamı sessizce açmak, registry pinlerini değiştirmek veya reader flag'ını grant saymak yoktur. Yeni helper/store normal route'a henüz bağlanmadı; selected journal formatında yeni kayıt üretilmedi. Journal loader GUID normalizasyonunu ve native satır sırasını da bağlamalıdır.

## Sonraki tek uygulama

Mevcut begin/guard/effects/profit/READY için coherent selected-sale successor pin zinciri ve store journal bağlantısı. Eski immutable v4/v5 kayıtları korunmalı; replay fresh-stock kontrolünden önce aynı aktör/operation/body/hash ile sonuçlanmalı. Finalize/cancel seçimi journal'dan alınmalı, native revision ve fiyat/kur/profit hesabı doğrulanmalı. Sonra aynı restricted kopyada gerçek draft/finalize/cancel/replay ve normal ekran sonucu kanıtlanmalı; ancak bundan sonra yeni geçici çalışma paketi oluşturulmalı.

TEST125 application `edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d`, DB02 API/native `a51b1170ade29494b3b446a44a8a62974eef687b` ve geçici uygulama `181de5ac4102904104c056c9c270b9c6a7ef990d` değişmedi. Sabit boot/ağ checkpoint'i, roller, önceki aktarımlar, terminal görevleri ve dört video korunur. İnsan ERP-UA32 bekliyor; **49 / 9 tamam / 39 kısmi / 1 açık** değişmez. Bütün ana hedef aktiftir.
