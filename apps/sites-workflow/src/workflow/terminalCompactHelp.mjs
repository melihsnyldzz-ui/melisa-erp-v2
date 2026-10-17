// Presentation only. Move the existing help nodes; never recreate transaction
// controls, listeners, role wording or links from strings.
export function compactTerminalHelp(root,{enabled=true,openStates=new Map()}={}){
 if(!enabled||!root?.ownerDocument)return;
 for(const panel of root.querySelectorAll('.work-task-handoff')){
  if(panel.hasAttribute('data-terminal-compact-help'))continue;
  const title=panel.getAttribute('aria-label')??'İş sırası',document=panel.ownerDocument;
  const details=document.createElement('details'),summary=document.createElement('summary');
  details.className='terminal-task-help';summary.textContent='İş sırası ve kısa eğitim';
  details.open=openStates.get(title)===true;
  panel.setAttribute('data-terminal-compact-help','');
  while(panel.firstChild)details.appendChild(panel.firstChild);
  details.insertBefore(summary,details.firstChild);panel.appendChild(details);
  details.addEventListener('toggle',()=>openStates.set(title,details.open));
 }
}
