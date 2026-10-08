// Presentation only: source decimals and calculation inputs must remain unchanged.
export function moneyDisplay(value,{absolute=false}={}){
 if(typeof value!=='string'||! /^-?\d{1,34}(?:\.\d{1,18})?$/.test(value))return 'Bilinmiyor';
 const negative=value.startsWith('-'),[whole,fraction='']=value.replace(/^-/,'').split('.');
 let cents=BigInt(whole)*100n+BigInt(fraction.slice(0,2).padEnd(2,'0'));
 // Half away from zero, evaluated with decimal digits rather than Number.
 if(fraction.length>2&&fraction[2]>='5')cents+=1n;
 const nonzero=BigInt(whole+fraction)!==0n;
 return (negative&&nonzero&&!absolute?'−':'')+(cents/100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+(cents%100n).toString().padStart(2,'0');
}
