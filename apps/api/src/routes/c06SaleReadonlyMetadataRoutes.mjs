import {Router} from 'express';
import {requireAuth,requirePermission} from '../middleware/authMiddleware.js';
import {readC06SaleReadonlyMetadata} from '../services/c06SaleReadonlyMetadata.mjs';
import {getExistingCanonicalReadonlyPool,runWithCanonicalExistingPoolOnly} from '../config/database.js';

const path='/maintenance/sale-metadata';
const loopback=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
const hosts=new Set(['127.0.0.1:4146','localhost:4146','[::1]:4146']);
export const isC06MetadataLoopback=(address,host)=>loopback.has(address) && hosts.has(host);

// This route has no caller-controlled SQL, target, object, or pool argument.
// Mount only in the canonical native listener; its reader checks the actual
// SQL session independently. The permission is an existing audit permission.
export function createC06SaleReadonlyMetadataRoutes({authenticate=requireAuth,reader=readC06SaleReadonlyMetadata}={}) {
  const router=Router();let pending=false;
  router.all(path,async(req,res,next)=>{
    res.set('Cache-Control','no-store').set('Pragma','no-cache').set('X-Content-Type-Options','nosniff');
    if (!isC06MetadataLoopback(req.socket?.remoteAddress,req.headers.host)
      || ['forwarded','x-forwarded-for','x-forwarded-host','x-real-ip'].some(key=>req.headers[key]!==undefined)) return res.status(403).end();
    if (req.method!=='GET') return res.status(405).set('Allow','GET').end();
    if (req.originalUrl!=='/api/maintenance/sale-metadata' || req.headers['transfer-encoding']!==undefined
      || (req.headers['content-length']!==undefined && req.headers['content-length']!=='0')
      || (req.body!==undefined && (req.body===null || typeof req.body!=='object' || Reflect.ownKeys(req.body).length))) return res.status(400).end();
    try {
      if(!await getExistingCanonicalReadonlyPool())return res.status(503).json({success:false,error:{code:'C06_SALE_METADATA_UNAVAILABLE'}});
      return runWithCanonicalExistingPoolOnly(next);
    } catch {return res.status(503).json({success:false,error:{code:'C06_SALE_METADATA_UNAVAILABLE'}});}
  },authenticate,requirePermission('audit.view'),async(req,res)=>{
    if (req.authContext?.nativeTerminalCode!=null || req.user?.nativeTerminalSession===true) return res.status(403).end();
    if(pending)return res.status(503).json({success:false,error:{code:'C06_SALE_METADATA_UNAVAILABLE'}});
    pending=true;
    try {return res.json({success:true,data:await reader()});}
    catch {return res.status(503).json({success:false,error:{code:'C06_SALE_METADATA_UNAVAILABLE'}});}
    finally {pending=false;}
  });
  return router;
}
