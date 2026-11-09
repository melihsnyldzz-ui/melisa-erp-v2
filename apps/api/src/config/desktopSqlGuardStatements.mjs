// Static SQL text compilation only. No permission result, connection or actor
// is cached. Every emitted IF still executes on the original physical session.
const fail=()=>{throw Error('DESKTOP_SQL_GUARD_GRAMMAR_REJECTED');};
const wordStart=c=>/[A-Za-z_@$#]/.test(c??'');
const wordPart=c=>/[A-Za-z0-9_@$#]/.test(c??'');
const trivia=t=>t.kind==='space'||t.kind==='comment';
const forbidden=new Set(['BEGIN','END','ELSE','CASE','WHEN','THEN','RETURN','EXEC','EXECUTE','DECLARE','SET','INSERT','UPDATE','DELETE','MERGE','TRUNCATE','CREATE','ALTER','DROP','GRANT','DENY','REVOKE','WAITFOR','PRINT','RAISERROR','GOTO','USE','GO','WHILE','TRY','CATCH']);

// Preserve byte offsets instead of rebuilding tokens: quoted definitions,
// escaped quotes/identifiers and nested subqueries retain their exact bytes.
function tokens(sql){
 if(typeof sql!=='string'||!sql.length||sql.length>1_000_000||sql.includes('\0'))fail();
 const out=[];let at=0,depth=0;
 const push=(kind,start)=>out.push({kind,start,end:at,text:sql.slice(start,at),depth});
 while(at<sql.length){
  const start=at,c=sql[at],next=sql[at+1];
  if(/[ \t\r\n]/.test(c)){do{at++;}while(at<sql.length&&/[ \t\r\n]/.test(sql[at]));push('space',start);continue;}
  if(c==='-'&&next==='-'){at+=2;while(at<sql.length&&sql[at]!=='\r'&&sql[at]!=='\n')at++;push('comment',start);continue;}
  if(c==='/'&&next==='*'){
   at+=2;let nesting=1;
   while(at<sql.length&&nesting){if(sql[at]==='/'&&sql[at+1]==='*'){nesting++;at+=2;}else if(sql[at]==='*'&&sql[at+1]==='/'){nesting--;at+=2;}else at++;}
   if(nesting)fail();push('comment',start);continue;
  }
  if(c==="'"||c==='"'||c==='['||((c==='N'||c==='n')&&next==="'")){
   const close=c==='['?']':c==='N'||c==='n'?"'":c;
   at+=c==='N'||c==='n'?2:1;let closed=false;
   while(at<sql.length){if(sql[at]===close){if(sql[at+1]===close){at+=2;continue;}at++;closed=true;break;}at++;}
   if(!closed)fail();push(close==="'"?'string':'identifier',start);continue;
  }
  if(wordStart(c)){do{at++;}while(at<sql.length&&wordPart(sql[at]));push('word',start);continue;}
  if(/[0-9]/.test(c)){do{at++;}while(at<sql.length&&/[0-9]/.test(sql[at]));if(wordStart(sql[at]))fail();push('number',start);continue;}
  if(c==='('){at++;push('symbol',start);depth++;continue;}
  if(c===')'){if(depth===0)fail();depth--;at++;push('symbol',start);continue;}
  if(',.=<>!+-*/%&|^~:;'.includes(c)){at++;push('symbol',start);continue;}
  fail();
 }
 if(depth!==0)fail();return out;
}

function parse(sql){
 const ts=tokens(sql),statements=[];let at=0,previousEnd=0;
 const skip=()=>{while(at<ts.length&&trivia(ts[at]))at++;};
 while(true){
  skip();if(at===ts.length)break;
  const begin=ts[at++];if(begin.kind!=='word'||begin.text.toUpperCase()!=='IF'||begin.depth!==0)fail();
  const clauses=[];let clauseStart=begin.end,throwToken=null,significant=0;
  while(at<ts.length){
   const t=ts[at],upper=t.kind==='word'?t.text.toUpperCase():null;
   if(upper==='THROW'&&t.depth===0){throwToken=t;break;}
   if(upper==='IF'||upper==='THROW'||upper!==null&&forbidden.has(upper)||t.text===';'||t.depth===0&&(upper==='SELECT'||upper==='FROM'))fail();
   if(upper==='OR'&&t.depth===0){if(!significant)fail();clauses.push(sql.slice(clauseStart,t.start));clauseStart=t.end;significant=0;}
   else if(!trivia(t))significant++;
   at++;
  }
  if(!throwToken||!significant)fail();clauses.push(sql.slice(clauseStart,throwToken.start));
  const throwTokens=[];
  while(at<ts.length){const t=ts[at++];if(trivia(t))continue;throwTokens.push(t);if(t.text===';'&&t.depth===0)break;}
  if(throwTokens.length!==7)fail();
  const [keyword,code,comma,message,comma2,state,end]=throwTokens;
  if(keyword.text.toUpperCase()!=='THROW'||code.kind!=='number'||code.text!=='51995'||comma.text!==','||message.kind!=='string'||!/^N?'DESKTOP_[A-Z0-9_]{1,100}'$/i.test(message.text)||comma2.text!==','||state.kind!=='number'||state.text!=='1'||end.text!==';'||throwTokens.some(t=>t.depth!==0))fail();
  statements.push({prefix:sql.slice(previousEnd,begin.start),keyword:begin.text,conditions:clauses,throwSql:sql.slice(throwToken.start,end.end),original:sql.slice(begin.start,end.end)});previousEnd=end.end;
 }
 if(!statements.length)fail();return {statements,tail:sql.slice(previousEnd)};
}

// Inspection exposes only static input slices for offline equivalence proofs.
export function inspectDesktopSqlGuardStatements(sql){return parse(sql).statements.map(s=>({conditions:s.conditions.map(c=>c.trim()),throwSql:s.throwSql}));}

export function splitDesktopRejectGuards(sql){
 const {statements,tail}=parse(sql);
 return statements.map(s=>s.prefix+(s.conditions.length===1?s.original:s.conditions.map(c=>`${s.keyword}${c}${s.throwSql}`).join('\n'))).join('')+tail;
}
