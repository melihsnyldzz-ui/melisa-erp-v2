# ERP-STAGE0501 — canlı öncesi son eksikler

9 Ekim 2026 · ERP-DEC-034 · mevcut PR #23 · **LIVE hazır değildir**.

Çalışan **TEST125 / source `edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d`** korunur. Normal ERP 5194/4144/4146, günlük prova kopyası 5204/4154/4156 üzerinde aynı paketle çalışır. Yeni kaynak kodu kurtarma/sınıflandırma yardımcılarıdır; çalışan uygulama paketine alınmış gibi sunulmaz. Servis restart, eski pakete dönüş, yeniden ürün/cari aktarımı ve gerçek T1 yapılmadı.

## Köken ve açılış

- Önceki **22 UNKNOWN belgeden dört sipariş taslağı** exact native kayıt, mevcut TEST sipariş journal'ı ve sekiz SQL modülüyle kanıtlı sentetik olarak ayrıldı. Stok/cari/kasa etkileri sıfırdır.
- **18 belge hâlâ UNKNOWN:** 11 tamamlanmış (altı satış, beş alış), yedi iptal edilmiş satış. İptallerin net sıfırı, işlem kökenini veya eksik depo boyutunu çözmez. Hiçbir belge silinmedi veya tahminle gerçek/deneme sayılmadı.
- **1.151 engel boyutu/hesabı** ve **179 atanmamış cari bağlantısı** tekil private kanıtla kayıtlı. Stok/kasa/cari etkilerinde yeni sınıflandırma yok; farklı ürün/depo/birim/döviz veya örtüşen nedenler tek toplam bakiyeye çevrilmedi.
- **39 kasa hesabının hiçbirinde gerçek açılış otoritesi tamam değil.** TRY 24 / USD 8 / EUR 7; 39/39 matematiksel kapanış ve mevcut native içerik doğrulandı. Beş kaynak isim/döviz grubunun Vega 2026 D0007 hareket bağı dar SELECT-only okumayla çözüldü; fiziksel kasa kart UID'si veya gerçek banka açılışı ilan edilmedi. Hazır gerçek açılış bulunmadığı için tutar yazması sıfırdır.

[Kayıt bazlı sınıflandırma ve kasa sonucu](origin-and-cash.md). Kullanıcıya gereken işletme bilgisi: kalan 18 belgenin kökeni; kullanılacak fiziksel kasalar/banka hesapları ve dövizleri; aynı kesim tarihindeki kasa sayımı/banka ekstresi ve yoldaki işlemler/devir kapsamı. Teknik kaynak kimliği kullanıcıya sorulmaz.

## İzole kurtarma

Yeni `MELISA_ERP_STAGE05_INVERSE_TEST_20261009_01` veritabanı, güncel TEST125 yedeğinden gerçekten restore edildi. COPY_ONLY/CHECKSUM/SHA256/VERIFYONLY ve gerçek restore ayrı kanıtlardır. Aktif TEST veya Stage4 kopyasına restore/reset yapılmadı.

29 kritik tam-satır veri grubu, 337 SQL modülü ve 9.048 native kolon tanımı source-before/source-after/raw restore ile eşleşti. Bu bütün veritabanı satırlarının karşılaştırıldığı iddiası değildir. Sonraki kurtarma prova sınırı ise dokuz değişebilir native tablo ile diğer bütün kullanıcı tablolarının koruma hashlerini ayrı izler.

**İzole kopyada commit edilmiş ürün ve 283 hesaplık batch'in kaynak etkisini geri alma provası teknik olarak geçti.** 343 ürün-depo stok ve 59 ayrı döviz hesabı katkısı telafi edildi; 46/47 fiyat ve 34/35 ana kart grubunda uygun alanlar geri alındı. Sonradan değiştirilmiş bir fiyat ve iki kart alanı üç CAS ertelemesinde korundu. Bir kart grubunda diğer uygun alanlar geri alınırken adı korunduğu için erteleme ve işlem grubu sayıları örtüşür. 482 işlem grubu / 1.345 native after-image, ürün toplamı değildir.

Altı COMMIT edilmiş sonraki yerel prova ve 17 native etkisi `SYNTHETIC_RECOVERY_REHEARSAL` kimliğiyle korundu; gerçek işletme işlemi diye sunulmaz. Fiziksel belge/ürün/barkod/fiyat silme yok. 72 kart / 109 barkod / 319 fiyat / 72 kaynak bağı, 572 immutable yayın kapsamı satırıyla geri çekildi; eski 16.671 ürün / 64.015 fiyat üyeliği current native değerleri okur ve manuel fiyatı korur. Bu projeksiyon çalışan normal ERP'de veya LIVE'da etkinleştirilmiş değildir.

Kasıtlı hata bütün native adımlardan sonra gerçekten commit öncesine ulaştı ve rollback oldu: dokuz tam native tablo, 704 diğer tablo, bütün native sütun tanımları, recovery journal ve guard'ların birleşik önce/sonra hash'i eşit, recovery commit etkisi 0. Ardından gerçek COMMIT, aynı UUID/body native replay **ikinci etki 0**, aynı UUID/farklı body **ret ve 0 commit** sonuçları alındı. Sonraki altı prova her fazda korundu.

