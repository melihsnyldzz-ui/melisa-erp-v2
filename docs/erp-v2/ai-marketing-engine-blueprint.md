# Melisa ERP v2 AI Marketing Engine Blueprint

## Amaç ve Konumlandırma

Melisa ERP v2, klasik bir stok, cari ve fatura takip sistemi olmanın ötesine geçerek Melisa Bebe'nin gerçek ticari hafızasını kullanan AI destekli bir ticaret işletim sistemine dönüşmelidir.

Bu blueprint'in amacı; müşteri bulan, müşteri takip eden, ürün öneren, riskleri erken gösteren ve satış ekibine günlük aksiyon öneren AI modüllerini tanımlamaktır. Bu sprintte kod, SQL, API veya migration değişikliği yoktur; doküman stratejik ürün tasarımı seviyesindedir.

## Gerçek İş Modeli Varsayımları

- Yaklaşık 250 müşteri vardır.
- Romanya toplam satışın yaklaşık %50'sini oluşturur.
- Balkan ülkeleri ana pazardır.
- Ukrayna, Rusya, Gürcistan ve Ermenistan müşterileri vardır.
- Açık hesap çalışılır.
- Toplam alacak 600.000-700.000 USD seviyesine çıkabilir.
- İlk 10 müşteri toplam alacağın yaklaşık yarısını oluşturabilir.
- 4.000-5.000 aktif barkodlu ürün vardır.
- Satış kanalları dükkan ve WhatsApp'tır.
- Ürün fotoğrafları WhatsApp gruplarında paylaşılır.
- Müşteriler fotoğraf gördükten sonra ürün sorar veya siparişe döner.
- Personel ürün önerirken yeni gelenleri, çok satanları, stokta çok olanları, müşterinin bütçesini, ülkesini ve geçmiş alışkanlıklarını birlikte değerlendirir.

## 1. AI Sales Recommendation Engine

### Ana Soru

ERP şu soruya cevap verebilmelidir:

> Bu müşteriye bugün hangi ürünleri göstermeliyim?

### Kullanılacak Veriler

- Müşteri ülkesi
- Geçmiş siparişleri
- Kategori geçmişi
- Ürün stok durumu
- Satış hızı
- Kar oranı
- Müşterinin ortalama sipariş bütçesi
- Müşterinin daha önce aldığı beden, yaş grubu, sezon ve ürün tipi eğilimleri
- Ürünün yeni gelmiş olması
- Ürünün elde kalma riski

### Öneri Mantığı

Sistem her müşteri için ürünleri puanlamalıdır. Puanlama yalnızca "çok satan" yaklaşımıyla yapılmamalıdır; ülke, müşteri tipi, stok ve kar dengesi birlikte ele alınmalıdır.

Örnek puan bileşenleri:

- Ülke uyumu
- Müşterinin geçmiş kategori uyumu
- Son 30/60/90 günlük satış hızı
- Stok yeterliliği
- Kar marjı
- Yeni ürün avantajı
- Fazla stok eritme önceliği
- Müşterinin bütçe aralığına uygunluk

### Beklenen Çıktılar

- Müşteri bazlı önerilen ürün listesi
- Öneri gerekçesi
- Tahmini ilgi seviyesi
- Ürün fotoğraf paylaşım önceliği
- Alternatif ürünler
- Benzer müşteri gruplarında performans bilgisi

Örnek cevap:

> Bu müşteriye bugün 2-4 yaş kız çocuk takımları, yeni sezon tulumlar ve stokta yüksek kalan pamuklu ürünler gösterilmeli. Romanya müşterilerinde bu kategori son 30 günde hızlı dönüyor ve müşterinin geçmiş siparişleri aynı yaş grubuna yoğunlaşmış.

## 2. AI Customer Reactivation Engine

### Ana Soru

ERP hangi müşterilerin yeniden aktive edilmesi gerektiğini bulmalıdır.

### Segmentler

- 30 gün sipariş vermeyen müşteriler
- 60 gün sipariş vermeyen müşteriler
- 90 gün sipariş vermeyen müşteriler

### AI Aksiyon Önerileri

