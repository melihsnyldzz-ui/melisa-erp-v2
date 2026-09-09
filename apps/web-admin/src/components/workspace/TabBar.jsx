import React, { useEffect, useRef } from 'react';

export function TabBar({ tabs, activeTabId, onActivateTab, onCloseTab }) {
  const barRef = useRef(null);
  const activeRef = useRef(null);
  useEffect(() => {
    function revealActiveTab() {
      const bar = barRef.current;
      const active = activeRef.current;
      if (!bar || !active) return;
      const bounds = bar.getBoundingClientRect();
      const selected = active.getBoundingClientRect();
      if (selected.right > bounds.right) bar.scrollLeft += selected.right - bounds.right + 8;
      else if (selected.left < bounds.left) bar.scrollLeft -= bounds.left - selected.left + 8;
    }
    revealActiveTab();
    const observer = new ResizeObserver(revealActiveTab);
    if (barRef.current) observer.observe(barRef.current);
    return () => observer.disconnect();
  }, [activeTabId, tabs.length]);
  return (
    <div className="tab-bar" aria-label="Açık ekran sekmeleri" ref={barRef}>
      {tabs.map((tab) => (
        <button
          className={tab.id === activeTabId ? 'tab active' : 'tab'}
          key={tab.id}
          ref={tab.id === activeTabId ? activeRef : null}
          onClick={() => onActivateTab(tab.id)}
          type="button"
        >
          <span>{tab.label}</span>
          {tab.dirty ? <b>*</b> : null}
          {tab.pinned ? (
            <em className="pin">Sabit</em>
          ) : (
            <em
              aria-label={`${tab.label} sekmesini kapat`}
              onClick={(event) => {
                event.stopPropagation();
                onCloseTab(tab.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                onCloseTab(tab.id);
              }}
              role="button"
              tabIndex={0}
            >
              ×
            </em>
          )}
        </button>
      ))}
    </div>
  );
}
