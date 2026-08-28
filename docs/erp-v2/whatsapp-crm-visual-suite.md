# WhatsApp CRM Görsel Çalışma Alanı

Tarih: 2026-08-16

## Amaç

WhatsApp CRM, görsel hedeflerdeki iş akışlarını tek bir çalışma alanında birleştirir:

- Gelen Kutusu: gerçek Chatwoot/Evolution konuşma akışı, yanıt, atama ve Müşteri 360.
- Müşteri Rehberi: ERP cari listesinden bağımsız CRM kişileri, ülke, personel, satış aşaması ve son iletişim.
- Teklif Hazırla: ERP stoklarından görselli ürün seçimi ve CRM teklif taslağı.
- Yönetim Paneli: gerçek konuşma özetleri, satış hunisi, personel iş yükü ve hat durumu.

## Veri doğruluğu

- Konuşmalar ve özetler WhatsApp CRM API'den okunur.
- Ürünler ERP API'den okunur.
- CRM kişi profili ana kayıttır; varsa ERP cari eşleşmesi yalnızca salt okunur referans olarak gösterilir.
- Güvenilir cevap süresi bulunmadığında boş veya örnek metrik gösterilmez.
- Ürün görseli bulunmadığında temsili ürün fotoğrafı üretilmez.
- Konuşma aşamaları API anahtarlarıyla filtrelenir; kullanıcıya Türkçe etiket gösterilir.

## Temel operasyon akışı

1. Gelen Kutusu'ndan konuşma seçilir ve müşteriye yanıt verilir.
2. Müşteri panelindeki personel alanından konuşma aktif personele atanır.
3. Yeni gelen kişi otomatik olarak CRM kişisi kabul edilir; ERP cari kartı açılmaz.
4. Aşama, not, görev, etiket, ürün ilgisi ve teklif Chatwoot CRM kaydında kalıcı tutulur.
5. ERP ürünleri seçilerek CRM kişisine teklif taslağı hazırlanır ve gönderim öncesi Gelen Kutusu'nda kontrol edilir.

## Güvenlik kapıları

- Teklif CRM kişi snapshot'ı ve ERP ürün satırlarıyla CRM taslağı olarak kaydedilir; ERP cari veya sipariş kaydı oluşturmaz.
- İskonto yetkisi ve ERP sipariş yazımı bağlı olmadığı için kullanıcıya çalışıyormuş gibi görünen kontroller gösterilmez.
- Yeni çalışma alanı kendi başına WhatsApp mesajı göndermez; gönderim mevcut Gelen Kutusu güvenlik kontrollerinde tamamlanır.

## Doğrulama

```powershell
node scripts\web-admin-crm-visual-suite-smoke.mjs
node scripts\web-admin-crm-workflow-smoke.mjs
node scripts\web-admin-crm-real-inbox-smoke.mjs
npm.cmd --prefix apps\web-admin run build
```
