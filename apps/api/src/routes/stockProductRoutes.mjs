import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {stockProductService} from '../services/stockProductService.mjs';
export const stockProductRoutes=Router();
const handle=fn=>async(req,res,next)=>{try{res.json({success:true,...await fn(req)});}catch(error){next(error);}};
stockProductRoutes.get('/stock-products',requireAuth,requirePermission('product.view'),handle(req=>stockProductService.list(req.query,req.user)));
stockProductRoutes.get('/stock-products/:id',requireAuth,requirePermission('product.view'),handle(req=>stockProductService.detail(req.params.id,req.user)));
