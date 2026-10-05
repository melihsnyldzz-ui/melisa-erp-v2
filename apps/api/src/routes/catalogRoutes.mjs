import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {catalogProductService} from '../services/catalogProductService.mjs';
export const catalogProductsPath='/catalog/products';
export const catalogProductsRoutes=Router();
const handle=fn=>async(req,res,next)=>{try{res.json({success:true,...await fn(req)});}catch(error){next(error);}};
catalogProductsRoutes.get(catalogProductsPath,requireAuth,requirePermission('product.view'),handle(req=>catalogProductService.list(req.query,req.user)));
catalogProductsRoutes.get(`${catalogProductsPath}/:id`,requireAuth,requirePermission('product.view'),handle(req=>catalogProductService.detail(req.params.id,req.user)));
