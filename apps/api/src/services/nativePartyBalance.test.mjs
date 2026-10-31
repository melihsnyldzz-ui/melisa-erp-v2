import test from 'node:test';import assert from 'node:assert/strict';
import {nativePartyBalance} from './nativePartyBalance.mjs';
test('missing, invalid and direction-only scalars remain unknown instead of zero',()=>{for(const v of [null,undefined,'',' ','(-)','LL','B','A',false,{},NaN,Infinity,'NaN','1,25'])assert.equal(nativePartyBalance(v),null);});
test('verified zero, negative balance and source precision retain existing numeric display semantics',()=>{for(const [value,expected] of [[0,0],['0.00000000',0],['-12.34567890',-12.3456789],['+13.00000001',13.00000001],[1.23,1.23]])assert.equal(nativePartyBalance(value),expected);});
