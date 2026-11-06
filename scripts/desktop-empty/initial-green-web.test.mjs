import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveGreenWebPath} from './initial-green-web.mjs';

test('only the green entry and its pinned asset are exposed',()=>{
 assert.equal(resolveGreenWebPath('/'),'desktop-empty-green.html');
 assert.equal(resolveGreenWebPath('/desktop-empty-green.html?screen=home'),'desktop-empty-green.html');
 assert.equal(resolveGreenWebPath('/assets/desktop-empty-green-D_opztB0.js'),'assets/desktop-empty-green-D_opztB0.js');
 for(const path of ['/api/customers','/%2e%2e/anything','/assets/other.js','/ornek-akis.html','/foo','/x%5cy'])assert.throws(()=>resolveGreenWebPath(path));
});
