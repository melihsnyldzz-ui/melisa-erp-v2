import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';

export function runPinnedNpm(args,cwd,env=process.env,{execFileSync=cp.execFileSync,existsSync=fs.existsSync,statSync=fs.statSync,nodeExecPath=process.execPath,platform=process.platform}={}){
 if(platform!=='win32')throw Error('PACKAGE_NPM_WINDOWS_REQUIRED');
 const npmCli=path.win32.join(path.win32.dirname(nodeExecPath),'node_modules','npm','bin','npm-cli.js');
 let regular=false;try{regular=existsSync(npmCli)&&statSync(npmCli).isFile();}catch{}
 if(!regular)throw Error('PACKAGE_NPM_CLI_NOT_FOUND');
 const pathKeys=Object.keys(env).filter(key=>key.toLowerCase()==='path');
 const pathKey=pathKeys[0]||'Path';
 const childEnv={...env};
 for(const key of pathKeys)delete childEnv[key];
 childEnv[pathKey]=path.win32.dirname(nodeExecPath)+path.win32.delimiter+(env[pathKey]||'');
 execFileSync(nodeExecPath,[npmCli,...args],{cwd,env:childEnv,stdio:'inherit',windowsHide:true});
}
