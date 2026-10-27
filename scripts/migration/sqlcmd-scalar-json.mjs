// SQLCMD -y 0 -w <width> wraps a scalar FOR JSON value at physical columns,
// including inside JSON property names and strings. Never use permissive JSON
// parsing on this transport: first validate its shape and remove only wrapping.
export function parseSqlcmdScalarJson(value,{width=65535}={}){
 if(typeof value!=='string'||!Number.isSafeInteger(width)||width<1)throw Error('SQLCMD_JSON_TRANSPORT');
 const lines=value.replace(/^\uFEFF/,'').split(/\r?\n/);
 while(lines.length&&lines[0].trim()==='')lines.shift();while(lines.length&&lines.at(-1).trim()==='')lines.pop();
 if(!lines.length||lines.some((s,i)=>s.includes('\r')||i<lines.length-1&&s.length!==width||s.length>width))throw Error('SQLCMD_JSON_WRAP_SHAPE');
 let parsed;try{parsed=JSON.parse(lines.join(''));}catch{throw Error('SQLCMD_JSON_INVALID');}
 if(!parsed||typeof parsed!=='object')throw Error('SQLCMD_JSON_ROOT');
 return parsed;
}
