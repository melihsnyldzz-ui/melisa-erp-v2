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
        customerAnalysis: summary.data.receivables.map((row) => ({
          customerId: row.customerId,
          customerCode: `C-${row.customerId}`,
          customerName: row.customerName,
          totalSalesTry: row.balanceTry * 1.8,
          balanceTry: row.balanceTry,
          lastSaleDate: row.lastMove,
        })),
        supplierAnalysis: summary.data.supplierPerformance.map((row) => ({
          supplierId: row.supplierId,
          supplierCode: `S-${row.supplierId}`,
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
        criticalWarnings: [],
      },
    };
  }

  return get('/api/dashboard/management-reporting');
}
