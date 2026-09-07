import path from 'node:path';
import { realpath, open } from 'node:fs/promises';
import crypto from 'node:crypto';
import { exactKeys, fail } from './policy.js';
import { resolveScope, scopedDataset, requireFields } from './scope.js';
import { readQuery, sql } from './sourcePools.js';

const MAX_IMAGE_BYTES=3*1024*1024;
export function imageMime(bytes) {
  if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
  throw fail('IMAGE_FORMAT_UNSUPPORTED');
}
export async function readMappedImage(filePath, root) {
  if(typeof root!=='string'||!path.isAbsolute(root))throw fail('MEDIA_ROOT_NOT_CONFIGURED');
  if(typeof filePath!=='string'||!/^\/uploads\/vega-products\/[^/\\:%?\x00-\x1f]+\.(jpg|jpeg|png|webp)$/i.test(filePath))throw fail('IMAGE_PATH_NOT_ALLOWED');
  let handle;
  try {
    const actualRoot=await realpath(root), candidate=await realpath(path.join(actualRoot,path.basename(filePath)));
    const relative=path.relative(actualRoot,candidate);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw fail('IMAGE_PATH_NOT_ALLOWED');
    handle=await open(candidate,'r');
    const stat=await handle.stat();
    if(!stat.isFile()||stat.size<=0||stat.size>MAX_IMAGE_BYTES)throw fail('IMAGE_SIZE_NOT_ALLOWED');
    const buffer=Buffer.alloc(stat.size+1);
    let total=0;
    while(total<buffer.length){const {bytesRead}=await handle.read(buffer,total,buffer.length-total,null);if(!bytesRead)break;total+=bytesRead;}
    if(total!==stat.size)throw fail('IMAGE_CHANGED_DURING_READ');
    const bytes=buffer.subarray(0,total),mimeType=imageMime(bytes);
    return {bytes:total,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),mimeType,data:bytes.toString('base64')};
  }catch(e){if(e.code==='ENOENT')throw fail('IMAGE_FILE_NOT_FOUND');if(e.code==='EACCES'||e.code==='EPERM')throw fail('IMAGE_FILE_PERMISSION_MISSING');throw e;}
  finally{await handle?.close();}
}
export async function getProductImage(args) {
  exactKeys(args,['stockCode']);
  if(typeof args.stockCode!=='string'||!args.stockCode.trim()||args.stockCode.length>120)throw fail('INVALID_STOCK_CODE');
  const scope=await resolveScope({}),stocks=await scopedDataset(scope,'TBLSTOKLAR');
  requireFields(stocks,['IND','STOKKODU','STATUS','DELETED','IPTAL']);
  // The existing local mapping has no company/period key. The operator must
  // bind it to its proven owning company; it cannot follow arbitrary firms.
  if(process.env.MCP_READ_ONLY_MEDIA_COMPANY!==scope.company)throw fail('IMAGE_COMPANY_BINDING_REQUIRED');
  const cards=await readQuery('vega',stocks.objects,`SELECT TOP (2) IND,STOKKODU FROM ${stocks.from} WHERE STOKKODU=@code AND STATUS=1 AND DELETED=0 AND IPTAL=0 ORDER BY IND OPTION (MAXDOP 1)`,[{name:'code',type:sql.NVarChar(120),value:args.stockCode.trim()}]);
  if(cards.length!==1)throw fail(cards.length?'AMBIGUOUS_STOCK_CODE':'STOCK_CODE_NOT_FOUND');
  const objects=[{schemaName:'dbo',objectName:'vega_product_images'}];
  let mapping;
  try {
    mapping=await readQuery('melisa',objects,`SELECT TOP (2) file_path FROM dbo.vega_product_images WHERE vega_source_id=@id AND stock_code=@code AND is_active=1 AND is_primary=1 ORDER BY id OPTION (MAXDOP 1)`,[{name:'id',type:sql.BigInt,value:cards[0].IND},{name:'code',type:sql.NVarChar(120),value:cards[0].STOKKODU}]);
  } catch(error) {
    error.failureScope={source:'melisa',database:'MELISA_ERP_V2',objects};
    throw error;
  }
  if(mapping.length!==1)throw fail(mapping.length?'AMBIGUOUS_IMAGE_MAPPING':'IMAGE_MAPPING_NOT_FOUND');
  const {data,...info}=await readMappedImage(mapping[0].file_path,process.env.MCP_READ_ONLY_MEDIA_ROOT);
  return {...scope,source:'melisa',database:'MELISA_ERP_V2',objects,stockSource:{database:scope.database,company:scope.company,object:stocks.id},stockCode:cards[0].STOKKODU,
    scope:'One active primary image joined by exact source stock identity and stock code; bytes returned through the authenticated MCP response.',
    image:info,mcpImage:{type:'image',mimeType:info.mimeType,data}};
}
