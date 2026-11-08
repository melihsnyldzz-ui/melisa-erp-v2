# Yerel ürün kartında alış ve maliyet ayrımı

K03-11, PR54 karar defteri §21'deki liste alış fiyatını koruma ve net alış
maliyetini ayrı gösterme kuralını mevcut boş V7 kurulumuna bağlar. Yeni bir alış,
stok veya finans kaydı oluşturmaz. Vega/migration okuyucusu kullanılmaz.

Ürün kartında dört farklı değer vardır:

- **Liste alış fiyatı:** ürünün kayıtlı alış listesi ve para birimi.
- **Son net alış:** doğrulanmış, kesinleşmiş yerel alışın bütün indirimler
  dağıtıldıktan sonraki net satır tutarı / ana birim miktarı. Aynı tarihte belge
  ve satır kimliği sırası belirleyicidir.
- **Alışların ağırlıklı ortalaması:** aynı para birimindeki doğrulanmış net alış
  satırlarının toplamı / toplam ana birim miktarı. Para birimleri toplanmaz.
- **Stok ortalama maliyeti (TRY):** ürünün mevcut kayıtlı stok maliyeti. Açılış
  stoku ve sonraki stok etkileri içerdiğinden geçmiş alış ortalamasıyla aynı
  olduğu varsayılmaz. Bu okuma stok maliyetini yeniden hesaplamaz veya yazmaz.

Fişin kayıtlı teklif girdisi ve bütün satırları, mevcut tam sayı tabanlı alış
hesabı ile doğrulanır. Satır, fiş ve tedarikçi indirimleri sırasıyla uygulanır;
net satıra ürün kartındaki indirim bir kez daha uygulanmaz. TRY değerleri
işlemdeki kur görüntüsünden gelir; güncel kur kullanılmaz. Mevcut yerel mal kabul
zinciri TRY içindir. Desteklenmeyen, eksik, çelişkili veya iptal bağlantısı
kesin bir tutara çevrilmez; **Hesaplanamadı** gösterilir. Kayıt bulunmaması sıfır
maliyet anlamına gelmez.

`GET /api/desktop-products/:productId/purchase-costs` yalnız V7 profilinde
çalışır. Normal oturum, loopback host/origin, sorgu ve ürün kimliği sınırları
korunur. `product.view`, `product.edit`, `purchase.view` hem HTTP girişinde hem
aynı SERIALIZABLE işlemde doğrulanır. Sonuç ödeme, cari bakiye veya başka
kullanıcının kimliğini içermez. Yeni tablo, GRANT, rol veya parola yoktur.

Kaynak testleri iş kuralı, bozuk bağlantı, eksik yetki, farklı ürün yanıtı ve geç
oturum/kart yanıtını kapsar. Bunlar gerçek kurulum veya insan kabulü değildir.
Kurulumda mevcut sentetik ürün/alışlar normal ekranda açılmalı, kayıt olmayan
üründe hesaplanamayan değer görülmeli; uygulama geçişi ve bu okumalar öncesi ve
sonrası native veriler aynı kalmalıdır. Dövizli stok ağırlıklı maliyet, alış
iptali ve gerçek personel kabulü bu dar TRY okumasıyla kapanmış sayılmaz.
