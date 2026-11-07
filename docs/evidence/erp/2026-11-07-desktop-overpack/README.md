# K06-02 fazla koli — kaynak düzeltmesi ve gerçek ilk deneme

PR54 yeşil ERP devamı; `eb54f666` tabanından ayrı feature dalı.

Kurulu V6 normal TEST ekranında, yeni sentetik satış16 / DS-7012caf0-f411-4637-9485-5 üzerinde ürün10 ve11 birer ADET olarak hazırlandı. İlk satıra2.000, ikinciye1.000 ADET girilip Kolileri kaydet denendi. Özgün SAVE_CARTONS isteği822c4dcc-3405-43e7-92a4-bd0d9f84b800 HTTP503/UNKNOWN döndü. Açıklayıcı ret olmadığından bu ilk ekran kabulü BAŞARISIZDIR.

Denemenin hemen önce/sonra ayrı bitmiş salt okunur SQL bağlantılarında37 iş tablosunun bütün satır özetleri,40 identity ve metadata/güvenlik aynıdır. Koli veya stok/cari etkisi oluşmadı. Normal İsteği uzlaştır yolu aynı gövde/UUID ile200 NOT_COMMITTED/DURABLE_NO_COMMIT döndü; istemcideki önceki miktarlar korunur. Satış16 PREPARING ve iki rezervi aktif kaldı; sevk yapılmadı. Ayrı bekleyen alış6518dff9-3141-4f32-8278-3a7c73586044 değişmedi ve yeni alış yazımı durduruldu.

Düzeltme yalnız ekranın SAVE_CARTONS ön kontrolüdür: bütün kolilerdeki aynı fiş satırının miktarları BigInt ile toplanır. Toplam fişteki ADET miktarını aşarsa ürün kodu ve izin verilen miktarla hata gösterilir. Controller/UUID/istek günlüğü/POST öncesinde durur; mevcut koli formu düzeltilebilir. Kısmi koli kaydı ve eksik koli READY kontrolü korunur. Native SQL iş kuralı, UNKNOWN/replay/normal uzlaştırma, yetki, şema ve hesaplar değiştirilmez.

35 hedefli kaynak testi geçti: normal ekran olayları+gerçek lifecycle controller tek/iki koli toplamında sıfır UUID/journal/POST, aynı formu düzeltme ve sonraki UNKNOWN isteği koruma; mevcut eksik koli, kayıp yanıt, iptal ve packing recovery regresyonları. Bağımsız salt okunur frontend incelemesi yeni P1/P2 bulmadı. Bu testler DOM modeli ve bellekte sürücü kullanır; gerçek kurulu ekran tekrarını ikame etmez.

Yeni kaynak için exact-head GitHub CI ve ekran artifact'i, uygulamaya özel güncelleme ve normal ekran yeniden denemesi BEKLİYOR. İlk gerçek başarısızlık kanıtı korunur; kurulu kabul henüz PASS değildir. Yerel kanıt `Masaüstü/ERP/kurulum/k06-overpack-v1/` içindedir. Eski ERP/Vega/LIVE ve ticari veri/yedekler kapsam dışıdır.
