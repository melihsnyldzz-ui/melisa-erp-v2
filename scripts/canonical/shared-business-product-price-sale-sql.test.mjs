import test from 'node:test';
import assert from 'node:assert/strict';
import {capturedFixture} from './shared-business-selected-sale-revision-bootstrap.test-fixture.mjs';
import {compileCapturedBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-capture.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {isolatedCopyHash,isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {BUSINESS_PRICE_COPY_ID,BUSINESS_PRICE_CURRENT} from './shared-business-product-price-revision-contract.mjs';
import {buildBusinessProductPriceRevision} from './shared-business-product-price-revision-sql.mjs';
import {buildBusinessProductPriceSaleRevision,assertPreparedBusinessProductPriceSaleArtifact,BUSINESS_PRICE_SALE_CONTEXT,BUSINESS_PRICE_SALE_BEGIN,BUSINESS_PRICE_SALE_INTENT,BUSINESS_PRICE_SALE_HISTORY,BUSINESS_PRICE_SALE_LINK_GUARD,BUSINESS_PRICE_SALE_ASSERT,BUSINESS_PRICE_SALE_PROOF} from './shared-business-product-price-sale-sql.mjs';

export async function productPriceSaleCompilerFixture(){
 const input=await capturedFixture(1,raw=>{raw.copyId=BUSINESS_PRICE_COPY_ID;});
 const {copy,bundle}=await compileCapturedBusinessSelectedSaleRevision(input);
 // Synthetic v11 predecessor, never a current SQL proof or an installed capability.
 const {revisionHash:previousHash,...selectedBody}=bundle.revision;selectedBody.version=11;
 const selectedBundle={...bundle,revision:{...selectedBody,revisionHash:isolatedCopyHash(selectedBody)}};
 const priceBundle=buildBusinessProductPriceRevision({copyContext:copy,baseRevision:selectedBundle.revision});
 const args={copyContext:copy,selectedBundle,priceBundle,selectedBaseInput:{daily:input.daily,profit:input.profit,schema:input.schema}};
 return {args,copy,bundle:buildBusinessProductPriceSaleRevision(args)};
}
const fixture=productPriceSaleCompilerFixture;
const def=(bundle,name)=>bundle.objects.find(o=>o.name===name).definition;

test('pinned context rewrite supports only the two frozen canonical headers and preserves the body',async()=>{
 const {rewriteBusinessProductPriceSaleContextHeader:rewrite}=await import('./shared-business-product-price-sale-sql.mjs');
 const name='dbo.usp_business_selected_sale_context_v1',body='@copy_id uniqueidentifier AS BEGIN SELECT 1;END;';
 for(const spaces of [' ','   '])assert.equal(rewrite(`CREATE${spaces}PROCEDURE ${name} ${body}`,name),`CREATE PROCEDURE ${BUSINESS_PRICE_SALE_CONTEXT} ${body}`);
 for(const prefix of ['CREATE  PROCEDURE','CREATE OR ALTER PROCEDURE','ALTER PROCEDURE',' CREATE PROCEDURE'])assert.throws(()=>rewrite(`${prefix} ${name} ${body}`,name),{code:'PRICE_SALE_CONTEXT_HEADER'});
});

// Optional hash-pinned compiler source is private deployment evidence, not a
// credential/config or a live SQL connection. Ordinary CI keeps this explicit
// skip; the source rehearsal supplies both values without embedding its input.
test('genuine v11 compatibility artifacts compile the price successor without changing their stored bytes',{skip:!process.env.ERP04_V11_LEAF_INPUT||!process.env.ERP04_V11_LEAF_SHA256},async()=>{
 const {privateBusinessPriceLeafSources,earnedBusinessProductPriceNativeFixture}=await import('../../apps/api/src/services/businessProductPriceNative.test-fixture.mjs');
 const leaves=privateBusinessPriceLeafSources(process.env.ERP04_V11_LEAF_INPUT,process.env.ERP04_V11_LEAF_SHA256);
 const f=await earnedBusinessProductPriceNativeFixture(leaves),base=f.selected.bundle.contextArtifact;
 assert.equal(f.nativeExecution,false);assert.equal(f.selected.stockPredicateRevision.version,11);
 assert.match(base.storedDefinition,/^CREATE   PROCEDURE /);
 const before=base.storedDefinition,bundle=buildBusinessProductPriceSaleRevision({copyContext:f.copy,priceBundle:f.metadata.bundle,selectedBundle:f.selected.bundle,selectedBaseInput:{daily:f.state.daily,profit:f.state.profit,schema:f.state.schema}});
 assert.equal(base.storedDefinition,before);assert.equal(moduleHash(before),base.definitionHash);
 assert.equal(bundle.revision.sourceContextHash,base.definitionHash);assert.equal(bundle.revision.baseSelectedRevisionHash,f.selected.stockPredicateRevision.revisionHash);
 assert.match(bundle.contextArtifact.storedDefinition,/^CREATE PROCEDURE dbo\.usp_business_product_price_sale_context_v1 /);
 assert.equal(f.consumer.canEdit,true);assert.deepEqual(bundle.revision,f.consumer.revision);
});

test('canonical sale adjunct is deterministic, branded, and leaves source parent definitions unchanged',async()=>{
 const {args,copy,bundle}=await fixture(),before=isolatedCopyJSON(args.selectedBundle);
 const again=buildBusinessProductPriceSaleRevision(args);
 assert.deepEqual(again.revision,bundle.revision);assert.deepEqual(again.objects,bundle.objects);
 assert.equal(isolatedCopyJSON(args.selectedBundle),before);assert.equal(bundle.objects.length,7);
 assert.deepEqual(bundle.replacements,[]);assert.equal(bundle.businessWrites,0);assert.equal(bundle.grants,0);
 for(const o of bundle.objects)assert.equal(moduleHash(o.definition),o.afterHash);
 const {revisionHash,...body}=bundle.revision;assert.equal(revisionHash,isolatedCopyHash(body));
 assert.equal(assertPreparedBusinessProductPriceSaleArtifact(bundle.contextArtifact,copy,'context'),bundle.contextArtifact);
 assert.throws(()=>assertPreparedBusinessProductPriceSaleArtifact({...bundle.contextArtifact},copy,'context'),{code:'PRICE_SALE_SERVER_ARTIFACT_REQUIRED'});
 assert.throws(()=>buildBusinessProductPriceSaleRevision({...args,priceBundle:{...args.priceBundle,assertionSQL:'SELECT 1'}}),{code:'PRICE_SALE_CANONICAL_PRICE_BUNDLE'});
});

test('context inlines all native guards without nested INSERT EXEC and preserves separate source/manual witnesses',async()=>{
 const {bundle}=await fixture(),context=def(bundle,BUSINESS_PRICE_SALE_CONTEXT);
 assert.doesNotMatch(context,/\bINSERT\b[^;]*\bEXEC\b/i);
 for(const code of ['SELECTED_SALE_NATIVE_PRODUCT_DRIFT','SELECTED_SALE_NATIVE_FX_DRIFT','IMMUTABLE_VERSION_PROOF','SOURCE_QUOTE_COUNT'])assert(context.includes(code));
 assert.match(context,/strict \$\.unitPriceExact8/);
 assert.match(context,/CASE WHEN selected\.version_id IS NULL THEN s\.source_price ELSE v\.price_exact END/);
 assert.match(context,/v\.source_price_exact=s\.source_price/);assert.match(context,/v\.source_native_hash=s\.native_hash/);
 assert.match(context,/pricing_json/);assert.match(context,/versionProofHash/);assert.match(context,/HASHBYTES\('SHA2_256',@price_sale_pricing_json\)/);
 assert.match(context,/JSON_VALUE\(quote_json,'\$\.currency'\) currency/);
 assert.match(context,/JSON_QUERY\(priced\.prices_json\)/);
 assert.match(context,/s\.bindingHash,raw\.value FROM/);
 assert.doesNotMatch(context,/value nvarchar\(max\) '\$' AS JSON/);
 assert.match(context,/SOURCE_QUOTE_JSON/);
 assert.match(context,/CROSS APPLY\(SELECT N'\['\+STRING_AGG/);
 assert.doesNotMatch(context,/STRING_AGG\([^;]*JSON_QUERY\(\(SELECT/);
 assert.doesNotMatch(context,/COALESCE\(v\.price_exact/);
});

test('owner begin retains original security and delegates old invoices while exact native totals consume effective price',async()=>{
 const {bundle}=await fixture(),begin=def(bundle,BUSINESS_PRICE_SALE_BEGIN);
 for(const code of ['STAGE4_ACTOR_PERMISSION_DRIFT','STAGE4_REQUEST_CONFLICT','SELECTED_SUCCESSOR_CREATION_LINES','SELECTED_SUCCESSOR_SOURCE_POLICY_HASH'])assert(begin.includes(code));
 assert.match(begin,/EXEC dbo\.usp_business_selected_sale_begin_v1.*RETURN;END;/);
 assert.match(begin,/ROUND\(q\.unitPriceExact8,4\)/);assert.match(begin,/EFFECTIVE_PRICE_UNAVAILABLE/);
 assert.match(begin,/selectedPricingJSON/);assert.match(begin,/selectedPricingProof/);
 assert.doesNotMatch(begin,/JSON_QUERY\(@payload_json,'\$\.pricing'\)/);
 assert.match(def(bundle,BUSINESS_PRICE_SALE_INTENT),/before_state_json/);
});

test('historical pricing selects versions from sealed native creation, never a current pointer',async()=>{
 const {bundle}=await fixture(),context=def(bundle,BUSINESS_PRICE_SALE_CONTEXT),history=def(bundle,BUSINESS_PRICE_SALE_HISTORY);
 assert.match(history,/work_sales_links/);assert.match(history,/stage4_copy_requests/);assert.match(history,/sales_invoices/);
 const historicalProjection=history.slice(history.indexOf('DECLARE @customer_id bigint'));
 assert.doesNotMatch(historicalProjection,new RegExp(BUSINESS_PRICE_CURRENT.replaceAll('.','\\.')));
 assert.match(context,/ON @invoice_id IS NULL AND c\.copy_id/);
 assert.match(context,/@invoice_id IS NULL THEN c\.version_id ELSE h\.version_id/);
 assert.match(context,/h\.proof_hash=/);assert.match(context,/HISTORICAL_EXACT_VERSION/);
 assert.match(context,/pricingJson nvarchar\(max\)/);
});

test('missing client snapshot cannot escape owner link guard; restricted bootstrap uses owner proof only',async()=>{
 const {bundle}=await fixture(),link=def(bundle,BUSINESS_PRICE_SALE_LINK_GUARD);
 assert.match(link,/AND NOT EXISTS\(SELECT 1 FROM dbo\.stage4_copy_intents/);
 assert.match(link,/selectedPricingJSON IS NOT NULL/);assert.match(link,/LINK_OWNER_VERSION_PROOF/);
 assert.match(link,/CONVERT\(varbinary\(max\),p\.pricingJson\)=CONVERT\(varbinary\(max\),b\.selectedPricingJSON\)/);
 assert.equal(bundle.proofSQL,`EXEC ${BUSINESS_PRICE_SALE_PROOF} @copy_id;`);
 assert.match(def(bundle,BUSINESS_PRICE_SALE_ASSERT),/ADJUNCT_PROOF/);
 for(const catalog of ['sys.columns','sys.indexes','sys.index_columns','sys.foreign_keys','sys.foreign_key_columns','sys.check_constraints','sys.trigger_events'])assert.ok(def(bundle,BUSINESS_PRICE_SALE_ASSERT).includes(catalog));
 assert.match(def(bundle,BUSINESS_PRICE_SALE_ASSERT),/REGISTRY_SCHEMA/);
 assert.match(def(bundle,BUSINESS_PRICE_SALE_PROOF),/registrySchemaValid/);
 assert.match(def(bundle,BUSINESS_PRICE_SALE_INTENT),/@dto nvarchar\(max\);\s*DECLARE @rows TABLE/);
 assert.match(bundle.grantSQL,/DENY SELECT,INSERT,UPDATE,DELETE/);
 const all=bundle.objects.map(o=>o.definition).join('\n');
 assert.doesNotMatch(all,/(?:INSERT|UPDATE|DELETE|ALTER)\s+(?:dbo\.)?(?:product_prices|products|users|roles|permissions|stage4_copy_module_manifest|stage4_copy_manifest)\b/i);
});
