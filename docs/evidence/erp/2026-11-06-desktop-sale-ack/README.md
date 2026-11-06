# Normal GUI: çift tıklama ve gerçek kayıp satış yanıtı

Uygulama kodu/şema/paket değişmedi: kaynak24a087d0, V4 paket8df61546. Mevcut yeni TEST'te ikinci sentetik fiş11 ile eksik kabul denemesi yapıldı. Bu eski başarılı akışı sebepsiz tekrarlama değildir.

1. Normal `erp_deneme` oturumunda müşteri2, ürün8+ürün1 birer ADET ve %3 iskonto:22 brüt/0,66indirim/21,34net. Kaydet düğmesine gerçek `dblclick` yalnız1HTTP POST ve1yeni taslak üretti. Network yalnız kendi satış uç noktası için incelendi; auth başlıkları/kimlik bilgileri okunmadı veya kaydedilmedi.
2. Hazırlama/koli1+1/hazır/sonkontrol tamamlandı. Yalnız fiş11 dispatch POST'unun sunucu201 yanıtı response aşamasında `ConnectionReset` ile kesildi. Preflight OPTIONS204 devam ettirildi. Genel çevrimdışı mod veya güvenlik ayarı değiştirilmedi.
3. UI `UNKNOWN` sonucunu korudu ve yeni satış açmadı. Bağımsız SQL, normal retry öncesinde fiş11 `COMPLETED`, journal `COMMITTED`, bir cari ve iki stok etkisini doğruladı.
4. Normal `Son işlemi doğrula` yalnız1retry POST200 gönderdi. UUID ve tam gövde özgün istekle birebir; ekran `Önceki işlem doğrulandı` ve `Tamamlandı` gösterdi. Yeni satış yeniden açıldı.
5. Özgün %3 taslak POST ve normal durable resolve200 ile aynı geçmiş sonucu döndürdü. Aynı UUID yüzde2'ye çevrilince draft503UNKNOWN/resolve503 verdi; hiçbir yeni etki oluşturmadı.
6. Commit sonrası, GUI retry sonrası ve ek sınır denemeleri sonrası bütün33tablo ve observer metadata birebir aynı. Şema/yetki hashleri sabit; eski fiş10/eski istekler korundu. Fixture etkisi13tabloda, diğer20tablo aynı. Son cari104,32TRY; ürün8stok45, ürün1stok0; fiş11 kâr7,34TRY.

İlk wire verifier yanıtları URL'ye göre topladığı için OPTIONS'u da saydı; aynı HTTP olay kaydı Network requestId ile eşlendi. İkinci UI retry gönderilmedi. `installed-proof.json` bunu ve SQL/hash kontrollerini kaydeder. Sonuç görüntüleri AX/DOM metinleridir; küçültülmüş pencere nedeniyle normal screenshot kabulü iddia edilmez.

Kesinti her durumda `Fetch.enable {patterns:[]}` ve `Network.disable` ile kaldırıldı. Salt bu sekmedeki mevcut kullanıcı/izin kapsamı kullanıldı. Yeni appkodu, rol/grant, SQL servis, DDL veya eski ERP/Vega/ticari veri işlemi yok.

Kurtarma aynı sekmededir; pending durumda reload/relogin denenmedi. İnsan/personel kabulü BEKLİYOR. Merkezi plan/Excel değiştirilmedi. Önceki gerçek A4 fiş10 kanıtı `../2026-11-06-desktop-discounted-sale/` içinde korunur.
