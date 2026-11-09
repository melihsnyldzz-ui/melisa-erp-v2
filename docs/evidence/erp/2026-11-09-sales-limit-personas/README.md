# Ayrı TEST hesaplarıyla kişisel iskonto sınırı

Bu kaynak, kurulu 9b4560dbc2170704cad4283e7ca8577def2e6b3f / paket 4e1dd533484400602ad0ad38828d85d386fa1f6f32cab50ed8f9d623f25734f3 için iki dar TEST hesabının işlem planını üretir. Bağlantı kurmaz, parola üretmez ve SQL çalıştırmaz. Gerçek kurulum, korumalı normal giriş ve ekran sonucu ayrıca kanıtlanır.

PR103'ün pasif hesap kurulumundaki hedef, işlem kilidi, mevcut operatörün 19 hakkı, önceki satırların korunması ve bekleyen iş denetimleri yeniden kullanıldı. Önceki 13 atamalı manager taslağı doğrudan uygulanmaz: güncel uygulamada manager politika türü kredi onayı, sales.cancel ise geniş fiş görüşü ve iptal hakkı verir. Bu deneme için iki rolün de yalnız product.view, customer.view, sales.view/create/edit/finalize hakları vardır; toplam 12 atama, yeni permission anahtarı yoktur.

erp_sales_deneme kişisel %3, erp_manager_deneme kişisel %5 sınırıyla **sales** politika türünde tanımlanır. İkinci hesabın adı gerçek yönetici onayı verildiği anlamına gelmez. Fiyat değiştirme, kredi/patron onayı, finans ve iptal hakları verilmez. Mevcut 30002 / rol5 kişinin açık %3 sınırı korunur; eski kullanıcı ve hakları değiştirilmez. Yeni politika revizyonu eski önizlemeleri ve bağlı onayları geçersiz kılabileceğinden kurulum öncesi açık/belirsiz işler ayrıca denetlenir.

Her operasyon açık rollback veya apply modu ister. Rollback çıktısında COMMIT yolu yoktur; apply çıktısı da dış owner yetkisi ve kanıtı olmadan yürütülmez. Aktivasyon ve pasifleştirme iki kullanıcı kimliği, rol bağları, kullanıcı/rol/politika rowversion değerleri ve 12 hakkı ilk UPDATE öncesi doğrular. Pasifleştirme hesapları kapatır; rol, politika ve audit geçmişini silmez. SQL IDENTITY sayaçları geri alma denemesinde ilerleyebilir; reseed yapılmaz.

Mevcut iş kuralında satışçının kişisel sınırını aşan istek patron onayına gider. Müdürün başka satışçının %3–%5 istisnasını onaylaması bu kaynakta eklenmedi; bu ayrı iş kuralı açık kalır. Kredi/vade varsayımı, yabancı taslak yazma yetkisi veya gerçek işletme kabulü üretilmez. Fiş15'in kabul edilmiş depo/stok/cari sonucu yeniden kullanılabilir; bu kaynak onu yeniden sevk etmez.

Yerel hedefli model ve SQL metni testleri kurulum veya SQL engine kabulü değildir. Yeni iki hesabın gerçek SQL geri alma provası, kalıcı kurulum, ayrı korumalı normal giriş, pozitif/negatif iskonto ekranları ve insan kabulü ayrı kaydedilir. LIVE/Vega, gerçek müşteri, ödeme, SQL login/GRANT/DDL veya main merge kapsamda değildir.
