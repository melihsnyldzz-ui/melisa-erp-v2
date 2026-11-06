// The connector selects a finite schema; rich V3 is never silently upgraded.
export function desktopMasterSchema(richCards,schemaVersion=richCards?3:2){
 if(typeof richCards!=='boolean'||!Number.isInteger(schemaVersion)||(richCards?![3,4].includes(schemaVersion):schemaVersion!==2))throw Error('DESKTOP_MASTER_VERSION_INVALID');return schemaVersion;
}
export const DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL=`
IF NOT EXISTS(SELECT 1 FROM sys.indexes i WHERE i.object_id=OBJECT_ID(N'dbo.party_currency_accounts') AND i.name=N'UX_desktop_v4_customer_currency' AND i.is_unique=1 AND i.is_disabled=0 AND i.has_filter=1
 AND CONVERT(varbinary(max),i.filter_definition)=CONVERT(varbinary(max),N'([customer_id] IS NOT NULL AND [supplier_id] IS NULL)')
 AND (SELECT COUNT(*) FROM sys.index_columns k WHERE k.object_id=i.object_id AND k.index_id=i.index_id AND k.key_ordinal>0)=2
 AND EXISTS(SELECT 1 FROM sys.index_columns k JOIN sys.columns c ON c.object_id=k.object_id AND c.column_id=k.column_id WHERE k.object_id=i.object_id AND k.index_id=i.index_id AND k.key_ordinal=1 AND c.name=N'customer_id' AND k.is_descending_key=0)
 AND EXISTS(SELECT 1 FROM sys.index_columns k JOIN sys.columns c ON c.object_id=k.object_id AND c.column_id=k.column_id WHERE k.object_id=i.object_id AND k.index_id=i.index_id AND k.key_ordinal=2 AND c.name=N'currency_code' AND k.is_descending_key=0))
 OR (SELECT COUNT(*) FROM sys.check_constraints WHERE name IN(N'CK_desktop_local_requests_operation',N'CK_desktop_profile_version_mode') AND is_disabled=0 AND is_not_trusted=0)<>2
 THROW 51995,'DESKTOP_MASTER_V4_SCHEMA_REJECTED',1;`;
