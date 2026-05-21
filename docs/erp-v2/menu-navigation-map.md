# Melisa ERP v2 Menü ve Navigasyon Haritası

## Amaç

Bu dosya Melisa ERP v2 için ana menü ağacını, modül gruplarını, ekran tiplerini ve ekranların nasıl açılacağını tanımlar. Menü mantığı modern SaaS tarzı az menülü sade panel olarak değil, Vega/Wolvox benzeri yoğun masaüstü ERP yapısı olarak ele alınır.

Ana prensipler:

- Kullanıcı uygulamaya Ana Sayfa / Dashboard ile başlar.
- Üst menü ve sol işlem paneli ana navigasyon omurgasıdır.
- Liste, kart, fiş ve rapor ekranları sekme olarak açılır.
- Kısa seçim, onay ve yardımcı arama ekranları modal olarak açılır.
- Aynı anda birden fazla ekran açık kalabilir; kullanıcı sekmeler arasında geçiş yapar.
- Menüde modül görünürlüğü kullanıcı rolüne göre daraltılabilir, fakat ERP ana yapısı sadeleştirilip tek sayfalık panel haline getirilmez.

## Rol Tanımları

| Rol | Kullanım amacı |
| --- | --- |
| Patron | Genel durum, satış, karlılık, stok değeri, borç/alacak, katalog ve kritik uyarıları izler |
| Muhasebe | Satış/alış fişleri, cari hareketler, tahsilat/ödeme, rapor ve dışa aktarma ekranlarını kullanır |
| Admin | Ayarlar, kullanıcı/yetki, terminal yönetimi, audit ve sistem bakım ekranlarını yönetir |

## Açılma Tipi Kuralları

| Açılma tipi | Kullanım |
| --- | --- |
| Sekme | Ana liste, kart, fiş, rapor, dashboard ve ayar ekranları |
| Pencere | Aynı bağlamda tutulması gereken yoğun yardımcı ekranlar |
| Modal | Arama, seçim, onay, kısa düzenleme, belge iptal nedeni ve kritik işlem onayı |

## Ana Menü Ağacı

### Ana Sayfa / Dashboard

| Alt menü | Ekran tipi | Açılma tipi | Kullanıcı rolü | Öncelik |
| --- | --- | --- | --- | --- |
| Genel Dashboard | rapor | sekme | patron / muhasebe / admin | faz 1 |
| Patron Dashboard | rapor | sekme | patron / admin | faz 1 |
| Muhasebe Dashboard | rapor | sekme | muhasebe / admin | faz 1 |
| Kritik Uyarılar | liste | sekme | patron / muhasebe / admin | faz 1 |
| Eksi Stok Uyarıları | liste | sekme | patron / muhasebe / admin | faz 1 |
| Hatalı Terminal Sync | liste | sekme | muhasebe / admin | faz 1 |
| Dashboard Kutuları Ayarı | ayar | sekme | patron / muhasebe / admin | faz 2 |

### Stok

| Alt menü | Ekran tipi | Açılma tipi | Kullanıcı rolü | Öncelik |
| --- | --- | --- | --- | --- |
| Stok Listesi | liste | sekme | patron / muhasebe / admin | faz 1 |
| Ürün Kartı | kart | sekme | muhasebe / admin | faz 1 |
| Yeni Ürün Kartı | kart | sekme | muhasebe / admin | faz 1 |
| Stok Hareketleri | liste | sekme | patron / muhasebe / admin | faz 1 |
| Barkodlar / Diğer Barkodlar | liste | sekme | muhasebe / admin | faz 1 |
| Barkod Ekle / Düzenle | modal | modal | muhasebe / admin | faz 1 |
| Stok Düzeltme | fiş | pencere | admin | faz 2 |
| Pasif Ürünler | liste | sekme | muhasebe / admin | faz 2 |
| Barkod Etiketi Basımı | ayar | sekme | muhasebe / admin | faz 2 |
| Toplu Ürün Import | ayar | sekme | admin | sonra |

### Satış

| Alt menü | Ekran tipi | Açılma tipi | Kullanıcı rolü | Öncelik |
| --- | --- | --- | --- | --- |
| Satış Fişleri | liste | sekme | patron / muhasebe / admin | faz 1 |
| Yeni Satış Fişi | fiş | sekme | muhasebe / admin | faz 1 |
| Satış Fişi Detayı | fiş | sekme | patron / muhasebe / admin | faz 1 |
| Taslak Satış Fişleri | liste | sekme | muhasebe / admin | faz 1 |
| Terminalden Gelen Satışlar | liste | sekme | muhasebe / admin | faz 1 |
| Fiş İptal Onayı | modal | modal | admin | faz 1 |
| Fiyat Değişiklik Onayı | modal | modal | muhasebe / admin | faz 1 |
| Satış Fişi Yazdırma | modal | modal | muhasebe / admin | faz 2 |
| Satış İskonto Yetkisi Kontrolü | modal | modal | muhasebe / admin | faz 2 |

