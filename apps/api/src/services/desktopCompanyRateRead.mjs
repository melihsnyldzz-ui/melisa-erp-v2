import {desktopCompanyRateDate,desktopCompanyRates} from '../../../../packages/shared/src/desktopCompanyRates.mjs';
// Caller must first verify the physical target and normal authority in this
// same held transaction. This helper grants no permission and opens no pool.
export const DESKTOP_COMPANY_RATE_READ_SQL=`SELECT TOP(3) CONVERT(varchar(20),id) id,currency_code currency,CONVERT(char(10),rate_date,23) date,CONVERT(varchar(40),rate_to_try) rateExact8,source FROM dbo.currency_rates WITH(HOLDLOCK) WHERE rate_date=CONVERT(date,@companyRateDate,23) AND currency_code IN(N'USD',N'EUR') ORDER BY currency_code,id;`;
export async function readDesktopCompanyRates({sql,transaction,date}={}){
 desktopCompanyRateDate(date);if(!transaction||typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function')throw Error('DESKTOP_COMPANY_RATE_INVALID');const result=await new sql.Request(transaction).input('companyRateDate',sql.NVarChar(10),date).query(DESKTOP_COMPANY_RATE_READ_SQL);if(!Array.isArray(result?.recordset))throw Error('DESKTOP_COMPANY_RATE_INVALID');return desktopCompanyRates(date,Array.from(result.recordset));
}
