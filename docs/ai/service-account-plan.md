# Melisa AI read-only ERP service account plan

Goal: create a dedicated ERP API identity for Melisa AI without reusing a human ERP account.

Safety boundaries:
- username: `melisa_ai_readonly`
- no hardcoded password or token in GitHub
- password generated locally at provisioning time and written only to the local Melisa AI private env file
- minimum read permissions only
- no sales/purchase create/edit/finalize/cancel permissions
- no product/customer/supplier edits
- no finance collection/payment
- no import, settings, CRM manage, or audit administration
- provisioning is idempotent and auditable
- rollback: deactivate the service user and remove its role permission rows

Required read permissions for current Melisa AI adapter are limited to product, customer and sales history reads. Before any write, the provisioning script validates the target database and live auth schema. Any unexpected schema stops the run without writes.
