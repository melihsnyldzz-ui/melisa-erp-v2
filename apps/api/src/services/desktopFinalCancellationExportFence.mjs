// V5 preparation only. No directory/binding is provisioned by this module.
// Missing configuration is a rejection, never proof that export did not occur.
import {lstat,readFile} from 'node:fs/promises';
import {resolve,parse,join} from 'node:path';
import {createInvoiceExportJournal} from './vegaInvoiceExportJournal.mjs';
const directory='C:/Users/Xaser/Desktop/ERP/kurulum/master-v5-export-journal';
const binding=Object.freeze({profile:'desktop-master-v5',server:'Semih\\MELISAERP',database:'MELISA_ERP_DESKTOP_TEST_20261105',databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1',environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',actualT1:0,externalOperations:0});
const fail=()=>{throw Error('DESKTOP_FINAL_CANCEL_EXPORT_UNAVAILABLE');};
async function target(){
 if(process.env.MELISA_EMPTY_LOCAL!=='20261105'||process.env.SQL_ENABLED!=='false'||process.env.MELISA_PILOT_RUNTIME==='true'||process.env.MELISA_INVOICE_EXPORT_PROFILE||process.env.MELISA_INVOICE_EXPORT_SOURCE_CONFIG||!process.env.MELISA_INVOICE_EXPORT_JOURNAL||resolve(process.env.MELISA_INVOICE_EXPORT_JOURNAL)!==resolve(directory))fail();
 let part=parse(resolve(directory)).root;
 for(const name of resolve(directory).slice(part.length).split(/[\\/]/)){part=join(part,name);const stat=await lstat(part);if(stat.isSymbolicLink()||!stat.isDirectory())fail();}
 const path=join(directory,'desktop-target.json'),stat=await lstat(path);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>2048)fail();
 const actual=JSON.parse(await readFile(path,'utf8'));
 if(!actual||Object.keys(actual).sort().join(',')!==Object.keys(binding).sort().join(',')||Object.entries(binding).some(([k,v])=>actual[k]!==v))fail();
 return createInvoiceExportJournal(directory);
}
export function createDesktopFinalCancellationExportFence(){
 return Object.freeze({
  async assertNoExport(invoiceId){const journal=await target();if(await journal.assertCancellationUnexported({invoiceId})!==true)fail();return true;},
  async claim({invoiceId,...proof}){const journal=await target();return journal.claimCancellation({invoiceId},proof);},
  async verify({invoiceId,...proof}){const journal=await target();return journal.verifyCancellation({invoiceId},proof);}
 });
}
