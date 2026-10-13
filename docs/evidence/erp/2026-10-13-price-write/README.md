# ERP04 / C09 — normal ürün fiyatını sürümlü kaydetme

Durum: **uygulama sürüyor; çalışan fiyat yazıcısı henüz teslim edilmedi**.
Ana kapsam ERP-COMPLETE01 / ERP-DEC-050/053/054/055; PR #23.

## Sıra ve bağımlılık

ERP09 profil-hash alt teslimi `2bf2762`, belge teslimi `def5873` korunur.
Kalan okuma maliyeti için mevcut native profil ve sorgu planı kanıtı incelendi.
Eski sorgu planı adayı, mevcut V11 owner/context/intent ve bootstrap hash
zincirine doğrudan uygulanamaz. İki predicate'i değiştirmenin ötesinde bağlı
modüllerin birlikte sürümlenmesi ve güncel olumsuz kontroller gerekir.
Bu incelemede SQL, runtime veya kaynak performans kodu değiştirilmedi;
aynı benchmark/prova tekrar edilmedi. ERP09 açık kalır.

Onaylı sıradaki ERP04 için mevcut C09 fixture koruması kaldırılmadan ayrı
DB02 fiyat sürümü hazırlanıyor. Mevcut kaynak fiyat satırı, kaynak bağı,
profil mührü ve eski belgeler değişmeyecek. İlk alt kapsam yalnız doğrulanmış
mevcut satış fiyatı tuple'ıdır: ürün + kaynak fiyat kimliği + birim + kademe +
döviz. Yeni tuple, maliyet, alış fiyatı veya yeni rol izni eklenmez.

## Tamamlanma koşulları

- Güncel native aktör/yetki, ürün ve karantina kontrolü; ayrı kayıtlı TEST
  yeteneği olmadan genel fiyat yazması kapalı.
- Kaynak hassasiyeti korunarak sekiz ondalık saklama; NULL bilinmeyen,
  gerçek sıfır ayrı; kaynağa sessiz geri düşme yok.
- Değişmez sürüm ve istek geçmişi; aynı UUID/body ikinci sürüm üretmez;
  farklı body veya eski güncel sürüm çakışması reddedilir.
- Yeni satış güncel izinli fiyat sürümünü; eski belge kendi kayıtlı fiyatını
  okur. Yalnız metadata kaydetmek veya API eklemek bu işi tamamlamaz.
- Bağımsız native kanıt, normal ürün kartı, ilgili hedefli testler, çalışan
  paket ve uzak GitHub teslimi ayrı ayrı doğrulanır.

Mevcut TEST125/DB02, finans/stok kayıtları, maliyetler, fotoğraflar,
karantinalar ve kullanıcı rolleri korunur. İnsan kabulü bekler.

## İlk kaynak alt teslimi

Fiyat metadata derleyicisi ve native kayıt doğrulayıcısı, API model/store/service
ve normal ekran için henüz bağlanmamış fiyat düzenleyici hazırlandı. 33 hedefli
çevrimdışı kontrol geçti; bağımsız kaynak incelemesi bu kapalı hazırlık için GO.
Yanlış döviz/kademedeki geçmişin ekran başarı sonucu sayılması incelemede
bulundu ve tam tuple karşılaştırmasıyla kapatıldı.

Sentetik derleyici çıktısı SQL Server `PARSEONLY` ile sözdizimi kontrolünden
geçti. Bu kontrolde SQL nesnesi oluşturulmadı ve ticari yazma yapılmadı;
native uygulama, rollback veya tekrar güvenliği kanıtı değildir.

Kayıt doğrulayıcısının `canEdit=false` durumu sürer. API route/startup
bağlantısı, veritabanı kurulumu, satış tüketicisi aktivasyonu, başarılı native
fiyat kaydı/replay, normal ekran kabulü ve yeni TEST paketi **henüz yok**.
Çalışan source `2bf2762` korunur; hazırlık bir çalışan özellik sayılmaz.
