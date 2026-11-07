# K10-SALES-LIMITS / DES-06 — Fiş fiyatı ve kişisel iskonto

Satış fiyatını değiştirmek için ürün kartı düzenleme izni gerekmiyor. Yeni `pricing` komutu, yalnız doğrulanmış kişinin yetkisiyle o fişin satır fiyatını değiştirir; ürünün liste fiyatı ve maliyeti güncellenmez. Teklif, taslak, kalıcı fiş görüntüsü ve native kesinleştirme aynı exact fiyat/fiş geneli yüzde hesabını kullanır. Satır iskontosu veya tutar bazlı indirim eklenmedi; maliyet altı boolean uyarısı korunur.

## Yetkinin kaynağı ve sınırları

Mevcut `system_settings` deposunda ayrı `desktop-sales / individualPolicyV1` satırı için kaynak okuyucu hazırlandı. Satır ve kişi kimliği aynı SERIALIZABLE işlemde güncel kullanıcı/rol/izinlerle kilitlenir. Kompakt canonical JSON, yinelenen/unknown anahtar, kişi/rol eşleşmesi, row_version, tür ve aktiflik denetlenir. Yetki istemci flag'inden, `product.edit`, `product.price.edit`, rolün adından veya geniş yönetici varsayılanlarından çıkarılmaz.

- Kayıtlı satış kişisinin tanımlı limiti 0–5 aralığındadır; boş limit varsayılan %3'tür. Açıkça atanmış %1/%4 gibi kişi limitleri de geçerlidir.
- Kayıtlı müdür %5'e kadar çalışır. Müdür oluşu patron onayı verme hakkı oluşturmaz.
- %5 üzeri herkeste açık patron onayı ister. Kişisel limitin üzerindeki daha düşük oran için de aynı ayrı patron onayı gerekir.
- Yalnız açık `boss` kişi kaydı patron onayı verir. Bu bir normal oturum işlemidir; başka kişinin parolası istenmez.
- Policy satırı hiç yokken yalnız mevcut `desktop_first_sale_operator` önceki %3/no-price-edit davranışını korur. Diğer kişiler %0/no-price-edit olur. Satır varsa fakat kişi kaydı yoksa otomatik %3 verilmez. Bozuk, pasif veya rolü uyuşmayan kayıt reddedilir.

Bu satır **oluşturulmadı**, kullanıcı/rol atanmadı, SQL GRANT/DDL veya runtime değişmedi. Hazırlanmış okuyucu çalışan veritabanında bu yeni yapılandırmanın bulunduğuna kanıt değildir. Mevcut genel personel tablosu/clean-target prosedürleri Desktop hedefe varsayılarak bağlanmadı.

## Teklif, onay ve tek etki

`pricing` policy revision, iki ana birim fiyat niyeti ve isteğe bağlı onay ID'sini taşır. Katalog revision'u fiyat kopyası değiştirilmeden önce doğrulanır. Yeni bir seçim, fiyat, miktar, birim, tarih, müşteri, döviz/kur, policy veya onay değişikliği eski teklifi geçersiz yapar. İstemci exact quote satırlarını ve ham toplam üzerinden yuvarlanan ara toplam/iskonto/net paritesini doğrular.

Patron talep kartında gerçek birim fiyatlarını, ürün ve müşteri kimliklerini, miktarları, ara toplamı, iskonto tutarı/yüzdesini, net tutarı ve para birimini görür. Maliyet/kâr sayıları bu onay DTO'suna eklenmez. Sunucunun hesapladığı quote snapshot'ı talep audit kaydında saklanır; hash'i açık patron kararıyla bağlanır. Onay müşteri, sıralı ürün/miktar/fiyat/birim, tarih, katalog/policy sürümü ve döviz/kur içeriğine bağlıdır. Kullanılmamış onay 10 dakika geçerlidir.

Onay yalnız bir taslak için, aynı SQL işleminde native/readback ve CREATE_DRAFT journal ile birlikte tüketilir. Kalıcı pricing audit kanıtı oluşturucu, fiş, özgün UUID/body hash ve fiyat değişikliklerini taşır. Yeni journal'ın iç `pricingProofRequired` işareti normal yanıta sızmaz; eksik audit/journal ile eski yola düşülmez. Sonradan sevkte oluşturucunun ve patronun güncel policy/revision'u, immutable fiş fiyatları ve ilk journal birlikte doğrulanır. Önceden tüketilmiş onayın süre sonu tamamlanmış ilk etkiyi silmez. Eski, doğrulanmamış NULL oluşturuculu taslaklara sahip uydurulmaz; fresh sevk reddedilir.

