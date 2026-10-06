# Goal7 — güncel Vega T0 ve karar kapsamı

7 Ekim 2026; yalnız DESKTOP-KSRK0EQ / VEGA2026 SELECT. Kaynak projeksiyonları 00:40:52–00:41:05 Türkiye saatinde iki geçişte sabit çıktı. Ortak atomik snapshot kanıtı yoktur; bu görüntü gerçek T1 kesimi değildir.

T0 SHA256: `a681b7f98003fa1c61dc57bda25f725536849efadc0d823f81c875c4909b53e4`. Kabul edilmiş 30 Eylül RUN06 görüntüsü: `36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400`. Kaynak okuyucusunda sysadmin, CONTROL, INSERT, UPDATE ve DELETE yetkileri yok; 29 tabloda SELECT kanıtı kaydedildi. Vega’ya yazılmadı.

| Alan | Güncel ölçüm | Anlamı |
| --- | ---: | --- |
| Tüm kaynak stok kartları | 53.045 | Katalog kapsamıyla aynı sayı değildir. |
| Aktif kapsam kartları | 11.832 | Gerçek kaynak aktifliği. |
| Pasif ama stoklu kapsam kartları | 4.927 | Silinmez veya aktif yapılmaz. |
| Ürün kapsamı | 16.759 | Ek 13 kartın miktarı belirsiz, ayrı incelemede. |
| Yeni / değişmiş / kayıp ürün | 86 / 752 / 0 | Yeni84 ve değişmiş748 mevcut kapsamda. Eski71/341/74 tarihsel. |
| Miktarı değişmiş mevcut ürün | 731 | 563 güvenli miktar atomu; 8 insan kararı; 160 aktarılmamalı. |
| Barkod / satış fiyatı / alış fiyatı farkı | 9 / 43 / 66 | Ham kaynak farkları; uygulanmış kart/fiyat sayısı değildir. |
| Maliyet değeri / kanıt bağı farkı | 21 / 30 | Yerel native maliyet üzerine otomatik yazılmaz. |
| Tüm / kapsam cari | 950 / 894 | Kapsam399 müşteri ve495 tedarikçi. |
| Değişmiş müşteri / tedarikçi | 29 / 56 | Yeni veya kayıp cari yok. |
| Kart ana bakiyesi / hesap modeli değişikliği | 82 / 85 | Kart BAKIYE anlamı doğrulanmadı; finans deltası uygulanmaz. |

## Güvenli kapsam ve korunacak kayıtlar

563 miktar atomunun 45’inde daha önce oluşmuş yerel Melisa hareketi bulunuyor. Yeni stok kaynak farkı + mevcut native stok biçiminde hesaplanır; 321 NULL maliyetli kartın maliyeti NULL kalır. Kimlik, tekil alias/barkod, ADET×1, tam before-image, native defter eşitliği ve karantina kontrolü gerekir. Negatif kaynak miktarı veya üçüncü basamaktan sonra sıfır olmayan stok miktarı uygulanmaz.

Kart/fiyat için ayrı sürüm sözleşmesi 49 yeni ürün ve 12 gerçek native farkını ayırdı: 241 fiyat ekleme,16 fiyat güncelleme,0 fiyat kaldırma. Yeni kartlardan20’sinin net kesinleşmiş alış/birim/tarihsel kur kanıtı mevcut;29 maliyet NULL. Mevcut kart maliyeti ve stok miktarı bu ikinci writer tarafından korunur. Kozmetik sayı/metin gösterim farkı ticari değişiklik sayılmaz.

54 ürün,28 müşteri,94 tedarikçi olmak üzere176 eski kaynak hold korunur;172 mevcut hedef kartı ve hedefi bulunmayan4 tedarikçi ayrımı değişmez. Bu rapor hold çözmez. Özel STOKTIPI anlamı doğrulanmayan20 kaynak kartı ayrıca listelendi; normal stok veya hizmet kartı olduğu tahmin edilmedi.

## Ayrı döviz hesapları ve maliyet

Kabul edilmiş772 cari /785 native döviz hesabı baseline’dır. Güncel kaynağın910 hesap modeli bu sayıyla aynı kapsam değildir: müşteri TRY49/USD313/EUR43/tanınmayan2; tedarikçi TRY363/USD140/EUR0. Kaynakta hareketi bulunan420 hesap ise TRY169/USD220/EUR29/tanınmayan2’dir. Kart ana hesabından sıfır hesabı üretilebilen durumlar ve bilinmeyen bakiyeler ayrı kanıt alanlarında saklanır; sayılar yeni aktarım değildir.

Müşteri kaynak borç−alacak işareti ve tedarikçi için ters Melisa işareti doğrulanmış hareket örnekleriyle kaydedildi. Kart BAKIYE ile hareket defterinin para birimi/temsil zamanı eşit kabul edilmedi. 276 sayısal ayrılık yalnız tanı bulgusudur; zorla eşitleme veya döviz birleştirme yapılmaz. LL ve satış fiyatındaki `$2` kodu bilinmiyor kalır.

Güncel ürün kapsamında10.650 maliyet bilinmiyor; miktarı belirsiz13 kartta ek12 bilinmeyen maliyet var. Kabul edilmiş hedef kartların güncel native maliyetinde10.549 NULL ölçüldü; eski açılıştaki10.552 ile aynı tarih/ölçüm değildir. 9.305 kaynak alış fiyatı alanının dövizi doğrulanmadı. Liste alış fiyatı maliyet değildir; boş para birimi TRY sayılmaz.

## Melih’in karar paketi ve gizlilik

Tam müşteri/tedarikçi/bakiye/telefon/vergi listeleri public Git’e konmadı. Yerel private ACL paketinde müşteriler, tedarikçiler,54 hold ürünü, barkod sahipliği, birim, özel kart, LL/fiyat dövizleri ve yönetilebilir maliyet öncelikleri bulunur. Eski hold dışındaki78 değişmiş cari için ayrıca iş anlamı kararı istenir. Çıkış hareket sıklığı satış sıklığı diye sunulmaz; maliyeti bilinmeyen stok için değer uydurulmaz.

Son kullanıcı karar raporu SHA256: `9fb08aa63293504c070de62f3513501d37e9fbd1d31f40460ce3874ed6078a20`. Tam ürün/cari JSON’larında kaynak anahtarı, payload hash, nedenler, before-image/ownership kanıtları ve GREEN/YELLOW/RED sonucu tutulur. Teknik okuyucu ihtiyacı insan kararı engeli sayılmaz. Uygulama, replay, mutabakat ve committed rollback sonucu ayrı teknik teslim kaydında raporlanacaktır.

Gerçek T0/T1 ve Vega READ ONLY yalnız [prosedürdür](goal7-cutover-archive-plan.md); bu turda gerçek cutover veya Vega yetki değişikliği yoktur.
