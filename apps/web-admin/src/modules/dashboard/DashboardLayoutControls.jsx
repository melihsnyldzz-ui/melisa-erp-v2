import React from 'react';
import { dashboardSizeOptions } from './dashboardLayout.js';

export function DashboardLayoutEditor({ layout, onMoveWidget, onReset, onUpdateWidget }) {
  const visibleCount = layout.filter((widget) => widget.visible).length;

  return (
    <section className="erp-panel dashboard-layout-editor">
      <div className="panel-title">
        <strong>Operasyon masası düzeni</strong>
        <span>{visibleCount} bölüm açık / seçimler bu bilgisayarda saklanır</span>
      </div>
      <div className="dashboard-layout-editor-grid">
        {layout.map((widget, index) => (
          <article className={widget.visible ? 'dashboard-layout-row' : 'dashboard-layout-row muted'} key={widget.key}>
            <label className="dashboard-layout-visible">
              <input
                checked={widget.visible}
                type="checkbox"
                onChange={(event) => onUpdateWidget(widget.key, { visible: event.target.checked })}
              />
              <span>{widget.label}</span>
            </label>
            <select
              aria-label={`${widget.label} boyutu`}
              value={widget.size}
              onChange={(event) => onUpdateWidget(widget.key, { size: event.target.value })}
            >
              {dashboardSizeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div className="dashboard-layout-order">
              <button type="button" disabled={index === 0} onClick={() => onMoveWidget(widget.key, -1)}>Yukarı</button>
              <button type="button" disabled={index === layout.length - 1} onClick={() => onMoveWidget(widget.key, 1)}>Aşağı</button>
            </div>
          </article>
        ))}
      </div>
      <div className="dashboard-layout-footer">
        <span>Karışık gelen panelleri kapatabilir, önemli olanları genişletebilir ve sırayı değiştirebilirsin.</span>
        <button type="button" onClick={onReset}>Varsayılana Dön</button>
      </div>
    </section>
  );
}

export function DashboardWidgetFrame({
  children,
  index,
  isEditing,
  onMoveWidget,
  onStartDrag,
  onStartResize,
  onUpdateWidget,
  total,
  widget,
}) {
  function handleDragMouseDown(event) {
    if (event.target.closest('button, select, input, textarea, a')) {
      return;
    }

    onStartDrag(event, widget);
  }

  const widgetStyle = isEditing ? {
    left: `${widget.x}px`,
    top: `${widget.y}px`,
    width: `${widget.w}px`,
    height: `${widget.h}px`,
  } : undefined;

  return (
    <div
      className={`dashboard-widget dashboard-widget-${widget.key} dashboard-widget-size-${widget.size}${isEditing ? ' dashboard-widget-free dashboard-widget-editing' : ''}`}
      key={widget.key}
      style={widgetStyle}
    >
      {isEditing && (
        <div className="dashboard-widget-controls" onMouseDown={handleDragMouseDown}>
          <strong title="Mouse ile tasiyip konumlandir">{widget.label}</strong>
          <span className="dashboard-widget-drag-handle">Tasi</span>
          <button type="button" disabled={index === 0} onClick={() => onMoveWidget(widget.key, -1)}>Sola al</button>
          <button type="button" disabled={index === total - 1} onClick={() => onMoveWidget(widget.key, 1)}>Sağa al</button>
          <select
            aria-label={`${widget.label} panel boyutu`}
            value={widget.size}
            onChange={(event) => onUpdateWidget(widget.key, { size: event.target.value })}
          >
            {dashboardSizeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="button" className="ghost-danger" onClick={() => onUpdateWidget(widget.key, { visible: false })}>Gizle</button>
        </div>
      )}
      {children}
      {isEditing && (
        <button
          type="button"
          aria-label={`${widget.label} boyutlandir`}
          className="dashboard-widget-resize-handle"
          onMouseDown={(event) => onStartResize(event, widget)}
        />
      )}
    </div>
  );
}
