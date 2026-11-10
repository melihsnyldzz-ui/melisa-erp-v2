// Evaluate the exact physical guard with a synthetic Request, not a SQL driver.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {desktopTargetForProfile,EMPTY_V7_PROFILE_ID} from './desktopEmptyV7Profile.mjs';
import {desktopGoodsProfile} from '../services/desktopGoodsProfile.mjs';
import {DESKTOP_GOODS_TARGET_SQL} from '../services/desktopGoodsPreviewService.mjs';
test('DB9 goods/finance SQL guards replace the fixed DB5 ID while legacy target bytes remain exact',()=>{
 const next=desktopGoodsProfile('desktop-master-v7',DESKTOP_GOODS_TARGET_SQL,EMPTY_V7_PROFILE_ID);
 assert(next.target.includes('ISNULL(DB_ID(),-1)<>9'));assert(!next.target.includes('ISNULL(DB_ID(),-1)<>5'));assert(next.target.includes('schema_version=7'));
 assert.equal(desktopGoodsProfile('desktop-master-v6',DESKTOP_GOODS_TARGET_SQL).target,DESKTOP_GOODS_TARGET_SQL);
});
test('all three production physical guards bind DB9 or legacy DB5 and preserve SPID/transaction rejection',async()=>{
 const id=x=>typeof x==='string'&&/^[1-9]\d{0,15}$/.test(x)&&BigInt(x)<=9007199254740991n;
 for(const name of ['desktopFinanceService','desktopGoodsApprovalService','desktopGoodsService']){
  const text=readFileSync(new URL('../services/'+name+'.mjs',import.meta.url),'utf8');const source=text.match(/async function physical\(sql,tx,targetProfile\)\{[^\n]+return [ar]\[0\];\}/)?.[0];assert(source,name);
  const physical=vm.runInNewContext('('+source+')',{desktopTargetForProfile,id,rid:id,physicalSql:'physical',fail:()=>{throw Error('REJECTED');}});
  for(const profile of [null,EMPTY_V7_PROFILE_ID]){
   let row={databaseName:desktopTargetForProfile(profile).database,sessionId:3,transactionId:'4',transactionCount:1,transactionState:1};
   const sql={Request:class{async query(){return {recordset:[row]};}}};assert.equal((await physical(sql,{},profile)).sessionId,3);
   for(const bad of [{databaseName:profile?'MELISA_ERP_DESKTOP_TEST_20261105':desktopTargetForProfile(EMPTY_V7_PROFILE_ID).database},{sessionId:0},{transactionId:'0'},{transactionCount:0},{transactionState:-1}]){const good=row;row={...row,...bad};await assert.rejects(physical(sql,{},profile));row=good;}
  }
 }
});
