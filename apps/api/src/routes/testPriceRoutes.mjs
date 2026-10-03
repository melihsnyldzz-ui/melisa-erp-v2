import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {getSqlPool,getSqlDriver} from '../config/database.js';

export const testPriceRoutes=Router();
// Read-only evidence: purchase net, provisional card cost and inventory valuation are distinct.
testPriceRoutes.get('/test-prices',requireAuth,requirePermission('product.view'),async(req,res,next)=>{
 try{
  const pool=await getSqlPool(),sql=getSqlDriver();
  const identity=(await pool.request().query('SELECT DB_NAME() db')).recordset[0];
  if(identity.db!=='MELISA_ERP_SIRKET_TEST_20260929_01')throw Object.assign(new Error('Fiyat kanıtı yalnız izole TEST hedefinde okunabilir.'),{statusCode:503});
  const state=String(req.query.state||'');
  if(!['','INVOICE_VERIFIED','CARD_PROVISIONAL','EMPTY','CONFLICT'].includes(state))throw Object.assign(new Error('Geçersiz maliyet filtresi.'),{statusCode:400});
  const request=pool.request().input('search',sql.NVarChar(120),String(req.query.search||'').slice(0,120)).input('state',sql.VarChar(24),state).input('positive',sql.Bit,req.query.positive==='1');
  const result=await request.query(`
   SELECT TOP (100) p.id,p.stock_code,p.name,p.current_stock_qty,p.sales_price,p.currency_code,p.average_cost_try,e.payload,e.payload_hash
   FROM dbo.test_product_price_evidence e JOIN dbo.products p ON p.id=e.product_id
   WHERE p.is_active=1 AND p.is_deleted=0 AND (@positive=0 OR p.current_stock_qty>0)
     AND (@search=N'' OR CHARINDEX(@search,p.stock_code)>0 OR CHARINDEX(@search,p.name)>0)
     AND (@state='' OR JSON_VALUE(e.payload,'$.costState')=@state)
   ORDER BY p.stock_code,p.id;
   SELECT JSON_VALUE(e.payload,'$.costState') state,COUNT(*) count,SUM(CASE WHEN p.current_stock_qty>0 THEN 1 ELSE 0 END) positiveCount
   FROM dbo.test_product_price_evidence e JOIN dbo.products p ON p.id=e.product_id WHERE p.is_active=1 AND p.is_deleted=0 GROUP BY JSON_VALUE(e.payload,'$.costState');`);
  res.json({success:true,data:{database:identity.db,runId:'PRICE-20260929-01',readOnly:true,limit:100,summary:result.recordsets[1],items:result.recordsets[0].map(r=>({...r,evidence:JSON.parse(r.payload),payload:undefined}))}});
 }catch(e){next(e)}
});
