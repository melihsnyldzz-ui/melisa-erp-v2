# Sabah mal kabul → alış → tedarikçi hareketi

ERP-DEC-014 / ERP-INBOUND01: **dar kontrollü TEST kapsamı teknik hazır; ERP-UA10/11/12 insan kabulü bekliyor.** Genel ticari ürünlere yazma veya üretime hazır ERP iddiası değildir.

## Kaynak ve çalışan sistem

- Başlangıç checkout af8fd1ba4fce02f51147c0ce6f6638bba65ccd6d, çalışan TEST53/source11f17341dc69002aed8c249878c468058afc8da5. Aktif codex/erp-finish-20261004 / draft [PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23); main merge yok.
- Son çalışan **CANONICAL-INBOUND-TEST-20261006-58**, application source **93365d0baf002e93010a2759bd45af2af11040e7**. İzleyen belge/kanıt commit'i deployment değildir. [Runtime değişimi](runtime-switch-58.json).
- [Normal Ana Sayfa](http://192.168.1.46:5194/ornek-akis.html#home), [Mal Kabul](http://192.168.1.46:5194/ornek-akis.html#goods), [Alış](http://192.168.1.46:5194/ornek-akis.html#purchases), [Tedarikçiler](http://192.168.1.46:5194/ornek-akis.html#suppliers); localhost5194 aynı yüzdür. Web5194/API4144 exact loopback+192.168.1.46; native4146 yalnız loopback.
- Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01; sınırlı servis hesabı sysadmin0/control0/LIVE0/externalOperations=false. Private config hash'i, OS/IP/firewall ve LIVE süreç sahipleri değişmedi; eski paketler/launcher geri dönüşleri korundu.

## Gerçek veri ile deneme verisi

Gerçek normal katalog 16.622 açılış ürününü, barkod/stok/fiyat/birim ve 3.830 CONFIRMED merkezi fotoğrafı okur. Kaynak 30 Eylül Vega kesimi + güncel native TEST hareketleridir; güncel Vega deltası değildir. 67 belirsiz medya ve 4620 LEYLEK karantinası korunur. Gerçek kartlar bu işlemde yalnız görüntülenir. Normal Mal Kabul içindeki 8023 CONCEPT kartının fotoğrafı, TAKIM/ADET/0 stok gerçek tarayıcıda okundu.

Yazma yalnız eski korumalı C01/C02 iki ürün 301985/325503, tedarikçi13370, depo1/ADET ve C09 ürün301986/tedarikçi13373 kapsamıdır. İki ilk üründe barkod NULL: eklenmedi, gerçekmiş gibi gösterilmedi; ürün kodu/seçiciyle sayılır. Bulunamayan0000098765432 barkodu metin olarak sıfırlarıyla korunur. Fiyat60/80TRY ve USD1.34567890 deneme kaynaklarıdır. Ekranda kaynağın kendi ürün kodu ve temiz “Deneme kaydı” etiketi bulunur; SQL/UUID/commit/debug/PASS metni eklenmedi.

## İki ürünlü tam normal ekran / SQL provası

| Aşama | 301985 stok | 325503 stok | 13370 borç (TRY) | Kanıt |
| --- | ---: | ---: | ---: | --- |
| Başlangıç | 29 | 2 | −100 | native-before.json |
| Sayım#4 / kabul#3 bekliyor | 29 | 2 | −100 | native-pending.json |
| Fiziksel kabul, yanıt kaybı | 30 | 3 | −100 | native-approved-response-lost.json |
| Aynı UUID/tam gövdeyle tekrar | 30 | 3 | −100 | native-approved-replay.json |
| Fatura25091 tamamlandı140TRY | 30 | 3 | 40 | native-finalized.json |
| Fatura ters kaydı | 30 | 3 | −100 | native-cancelled.json |

Kaynak snapshot60/80TRY değişmez. Fatura TSTB-INBOUND-20261006-01 yenilemede aynı kaydı getirir. Fiziksel kabul onayında tarayıcı yanıtı sunucudan sonra tutulup15s zaman aşımı yaratıldı; butonlar kilitlendi, “Son işlemi doğrula” aynı UUID/fullbody ile replayed=true döndü. Stok ikinci kez artmadı. SQL journal/stock movement sayıları tekrar öncesi/sonrası aynı. Fatura iptali fiziksel stok iadesi değildir; stoklar30/3 kalır.

Tedarikçi kartında kabul#3 → aynı fatura → +140TRY borç → −140TRY ters hareket iki ayrı satır olarak okunur. Eski kabul bağı olmayan hareketlerde “Kabul bağı bilinmiyor” kalır; bağ tahmin edilmez. SQL8124 dış/yerel SUM hatası gerçek provada giderildi; bozuk/karışık fatura sahipliği koruması korunur.

## Kalıcı sayım ve mevcut roller

- Gerçek personel15: yeni çok satırlı sayım, adet2→1, eksik/fazla notları, kaydet/yenile; maliyet/alış/tedarikçi borcu ve onay yok. Alış ekranı temiz yetki mesajı verir; normal oturum silinmez.
- Yetkili İlker16: personel sayımlarını ve belirsiz satırları görür, güvenli exact ürün eşleşmesini inceleyebilir, fiziksel kabul ve alış/ters kayıt yapar. Yeni kullanıcı/rol veya geniş ticari izin verilmedi. Otomatik uygulama oturumu yalnız mevcut TEST konforudur; gerçek kişi hesabı değildir.
- Sabah kullanıcı için **Sayım#5** personel15 tarafından iki satır1/1 kaydedildi, henüz gönderilmedi/stoğa işlenmedi. **Sayım#6** personel15 tarafından0000098765432 ile needs_review olarak kalıcıdır; stok kartı eşleşmeden gönderim/onay kapalıdır. Önceki#3 belirsiz prova ve#4 submitted geçmişi korunur. [Son sayım/immutable kaynak kanıtı](final-safety-counts.json).
- Personel kaydı tekrar giriş sonrası yeniden okunur; source93365d0 düzeltmesi kapanan eski auth/me isteğinin yeni giriş tokenını silmesini engeller. Geçici503/timeout kayıtlı tokenı korur ama doğrulanmamış veri açmaz; gerçek401/403 yine sona erdirir. 27 hedefli session testi ve bağımsız inceleme geçti; [son gerçek tarayıcı kanıtı](browser-58.json).

## Kayıtlı döviz fiyatı

Normal Alış içinde mevcut C09 current-price consumer kullanılır. Seçim USD version7/nativeprice279225 exact1.34567890; native4 yuvarlama1.3457USD. Kayıtlı4Ekim2026 USD40/TRY1 → **53.8280TRY** borç; “bugünün kuru” denmez. EUR version5 fiyat NULL olduğu için seçilemez; mevcut TRY alış quote yok, satış TRY fiyatı yerine geçirilmez.

Gerçek normal UI: kabul38 bekliyor stok31/borç60; fiziksel onay stok32/borç60; kalıcı fatura25092/TDAY-C09-8befaf27e6c3d271553c finalize stok32/borç113.8280; yenileme aynı snapshot; iptal stok32/borç60. Önceki25090/2.2470USD belge ve orijinal40kur değişmedi. [FX SQL öncesi](fx-native-before.json), [kabul](fx-native-accepted.json), [finalize](fx-native-finalized.json), [ters](fx-native-cancelled.json). Üç currentprice/yedi immutableversion/tüm pinnedSQLobjeler ve tarihlikur değerleri birebir aynı.

## Olumsuz durumlar ve muhasebe güvenliği

[Gerçek HTTP role/negatif/paralel replay](roles-negatives-replay-57.json): seller15 receiving/home200, purchase/supplier/FX403; İlker16 yetkili200, salt okunur14 receiving403. Gerçek36724 ve karantina40451/4620LEYLEK write409; belirsiz#3 zorla submit409; nativePOST405. Farklı aktör eski onay/finalize UUID403; aynı yetkili iki paralel exactfullbody replay200 ve SQL stok/borç/journal değişmez. [Önce](native-replay-before-57.json)/[sonra](native-replay-after-57.json). Backend bu son UI session düzeltmesinde değişmedi.

Yeni sayım metadata tabloları, immutable istek günlüğü ve owner readiness/trigger kuruldu. Validate rollback→Apply→replay installed0, negative51210 rollback ve kısıtlı principal testi geçti. Yalnız yeni metadata13exact grant/deny; eski rol/izin/nativeguard hash154B1204BD06F20249AF00C82FA21C79CBDDECD7B7D38FBDF1D29170F1162235 aynıdır. Genel ticari yazma, fiyat kaynağı değiştirme ve eski stok/borç reseti yok.

Gece akışının bu tur başlangıcı17/18ADET, müşteri borcu100TRY/kasa300TRY idi; turun sonunda birebir aynı. Önceki gece tesliminin19/19 değeri yeni başlangıç diye varsayılmadı. CRM/LIVE/Vega/main/terminal/delta/raporlar değişmedi.

## Ana Sayfa ve üç genişlik

Ana Sayfa mevcut hafif summary'yi önce gösterir, Mal Kabul/Alış günlük kayıtlarını ayrı sonraki okuma ile getirir. Sayım#5 devam, #3/#6 stok kartı gerekli ve mevcut alış taslağı gerçek kayıttan görünür; açık onay0 gerçek durumdur. Mevcut satış/tahsilat/ters kayıt özetleri korunur. Kasa açılış bakiyesi/vadeli tahsilat/bekleyen tedarikçi ödeme kaynağı henüz bağlı değildir; sayı uydurulmaz.

Son paket58 üzerinde Mal Kabul/Alış/Tedarikçi/Ana Sayfa **1440/1024/390**:12görünüm, gerçek DOM yatay taşma yok; yeşil tasarım/menu korundu. [Boyut/oturum/kart kanıtı](browser-58.json); personel, bilinmeyen satır, alış, supplier zinciri, HOME ekran görüntüleri bu klasördedir. Fiziksel Zebra/scanner/başka bilgisayar ve insan kabulü yapılmadı.

## Hız

Aynı LAN HTTP, actor16,50ürün, üç tekrar medyanı; eski42 en iyi süreleri bu günün baseline'ı sayılmaz. Yazma işlemleri SELECT hızından daha ağırdır. [53önce](before-53.json), [57ara](after-57.json), [58son](after-58.json).

| Ölçüm (ms) | Önce53 | Son58 |
| --- | ---: | ---: |
| first50 | 628 | 653 |
| next50 | 616 | 686 |
| code | 707 | 593 |
| barcode | 388 | 375 |
| card | 213 | 213 |
| home | 94 | 185 |

Yeni normal bağlantı medyanları: Mal Kabul176ms, Alış313ms, tedarikçi346ms, FX134ms. İlk paket sonrası Mal Kabul isteği2027ms ve FX861ms idi; sonraki örnekler145/176 ve120/134ms. Bu ilk istekler gizlenmedi, tüm ham ölçümler JSON içindedir. Ana Sayfa gerçek ilk kullanılabilir749ms/iş listesi995ms. API gecikmeleri tarayıcı ilk kullanılabilir görünümle aynı ölçüm değildir; browser-58.json HOME ilk kullanılabilir ayrı kaydı içerir. Her modülün tüm verisi Ana Sayfa açılışında yüklenmez.

## Test, GitHub ve kalan

API çekirdek/FX/router, Sites inbound/FX, dar policy/session/HOME/startup ve SQL installer/manifest testleri, offline kalite/build ve bağımsız backend/frontend/SQL incelemeleri geçti. Source93365d0 exact push37435923959/PR37435929646 dört hostedjob SUCCESS. Son belge head CI sonucu [PR23 Checks](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23/checks) üzerinde exacthead ile doğrulanır. Historicale54 sourceRecordKey deterministicC09/tuple gitleaks falsepositive bağımsız SQL kanıtıyla doğrulandı; yalnız tek exactfingerprint ignore ve publicproof alias kullanıldı, genel detector kapatılmadı.

**Kalan:** ERP-UA10/11/12 insan kabulü; gerçek ticari ürünlerle genel operasyon yetkisi/işletme kabulü; fiziksel okuyucu ve diğer ağ cihazı. Beklenen sevkiyat adet kaynağı yok. Ödeme bonusu bağlanmadı: yeni25091/25092 faturaları mevcut test_payment_invoices allowlist'inde değildir; bunu geçirmek için koruma veya kapsam genişletilmedi. Genel banka/kasa, yeni para birimi quote/rate, diğer finish işleri bu turda açılmadı. Finish49/7tamam/24kısmi/18açık değişmez. Bu hedefin dar teknik teslimi tamamlandı; başka işe geçilmez.
