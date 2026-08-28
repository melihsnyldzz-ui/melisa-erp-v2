# ERP Quick Search

`Ctrl+K` opens the web-admin Quick Search palette. The top-bar **Ara** button opens the same palette.

## Search Scope

- ERP screens and commands
- Products by stock code, barcode, name, brand, category, or supplier
- Customers by code, name, phone, city, or country
- Suppliers by code, name, phone, city, or country
- Sales invoices by document number or customer
- Purchase invoices by document number or supplier

Record search starts after two characters and uses read-only list endpoints. Selecting a result opens the existing ERP record tab; it does not create or update data.

Each source is queried independently. If one source is unavailable, results from the other sources remain usable and the palette displays a partial-results warning.
