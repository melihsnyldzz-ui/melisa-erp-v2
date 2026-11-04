import {createHash} from 'node:crypto';
const prefixes=Object.freeze(['apps/api/node_modules/','apps/sites-workflow/node_modules/','apps/web-admin/node_modules/']);
const fail=()=>{throw Error('ERP_COMPLETE_INVENTORY_REJECTED');};
const safe=p=>typeof p==='string'&&!/[\\\x00-\x1f"'`$%<>|?:*]/.test(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');
const hash=rows=>createHash('sha256').update(JSON.stringify(rows,null,2)+'\n').digest('hex');
export function verifyPr53CompletePackageInventory(manifest,observed){
 if(!Array.isArray(manifest?.files)||!manifest.files.length||!Array.isArray(observed))fail();
 const expected=new Map(),seen=new Set(),dependencies=new Map(prefixes.map(p=>[p,[]]));
 for(const row of manifest.files){if(!safe(row.path)||expected.has(row.path.toLowerCase())||!/^[a-f0-9]{64}$/.test(row.sha256)||prefixes.some(p=>row.path.startsWith(p)))fail();expected.set(row.path.toLowerCase(),row);}
 let declared=0,manifests=0;
 for(const row of observed){if(!safe(row.path)||seen.has(row.path.toLowerCase())||!/^[a-f0-9]{64}$/.test(row.sha256))fail();seen.add(row.path.toLowerCase());
  if(row.path==='release-manifest.json'){manifests++;continue;}
  const pinned=expected.get(row.path.toLowerCase());if(pinned){if(row.path!==pinned.path||row.sha256!==pinned.sha256)fail();declared++;continue;}
  const prefix=prefixes.find(p=>row.path.startsWith(p));if(!prefix)fail();dependencies.get(prefix).push({path:row.path,sha256:row.sha256});
 }
 if(manifests!==1||declared!==expected.size)fail();
 const summaries=[...dependencies].map(([prefix,rows])=>{if(!rows.length)fail();rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);return {prefix,files:rows.length,inventorySha256:hash(rows)};});
 return {declaredFiles:declared,totalFiles:observed.length,dependencyInventories:summaries};
}
