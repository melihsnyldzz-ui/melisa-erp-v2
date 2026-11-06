// SOURCE ONLY: DDL for review, not an installer. Importing this module opens no
// connection. Target identity, migration ordering, existing schema fingerprint,
// authorization, rollback and a verified installer remain prerequisites.
// These tables record preparation; they never update stock or customer balances.
export const SALE_WORKFLOW_SCHEMA_PROPOSAL=Object.freeze([
 `CREATE TABLE dbo.desktop_sale_request_resolutions (
  request_id uniqueidentifier NOT NULL CONSTRAINT PK_desktop_sale_request_resolutions PRIMARY KEY,
  actor_id bigint NOT NULL,kind varchar(12) NOT NULL,payload_hash binary(32) NOT NULL,
  CONSTRAINT FK_desktop_resolution_actor FOREIGN KEY(actor_id) REFERENCES dbo.users(id),
  CONSTRAINT CK_desktop_resolution_kind CHECK(kind COLLATE Latin1_General_100_BIN2 IN ('draft','transition','dispatch'))
 );`,
 `CREATE UNIQUE INDEX UX_desktop_sale_item_identity ON dbo.sales_invoice_items(id,sales_invoice_id,product_id);`,
 `CREATE TABLE dbo.desktop_sale_workflows (
  invoice_id bigint NOT NULL CONSTRAINT PK_desktop_sale_workflows PRIMARY KEY,
  state varchar(16) NOT NULL,
  sent_by bigint NULL, prepared_by bigint NULL, checked_by bigint NULL,
  version rowversion NOT NULL,
  CONSTRAINT FK_desktop_workflow_invoice FOREIGN KEY(invoice_id) REFERENCES dbo.sales_invoices(id),
  CONSTRAINT FK_desktop_workflow_sender FOREIGN KEY(sent_by) REFERENCES dbo.users(id),
  CONSTRAINT FK_desktop_workflow_preparer FOREIGN KEY(prepared_by) REFERENCES dbo.users(id),
  CONSTRAINT FK_desktop_workflow_checker FOREIGN KEY(checked_by) REFERENCES dbo.users(id),
  CONSTRAINT CK_desktop_workflow_state CHECK(state COLLATE Latin1_General_100_BIN2 IN ('DRAFT','PREPARING','READY','CHECKED','COMPLETED','CANCELLED')),
  CONSTRAINT CK_desktop_workflow_actors CHECK(
   (state='DRAFT' AND sent_by IS NULL AND prepared_by IS NULL AND checked_by IS NULL) OR
   (state='PREPARING' AND sent_by IS NOT NULL AND prepared_by IS NULL AND checked_by IS NULL) OR
   (state='READY' AND sent_by IS NOT NULL AND prepared_by IS NOT NULL AND checked_by IS NULL) OR
   (state IN ('CHECKED','COMPLETED') AND sent_by IS NOT NULL AND prepared_by IS NOT NULL AND checked_by IS NOT NULL) OR
   state='CANCELLED')
 );`,
 `CREATE TABLE dbo.desktop_sale_reservations (
  invoice_id bigint NOT NULL, item_id bigint NOT NULL, product_id bigint NOT NULL,
  quantity decimal(18,3) NOT NULL, state varchar(12) NOT NULL,
  CONSTRAINT PK_desktop_sale_reservations PRIMARY KEY(invoice_id,item_id),
  CONSTRAINT UQ_desktop_reservation_line UNIQUE(invoice_id,item_id,product_id),
  CONSTRAINT FK_desktop_reservation_workflow FOREIGN KEY(invoice_id) REFERENCES dbo.desktop_sale_workflows(invoice_id),
  CONSTRAINT FK_desktop_reservation_item FOREIGN KEY(item_id,invoice_id,product_id) REFERENCES dbo.sales_invoice_items(id,sales_invoice_id,product_id),
  CONSTRAINT CK_desktop_reservation_quantity CHECK(quantity>0),
  CONSTRAINT CK_desktop_reservation_state CHECK(state COLLATE Latin1_General_100_BIN2 IN ('ACTIVE','RELEASED','DISPATCHED'))
 );`,
 `CREATE INDEX IX_desktop_active_reservations ON dbo.desktop_sale_reservations(product_id,state) INCLUDE(quantity,invoice_id);`,
 `CREATE TABLE dbo.desktop_sale_cartons (
  invoice_id bigint NOT NULL, carton_no int NOT NULL,
  CONSTRAINT PK_desktop_sale_cartons PRIMARY KEY(invoice_id,carton_no),
  CONSTRAINT FK_desktop_carton_workflow FOREIGN KEY(invoice_id) REFERENCES dbo.desktop_sale_workflows(invoice_id),
  CONSTRAINT CK_desktop_carton_number CHECK(carton_no>0)
 );`,
 `CREATE TABLE dbo.desktop_sale_carton_items (
  invoice_id bigint NOT NULL, carton_no int NOT NULL, item_id bigint NOT NULL, product_id bigint NOT NULL,
  quantity decimal(18,3) NOT NULL,
  CONSTRAINT PK_desktop_sale_carton_items PRIMARY KEY(invoice_id,carton_no,item_id),
  CONSTRAINT FK_desktop_carton_item_carton FOREIGN KEY(invoice_id,carton_no) REFERENCES dbo.desktop_sale_cartons(invoice_id,carton_no),
  CONSTRAINT FK_desktop_carton_item_reservation FOREIGN KEY(invoice_id,item_id,product_id) REFERENCES dbo.desktop_sale_reservations(invoice_id,item_id,product_id),
  CONSTRAINT CK_desktop_carton_item_quantity CHECK(quantity>0)
 );`,
 `CREATE TABLE dbo.desktop_sale_workflow_requests (
  request_id uniqueidentifier NOT NULL CONSTRAINT PK_desktop_sale_workflow_requests PRIMARY KEY,
  invoice_id bigint NOT NULL, actor_id bigint NOT NULL, operation varchar(24) NOT NULL,
  payload_hash binary(32) NOT NULL, result_json nvarchar(max) NOT NULL,
  CONSTRAINT FK_desktop_request_workflow FOREIGN KEY(invoice_id) REFERENCES dbo.desktop_sale_workflows(invoice_id),
  CONSTRAINT FK_desktop_request_actor FOREIGN KEY(actor_id) REFERENCES dbo.users(id),
  CONSTRAINT CK_desktop_request_operation CHECK(operation COLLATE Latin1_General_100_BIN2 IN ('CREATE_DRAFT','PREPARE','SAVE_CARTONS','READY','CHECK','DISPATCH','CANCEL')),
  CONSTRAINT CK_desktop_request_json CHECK(ISJSON(result_json)=1)
 );`
]);
export const SALE_WORKFLOW_SCHEMA_LIMITS=Object.freeze({sourceOnly:true,installed:false,sqlTested:false,grantsCreated:false,transitionsEnforcedBySchema:false,requiresAtomicService:true});
