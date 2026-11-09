# Normal form için güvenilen çağırıcı

Bu hazırlıkta yalnız kamuya açık modül tanımı CUA ortamına import edilmiştir.
`normalWarehouseFormLogin` çağrılmamış, gerçek sekme alınmamış ve broker çalışmamıştır.
CUA belgesi `Tab.id`, `Tab.url()` ve kullanılan Playwright normal form yöntemlerini
destekler. Yerel dosya modülü importu da tanım yükleme denemesinde doğrulanmıştır.

Gelecekte yalnız mevcut ERP root sahibi aşağıdaki bağları birlikte sağlar:

1. Mevcut koşullu yürütme kararı, aynı öneri hash'i ve tüm önkoşulların gerçek kanıtı.
2. İncelenmiş kodun değişmez, yalnız public modül snapshot'ı. Snapshot'taki üç
   modülün raw SHA256 değerleri, canlı binding'in moduleSha256 kümesiyle aynı olmalı.
   Canonical kaynaklar da tüketici tarafından tekrar pinlenir. Kaynak değişirse
   eski Node modül cache'iyle devam edilmez; yeni incelenmiş snapshot gerekir.
3. Aynı snapshot'tan import edilen tüketicinin gerçek Function.toString hash'i.
   Fonksiyon tek başına toString ile yeniden tanımlanmaz: bağımlılıklarıyla ESM
   olarak yüklenir. Tanım importu bir giriş denemesi değildir.
4. Belgelenmiş API ile alınmış aynı güvenilen tab nesnesi ve onun id değeri.
   Kullanıcı adı, parola tipi, başlık ve düğme güncel normal DOM'dan doğrulanır;
   eski AX sayıları kullanılmaz. tab.id her adres kontrolünün öncesi/sonrasında
   sabit olmalıdır. Sayfa içeriği bağlam nesnesi, fs/cp handle'ı veya callback vermez.
5. Root'un daha önce doğruladığı yerel fs/crypto/childProcess modül handle'ları.
   Public binding ve kaynak/projection/actual proof raw dosya hash'leri root'tan
   gelir. Hiçbiri credential veya private packet içermez.
6. Bağımsız doğrulanmış aktif kullanıcı30007 RV'si; güncel aynı rol/üç hak,
   runtime ve Network.disable sonucu. Auth/login/logout sırasında ağ kaydı kapalı
   tutulur. DOM/header/token/cookie/oturum verisi kanıt yerine çekilmez.

`compileWarehouseNormalFormBindings` yalnız gerçek, güncel public kanıt byte'ları
sağlandıktan sonra 30 saniyelik binding üretir. Hazırlık manifesti bunun yerine
ready=false ve bindingGenerated=false taşır. Hazırlıkta gerçek canlı binding veya
etkinleştirme kanıtı üretilmez. Aynı binding için CreateNew giriş intent'i ikinci
broker çağrısını engeller; UNKNOWN veya ret sonrası otomatik tekrar yoktur.

Consumer yalnız eski dedicated warehouse broker'ını, sabit kullanıcı ve normal
maskelenmiş parola formu için özel pipe ile çağırır. Buffer temizlenir, hata
çıktıları sabittir. Dönüşte normalLoginSubmitted=true, authenticatedSessionVerified=false
bulunur: sonraki normal ekran görülmeden giriş kabulü verilmez.

Bu metin, mevcut desteklenen yöntem için çağırıcı sözleşmesidir; yeni credential,
hesap, yetki, genel Pipe okuyucusu, doğrudan API login veya alternatif auth kanalı
oluşturmaz. Önceki özel retler başka yöntemle aşılmaz.
