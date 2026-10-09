import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {crmOrderV2Service} from '../services/crmOrderV2Service.mjs';
import {getCrmOrderCurrentContext,crmOrderCurrentSource} from '../services/crmOrderCurrentContext.mjs';
export const crmOrderV2Routes=Router();
const handle=op=>async(req,res,next)=>{try{const context=getCrmOrderCurrentContext();res.json({success:true,data:await op(req),meta:{schemaVersion:'melisa-crm-draft.v2',environment:context?'ISOLATED_TEST_COPY':'CANONICAL_TEST',purpose:'crm-order-draft-only',externalOperations:false,...(context?{currentSource:crmOrderCurrentSource(context),actualT1:false}:{})}});}catch(e){next(e);}};
crmOrderV2Routes.get('/test/crm/orders/v2/customers',requireAuth,requirePermission('sales.view'),handle(req=>crmOrderV2Service().customers(req.query,req.user,req.get('x-crm-authorization'))));
crmOrderV2Routes.post('/test/crm/orders/v2/drafts',requireAuth,requirePermission('sales.create'),handle(req=>crmOrderV2Service().create(req.body,req.user,req.get('x-crm-authorization'))));
crmOrderV2Routes.get('/test/crm/orders/v2/drafts/:requestId',requireAuth,requirePermission('sales.view'),handle(req=>crmOrderV2Service().get(req.params.requestId,req.user,req.get('x-crm-authorization'))));
