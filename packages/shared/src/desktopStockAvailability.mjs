// Exact base-unit stock projection. No rounding, clamping or unknown-to-zero.
const quantity=(v,signed)=>{
 if(typeof v!=='string'||!(signed?/^-?(?:0|[1-9]\d{0,14})\.\d{3}$/:/^(?:0|[1-9]\d{0,14})\.\d{3}$/).test(v)||v==='-0.000')throw Error('DESKTOP_STOCK_AMOUNTS_INVALID');
 return BigInt(v.replace('.',''));
};
export function desktopAvailableStock(currentStockExact3,reservedExact3){
 const value=quantity(currentStockExact3,true)-quantity(reservedExact3,false),absolute=value<0n?-value:value;
 return (value<0n?'-':'')+(absolute/1000n)+'.'+String(absolute%1000n).padStart(3,'0');
}
export function isDesktopStockAvailability(row){
 try{return desktopAvailableStock(row.currentStockExact3,row.reservedExact3)===row.availableExact3;}catch{return false;}
}
