import React from 'react';
import { tabs } from '../../data/mockNavigationData.js';

export function TabBar() {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button className={tab.active ? 'tab active' : 'tab'} key={tab.label}>
          <span>{tab.label}</span>
          {tab.dirty ? <b>*</b> : null}
          <em>×</em>
        </button>
      ))}
      <button className="tab more">+ Ekran</button>
    </div>
  );
}
