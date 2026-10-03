# Stok değerleme: eksik kur ve sayfa toplamları

Melisa ürün kayıtlarının mevcut ortalama TRY maliyeti korunur. Güncel satış fiyatı rapor tarihinden ileri olmayan en son kur kaydıyla çevrilir. Rapor tarihi SQL UTC günüdür. Son kayıt sıfır/geçersizse eski pozitif kura geçilmez; eksik kur 1 sayılmaz. Geçmiş fiş kur snapshotları değiştirilmez. Bu rapor canlı Vega stok/maliyet raporu değildir; kayıtlı maliyetin kaynak doğruluğu ayrıca değerlendirilmelidir.

Satış tutarı sıfır olmayan ve kuru eksik satırın potentialSaleValueTry, potentialGrossProfitTry ve profitMargin alanları null olur. Sıfır stok/sıfır satış fiyatı kur gerektirmez; mevcut maliyet korunur. Eksi stok rapordan çıkarılmaz. Para birimi bilinmeyen kayıt TRY diye etiketlenmez.

Genel satış/kâr toplamı, filtrelenen ürünlerden herhangi birinde kur eksikse null döner; SQL SUM'ın bilinmeyen satırları atlayarak kısmi toplamı kesin göstermesi engellenir. Ayrı özet sonuç kümesi sayfalama dışındaki ürünleri de kapsar; boş/yüksek sayfa toplamları sıfırlamaz. Tek sorgudaki geçici tablo sayfa, özet ve kur kapsamını aynı satır kümesinden üretir; iş tablolarına yazılmaz.

Ekranda kaynak, rapor tarihi, satır kur/tarih bilgisi ve eksik kur uyarısı bulunur. Sayfalar arasında geçiş eklenmiştir; Excel/yazdır eylemleri görünür sayfayla sınırlı olduklarını açıkça söyler. Bilinmeyen değerler çıktıda Hesaplanamadı olarak hazırlanır.

## Kabul

- 12 yeni davranış testi; 146 API/231 web kontrolü, 151 API/184 web kökü ve 0 tanı; lint/build PASS.
- Ayrı SQL laboratuvarında 103 sentetik ürün: ilk sayfadaki 100 TRY ürüne rağmen ikinci sayfanın USD/EUR kur eksikliği genel toplamı null yapar.
- Stok değeri 3603 TRY; sentetik USD 40/EUR 45 ile potansiyel satış 12085 TRY ve brüt kâr 8482 TRY. Tüm sayfa satırlarının toplamı karşılaştırıldı. Gelecek kur, son sıfır kur, sıfır/eksi stok, boş sonuç, filtreler ve sayfa 999 doğrulandı.
- Tarayıcıda eksik/geçerli kur, iki sayfa, açık kaynak/tarih ve uyarı görünümü incelendi. 1264×625 ve 1440×900 boyutlarında görüntü alındı. Genel mobil kabul değildir.
- 103 geçici ürün ve 4 kur kaydı kaldırıldı; önceki ürünler, kurlar ve hesap bakiyeleri birebir korundu. Lab servisleri kapatıldı; disk korundu.

Excel indirme denemesi tarayıcı otomasyonunda “Download was canceled” döndü; dosyanın gerçekten indirildiği ve yazdırıldığı doğrulanmadı. Tam çıktı kabulü açık. Diğer dashboard kur hesapları, kasa eşzamanlılığı, iptal/düzeltme ve proje kaynak uzlaştırması devam eder. Bu rapor değişikliği canlı 5173 sürümüne aktarılmadı; kullanıcı onayıyla yapılan ayrı menü aktarımı yalnız altı navigasyon dosyasını kapsar.
