import sql from 'mssql';

// This web runtime predates Native's no-collection sale/cancel contract. Detect
// provenance from the committed queue link, never a user-editable document number.
export async function assertWebInvoiceMutationSupported(request, invoiceId) {
  const result = await request
    .input('nativeWebInvoiceId', sql.BigInt, invoiceId)
    .query(`
      SELECT TOP (1) id
      FROM dbo.terminal_sync_queue
      WHERE target_entity = N'sales_invoice'
        AND target_entity_id = @nativeWebInvoiceId
        AND event_type = N'invoice_created'
        AND JSON_VALUE(
          CASE WHEN ISJSON(payload_json) = 1 THEN payload_json ELSE N'{}' END,
          N'$.kind'
        ) = N'native_sale_v1';
    `);

  if (result.recordset?.length) {
    throw Object.assign(new Error(
      'Bu fiş Melisa Native terminalinde oluşturuldu. Bu ERP sürümünde düzeltme veya iptal yapılamaz; kayıtlı fişi Native terminalinde açıp yetkili onayıyla iptal edin.',
    ), {code: 'NATIVE_INVOICE_WEB_WRITE_UNSUPPORTED', statusCode: 409});
  }
}