### Alış

| Alt menü | Ekran tipi | Açılma tipi | Kullanıcı rolü | Öncelik |
| --- | --- | --- | --- | --- |
| Alış Fişleri | liste | sekme | muhasebe / admin | faz 1 |
| Yeni Alış Fişi | fiş | sekme | muhasebe / admin | faz 1 |
| Alış Fişi Detayı | fiş | sekme | muhasebe / admin | faz 1 |
| Tedarikçi Bazlı Alışlar | liste | sekme | muhasebe / admin | faz 2 |
| Son Alış Fiyatları | liste | sekme | muhasebe / admin | faz 2 |
| Tedarikçi Anlaşmaları | kart | sekme | muhasebe / admin | sonra |
| Alış Fişi İptal Onayı | modal | modal | admin | faz 2 |

### Cari

| Alt menü | Ekran tipi | Açılma tipi | Kullanıcı rolü | Öncelik |
| --- | --- | --- | --- | --- |
| Cari Listesi | liste | sekme | patron / muhasebe / admin | faz 1 |
| Müşteri Kartı | kart | sekme | muhasebe / admin | faz 1 |
| Tedarikçi Kartı | kart | sekme | muhasebe / admin | faz 1 |
| Cari Ekstre | rapor | sekme | patron / muhasebe / admin | faz 1 |
| Cari Hareketleri | liste | sekme | patron / muhasebe / admin | faz 1 |
| Tahsilat / Ödeme Girişi | fiş | sekme | muhasebe / admin | faz 2 |
| Bakiye Risk Uyarıları | liste | sekme | patron / muhasebe / admin | faz 2 |
| Cari Silme / Pasifleştirme Onayı | modal | modal | admin | faz 2 |

### Katalog

| Alt menü | Ekran tipi | Açılma tipi | Kullanıcı rolü | Öncelik |
| --- | --- | --- | --- | --- |
| Katalog Listesi | liste | sekme | patron / muhasebe / admin | faz 1 |
| Katalog Oluştur | fiş | sekme | muhasebe / admin | faz 1 |
| Genel Kataloglar | liste | sekme | patron / muhasebe / admin | faz 1 |
| Müşteriye Özel Kataloglar | liste | sekme | muhasebe / admin | faz 1 |
| Katalog Ürün Seçimi | modal | modal | muhasebe / admin | faz 1 |
| Görsel Eşleştirme | liste | sekme | muhasebe / admin | faz 2 |
| Katalog Performansı | rapor | sekme | patron / muhasebe / admin | faz 2 |
| Katalog Ayarları | ayar | sekme | admin | faz 2 |
| Dil / WhatsApp Şablonları | ayar | sekme | admin | sonra |

### Raporlar

| Alt menü | Ekran tipi | Açılma tipi | Kullanıcı rolü | Öncelik |
| --- | --- | --- | --- | --- |
| Günlük Satış Raporu | rapor | sekme | patron / muhasebe / admin | faz 1 |
| Stok Değeri Raporu | rapor | sekme | patron / muhasebe / admin | faz 1 |
| Cari Borç / Alacak Raporu | rapor | sekme | patron / muhasebe / admin | faz 1 |
| Satış Hareketleri Raporu | rapor | sekme | patron / muhasebe / admin | faz 1 |
| Alış Hareketleri Raporu | rapor | sekme | muhasebe / admin | faz 1 |
| Tedarikçi Performansı | rapor | sekme | patron / muhasebe / admin | faz 2 |
| En Çok Satan Ürünler | rapor | sekme | patron / muhasebe / admin | faz 2 |
| Katalog Performans Raporu | rapor | sekme | patron / muhasebe / admin | faz 2 |
| Audit Raporu | rapor | sekme | admin | faz 2 |
| Excel / PDF Dışa Aktarma | modal | modal | muhasebe / admin | faz 1 |

### Terminal Yönetimi

| Alt menü | Ekran tipi | Açılma tipi | Kullanıcı rolü | Öncelik |
| --- | --- | --- | --- | --- |
| Terminal Cihazları | liste | sekme | admin | faz 1 |
| Terminal Kullanıcıları | liste | sekme | admin | faz 1 |
| Terminal Yetkileri | ayar | sekme | admin | faz 1 |
| Sync Durumu | liste | sekme | muhasebe / admin | faz 1 |
| Hatalı Sync Kayıtları | liste | sekme | muhasebe / admin | faz 1 |
| Offline Kuyruk İzleme | liste | sekme | admin | faz 2 |
| Terminal Cihaz Detayı | kart | pencere | admin | faz 2 |
| Terminal Oturum Kapatma | modal | modal | admin | faz 2 |

### Ayarlar

