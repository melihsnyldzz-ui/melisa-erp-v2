# ERP çıktı merkezi kabulü — 2026-09-10

Kod: 059c041ba02e66312ac1e28b7924f69ede685232. İzole commerce adayı; canlı aktarım yok.

Alış fişlerinin tarih filtresi artık her sayfa isteğine iletilir. Sunucunun daha küçük sayfa sınırı tüm kayıtları toplamayı erken bitirmez. Eksik/tekrarlanan sayfa hata verir; 20.000 sınırında eksik sonuç indirilemez. Filtre veya rapor değişince eski sonuç temizlenir ve geç gelen yanıt yeni raporu değiştiremez. Durum seçenekleri rapora uyarlanır, desteklenmeyen tarih/durum kontrolleri gizlenir. Bugünün tarihi yerel saatle hesaplanır.

## Kabul

- 218 smoke + 27 Node = 245 web kontrolü PASS; 185 kaynak, 0 tip tanısı; lint/build PASS (mevcut bundle uyarısı sürer).
- Gerçek ExportCenterScreen, yalnız sentetik GET yanıtlarıyla IAB içinde çalıştırıldı. Sunucu sayfa sınırı 25; üç alış isteğinde aynı 1–10 Eylül filtresi gözlendi. İndirilen gerçek XLSX tekrar okundu: 61 fiş, ALIS-003–ALIS-063; iki Ağustos fişi dışarıda, sıfır sayısal.
- Eski alış isteği beklerken stok raporu üç sayfayı bitirdi. Ardından eski alış isteğinin üç sayfası tamamlandığında ekran Stok Listesi/63 kayıt/stok kolonları olarak kaldı. Filtre ve rapor değişimi eski indirme düğmelerini kapattı.
- Devam eden ağ çağrıları iptal edilmez; eski sonuçların uygulanması engellenir.
- 66 depo/2182 korunmuş dosya ve 6 onaylı menü farkı korundu. İş verisi yazma ve mesajlaşma işlemi yok.

Bu sentetik API ile gerçek ekran/dosya kabulüdür; raporların gerçek SQL veri-paritesi veya native yazıcı kabulü değildir. ERP kaynak uzlaştırması ve diğer commerce projeleri açık; ana hedef IN_PROGRESS.
