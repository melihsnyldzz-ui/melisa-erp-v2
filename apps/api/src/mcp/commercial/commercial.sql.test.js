import test from 'node:test';
import assert from 'node:assert/strict';
import {applySemantics} from './semantics.js';
import {compileQuery,compileAggregate} from './compiler.js';
import {readQuery} from './sourcePools.js';
import {closeBionicVegaSqlPool} from '../../config/bionicVegaDatabase.js';

// Opt-in live engine test, using ONLY SELECT over literal VALUES rowsets.
// No temporary tables, DDL, transactions, permissions, or business records.
test('SQL engine: return signs, cancellation and missing headers fail closed; transfers excluded',
  {skip:process.env.MCP_READ_ONLY_SQL_TESTS!=='true'},async()=>{
    const company='F0102',period='D0007';
    const make=(template,from,fields=[],periodScoped=true)=>({source:'vega',company,period:periodScoped?period:null,year:2026,
      id:'test.'+template,objectName:company+(periodScoped?period:'')+template,template,readable:true,from,objects:[],fields:fields.map(name=>({name,dataType:'int'}))});
    const movement=make('TBLSTOKHAREKETLERI',`(SELECT * FROM (VALUES
      (1,1,1,CAST('2026-09-01' AS datetime),N'33',CAST(0 AS bit),0,10,CAST(100 AS decimal(20,8)),10,1,N'A',N'$',CAST(40 AS decimal(20,8))),
      (2,1,1,CAST('2026-09-01' AS datetime),N'34',CAST(1 AS bit),2,0,CAST(20 AS decimal(20,8)),20,1,N'B',N'$',CAST(40 AS decimal(20,8))),
      (3,1,1,CAST('2026-09-01' AS datetime),N'33',CAST(0 AS bit),0,1,CAST(10 AS decimal(20,8)),30,1,N'C',N'$',CAST(40 AS decimal(20,8))),
      (4,1,1,CAST('2026-09-01' AS datetime),N'33',CAST(0 AS bit),0,1,CAST(10 AS decimal(20,8)),40,1,N'D',N'$',CAST(40 AS decimal(20,8))),
      (5,1,1,CAST('2026-09-01' AS datetime),N'33',CAST(0 AS bit),0,1,CAST(10 AS decimal(20,8)),50,1,N'E',N'$',CAST(40 AS decimal(20,8))),
      (6,1,1,CAST('2026-09-01' AS datetime),N'104',CAST(0 AS bit),10,0,CAST(10 AS decimal(20,8)),60,1,N'F',N'$',CAST(40 AS decimal(20,8)))
      ) v(IND,STOKNO,BIRIMEX,TARIH,IZAHAT,IADE,GIREN,CIKAN,TUTAR,BELGENO,FIRMANO,EVRAKNO,PARABIRIMI,KUR))`);
    const stock=make('TBLSTOKLAR','(SELECT 1 AS unused)',['IND','STOKKODU','MALINCINSI','KALAN','ANABIRIM','STATUS','DELETED'],false);
    const units=make('TBLBIRIMLEREX','(SELECT 1 AS unused)',[],false);
    const outgoing=make('TBLSTKCIKBASLIK',`(SELECT * FROM (VALUES (10,1,N'A',CAST(0 AS bit)),(30,1,N'C',CAST(1 AS bit)),(40,1,N'D',CAST(NULL AS bit))) v(IND,FIRMANO,BELGENO,IPTAL))`);
    const incoming=make('TBLSTKGIRBASLIK',`(SELECT 20 AS IND,1 AS FIRMANO,N'B' AS BELGENO,CAST(0 AS bit) AS IPTAL)`);
    const d=applySemantics([movement,stock,units,outgoing,incoming]).find(d=>d.template==='erp_posted_sales_basis');
    assert.ok(d);
    try {
      const q=compileQuery(d,{dataset:d.id,fields:['source_id','event_kind','net_sales_basis_try','signed_quantity','cancellation_state','header_verified'],limit:50});
      const rows=await readQuery('vega',[],q.statement,q.parameters);
      assert.equal(rows.length,5); // opening/transfer code 104 excluded
      assert.equal(rows[0].net_sales_basis_try,'100.00000000');
      assert.equal(rows[1].net_sales_basis_try,'-20.00000000');
      assert.equal(rows[1].signed_quantity,'-2.00000000');
      assert.equal(rows[2].cancellation_state,'cancelled');assert.equal(rows[2].net_sales_basis_try,null);
      assert.equal(rows[3].cancellation_state,'not_recorded');assert.equal(rows[3].net_sales_basis_try,null);
      assert.equal(rows[4].header_verified,false);assert.equal(rows[4].cancellation_state,'unverified');
      const args={dataset:d.id,groupBy:['erp_currency'],metrics:[{op:'sum',field:'net_sales_basis_try',as:'net'}]};
      const incomplete=compileAggregate(d,args);
      assert.equal((await readQuery('vega',[],incomplete.statement,incomplete.parameters))[0].net,null);
      const scoped=compileAggregate(d,{...args,filters:[{field:'cancellation_state',op:'eq',value:'not_cancelled'}]});
      assert.equal((await readQuery('vega',[],scoped.statement,scoped.parameters))[0].net,'80.00000000');
    } finally {await closeBionicVegaSqlPool();}
  });

