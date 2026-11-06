// Exact existing getUserById/getPermissionKeys SELECTs. Source drift requires
// review; this is not a SELECT parser or arbitrary SQL forwarding API.
const QUERIES=Object.freeze([`
      SELECT TOP (1)
        u.id,
        u.username,
        u.display_name,
        u.password_hash,
        u.role_id,
        r.code AS role_code,
        r.name AS role_name,
        r.is_active AS role_is_active,
        CONVERT(varchar(18),CONVERT(binary(8),u.row_version),1) AS user_version,
        CONVERT(varchar(18),CONVERT(binary(8),r.row_version),1) AS role_version,
        u.is_active
      FROM dbo.users u
      INNER JOIN dbo.roles r ON r.id = u.role_id
      WHERE u.id = @userId;
    `,`
      SELECT
        permission_key,
        can_view,
        can_create,
        can_update,
        can_delete,
        can_approve
      FROM dbo.permissions
      WHERE role_id = @permissionRoleId
        AND (can_view = 1 OR can_create = 1 OR can_update = 1 OR can_approve = 1)
      ORDER BY permission_key ASC;
    `]);

// This is an internal prefix for the existing requireAuth SELECTs, not a
// reusable admission or a stored proof about a connection-pool object.
// Every guarded query is one Request/batch: the driver may choose a different
// physical connection for the next query, which must pass these checks again.
const GUARD=`IF ISNULL(DB_ID(),-1)<>18
 OR ISNULL(DB_NAME(),N'') COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01'
 OR ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV'
 OR ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')),N'') COLLATE Latin1_General_100_BIN2<>N'Semih'
 OR ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName')),N'') COLLATE Latin1_General_100_BIN2<>N'MELISADEV'
 OR ISNULL(SUSER_SNAME(),N'') COLLATE Latin1_General_100_BIN2<>N'melisa_sirket_test_20260929_01'
 OR ISNULL(USER_NAME(),N'') COLLATE Latin1_General_100_BIN2<>N'melisa_sirket_test_20260929_01'
BEGIN ;THROW 50000,N'CANONICAL_EXISTING_POOL_UNAVAILABLE',1; END
ELSE IF ISNULL(IS_SRVROLEMEMBER('sysadmin'),-1)<>0
 OR ISNULL(HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL'),-1)<>0
 OR ISNULL(HAS_PERMS_BY_NAME('dbo.sales_invoices','OBJECT','INSERT'),-1)<>0
 OR ISNULL(HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01'),-1)<>0
BEGIN ;THROW 50000,N'CANONICAL_EXISTING_POOL_UNAVAILABLE',1; END
ELSE IF EXISTS (
 SELECT permission_name FROM sys.fn_my_permissions(NULL,'DATABASE') WHERE permission_name IN ('INSERT','UPDATE','DELETE','EXECUTE','CONTROL','ALTER','TAKE OWNERSHIP')
 UNION SELECT p.permission_name FROM sys.tables t CROSS APPLY sys.fn_my_permissions(QUOTENAME(SCHEMA_NAME(t.schema_id))+'.'+QUOTENAME(t.name),'OBJECT') p WHERE p.permission_name IN ('INSERT','UPDATE','DELETE','ALTER','CONTROL','TAKE OWNERSHIP')
 UNION SELECT p.permission_name FROM sys.procedures t CROSS APPLY sys.fn_my_permissions(QUOTENAME(SCHEMA_NAME(t.schema_id))+'.'+QUOTENAME(t.name),'OBJECT') p WHERE p.permission_name='EXECUTE'
)
BEGIN ;THROW 50000,N'CANONICAL_EXISTING_POOL_UNAVAILABLE',1; END
ELSE BEGIN
`;

export function guardCanonicalReadonlyAuthQuery(text) {
  // Auth owns the fixed SQL and typed parameters. No HTTP value supplies SQL.
  // Reject other request APIs rather than forwarding execute/batch/stream.
  if(typeof text!=='string'||!QUERIES.includes(text)) throw Error('CANONICAL_EXISTING_POOL_UNAVAILABLE');
  return GUARD+text+'\nEND;';
}
