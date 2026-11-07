import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopGoodsProfile} from './desktopGoodsProfile.mjs';
import {getDesktopMasterV6GuardSql} from '../config/desktopGoodsV6Guard.mjs';

test('V6 goods keeps its exact guard and V7 uses its own target and guard',()=>{
 const target='SELECT schema_version=6';
 assert.deepEqual(desktopGoodsProfile('desktop-master-v6',target),{target,guard:getDesktopMasterV6GuardSql()});
 const v7=desktopGoodsProfile('desktop-master-v7',target);assert.equal(v7.target,'SELECT schema_version=7');assert.match(v7.guard,/DESKTOP_FINANCE_V7_SCHEMA_REJECTED/);
 assert.throws(()=>desktopGoodsProfile('desktop-master-v5',target),/DESKTOP_GOODS_PROFILE_UNAVAILABLE/);
 assert.throws(()=>desktopGoodsProfile('desktop-master-v6','SELECT 1'),/DESKTOP_GOODS_PROFILE_UNAVAILABLE/);
});
