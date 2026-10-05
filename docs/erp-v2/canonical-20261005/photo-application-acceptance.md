# ERP-D04 — merkezi fotoğraf uygulaması ve teknik kabul

2026-10-05. Kullanıcı ERP-UA03 ile D03 eşleme planını kabul etti; ERP-DEC-008 açık talimatıyla yalnız 3.830 CONFIRMED kayıt TEST'e uygulandı. **Teknik kabul PASS; yeni fotoğraf ekranının insan kabulü ERP-UA04 bekliyor.** CRM/LIVE/main merge/diğer finish işi yapılmadı.

## Gerçek uygulama

- 3.830 ayrı ürüne 3.830 fotoğraf bağlandı; 67 belirsiz dışarıda, 4620 LEYLEK/40451 hold:true ve fotoğraf missing kaldı. Tüm manifest kayıt SHA: `5da967d2652aa0d6710ad206ac10b7a5898d5a8af7ff3f45e048669e15d22b6d`.
- Merkezi medya: `C:\Sirket\ERP\data\TEST-20260929-01\catalog-media`. Immutable orijinal kopyalar ve 128px thumbnail / 768px preview; SQL blob ve yeni ticari ürün DB'si yok. Ürün/kaynak kimliği, medya reference, kaynak adı/SHA ve doğrulama metadata'sı yerel `index.json` içindedir. Desktop veya sürüm klasörüne runtime bağımlılığı yok.
- Tüm 3.830 kayıt için kopyadan hemen önce mevcut tam korumalı API exact ID/kod/kaynak/run/accepted/hold:false ve kaynak SHA yeniden doğrulandı. İlk denemede 8 HTTP503 nedeniyle hiçbir index yayımlanmadı; izleyen tam 3.830 kayıt yeniden kontrolü, sınırlı 503 tekrarları ve iki işçiyle 0 ret tamamlandı. Hash/kimlik/yetki sapmaları tekrar deneme veya bypass değildir.
- Bağımsız kontrol 3.830 source→copy SHA eşitliği ve tüm 11.490 medya nesnesinin hash/format/boyutlarını doğruladı. Index SHA `9b23a6c45d948ef16228d7ab676fb7db9764817c5fd43619b666200b085be042` mevcut private TEST config'ine bağımsız pin olarak girildi; index kendi beyanıyla güvenilir sayılmaz.
- Arşivin 3.902 dosyasının ad/boyut/SHA/NTFS değiştirilme zamanı ilk D03 envanteriyle aynı; 3.897 orijinal fotoğraf + 5 yan dosya korunmuş. Fotoğraf bytes'ları GitHub'a eklenmedi.

## Normal çalışma yüzü

