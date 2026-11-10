import test from 'node:test';
import assert from 'node:assert/strict';
import {showDesktopSessionNotice} from './desktopSessionNotice.mjs';
test('expiry notice clears the stale label while keeping the mounted form and calls login only on explicit action',()=>{
 const nodes=new Map(),create=tag=>({tag,attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v;},append(...children){this.children.push(...children);},addEventListener(k,fn){this.listeners[k]=fn;}});
 const document={getElementById:id=>nodes.get(id),createElement:create},input={value:'Gönderilmemiş seçim'},view={children:[input],before(n){nodes.set(n.id,n);}},label={textContent:'Eski personel'},logout={hidden:false};let logins=0;
 const options={document,view,label,logout,onLogin:()=>{logins++;}};
 const notice=showDesktopSessionNotice(options);assert.equal(label.textContent,'Oturum sona erdi');assert.equal(logout.hidden,true);assert.equal(view.children[0],input);assert.equal(input.value,'Gönderilmemiş seçim');assert.equal(logins,0);
 assert.equal(notice.attributes.role,'alert');assert.match(notice.children[0].textContent,/Sonucu doğrulanmamış işlemler korunur/);assert.doesNotMatch(notice.children[0].textContent,/kaydedildi|taslak.*korunur/i);
 assert.equal(showDesktopSessionNotice(options),notice);assert.equal(nodes.size,1);assert.equal(notice.children[1].textContent,'Yeniden giriş yap');notice.children[1].listeners.click();assert.equal(logins,1);
});