Yazıcılar kapandıktan sonra bağımsız **22 SELECT / 0 yazma** kontrolü geçti: 343 stok + 59 hesap exact8 kaynak/yerel/defter kapanışı, 402 özgün hareket ve 59 audit tam hash'i, 47 fiyat / 35 kart / altı sonraki prova, 224 no-op hesap ve 159 hassasiyet kapsamı, önceki 16 hesabın tam hash'i, 572 geri çekilmiş kaydın fiziksel varlığı ve 16.671 / 64.015 native yayın görünümü doğrulandı. Genel otomatik recovery aktivasyonu, tüm geçmişin restore kabulü veya gerçek T1 iddiası yok.

Son bağımsız orijinal TEST kontrolü de **0 fark** verdi: aynı 29 kritik tam-satır veri grubu, 337 SQL modülü/trigger durumu, 9.048 native kolon tanımı ve 3.830 kayıtlı merkezi medya index SHA'sı korundu. Bu kayıtlı medya metadata kontrolüdür; fotoğraf byte'larının yeniden hash'lendiği veya bütün DB satırlarının karşılaştırıldığı iddia edilmez. Altı çalışan servis aynı TEST125/source ve iki eski TEST DB kimliğini döndürdü; sysadmin/LIVE erişimi 0.

Tarihsel negatif stok yalnız parent receipt'in tam before-image'ı aynı eski negatif miktarı kanıtlıyor ve sonraki sealed yerel etkiyle daha kötü bir miktar oluşmuyorsa izole kopyada kabul edilir. Yeni negatif, bilinmeyen before-image veya hassasiyet kaybı ertelenir. Çalışan TEST'in negatif stok veya yetki kuralları değiştirilmez. Ürün/cari batch hassasiyeti daraltılmaz; önceki 16 hesap, iki LL ve 770 dış kapsam korunur.

Restore kopyasındaki owner-context guard, sunucu yetkisi isteyen transaction sorgusunda SQL15562 ile ilk olumlu provayı reddetti; işlem geri alındı. Tekil salt okunur tanı, mevcut Stage4 yöntemindeki `CURRENT_TRANSACTION_ID()` eşdeğerinin aynı bağlamda çalıştığını doğruladı. Dar çözüm bu builtin'i ve yalnız bu kopyada motorun `ORIGINAL_LOGIN()` değerini sealed writer kimliğiyle eşlemeyi kullanır. Her dış writer transaction'ında gerçek login/SID/sysadmin ve kurulu guard manifest'i tekrar doğrulanır. TRUSTWORTHY kapalı kalır; yeni server izni, trigger disable veya rol değişikliği yok. 41 gerçek dbo trigger'ın eski gövdeleri korunur; aynı isimli fixture trigger'ı kapsama alınmaz. Bu davranış mevcut çalışan paket korumasının değiştirilmesi değildir.

## İnsan ve cihaz

[18 dakikalık tek ekran turu](acceptance-tour.md) normal yeşil ERP'de sekiz durağı kapsar: iş sırası, katalog/barkod, mal kabul/alış, satış/tahsilat, ödeme geçmişi, sayım/iade, rapor ve Zebra. Mevcut kayıtlar kullanılır; bu tur yeni ticari işlem veya taslak oluşturmaz.

TEST125'in eski ödeme geçmişi ile günlük kopyadaki bağlı ödeme/ters kayıt/sonraki ödeme gerçek tarayıcıda açıldı. Raporlar 8–9 Ekim aralığında görüldü. Ekran görüntüleri private kanıtta; ham ticari veri GitHub'a yüklenmedi. Fiziksel Zebra erişimi güncel salt okunur gözlemde doğrulanamadı; cihazın bulunmadığı iddia edilmez. Wi-Fi/uyku-uyanma/personel/gerçek scanner kabulü açıktır.

**ERP-UA28, ERP-UA27, ERP-UA18 ve önceki bekleyen insan kabulleri bekliyor.** Teknik native kanıt veya ekranın açılması insan PASS yerine kullanılmaz. Finish tree **49 toplam / 9 tamam / 39 kısmi / 1 açık**; eski dar D10 kabulü kendi kapsamıyla korunur.

## GitHub ve sınırlı kontroller

Yerel hedefli offline testler ile gerçek izole native provasının sonuçları ayrı kaydedilir. CI guard'ı, Windows başlangıç veya secret-scan kontrolleri atlanmaz. Başlangıç HEAD `a4be1e176484d40695cbf1420ec30800ccf5b662` için push `37859388801` / PR `37859393935` üçer CI işi adım çalıştırmadan FAILURE verdi: GitHub hesap ödemesi/harcama sınırı. Vercel preview sonucu GitHub CI yerine gösterilmez. Son teslim HEAD'inin sonucu push sonrasında ayrıca doğrulanır; makbuzu [PR #23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23) teslim yorumundadır.

Vega/LIVE/CRM/main yazması, gerçek T1 veya önceki migration'ın tekrar uygulaması yok. Bu aşama teslim edilince **DUR**. Kalan işletme kararı, UNKNOWN/boyut/kaynak istisnaları, gerçek kasa/banka açılışı, insan/cihaz kabulü ve CI hesap engeli çözülmeden LIVE başlatılmaz.

Özel kanıt kökü: `C:/Sirket/ERP/evidence/ERP-STAGE05-20261009/private/`. Kaynak isimleri, tutarlar, tam native before/after-image, login SID ve yedek özel kalır; GitHub'a yalnız kod ve anonim kanıt gider.
