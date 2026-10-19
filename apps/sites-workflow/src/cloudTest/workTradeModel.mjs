import * as original from '../workflow/workTradeModel.mjs?cloud-original';
import {validateCloudContext} from './validation.js';
export * from '../workflow/workTradeModel.mjs?cloud-original';
export const tradeContext=value=>validateCloudContext(value,original.tradeContext);
