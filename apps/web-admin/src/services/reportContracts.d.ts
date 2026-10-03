// Compile-time references only: these imports never load API services in the browser.
type LoadingView<T> = T extends readonly unknown[] ? T : T extends object ? {
  [K in keyof T]?: LoadingView<T[K]>;
} : T;
export type ManagementReport = LoadingView<Awaited<ReturnType<typeof import('../../../api/src/services/dashboardService.js').getManagementReportingData>>>;
export type PeriodicReport = LoadingView<Awaited<ReturnType<typeof import('../../../api/src/services/dashboardService.js').getPeriodicAccountingData>>>;
export type FinanceSummary = Partial<Awaited<ReturnType<typeof import('../../../api/src/services/financeService.js').getFinanceSummary>>>;
export type JournalSummary = Partial<Awaited<ReturnType<typeof import('../../../api/src/services/financeService.js').getFinanceJournal>>['summary']>;
export type StockValuationSummary = Partial<Awaited<ReturnType<typeof import('../../../api/src/services/movementService.js').getStockValuationReport>>['meta']['summary']>;
