// Local failure codes only. Never persist messages, SQL, bodies or credentials.
import {appendFileSync,existsSync,lstatSync,mkdirSync} from 'node:fs';
const directory='C:/Users/Xaser/Desktop/ERP/logs',file=directory+'/first-sale-diagnostics.jsonl';
export function safeDesktopFailure({requestId,error}={}){
 const code=typeof error?.code==='string'&&/^[A-Z_]{1,80}$/.test(error.code)?error.code:'UNCLASSIFIED';
 const label=typeof error?.message==='string'&&/^(?:LOCAL_|DESKTOP_)[A-Z_]{1,100}$/.test(error.message)?error.message:null;
 const number=Number.isInteger(error?.number)&&error.number>=0&&error.number<=2147483647?error.number:null;
 return {time:new Date().toISOString(),scope:'LOCAL_MASTER',requestId:typeof requestId==='string'&&/^[a-f0-9-]{36}$/.test(requestId)?requestId:null,code,label,number};
}
export function recordDesktopFailure(event){if(process.env.NODE_ENV!=='production'||process.env.MELISA_EMPTY_LOCAL!=='20261105')return;try{mkdirSync(directory,{recursive:true});if(lstatSync(directory).isSymbolicLink())return;if(existsSync(file)){const s=lstatSync(file);if(s.isSymbolicLink()||!s.isFile()||s.size>100000)return;}appendFileSync(file,JSON.stringify(safeDesktopFailure(event))+'\n',{encoding:'utf8'});}catch{}}