test('SQL engine: missing quantities, mixed units and absent fallback values stay null',
  {skip:process.env.MCP_READ_ONLY_SQL_TESTS!=='true'},async()=>{
    const company='F0102',period='D0007';
    const make=(template,from,fields=[],periodScoped=true)=>({source:'vega',company,period:periodScoped?period:null,year:2026,id:'test.'+template,objectName:company+(periodScoped?period:'')+template,template,readable:true,from,objects:[],fields:fields.map(name=>({name,dataType:'int'}))});
    const stock=make('TBLSTOKLAR',`(SELECT IND,N'Synthetic' AS STOKKODU,N'Synthetic' AS MALINCINSI,KALAN,1 AS ANABIRIM,1 AS STATUS,CAST(0 AS bit) AS DELETED FROM (VALUES (1,CAST(99 AS decimal(28,8))),(2,99),(3,99),(4,NULL),(5,7)) s(IND,KALAN))`,['IND','STOKKODU','MALINCINSI','KALAN','ANABIRIM','STATUS','DELETED'],false);
    const units=make('TBLBIRIMLEREX',`(SELECT IND,STOKNO,N'recorded-unit' AS BIRIMADI FROM (VALUES (101,1),(102,2),(103,3),(104,3)) u(IND,STOKNO))`,[],false);
    const movement=make('TBLSTOKHAREKETLERI',`(SELECT * FROM (VALUES (1,CAST(10 AS decimal(28,8)),CAST(2 AS decimal(28,8)),101),(2,NULL,2,102),(3,10,2,103),(3,0,1,104)) m(STOKNO,GIREN,CIKAN,BIRIMEX))`);
    const d=applySemantics([stock,units,movement]).find(v=>v.template==='erp_stock_quantity');
    const q=compileQuery(d,{dataset:d.id,fields:['source_id','erp_quantity','source_unit','source_unit_id','quantity_basis']});
    try{
      const rows=await readQuery('vega',[],q.statement,q.parameters);
      assert.equal(rows[0].erp_quantity,'8.00000000');
      assert.equal(rows[1].erp_quantity,null);assert.equal(rows[1].quantity_basis,'incomplete_or_mixed_units');
      assert.equal(rows[2].erp_quantity,null);assert.equal(rows[2].source_unit_id,null);
      assert.equal(rows[3].erp_quantity,null);assert.equal(rows[3].quantity_basis,'stock_card_fallback');
      assert.equal(rows[4].erp_quantity,'7.00000000');assert.equal(rows[4].source_unit,null);
    }finally{await closeBionicVegaSqlPool();}
  });
