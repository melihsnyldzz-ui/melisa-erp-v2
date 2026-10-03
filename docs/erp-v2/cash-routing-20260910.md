# Gerçek kasa servisleri: tahsilat yönlendirme ve eşzamanlı açılış

**PASS_REAL_CASH_ROUTING_SERVICES**, yalnız izole ERP adayı. Canlıya aktarılmadı.

`openCashSession` tek açık oturum kontrolünü transaction boyunca UPDLOCK/HOLDLOCK ile korur ve çekmece bakiyelerini bu kontrolden sonra okur. Böylece farklı tarihlerle eşzamanlı açılış, yalnız `(drawer,date)` unique kısıtına bağlı kalmaz. Önceden belgelenmiş v1 tek açık kasa kuralı uygulanır.

`resolveFinanceAccount` otomatik nakit hesabını seçerken oturum kilidini hareket kaydı tamamlanana kadar tutar. Açıkça seçilen çekmece hesabında önce oturum, sonra hesap kilitlenir; kapanışın kilit sırası korunur. Kapalı çekmeceye açık hesap kimliğiyle giriş 409 `CASH_REGISTER_OPEN_SESSION_REQUIRED`, banka/kart/diğer yöntemle fiziksel çekmeceye giriş 400 `FINANCE_DRAWER_CASH_METHOD_REQUIRED` döner. Kasa tabloları olmayan eski şema ve çekmeceye bağlı olmayan hesapların eski yolları korunur; eski şema bu tur gerçek SQL ile ayrıca kurulmadı. Açık oturum yokken otomatik nakit ana kasa hesabını seçmeye devam eder.

## Kanıt

`node scripts/quality/sql-lab/accept-cash-routing.mjs` gerçek servisleri ve SQL transactionlarını kullanır. Test süreci yalnız doğrulanmış 127.0.0.1:51433 laboratuvarına bağlanabilir; diğer ağ, fetch, dinleyici ve dış süreç işlemleri kapalıdır. Mevcut fixture kimliği ve sysadmin=0 doğrulanır. Son koşu altı senaryo grubu PASS:

- Farklı tarihlerde iki gerçek açılış isteği: bir başarılı, bir `CASH_REGISTER_SESSION_EXISTS`; tek açık oturum.
- Gerçek tahsilatın hesap SELECT'i sonrasında kontrollü bekleme: gerçek kapanış bekler, tahsilat tamamlandıktan sonra beklenen TRY 10 ile kapanır.
- Kapalı çekmeceye doğrudan tahsilat reddedilir.
- Gerçek kapanışın oturum SELECT'i sonrasında kontrollü bekleme: açıkça seçilmiş hesaba tahsilat bekler; kapanıştan sonra 409 ile geri alınır.
- TRY/USD/EUR tahsilat 10, ödeme 3; açık hesapla ek TRY 2; banka/kart fiziksel çekmece reddi. Önceki TRY 10 devir dahil son hesap/bağımsız hareket toplamı 19/7/7 ve kapanış farkı 0/0/0.
- Açık oturum yokken gerçek hesap seçici, rollback edilen transaction içinde KASA-TRY döndürür.

SQL sonuçları taklit edilmedi; beklemeler gerçek SELECT sonrasına konuldu. Yeni test çekmecesi, üç hesap, altı cari, iki kasa oturumu ve bunların hareket/audit kayıtları temizlendi. 17 tablonun önceki bütün satırları birebir aynı. Sentetik identity ilerlemeleri geri alınmaz. Son koşu, test genişletmeleri ardından tekrarlandı; her koşu cleanup doğrulandı.

158 API testi, 239 web kontrolü, API 152/web 184 kaynak kökü sıfır tanı, lint/build PASS. Mevcut büyük bundle uyarısı sürüyor. Codebase Memory 8658 düğüm/27297 kenar ve 3 cross HTTP ilişkisi; 28 kısmi dosya, 0 atlanan. İlgili servis kaynakları doğrudan okundu.

66 depo/2182 dosya ve 6 onaylı canlı menü farkı korunur. Test konteyneri kapalı; volume kalır. Canlı API 6608 ve Vite 27264 aynı. Gerçek iş yazma, mesajlaşma, push/PR/merge/deploy yok.

## Kabul sınırı ve sıradaki işler

Bu tur tarayıcı/HTTP yetki kabulü değildir; gerçek servis ve SQL kabulüdür. Satış/terminal peşin fatura kesinleştirme aynı hesap seçicisini kullanır fakat bu probe fatura kesinleştirmesi yapmadı. İptal/düzeltme ve bunların kapalı kasaya etkisi, çıktı indirme/yazdırma, ERP kaynak uzlaştırması ve diğer commerce projeleri açık. Bütün ERP veya ana hedef tamamlanmış sayılmaz.
