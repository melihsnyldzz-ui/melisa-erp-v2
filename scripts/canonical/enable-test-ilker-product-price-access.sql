-- Human-authorized C09 permission: Ilker16, synthetic TEST prices only.
-- Source artifact; root runs the exact script after identity/before-image checks.
SET NOCOUNT ON; SET XACT_ABORT ON;
IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))<>N'Semih\MELISADEV' OR COALESCE(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 THROW 51097,'C09_PERMISSION_TEST_ADMIN_REQUIRED',1;
BEGIN TRY
 SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
 IF @lock<0 THROW 51097,'C09_PERMISSION_LOCK_REQUIRED',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.users u WITH(UPDLOCK,HOLDLOCK) JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=16 AND u.role_id=16 AND u.is_active=1 AND r.code=N'isolated_test_ilker') OR (SELECT COUNT(*) FROM dbo.users WHERE role_id=16)<>1 THROW 51097,'C09_PERMISSION_ACTOR_IDENTITY_REQUIRED',1;
 IF (SELECT COUNT(*) FROM dbo.permissions WHERE role_id=16 AND permission_key<>N'product.price.edit')<>22 OR (SELECT COUNT(DISTINCT permission_key) FROM dbo.permissions WHERE role_id=16 AND permission_key<>N'product.price.edit')<>22 OR EXISTS(SELECT 1 FROM dbo.permissions WHERE role_id=16 AND (permission_key IS NULL OR can_view IS NULL OR can_create IS NULL OR can_update IS NULL OR can_delete IS NULL OR can_approve IS NULL)) THROW 51097,'C09_PERMISSION_BASELINE_DRIFT',1;
 IF EXISTS(SELECT 1 FROM dbo.permissions WHERE role_id=16 AND permission_key NOT IN(N'supplier.view',N'supplier.edit',N'product.price.edit') AND(permission_key NOT IN(N'customer.view',N'dashboard.view',N'finance.collection',N'finance.collection.cancel',N'finance.payment',N'finance.payment.cancel',N'finance.refund',N'finance.view',N'goods.approve',N'goods.create',N'goods.reject',N'goods.view',N'product.view',N'purchase.cancel',N'purchase.create',N'purchase.finalize',N'purchase.view',N'sales.cancel',N'sales.view',N'stock.adjust') OR can_view<>1 OR can_create<>0 OR can_update<>0 OR can_delete<>0 OR can_approve<>0)) OR NOT EXISTS(SELECT 1 FROM dbo.permissions WHERE role_id=16 AND permission_key=N'supplier.view' AND can_view=1 AND can_create=0 AND can_update=0 AND can_delete=0 AND can_approve=0) OR NOT EXISTS(SELECT 1 FROM dbo.permissions WHERE role_id=16 AND permission_key=N'supplier.edit' AND can_view=0 AND can_create=0 AND can_update=1 AND can_delete=0 AND can_approve=0) THROW 51097,'C09_PERMISSION_BASELINE_DRIFT',1;
 DECLARE @before_count bigint=(SELECT COUNT_BIG(*) FROM dbo.permissions WHERE NOT(role_id=16 AND permission_key=N'product.price.edit'));
 DECLARE @before_hash char(64)=CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT p.* FROM dbo.permissions p WHERE NOT(p.role_id=16 AND p.permission_key=N'product.price.edit') ORDER BY p.id FOR JSON PATH,INCLUDE_NULL_VALUES)),2);
 DECLARE @present int=(SELECT COUNT(*) FROM dbo.permissions WHERE role_id=16 AND permission_key=N'product.price.edit');
 IF @present>0 BEGIN
  IF @present<>1 OR NOT EXISTS(SELECT 1 FROM dbo.permissions WHERE role_id=16 AND permission_key=N'product.price.edit' AND can_view=0 AND can_create=0 AND can_update=1 AND can_delete=0 AND can_approve=0) THROW 51097,'C09_PERMISSION_EXISTING_DRIFT',1;
  COMMIT; SELECT N'NOOP' result,0 permissionWrites; RETURN;
 END;
 INSERT dbo.permissions(role_id,permission_key,can_view,can_create,can_update,can_delete,can_approve,created_at,updated_at) VALUES(16,N'product.price.edit',0,0,1,0,0,SYSUTCDATETIME(),SYSUTCDATETIME());
 IF @before_count<>(SELECT COUNT_BIG(*) FROM dbo.permissions WHERE NOT(role_id=16 AND permission_key=N'product.price.edit')) OR @before_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',(SELECT p.* FROM dbo.permissions p WHERE NOT(p.role_id=16 AND p.permission_key=N'product.price.edit') ORDER BY p.id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) THROW 51097,'C09_PERMISSION_UNRELATED_DRIFT',1;
 COMMIT; SELECT N'INSTALLED' result,1 permissionWrites;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
-- Revoke only this exact newly created role16 key after an external before-image
-- and user scope check. This file grants no LIVE or general product/card write.
