import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('./officeAccessibility.js',import.meta.url),'utf8');
function fixture(){
 let listener;const doc={activeElement:null,addEventListener(_key,fn){listener=fn},querySelector(){return modal}};
 const control=(disabled=false,visible=true)=>({disabled,getClientRects:()=>visible?[{}]:[],focus(){doc.activeElement=this}});
 const controls=[control(),control(true),control(false,false),control()];
 const modal={querySelectorAll:()=>controls,contains:element=>controls.includes(element)};
 runInNewContext(source,{document:doc});
 return {doc,controls,press(shiftKey=false,key='Tab'){let prevented=false;listener({key,shiftKey,preventDefault(){prevented=true}});return prevented}};
}
test('modal keyboard cycle skips disabled and hidden controls in both directions',()=>{
 const f=fixture();f.doc.activeElement=f.controls.at(-1);assert.equal(f.press(),true);assert.equal(f.doc.activeElement,f.controls[0]);
 assert.equal(f.press(true),true);assert.equal(f.doc.activeElement,f.controls.at(-1));
});
test('focus outside an open modal returns inside without invoking an operation',()=>{
 const f=fixture();f.doc.activeElement={};assert.equal(f.press(),true);assert.equal(f.doc.activeElement,f.controls[0]);
 f.doc.activeElement={};assert.equal(f.press(true),true);assert.equal(f.doc.activeElement,f.controls.at(-1));
 assert.equal(f.press(false,'Enter'),false);assert.equal(f.doc.activeElement,f.controls.at(-1));
});
test('closed modal and a fully disabled modal leave normal keyboard handling intact',()=>{
 const f=fixture();f.doc.querySelector=()=>null;assert.equal(f.press(),false);
 f.doc.querySelector=()=>({querySelectorAll:()=>f.controls.map(c=>({...c,disabled:true}))});assert.equal(f.press(),false);
});