- Yeniden yaz
- Katalog gönder
- Kampanya gönder
- Yeni gelen ürünleri paylaş
- Eski aldığı kategorilerden yeni ürün öner
- Borç riski yüksekse satış önermeden önce ödeme hatırlat

### Önceliklendirme

Her pasif müşteri aynı önemde değildir. Sistem aşağıdaki unsurlara göre öncelik vermelidir:

- Geçmiş toplam ciro
- Son satın alma tarihi
- Ortalama sipariş tutarı
- Açık hesap bakiyesi
- Ödeme alışkanlığı
- Ülke ve pazar potansiyeli
- Daha önce düzenli alım yapıp yapmadığı

### Beklenen Çıktılar

- Bugün yazılması gereken müşteri listesi
- Pasiflik süresi
- Önerilen mesaj tipi
- Önerilecek ürün/kategori
- Risk uyarısı

Örnek cevap:

> Romanya'dan 8 müşteri 60 gündür sipariş vermiyor. Bunlardan 3 tanesi yüksek ciro geçmişine sahip ve açık hesap riski düşük. Öncelikle bu müşterilere yeni sezon katalog paylaşımı yapılmalı.

## 3. AI WhatsApp Marketing Engine

### Amaç

WhatsApp, Melisa Bebe'nin en önemli satış kanallarından biridir. AI sistemi, hangi ürün fotoğraflarının hangi müşteri grubuna ve hangi sırayla paylaşılması gerektiğini önermelidir.

### Üretilecek Çıktılar

- Ürün paylaşım listesi
- Grup paylaşım planı
- WhatsApp mesaj taslağı
- Ülkeye özel paylaşım önerisi
- Müşteri özelinde ürün fotoğraf seti
- Kampanya ve stok eritme paylaşım önerisi

### Paylaşım Planı Mantığı

Sistem paylaşım planını şu faktörlere göre oluşturmalıdır:

- Ülke bazlı talep eğilimi
- Mevsim ve sezon
- Yeni gelen ürünler
- Stokta çok olan ürünler
- Hızlı satan ürünler
- Kar marjı yüksek ürünler
- Daha önce fotoğraf paylaşımından siparişe dönen ürünler

### WhatsApp Mesaj Taslakları

Mesaj taslakları kısa, satış odaklı ve ülkeye uygun olmalıdır. Sistem dil ve ton önerisi yapabilir, ancak ilk fazda mesajları Türkçe iç satış ekibi için hazırlamak yeterlidir.

Örnek mesaj:

> Merhaba, bugün Romanya müşterilerimiz için hızlı dönen yeni sezon ürünleri hazırladık. Özellikle 2-6 yaş arası takımlar stokta güçlü ve tekrar siparişe uygun. Fotoğrafları paylaşıyorum.

### Ülkeye Özel Paylaşım

Romanya için daha geniş ürün seti ve düzenli katalog akışı önerilirken, daha küçük pazarlarda daha seçici ve bütçeye uygun paylaşım yapılmalıdır. Örneğin Gürcistan ve Ermenistan müşterilerine geçmiş siparişlerine daha yakın, düşük riskli ürün grupları önerilebilir.

## 4. AI Customer Risk Engine

### Amaç

Açık hesap yapısı nedeniyle müşteri riski yalnızca muhasebe konusu değildir; satış kararlarının merkezinde olmalıdır. ERP, satış önerisi yaparken müşterinin alacak riskini de dikkate almalıdır.

### Risk Bileşenleri

- Açık hesap bakiyesi
- Gecikmiş ödeme tutarı
- Ortalama ödeme gecikmesi
- Son ödeme tarihi
- Son sipariş tarihi
- Ülke riski
- Müşteri konsantrasyonu
- İlk 10 müşteri içindeki ağırlık
- Toplam alacak içindeki pay

### Risk Skoru

Müşteriler A/B/C/D şeklinde sınıflandırılmalıdır.

- A: Düşük risk, düzenli ödeme, satış artırılabilir.
- B: Normal risk, kontrollü satış yapılabilir.
- C: Dikkatli izlenmeli, ödeme hatırlatma ile satış yapılmalı.
- D: Yüksek risk, yeni satıştan önce tahsilat öncelikli olmalı.

