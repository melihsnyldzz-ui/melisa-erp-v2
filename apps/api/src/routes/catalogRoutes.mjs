import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {catalogProductService} from '../services/catalogProductService.mjs';
export const catalogProductsPath='/catalog/products';
export const catalogProductsRoutes=Router();
const handle=fn=>async(req,res,next)=>{try{res.json({success:true,...await fn(req)});}catch(error){next(error);}};
catalogProductsRoutes.get(catalogProductsPath,requireAuth,requirePermission('product.view'),handle(req=>catalogProductService.list(req.query,req.user)));
catalogProductsRoutes.get(`${catalogProductsPath}/:id/photo`,requireAuth,requirePermission('product.view'),async(req,res,next)=>{try{const image=await catalogProductService.photo(req.params.id,req.query,req.user);res.set({'Content-Type':image.mimeType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.status(200).end(image.bytes);}catch(error){next(error);}});
catalogProductsRoutes.get(`${catalogProductsPath}/:id`,requireAuth,requirePermission('product.view'),handle(req=>catalogProductService.detail(req.params.id,req.user)));
