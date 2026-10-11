# Normal Ana Sayfa okuma hatası — 12 Ekim 2026

Aynı ERP-COMPLETE01 tesliminin dar regresyonu. Yeşil tasarım, veri, roller ve ticari hesaplama değişmez. Yeni kullanıcı kararı, genel migration veya ayrı ana görev değildir.

## Canlı neden

Çalışan uygulama4b08fdc / DB02 / actualT1=false üzerinde mevcut normal dedicated aktör15 (`isolated_test_sales`) kullanıldı. Aynı oturumda:

| Okuma | HTTP | Güvenli sonuç |
| --- | --- | --- |
| API4184 `/api/home-summary` |404|`NOT_FOUND` — route yok|
| API4184 `/api/home/summary` |200|Geçerli HOME DTO; satış/mal kabul available, finans mevcut rol gereği forbidden;1 iş|
| WEB5234 `/api/terminal-worktest/home-summary` |404|`WORKTEST_SCOPE` — proxy yanlış upstream'e gidiyor|
| API4184 müşteri kartları |200|Mevcut kayıt okuması çalışır|

Bu genel SQL bağlantısı kesintisi veya yetki eksikliği değildir. Source `homeSummaryRoutes.mjs` `/home/summary` tanımlar ve `/api` altına bağlanır. Persistent reader yanlış `/api/home-summary` kullanıyordu. Gerçek normal yeşil tarayıcıda mevcut İlker16 oturumu da aynı HOME hatasını ve hata bittikten sonra kalan "Bilgiler açılıyor" kartlarını gösterdi. Mevcut sekme/taslaklar değiştirilmedi; kontrol yeni sekmededir.

## Dar düzeltme

Persistent proxy yalnız kayıtlı `/api/home/summary` GET'e bağlandı. Eski yol alias yapılmaz; body/cookie/query/host/method/actor/role/readonly-native sınırları genişlemez. Ana Sayfa kartları hata sonrası loading yerine okunamadı der; gerçek boş kayıt, forbidden bölüm ve yükleniyor ayrı kalır. Teknik endpoint/debug bilgisi kullanıcı ekranına eklenmez.

Root23/23 hedefli kontrol ve bağımsız23/23/reviewGO. Regression gerçek route dosyasından canonical path çıkarıp proxy ile bağlar; eski404hedef/nofetch, oversize, unauthorizedactor/method/origin, failure→retry→empty→403refresh ve stale-data korunur.

## Çalışan teslim ölçütü

Uygulama source **204b63f9c618c44ebd630e3f0c37167425ec1c51**, immutable paket `CANONICAL-COMPLETE-TEST-20261011-204b63f`, manifest SHA256 `b24be9ead4d9c7670f5b1f79a42f086e767d0bf493eb85341fdaae944bb0006d`:1828 dosya doğrulandı. Mevcut normal logon görevleriyle DB02 API4184/native4186/web5234 etkin; CRM09ca/native-order60e kaynakları aynı.9 sunulan web/terminal asset byte eşit,40 korunan süreç ve mevcut koli journal aynı. Normal aktör15 login→refresh→me→logout→401 tamam; kullanıcıdan giriş veya parola istenmedi.

API4184 eski yanlış yol404 kalır; canonical HOME200/~3349ms ve LAN5234 proxy200/~3209ms, müşteri kartları200/~3468ms. Geçerli gerçek public bootstrap + production `validateWorkHome` sözleşmesi normal15 DTO'yu kabul etti. İlk özel Node doğrulama denemeleri tarayıcı bootstrap'ı yüklenmediği için reddetti; aynı helper gerçek public bootstrap'la düzeltildi, uygulama kontrolü gevşetilmedi. Bu gözlem hız hedefini kanıtlamaz; yaklaşık3,2sn HOME okuması ayrı performans açığıdır.

[Normal Ana Sayfa](http://192.168.1.46:5234/ornek-akis.html#home), mevcut İlker16 oturumunda gerçek tarayıcıyla açıldı. Yenile→müşteri listesini aç→İş Sırası'na dön turunda oturum aynı ve HOME yeniden okundu. İş günü09.10.2026 ile12.10.2026 son okuma ayrıdır; tarihli izole TEST kayıtları güncel Vega bakiyesi değildir. TRY/USD/EUR ayrı; kasa açılışı bağlı değil, tutar uydurulmaz. Generic mal kabulü işi inbound merge sonrası `İşlem ekranı henüz hazır değil`/disabled kalır; hızlı Mal Kabul bağlantısı açıktır. Bu route düzeltmesi bütün günlük görevlerin bağlantılarını tamamlandı saymaz.

Private `home-before-safe.json`, `home-after-safe.json`, `home-runtime-proof.json`, `home-ui-safe.json` ve `home-screen-20261012/{before,after,after-return}.png` root tarafından geri okunarak doğrulandı. Ekran görüntüsü/ham tutar/kimlik GitHub'a alınmadı. Kaynak/build/çalışan paket aynı204; izleyen belge teslim commit'i ayrı kayıttır. Hosted CI sonucu son head push sonrasında doğrulanır; yerel23 kontrol veya build hosted PASS değildir.

Özel HTTP sayımları ve ekran görüntüleri mevcut private evidence içinde; ham cari/tutar/token/credential GitHub'a eklenmez. TEST125/LIVE/Vega/T1/CRM/veri/roller/UA32 korunur. 200 ürün cihaz kontrolü ve son koli videosu önceki politika engeliyle açık kalır; bu HOME düzeltmesi onları PASS yapmaz.
