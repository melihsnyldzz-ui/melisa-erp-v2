/** @param {{rows?: unknown[], meta?: {total?: number | string}, isLoading?: boolean, errorMessage?: string}} options */
export function getSalesPipelineListOutputState({
  rows,
  meta,
  isLoading = false,
  errorMessage = '',
} = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rawTotal = meta?.total;
  const total = Number(rawTotal);
  const hasValidTotal = rawTotal !== undefined
    && rawTotal !== null
    && rawTotal !== ''
    && Number.isSafeInteger(total)
    && total >= safeRows.length;
  const hasPartialList = hasValidTotal && total > safeRows.length;
  const isCompleteList = hasValidTotal && total === safeRows.length;
  const canUseOutput = safeRows.length > 0
    && isCompleteList
    && !isLoading
    && !String(errorMessage || '');

  return {
    canUseOutput,
    hasPartialList,
    hasValidTotal,
    isCompleteList,
    total: hasValidTotal ? total : null,
  };
}
