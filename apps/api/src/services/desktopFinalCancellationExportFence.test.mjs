import test from 'node:test';import assert from 'node:assert/strict';
test('private export fence rejects missing/wrong config, foreign binding and reparse paths instead of accepting a no-op guard',async t=>{
 const names=['MELISA_EMPTY_LOCAL','SQL_ENABLED','MELISA_PILOT_RUNTIME','MELISA_INVOICE_EXPORT_PROFILE','MELISA_INVOICE_EXPORT_SOURCE_CONFIG','MELISA_INVOICE_EXPORT_JOURNAL'],prior=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 t.after(()=>{for(const [k,v]of Object.entries(prior)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 let actual={profile:'desktop-master-v5',server:'Semih\\MELISAERP',database:'MELISA_ERP_DESKTOP_TEST_20261105',databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1',environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',actualT1:0,externalOperations:0},reparse=false,reads=0,claims=0;
 t.mock.module('node:fs/promises',{exports:{lstat:async path=>({isSymbolicLink:()=>reparse,isDirectory:()=>!path.endsWith('.json'),isFile:()=>path.endsWith('.json'),size:400}),readFile:async()=>{reads++;return JSON.stringify(actual);}}});
 t.mock.module('./vegaInvoiceExportJournal.mjs',{exports:{createInvoiceExportJournal:path=>{assert.equal(path,'C:/Users/Xaser/Desktop/ERP/kurulum/master-v5-export-journal');return {async assertCancellationUnexported(){return true;},async claimCancellation(){claims++;return {state:'CANCELLATION_FENCED'};},async verifyCancellation(){return true;}};}}});
 const {createDesktopFinalCancellationExportFence}=await import('./desktopFinalCancellationExportFence.mjs'),fence=createDesktopFinalCancellationExportFence(),proof={invoiceId:'13',actorId:'30002',requestId:'7cbb7e06-ef75-4456-92e5-99f6d99b8312',payloadHash:'a'.repeat(64)};
 for(const k of names)delete process.env[k];await assert.rejects(fence.assertNoExport('13'));assert.equal(reads,0);
 process.env.MELISA_EMPTY_LOCAL='20261105';process.env.SQL_ENABLED='false';process.env.MELISA_INVOICE_EXPORT_JOURNAL='C:/Users/Xaser/Desktop/ERP/kurulum/master-v5-export-journal';
 assert.equal(await fence.assertNoExport('13'),true);assert.equal((await fence.claim(proof)).state,'CANCELLATION_FENCED');assert.equal(await fence.verify(proof),true);
 for(const [key,value]of [['MELISA_PILOT_RUNTIME','true'],['SQL_ENABLED','true'],['MELISA_EMPTY_LOCAL','wrong'],['MELISA_INVOICE_EXPORT_JOURNAL','C:/elsewhere'],['MELISA_INVOICE_EXPORT_PROFILE','x'],['MELISA_INVOICE_EXPORT_SOURCE_CONFIG','x']]){const before=process.env[key];process.env[key]=value;await assert.rejects(fence.claim(proof));if(before===undefined)delete process.env[key];else process.env[key]=before;}
 actual={...actual,databaseGuid:'00000000-0000-4000-8000-000000000000'};await assert.rejects(fence.claim(proof));reparse=true;await assert.rejects(fence.claim(proof));assert.equal(claims,1);
});
