import path from 'node:path';
import {createHash} from 'node:crypto';
const problem=()=>Object.assign(new Error('WORKTEST_PACKAGE_PIN'),{code:'WORKTEST_PACKAGE_PIN',statusCode:503});
export const FEATURE_ENTRY='scripts/canonical/start-terminal-worktest.mjs';
// Closed set of the entry's current relative-import graph, including its validators.
export const FEATURE_SOURCE_FILES=Object.freeze([
 'apps/api/src/services/businessDailyHomeReadProof.mjs',
 'apps/api/src/services/businessSelectedSaleNativeContext.mjs',
 'apps/api/src/services/businessSelectedSaleInvoiceRead.mjs',
 'apps/api/src/services/businessSelectedSaleHistoricalReadProof.mjs',
 'apps/api/src/services/businessProductPriceStartup.mjs',
 'apps/api/src/services/businessProductPriceSaleModel.mjs',
 'apps/api/src/services/businessProductPriceSaleScope.mjs',
 'apps/api/src/services/businessCollectionHistoryProof.mjs',
 'apps/api/src/services/productCopyPurchaseReferencePin.mjs',
 'apps/api/src/services/businessSelectedSaleStartup.mjs',
 'apps/api/src/services/normalTestRefreshSession.mjs',
 'apps/api/src/services/businessSelectedSaleWriteIntent.mjs',
 'apps/api/src/services/businessSelectedSaleWriteScope.mjs',
 'apps/api/src/services/workSalesModel.mjs',
 'apps/api/src/services/businessDailyNativeCheck.mjs',
 'apps/api/src/services/businessDailyProfitRevision.mjs',
 'apps/api/src/services/businessReadinessQueryPlanRevision.mjs',
 'apps/api/src/services/businessDailyRevisionBootstrap.mjs',
 'apps/api/src/services/businessReadyRevisionBootstrap.mjs',
 'apps/api/src/services/isolatedOperationCopyContext.mjs',
 'apps/api/src/services/isolatedOperationCopyStoreFactory.mjs',
 'apps/api/src/services/selectedSaleSqlDiagnostic.mjs',
 'apps/api/src/services/isolatedOperationCopyScope.mjs',
 'apps/api/src/middleware/businessInboundSelectionContext.mjs',
 'apps/api/src/services/homeSummaryReadStoreFactory.mjs',
 'apps/api/src/services/createHomeSummaryServiceFactory.mjs',
 'apps/api/src/services/homeSummaryModel.mjs',
 'apps/api/src/services/stockProductModel.mjs',
 'apps/api/src/services/currentProductCatalogContext.mjs',
 'apps/api/src/services/finalCatalogContext.mjs',
 'apps/api/src/services/sharedCopyBootstrap.mjs',
 'apps/api/src/services/customerContactStartupPin.mjs',
 'apps/api/src/services/sharedCopyRelease.mjs',
 'apps/api/src/services/sharedCopyWebPolicy.mjs',
 'apps/api/src/services/terminalCartonSource.mjs',
 'apps/api/src/services/terminalCartonStore.mjs',
 'apps/sites-workflow/src/workflow/cartonModel.mjs',
 FEATURE_ENTRY,
 'scripts/canonical/shared-business-daily-profit-revision.mjs',
 'scripts/canonical/shared-business-customer-contact-contract.mjs',
 'scripts/canonical/shared-business-customer-contact-sql.mjs',
 'scripts/canonical/shared-business-product-price-bootstrap.mjs',
 'scripts/canonical/shared-business-product-price-revision-contract.mjs',
 'scripts/canonical/shared-business-product-price-revision-sql.mjs',
 'scripts/canonical/shared-business-product-price-sale-bootstrap.mjs',
 'scripts/canonical/shared-business-product-price-sale-sql.mjs',
 'scripts/canonical/shared-business-collection-history-bootstrap.mjs',
 'scripts/canonical/shared-business-collection-history-sql.mjs',
 'scripts/canonical/shared-business-stock-predicate-distinct-revision-sql.mjs',
 'scripts/canonical/shared-business-stock-predicate-distinct-source.mjs',
 'scripts/canonical/shared-business-selected-sale-preview-sql.mjs',
 'scripts/canonical/shared-business-selected-sale-revision-bootstrap.mjs',
 'scripts/canonical/shared-business-selected-sale-revision-contract.mjs',
 'scripts/canonical/shared-business-selected-sale-revision-sql.mjs',
 'scripts/canonical/shared-business-selected-sale-effects-revision-sql.mjs',
 'scripts/canonical/shared-business-selected-sale-parent-revision-sql.mjs',
 'scripts/canonical/shared-business-supplier-item-quarantine-revision.mjs',
 'scripts/canonical/shared-business-supplier-item-quarantine-parent-revision-sql.mjs',
 'scripts/canonical/shared-business-operation-quarantine-revision.mjs',
 'scripts/canonical/shared-business-operation-quarantine-parent-revision-sql.mjs',
 'scripts/canonical/shared-business-selected-sale-write-scope-sql.mjs',
 'scripts/canonical/stage4-copy-sql.mjs',
 'scripts/canonical/terminal-persistent-web-support.mjs',
 'scripts/canonical/terminal-worktest-home-readonly.mjs',
 'scripts/canonical/terminal-worktest-package.mjs'
]);
export function assertFeatureEntry(spec,entryPath){
 if(typeof entryPath!=='string'||path.win32.resolve(entryPath)!==entryPath||entryPath!==path.win32.join(spec.root,...FEATURE_ENTRY.split('/')))throw problem();
}
export async function verifyFeatureSources(manifest,readSource){
 const pins=new Map(manifest.files.map(row=>[row.path,row.sha256]));
 for(const file of FEATURE_SOURCE_FILES){
  if(!pins.has(file))throw problem();const bytes=await readSource(file);
  if(createHash('sha256').update(bytes).digest('hex')!==pins.get(file))throw problem();
  // A new local or package import requires an explicit addition to the pin set.
  const text=bytes.toString('utf8');if(/\bimport\s*\(/.test(text))throw problem();for(const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g)){
   const dependency=match[1];if(dependency.startsWith('node:'))continue;
   if(!dependency.startsWith('.')||!FEATURE_SOURCE_FILES.includes(path.posix.normalize(path.posix.join(path.posix.dirname(file),dependency))))throw problem();
  }
 }
}
export function featurePackageSpec(args=[]){
 if(!args.length)return null;
 if(args.length!==6||args[0]!=='--feature-package'||args[2]!=='--source-commit'||args[4]!=='--manifest-sha256')throw problem();
 const root=path.win32.resolve(args[1]);
 if(root!==args[1]||path.win32.dirname(root).toLowerCase()!=='c:\\sirket\\erp\\releases'||!/^CANONICAL-COMPLETE-TEST-20261011-[a-f0-9]{7,12}$/.test(path.win32.basename(root))||!/^[a-f0-9]{40}$/.test(args[3])||!/^[a-f0-9]{64}$/.test(args[5])||!path.win32.basename(root).endsWith(args[3].slice(0,path.win32.basename(root).split('-').at(-1).length)))throw problem();
 return {root,sourceCommit:args[3],manifestSha256:args[5]};
}
export function validateFeatureManifest(manifest,spec){
 const c=manifest?.sharedTestCopy;
 if(manifest?.sourceCommit!==spec.sourceCommit||manifest.packageId!=='CANONICAL-TEST-'+spec.sourceCommit.slice(0,12)||!c||c.database!=='MELISA_ERP_CRM_SHARED_TEST_20261009_02'||c.apiPort!==4184||c.nativePort!==4186||c.webPort!==5234||c.host!=='127.0.0.1'||c.nativeLoopbackOnly!==true||c.nativeWrites!==false||c.externalOperations!==false||c.actualT1!==false||!Array.isArray(manifest.files))throw problem();
 const files=new Map();
 for(const row of manifest.files){
  if(typeof row?.path!=='string'||row.path.includes('\\')||row.path.startsWith('/')||row.path.split('/').some(x=>x==='.'||x==='..'||!x)||!/^[a-f0-9]{64}$/.test(row.sha256)||files.has(row.path))throw problem();
  files.set(row.path,row.sha256);
 }
 const prefix='apps/sites-workflow/dist-business/';
 const served=new Map([...files].filter(([p])=>p.startsWith(prefix)).map(([p,h])=>[p.slice(prefix.length),h]));
 if(!served.has('terminal.html')||!served.has('ornek-akis.html')||!served.has('kullanim-egitimi.html')||![...served.keys()].some(p=>/^assets\/terminal-.*\.js$/.test(p)))throw problem();
 return served;
}
