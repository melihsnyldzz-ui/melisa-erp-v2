// All filesystem operations are an in-memory adapter. No Desktop media read.
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const files=new Map(),calls=[];
const stat=file=>({isDirectory:()=>!file.endsWith('.png'),isSymbolicLink:()=>false,isFile:()=>file.endsWith('.png'),nlink:1,size:files.get(file)?.length??0,ino:1,mtimeMs:1});
mock.module('node:fs/promises',{defaultExport:{async lstat(p){calls.push(['lstat',p]);if(p.endsWith('.png')&&!files.has(p))throw Object.assign(Error('absent'),{code:'ENOENT'});return stat(p);},async realpath(p){calls.push(['realpath',p]);return p;},async open(p,mode){calls.push(['open',p,mode]);if(mode==='wx'&&files.has(p))throw Object.assign(Error('exists'),{code:'EEXIST'});return {async stat(){return stat(p);},async readFile(){return Buffer.from(files.get(p));},async writeFile(b){files.set(p,Buffer.from(b));},async sync(){},async close(){}};}}});
const {desktopProductPhotoMedia,desktopProductPhotoMediaForProfile}=await import('./desktopProductPhotoMedia.mjs');
test('finite DB9 photo media never falls back to or appends legacy content; initialization and unknown profile perform no IO',async()=>{
 assert.equal(calls.length,0);assert.equal(desktopProductPhotoMediaForProfile(),desktopProductPhotoMedia);
 const bytes=Buffer.from('synthetic-immutable-image'),sha=createHash('sha256').update(bytes).digest('hex');
 await desktopProductPhotoMedia.put(bytes,sha);const legacy=[...files.entries()].map(([p,b])=>[p,Buffer.from(b)]);assert.equal(legacy.length,1);
 calls.length=0;const fresh=desktopProductPhotoMediaForProfile('empty-db9-v7-v1');assert.equal(calls.length,0);
 await assert.rejects(fresh.read(sha));assert(calls.every(([,p])=>!p.replaceAll('\\','/').includes('/ERP/product-media-v1')));
 calls.length=0;await fresh.put(bytes,sha);assert.deepEqual(await fresh.read(sha),bytes);assert(calls.every(([,p])=>!p.replaceAll('\\','/').includes('/ERP/product-media-v1')));
 const newPaths=[...files.keys()].filter(p=>p.includes('empty-profile-db9-media-v1'));assert.equal(newPaths.length,1);assert(files.get(legacy[0][0]).equals(legacy[0][1]));
 calls.length=0;for(const profile of ['',false,'../product-media-v1','desktop-master-v7','unknown'])assert.throws(()=>desktopProductPhotoMediaForProfile(profile));assert.equal(calls.length,0);
});
