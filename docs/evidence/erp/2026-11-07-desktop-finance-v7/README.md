# Masaüstü finans V7 kaynak adayı

Bu çalışma, normal oturumla TRY müşteri tahsilatı ve tedarikçi ödemesi için kaynak adayını içerir. Kasa ve cari hareketleri aynı işlemde okunup doğrulanacak; tekrar denemeler aynı istek kimliğini koruyacak şekilde tasarlanmıştır. Finans fişi geçmişi, satış hareketleri görünümünden ayrıdır.

İlk kapsamda yalnız ana para birimi TRY olan cari kartları ve seçili TRY cari hesabı kullanılır. Ödeme, mevcut kasa bakiyesini veya cari borcunu aşmaz. Bağlı fatura kullanılırsa fatura, aynı cari varlığı ve seçili TRY hesaba bağlı olmalıdır; belirsiz veya farklı dövizli bağlantılar reddedilir. Dövizli finans işlemleri bu kapsama dahil değildir.

V7 DDL, izin ve profil denetimleri kaynak önerisidir. Bağımsız geri alma ve metadata gözlemiyle doğrulanmış bir SQL Server geçişi değildir. Kaynak ve saf testler, gerçek kurulum, gerçek SQL Server işlemi, native motorun gerçek sürücüyle çalışması, ekran veya kullanıcı kabulü göstermez.

V7 aday paket derleyicisi, özel TLS yazıcı doğrulayıcısı ve başlatıcı kaynakları V6'nın sabit hedef, özel parola kanalı ve ihracat çiti kurallarını izler. Bu dosyalar çalıştırılmadı ve herhangi bir paket veya runtime kabulü oluşturulmadı. `master-v7-plan.mjs` yalnız sabit hedefli, hashlenmiş DDL/izin önerisini tanımlar ve açıkça `admissionAllowed: false` döndürür; yürütülebilir kurulum planı değildir. Canlı V6 başlangıç değerleriyle doğrulanmış atomik geçiş, rollback/identity kanıtı, bağımsız gözlem ve gerekli dar izinler için ayrı incelenmiş kurulum planı hâlâ gereklidir.

Kaynakta rollback denemesi ve içerik olarak eşleşen ikinci V6 gözleminden sonra incelenebilir koşullu apply SQL önerisi derlenebilir; öneri kullanıcı onayı, bağımsız süreç/hedef kanıtı veya çalıştırma yetkisi üretmez. Normal apply INSERT işlemi hata veya sonucu bilinmeyen bir durumda SQL Server identity sayacını ilerletmiş olabilir. Böyle bir durumda bağımsız taze gözlem ve yeni durum değerlendirmesi gerekir; sayaç kendiliğinden geri gelmiş sayılmaz ve reseed yapılmaz.

Odaklı saf model, okuyucu, profil, kontrolör ve ekran testleri yerelde geçti. `desktopFinanceOwners.integration.test.mjs` ve `desktopFinanceNative.integration.test.mjs` hosted temiz ortamda çalıştırılmak üzere hazırlanmıştır; yerelde bağımlılık bulunmadığından çalıştırılmamıştır. İlki native motoru ve sürücüyü, ikincisi sürücüyü ve bazı yardımcıları sentetik olarak kullanır; başarılı olmaları dahi gerçek SQL Server kabulü olmaz.