| Alt menü | Ekran tipi | Açılma tipi | Kullanıcı rolü | Öncelik |
| --- | --- | --- | --- | --- |
| Firma Bilgileri | ayar | sekme | admin | faz 1 |
| Kullanıcı Ayarları | ayar | sekme | admin | faz 1 |
| Döviz / Para Birimi Ayarları | ayar | sekme | admin | faz 1 |
| Satış Ayarları | ayar | sekme | admin | faz 2 |
| Alış Ayarları | ayar | sekme | admin | faz 2 |
| Stok Ayarları | ayar | sekme | admin | faz 2 |
| Dashboard Limitleri | ayar | sekme | patron / admin | faz 2 |
| Yazdırma Şablonları | ayar | sekme | admin | faz 2 |
| Barkod Etiket Şablonları | ayar | sekme | admin | sonra |
| Import / Export Ayarları | ayar | sekme | admin | sonra |

### Yetki / Audit

| Alt menü | Ekran tipi | Açılma tipi | Kullanıcı rolü | Öncelik |
| --- | --- | --- | --- | --- |
| Kullanıcılar | liste | sekme | admin | faz 1 |
| Kullanıcı Kartı | kart | sekme | admin | faz 1 |
| Rol ve Yetki Matrisi | ayar | sekme | admin | faz 1 |
| Kritik İşlem Yetkileri | ayar | sekme | admin | faz 1 |
| Audit Log | liste | sekme | admin | faz 1 |
| Fiş İptal Logları | liste | sekme | admin | faz 2 |
| Fiyat Değişiklik Logları | liste | sekme | admin | faz 2 |
| Stok Düzeltme Logları | liste | sekme | admin | faz 2 |
| Kullanıcı / Yetki Değişiklik Logları | liste | sekme | admin | faz 2 |
| Audit Detay İnceleme | modal | modal | admin | faz 2 |

## Navigasyon Akışı

### Dashboard'dan açılan ana geçişler

| Dashboard kutusu | Hedef ekran | Açılma tipi |
| --- | --- | --- |
| Günlük satış | Günlük Satış Raporu | sekme |
| Toplam stok değeri | Stok Değeri Raporu | sekme |
| Eksi stok uyarısı | Eksi Stok Uyarıları | sekme |
| Müşteri borçları | Cari Borç / Alacak Raporu | sekme |
| Tedarikçi borçları | Cari Borç / Alacak Raporu | sekme |
| Hatalı terminal sync | Hatalı Sync Kayıtları | sekme |
| Katalog performansı | Katalog Performansı | sekme |

### Liste ekranlarından açılan geçişler

| Kaynak ekran | Hedef ekran | Açılma tipi |
| --- | --- | --- |
| Stok Listesi | Ürün Kartı | sekme |
| Stok Listesi | Barkod Ekle / Düzenle | modal |
| Satış Fişleri | Satış Fişi Detayı | sekme |
| Alış Fişleri | Alış Fişi Detayı | sekme |
| Cari Listesi | Müşteri Kartı / Tedarikçi Kartı | sekme |
| Katalog Listesi | Katalog Oluştur / Düzenle | sekme |
| Audit Log | Audit Detay İnceleme | modal |

## Vega/Wolvox Menü Mantığı

Melisa ERP v2 menüsü çok az seçenekli modern SaaS panel yapısına indirgenmeyecektir. Kullanıcı, yoğun ERP çalışma düzeninde modül ağacı, alt menüler, kısayollar, açık sekmeler ve bağlamsal işlem paneliyle çalışacaktır.

Menü tasarımında korunacak kurallar:

- Ana modüller üst menüde ve/veya sol modül ağacında görünür olmalıdır.
- Alt menüler işlem tipine göre gruplanmalıdır: listeler, kartlar, fişler, raporlar, ayarlar.
- Sık kullanılan ekranlar tek tıkla açılmalıdır.
- Kritik işlemler modal onay ve audit kaydı mantığıyla bağlanmalıdır.
- Depo personeli web-admin ana menüsünde hedef kullanıcı değildir; depo operasyonu terminal uygulamasından yürür.
- Terminal Yönetimi web-admin içinde admin/muhasebe izleme ve yönetim modülü olarak kalır.

## Faz 1'de Açılacak İlk Ekranlar

Faz 1 için ilk açılacak ekranlar:

1. Genel Dashboard
2. Patron Dashboard
3. Muhasebe Dashboard
4. Kritik Uyarılar
5. Stok Listesi
6. Ürün Kartı
7. Yeni Ürün Kartı
8. Stok Hareketleri
9. Barkodlar / Diğer Barkodlar
10. Satış Fişleri
11. Yeni Satış Fişi
12. Taslak Satış Fişleri
13. Terminalden Gelen Satışlar
14. Alış Fişleri
15. Yeni Alış Fişi
16. Cari Listesi
17. Müşteri Kartı
18. Tedarikçi Kartı
19. Cari Ekstre
20. Katalog Listesi
21. Katalog Oluştur
22. Günlük Satış Raporu
23. Stok Değeri Raporu
24. Cari Borç / Alacak Raporu
25. Terminal Cihazları
26. Sync Durumu
27. Firma Bilgileri
28. Kullanıcılar
29. Rol ve Yetki Matrisi
30. Audit Log
