# ERP-NIGHT01 — 6 Ekim2026 normal satış ve tahsilat teknik teslimi

TEST53 / uygulama kaynak 11f17341dc69002aed8c249878c468058afc8da5; normal http://192.168.1.46:5194/ornek-akis.html. Gerçek ticari kartlar salt okunur; yalnız iki ayrılmış sentetik ürün, müşteri ve TRY kasa yazılabilir. Tarih 2026-10-06, en çok30 immutable işlem, miktar üst sınırı5 ve belge üst sınırı500TRY; diğer döviz/gerçek kartlar bu yazma kapsamına açılmadı.

İnsan kabulü ERP-UA07/08/09 bekliyor. Gerçek SQL’e sentetik prova yapılmıştır; bütün ticari ürün/müşteriler, USD/EUR yazmaları veya fiziksel terminal hazır iddiası yok. Başlangıç01:41:41İstanbul; en geç09:41:41. Hedef erken tamamlandı; bu kapsamda duruldu.

## Sabah bırakılan kayıt

Belge34619 / NIGHT-ed8f4617514e4b9d9a862db1: seller15 normal ekranda iki literal barkodla150TRY satışı tamamladı. İlker16 aynı normal yüzden50TRY tahsil etti; yenilemede100TRYkalan. İki stok19’ar, müşteri nativeborç100, ayrılmışkasa hareket neti50;15journal/0intent. [Son SQL](native-final-53.json), [İlker](ilker-partial.jpg), [fiş](receipt-final-53.jpg), [müşteri](customer-final-53.jpg), [Ana Sayfa](home-final-53.jpg). Kasa hareket neti genel kasa bakiyesi değildir; doğrulanmış genel açılış kaynağı yok.

## İki ürün, kısmi/tam/ters kayıt ve yanıt kaybı

Belge34618 / NIGHT-4f8eb60e24334ae6901f3f40 normal LAN/source78e6: draft20/20-0borç-0kasa; finalize19/19-150-0. Sunucu200yanıtı CDP response aşamasında bekletildi; istemci timeout/yenileme aynıUUID/body ledger replay200 ile tek etkiyi doğruladı. UI kontrolü aynıPOST’u tekrar gönderir; server immutableledger’ı yeni native etkiden önce kontrol eder. GET-only veya ikinciPOSTyok iddiası yapılmaz. GeçiciFetch patterns boşaltıldı.

50TRYçift tıklamada tek tahsilat→100borç/50kasa/journal8;100kalan→0borç/150kasa/journal9. Bağlı tahsilatta satışiptali409/etki0. Önce100ve50tahsilat tersleri, ardından satıştersi→20/20-0-0/journal12. Native-lan-*.json kalıcı önce/sonra kanıtları; geçmiş silinmez. [Yanıt kaybı](response-loss.jpg), [network](browser-network-51.json), [fullhome](home-full.json).

[Replay negatifleri](replay-negative.json): kaydedilmiş draft/finalize/collection/cancel aynıUUID/body replay200; aynıUUIDparalel tekrar tek etki; farklıamount409, realproduct PREVIEWONLY409, USDpreview409. [Önce](native-before-replay.json)/[sonra](native-after-replay.json) birebir sentetik native değerleri; gerçek ticari kartta yazma denemesi0. Son53 aktif tahsilat409 temiz kullanıcı mesajı ve SQL fark0; [engelleme](blocked-cancel-53.jpg).

## Rol, kaynak ve görünüm

[Rol matrisi](role-boundaries.json) mevcut seller15 create/finalize/cancel; financefalse/accountsboş/preview403. İlker16 collect/cancelcollectiontrue, salefalse. Roller/grants/auth tabloları değişmedi. Manuel seçim autoTESTADMIN’e yükselmez. Gerçek8023CONCEPT readonlyfoto/stok0ADET/barkod3617221176192/USD15,78 ve kaynakTRYkademeleri okundu; gerçekEkle yok. NULL→bilinmiyor,0→0, leadingzeros/fullSTOKKODU/currency-tier korunur; satışfiyatı fotoğraftan çıkarılmaz.30Eylül snapshot + güncel nativeTEST, güncelVega delta değil.

[1440/1024/390](responsive.json) satış/tahsilat/müşteri/home taşmasız DOM; son53readonlykart ek kontrolü [responsive](responsive-final-53.json). Yönetilen ekran görüntüsü görünür alanı kısmen kesebilir; gerçekCSSviewport ayrı ölçülmüştür, clip kullanılarak genişlik kabulü uydurulmadı. Fiziksel Zebra/başka cihaz/insan kabulü yok.

