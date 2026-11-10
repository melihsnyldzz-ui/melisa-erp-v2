// Fixed composition only; the async owners retain their own physical tx and
// do not expose a transaction, general callback, capability or SQL handle.
import {createDesktopGoodsPreviewService} from './desktopGoodsPreviewService.mjs';
import {createDesktopGoodsReadService} from './desktopGoodsReadService.mjs';
import {createDesktopGoodsDraftService} from './desktopGoodsService.mjs';
import {createDesktopGoodsApprovalService} from './desktopGoodsApprovalService.mjs';
export function createDesktopGoodsService({connector,auth}={}){
 let initialized;const owners=()=>initialized??=(Promise.all([createDesktopGoodsPreviewService({connector,auth}),createDesktopGoodsReadService({connector,auth}),createDesktopGoodsDraftService({connector,auth}),createDesktopGoodsApprovalService({connector,auth})]));
 const call=(owner,method)=>async(...args)=>(await owners())[owner][method](...args);
 return Object.freeze({list:call(1,'list'),options:call(0,'options'),preview:call(0,'preview'),read:call(1,'read'),readRequest:call(1,'readRequest'),create:call(2,'create'),approve:call(3,'approve'),finalize:call(2,'finalize')});
}
