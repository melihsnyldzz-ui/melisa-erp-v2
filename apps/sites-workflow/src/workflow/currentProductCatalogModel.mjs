// A dated TEST publication is distinct from the final frozen cutover contract.
import {validProductCatalogContext} from '../../../../apps/api/src/services/currentProductCatalogContext.mjs';
export function currentProductCatalogVersion(v){
 return validProductCatalogContext(v);
}
export const currentProductLineage=(r,v)=>currentProductCatalogVersion(v)&&r?.provenance?.kind==='accepted-opening'&&v.ancestry.some(a=>a.runId===r.provenance.runId&&a.sourceAsOf===r.provenance.sourceAsOf)&&/^(?:VEGA_CAPTURE_20260930_01|VEGA2026)\/F0102\/TBLSTOKLAR\/[1-9]\d*$/.test(r.provenance.sourceKey);
