import React, { useEffect, useRef } from 'react';

export function TabBar({ tabs, activeTabId, onActivateTab, onCloseTab }) {
  const activeTabRef = useRef(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId, tabs.length]);
  return (
    <div className="tab-bar" aria-label="Açık ekran sekmeleri">
      {tabs.map((tab) => (
        <button
          className={tab.id === activeTabId ? 'tab active' : 'tab'}
          key={tab.id}
          ref={tab.id === activeTabId ? activeTabRef : undefined}
          aria-current={tab.id === activeTabId ? 'page' : undefined}
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
