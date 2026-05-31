const demoPreview = {
  totalRows: 4,
  validRowCount: 4,
  invalidRowCount: 0,
  duplicateRowCount: 0,
  warnings: ['Demo mode: Import commit DB yazmaz.'],
  rows: [
    {
      rowNumber: 1,
      status: 'valid',
      data: { stockCode: 'STK-DEMO-001', productName: 'Demo Yeni Tulum', barcode: '869DEMO001', currency: 'TRY', stockQuantity: 48 },
      errors: [],
      warnings: ['Demo validasyon basarili'],
    },
    {
      rowNumber: 2,
      status: 'valid',
      data: { stockCode: 'STK-DEMO-002', productName: 'Demo Zibin Seti', barcode: '869DEMO002', currency: 'TRY', stockQuantity: 72 },
      errors: [],
      warnings: ['Demo validasyon basarili'],
    },
    {
      rowNumber: 3,
      status: 'valid',
      data: { customerCode: 'CR-DEMO-001', customerName: 'Demo Romanya Musteri', phone: '+40 *** *** 001', currency: 'USD', balance: 0 },
      errors: [],
      warnings: ['Demo validasyon basarili'],
    },
    {
      rowNumber: 4,
      status: 'valid',
      data: { customerCode: 'CR-DEMO-002', customerName: 'Demo Balkan Musteri', phone: '+381 *** *** 002', currency: 'USD', balance: 0 },
      errors: [],
      warnings: ['Demo validasyon basarili'],
    },
  ],
};

export function demoImportPreviewResponse() {
  return {
    success: true,
    message: 'Demo preview olusturuldu.',
    data: demoPreview,
  };
}

export function demoImportCommitResponse() {
  return {
    success: true,
    message: 'Demo islem kaydedilmedi.',
    data: {
      insertedCount: 0,
      updatedCount: 0,
      preview: demoPreview,
    },
  };
}
