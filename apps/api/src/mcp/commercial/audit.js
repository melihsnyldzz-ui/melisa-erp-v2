import fs from 'node:fs';
import path from 'node:path';
import { fail } from './policy.js';

export function createAudit(directory) {
  if (!directory || !path.isAbsolute(directory)) throw fail('AUDIT_DIRECTORY_REQUIRED');
  fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'commercial-mcp.jsonl');
  return function audit({requestId,tool,event,code,durationMs,rowCount}) {
    // No arguments, SQL, filter values, credentials, account names, rows or
    // result bodies are logged. Rotation bounds local disk consumption.
    const record={at:new Date().toISOString(),requestId,tool,event,
      ...(code?{code}:{}),...(Number.isFinite(durationMs)?{durationMs}:{}),...(Number.isInteger(rowCount)?{rowCount}:{})};
    try {
      if(fs.existsSync(file)&&fs.statSync(file).size>5*1024*1024){
        for(let i=3;i>=1;i--){const previous=file+'.'+i;if(fs.existsSync(previous)){if(i===3)fs.unlinkSync(previous);else fs.renameSync(previous,file+'.'+(i+1));}}
        fs.renameSync(file,file+'.1');
      }
      fs.appendFileSync(file,JSON.stringify(record)+'\n',{mode:0o600});
    } catch { throw fail('AUDIT_UNAVAILABLE'); }
  };
}
