# Masaüstü finans V7 kaynak adayı

Bu çalışma, normal oturumla TRY müşteri tahsilatı ve tedarikçi ödemesi için kaynak adayını içerir. Kasa ve cari hareketleri aynı işlemde okunup doğrulanacak; tekrar denemeler aynı istek kimliğini koruyacak şekilde tasarlanmıştır. Finans fişi geçmişi, satış hareketleri görünümünden ayrıdır.

İlk kapsamda yalnız ana para birimi TRY olan cari kartları ve seçili TRY cari hesabı kullanılır. Ödeme, mevcut kasa bakiyesini veya cari borcunu aşmaz. Bağlı fatura kullanılırsa fatura, aynı cari varlığı ve seçili TRY hesaba bağlı olmalıdır; belirsiz veya farklı dövizli bağlantılar reddedilir. Dövizli finans işlemleri bu kapsama dahil değildir.

V7 DDL, izin ve profil denetimleri kaynak önerisidir. Bağımsız geri alma ve metadata gözlemiyle doğrulanmış bir SQL Server geçişi değildir. Kaynak ve saf testler, gerçek kurulum, gerçek SQL Server işlemi, native motorun gerçek sürücüyle çalışması, ekran veya kullanıcı kabulü göstermez.

Odaklı saf model, okuyucu, profil, kontrolör ve ekran testleri yerelde geçti. `desktopFinanceOwners.integration.test.mjs` ve `desktopFinanceNative.integration.test.mjs` hosted temiz ortamda çalıştırılmak üzere hazırlanmıştır; yerelde bağımlılık bulunmadığından çalıştırılmamıştır. İlki native motoru ve sürücüyü, ikincisi sürücüyü ve bazı yardımcıları sentetik olarak kullanır; başarılı olmaları dahi gerçek SQL Server kabulü olmaz.
