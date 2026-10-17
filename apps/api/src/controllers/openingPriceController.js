import {openingPriceService} from '../services/openingPriceService.js';
import {ok,fail} from '../utils/response.js';
const failure=(res,error)=>fail(res,error.statusCode||503,error.code||'OPENING_PRICES_NOT_READY',error.statusCode?error.message:'Kabul edilmiş açılış fiyatları okunamadı.');
export async function getOpeningProductPrices(req,res){
  try{if(Object.keys(req.query??{}).length)return fail(res,400,'OPENING_PRICE_QUERY_INVALID','Fiyat detayına ek sorgu alanı gönderilemez.');
    const {data,meta}=await openingPriceService.detail(req.params.id);return ok(res,data,meta);
  }catch(e){return failure(res,e);}
}
export async function getOpeningPriceProducts(req,res){
  try{const {data,meta}=await openingPriceService.list(req.query);return ok(res,data,meta);}catch(e){return failure(res,e);}
}
