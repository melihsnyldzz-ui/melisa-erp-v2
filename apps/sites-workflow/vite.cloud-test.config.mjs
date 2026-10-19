import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const mappings=new Map(['workTradeModel.mjs','workInboundModel.mjs','workCopyPresentation.mjs'].map(name=>[path.join(root,'src/workflow',name),path.join(root,'src/cloudTest',name)]));
export default {
  root,base:'/erp/',publicDir:false,
  plugins:[{name:'explicit-synthetic-cloud-models',enforce:'pre',resolveId(source,importer){
    if(!importer||!source.startsWith('.')||source.includes('?cloud-original'))return;
    return mappings.get(path.resolve(path.dirname(importer.split('?')[0]),source));
  }}],
  build:{outDir:'dist/cloud-test',emptyOutDir:true,rollupOptions:{input:path.join(root,'cloud.html')}},
  server:{host:'127.0.0.1',proxy:{'/api/cloud-test':{target:'http://127.0.0.1:62850'}}},
};
