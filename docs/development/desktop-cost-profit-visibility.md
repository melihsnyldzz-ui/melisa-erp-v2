# K10-04: satış önizlemesinde maliyet ve kâr sınırı

9 Kasım 2026. Mevcut izin modelinin dar veri görünürlüğü düzeltmesidir.

Ürün listesi satış fiyatı ve stok gösterebilir. Ürün kartındaki alış fiyatı ve maliyet için mevcut `product.view` + `product.edit`, alış maliyeti geçmişi için ayrıca `purchase.view` gerekir. Dar satış TEST hesaplarında bu ek haklar yoktur. Depo miktar/koli görünümünün önceki sekiz HTTP yanıtı kendi tarihli kapsamıyla yeniden kullanılır; depo hesabı etkinleştirilmez, hazırlama/sevk tekrarlanmaz.

FX hazırlığındaki iç hesaplama satırları birim TRY maliyeti ve brüt kâr taşır. Bu iç satırların satış önizlemesine doğrudan kopyalanması, satış oluşturma/sonlandırma hakkını maliyet okuma hakkına dönüştürebiliyordu. Önizleme artık açık bir alan listesi kullanır: satış tutarları, iskonto, para birimleri, hesap/kur bilgileri ve her satır için yalnız ürün kimliği, miktar, birim satış fiyatı ve satır tutarı. İzin verilen değerler de beklenen ilkel türde olmak zorundadır; nesne içine başka veri saklanamaz.

Native hazırlık, kesinleştirme ve stok/cari hesapları kendi iç maliyet ve kâr verilerini korur. Ürün kartı ve maliyet geçmişi hakları değişmez. Yeni hesap, rol, yetki, SQL şeması veya yazma yolu eklenmez. Ön yüzdeki FX yanıt denetimi de aynı alan/tür sınırını uygular.

Mevcut `belowCostWarning` maliyet altı fiyat uyarısı korunur. Bu ikili uyarı sayısal maliyet veya kâr alanı değildir; sıfır maliyet bilgisi iddiasıyla karıştırılmaz. Sayısal maliyet/kârın gizliliği hem gerçek normal ekran hem HTTP yanıtında ayrıca doğrulanır. Kaynak/sentetik test, gerçek kurulum, normal hesap ve insan kabulü ayrı kanıt sınıflarıdır.

209 numaralı onay isteği ve patron kararı/fiş devamına ilişkin açık sınır korunur. Fiş15 sevki, ödeme ve kişisel limit testleri tekrarlanmaz. Geçerli eski depo kanıtı yeni geniş rol veya yeni ticari işlem yetkisi sayılmaz.
