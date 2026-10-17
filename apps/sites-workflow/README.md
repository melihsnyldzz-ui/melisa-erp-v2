# Sites yeşil çalışma alanı

Kullanıcının seçtiği arayüz. Kaynak: Sites v70 d559243 ve C:/Sirket/ERP/sites-v70-kaynak/sites-source yerel devamı. Ana giriş tam Sites iş akışıdır; testSales.js gibi sonraki özel TEST modülleri de kaynakta korunur.

Gerçek müşteri/fiş snapshotları Git ve pakete alınmaz; iki snapshot boşaltılmıştır. Yerel asıllar korunur. Örnek işlem localStorage kullanır; API/SQL ticari kabulü değildir. Eski testSales modüllerinin özel TEST servislerine bağlanması sonraki işlev uzlaştırmasıdır.

Temiz kurulum: npm ci; npm test; npm run build. scripts/test.mjs yalnız bu arayüzün testlerini çalıştırır; eski erp-core tarihsel backend kopyası burada çoğaltılmaz.
