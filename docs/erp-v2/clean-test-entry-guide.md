# Melisa ERP ve CRM — güncel giriş rehberi

24 Ekim 2026

Bu rehber, mevcut temiz ve örnek verili TEST kurulumu içindir. Gerçek işletme kullanımına geçiş onayı değildir.

## Açılacak adresler

Sunucu bilgisayarından veya aynı şirket ağına / şirket Wi-Fi ağına bağlı cihazdan:

| Uygulama | Adres |
|---|---|
| ERP — Ürün ve Stok | [ERP'yi aç](http://192.168.1.46:5244/ornek-akis.html#stock) |
| CRM | [CRM'yi aç](http://192.168.1.46:62800/) |

Kullanıcı adı: **semih**. Açık oturumla devam et. Giriş gerekiyorsa normal uygulama girişini kullan; TEST girişinin hazırlanması ajan tarafından yürütülür. Parolanı sohbete yazma veya paylaşma. Bu rehber parola içermez ve hesap/parola değiştirmez.

Personelin kendi hesabı ve görevleri ayrıca eşleştirilir; örnek hesaplar gerçek çalışanların yerine kullanılmaz. Semih'in mevcut yönetici hesabı korunur. CRM'nin hesap envanterini gösterebilmesi, gerçek personel eşlemesinin tamamlandığı anlamına gelmez.

Sunucu bilgisayarı açık, uygulamalar çalışır durumda olmalıdır. Şirket IP'sine kalıcı modem rezervasyonu doğrulanmamıştır. Adres değişirse sorumluya bildir. **Bu rehberde Tailscale aktif giriş seçeneği değildir; bağlantı veya güvenlik ayarı değiştirilmedi.**

## Sunucu bilgisayarında kolay açılış

Mevcut açılış dosyası:

`C:\Sirket\ERP\clean\20261022\Melisa-TEST-Ac.cmd`

- **C1:** Uygulamalar zaten açıkken ikinci kopya oluşturmadan açma yolu önceki teknik provada doğrulandı.
- **C2:** Uygulamalar kapalıyken mevcut açıcıyla açılması ve kayıtların korunması önceki teknik provada doğrulandı. Bu rehber güncellemesinde süreçler kapatılıp tekrar denenmedi.
- Kısmen açık veya yanlış hedef uyarısında başka eski açıcıları çalıştırma; görünen mesajı bildir.
- **C3:** Gerçek Windows yeniden başlatma / oturum açma kabulü ayrı bekliyor. C1/C2 sonucu bu kabulün yerine geçmez.
- Düzenli yedekleme (**C5**) ve yedeği ayrı yerde geri açma (**C6**) bu rehberle tamamlanmış sayılmaz.

## Başka cihazda kısa kontrol

Bu kabul henüz tamamlanmadı. Şirket ağındaki başka bilgisayardan veya şirket Wi-Fi ağına bağlı telefondan:

1. Yukarıdaki ERP ve CRM adreslerini aç. Açık oturum varsa devam et; giriş gerekiyorsa **semih** hesabının normal giriş ekranını kullan. Parola paylaşma.
2. ERP'de Ürün ve Stok'u, CRM'de mevcut konuşmadan Katalog'u aç. Bir ürünün fiyatını, para birimini ve varsa fotoğrafını görüntüle.
3. İki sayfayı da yenile. Oturum ve içerik korunuyorsa sonucu bildir. Sorunda uygulamanın adını, adımı ve görünen mesajı belirt; parola veya gizli bilgi gönderme.

Yeni satış, sipariş, ödeme, stok hareketi veya müşteri mesajı oluşturma. Sunucu bilgisayarında sayfaların açılmış olması başka cihaz kabulü değildir. **A2/A3 ve insan kabulü bekliyor.**

## Eski adresleri esas giriş olarak kullanma

| Port | Kayıtlı açıklama |
|---|---|
| 5194 | Eski TEST125 |
| 5234 | Önceki ortak ERP TEST |
| 62700 | Önceki CRM |
| 5188 / 4114 / 4116 | Eski üretim isimli kurulum |
| 5173 | Başka geliştirme sayfası; kaynak ve veritabanı kimliği kesinleştirilmemiş |

Bu tablo eski envanterdir; servislerin bugün çalıştığına ilişkin yeni kontrol yapılmadı. Eski kurulumlar kapatılmadı, taşınmadı veya silinmedi. Günlük TEST girişi için üstteki **5244 / 62800** adreslerini kullan.

Çalışan uygulamanın güncel kaynak/paket kaydı mevcut ERP `STATUS.md` ve ortak GitHub raporundadır. Bu rehber güncellemesi yeni uygulama kurulumu, yeniden başlatma veya veri aktarımı değildir.
