// Legacy scalar is a display projection, never a substitute for a currency
// account. Preserve absent/invalid values as unknown; a verified zero stays 0.
export function nativePartyBalance(value) {
 if(value==null||typeof value!=='number'&&typeof value!=='string')return null;
 if(typeof value==='string'&&!/^[+-]?\d+(?:\.\d+)?$/.test(value))return null;
 const amount=Number(value);return Number.isFinite(amount)?amount:null;
}
