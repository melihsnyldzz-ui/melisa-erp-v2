# Otomatik fiş numarası ve eşzamanlı taslak kabulü

Yeni web fişinin numarası boş başlar; alan Kaydedince otomatik açıklamasını gösterir. Sunucu, boş numarayı kendi transaction'ı içinde gerçek fiş kimliğinden `SDR-<id>` / `PDR-<id>` olarak üretir. Saniyeye bağlı eski otomatik üretim kaldırıldı. Düzenlemede boş numara mevcut numarayı korur. Elle girilen numaralar ve önceki kayıtlar değişmez. Bunlar iç fiş numaralarıdır; yasal belge serisi veya bütün elle girilen numaralar için global benzersizlik kuralı tanımlanmadı. İstek tekrar güvenliği ayrı konudur; yeni numara üretimi aynı isteği kendiliğinden idempotent yapmaz.

Gerçek paralel SQL testi ilk çalışmada sales_invoice_items üzerinde deadlock yakaladı. SQL system_health raporu, eşzamanlı taslakların kendi satırları okunurken PK taramasında birbirinin satır kilidine takıldığını gösterdi. İlk başarısız denemede dört alış taslağı kaldı; satış sonucu yeniden denenmeden doğrudan SQL'den incelendi. Bu kayıtlar korunur ve stok/cari etkisi yoktur.

0019 migration, alış ve satış satırlarına fiş kimliği/id sıralı, snapshot sorgularını kapsayan indeksler ekler. İş kayıtlarını veya isolation ayarlarını değiştirmez. Yalnız ayrı commerce SQL laboratuvarına uygulandı; üretim migration yapılmadı. İki uygulamada satırlar aynı kaldı. İndeks seçiminin gerekçesi: [Microsoft kilitlenme analizi](https://learn.microsoft.com/en-us/azure/azure-sql/database/analyze-prevent-deadlocks?view=azuresql). Tüm olası yüklerde deadlock oluşmayacağı iddiası değildir.

Kabul:

- İki bağımsız tur: her turda aynı anda 4 satış + 4 alış taslağı; sekiz farklı otomatik numara.
- Her turda 2 elle numaralı taslak; boş düzenlemede eski numara, elle düzenlemede girilen değer korunur.
- Sahip transaction rollback olduğunda otomatik numaralı satış taslağı kalmaz.
- Eski fiş numaraları; ürün stokları, müşteri/tedarikçi/kasa bakiyeleri ve ticari hareket sayıları aynı kalır.
- Gerçek web/API: SDR-20018 satış oluşturma + boş numarayla tekrar kaydetme aynı kaydı korur; PDR-16 alış oluşturma PASS.
- 97 API testi; 226 web kontrolü; API 149 / web 182 kök, sıfır tanı; lint ve web build PASS. Büyük bundle uyarısı sürer.

Manuel tekrar üretim: mevcut izole SQL kimliğini doğruladıktan sonra `accept-invoice-indexes.mjs`, ardından `accept-document-numbers.mjs`. İkinci komut her çalışmada 10 yeni yapay taslak oluşturur; otomatik genel test runner'ına dahil değildir. Önceki başarısız test kendi kendine tekrar gönderilmez. Bootstrap yalnız yeni laboratuvarlar için 0019'u da içerir.

Test servisleri kapatıldı, disk korundu. Gerçek iş verisi yazma ve mesajlaşma sıfır. Ana kanıt: Development OS `audit/commerce-no-messaging-20260908/document-numbers/acceptance.json`. Diğer liste kaynakları, rapor/kasa, ticari düzeltme/iptal ve kaynak uzlaştırması açık; tam ERP kabulü değildir.