### Beklenen Çıktılar

- En riskli müşteriler
- En yüksek açık hesaplı müşteriler
- Gecikmiş ödeme listesi
- Satışa devam edilebilir müşteriler
- Tahsilat öncelikli müşteriler
- Ülke bazlı toplam risk haritası

Örnek cevap:

> İlk 10 müşteri toplam alacağın yaklaşık yarısını oluşturuyor. Bu grupta 2 müşteri D risk seviyesine yaklaşmış. Yeni ürün önerisi yapılmadan önce ödeme planı konuşulmalı.

## 5. AI Product Health Engine

### Amaç

ERP, ürünleri yalnızca stok kodu ve barkod olarak değil, ticari sağlık durumuna göre sınıflandırmalıdır.

### Ürün Sınıfları

- Yıldız ürün
- Hızlı satıyor
- Yavaş satıyor
- Stok eritilmeli
- Zarar ettiriyor

### Kullanılacak Veriler

- Mevcut stok
- Satış hızı
- Son satış tarihi
- Alış maliyeti
- Satış fiyatı
- Kar oranı
- İade veya problem geçmişi
- Ülke bazlı performans
- Benzer ürünlere göre dönüş hızı

### Sınıflandırma Mantığı

- Yıldız ürün: Hızlı satıyor, karı iyi, tekrar sipariş potansiyeli yüksek.
- Hızlı satıyor: Talep güçlü, stok takibi kritik.
- Yavaş satıyor: Satış hızı düşük, paylaşım veya kampanya gerekebilir.
- Stok eritilmeli: Stok yüksek, hareket düşük, nakit bağlama riski var.
- Zarar ettiriyor: Marj düşük veya operasyonel maliyet satış değerini aşıyor.

### Beklenen Çıktılar

- Günlük öne çıkarılacak ürünler
- Kampanyaya alınacak ürünler
- Tekrar satın alma önerisi olan ürünler
- Stok eritme listesi
- Kar marjı yüksek ürün listesi

## 6. AI Country Intelligence

### Amaç

Melisa Bebe'nin ana pazarı Balkanlar ve çevre ülkelerdir. ERP ülke bazlı ticari hafıza üretmelidir.

### Ülke Bazlı Analiz Alanları

Her ülke için şu başlıklar izlenmelidir:

- Toplam satış
- Aktif müşteri sayısı
- Pasif müşteri sayısı
- Ortalama sipariş tutarı
- En çok satan kategoriler
- En hızlı dönen ürünler
- Açık hesap toplamı
- Risk skoru dağılımı
- Kar marjı eğilimi
- Stok önerisi
- WhatsApp paylaşım stratejisi

### Ülkeler

#### Romanya

Toplam satışın yaklaşık %50'sini oluşturduğu için ana pazar olarak ele alınmalıdır. Romanya için ayrı dashboard, daha sık ürün önerisi, daha güçlü katalog akışı ve yüksek müşteri konsantrasyonu takibi gereklidir.

#### Bulgaristan

Balkan pazarı içinde düzenli takip edilecek ülkelerden biridir. Romanya kadar büyük olmasa da kategori eğilimleri Romanya ile karşılaştırılmalıdır.

#### Moldova

Romanya ile ticari davranış benzerlikleri taşıyabilir. Ürün önerileri Romanya verisiyle kıyaslanarak güçlendirilebilir.

#### Sırbistan

Pazar davranışı ayrı izlenmeli, kategori ve fiyat hassasiyeti analiz edilmelidir.

#### Kosova

Daha küçük müşteri gruplarında müşteri bazlı öneri ülke ortalamasından daha önemli olabilir.

#### Kuzey Makedonya

Ülke bazlı satış hacmi, ödeme davranışı ve kategori tercihi düzenli ölçülmelidir.

#### Gürcistan

Uzak pazar niteliği nedeniyle ürün önerilerinde bütçe, lojistik ve ödeme riski daha dikkatli değerlendirilmelidir.

#### Ermenistan

