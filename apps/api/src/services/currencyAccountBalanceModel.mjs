// Native customer receivable / supplier payable sign convention. This is a
// presentation of an already proven account, not a fresh Vega balance claim.
export function currencyAccountBalanceFields({role,balanceExact,localDeltaExact,proven=false}){
 if(!['customer','supplier'].includes(role))throw new TypeError('Currency account role invalid');
 const unknown={debitCreditDirection:null,amountExact:null,localDeltaExact:null};
 if(proven!==true||balanceExact===null)return unknown;
 const valid=v=>typeof v==='string'&&/^-?(?:0|[1-9]\d{0,19})\.\d{1,8}$/.test(v);
 if(!valid(balanceExact)||!valid(localDeltaExact))throw new TypeError('Currency account exact amount invalid');
 const amountExact=balanceExact.replace(/^-/,'');
 const zero=BigInt(amountExact.replace('.',''))===0n;
 const positive=role==='customer'?'B':'A',negative=role==='customer'?'A':'B';
 return {debitCreditDirection:zero?'ZERO':balanceExact.startsWith('-')?negative:positive,amountExact,localDeltaExact};
}
