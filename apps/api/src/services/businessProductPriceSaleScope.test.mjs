import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {businessProductPriceFixture} from './businessProductPrice.test-fixture.mjs';
import {fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {withIsolatedOperationCopyScope} from './isolatedOperationCopyScope.mjs';
import {bindBusinessProductPriceSaleDTO,getBusinessProductPriceSaleDTO,transferBusinessProductPriceSaleDTO,clearBusinessProductPriceSaleDTO} from './businessProductPriceSaleScope.mjs';
import {readBusinessSelectedSaleNativeContext} from './businessSelectedSaleNativeContext.mjs';

test('pure pricing JSON, copied objects and booleans cannot mint or transfer native price authority',async()=>{
 const {copy}=businessProductPriceFixture(),dto={pricingProof:{mode:'CURRENT'},scope:{products:[]}},transaction={};
 assert.equal(getBusinessProductPriceSaleDTO(copy,dto),null);assert.equal(clearBusinessProductPriceSaleDTO(dto),false);
 assert.throws(()=>transferBusinessProductPriceSaleDTO(copy,dto,structuredClone(dto)),{code:'PRICE_SALE_DTO_TRANSFER'});
 assert.throws(()=>bindBusinessProductPriceSaleDTO({copy,transaction,artifact:{},dto,pricingJson:'[]'}),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
 const identity={db:copy.target.database,server:copy.target.server,login:copy.target.login,databaseUser:copy.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0};
 await assert.rejects(()=>withIsolatedOperationCopyScope({context:copy,identity,transaction,readProof:fixtureProof(copy),write:false},async()=>bindBusinessProductPriceSaleDTO({copy,transaction,artifact:{copyId:copy.copyId,kind:'context'},dto,pricingJson:'[]'})),{code:'PRICE_SALE_DTO_REGISTERED_ARTIFACT'});
 assert.equal(getBusinessProductPriceSaleDTO(copy,dto),null);
});

test('optional native consumer refuses a generic caller object before SQL; history cannot fall back to current source',async()=>{
 const {copy,actor}=businessProductPriceFixture();let calls=0;
 const options={copy,transaction:{},sql:{},request:()=>{calls++;throw Error('not allowed');},actor,selection:{}};
 await assert.rejects(()=>readBusinessSelectedSaleNativeContext({...options,priceConsumer:{canEdit:true,bundle:{contextArtifact:{}}}}),{code:'PRICE_SALE_SERVER_CONSUMER'});
 await assert.rejects(()=>readBusinessSelectedSaleNativeContext({...options,invoiceId:'12'}),{code:'PRICE_SALE_HISTORY_CONSUMER_REQUIRED'});
 assert.equal(calls,0);
});

test('history and intent pricing provenance follow the exact frozen native SQL mapping',()=>{
 const sql=fs.readFileSync(new URL('../../../../scripts/canonical/shared-business-product-price-sale-sql.mjs',import.meta.url),'utf8');
 assert.match(sql,/JSON_MODIFY\(context_json,'\$\.pricingProof\.readerDefinitionHash',\$\{nh\(BUSINESS_PRICE_SALE_HISTORY\)\}\)/);
 const helper=fs.readFileSync(new URL('./businessProductPriceSaleScope.mjs',import.meta.url),'utf8');
 assert.match(helper,/readerDefinitionHash:kind==='intent'\?bundle\.contextArtifact\.definitionHash:artifact\.definitionHash/);
});