## Hız

| Ölçüm (ms, 3 örnek medyanı) | Gece49 önce | Son53 sonra |
| --- | ---: | ---: |
| first50 | 755 | 663 |
| next50 | 692 | 593 |
| code | 679 | 636 |
| barcode | 420 | 369 |
| card | 188 | 196 |
| home | 94 | 134 |

Baseline49 ve son53 aynıLAN/actor16/page50/3örnek/sıra; ağır SQL/hash/build ile paralel ölçülmedi. [Ham önce](baseline.json), [ham sonra](after-53.json), [okuma açılışı](opening-53.json), [gerçek roller kayıt süresi](browser-real-roles-52.json). Seller taslak2115/finalize2616ms, İlker kısmi902ms; preview156/195ms. Önceki51partial858/full587ms. Bunlar gerçekHTTPişlem süreleri, kullanıcı ilkboya süresi değildir. Eski42best güncel sayı olarak sunulmadı.

## Kontrollü SQL, paket ve geri dönüş

[Validate](sql-validate.json) transaction kurulum+düşük yetkili okuma+rollback; orijinal operationalfingerprint/kullanıcı-permission/metadata geri döndü. IDENTITY sayaçları ilerleyebilir, reseed yok. [Apply](sql-apply.json) yalnız ikiSKU/müşteri/TRYhesap/fiyat fixture; yeni ticari DB/blob yok. [9negatif](sql-negatives.json), [eskiokuyucular](legacy-readers-after-setup.json). Native/karantina guards kapatılmaz. Kurulum metadata guard’ları outertransaction sürüm değişiminde geçici kapatılıp fixture/ownerready öncesi yeniden açılır.

İlk50nativewrite503 caller SQLmetadata görünürlüğünden kaynaklandı; [visibilityValidate](sql-visibility-validate.json)/[Apply](sql-visibility-apply.json) yalnız tekrarlanan caller kopyasını kaldırdı. Aynı37FIRST/176kaynak/172hold/16622ürün/15-17-22bütünlük kontrolleri bağımsız3pinli OWNER-ready’de korunur. Dokuz legacyguard gövdesi korunur; grant/seed/gerçekbusinesswrite yok. İlk LAN UUID/getRandomValues ve blur/input yenidençizim kusurları gerçek provada bulunup giderildi. Kaynak53yalnız readonly alanları ekledi;24Trade+20Session hedefli ve bağımsızreview temiz, önceki530Sites/393APIoffline/SQL-store-suite6+8PASS.

Son [TEST53switch](runtime-switch-53.json):source11f17341dc69002aed8c249878c468058afc8da5 / C:\Sirket\ERP\releases\CANONICAL-NIGHT-TEST-20261006-53;1384manifest/16977dependencies doğrulandı. API4144/web5194exactloopback+192.168.1.46, native4146loopback. NamedTESTDB/sysadmin0/control0/LIVE0/externalfalse; LIVEowners/privateconfig/OSağ değişmedi. Eski49–52ve launcherrollback yedekleri korunur. Paket geri alınabilir; SQLhistory drop/restore/silme veya ticari kaydı resetlemek rollback değildir.

Uygulama11f1734 CI37393631906/37393627404 SUCCESS. Son belge teslimi ayrı PRhead; exactheadCI PRChecks’te ayrıca kontrol edilir. [DraftPR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23), branchcodex/erp-finish-20261004; main merge/tag/LIVE/CRM/Vega/delta/fotoğraf yok. Önceki50/51/52kanıtları tarihsel sürümlerini açıkça taşır; bugünkü53paketiyle karıştırılmaz.
Son53 manuel İlker oturumu TEST restart sonrasında yeniden mevcut hesapla giriş istedi; manuel seçim otomatik TEST ADMIN'e yükselmedi. Yeniden giriş ve sonraki sayfa yenilemesinde İlker,150TRYfiş/50tahsil/100kalan korundu. Müşteri kartı listesindeki deneme açılış hesabı projection'u doğrulanmış kaynak bağı olmadığından Bilinmiyor kalır; üstteki100TRY bakiye ve hareket tarihçesi doğrudan native gece işlemlerinden okunur. Bu iki kaynak birleştirilip tahmin yapılmadı.
