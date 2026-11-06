# K05-11 — kesin satış iptali hazırlığı; uygulama kapalı

Bu dal yalnız ters etki hesabının başlangıcını içerir. `prepareDesktopSaleCancellation` SQL bağlantısı açmaz, yetki vermez, fiş iptal etmez ve native motoru çağırmaz. Henüz SQL adaptörü, normal API/ekran, kalıcı iptal isteği ve kurulum yoktur. K05-11 kapanmadı; mevcut taslak iptali kabulü korunur.

Hesap, kaydedilmiş iki stok çıkışının TRY tutarlarını ve tek cari hareketinin belge/hesap tutarlarını aynen ters çevirir. Güncel kur veya fiyattan yeniden hesap yapmaz. İskonto sonrası net stok tutarlarının toplamı fişteki TRY tutarına eşit olmalıdır. Müşteri, entity, seçili hesap, iki ürün/kalem, hareketler ve DISPATCHED rezervler eşleşmelidir. Tekrarlı/eksik/başka fişe ait hareket, daha önce iptal, bağlı finans/iade/dışa aktarım kanıtı ve sınır aşımı reddedilir. Bu doğrulama girdilerinin kendisi yetki kanıtı değildir; bütün satırlar sonraki adaptörde aynı fiziksel işlem içinde okunmalıdır.

Yedi kaynak testi geçti: iskontolu EUR→USD, USD→USD, TRY→EUR, TRY→TRY; satır yuvarlama farkını ve sıfıra yuvarlanan satırı aynen koruma; eksik/çift/bozuk hareket; negatif bakiye ve sekiz haneli hesap hassasiyeti. TRY ana hesap ile seçili döviz hesabı farklıysa ana bakiye korunur. Bunlar sentetik kaynak testidir; gerçek SQL iptali veya normal GUI kabulü değildir.

6 Kasım 13:20 UTC salt okunur sorgusu, yalnız `Semih\MELISAERP / MELISA_ERP_DESKTOP_TEST_20261105`, DB5/GUID `c67f5317-9c0d-4831-aadd-fadc379a95d1`, schema4 için doğrulandı. `sales_invoices.cancel_reason` **nvarchar(250)**, `cancelled_at` datetime2(0), `updated_by` bigint mevcut. `desktop_local_writer_v2` rolünde bu üç alan için UPDATE izni yok. `erp_deneme` rolünde `sales.cancel` kaydı yok. Yeni izin/rol/parola veya DDL uygulanmadı. Dış sorgu kanıtı `Masaüstü/ERP/kurulum/final-cancel-scope-read-v1.json`.

İzlenecek aynı iş paketi:

1. Normal oturumda ayrı `sales.cancel` kontrolünü, bekleyen işlem/UUID bağını ve aynı işlemde güncel kimlik/rol okumasını hazırlamak. `sales.edit` ile kesin iptal yetkisi varsayılmayacak.
2. Mevcut native iptal motorunu yalnız fiziksel olarak sahiplenilmiş desktop çağrısında yeniden kullanmak. Native stock reversal'ın iskontolu TRY vektörünü, seçili hesap damgalarını ve ana bakiye korumasını tamamlamak; genel/Vega/selected SOURCE davranışını değiştirmemek. B6 korunan gövde/SQL aynı kalmalı; dosya bütünü değişirse hash zinciri açıkça kanıtlanmalı.
3. Fişin normal kurulu muhasebe dönemi, iade, tahsilat ve dışa aktarım kontrollerini aynı hedefte doğrulamak. Başka/global SQL havuzuna düşme olmayacak. Başarı bilinmiyorsa aynı UUID/gövde korunacak; kesin ve bağımsız no-write kanıtı olmadan yeni istek açılmayacak.
4. İptal gerekçesi ve ayrı onay ekranı; belge, koli ve denetim geçmişini koruyan ters kayıtlar; tam sonucu bağımsız okuma ve replay kanıtı. Kesinleşmiş fiş silinmeyecek.
5. Gerçek uygulama bileşimi, eşzamanlılık, kayıp yanıt, başka aktör, değişmiş gerekçe/sürüm, kısmi ters kayıt ve rollback testlerini tamamlamak. İzin/profile geçişi somut artefact olarak incelenmeden ve ilgili ayrı yetki olmadan kuruluma alınmayacak.

Bu not bir kurulum onayı isteği değildir; incelemeye hazır tam uygulama henüz yok. Üç yeni sütun izni ve `sales.cancel` gereksinimi mevcut güvenlik kapsamına kendiliğinden eklenmez. Şimdiki kurulu barkod paketi değişmedi; eski ERP, Vega, ticari kayıtlar ve yedekler korundu. Merkez plan/Excel değiştirilmedi.
