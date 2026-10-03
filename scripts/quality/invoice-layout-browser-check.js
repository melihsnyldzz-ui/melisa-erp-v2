(() => {
  const visible = (element) => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
  const main = [...document.querySelectorAll('.commerce-invoice-list')].find(visible);
  if (!main) throw new Error('No visible commercial invoice list');
  if (Math.abs(scrollX)>1 || Math.abs(scrollY)>1) throw new Error('Document scrolled outside ERP workspace');
  const rect = element => { const r = element.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}; };
  const sections = [...main.children].filter(visible).map(element => ({className:element.className,...rect(element)}));
  for (let i=1;i<sections.length;i++) if (sections[i-1].bottom > sections[i].y + 1) throw new Error('Overlapping sections: '+sections[i-1].className+' / '+sections[i].className);
  const bounds=rect(main);
  for (const section of sections) if (section.right > bounds.right+1 || section.x < bounds.x-1) throw new Error('Section exceeds available width: '+section.className);
  const list=main.querySelector('.sales-receipt-list-panel'),preview=main.querySelector('.sales-receipt-preview-panel');
  if (visible(list)&&visible(preview)) { const a=rect(list),b=rect(preview); if (a.right>b.x+1&&a.bottom>b.y+1&&b.right>a.x+1&&b.bottom>a.y+1) throw new Error('List and preview overlap'); }
  const bar=document.querySelector('.tab-bar'),active=bar.querySelector('.tab.active');
  if(visible(bar)) {const a=rect(active),b=rect(bar);if(a.x < b.x-1||a.right > b.right+1)throw new Error('Active tab clipped');}
  const shell=document.querySelector('.erp-shell');
  const filters=main.querySelector('.invoice-list-filters');
  if(!shell.classList.contains('hide-filters')&&!visible(filters)) throw new Error('Primary search filters hidden');
  const table=main.querySelector('.sales-receipt-table-wrap');
  return {status:'PASS',viewport:[innerWidth,innerHeight],simpleMode:shell.classList.contains('simple-mode-shell'),filtersVisible:visible(filters),sections,mainScrollRange:main.scrollHeight-main.clientHeight,table:table?{...rect(table),overflowX:getComputedStyle(table).overflowX,overflowY:getComputedStyle(table).overflowY,scrollWidth:table.scrollWidth,clientWidth:table.clientWidth}:null,activeTab:active.textContent.trim()};
})()
