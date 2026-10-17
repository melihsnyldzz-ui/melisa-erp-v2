# Aşama 3 — doğrulanmış ürün alt kapsamı TEST uygulaması

ERP-DEC-032 / ERP-PRODUCTCOMPLETION01, 8 Ekim 2026. Mevcut Goal7 migration motoru, journal/before-image, kaynağa bağlı stok katkısı ve sürümlü fiyat okuması kullanıldı. Genel ürün/veri temizliği, fiziksel mağaza sayımı ve gerçek final T1 yapılmadı. İnsan ERP-UA26 bekliyor; bu dar kapsam sonunda DUR.

## Gerçek uygulama ve ayrı sayılar

| Varlık / işlem | Sonuç |
| --- | ---: |
| Yeni native fiziksel ürün kartı | 72 |
| Güncellenen mevcut native ürün satırı | 310 |
| Bunlar içinde kaynak ana kart alanı değişen ürün | 4 |
| Yeni barkod / doğrulanmış birim bağı | 109 |
| Yeni kartta kesin ADET / 1 ana birim bağı | 72 |
| Ürün-depo kaynak stok farkı | 343 |
| Yeni satış fiyatı satırı | 319 |
| Güncellenen satış fiyatı satırı | 47 |
| Yeni sealed görünümde ürün / typed fiyat (alış + satış) | 16.743 / 64.333 |
| Korunan karantina ile normal katalog | 16.797 |
| Native ticari DML | 1.272 |
| Native alanı değişmeyen grup | 16.356 |
| Bunlardan istisnasız aynı / alan istisnalı | 14.185 / 2.171 |
| Tamamı bekletilen kart grubu | 61 |

310 mevcut satır güncellemesinin stok/fiyat/kart alanları çakışabilir; dört ana kart değişikliği bunun alt kümesidir. Ürün, barkod, fiyat ve ürün-depo sayıları birbirine eklenmez. 16.356 no-op grup bütün güncel alanları tamam sayılmaz. Önceki bir döviz tuple'ı yalnız yeni immutable görünümde superseded; eski native fiyat/geçmiş/açılış/Goal7 sürümleri silinmedi.

## Kaynak ve uygulama anlamı

Kaynak SELECT-only F0102 / D0007 görüntüsü **08.10.2026 20:28:57 Europe/Istanbul (17:28:57Z)**. Ham görüntü SHA256 29fb7de04811c3b229ac1a1685023366ae3efe90cae541e66bb508375987798f; onaylı kapsamın türetilmiş kaynak hash'i 4161d6d90716b69e3c67c165a20fa674b0f0340dbf036233444ef9e39fbd4eee. Plan hash'i f5b1d9c79675b9cf905f050e5961d5dc1f9349f8a1bc328a32395be3ae38a3d6. Ardışık bulk okuma atomik T1 değildir; bu görüntü sonrasındaki Vega hareketleri final geçişte alınacaktır.

53.084 erişilebilir kartın tamamı aktarılmadı. Mevcut kabul edilmiş kimlikler ve aynı fiziksel kabul kurallarını karşılayan yeni kartlar esas alındı. Şirket/tablo/IND, tam stok kodu/ad, KOD1/KOD4 ve kaynak birim/barkod kimliği korundu; isim/model benzerliğiyle birleştirme yapılmadı. Kaynak dönem stok anlamı kullanıldı; takvim yılı filtresi ve ikinci devir toplamı eklenmedi. Doğrulanmış tek depo kapsamında kayıt bazlı kontrol yapıldı; başka depo/birimler tek miktarda toplanmadı.

Stok yazımı A (tarihli Vega stok katkısı) − B (önceki açılış/Goal7 katkısı) farkıdır. Mevcut C gerçek yerel ve D sealed sentetik etkileri ayrı tutuldu. Toplam TEST stoğu kaynak A ile aynı ilan edilmez. Değişen 343 güvenli stok grubunda C/D sıfır, source-effect/defter/kart closure exact; ayrıştırılamayan mevcut etkili ürünün stok alanı değiştirilmedi. Stok farkı alış veya cari borç oluşturmadı.

Satış fiyatı ürün + kaynak birim + kademe + döviz tuple'ıyla exact saklandı. Ana kart göstergesi ana birim/kademe sözleşmesiyle eş; TRY/USD/EUR, NULL ve gerçek sıfır ayrı. Kurdan fiyat üretimi, ikinci iskonto, ücretsiz satış yetkisi veya eski belgedeki fiyatı değiştirme yok. Yeni 72 kartta bilinmeyen alış fiyatı/maliyet/döviz NULL; 59 kaynak kart iskontosu aynen korundu, 13 bilinmeyen NULL. Mevcut iki NOT NULL alış kolonunun yalnız nullable olması kayıpsız dar DDL'dir; eski veri/default/scale değişmedi.

## İstisnalar

61 tam bekleyen grup: 55 eski yayımlanmamış kart (54 mevcut hold dahil), 5 fiziksel tür kanıtı eksik kart ve 1 native kod çakışması. Alan istisnaları: 1.990 negatif kaynak stok için işletme kararı; 185 ayrıştırılamayan stok lineage; 9 fiyat tuple'ında belirsiz döviz; 5 çelişen barkod sahipliği; 1 manuel/kanıtsız eski fiyat çatışması. Bunlar alan/kayıt bazlıdır ve birbirine eklenmez; kesin bağımsız kart/barkod/fiyat alanları ilerledi. Eksik fotoğraf/maliyet güvenli alanların önünü kesmedi. Karantina kullanılmayacak ürün demek değildir; ilgili kart normal listede inceleme bekliyor.

