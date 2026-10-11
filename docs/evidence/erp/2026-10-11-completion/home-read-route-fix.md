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

Kaynak teknik hazırdır; yeni immutable paket aktivasyonu, normal mevcut İlker oturumunda HOME+Yenile+müşteri ekranından dönüş ve screenshot/API200 kanıtı tamamlanınca runtime sonucu ayrıca kaydedilecektir. Eski4b package/source hazır fix diye sunulmaz. Sağlıklı canonical HOME ilk okumada yaklaşık4,34sn sürdü; bu hata giderimi hız hedefini kanıtlamaz. Müşteri ilk okuma yaklaşık3,77sn; liste performans araştırması yeniden başlatılmadı.

Özel HTTP sayımları ve ekran görüntüleri mevcut private evidence içinde; ham cari/tutar/token/credential GitHub'a eklenmez. TEST125/LIVE/Vega/T1/CRM/veri/roller/UA32 korunur. 200 ürün cihaz kontrolü ve son koli videosu önceki politika engeliyle açık kalır; bu HOME düzeltmesi onları PASS yapmaz.
