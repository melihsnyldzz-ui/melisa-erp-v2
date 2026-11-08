# Fişe bağlı salt okunur barkod kontrolü

K06-04, ürün barkodunu açık fişin ürün satırlarıyla karşılaştırır. Yeni satış
sepetine ürün ekleme, mal sayımı veya sevk işlemi değildir. Aynı kontrol normal
satış/hazırlık ekranında ve fiyat/cari içermeyen depo ekranında kullanılır.

`GET /api/desktop-sale/workflows/:invoiceId/barcode-check` normal oturumda
`sales.view` + `product.view` ve mevcut own/all fiş görünürlüğünü gerektirir.
Depo eşdeğeri `GET /api/desktop-warehouse/workflows/:invoiceId/barcode-check`
mevcut `warehouse.view` hakkıyla çalışır. `barcode` ve fişin opak `version`
değeri sorguya bağlanır; kimlik, izin ve güncel fiş sürümü aynı SERIALIZABLE
işlemde doğrulanır. Yeni SQL hakkı, hesap, rol veya şema gerekmez.

Aktif ve silinmemiş ürünlerin etkin barkodları, baştaki sıfırlar korunarak tam
eşleştirilir. Metin kırpılmaz veya büyük/küçük harfe dönüştürülmez. Bir ürüne ait
alternatif barkodlar aynı ürün üzerinden fiş satırlarına ulaşır. Birden fazla
fiş satırında aynı ürün varsa eşleşen bütün satır kimlikleri sıralı ve tekil
olarak döner. Farklı aktif katalog ürünlerinin aynı barkodu taşıması belirsizdir.

Yanıt yalnız `{invoiceId, version, barcode, status, itemIds}` içerir:

- `MATCH`: en az bir fiş satırı eşleşti.
- `NOT_IN_INVOICE`: barkodun ürünü açık fişte yer almıyor.
- `NOT_FOUND`: etkin katalog barkodu bulunamadı.
- `AMBIGUOUS`: barkod birden fazla etkin katalog ürününü belirliyor.

Başka ürünün adı, kimliği, fiyatı veya carisi yanıta eklenmez. İzin, oturum,
bağlantı ve sürüm hatası `NOT_FOUND` diye gösterilmez. Başka fiş/oturum veya
daha yeni okutma açıldıktan sonra gelen eski yanıt ekrana uygulanmaz.

Kontrol adet, koli, hazırlık durumu, stok, cari, finans veya audit kaydı yazmaz.
Tamamlanmış bir fiş salt okunur kontrol için açılabilir; PREPARE, READY, CHECK
ve DISPATCH yeniden çalıştırılmaz. Bu özellik mevcut işlem kurtarma ve bekleyen
istek davranışını değiştirmez; barkod alanındaki Enter başka bir formu göndermez.

Mevcut sentetik Fiş15, ürün10/000000000092 ve ürün11/000000000093 satırlarını
içerir. Ürün8/ERPTESTR1P7 fişte olmayan mevcut ürün örneğidir. Yerel normal
ekran denemesi bu tamamlanmış fiş üzerinde yalnız okuma olarak yürütülür;
öncesi/sonrası aynı 47 native alanın korunması gerekir. Yeni deneme fişi,
yeniden sevk, yeni kimlik veya fiziksel cihaz kullanılmaz.

Bu kanıt tamamlanmış fişte masaüstü barkod karşılaştırmasıdır. Ayrı depo
personasının etkin normal oturumu, aktif PREPARING işlemi ve fiziksel cihaz /
gerçek personel kabulü ayrıca doğrulanmadıkça tamamlandı olarak sunulmaz.
