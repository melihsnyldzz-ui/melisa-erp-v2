import * as original from '../workflow/workInboundModel.mjs?cloud-original';
import {validateCloudContext} from './validation.js';
export * from '../workflow/workInboundModel.mjs?cloud-original';
export const receivingContext=value=>validateCloudContext(value,original.receivingContext);
