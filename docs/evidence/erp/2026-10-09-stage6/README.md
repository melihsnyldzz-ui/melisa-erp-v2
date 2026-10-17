# ERP-STAGE0601 — otomatik normal ekran kabul incelemesi

9 Ekim 2026 · ERP-DEC-035 · PR23 yorum6076757299. Bu teslim mevcut kayıtların **otomatik ekran gözlemidir**; insan veya LIVE kabulü değildir. Yeni satış, ödeme, tahsilat, stok hareketi, sipariş/taslak, migration, rol veya şema yazması yok. Bu aşama sonunda **DUR**.

## Tek kabul raporu ve gerçek kanıt

Kullanıcıya verilen tek, dosyadan bağımsız açılabilen özel rapor:
`C:\Sirket\ERP\evidence\ERP-STAGE06-20261009\private\report\acceptance-report.html`.

50 gerçek tarayıcı JPEG'i, tarihli DOM gözlemleri ve63 gerçek CDP ekran karesi raporda bulunur. Kare oynatıcısı örneklenmiş/hızlandırılmış gözlem kaydıdır; kesintisiz video iddiası yok. Ticari adlar, tutarlar ve ham ekranlar özel kanıtta tutulur; GitHub'a gönderilmez. 197 gözlenen tarayıcı isteği125GET/72OPTIONS/0POST; izleme kapsamı bütün sunucu trafiği değildir.

| Durak | Codex ekran gözlemi | İnsan sonucu | Gözlemlenen kapsam / kalan |
|---|---|---|---|
| 1 Ana Sayfa | UYGUN | BEKLİYOR | İş günü, mevcut satış/ödeme, TRY/USD/EUR ayrı; gerçek kasa açılışı bağlı değil. |
| 2 Ürün & stok | UYGUN | BEKLİYOR | İlk/sonraki50, tam stok kodu, baştaki sıfırlı barkod, aynı ürüne ait birden fazla barkod, fotoğraf, miktar ve ayrı fiyat dövizi. |
| 3 Mal kabul / alış | UYGUN | BEKLİYOR | Mevcut iki satırlı kabul/fatura ve kaynak bağı; geçmiş/yenileme ve önceki tek stok etkisi bağımsız okunur. Yeni işlem yok. |
| 4 Satış / tahsilat | UYGUN | BEKLİYOR | Normal satış formu ve mevcut iki satırlı fiş/tahsilat, borç-kalan/önceki bakiye ayrımı; fişi tekrar okuma/yenileme. Sepete ürün eklenmedi. |
| 5 Tedarikçi ödeme | UYGUN | BEKLİYOR | Ana TEST eski geçmişi ve kopyadaki ödeme/ters kayıt/sonraki ödeme; tarih/döviz/borç etkisi/yenileme. |
| 6 Sayım / iade | KISMİ | BEKLİYOR | Kaydedilmiş fark/gerekçe/ters kayıt ve alış iadesi görünür; iptal edilmiş sayımın uygulama düğmesi kapalı. Bu düğme mevcut İlker oturumunda görüldü: yeni personel oturumuyla yetkisiz onay denemesi değildir. Fiziksel/personel kontrolü açık. |
| 7 Raporlar | UYGUN | BEKLİYOR | 8–9Ekim özel aralıkta yedi rapor türü; ayrı döviz/kayıt-yok, mevcut zincir ve yenileme. Dar etiket hatası TEST126 kopya webinde tekrar doğrulandı. |
| 8 Zebra | DENENMEDİ | BEKLİYOR | Gerçek cihaz, Wi-Fi, okuyucu, uyku/uyanma ve personel için raporda tek talimat. Masaüstü veya390CSS mobil düzen cihaz PASS değildir. |

Altı durak UYGUN gözlem, bir KISMİ, bir DENENMEDİ; sekizinin insan sonucu bekler. Masaüstü doğal tarayıcı genişliği ve390CSS mobil düzen gözlemlendi. 1440/1024 ölçümlü tekrar iddiası yok; geçici boyut ayarları geri alındı. Mobil geniş tablolarda yatay kaydırma gerekir. Tam sayfa çekiminde sabit başlığın ortada tekrarlanması çekim artefaktıdır; yeni ekran hatası diye kaydedilmez.

## Dar düzeltme ve çalışan paket ayrımı

