# Kasa masrafı / transfer ile kapanışın eşzamanlılığı

Durum: **PASS_BOUNDED_CASH_SESSION_SELECT_SERIALIZATION**. Kod commit: `05b174ea3ec8d144dd1eef2844634f79987cca70`. Yalnız izole ERP adayı; canlıya aktarılmadı.

Masraf ve transfer açık oturumu normal SELECT ile okuduğundan, işlem bitmeden başka bir transaction kapanış kilidini alabiliyordu. İlgili iki SELECT artık `UPDLOCK, HOLDLOCK` ile aynı oturumu transaction sonuna kadar koruyor. Kapanışın mevcut oturum kilidiyle aynı sıra kullanılır: önce oturum, ardından hesap/hareket yazımı. İş tutarları, dönem kuralları ve API kontratı değişmedi.

`node scripts/quality/sql-lab/accept-cash-session-locks.mjs` gerçek servis dosyasından alınan SELECT ifadelerini iki ayrı SQL transaction üzerinde çalıştırır. Masraf→kapanış, kapanış→masraf, transfer→kapanış ve kapanış→transfer sıralarında eski kod kilitlemedi; yeni kod dört durumda da SQL 1222 ile ikinci işlemi bekletti. İlk transaction bırakılınca aynı ikinci sorgu başarılı oldu. Önceki davranış `--expect-vulnerable` ile düzeltme öncesinde kaydedildi; yeni kodda bu seçenek başarılı olmamalıdır.

Probe yalnız `commerce-sql-20260908`, 127.0.0.1:51433 ve tam fixture kimliği doğrulandıktan sonra düşük yetkili test hesabını kullanır. Bir geçici kasa oturumu eklenip finally içinde kaldırıldı. Altı tablonun önceki tüm satırları aynı kaldı: cash_sessions, finance_accounts, finance_account_movements, cash_expenses, cash_transfers, cash_session_counts. Identity sayacı ilerlemesi geri alınmaz. Masraf, transfer, tahsilat veya gerçek kapanış HTTP işlemi çalıştırılmadı.

158 API testi, 239 web kontrolü, API 152 kaynak kökü / sıfır tanı, lint ve web build PASS. Mevcut büyük bundle uyarısı sürer. UI değişmedi; bu tur tarayıcı kabulü yoktur. Codebase Memory 8628 düğüm/27175 kenar, 28 kısmi dosya/0 atlanan ve 3 cross HTTP bağlantısı; ilgili servis kaynağı doğrudan okundu. Cross taraması ilk denemede proje adı olmadan başarısız oldu, doğru aday adıyla başarılı tekrarlandı.

Test konteyneri durduruldu, volume korundu; canlı 4100/5173 süreçleri aynı kaldı. 66 depo, 2182 korunmuş dosya ve 6 onaylı canlı menü farkı doğrulandı. Push/PR/merge/deploy ve mesajlaşma işlemi yok.

Bu kabul tam ticari eşzamanlılık kabulü değildir. Tahsilat/ödeme/satışın aktif çekmece seçimi halen normal SELECT kullanıyor; açık oturum seçildikten sonra kapanışla yarışması ve açıkça verilen çekmece hesabının doğrulanması incelenecek. Eşzamanlı kasa açılışı da ayrı kabul bekliyor. Kaynak incelemesinde bunlar risk olarak görüldü; bu probe o yolları çalıştırmadı. Sonraki adım gerçek servis/HTTP düzeyinde tahsilat yönlendirmesi ve oturum açma yarışlarıdır.
