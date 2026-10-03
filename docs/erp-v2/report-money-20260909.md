# Yönetim ve dönem raporlarında para birimi doğruluğu

**PASS_BOUNDED_MANAGEMENT_PERIODIC_REPORT_MONEY_SQL_WEB.** Düzeltme yalnız izole commerce adayında; canlı 5173 menü aktarımına dahil değildir. Kod: 8982ae6e360bcf79c82d2e3e13db55c9361135d1.

Yönetim raporunda müşteri bakiyesi doğrudan TRY etiketleniyor, tedarikçi ve kart toplamlarında eksik kur 1 sayılıyordu. Artık iki tarafın güncel bakiyesi aynı rapor gününe kadar kaydedilmiş son kurla değerlenir. Son kayıt geçersizse eski kura kaçılmaz, ileri tarihli kur kullanılmaz. Eksik kurda satır ve etkilenen toplam null döner; sıfır bakiye 0 kalır, negatif bakiye korunur. Toplamlar ilk 10 görünen kayıttan bağımsızdır. Yüksek bakiye eşiği 100.000 TRY üzerinden uygulanır; kur bilinmiyorsa değerlendirme eksikliği görünür.

Yönetim API'si native bakiye, para birimi, kur, kur tarihi ve tüm para birimi gruplarını döndürür. Ekran Hesaplanamadı, kur bilgisi ve native tutarı gösterir. Açılan cari analiz tablosu tam genişlikte ve satır sararak okunur.

Dönem tahsilat/ödeme tablolarında işlem anı kur snapshotı bulunmuyor. Native USD/EUR tutarını TRY diye toplamak veya bugünkü kurdan tarihsel TRY üretmek kaldırıldı. Dönemsel financeByCurrency.amountTry ve etkilenen toplamlar null; native tahsilat ve ödeme döviz bazında ayrı korunur. Net native tutarı sıfırlayan geçmiş döviz hareketlerinde bile tarihsel TRY bilinmez. Fatura amount_try ve satış maliyet/kâr snapshotları değiştirilmez. Güncel cari bakiyeler dönem sonu bilançosu değildir; balanceAsOfDate ayrıca döner.

## Kabul

- 12 yeni davranış testi; toplam 158 API / 231 mevcut web kontrolü PASS. API 152 ve web 184 kök, 0 tanı; lint ve build PASS (mevcut büyük paket uyarısı).
- Ayrı SQL Server lab ve gerçek API: eksik kur ilk 10 dışında; geçerli USD40/EUR45; ileri kur99; son USD0 ve önceki39; birbirini götüren geçmiş hareketler; boş dönem olmak üzere 6 kabul senaryosu PASS.
- Sentetik güncel bakiyeler: USD3000 → 120000 TRY; EUR3000 → 135000 TRY; USD-2 → -80 TRY; sıfır JPY → 0. Genel müşteri 1220201 TRY ve tedarikçi 135030 TRY. Dönem fatura toplamları 210/120 TRY sabit; geçmiş USD5 tahsilat/EUR3 ödeme bugünkü kurdan bağımsız olarak bilinmeyen TRY.
- Tarayıcıda 1440×900 ve 1024×768: eksik tutarlar, döviz detayları, dönem özeti ve açılan USD müşteri satırı gözle incelendi. Tarayıcı hatası 0. Tutarı kesen dar kolon kusuru bu kontrolde giderildi.
- Son SQL turundaki 13 müşteri, 3 tedarikçi, 3 hareket ve 4 kur yalnız sentetik lab kayıtlarıdır; kaldırıldı. Dokuz tablodaki önceki tüm satırlar birebir korundu. Kontrol amacıyla doğrudan oluşturulan sentetik bakiyeler/movements ticari işlem akışı kabulü sayılmaz.
- SQL helper olağan test paketinin dışındadır; adlandırılmış makine, sabit loopback portu, DB ve fixture kimliğini denetler. Rapor API'si SELECT kullanır. Test API/web/SQL kapatıldı; disk korundu. Gerçek iş verisine yazma/mesajlaşma 0.

## Sınırlar ve devam

Bu kabul Rapor Merkezi içindeki yönetim ve dönem raporları içindir. Operasyon Masası dashboard/summary ve dashboard/alerts içindeki eski kur fallbackleri, ilk 20 yoğunluk hesabı ve veri olmayan kartların sıfır gösterimi hâlâ açık. Genel rapor tutarlılığı tamamlandı denmez. Ayrı sorgular anlık transaction snapshot garantisi sağlamaz; eşzamanlı veri değişiminde kartlar arası kesit farklı olabilir. Dönem filtrelerinin sınır/bozuk tarih kabulü ve günlük kasa 40 satır sınırı ayrıca incelenecek.

Excel/yazdırma satırlarında native tutar ve bilinmeyen değer korunur, çıktı adı yüklenen dönemi kullanır ve hata/yükleme sırasında butonlar kapanır. Gerçek dosya indirme/yazdırma bu kilometre taşında doğrulanmadı; stok değerleme indirme kabulü de açık. Yeni veri alanları ve null tutarlar için bilinen web tüketicisi güncellendi; tüm olası harici tüketiciler için garanti verilmez.

İndeks 8578 düğüm / 26902 kenar; dört ilgili tüketiciyle 3 cross-HTTP eşleşmesi. Bunlar canlı servis kanıtı değildir. 28 kısmi parse/0 atlanan/89 dışlanan dosya; değişen kaynaklar metadata_changed sinyali nedeniyle doğrudan incelendi. Push/PR/merge/deploy yok. Ana commerce hedefi IN_PROGRESS / ERP.