Eski wire body, UUID ve hash biçimi korunur. Buna rağmen fresh eski istemci, yeni kişi limitini `pricing` alanını atlayarak aşamaz: eski tavan güncel limit ile %3'ün küçüğüdür. Eski taslağın yeni sevkinde oluşturucunun ve sevk edenin güncel limitlerinin küçüğü kullanılır. COMMITTED journal replay bu yeni hesaplardan önce çözülür.

Onay komutlarının ayrı actor-local pending alanı vardır. Yanıt kaybı/reload/izin kaybında aynı UUID ve body tutulur. Normal ekrandaki `Sonucu doğrula`, aynı actor/komut için kalıcı audit fence üretip COMMITTED veya NOT_COMMITTED sonucunu kanıtlar. Yalnız birebir eşleşen sunucu sonucu pending'i kapatır; yeni istek otomatik gönderilmez. Talep listesi son50 ile sınırlıdır; bilinen eski talep ID'si actor/boss yetkili ayrı okuma ve normal ekran üzerinden açılabilir. ID'siz tüm geçmiş keşfi bu sürümün kapsamı değildir.

## Kanıt ve teslim sınırı

Kaynak testleri kişi/3/5 eşikleri, onaysız/yabancı/değişmiş/süresi dolmuş onay retleri, fiyat/kur/actor bağları, tek kullanım, rollback, eski body hash'i ve UNKNOWN/fence kurtarmasını kapsar. 139 birleşik hedefli test geçti; son create-null recovery düzeltmesi ayrı7 controller ve83 frontend testiyle doğrulandı. Gerçek Express/normal-auth/native sentetik SQL fixture'ları ilk hosted kalite/derleme işinde geçti. Yerelde eksik mssql/Express için dependency, loader, junction veya build yolu eklenmedi.

İlk dc1460a9 CI'sinin secret-scan işi public ayar adı `individualPolicyV1` için generic-api-key bulgusu verdi. Bu, kimlik doğrulama malzemesi değildir. Bağımsız Gitleaks8.30.1 denemesi yalnız tam commit+dosya+kural+literal dört koşulu AND ile kapsayan düzeltmeyi doğruladı: hedef deneme1→0; dosya/değer/commit/kural tek tek değiştirilen dört negatifin her birinde1 bulgu kaldı. Varsayılan kurallar, workflow ve .gitleaksignore değişmedi; başka bulgu bastırılmaz. Windows ve yeni exact head sonuçları ayrıca beklenir; ilk başarısız koşu PASS olarak sunulmaz.

Native kâr hesabındaki geniş sınır yalnız gerçek private workflow sahibi, aynı transaction/actor/işlem ve tam invoice assertion sonrası açılır. B6 seçilmiş kalem fonksiyon gövdesi `235d4119bada53930fd71e9f0e472341b29a07b029b8e61a85eef7ce91f094be`, SQL `17a2646fdef4db1ed9a8e4a23fda33b462b4cda5382539d8b187dac24f938cbb` aynıdır. Yeni whole-file native pini `6a21a83e25ecf2967720d1ea01e28e722681e5c3ea8b1d5248650bc2a8bb463c` kaynak köprüsüne göre güncellendi; B6 SQL çalıştırılmadı.

Dal `codex/erp-desktop-sales-limits-20261107`, taban PR99 `b9bc5b52adeca4958fbbe33f342126d5d6b4018f`. PR99 aynı head'in [PR](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42400511051) ve [push](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42400507271) CI koşularında Windows dahil dört işin tamamını geçti. Bu yeni dalın exact CI sonucu ayrıca bağlanır. PR98 pasif kurulum adayı değiştirilmedi; bu işte paket veya kurulum yapılmadı.

Sonraki gerçek adım, ayrı somut hedef/kimlik ve before-image planıyla policy/normal kişi hesabı hazırlığının değerlendirilmesi ve tek tutarlı API/ekran/native paketin kurulmasıdır. Gerçek SQL atomicity/metadata/izin, normal beş kişi rolü, kurulu ekran, insan kabulü ve LIVE **bekliyor**. Özgün1TRY ödeme isteğinin sonucu belirsizdir; yeni sekmenin sonucu onun kanıtı sayılmaz.
