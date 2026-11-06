// Selects only the TDS adapter for a verified desktop writer process. This
// grants no native sale capability and cannot be registered from a naked pool.
import {getDesktopWritePool} from './desktopWriteTlsConnector.mjs';
let current=null;
export function registerDesktopWriteRuntime(connector){
 if(current)throw Error('DESKTOP_WRITE_RUNTIME_ALREADY_REGISTERED');
 if(process.env.MELISA_EMPTY_LOCAL!=='20261105'||process.env.NODE_ENV!=='production'||process.env.SQL_TRUSTED_CONNECTION!=='false'||process.env.SQL_READ_ONLY!=='true'||process.env.SQL_ENABLED!=='false'||process.env.SQL_DATABASE||process.env.SQL_PASSWORD||Object.keys(process.env).some(k=>/^(VEGA_|CRM_|PILOT_|NATIVE_|OPENAI_|NODE_OPTIONS|NODE_PATH)/.test(k)))throw Error('DESKTOP_WRITE_ENV_REJECTED');
 const pool=getDesktopWritePool(connector);current=Object.freeze({connector,pool});return current;
}
export function getDesktopWriteRuntime(){return current;}