[Ürün & Stok](http://127.0.0.1:5194/ornek-akis.html#stock), varsayılan 50 ürün. Liste yalnız mevcut sütunları/metadata'yı getirir ve hiçbir fotoğraf isteği yapmaz; kart açılınca Bearer oturumuyla bounded preview alınır ve Blob URL görüntülenir. Original veya thumbnail liste açılışında indirilmez. Eksik fotoğraf temiz “Fotoğraf henüz bağlı değil” durumunda; teknik TEST/debug/migration metni eklenmedi, eski migration notu kaldırıldı. Yeşil ekran yapısı korunur.

Her metadata/medya isteği mevcut full guarded SQL okuyucusu, güncel DB+HTTP product.view ve hold/kimlik denetiminden geçer; fiyat alanında güncel sales.view gerekir. İzin, ticari veri veya SQL guard sonucu cache'e alınmaz. Binary sunulurken güvenli yol ve dosya SHA yeniden kontrol edilir; JPEG MIME, nosniff, private/no-store.

| Gerçek normal ekranda açılan zorunlu örnek | ERP ID | Sonuç |
| --- | --- | --- |
| 8023 CONCEPT | 36724 | Gerçek kart fotoğrafı / kaynak ve sunulan önizleme SHA doğrulandı |
| 0161 MOLLY | 34765 | Gerçek kart fotoğrafı / kaynak ve sunulan önizleme SHA doğrulandı |
| 0205 NAYİNOM | 38919 | Gerçek kart fotoğrafı / kaynak ve sunulan önizleme SHA doğrulandı |
| 11025 ACABELLA | 37893 | Gerçek kart fotoğrafı / kaynak ve sunulan önizleme SHA doğrulandı |
| 1071 ADN | 31099 | Gerçek kart fotoğrafı / kaynak ve sunulan önizleme SHA doğrulandı |
| 10076 AGUCUK | 38764 | Gerçek kart fotoğrafı / kaynak ve sunulan önizleme SHA doğrulandı |
| 2532 AMANTE | 34225 | Gerçek kart fotoğrafı / kaynak ve sunulan önizleme SHA doğrulandı |
| 10012 BABUSH | 32775 | Gerçek kart fotoğrafı / kaynak ve sunulan önizleme SHA doğrulandı |
| 2401 BABY AURA | 32811 | Gerçek kart fotoğrafı / kaynak ve sunulan önizleme SHA doğrulandı |
| 4607 BABY ROSE | 40766 | Gerçek kart fotoğrafı / kaynak ve sunulan önizleme SHA doğrulandı |

Rastgele, tekrarsız 20 CONFIRMED ürün aynı normal ekranda açılıp resim yükleme/doğru kart kimliği doğrulandı: 243299 NECİXS (38091); 9828 MURAT BABY (33952); 10579 MURAT BABY (35525); 7793 CONCEPT (35244); 8976 MURAT BABY (31715); 3990 BEBESSİ (40296); 2531 NAYİNOM (32031); 3814 MY MİO (30852); 2821 TİVİDO (34970); 4643 LEYLEK (35041); 5126 BABY ROSE (34618); 3816 MAİBELLA (40149); 7868 BABY ROSE (40772); 4615 MY MİO (36848); 8951 MURAT BABY (31665); 7269 CONCEPT (32477); 4196 MY MİO (38536); 4075 BABY MY (31892); 10383 MURAT BABY (29902); 243381 NECİXS (39173).

Belirsiz ekran örnekleri: 11361 ACABELLA/41111,11381 ACABELLA/41110,4047 BABY MY/31737,4620 LEYLEK/40451. Tümü fotoğraf missing, görüntü endpoint404; 4620 hold:true. Bütün 67 belirsiz adayın medya indeksinden dışlandığı doğrulandı; belirsizleri çözme çalışması yapılmadı.

API kabulü: 10+20 gerçek ürün, her birinde thumbnail/preview binary SHA ve bounded boyut,8023 original SHA;4 belirsiz ve5 negatif endpoint. Anonim401, yanlış variant/ek path400, fixture404, merkezi static index404. Mevcut kullanıcı14 ve15 fotoğrafı mevcut ürün görüntüleme izinleriyle okuyabildi; yeni izin verilmedi. İzin reddi ve fiyat yetkisi ayrımı kaynak birim testlerinde korundu. 8023 ERP satış fiyatı **15.78000000 USD**; fotoğraftaki16,90USD baskı ERP fiyatı sayılmadı.

## Performans

Aynı İlker16 oturumu, aynı beş gerçek API isteği, her biri üç tur HTTP yanıt+JSON okuma medyanı; fotoğraf binary istek süresi kart metadata ölçümüne dahil değildir. Önce paket40/source df3de9054cbeb80419976cede6a26f12b1c16e94, sonra paket42/source956fc328e08626f010f23183f4eae1003f60057a. Fotoğraf alanı hariç bütün dönen verilerin SHA'sı her tur eşit: ürün/stok/barkod/fiyat/para birimi/hold/provenance değişmedi;16622accepted+54hold,fixture0.

| İstek | Önce / medyan | Sonra / medyan |
| --- | --- | --- |
| İlk 50 ürün | 460 ms | 397 ms |
| Sonraki 50 ürün | 352 ms | 328 ms |
| 8023 CONCEPT kod arama | 526 ms | 431 ms |
| 01240465102508 exact barkod | 190 ms | 191 ms |
| 8023 ürün kartı (metadata) | 185 ms | 170 ms |

Önceki ilk tur liste 1022 ms örneği ve yeni servisin başlangıcından hemen sonraki medyanlar (ilk50:658 / sonraki50:581 / kod:653 / barkod:298 / kart:341 ms) ayrı JSON kanıtında korunur. İlk ölçüm daha yüksekti; gerçek ekran denemelerinden sonra aynı beş istek, kaynak değiştirilmeden yeniden ölçüldü. Yukarıdaki tablo bu ikinci üç turun kullanım medyanıdır. Süreler sabit bir garanti değildir. Gerçek tarayıcıda ilk/sonraki50, kod ve başında sıfır olan barkod da doğrulandı; listede fotoğraf isteği 0. Ortalama thumbnail 3.551 byte, preview 73.110 byte; orijinal kopyalar toplam 1.260.226.118 byte. Başlangıçta bütün medya yolu ve hashlerinin doğrulaması 26.599 ms; HTTP hazır olmadan tamamlandı. ERP launcher 360×500 ms bekleme ve HTTP denemeleri bütçesi kullanır, native/web eski 30 denemeyi korur; başarısızlıkta yalnız yeni başlatılan süreçler kapatılır.

## Paket / teslim / geri dönüş

- Aktif TEST: `C:\Sirket\ERP\releases\CANONICAL-CATALOG-MEDIA-TEST-20261005-42`, source `956fc328e08626f010f23183f4eae1003f60057a`, package `CANONICAL-TEST-956fc328e086`; web5194/API4144/native4146. 1.281 manifest dosyası, 16.977 hazırlanan bağımlılık ve 1.238 kaynak dosyası bağımsız doğrulandı. Paket41 hazırlanıp çalıştırılmadı; paket42 ilk build hazırlığının kalıntısı ayrı tutuldu. Eski sürümler değişmedi.
- SQL: Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01. Sysadmin, database control ve LIVE DB erişimi 0; dış işlemler kapalı, native salt okunur ve writes:false. SQL/procedure/index/ticari tablo/migration yazması yapılmadı. LIVE5188/4114/4116 süreç sahipleri aynı.
- Private config'e yalnız `catalogMediaRoot` ve `catalogMediaIndexSha256` eklendi; eski değerler aynı. Exact config yedeği kendi özel config dizininde kalır, kaynak veya PR'ye girmez. Geri dönüşte launcher40 ve config birlikte alınır; TEST süreçlerinin PID, oluşma zamanı ve exact yolu doğrulanır, bilinmeyen sahibine dokunulmaz. Merkezi nesneler/indeks ve eski paket korunur; SQL rollback gerekmez. Geri dönüş yolu bağımsız incelendi, sırf prova için eski pakete dönülmedi.
- Kaynak dalı `codex/erp-finish-20261004`; uygulama `d706f065d8a833825906062b7439ca2ba32fdca9`, güvenli tekrar/başlangıç düzeltmesi `956fc328e08626f010f23183f4eae1003f60057a`. [Draft PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23). Uygulama commit'i push37322571029/PR37322585058 quality+secret dört job SUCCESS. İzleyen belge head'i çalışan paket değildir; son teslim/CI PR head üzerinden izlenir. 53 hedefli API/importer/UI/session testi PASS; bağımsız kaynak/paket/geri dönüş incelemesi PASS.

## Kanıt ve insan denemesi

Temsilci gerçek tarayıcı 8023 GET süreleri: arama 592 ms, kart metadata 272 ms, preview 274 ms / 55.347 transfer byte. İlk ve sonraki50 sayfanın ağ kaydı tam ve fotoğraf isteği 0; 30 kartın tamamı için yüklenmiş DOM resmi ve bağımsız API binary hash kanıtı var. 30 işlemin ilk ağ olayları tampondan düştü; bütün işlemlerin network trace'inin saklandığı iddia edilmez. Yeni alınan temsilci kart ve sayfalama ağ kayıtları eksiksizdir.

Repo dışı kanıt dizini `C:\Sirket\ERP\evidence\ERP-PHOTO-APPLY-20261005`: ilk/son uygulama, bağımsız medya doğrulaması, orijinal arşiv değişmezliği, başlangıç kontrolü, paket geçişi, before/after ve ilk başlangıç ölçümleri, gerçek API/rol/tarayıcı kabul JSON'ları. Bunlar secret içermez; private config yedeği burada veya GitHub'da değildir. Ekran görüntüleri yerel Codex outputs'ta; fotoğraflar ve merkezi indeks GitHub'a toplu yüklenmedi.

ERP-UA03 PASS, ERP-D03 tamam. Yeni ekran ERP-UA04 denemesi: birkaç zorunlu ürün kartında fotoğrafı aç; fotoğrafsız/belirsiz kartta placeholder; 8023 ERP fiyatı15,78USD; 50'li sayfa/arama hızlı; fotoğraf yeşil ekranda okunabilir. Ajan teknik PASS insan PASS değildir. ERP-D04 teknik hazır; kullanıcı kabulü bekliyor, A03🟡. **Bu görev sonunda duruldu; CRM/ERP-D05 veya başka finish işi başlatılmaz.**
