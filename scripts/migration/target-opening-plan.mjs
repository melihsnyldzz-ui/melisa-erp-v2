import { sql, RUN, readSource, testPool, fingerprints, savePrivate } from './target-opening-runtime.mjs';
import { decimal, roundDecimal, sumDecimals, hash, requireRule } from './mapping-opening.mjs';
const subtract = (a, b) => sumDecimals([a, decimal(b).startsWith('-') ? decimal(b).slice(1) : '-' + decimal(b)]);
const supported = p => p.scope?.startsWith('IN_SCOPE');
export async function prepareNativeOpening(sourceDirectory) {
  const { snapshot, summary, mapped } = readSource(sourceDirectory), pool = await testPool();
  try {
    const q = async statement => (await pool.request().query(statement)).recordset;
    const productRows = await q(`SELECT p.id,p.stock_code,p.name,p.unit,p.currency_code,p.source_record_key,CASE WHEN EXISTS(SELECT 1 FROM dbo.purchase_invoice_items pii JOIN dbo.purchase_invoices pi ON pi.id=pii.purchase_invoice_id WHERE pii.product_id=p.id AND pi.status=N'finalized' AND ISNULL(pi.is_migrated,0)=0 AND pi.document_date>='2026-10-01') THEN 1 ELSE 0 END local_cost_verified,CONVERT(varchar(100),p.current_stock_qty) qty,CONVERT(varchar(100),p.average_cost_try) cost,CONVERT(varchar(100),p.sales_price) sale,CONVERT(varchar(100),p.purchase_price) purchase,CONVERT(varchar(100),COALESCE(e.quantity,0)) ledger,CONVERT(varchar(100),COALESCE(l.quantity,0)) local_delta,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) before_hash FROM dbo.products p OUTER APPLY(SELECT SUM(m.quantity_net) quantity FROM dbo.inventory_effective_movements m WHERE m.product_id=p.id)e OUTER APPLY(SELECT SUM(m.quantity_net) quantity FROM dbo.stock_movements m WHERE m.product_id=p.id AND m.affects_inventory=1 AND m.source_record_key IS NULL AND m.inventory_cutover_id IS NULL AND NOT EXISTS(SELECT 1 FROM dbo.sales_invoices i WHERE m.source_type=N'sales_invoice' AND i.id=m.source_id AND i.affects_inventory=0) AND NOT EXISTS(SELECT 1 FROM dbo.purchase_invoices i WHERE m.source_type=N'purchase_invoice' AND i.id=m.source_id AND i.affects_inventory=0))l ORDER BY p.id`);
    const aliases = await q('SELECT source_product_id,product_id FROM dbo.product_source_aliases ORDER BY id'), productById = new Map(productRows.map(r => [String(r.id), r]));
    const bySource = new Map(); for (const a of aliases) { const id = String(a.source_product_id), list = bySource.get(id) ?? []; list.push(productById.get(String(a.product_id))); bySource.set(id, list); }
    const plans = [], quarantine = [], mappings = [], mappedTargets = new Set();
    for (const p of snapshot.products.filter(supported)) {
      const candidates = bySource.get(String(p.sourceId)) ?? [], r = candidates.length === 1 ? candidates[0] : null;
      const reject = reason => quarantine.push({ entity: 'product', sourceKey: p.sourceKey, reason });
      if (!r || r.stock_code !== p.stockCode || r.name !== p.name || r.source_record_key !== `VEGA2026/F0102TBLSTOKLAR/${p.sourceId}`) { reject('EXACT_NATIVE_IDENTITY_NOT_PROVEN'); continue; }
      if (mappedTargets.has(String(r.id))) { reject('MANY_SOURCE_TO_ONE_PHYSICAL_TARGET'); continue; } mappedTargets.add(String(r.id));
      if (p.quantity === null || p.unitStatus !== 'VERIFIED_ADET_FACTOR_1') { reject('QUANTITY_OR_UNIT_UNKNOWN'); continue; }
      const wanted = sumDecimals([p.quantity, r.local_delta]), delta = subtract(wanted, r.ledger);
      try { decimal(wanted, 3); decimal(delta, 3); } catch { reject('NATIVE_QUANTITY_PRECISION'); continue; }
      const sale = p.prices.find(x => String(x.unitSourceId) === String(p.mainUnitSourceId) && x.tier === 1 && x.currency === r.currency_code);
      const fields = { current_stock_qty: decimal(wanted, 3), average_cost_try: null,brand:p.brand,category:p.category,is_active:p.isActive };
      // A source purchase/sales currency mismatch is preserved and reported, never converted.
      if (sale?.price !== null && sale?.price !== undefined) fields.sales_price = roundDecimal(sale.price, 4);
      if (p.purchasePrice.currency === r.currency_code && p.purchasePrice.price !== null) fields.purchase_price = roundDecimal(p.purchasePrice.price, 4);
      else quarantine.push({ entity: 'product-price', sourceKey: p.sourceKey, reason: 'PURCHASE_PRICE_CURRENCY_MISMATCH_PRESERVED' });
      if (p.averageCostTry !== null) fields.average_cost_try = roundDecimal(p.averageCostTry, 4);
      if(r.local_cost_verified===1) fields.average_cost_try=r.cost===null?null:roundDecimal(r.cost,4);
      plans.push({ table: 'products', targetId: String(r.id), sourceKey: p.sourceKey, beforeHash: r.before_hash, fields, stockDelta: decimal(delta, 3), sourceQuantity: decimal(p.quantity), localDelta: decimal(r.local_delta), sourceId: String(p.sourceId), costStatus: p.costStatus });
      mappings.push({ entity: 'product', sourceKey: p.sourceKey, targetId: String(r.id), desiredQuantity: decimal(wanted), sourceQuantity: decimal(p.quantity), preservedNativeDelta: decimal(r.local_delta), priorScalar: decimal(r.qty), priorLedger: decimal(r.ledger) });
    }
    const nativeBarcodes=await q('SELECT id,product_id,barcode,is_active FROM dbo.product_barcodes ORDER BY id'),barcodeOwners=new Map(),nativeOwners=new Map(),barcodeKey=value=>String(value).trimEnd().toLocaleUpperCase('tr-TR');
    for(const p of snapshot.products)for(const b of p.barcodes){const key=barcodeKey(b.barcode),owners=barcodeOwners.get(key)??new Set();owners.add(String(p.sourceId));barcodeOwners.set(key,owners);}
    for(const b of nativeBarcodes){const key=barcodeKey(b.barcode),group=nativeOwners.get(key)??[];group.push(b);nativeOwners.set(key,group);}
    const barcodeInserts=[],badProductSources=new Set();
    for(const p of snapshot.products.filter(supported)){
      const target=plans.find(x=>x.table==='products'&&x.sourceKey===p.sourceKey);if(!target)continue;
      for(const barcode of new Set(p.barcodes.map(b=>b.barcode))){const key=barcodeKey(barcode),owners=nativeOwners.get(key)??[];if(owners.some(o=>String(o.product_id)===target.targetId)){if(owners.filter(o=>String(o.product_id)===target.targetId).every(o=>!o.is_active)){badProductSources.add(p.sourceKey);quarantine.push({entity:'barcode',sourceKey:p.sourceKey,reason:'INACTIVE_AMBIGUOUS_BARCODE_PRODUCT_QUARANTINED'});}continue;}
        if(owners.length||barcodeOwners.get(key)?.size!==1){badProductSources.add(p.sourceKey);quarantine.push({entity:'barcode',sourceKey:p.sourceKey,reason:'BARCODE_OWNER_CONFLICT_PRODUCT_QUARANTINED'});continue;}
        barcodeInserts.push({table:'product_barcodes',targetId:null,sourceKey:`BARCODE/${target.targetId}/${barcode}`,productSourceKey:p.sourceKey,fields:{product_id:target.targetId,barcode,barcode_type:'extra',is_primary:false,is_active:true,created_by:'1'}});
      }
    }
    for(let i=plans.length-1;i>=0;i--)if(plans[i].table==='products'&&badProductSources.has(plans[i].sourceKey))plans.splice(i,1);
    for(let i=mappings.length-1;i>=0;i--)if(mappings[i].entity==='product'&&badProductSources.has(mappings[i].sourceKey))mappings.splice(i,1);
    plans.push(...barcodeInserts.filter(p=>!badProductSources.has(p.productSourceKey)));
    const existingPrices = await q(`SELECT x.id,x.product_id,x.price_type,x.price_tier,x.currency_code,x.source_unit_id,CONVERT(varchar(100),x.price) price,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) before_hash FROM dbo.product_prices x ORDER BY x.id`);
    const priceKey=(id,type,tier,currency,unit)=>JSON.stringify([String(id),type,tier,currency,String(unit??'')]),priceIndex=new Map();
    for(const x of existingPrices){const key=priceKey(x.product_id,x.price_type,x.price_tier,x.currency_code,x.source_unit_id),group=priceIndex.get(key)??[];group.push(x);priceIndex.set(key,group);}
    const nativeProducts = new Map(plans.filter(p=>p.table==='products').map(p=>[p.sourceKey,p]));
    for (const p of mapped.tables.prices) {
      const product = nativeProducts.get(p.product_source_key);
      if (!product || p.price_status !== 'SOURCE') continue;
      const found = priceIndex.get(priceKey(product.targetId,p.price_type,p.tier,p.currency_code,p.unit_source_id))??[];
      if (found.length>1) { quarantine.push({entity:'price',sourceKey:p.source_key,reason:'AMBIGUOUS_NATIVE_PRICE_KEY'}); continue; }
      if(found.length===1) plans.push({table:'product_prices',targetId:String(found[0].id),sourceKey:p.source_key,beforeHash:found[0].before_hash,fields:{price:p.price}});
      else plans.push({table:'product_prices',targetId:null,sourceKey:p.source_key,fields:{product_id:product.targetId,price_type:p.price_type,price_tier:p.tier,currency_code:p.currency_code,price:p.price,source_unit_id:p.unit_source_id,source_record_key:p.source_key,migration_run_id:RUN,source_payload_hash:p.source_payload_hash}});
    }
    for (const [role, table, ledger, idColumn, codeColumn] of [['customer','customers','customer_movements','customer_id','customer_code'],['supplier','suppliers','supplier_movements','supplier_id','supplier_code']]) {
      const rows = await q(`SELECT p.id,p.${codeColumn} code,p.name,p.currency_code,p.source_record_key,CONVERT(varchar(100),p.balance) balance,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) before_hash,CONVERT(varchar(100),COALESCE(l.local_delta,0)) local_delta,CONVERT(varchar(100),COALESCE(l.ledger,0)) ledger FROM dbo.${table} p OUTER APPLY(SELECT SUM(CASE WHEN ISNULL(m.affects_balance,1)=1 THEN COALESCE(m.balance_effect_exact,m.balance_effect) ELSE 0 END) ledger,SUM(CASE WHEN m.source_record_key IS NULL AND m.cutover_source_key IS NULL AND ISNULL(m.affects_balance,1)=1 THEN m.balance_effect ELSE 0 END) local_delta FROM dbo.${ledger} m WHERE m.${idColumn}=p.id AND COALESCE(m.account_currency,m.currency_code)=p.currency_code)l ORDER BY p.id`);
      const links = await q(`SELECT source_id,source_company,${idColumn} target_id FROM dbo.party_source_links WHERE ${idColumn} IS NOT NULL ORDER BY id`);
      for (const p of snapshot.parties.filter(p => supported(p) && p.role === role)) {
        const matches = links.filter(l => String(l.source_id) === String(p.sourceId) && l.source_company === p.company), r = matches.length === 1 ? rows.find(r => String(r.id) === String(matches[0].target_id)) : null;
        if (!r || r.code !== p.code || r.name !== p.name || r.currency_code !== p.currency || p.nativeBalanceMapped === null) { quarantine.push({ entity: role, sourceKey: p.sourceKey, reason: 'NATIVE_IDENTITY_CURRENCY_OR_BALANCE_UNPROVEN' }); continue; }
        if(mappedTargets.has(`${role}/${r.id}`)){quarantine.push({entity:role,sourceKey:p.sourceKey,reason:'MANY_SOURCE_TO_ONE_PARTY'});continue;}mappedTargets.add(`${role}/${r.id}`);
        const desired = sumDecimals([p.nativeBalanceMapped, r.local_delta]);
        plans.push({ table, targetId: String(r.id), sourceKey: p.sourceKey, beforeHash: r.before_hash, fields: { balance: roundDecimal(desired,4) }, balanceDelta: subtract(desired,r.ledger), desiredBalanceExact:desired, sourceId: String(p.sourceId), currency: p.currency });
        mappings.push({ entity: role, sourceKey: p.sourceKey, targetId: String(r.id), desiredBalance: decimal(desired), sourceBalance: decimal(p.nativeBalanceMapped), sourceSignedBalance:decimal(p.sourceSignedBalance), preservedNativeDelta: decimal(r.local_delta), priorScalar: decimal(r.balance), priorLedger: decimal(r.ledger) });
      }
    }
    const nativeAccounts=await q(`SELECT x.id,x.party_entity_id,x.customer_id,x.supplier_id,x.currency_code,CONVERT(varchar(100),x.current_balance) balance,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) before_hash FROM dbo.party_currency_accounts x ORDER BY x.id`);
    for(const p of plans.filter(p=>p.table==='customers'||p.table==='suppliers')){
      const idColumn=p.table==='customers'?'customer_id':'supplier_id',matches=nativeAccounts.filter(a=>String(a[idColumn])===p.targetId&&a.currency_code===p.currency);
      if(matches.length!==1){quarantine.push({entity:'account',sourceKey:p.sourceKey,reason:'NATIVE_MAIN_ACCOUNT_UNPROVEN'});plans.splice(plans.indexOf(p),1);const mapped=mappings.findIndex(m=>m.sourceKey===p.sourceKey);if(mapped>=0)mappings.splice(mapped,1);continue;}
      const a=matches[0];p.partyEntityId=String(a.party_entity_id);p.partyCurrencyAccountId=String(a.id);plans.push({table:'party_currency_accounts',targetId:String(a.id),sourceKey:p.sourceKey+'/MAIN-ACCOUNT/'+p.currency,beforeHash:a.before_hash,fields:{current_balance:p.desiredBalanceExact}});
    }
    for(const party of snapshot.parties.filter(supported)){
      const role=party.role,idColumn=role+'_id',native=plans.find(p=>p.table===(role==='customer'?'customers':'suppliers')&&p.sourceKey===party.sourceKey);if(!native)continue;
      const mainAccount=nativeAccounts.find(a=>String(a[idColumn])===native.targetId&&a.currency_code===native.currency);if(!mainAccount)continue;
      for(const account of party.accounts.filter(a=>a.currency&&a.currency!==party.currency&&a.nativeBalanceMapped!==null)){
        const found=nativeAccounts.filter(a=>String(a.party_entity_id)===String(mainAccount.party_entity_id)&&a.currency_code===account.currency),sourceKey=party.sourceKey+'/AUX-ACCOUNT/'+account.currency;
        if(found.length>1){quarantine.push({entity:'account',sourceKey,reason:'AMBIGUOUS_AUXILIARY_ACCOUNT'});continue;}
        const ledgerRows=await q(`SELECT CONVERT(varchar(100),COALESCE(SUM(CASE WHEN ISNULL(affects_balance,1)=1 THEN COALESCE(balance_effect_exact,balance_effect) ELSE 0 END),0)) ledger,CONVERT(varchar(100),COALESCE(SUM(CASE WHEN source_record_key IS NULL AND cutover_source_key IS NULL AND ISNULL(affects_balance,1)=1 THEN balance_effect ELSE 0 END),0)) local_delta FROM dbo.${role}_movements WHERE ${idColumn}=${native.targetId} AND COALESCE(account_currency,currency_code)=N'${account.currency}'`);
        const desired=sumDecimals([account.nativeBalanceMapped,ledgerRows[0].local_delta]),fields=found.length?{current_balance:desired}:{party_entity_id:String(mainAccount.party_entity_id),currency_code:account.currency,customer_id:role==='customer'?native.targetId:null,supplier_id:role==='supplier'?native.targetId:null,current_balance:desired,balance_status:'SOURCE_OPENING_EXACT',source_record_key:sourceKey,migration_run_id:RUN,source_payload_hash:hash(account),source_payload_json:JSON.stringify(account)};
        plans.push({table:'party_currency_accounts',targetId:found.length?String(found[0].id):null,sourceKey,beforeHash:found[0]?.before_hash,fields,auxiliary:true,role,partyTargetId:native.targetId,partyEntityId:String(mainAccount.party_entity_id),partyCurrencyAccountId:found.length?String(found[0].id):null,sourceId:party.sourceId,currency:account.currency,balanceDelta:subtract(desired,ledgerRows[0].ledger)});
      }
    }
    const protectedBefore = await fingerprints(() => pool.request());
    const plan = { run: RUN, sourceDirectory, sourceHash: summary.snapshotHash, mappedHash: mapped.mappedHash, createdAt: new Date().toISOString(), sourceAsOf: summary.source.sourceAsOf, sourceLive: false, nativeDeltaPolicy: 'PRESERVE_UNLINKED_EFFECTIVE_NATIVE_MOVEMENTS_OUTSIDE_PRIOR_INVENTORY_CUTOVER; SOURCE_ORIGIN_HISTORY_REPLACED_BY_OPENING_ONLY', plans, mappings, quarantine, protectedBefore, counts: { products: plans.filter(p=>p.table==='products').length, customers: plans.filter(p=>p.table==='customers').length, suppliers: plans.filter(p=>p.table==='suppliers').length, quarantined: quarantine.length } };
    plan.planHash = hash(plan); savePrivate('native-plan.json', plan); savePrivate('mapping-summary.json', {run:RUN,sourceHash:plan.sourceHash,planHash:plan.planHash,counts:plan.counts,unknowns:mapped.unknowns});
    return {run:RUN,sourceHash:plan.sourceHash,planHash:plan.planHash,counts:plan.counts,unknowns:mapped.unknowns};
  } finally { await pool.close(); }
}
if (process.argv[2]) prepareNativeOpening(process.argv[2]).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(JSON.stringify({code:e.message,number:e.number??null}));process.exitCode=1;});