## Kanıt, koruma ve geri dönüş sınırı

Doğru hedef Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01. COPY_ONLY / CHECKSUM yedek, HEADERONLY, fiziksel SHA256 ve VERIFYONLY geçti. **Aktif veya izole DB'ye gerçek restore yapılmadı.** Tek owner SERIALIZABLE transaction, exact CAS, batch hash ve koruma trigger'ları kullanıldı. Post-write hata enjeksiyonundan sonra 1.272 DML, reader yayını ve nullable DDL geri alındı; bağımsız SQL başlangıçtaki 73 koruma kümesini ve native şemayı eş buldu.

Gerçek commit sonrası aynı batch replay: yeni kart 0 / barkod 0 / ikinci stok etkisi 0 / ikinci fiyat sürümü 0. Aynı UUID farklı içerikle reddedildi. Bağımsız SQL bütün 1.272 değişikliği, 16.738 uygulanabilir kimlik/no-op grubunu, 14.563 stok closure'ını ve 16.743 ürün / 64.333 fiyat bindingini doğruladı. Normal API: bütün değişen 382 kart ve iki koruma örneğinde 384/384 PASS; tüm satış birim/kademe/döviz/tutar tuple ve opt-in fiyat okuması kontrol edildi. Tarayıcı sonuçları aşağıdaki özet makbuza bağlıdır.

283 cari/59 finans hareketi, önceki16, iki LL/770 dış kapsam, cari/ürün holdları, 4.338 belge net alış, 6.090 eski maliyet, 3.830 fotoğraf/67 bağlanmamış belirsiz, eski belgeler ve roller korundu. Güncel gövde/kolon hashleriyle mevcut native veriler korunur; yeni fotoğraf aktarımı yapılmadı. R2 ve R3 için dörder ek immutable okuyucu yalnız iki mevcut TEST servis kimliğine EXECUTE; personel yetkisi değişmedi.

R2 kaynak JSON'u 4.000 karakteri aşan 16 ürünün doğrulanmış birimini nvarchar(max) ile okur; güvenlik ve stage/binding kontrolleri kaldırılmadı. R3 SQL'in tam saniyede milisaniyeyi düşürmesini önler; DTO timestamp doğrulaması gevşetilmedi. Önceki r1/r2 module tanımları ve sealed kaynak/veri sürümü değişmedi; bu düzeltmeler ticari DML üretmedi.

**Commit sonrası bütün yeni kart/barkod/fiyat/görünümü kapsayan toplu inverse henüz uygulanmış veya kanıtlanmış değildir.** Eski stok/fiyat inverse aritmetiği ve sonraki yerel hareketi koruyan dar CAS sözleşmesi offline kontrol edildi; bu gerçek toplu geri alma değildir. Yedek/immutable before-image ve atomic rollback kanıtı vardır. History-preserving tam committed inverse ve gerçek kurtarma provası final geçiş öncesinde açık kalır; çalışan TEST'e restore/reset/inverse yapılmadı.

## Normal ekran, hız ve teslim

Normal yüz: http://127.0.0.1:5194/ornek-akis.html#stock; ağdaki mevcut adres http://192.168.1.46:5194/ornek-akis.html#stock. Yeşil tasarım/50 ürün/sayfalama korunur. Normal beş örnekte stok, kademeli fiyat, sıfırlı/çoklu barkod, yeni kart ve boş alan; ayrıca hold ve onaylı fotoğraf kontrol edildi. Yeni satış/fatura/tahsilat oluşturulmadı. Ham ad, tutar, kaynak dosya, fotoğraf ve özel ayarlar GitHub'da yok; private kanıt alanında kalır.

| Okuma | TEST107 önce | TEST113 sonra |
| --- | ---: | ---: |
| İlk 50 | 646 ms | 587 ms |
| Sonraki 50 | 736 ms | 551 ms |
| Kod arama | 532 ms | 552 ms |
| Tam barkod | 339 ms | 340 ms |
| Ürün kartı | 173 ms | 163 ms |
| Fiyat okuması | HTTP 503; okunamadı | 175 ms |

Ölçüm üç ardışık authenticated loopback GET medyanıdır, JSON okuması dahil; ekran paint ölçümü değildir. Eski price endpoint'in 503 sonucu hız başarısı sayılmaz. Belge taraması liste/kart açılışına eklenmedi.

Çalışan **TEST113 / source 63f0a017ec23e89ca9aab7e44acb051f4e86479a**, CANONICAL-TEST-63f0a017ec23, 1.516 manifest dosyası/baselineReproduced true; web5194/API4144/native4146. Bu uygulama source'u son belge teslim commit'inden ayrıdır. Dal codex/erp-finish-20261004 / PR23; uygulama source ve son PR head CI makbuzları STATUS ve PR'de kayıtlıdır. Teknik kontrol insan ERP-UA26 PASS değildir. Finish 49 / 9🟢 /39🟡 /1🔴 değişmez. Bir sonraki aşama genel TEST etkilerinin canlı açılıştan ayrılması ve günlük işlem kapsamıdır; **bu tur başlatılmadı**.

[Makinece okunur teslim ve private kanıt hashleri](delivery-summary.json). Tam kod/önce-sonra örnekler yalnız private expected-five-examples.json ve browser-proof.json içinde. Ayrı deneme ödeme geçmişi panelinin mevcut sorunu korunur; ödeme modülü işi açılmadı.
