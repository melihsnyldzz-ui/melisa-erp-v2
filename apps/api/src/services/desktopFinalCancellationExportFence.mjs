// V5 preparation only. No directory/binding is provisioned by this module.
// Missing configuration is a rejection, never proof that export did not occur.
import {lstat,readFile} from 'node:fs/promises';
import {resolve,parse,join} from 'node:path';
import {createInvoiceExportJournal} from './vegaInvoiceExportJournal.mjs';
import {desktopFinalCancellationProfile,DESKTOP_FINAL_CANCELLATION_EXPORT_DIRECTORY as directory,DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING as binding} from '../../../../packages/shared/src/desktopFinalCancellationProfile.mjs';
export {DESKTOP_FINAL_CANCELLATION_EXPORT_DIRECTORY,DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT} from '../../../../packages/shared/src/desktopFinalCancellationProfile.mjs';
const fail=()=>{throw Error('DESKTOP_FINAL_CANCEL_EXPORT_UNAVAILABLE');};
async function target(targetProfile){
 const {directory,binding}=desktopFinalCancellationProfile(targetProfile);
 if(process.env.MELISA_EMPTY_LOCAL!=='20261105'||process.env.SQL_ENABLED!=='false'||process.env.MELISA_PILOT_RUNTIME==='true'||process.env.MELISA_INVOICE_EXPORT_PROFILE||process.env.MELISA_INVOICE_EXPORT_SOURCE_CONFIG||!process.env.MELISA_INVOICE_EXPORT_JOURNAL||resolve(process.env.MELISA_INVOICE_EXPORT_JOURNAL)!==resolve(directory))fail();
 let part=parse(resolve(directory)).root;
 for(const name of resolve(directory).slice(part.length).split(/[\\/]/)){part=join(part,name);const stat=await lstat(part);if(stat.isSymbolicLink()||!stat.isDirectory())fail();}
 const path=join(directory,'desktop-target.json'),stat=await lstat(path);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>2048)fail();
 const actual=JSON.parse(await readFile(path,'utf8'));
 if(!actual||Object.keys(actual).sort().join(',')!==Object.keys(binding).sort().join(',')||Object.entries(binding).some(([k,v])=>actual[k]!==v))fail();
 return createInvoiceExportJournal(directory);
}
export function createDesktopFinalCancellationExportFence({targetProfile=null}={}){
 return Object.freeze({
  async assertNoExport(invoiceId){const journal=await target(targetProfile);if(await journal.assertCancellationUnexported({invoiceId})!==true)fail();return true;},
  async claim({invoiceId,...proof}){const journal=await target(targetProfile);return journal.claimCancellation({invoiceId},proof);},
  async verify({invoiceId,...proof}){const journal=await target(targetProfile);return journal.verifyCancellation({invoiceId},proof);},
  async resolution({invoiceId,...proof}){const journal=await target(targetProfile);return journal.cancellationState({invoiceId},proof);}
 });
}
