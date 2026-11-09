// Four new column rights; updated_at is already present in the V6 manifest.
export const DESKTOP_SUPPLIER_STATUS_RIGHTS=Object.freeze(['is_active','passive_at','passive_reason','updated_by'].map(column=>Object.freeze({schema:'dbo',name:'suppliers',permission:'UPDATE',column})));
