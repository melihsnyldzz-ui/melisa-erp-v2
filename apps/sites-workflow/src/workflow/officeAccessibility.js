// Shared presentation behavior; permission and navigation decisions stay in the
// existing native controllers.
document.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const modal=document.querySelector('#modalback.open #modal');
  if(!modal)return;
  const controls=[...modal.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')]
    .filter(element=>!element.disabled&&element.getClientRects().length);
  const first=controls[0],last=controls.at(-1);
  if(!first)return;
  const outside=!modal.contains(document.activeElement);
  if(event.shiftKey&&(outside||document.activeElement===first)){
    event.preventDefault();last.focus();
  }else if(!event.shiftKey&&(outside||document.activeElement===last)){
    event.preventDefault();first.focus();
  }
});
