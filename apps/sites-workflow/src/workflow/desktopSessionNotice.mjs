// Keep the mounted form visible until the person chooses normal login.
// This notice neither reads nor changes any operation journal or form value.
export function showDesktopSessionNotice({document,view,label,logout,onLogin}={}){
 label.textContent='Oturum sona erdi';logout.hidden=true;
 let notice=document.getElementById('desktop-session-notice');
 if(notice)return notice;
 notice=document.createElement('section');notice.id='desktop-session-notice';notice.className='card panel';
 notice.setAttribute('role','alert');notice.setAttribute('aria-label','Oturum yenileme');
 const message=document.createElement('p');
 message.textContent='Oturumunuz sona erdi. Devam etmek için yeniden giriş yapın. Sonucu doğrulanmamış işlemler korunur; girişten sonra aynı işlemin sonucunu kontrol edin.';
 const button=document.createElement('button');button.type='button';button.className='btn primary';button.textContent='Yeniden giriş yap';
 button.addEventListener('click',onLogin);notice.append(message,button);view.before(notice);
 return notice;
}
