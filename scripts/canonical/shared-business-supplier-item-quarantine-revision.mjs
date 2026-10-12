// Pure source preparation only. No SQL connection, DDL execution or file writes.
import {createHash} from 'node:crypto';
export const SUPPLIER_ITEM_QUARANTINE_BASE=Object.freeze({name:'dbo.supplier_identity_quarantine_v2_sales_invoice_items',definitionSha256:'601c9efd1dab9541636fad6245f5a0e3bdfd8a672713e5e1d4aeaf4f53555d26',sourceUtf8Sha256:'cd3c373b17856355bb603c35de713b7a5ab63394ea7ceada577029fd47cebe73',statementSha256:'80537fd83b47785ea146e870f5c95a6aac1bdd71b218adbdb63d20bf66ac9981',statementStart:4639,statementEnd:16185,definitionLength:16237});
const sha=(v,encoding='utf16le')=>createHash('sha256').update(v,encoding).digest('hex');
const check=(v,code)=>{if(!v)throw Object.assign(new Error(code),{code});};
// Mask literals/comments while retaining offsets; quoted SQL OR/parentheses are data.
function sqlMask(sql){let result='',i=0;while(i<sql.length){if(sql[i]==="'"){result+=' ';i++;let closed=false;while(i<sql.length){if(sql[i]==="'"){result+=' ';i++;if(sql[i]==="'"){result+=' ';i++;continue;}closed=true;break;}result+=' ';i++;}check(closed,'SUPPLIER_ITEM_SQL_LITERAL');}else if(sql.slice(i,i+2)==='--'){while(i<sql.length&&sql[i]!=='\n'){result+=' ';i++;}}else if(sql.slice(i,i+2)==='/*'){let depth=1;result+='  ';i+=2;while(i<sql.length&&depth){if(sql.slice(i,i+2)==='/*'){depth++;result+='  ';i+=2;}else if(sql.slice(i,i+2)==='*/'){depth--;result+='  ';i+=2;}else{result+=' ';i++;}}check(depth===0,'SUPPLIER_ITEM_SQL_COMMENT');}else{result+=sql[i++];}}return result;}
export function splitSupplierItemHoldPredicate(statement){
 check(typeof statement==='string','SUPPLIER_ITEM_SQL_INPUT');
 const prefix=/^IF EXISTS\(SELECT 1 FROM\(SELECT \* FROM inserted UNION ALL SELECT \* FROM deleted\)x WHERE/.exec(statement)?.[0];
 check(prefix&&statement.endsWith(')'),'SUPPLIER_ITEM_SQL_SHAPE');
 const condition=statement.slice(prefix.length,-1),mask=sqlMask(condition);let depth=0,split=-1;
 for(let i=0;i<mask.length;i++){if(mask[i]==='(')depth++;else if(mask[i]===')'){depth--;check(depth>=0,'SUPPLIER_ITEM_SQL_BALANCE');}else if(depth===0&&mask.slice(i,i+2).toUpperCase()==='OR'&&!/[A-Za-z0-9_]/.test(mask[i-1]??'')&&!/[A-Za-z0-9_]/.test(mask[i+2]??'')){check(split===-1,'SUPPLIER_ITEM_SQL_OUTER_OR');split=i;i++;}}
 check(depth===0&&split>=0,'SUPPLIER_ITEM_SQL_OUTER_OR');
 const productPredicate=condition.slice(0,split),invoicePredicate=condition.slice(split+2);
 const refs=value=>[...sqlMask(value).matchAll(/\bx\.([A-Za-z_][A-Za-z0-9_]*)\b/g)].map(m=>m[1]);
 check(JSON.stringify(refs(productPredicate))==='["product_id"]'&&JSON.stringify(refs(invoicePredicate))==='["sales_invoice_id"]','SUPPLIER_ITEM_SQL_OUTER_DEPENDENCY');
 check(/^\s*EXISTS\s*\(/i.test(sqlMask(productPredicate))&&/^\s*EXISTS\s*\(/i.test(sqlMask(invoicePredicate)),'SUPPLIER_ITEM_SQL_BRANCH');
 return {productPredicate,invoicePredicate};
}
export function deduplicateSupplierItemHoldStatement(statement){
 const {productPredicate,invoicePredicate}=splitSupplierItemHoldPredicate(statement);
 return `IF EXISTS(SELECT 1 FROM(SELECT DISTINCT product_id FROM(SELECT product_id FROM inserted UNION ALL SELECT product_id FROM deleted)affected)x WHERE${productPredicate}) OR EXISTS(SELECT 1 FROM(SELECT DISTINCT sales_invoice_id FROM(SELECT sales_invoice_id FROM inserted UNION ALL SELECT sales_invoice_id FROM deleted)affected)x WHERE${invoicePredicate})`;
}
export function prepareSupplierItemQuarantineRevision(definition){
 const base=SUPPLIER_ITEM_QUARANTINE_BASE;
 check(typeof definition==='string'&&definition.length===base.definitionLength&&sha(definition)===base.definitionSha256&&sha(definition,'utf8')===base.sourceUtf8Sha256,'SUPPLIER_ITEM_BASE_PIN');
 const prefix=definition.slice(0,base.statementStart),statement=definition.slice(base.statementStart,base.statementEnd),suffix=definition.slice(base.statementEnd);
 check(sha(statement)===base.statementSha256,'SUPPLIER_ITEM_STATEMENT_PIN');
 const branches=splitSupplierItemHoldPredicate(statement),replacement=deduplicateSupplierItemHoldStatement(statement),after=prefix+replacement+suffix;
 check(after.startsWith(prefix)&&after.endsWith(suffix)&&replacement.includes(branches.productPredicate)&&replacement.includes(branches.invoicePredicate),'SUPPLIER_ITEM_BODY_PRESERVATION');
 return Object.freeze({schemaVersion:'melisa-supplier-item-quarantine-revision-preparation.v1',name:base.name,beforeHash:base.definitionSha256,afterHash:sha(after),beforeStatementHash:base.statementSha256,afterStatementHash:sha(replacement),definition:after,proof:Object.freeze({prefixHash:sha(prefix),suffixHash:sha(suffix),productPredicateHash:sha(branches.productPredicate),invoicePredicateHash:sha(branches.invoicePredicate),quarantinePredicatesPreserved:true,requiresForwardRegistry:true,businessWrites:0})});
}
