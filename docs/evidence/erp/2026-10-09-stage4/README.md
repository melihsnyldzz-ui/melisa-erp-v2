# Aşama 4 — deneme etkileri ve günlük işlem provası

ERP-DEC-033 / ERP-STAGE0401. Teknik teslim; **ERP-UA27 insan kabulü bekliyor**. Bu kapsam sonunda DUR. Gerçek T1, LIVE geçişi veya başka aşama başlatılmaz. [Makine özeti](summary.json).

## Ortam ve korunmuş başlangıç

Başlangıç checkout `d3d81b8dd3353d1839e84eb3f08f770ea6dc0c8a`, çalışan TEST113 / source `63f0a017ec23e89ca9aab7e44acb051f4e86479a`. Kanonik dal `codex/erp-finish-20261004`, [PR #23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23).

Son uygulama source `edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d`, paket **TEST125 / CANONICAL-TEST-edb3c8915ef0**. Belge teslim HEAD'i uygulama source'undan ayrıdır; PR'nin head ve aynı head CI makbuzu esas alınır. Paket manifesti ve iki runtime gerçek sağlık/port/DB kimliğiyle karşılaştırılır.

| Ortam | Web / API / native | Veritabanı | Kapsam |
| --- | --- | --- | --- |
| Korunan normal TEST | 5194 / 4144 / 4146 | MELISA_ERP_SIRKET_TEST_20260929_01 | Bu aşamada ticari veri/SQL şeması yazılmadı; paket güncellendi. |
| İzole günlük prova | 5204 / 4154 / 4156 | MELISA_ERP_STAGE04_COPY_TEST_20261008_01 | Yalnız loopback, mühürlü iki ürün + bir müşteri + bir tedarikçi; mevcut 15/16 aktörleri. |
| Kurtarma kanıtı | Uygulama yayımlanmadı | MELISA_ERP_STAGE04_RECOVERY_TEST_20261008_01 | Yeni, ayrı ve READ_ONLY restore. |

Sunucu `Semih\MELISADEV`. Kopya servislerinin sysadmin/CONTROL/orijinal DB erişimi/LIVE erişimi 0; dış mesaj, ödeme, belge gönderimi ve otomatik işler kapalı. Mevcut kullanıcı/rol/izinler genişletilmedi. Orijinal TEST'in 29 kritik veri grubu, 337 SQL modülü ve 9.048 kolon tanımı önce/sonra aynı. Bu bütün DB'deki her satır/index/grant için kapsam iddiası değildir.

283 cari hesabı ve 59 fark, önceki 16 hesap, iki LL dış kapsamı/770 istisna, 72 yeni ürün, 343 stok farkı, 109 barkod, 319 yeni/47 güncel fiyat, 4.338 net alış referansı, 6.090 maliyet, 3.830 medya/67 belirsiz ve karantinalar yeniden uygulanmadı. Ana TEST silinmedi, sıfırlanmadı, eski yedekle ezilmedi. Korunan normal TEST’in mevcut private ayarlarında yalnız uygulama source/paket pinleri değişti; diğer ayarlar ve kimlikler korundu.

## İşlem kökeni ve temiz açılış

Goal8 ve sonrasındaki işlemler profile/day ID, request journal, typed işlem/native satır kimliği ve kaynak receipt bağlantısıyla sınıflandı. Tarih, kişi adı veya boş kaynak anahtarı köken kanıtı değildir. `SOURCE_MIGRATION`, `REAL_LOCAL`, `SYNTHETIC_LOCAL`, `UNKNOWN` ayrımı ve exact8 hassasiyet korunur.

Eski envanter **160 kanıtlı sentetik işlem/taslak/ters kayıt bağı** içerir. Bunlar 160 bağımsız satış değildir. Bağlı sentetik native defter satırları **241**: stok 75, müşteri 36, tedarikçi 74, kasa 56. Satış/iptal, tahsilat/iade, tedarikçi ödeme/ters kayıt, alış/iptal, mal kabul, sayım/düzeltme, alış/satış iadesi ve sipariş taslakları kapsanır. Belgeler/deneme kanıtları silinmedi.

**22 belge/taslak kökeni UNKNOWN**: 13 satış, 5 alış, 4 sipariş. Ayrıca 185 stok adayı, 66 müşteri, 21 tedarikçi ve 38 kasa etkisi ile 179 hesaba atanamayan finans bağı ayrı engeldir. Kümeler farklıdır; toplam işlem diye birleştirilmez. Kanıtlı gerçek yerel hareket değiştirilmedi; bilinmeyen kayıt gerçek veya sentetik ilan edilmedi.

Yeni kopya provası ayrıca **17 committed istek / 20 native etki** üretti: stok 8, müşteri 2, tedarikçi 6, kasa 4. Gerçek kaynak kartlarının kimlikleri korunurken işlemlerin kökeni açık `ISOLATED_TEST_COPY → SYNTHETIC_LOCAL` journal'ı ile kaydedildi. Bunlar gerçek yerel işletme hareketi veya Vega açılışı sayılmaz.

V02, kaynak yakalama tarihine bağlı **18.096 açılış satırı / 89.410 bileşenin** SQL'de materialize edilen muhasebe projeksiyonudur. Native defter silme veya stok/bakiye üzerine yazma yapmaz. Kaynak + kanıtlı gerçek yerel + sentetik + UNKNOWN ayrımı, kart/defter ve ayrı döviz/depo/birim kapanışı bağımsız BigInt exact8 hesabıyla doğrulandı; fark 0. Yeni kopya denemeleri açılış girdisi olarak sınıflanmaz; sabit V02 sonrasında açık kopya journal'ında ayrı tutulur. Gelecek T1 writer'ı bu tur çalıştırılmadı.

| Alan | READY | Somut engel |
| --- | ---: | --- |
| Stok | 16.426 | 123 UNKNOWN, 202 depo/birim boyutu, 3 kaynak otoritesi eksik |
| Cari döviz hesabı | 273 | 478 UNKNOWN, 294 kaynak otoritesi eksik; 4 NULL hesap ayrıca dışarıda |
| Kasa | 0 | 17 UNKNOWN, 22 doğrulanmış açılış kaynağı eksik |

273, önceki 283+16 uygulamasının silindiği anlamına gelmez; temiz açılış hesabına hazır alt kapsamdır. Stokları ürün/depo/birimler arasında, bakiyeleri TRY/USD/EUR arasında toplamadık. Kasa denemesinin teknik kapanışı gerçek kasa açılışının doğrulandığı anlamına gelmez. **Tüm açılışın LIVE'a hazır olduğu iddia edilmez.**

## Normal günlük zincir

Mevcut yeşil `ornek-akis.html` modülleri ve native işlem motorları kullanıldı. Güvenli, exact kaynak kimlikli iki ürün ve birer müşteri/tedarikçiyle sınırlı kopya provasıdır; bütün ticari kartların işletim kabulü değildir.

| İş | Gerçek kopya sonucu |
| --- | --- |
| Mal kabul | Personel iki satırı saydı/gönderdi; yetkili kabul etti; tek stok etkisi. |
| Alış/fatura ve tedarikçi borcu | Aynı kabulden native fatura finalize edildi; borç tek etki, ikinci stok girişi yok. |
| Tedarikçi ödemesi | Borç ve kasa birlikte değişti; ödeme ters kaydı ve yeni ayrı ödeme geçmişte korundu. |
| Satış ve müşteri borcu | İki ürünlü native satış finalize edildi; iki stok çıkışı ve tek müşteri etkisi. |
| Tahsilat | Aynı satışın borcu kapandı; kasa tek arttı; refresh/readback aynı sonucu verdi. |
| Sayım | Personel fark taslağı oluşturdu; onay yapamadı. Yetkili gerekçeli farkı bir kez uyguladı; ters kayıt stok miktarını geri getirdi. |
| Alış iadesi | Asıl alış satırından iade; stok azaldı, tedarikçi etkisi oluştu, orijinal fatura korundu. Ters kayıt ikisini geri getirdi. |
| Gün sonu | Yedi rapor bağımsız native eşleştirmeyle aynı: satış 1, tahsilat 1, alış 1, ödeme 3, stok 8, müşteri 2, tedarikçi 6 satır. |

İade ve ters kaydı sayım provası öncesinde yapıldı; modüller arası bağlar korunur. Mal kabul/satış/tahsilat/sayım iş günü 8 Ekim, gerçek gece iadesi 9 Ekim olarak kayıtta kaldı. Rapor özel aralığı **8–9 Ekim**; kaynak tarihi işlem tarihi yerine kullanılmadı. Ana Sayfa'da mühürlü iş günü ayrıca görünür; geçmiş gün toplamı “bugün” diye sunulmaz. Gün sonu raporu resmi kasa kapanışı veya banka entegrasyonu değildir.

Ödeme geçmişinin açılmama nedeni eski deneme ödeme receipt'inin geçerli alanlarının normal panel sözleşmesinde tanınmamasıydı. Dar doğrulanmış receipt normalleştirmesi yapıldı; bilinmeyen receipt kabul edilmez. Hem ana TEST'teki eski deneme geçmişi hem yeni kopyanın ödeme/tarih/döviz/borç/ters kayıt geçmişi normal ekranda açıldı ve yenilendi. Sadece panel açılışı ödeme zinciri kanıtı sayılmadı; native sonuçlar ayrıca doğrulandı.

## Koruma, replay ve kurtarma

Kopya adapter'i exact DB/copy ID/seal, kaynak ve native fingerprint, rol, sonlu ürün/hesap/birim/döviz ve aynı transaction/SPID native niyetiyle sınırlıdır. SERIALIZABLE korunur; okuma Shared/yazma Exclusive uygulama kilidi kullanır. 381 kopya SQL tanım pininin tamamı gerçek owner okumasında aynı. Personelin oluşturduğu taslağın creator alanı değiştirilmeden yetkili onayına izin veren dar kopya guard'ı vardır; yeni/başka/eski taslak, creator değiştirme/null/PK değiştirme engellenir. Orijinal prosedürler ve roller değişmedi.

Gerçek UI çift tıklaması, refresh, yanıt kaybı sonrası aynı UUID/body replay ikinci ticari etki üretmedi. Aynı UUID farklı geçerli body conflict ve yetkisiz personel finans/onay reddi doğrulandı. Son 9 API negatifi 9/9 ret, kalıcı etki 0: yabancı ürün/birim, negatif veya sınır üstü sayım, stale fingerprint, sıfır/negatif/fazla iade ve yanlış kaynak. Bilinmeyen barkod boş döndü. Yanlış döviz/sıfır/negatif finans ve yabancı hesap daha önceki hedefli negatiflerde reddedildi. Draft üst düzeyde kullanılmayan depo/birim alanları için ret kanıtı iddia edilmez; native boyut mevcut mühürlü sözleşmeyle belirlenir.

COPY_ONLY/CHECKSUM yedeği, HEADER/FILELIST/VERIFY ve fiziksel SHA256 doğrulandı. **İki yeni izole DB gerçekten restore edildi**; 29 kritik veri grubu + 337 SQL modülü/native kolon şeması raw restore'da eşti. Aktif/orijinal DB'ye restore/reset yapılmadı; bu bütün DB satırlarının bağımsız karşılaştırıldığı iddiası değildir. Before-image, eski migration journal, kaynak kanıtı ve deneme belgeleri korundu.

Ödeme, tek satırlı sayım ve alış iadesi commit sonrası ters kayıtları gerçekten denendi. Hata alan ilk denemeler etkisiz rollback edildi, aynı UUID ile başarılı devam/replay kanıtlandı. **Bütün PRODUCTCOMPLETION01 kart/barkod/fiyat/görünüm batch'i ve 283 CARICOMPLETION01 batch'i için commit sonrası toplu inverse bu aşamada çalıştırılmadı.** Önceki 16 hesabın dar Goal7.3 inverse kanıtı tüm 16 veya yeni 283 için kanıt sayılmaz. İki raw restore, sonradan oluşan gerçek hareketleri koruyan bütün batch inverse yerine geçmez; bu sınır LIVE öncesi açık kalır.

## Ölçüm ve teslim

Üç sıralı authenticated HTTP GET+JSON örneği; browser first-paint veya fiziksel cihaz süresi değildir. Ana TEST113 ve ana TEST125 aynı route ve mevcut aktörle karşılaştırıldı; izole kopyanın tam doğrulaması ayrı iş yüküdür. 50 ürün sayfası ve katalog/medya sözleşmesi korundu. Ham süre örnekleri [summary.json](summary.json) içindedir.

| Okuma | Ana TEST113 medyan ms | Ana TEST125 medyan ms | İzole TEST125 medyan ms |
| --- | ---: | ---: | ---: |
| İlk50 | 589 | 653 | 774 |
| Sonraki50 | 557 | 575 | 672 |
| Kod | 570 | 531 | 605 |
| Barkod | 357 | 439 | 554 |
| Kart/fiyat | 186 | 193 | 294 |
| HOME | 22 | 22 | 1.689 |
| Sayım | 180 | 178 | 181 |
| Ödeme/finans | 526 | 693 | 425 |
| İade context | Ölçülmedi | Ölçülmedi | 206 |
| Gün sonu satış raporu | Ölçülmedi | Ölçülmedi | 322 |

Kopya ilk50 soğuk örneği1.564ms; yalnız medyan ile ilk isteğin daha hızlı olduğu iddia edilmez. Stok raporunun yük sırasında500/8,3sn sonucu private korunur; son doğrudan servis1.053/734ms,8satır. SQL deadlock/1205 kanıtı yok; kaynağı tahminle değiştirmedik.

Hedefli backend/store/native/copy SQL51/51, son HOME15/15, finans model4/4, gerçek SQL creator guard rollback9/9, API negatif9/9. Paket build/baseline aynı source'tan üretildi. Yerel offline API566,web-admin5,sites689,migration222,canonical319 test geçti; quality/guard/build ve Gitleaks8.30.1 full reachable history0bulgu. Windows'ta Linux job'ın shell guard'ı dört PowerShell fixture'ı ilk denemede engelledi; guard gevşetilmedi, node kontrolleri ve ayrıca library-only recovery6/startup5 assertion'ı geçti. Bu sonuçlar hosted CI'nin çalıştığı anlamına gelmez.

Source edb3c89 push37857193029/PR37857198117 CI'nin üç işi **hiç başlamadan FAILURE**: GitHub account payments/spending limit annotation'ı. Billing ve CI politikası değiştirilmedi. Önceki dd436ec SUCCESS son source/head yerine gösterilmez. Son belge teslim HEAD kontrolleri PR #23 üzerinden ayrıca doğrulanır; CI hesap engeli açık teslim sınırlamasıdır.

Normal [ERP](http://127.0.0.1:5194/ornek-akis.html#supplier-payments) ve [izole günlük prova](http://127.0.0.1:5204/ornek-akis.html#reports). Kopya yalnız bu bilgisayarda açılır. Ham ticari veri, tutarlar, kimlikli native sonuçlar, fotoğraflar, ekran görüntüleri ve özel ayarlar yalnız repo dışındaki `C:\Sirket\ERP\evidence\ERP-STAGE04-20261008\private` alanında. GitHub'a yalnız kod/test/yöntem/anonim sayılar ve kanıt hashleri girer.

LIVE öncesi somut açıklar: UNKNOWN kayıtların işletme kökeni, doğrulanmış kasa/banka açılışı, depo/birim istisnaları ve önceki ürün/cari engelleri, bütün batch'in sonradan oluşan hareketleri koruyan recovery/inverse'i, fiziksel cihaz/personel ve geniş insan kabulü, gerçek T1 ve açık işletme geçiş kararı. Finish 49 / 9🟢 / 39🟡 / 1🔴 değişmedi. Bu teknik teslim insan PASS veya LIVE onayı değildir.
