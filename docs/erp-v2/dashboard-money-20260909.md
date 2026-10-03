# Operasyon Masası: döviz ve ilk 20 alacak doğruluğu

**PASS_BOUNDED_DASHBOARD_MONEY_SQL_WEB.** Kod af98ffba637ae01f60ebe765145ca6d500942762; yalnız izole commerce adayı. Canlı menü onayı API/dashboard yayınlama yetkisi değildir; bu değişiklikler canlıya aktarılmadı.

Önceki ana ekran eksik kuru 1 alıyor; alacak kartı ve ilk 20 yoğunluğu yanlış hesaplanabiliyordu. İlk 20 kartı ayrıca yalnız dönen 10 liste satırını topluyordu. Şimdi güncel pozitif müşteri/tedarikçi bakiyeleri reportBalanceCtes ile aynı UTC rapor gününe kadar son kurdan değerlenir. Eksik/geçersiz kur tüm ilgili toplamı null yapar. İleri kur ve son geçersiz kayıttan daha eski kura kaçış yok. Negatif avanslar pozitif alacak/borç toplamına katılmaz.

İlk 20 SQL'de gerçek ilk 20 üzerinden hesaplanır; herhangi bir pozitif müşteri bakiyesinin kuru bilinmiyorsa sıralama/toplam/yoğunluk da bilinmez. Liste 10 satırla sınırlı kalır ve eksik kur satırlarını öne çıkarır. API native tutar, döviz, kur ve tarih döndürür. Risk 100000 TRY üzerindendir; kur bilinmiyorsa yüksek/orta risk uydurulmaz. Uyarılar tutarın para birimini taşır.

Bugünkü tahsilat/ödeme kartları dönem raporuyla aynı tarihsel işlem kuralını kullanır: işlem anı kur snapshotı olmayan dövizli hareket TRY'ye dönüştürülmez, native döviz tutarları ayrı sunulur. Aynı dövizde sıfırlanan hareketler tarihsel TRY bilgisi üretmez. Finans Özeti'nin güncel kurla değerleme alanları ayrı bir değerleme politikasıdır; bu dashboard kartları işlem TRY tutarı olarak etiketlidir. Fatura TRY/kâr snapshotları değişmez.

İlk 20 alanı sunucudan gelmediğinde kısmi listeden tahmin edilmez. Romanya ve fazla stok gibi sunucunun sağlamadığı ticari metrikler Veri yok; eksik kur Hesaplanamadı; gerçek sıfır 0 olarak ayrılır. Mesajlaşma kartının mevcut metadata/hesap satırı ve işleyicileri değiştirilmedi. Veriyi değiştirmeyen hafta/ay seçenekleri devre dışı ve Rapor Merkezi olarak etiketlidir; haftalık/aylık ana ekran özelliği geliştirildi iddiası yok.

## Kanıt

- 158 API ve 239 web kontrolü PASS; 8 yeni web davranış testi. API 152/web 184 kök, 0 tanı; lint/build PASS (mevcut paket boyutu uyarısı).
- Gerçek izole SQL/API: eksik kur, gerçek ilk 20/risk, ileri kur, son geçersiz kur/pozitif kapsam ve sıfırlanan tarihsel döviz hareketleri olmak üzere 5 senaryo PASS.
- Testte pozitif müşteri toplamı 351190 TRY; ilk 20 toplamı bağımsız SQL ile 348000 TRY; USD3000 →120000 TRY; EUR3000 tedarikçi→135000 TRY. İlk 10 daha küçük olup ilk 20 yerine kullanılmadı. Eksik USD kurunda pozitif EUR tedarikçi toplamı doğru kaldı; negatif USD avans bu toplamı bozmadı.
- Tarayıcı: yönetim ve finans görünümü; eksik toplam/yoğunluk; native satır ve risk; 1440×900 ve 1024×768 görselleri incelendi. Yakalanan sayfa JavaScript hatası 0. İlk test API süreci exit1 ile durdu ve giriş bağlantı hatası verdi; terminal durum/port yokluğu doğrulanıp yalnız test API yeniden başlatıldı. Sebep saptanmadı; sonraki SQL/browser kabulü geçti. Bu olay tüm çalışma zamanının hatasızlığı iddiasına dahil edilmez.
- 23 müşteri, 3 tedarikçi, 3 hareket ve 4 kur yalnız lab'da geçici olarak oluşturuldu ve kaldırıldı. Dokuz tablonun önceki tüm satırları birebir korundu; sentetik hareketlerin balance_effect=0 olması nedeniyle bu test tahsilat iş akışının kabulü sayılmaz.
- Test API/Vite/SQL durduruldu, disk korundu. Canlı API6608/Vite27264 değişmedi. Gerçek iş yazması/mesajlaşma/push/PR/merge/deploy 0.
- İndeks 8604 düğüm/27029 kenar + dört ilgili tüketiciyle 3 cross-HTTP; 28 kısmi parse/0 atlanan/89 dışlanan. Değişen kaynaklar doğrudan okundu; metadata_changed nedeniyle grafik tamlık kanıtı sayılmaz.

## Kalan işler

Genel ERP kabulü tamamlanmadı. Kasa eşzamanlılığı ve aktif çekmece yönlendirme, iptal/düzeltme, rapor indirme/yazdırma, üç ERP kaynak hattı ve sonraki Product Brain/katalog/site/Terminal/Shipping işleri açık. Dashboard'da ülke/fazla stok hesapları henüz sağlanmıyor; gerçek Veri yok olarak görünür. Listeler 10, uyarılar tür başına 10 ile sınırlı; tüm cari denetimi değildir. Ayrı paralel sorgular tek transaction anlık görüntüsü sağlamaz. Hata sırasında son başarılı görünüm kalabilir; hata mesajı görünür. Ana hedef IN_PROGRESS / ERP.
