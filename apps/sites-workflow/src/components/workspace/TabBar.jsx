import React, { useLayoutEffect, useRef } from 'react';

export function TabBar({ tabs, activeTabId, onActivateTab, onCloseTab }) {
  const container = useRef(null);
  useLayoutEffect(() => {
    const bar = container.current;
    const active = bar?.querySelector('[aria-current="page"]')?.parentElement;
    if (!bar || !active) return;
    const bounds = bar.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.left < bounds.left) bar.scrollLeft += item.left - bounds.left;
    else if (item.right > bounds.right) bar.scrollLeft += item.right - bounds.right;
  }, [activeTabId, tabs.length]);
  return <div className="tab-bar" aria-label="Açık ekran sekmeleri" ref={container}>
    {tabs.map(tab => <div className={`tab-item${tab.id === activeTabId ? ' active' : ''}`} key={tab.id}>
      <button className={tab.id === activeTabId ? 'tab active' : 'tab'} type="button"
        aria-current={tab.id === activeTabId ? 'page' : undefined}
        title={tab.label} onClick={() => onActivateTab(tab.id)}>
        <span>{tab.label}</span>{tab.dirty && <b aria-label="Kaydedilmemiş değişiklik">*</b>}
        {tab.pinned && <em className="pin">Sabit</em>}
      </button>
      {!tab.pinned && <button className="tab-close" type="button"
        aria-label={`${tab.label} sekmesini kapat`} title="Sekmeyi kapat"
        onClick={() => onCloseTab(tab.id)}>×</button>}
    </div>)}
  </div>;
}
