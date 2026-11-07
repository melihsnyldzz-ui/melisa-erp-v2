# K10-02 — Depo hazırlama ve koli kaynak sınırı

Kullanıcının onayladığı dağılımda depo miktar, hazırlama ve koli ile çalışır; fiyat, maliyet ve cari bilgilerini almaz. PR54 kaynak tabanı ve mevcut normal Desktop oturumu/lifecycle motoru kullanıldı. Yeni bir auth sistemi veya eski genel satış yetkilerini depoya verme yolu kurulmadı.

| Yol | Gerekli uygulama hakkı | Etki |
| --- | --- | --- |
| GET `/api/desktop-warehouse/workflows` ve `/:id` | warehouse.view | Belge no/tarih/durum/revizyon, ürün referansları, miktar ve koli |
| POST `/:id/transitions` PREPARE | warehouse.view + warehouse.prepare | Mevcut taslak için rezervasyon/hazırlama |
| POST `/:id/transitions` SAVE_CARTONS / READY | warehouse.view + warehouse.pack | En fazla 100 koli; fiş miktarını aşmadan kayıt/hazır durumu |
| POST `/api/desktop-warehouse/resolve` | warehouse.view + özgün işlem hakkı | Aynı actor/UUID/gövde journal sonucu veya durable no-commit |

Her işlem normal oturuma, güncel kullanıcı/rol izinlerine ve aynı SQL transaction lease'ine bağlıdır. Yalnız V7'de bağlanır. Depo yolu CHECK, CANCEL, DRAFT, DISPATCH veya kesinleşmiş fiş iptalini kabul etmez. Üç işlem stok/cari fiziksel çıkışını kesinleştirmez; PREPARE rezervasyon etkisi yapar. Miktar sözleşmesi mevcut iki ürünlü Desktop profilini korur; ticari fiş miktarını değiştirmez. Depo-only kişinin ürün/müşteri/tedarikçi/finans zengin okuyucularına hakkı yoktur.

Dar SQL mali alanları seçmez. `packages/shared/src/desktopWarehouse.mjs` liste, detay, işlem ve resolver yanıtlarında yalnız sabit alanları kabul eder; mali/cari ek alan, accessor/symbol, yanlış tarih/revizyon, mükerrer/başka ürüne ait/fazla koli reddedilir. Journal replay'de de aynı sözleşme geçerlidir. Hatalar özel SQL/metin/kişi bilgisi yayımlamaz.

Yeni yetkisiz istek UUID veya pending oluşturmadan reddedilir. Gönderilmiş UNKNOWN isteği yeni UUID ile değiştirilmez; actor başına mevcut workflow kuyruğu aynen kullanılır. Depo dışı pending kayıtlar depoda yalnız kapalı bir uyarı olarak görünür. Ayrı finans kuyruğunda yetkisiz eski işlem ayrıntıları gizlenir; byte'ları silinmez ve hakkı geri gelen kişi aynı UUID/gövdeyi tekrar kullanır.

## Kaynak doğrulaması

Birleşik yerel koşuda 93 test, 0 başarısız, 0 skip: ortak sözleşme 6; depo read/resolver VM ve lifecycle 6; eski satış lifecycle 5; logger 25; green core/depo view/workflow client/finance view/controller 51. VM/read/lifecycle fixture'ları sentetik sürücü kullanır, gerçek SQL değildir. Bağımsız incelemede bulunan 101. koli/pending ve eski finans isteğinin görünürlüğü giderildi; logger sabit katalog regresyonu da kapatıldı.

Mevcut gerçek Express + normal auth + sentetik SQL uygulama entegrasyonuna depo login/liste/diğer kart reddi/logout senaryosu eklendi. Gerçek dependency'li route/auth/assembly testleri hosted CI'da ayrıca çalıştırılır; yerel dependency install, junction/loader değiştirme veya build yapılmadı. Exact CI sonucu bu dosyadaki kaynak sayımından çıkarılamaz.

## Kurulum ve gerçek kabul

Kaynak dalı `codex/erp-desktop-warehouse-20261107`, taban `7a8992cc6d9cddd1830960856f8e1b7b7d24f6b3`. Çalışan uygulama ve özgün ödeme oturumu değiştirilmedi. SQL şeması, SQL izin manifesti, mevcut operatörün 19 hakkı, eski hesaplar/rol varsayılanları aynı. Yeni depo hesabı/rolü oluşturulmadı. Şirketin beş rolünün tamamının gerçek kullanımı bu teslimle kapanmaz.

Kalan kanıt: exact hosted CI ve derleme artefacti → tek pasif paket → özgün ödeme penceresi/isteğinin sonucu uzlaştırma → mevcut kurulum sözleşmesine göre app-only geçiş → ayrı yalnız üç depo uygulama hakkı olan sentetik persona → normal ekranla hazırlama/koli/hazır ve retler → ayrı stok/cari/journal/actor/tek etki okuması. Kurulum/runtime, gerçek SQL, GUI, insan kabulü ve LIVE ayrı kalır. Yeni hesap/kurulum için gereken desteklenen yol ve özel erişim somut hedef üzerinde doğrulanır; mevcut hesaplara hak eklemek veya eski SQL guard'larını gevşetmek kestirme yol değildir.
