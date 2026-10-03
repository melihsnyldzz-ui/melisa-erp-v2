export function canCreateSalesPipelineDocument(permissions = []) {
  return Array.isArray(permissions) && permissions.includes('sales.create');
}

export function requestOpenNewSalesPipelineDocument({ type, permissions, onOpenScreen } = {}) {
  if (!canCreateSalesPipelineDocument(permissions)) {
    return { opened: false, code: 'SALES_CREATE_PERMISSION_REQUIRED' };
  }

  if (typeof onOpenScreen !== 'function') {
    return { opened: false, code: 'SALES_PIPELINE_NAVIGATION_UNAVAILABLE' };
  }

  const screenId = type === 'offer' ? 'sales-offer' : type === 'order' ? 'sales-order' : '';
  if (!screenId) {
    return { opened: false, code: 'SALES_PIPELINE_TYPE_INVALID' };
  }

  onOpenScreen(screenId);
  return { opened: true, code: null, screenId };
}
