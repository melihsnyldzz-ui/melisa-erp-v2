export const dashboardLayoutStorageKey = 'melisa.dashboard.layout.v1';

export const dashboardWidgetDefaults = [
  { key: 'alerts', label: 'Kritik uyarılar', size: 'medium', visible: true },
  { key: 'country', label: 'Ülke bazlı satış / alacak', size: 'medium', visible: true },
  { key: 'whatsapp', label: 'WhatsApp grup takibi', size: 'small', visible: true },
  { key: 'recent', label: 'Son satışlar / alışlar', size: 'wide', visible: true },
  { key: 'topProducts', label: 'En çok satan ürünler', size: 'wide', visible: true },
  { key: 'receivables', label: 'Cari borç / ekstre özeti', size: 'medium', visible: true },
  { key: 'collections', label: 'Tahsilat bekleyenler', size: 'medium', visible: true },
  { key: 'productFocus', label: 'Ürün odak listesi', size: 'small', visible: true },
  { key: 'topReceivableFocus', label: 'Alacak yoğunluğu', size: 'small', visible: false },
  { key: 'countryOpportunities', label: 'Ülke bazlı fırsatlar', size: 'small', visible: false },
];

export const dashboardSizeOptions = [
  { value: 'small', label: 'Küçük' },
  { value: 'medium', label: 'Orta' },
  { value: 'wide', label: 'Geniş' },
  { value: 'full', label: 'Tam satır' },
];

export const dashboardFreeLayout = {
  columnWidth: 410,
  gap: 8,
  minWidth: 280,
  minHeight: 170,
  rowHeight: 205,
};

const dashboardSizeSpans = {
  small: 1,
  medium: 2,
  wide: 3,
  full: 4,
};

export function getDashboardWidgetWidth(size = 'small') {
  const span = dashboardSizeSpans[size] || 1;
  return (span * dashboardFreeLayout.columnWidth) + ((span - 1) * dashboardFreeLayout.gap);
}

export function inferDashboardSize(width = dashboardFreeLayout.columnWidth) {
  const sizes = dashboardSizeOptions.map((option) => ({
    size: option.value,
    distance: Math.abs(getDashboardWidgetWidth(option.value) - width),
  }));
  sizes.sort((left, right) => left.distance - right.distance);
  return sizes[0]?.size || 'small';
}

function buildDashboardGeometry(layout) {
  let column = 0;
  let row = 0;

  return layout.map((widget) => {
    const span = Math.min(dashboardSizeSpans[widget.size] || 1, 4);
    if (column + span > 4) {
      column = 0;
      row += 1;
    }

    const nextWidget = {
      ...widget,
      x: Number.isFinite(widget.x) ? widget.x : column * (dashboardFreeLayout.columnWidth + dashboardFreeLayout.gap),
      y: Number.isFinite(widget.y) ? widget.y : row * (dashboardFreeLayout.rowHeight + dashboardFreeLayout.gap),
      w: Number.isFinite(widget.w) ? widget.w : getDashboardWidgetWidth(widget.size),
      h: Number.isFinite(widget.h) ? widget.h : dashboardFreeLayout.rowHeight,
    };

    column += span;
    if (column >= 4) {
      column = 0;
      row += 1;
    }

    return nextWidget;
  });
}

export function buildDefaultDashboardLayout() {
  return buildDashboardGeometry(dashboardWidgetDefaults.map((widget) => ({ ...widget })));
}

function normalizeDashboardLayout(savedLayout) {
  const defaults = buildDefaultDashboardLayout();
  if (!Array.isArray(savedLayout)) {
    return defaults;
  }

  const defaultMap = new Map(defaults.map((widget) => [widget.key, widget]));
  const normalized = savedLayout
    .filter((widget) => widget && defaultMap.has(widget.key))
    .map((widget) => ({
      ...defaultMap.get(widget.key),
      visible: typeof widget.visible === 'boolean' ? widget.visible : defaultMap.get(widget.key).visible,
      size: dashboardSizeOptions.some((option) => option.value === widget.size)
        ? widget.size
        : defaultMap.get(widget.key).size,
      x: Number.isFinite(widget.x) ? widget.x : undefined,
      y: Number.isFinite(widget.y) ? widget.y : undefined,
      w: Number.isFinite(widget.w) ? widget.w : undefined,
      h: Number.isFinite(widget.h) ? widget.h : undefined,
    }));

  defaults.forEach((widget) => {
    if (!normalized.some((savedWidget) => savedWidget.key === widget.key)) {
      normalized.push(widget);
    }
  });

  return buildDashboardGeometry(normalized);
}

export function loadDashboardLayout() {
  try {
    return normalizeDashboardLayout(JSON.parse(window.localStorage.getItem(dashboardLayoutStorageKey) || 'null'));
  } catch (_error) {
    return buildDefaultDashboardLayout();
  }
}
