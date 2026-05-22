# Melisa ERP v2 SQL Foundation

Bu klasor `MELISA_ERP_V2` icin SQL Server uyumlu database taslaklarini tutar.

## Guvenlik Siniri

- Scriptler bu sprintte calistirilmamistir.
- Hedef database sadece `MELISA_ERP_V2` olarak tasarlanmistir.
- Vega database veya baska bir database hedeflenmez.
- Review edilmeden production veya test SQL Server uzerinde calistirilmamalidir.
- Credential, connection string veya gercek kullanici sifresi bu klasore eklenmemelidir.

## Klasorler

- `migrations/`: Versiyonlu schema taslaklari.
- `seeds/`: Referans veri taslaklari.

## Ilk Dosyalar

- `migrations/0001_melisa_erp_v2_initial_schema.sql`
- `seeds/0001_reference_roles_permissions.sql`

## Calistirma Notu

Bu dosyalar ilk asamada taslak niteligindedir. SQL Server'a uygulanmadan once:

- Hedef database adinin `MELISA_ERP_V2` oldugu kontrol edilmelidir.
- Vega veya Vega test database secili olmadigi dogrulanmalidir.
- Backup ve rollback plani ayrica hazirlanmalidir.
- Uygulama servisleri henuz bu schema'ya bagli kabul edilmemelidir.
