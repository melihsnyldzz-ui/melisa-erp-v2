import { get } from './apiClient.js';
import { apiConfig } from '../config/apiConfig.js';
import { demoDashboardAlertsResponse, demoDashboardSummaryResponse } from '../demo/demoDashboard.js';

export async function fetchDashboardSummary() {
  if (apiConfig.demoMode) {
    return demoDashboardSummaryResponse();
  }

  return get('/api/dashboard/summary');
}

export async function fetchDashboardAlerts() {
  if (apiConfig.demoMode) {
    return demoDashboardAlertsResponse();
  }

  return get('/api/dashboard/alerts');
}

export async function fetchManagementReporting() {
  if (apiConfig.demoMode) {
    const summary = demoDashboardSummaryResponse();
    const receivables = summary.data.receivables || [];
    const suppliers = summary.data.supplierPerformance || [];
    const criticalWarnings = summary.data.patron.negativeStockCount > 0
      ? [{
        type: 'Stok',
        subject: 'Eksi stoklu ürünler',
        value: summary.data.patron.negativeStockCount,
        severity: 'danger',
      }]
      : [];

    return {
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        dailySales: {
          salesCount: summary.data.patron.finalizedSalesToday,
          salesAmountTry: summary.data.patron.todaySalesTry,
          grossProfitTry: summary.data.patron.todayGrossProfitTry,
          cancelledSalesCount: 1,
          cancelledSalesAmountTry: 4200,
        },
        dailyPurchases: {
          purchaseCount: summary.data.patron.finalizedPurchasesToday,
          purchaseAmountTry: summary.data.operations.todayPurchasesTry,
          cancelledPurchaseCount: 0,
          cancelledPurchaseAmountTry: 0,
        },
        topProducts: summary.data.topProducts.map((row) => ({
          productId: row.productId,
          stockCode: row.stockCode,
          productName: row.productName,
          quantity: row.quantity,
          revenueTry: row.salesTry,
          grossProfitTry: row.salesTry * 0.32,
        })),
        customerAnalysis: receivables.map((row, index) => ({
          customerId: row.customerId || index + 1,
          customerCode: row.customerCode || `C-${String(index + 1).padStart(3, '0')}`,
          customerName: row.customerName,
          totalSalesTry: row.balanceTry * 1.8,
          balanceTry: row.balanceTry,
          lastSaleDate: row.lastMove,
        })),
        supplierAnalysis: suppliers.map((row, index) => ({
          supplierId: row.supplierId || index + 1,
          supplierCode: row.supplierCode || `S-${String(index + 1).padStart(3, '0')}`,
          supplierName: row.supplierName,
          totalPurchasesTry: row.debtTry * 1.2,
          balanceTry: row.debtTry,
          lastPurchaseDate: row.lastPurchaseAt,
        })),
        widgets: {
          todaySalesTry: summary.data.patron.todaySalesTry,
          todayPurchasesTry: summary.data.operations.todayPurchasesTry,
          totalStockValueTry: summary.data.patron.totalStockValueTry,
          customerBalanceTry: summary.data.patron.customerReceivablesTry,
          supplierBalanceTry: summary.data.patron.supplierPayablesTry,
          negativeStockCount: summary.data.patron.negativeStockCount,
          salesDraftCount: summary.data.operations.salesDraftCount,
          purchaseDraftCount: summary.data.operations.purchaseDraftCount,
        },
        criticalWarnings,
      },
    };
  }

  return get('/api/dashboard/management-reporting');
}

export async function fetchPeriodicAccounting(params = {}) {
  return get('/api/dashboard/periodic-accounting', params);
}
