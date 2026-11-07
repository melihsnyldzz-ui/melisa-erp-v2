import test from 'node:test';import assert from 'node:assert/strict';import {assertDesktopPrivateFinance} from './desktopFinanceService.mjs';
test('forged transaction, flag or callback cannot issue a native finance scope',()=>{for(const transaction of [{},{verified:true},null])assert.throws(()=>assertDesktopPrivateFinance({transaction,actorId:'7',operation:'collection',payload:{amount:1}}));});
