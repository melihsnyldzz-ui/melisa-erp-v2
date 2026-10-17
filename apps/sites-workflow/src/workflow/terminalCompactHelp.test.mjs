import test from 'node:test';
import assert from 'node:assert/strict';
import {compactTerminalHelp} from './terminalCompactHelp.mjs';
// A small DOM fixture checks node identity and event preservation rather than
// comparing duplicated HTML strings. Native details supplies keyboard behavior.
class Node {
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attrs=new Map();this.events=new Map();}
 get firstChild(){return this.children[0]??null;}
 appendChild(node){node.parent?.remove(node);node.parent=this;this.children.push(node);return node;}
 remove(node){this.children=this.children.filter(n=>n!==node);node.parent=null;}
 insertBefore(node,before){node.parent?.remove(node);node.parent=this;this.children.splice(this.children.indexOf(before),0,node);}
 getAttribute(k){return this.attrs.get(k)??null;}
 hasAttribute(k){return this.attrs.has(k);}
 setAttribute(k,v){this.attrs.set(k,v);}
 addEventListener(k,v){this.events.set(k,v);}
}
function fixture(){const doc={createElement:tag=>new Node(tag,doc)},panel=new Node('section',doc),heading=new Node('div',doc),steps=new Node('ol',doc),form=new Node('form',doc);panel.setAttribute('aria-label','Mal kabulünde iş sırası');heading.link='/kullanim-egitimi.html#receiving';steps.roles=['Personel','İlker','Muhasebe'];form.submit=()=>{};panel.appendChild(heading);panel.appendChild(steps);const root={ownerDocument:doc,querySelectorAll:()=>[panel],form};return {root,panel,heading,steps,form};}
test('small terminal folds only existing help, preserving role nodes, links and the separate transaction form',()=>{
 const {root,panel,heading,steps,form}=fixture(),submit=form.submit;
 compactTerminalHelp(root);const details=panel.firstChild;
 assert.equal(details.tagName,'details');assert.equal(details.firstChild.tagName,'summary');assert.equal(details.open,false);
 assert.equal(details.children[1],heading);assert.equal(details.children[2],steps);
 assert.equal(heading.link,'/kullanim-egitimi.html#receiving');assert.deepEqual(steps.roles,['Personel','İlker','Muhasebe']);assert.equal(form.submit,submit);assert.equal(form.parent,undefined);
 compactTerminalHelp(root);assert.equal(panel.children.length,1);assert.equal(panel.firstChild,details);
});
test('desktop remains unchanged and an opened instruction stays open across a transaction repaint',()=>{
 const first=fixture(),states=new Map();compactTerminalHelp(first.root,{enabled:false,openStates:states});assert.equal(first.panel.firstChild,first.heading);
 compactTerminalHelp(first.root,{openStates:states});const details=first.panel.firstChild;details.open=true;details.events.get('toggle')();
 const repaint=fixture();compactTerminalHelp(repaint.root,{openStates:states});assert.equal(repaint.panel.firstChild.open,true);
});