Müşteri özelinde geçmiş sipariş ve ödeme davranışı öne çıkarılmalıdır. Ürün önerileri daha kontrollü yapılmalıdır.

## 7. AI Command Center

### Amaç

Kullanıcı ERP'ye doğal dilde soru sorabilmeli ve sistem günlük ticari aksiyon üretmelidir.

### Örnek Komutlar

> bugün ne paylaşayım

> hangi müşteriye yazayım

> hangi ürünleri öne çıkarayım

> en riskli müşteriler

> en karlı ürünler

### Beklenen Cevap Yapısı

Her cevap yalnızca bilgi vermemeli, aksiyon önermelidir.

Örnek:

> Bugün Romanya müşterilerine yeni gelen 2-6 yaş ürünleri paylaş. 60 gündür sipariş vermeyen 5 müşteriye ayrıca eski aldıkları kategorilerden ürün öner. Riskli müşterilerden önce ödeme planı iste.

### Komut Merkezi Modülleri

- Günlük satış önerileri
- Müşteri geri kazanım önerileri
- WhatsApp paylaşım önerileri
- Risk uyarıları
- Ürün sağlığı özetleri
- Ülke bazlı fırsatlar

## 8. AI Marketing Roadmap

### Faz 1: Müşteri Geri Kazanım

- 30/60/90 gün sipariş vermeyen müşterilerin listelenmesi
- Müşteri bazlı yeniden iletişim önerileri
- Basit mesaj taslakları
- Riskli müşteriler için tahsilat uyarısı

### Faz 2: Ürün Öneri Motoru

- Müşteri geçmişine göre ürün önerisi
- Ülke ve kategori uyumu
- Stok ve satış hızı dengesi
- Kar marjı önceliği

### Faz 3: WhatsApp Önerileri

- Günlük ürün paylaşım listesi
- Grup paylaşım planı
- Ülkeye özel mesaj taslakları
- Fotoğraf paylaşımı sonrası sipariş dönüşlerinin izlenmesi

### Faz 4: Ülke Bazlı Analiz

- Romanya odaklı ana pazar analizi
- Balkan ülkeleri karşılaştırması
- Ülke bazlı risk, kar ve kategori raporları
- Ülke özelinde paylaşım stratejisi

### Faz 5: Doğal Dil Komut Sistemi

- Kullanıcının günlük sorularına cevap veren AI Command Center
- "Bugün ne paylaşayım?" gibi aksiyon odaklı komutlar
- Risk, ürün ve müşteri bilgisinin tek cevapta birleşmesi

### Faz 6: Yarı Otonom Satış Asistanı

- Günlük müşteri yazma listesi
- Ürün fotoğraf seti önerisi
- Mesaj taslağı üretimi
- Satış ve tahsilat önceliğini birlikte yöneten asistan
- Son kararın kullanıcıda kaldığı kontrollü otomasyon

## Melisa ERP v2 Neden Klasik ERP'den Farklı Olacak?

Klasik ERP geçmişi kaydeder; Melisa ERP v2 gelecekteki ticari aksiyonu önerir.

Klasik ERP stok, cari ve fatura gösterir. Melisa ERP v2 ise şu sorulara cevap verir:

- Bugün hangi müşteriye yazmalıyım?
- Hangi ürünleri göstermeliyim?
- Hangi müşteri riskli?
- Hangi ürün stok eritme adayı?
- Hangi ülkeye hangi kategoriyle gitmeliyim?
- Hangi müşteriyi kaybetmeden geri kazanabilirim?

Melisa Bebe'nin gerçek gücü yalnızca ürün sayısında değil, yıllar içinde oluşan müşteri, ülke, ürün ve ödeme hafızasındadır. AI Marketing Engine bu hafızayı sistematik hale getirerek satış ekibinin sezgisel kararlarını ölçülebilir, tekrarlanabilir ve ölçeklenebilir hale getirir.

Bu nedenle Melisa ERP v2, sadece kayıt tutan bir ERP değil; müşteri bulan, müşteriyi geri kazanan, doğru ürünü doğru pazara öneren ve açık hesap riskini satış kararının içine alan AI destekli bir ticaret işletim sistemi olacaktır.
