// Bounded offline fixture assembled through the existing canonical builders.
// No protected config, SQL, network or runtime imports/execution.
import {capturedFixture} from './shared-business-selected-sale-revision-bootstrap.test-fixture.mjs';
import {compileCapturedBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-capture.mjs';
import {extendedFixtureInput} from './crm-order-current.test-fixture.mjs';
import {validateCrmOrderCurrentContext} from '../../apps/api/src/services/crmOrderCurrentContext.mjs';
import {isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {buildBusinessProductPriceRevision} from './shared-business-product-price-revision-sql.mjs';
import {buildBusinessProductPriceSaleRevision} from './shared-business-product-price-sale-sql.mjs';
import {buildSharedCrmPriceRevision} from './shared-crm-price-revision-sql.mjs';

export async function sharedCrmPriceFixture(){
 const captured=await capturedFixture(1,raw=>{raw.copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';});
 const {copy,bundle}=await compileCapturedBusinessSelectedSaleRevision(captured);
 const {revisionHash,...body}=bundle.revision;body.version=11;
 const selectedBundle={...bundle,revision:{...body,revisionHash:isolatedCopyHash(body)}};
 const priceBundle=buildBusinessProductPriceRevision({copyContext:copy,baseRevision:selectedBundle.revision});
 const selectedBaseInput={daily:captured.daily,profit:captured.profit,schema:captured.schema};
 const priceConsumerBundle=buildBusinessProductPriceSaleRevision({copyContext:copy,priceBundle,selectedBundle,selectedBaseInput});
 const raw=extendedFixtureInput();raw.copyId=copy.copyId;raw.backupSHA=copy.backupSHA;raw.catalog.runId=copy.currentProductSourceVersionRunId;
 raw.catalog.ancestry[raw.catalog.ancestry.length-1].runId=raw.catalog.runId;
 const suffix=raw.catalog.runId.replaceAll('-','_').toLowerCase()+'_r3';
 raw.catalog.procedures={catalog:`dbo.usp_read_work_catalog_${suffix}`,stock:`dbo.usp_read_stock_products_${suffix}`,detail:`dbo.usp_get_source_version_prices_${suffix}`,list:`dbo.usp_list_source_version_products_${suffix}`};
 const crmContext=validateCrmOrderCurrentContext(raw),args={crmContext,copyContext:copy,priceBundle,priceConsumerBundle,selectedBundle,selectedBaseInput};
 return {args,bundle:buildSharedCrmPriceRevision(args)};
}