Gerçekte bulunan sorun: tedarikçi hareket raporunda alış iadesi ters kaydı teknik enum/generic adla görünüyordu. `workReports.js` sözlüğüne mevcut native `purchase_return_cancel` için **Alış iadesi ters kaydı** eklendi; belge ve durum aynı kullanıcı dilini kullanır. Tutar, okuyucu, finans hesabı, API/native ve yetkiler değişmedi. Hedefli8/8 test ve normal/kopya derleme geçti. Yeni kopya ekranında masaüstü/mobil/Yenile sonrası aynı altı satır ve tutar doğrulandı.

| Bileşen | Güncel gerçek durum |
|---|---|
| Normal TEST | TEST125/source`edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d`;5194/4144/4146, aynı paket/süreç/DB. |
| İzole kopya web | **TEST126/source`595621aa82dbdb451e39b02b53105535f8c25e5c`**, yalnızloopback5204. Yalnız sahibi doğrulanmış kopya web süreci değiştirildi. |
| İzole kopya API/native | TEST125/sourceedb3c89,4154/4156; aynı süreçler/DB/roller/özel ayar. |
| Yeni tam paket | `CANONICAL-STAGE06-TEST-20261009-126`,1.585/1.585 dosya SHA eş, standart builder/baseline/kopya build. Bu paketin yeni API/native süreçleri başlatılmadı. |
| Teslim commit'i | Uygulama source595621aa'dan ayrı belge teslim HEAD'i; exact makbuz PR23 teslim yorumunda ve özel rapordadır. |

TEST125'in1.581 manifest dosyası ve manifestSHA değişmedi. Beş eski süreç kimliği/başlama zamanı/source aynı; yalnız bir kontrollü kopya web değişimi vardır. Eski sekmeler yeniden yüklenmedi; aynı origin/rol/oturum korunarak ayrı inceleme sekmeleri kullanıldı. Yeni kopya webde mevcut tedarikçi raporu açılır; normal TEST125'in aynı düzeltmeye yükseltildiği iddia edilmez.

## Yazma yapılmadığının bağımsız kontrolü

İki TEST DB'de32 ticari tablo sayısı ve30 sınırlı tam-satır master/hareket/journal/rol hash grubu, son GUI kontrolünden sonra başlangıçla aynı. Önceki17 günlük kopya isteği ve20 native etki aynı; yeni request/intent/ticari etki0. Deneme kasa etkisi kaynak şirket açılışı sayılmaz. Bu kanıt bütün DB satırlarını veya bütün fotoğraf bytes'ını hashlediği iddiası değildir. Orijinal bağımsız SQL kontrolü mevcut güvenilen Windows yönetici bağlantısıyla **SELECT-only** yapıldı; bu hesap uygulama rolü değildir. Uygulama/native health ve kopya RO izolasyonu ayrıca doğrulandı.

Önceki283+16cari, ürün/stok/barkod/fiyat, maliyet/alış referansı, medya, karantina ve roller yeniden uygulanmadı. Source capture/backup/restore/inverse/replay provası tekrarlanmadı. Vega/LIVE/CRM/main/T1 değiştirilmedi.

## İnsan, cihaz ve LIVE öncesi kalanlar

Kullanıcı ve İlker özel rapordaki tek15–20dakikalık turda her durağa UYGUN / SORUN / DENENMEDİ ve kişi/tarih notu verir. Yeni ticari işlem gerekmez. Zebra gerçek cihazda normal LAN katalog/okuyucu, Wi-Fi, uyku-uyanma ve mevcut personel oturumuyla denenir; yeni erişim veya geniş yetki verilmez. Fiziksel cihaz kontrolü yapılmadan PASS yok. ERP-UA28/UA27/UA18 ve diğer bekleyen insan sonuçları değişmedi.

Önceki18UNKNOWN belge, boyut/hesap bağları, gerçek kasa/banka açılışı0/39 ve gerçekT1 kararları ayrı LIVE engelleridir. Bu ekran incelemesi onları çözmüş sayılmaz. GitHub'ın gözlenen hesap ödemesi/harcama sınırı yüzünden CI adımları başlamıyor; yerel8/8/derleme bunu yeşile çevirmez, Vercel gerekli CI yerine kullanılmaz. Son teslim HEAD kontrollerinin exact makbuzu PR23/private raporda tutulur. Kontroller atlanmaz. Finish49/9🟢/39🟡/1🔴 korunur. **Teslimden sonra duruldu; LIVE/sonraki aşama başlatılmaz.**
