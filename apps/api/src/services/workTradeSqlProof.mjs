// Generated from the reviewed offline SQL source; never from current drift.
export const WORK_TRADE_SQL_PROOF=Object.freeze({
  "readyHash": "71245635F3787A0DD3FC1982D2BA34DBF9713DB3925C0E26F3EF7FAADF8B13EF",
  "contextHash": "A1519BBBFD145CC8FC53DBBB7B1F5D3B97D1D34CC5B66A42CE6000985341D23D",
  "effectsHash": "3913AAD04ED69B9CA978EE1B99C4735161014AACCA60577BEA7AA38E7B1EEA2F"
});
// Shared leaf expression for the owner compiler and the native invoice reader.
// No offline compiler or source-capture files are loaded by the running API.
export function canonicalBusinessSaleInvoiceRevisionSQL({profileHash,invoiceAlias='v',creationPayload='@creation'}={}){
 if(typeof profileHash!=='string'||!/^[A-F0-9]{64}$/.test(profileHash)||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(invoiceAlias)||!/^(?:@[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*)$/.test(creationPayload))throw Object.assign(Error('B6_OWNER_INVOICE_REVISION_ARGS'),{code:'B6_OWNER_INVOICE_REVISION_ARGS'});
 const values=["N'CANONICAL_INVOICE_V1'",`CONVERT(varchar(18),${invoiceAlias}.row_version,1)`,`CONVERT(varchar(64),HASHBYTES('SHA2_256',${creationPayload}),2)`,`N'${profileHash}'`,`${invoiceAlias}.party_entity_id`,`${invoiceAlias}.party_currency_account_id`,`${invoiceAlias}.document_currency`];
 const fields=values.map(e=>`CASE WHEN ${e} IS NULL THEN N'-1:;' ELSE CONVERT(nvarchar(20),DATALENGTH(CONVERT(nvarchar(max),${e})))+N':'+CONVERT(nvarchar(max),${e})+N';' END`);
 return `LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONCAT(CAST(N'' AS nvarchar(max)),${fields.join(',')})),2))`;
}
