import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {dailyPrepare,dailyDraft,dailyDecide,dailyContext,dailyFxPreview,dailyFxCollect,dailyFxCancel,dailyFxContext,dailyPreparePartialGoods,dailyReversalFixture} from '../services/testDailyService.mjs';
export const testDailyRoutes=Router();
const handle=fn=>async(r,res,next)=>{try{res.json({success:true,data:await fn(r),meta:{environment:'ISOLATED_TEST'}})}catch(e){next(e)}};
testDailyRoutes.post('/test-daily/purchase/prepare-partial-goods',requireAuth,requirePermission('purchase.cancel'),handle(r=>dailyPreparePartialGoods(r.body,r.user)));
testDailyRoutes.get('/test-daily/fx/context',requireAuth,requirePermission('customer.view'),handle(r=>dailyFxContext(r.user)));
for(const [op,fn] of [['preview',dailyFxPreview],['collect',dailyFxCollect],['reverse',dailyFxCancel]])testDailyRoutes.post('/test-daily/fx/'+op,requireAuth,requirePermission('finance.collection'),handle(r=>fn(r.body,r.user)));
for(const f of ['purchase','sales','fx','count','count-cancel','return-cancel']){
 const kind=f==='count-cancel'?'count':f==='return-cancel'?'purchase':f;
 const read=kind==='fx'?'customer.view':kind==='count'?'product.view':kind+'.view',approve=kind==='fx'?'finance.collection':kind==='count'?'stock.adjust':kind+'.cancel';
 testDailyRoutes.get('/test-daily/'+f,requireAuth,requirePermission(read),handle(r=>dailyContext(f,r.user)));
 for(const op of ['prepare','draft','approve','reject','cancel'])testDailyRoutes.post(`/test-daily/${f}/${op}`,requireAuth,requirePermission(op==='draft'?read:approve),handle(r=>{
  const allowed=op==='prepare'?['requestId','date']:op==='draft'?['requestId','quantity','date','reason','kind','unit','warehouse','goodsId','expectedStock','movementFingerprint','sourceInvoiceId','sourceItemId']:['requestId','id','reason','date','correctionType'];
  if(Object.keys(r.body).some(k=>!allowed.includes(k)))throw Object.assign(new Error('Kapsam dışı alan gönderildi.'),{code:'TEST_PAYLOAD',statusCode:400});
  return op==='prepare'?(f.endsWith('-cancel')?dailyReversalFixture(f,op,r.body,r.user):dailyPrepare(f,r.body,r.user)):op==='draft'?dailyDraft(f,r.body,r.user):dailyDecide(f,op,r.body,r.user);
 }));
}

for(const op of ['sale','purchase'])testDailyRoutes.post('/test-daily/count-cancel/'+op,requireAuth,requirePermission('stock.adjust'),handle(r=>dailyReversalFixture('count-cancel',op,r.body,r.user)));
