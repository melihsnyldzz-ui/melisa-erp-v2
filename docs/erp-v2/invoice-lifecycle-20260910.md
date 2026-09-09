# Fatura iptal/düzeltme ve kapanmış kasa

**PASS_INVOICE_LIFECYCLE_SERVICES** — yalnız izole ERP adayı, gerçek servis/SQL kabulü. Canlıya aktarılmadı.

Önceki kodda peşin fatura düzeltmesi, kapanmış kasanın eski tahsilatını değiştiriyordu. Gerçek SQL denemesinde 30 sayılan kapalı çekmecenin hesabı 40 oldu; stok ve cari hareketleri de düzeltilmişti. Yeni kontrol tutar/tarih etkisi olan peşin düzeltmede tek tahsilat bağlantısını doğrular, tahsilatın oluştuğu oturumu işlem sonuna kadar kilitler ve kapanmış oturum için 409 `SALES_CORRECTION_CASH_SESSION_CLOSED` verir. Sonraki gün yeni kasa açılması eski tahsilatı açmaz. Hata halinde fiş/ürün/cari değişiklikleri tamamen rollback olur. Tahsilat bağlantısı yok veya birden çoksa sessiz eksik finans etkisi yerine `SALES_CORRECTION_CASH_COLLECTION_MISSING` döner.

Tutar ve tarih değişmiyorsa açıklama düzenlemesi kullanılabilir; eski tahsilat/hareket/hesap satırları yeniden yazılmaz. Açık kasadaki 20→30 peşin düzeltme kabul edildi. Kapanmış kasadaki parasal değişikliği tamamlamak için otomatik geri ödeme veya geriye dönük sayım değiştirme yapılmadı; ayrı güncel iade/mahsup akışı bu kabulün kapsamı değildir.

`scripts/quality/sql-lab/accept-invoice-lifecycle.mjs` yalnız kimliği doğrulanmış 127.0.0.1:51433 test SQL'ine bağlanır. Fetch, diğer ağ, dinleyici ve dış süreçler kapalıdır. Son koşu altı grup PASS:

- Alış 10×10 kesinleşir; 8×12 düzeltmede stok 8, maliyet 12, tedarikçi borcu 96.
- Satış 2×20 kesinleşir; 3×25 düzeltmede stok 5, cari 75. Eşzamanlı iki iptalden yalnız biri başarılı; stok 8 ve cari 0. İptal edilmiş fiş düzenlenemez.
- Açık kasa peşin düzeltme 20→30; kapanış sonrası 40'a düzeltme 409 ve tüm 17 tablo snapshotında sıfır etki.
- Kapalı tahsilat tarih değişimi reddi; açıklama düzeltmesinde finans satırları birebir aynı; yeni açık kasa eski tahsilatın kilidini kaldırmaz.
- Peşin fatura iptali eski tahsilatı iade saymaz: cari 30 alacaklı kalır, kasa 30 korunur. Bu mevcut muhasebe etkisidir; otomatik geri ödeme çalıştırılmaz.
- Eşzamanlı iki alış iptalinden biri başarılı; net stok/maliyet/tedarikçi bakiyesi 0.

## Test sırasında bulunan yan etki ve düzeltmeler

İlk deneme fixture ürününün tedarikçi bağlantısı eksik olduğundan haklı olarak reddedildi; bağlantı yalnız yeni test ürününde kuruldu. İkinci deneme iş akışlarını bitirdi fakat temizlik koruması, `ensureCashCustomers` işlevinin mevcut üç standart sentetik peşin kartı her satışta yeniden yazdığını yakaladı. Bakiyeleri değişmedi; updated_at/rowversion ilerledi. Eski test metadata'sı uydurularak geri alınmadı. Probe'a ait ürün/cari/fiş/çekmece/hareket/audit kayıtları kimlikleriyle temizlendi; `invoice-lifecycle-recovered-before.json` kanıtı tutuldu.

`ensureCashCustomers` artık yalnız standart alanlar farklıysa UPDATE yapar; doğru kartları tekrar yazmaz. Kasa korumasındaki tarih karşılaştırması da SQL Date nesnesiyle formdaki ISO günü aynı biçimde karşılaştıracak şekilde düzeltildi; açıklama testi bu hatayı yakaladı. Son düzeltilmiş koşuda, bu koşu öncesindeki 17 tablonun bütün satırları birebir korundu ve bütün yeni fixture kayıtları kaldırıldı. İlk hatalı koşudan kalan üç kart metadata ilerlemesi ayrıca belirtilir; bütün tur boyunca hiçbir satır değişmedi iddiası yoktur. Identity sayaçları geri alınmaz.

## Kontroller ve sınırlar

158 API testi /239 web kontrolü, API 152 kök sıfır tanı, lint/web build PASS; büyük bundle uyarısı sürer. Sonuç SQL/servis kabulüdür; bu tur tarayıcı/HTTP, bütün para birimleri, kapalı dönem matrisi veya bütün hata-enjeksiyon senaryoları çalıştırılmadı. Maliyet hesabı mevcut purchase-movement politikasını korur.

İndeks 8686 düğüm/27509 kenar +3 cross HTTP; 28 kısmi dosya/0 atlanan. İlgili kaynaklar doğrudan okundu. 66 depo/2182 dosya ve 6 onaylı menü farkı korunur. Test konteyneri kapalı, volume durur; canlı API 6608/Vite 27264 aynı. Mesajlaşma, gerçek iş verisi, push/PR/merge/deploy yok. Ana hedef devam ediyor; rapor indirme/yazdırma, kaynak uzlaştırması ve diğer commerce projeleri açık.
