import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inputDir, readSource, hash, requireRule } from './vega-native-migration-runtime.mjs';
import { historyTable, linkHeader } from './vega-migration-spec-history.mjs';
import { currency, salesperson, group } from '../src/services/vegaMigrationSpecification.mjs';
export { currency, salesperson, group, historyTable, linkHeader };
export const clean=v=>v==null?null:String(v).trim().replace(/\s+/g,' ')||null;
export const key=(table,id)=>{const d=historyTable(table);return d?`VEGA2026/${d.company}/${d.period}/${table}/${id}`:`VEGA2026/${table}/${id}`;};
export const fact=(table,row)=>({source_record_key:key(table,row.IND),source_payload_hash:hash(row),source_payload_json:JSON.stringify(row),original_document_date:row.TARIH||null});
export const unit=100000000n;
export function decimal(v){requireRule(v!=null&&/^-?\d+(\.\d{1,8})?$/.test(String(v)),'SOURCE_DECIMAL_REQUIRED');let s=String(v),sign=s.startsWith('-')?-1n:1n;if(sign<0)s=s.slice(1);const[a,b='']=s.split('.');return sign*(BigInt(a)*unit+BigInt(b.padEnd(8,'0')));}
export const textDecimal=v=>`${v<0n?'-':''}${(v<0n?-v:v)/unit}.${String((v<0n?-v:v)%unit).padStart(8,'0')}`;
export const subtract=(a,b)=>textDecimal(decimal(a)-decimal(b));
export const absolute=v=>textDecimal(decimal(v)<0n?-decimal(v):decimal(v));
export function divide(a,b){const x=decimal(a)*unit,y=decimal(b);requireRule(y>0n,'POSITIVE_SOURCE_RATE_REQUIRED');const sign=x<0n?-1n:1n,z=x<0n?-x:x;return textDecimal(sign*((z+y/2n)/y));}
export const add=values=>textDecimal(values.reduce((n,v)=>n+decimal(v??'0'),0n));
export function* readHistory(table){const p=path.join(inputDir,'history',`${table}.jsonl`);const bytes=fs.readFileSync(p);const entry=manifest.tables.find(t=>t.table===table);requireRule(entry&&entry.twoPassStable&&createHash('sha256').update(bytes).digest('hex')===entry.hash,'FROZEN_SOURCE_HASH_MISMATCH');for(const l of bytes.toString('utf8').split('\n'))if(l)yield JSON.parse(l);}
export const manifest=readSource('history/manifest.json');
export const inWindow=date=>date?.slice(0,10)>=manifest.window.startDate&&date.slice(0,10)<manifest.window.endExclusive;
export const isCarry=h=>[90,103,104].includes(Number(h.row.BELGETIPI));
export const initialCarry=h=>isCarry(h)&&h.period==='D0001';
export const docDate=h=>h.row.TARIH?.slice(0,10)<manifest.window.startDate&&initialCarry(h)?manifest.window.startDate:h.row.TARIH?.slice(0,10);
export function headers(){const all=[];for(const t of manifest.tables.filter(t=>t.kind==='document'))for(const row of readHistory(t.table))all.push({...historyTable(t.table),table:t.table,key:key(t.table,row.IND),row});return{all,byType:group(all,h=>`${h.company}/${h.period}/${h.row.BELGETIPI}/${h.row.IND}`),byFamily:group(all,h=>`${h.company}/${h.period}/${h.family}/${h.row.IND}`)};}
export function decideHeader(h){if(h.row.IPTAL===true)return'EXCLUDED_CANCELLED';if(h.row.IPTAL!==false)return'CANCELLATION_UNKNOWN';if(!inWindow(h.row.TARIH)&&!(initialCarry(h)&&h.row.TARIH?.startsWith('2019-12-31')))return'OUTSIDE_PERIOD';if(h.company==='F0104')return'F0104_ROLE_AND_DUPLICATE_REVIEW';return null;}
export function link(table,row,hs){return linkHeader(table,row,hs.byType,hs.byFamily);}
export function notes(row){return Object.entries(row).filter(([k,v])=>/ACIKLAMA|NOTLAR|ISTIHBARAT/.test(k)&&clean(v)).map(([k,v])=>`${k}: ${v}`).join('\n')||null;}
export function sourceMoney(row){const c=currency(row.PARABIRIMI),r=row.KUR;if(!c||r==null||decimal(r)<=0n)return null;return{currency:c,rate:r};}
export function ledgerEffect(row,role){const m=sourceMoney(row);requireRule(m,'LEDGER_CURRENCY_OR_RATE_UNKNOWN');const value=subtract(row.BORC,row.ALACAK);return{...m,effect:divide(role==='supplier'?textDecimal(-decimal(value)):value,m.rate)};}
export function identityToken(row,company){const code=clean(row.FIRMAKODU)||String(row.IND);if(/^[123]-PEŞİN/.test(code))return`${company}/cash/${row.IND}`;const name=clean(row.FIRMAADI||code)?.toLocaleUpperCase('tr-TR').replace(/(?:\s|[-_])+\(?\b(?:USD|EUR|EURO|DOLAR|TL|TRY)\)?$|\s*[$€]$/g,'').trim();const tax=String(row.VERGINO||'').replace(/\D/g,'');const phone=String(row.TELEFON1||row.TELEFON2||'').replace(/\D/g,'');const address=clean(row.ADRESFATURA||row.ADRESPOSTA);if(tax.length>=10&&!/^0+$/.test(tax))return`${company}/tax/${tax}/${name}`;if(phone.length>=10&&address)return`${company}/contact/${name}/${phone}/${address.toLocaleUpperCase('tr-TR')}`;return`${company}/card/${row.IND}`;}
export function normalizedLine(table,row,h,product){const m=sourceMoney(row);return{...fact(table,row),source_document_key:h.key,source_product_id:String(row.STOKNO??''),source_stock_code:row.STOKKODU??null,source_product_name:row.MALINCINSI??null,quantity_exact:row.MIKTAR??null,unit_price_source:h.family.startsWith('AL')?row.AFIYATI??null:row.FIYATI??row.AFIYATI??null,line_total_source:row.GERCEKTOPLAM??row.TUTAR??null,currency_code:m?.currency??null,exchange_rate:m?.rate??null,discount_rates_json:JSON.stringify([1,2,3,4,5,6].map(i=>row['ISK'+i]??null)),description:notes(row),unit_name:row.BIRIM??null,unit_multiplier:row.BIRIMMIKTAR??null,brand_snapshot:product?.brand??null,category_snapshot:product?.category??null,product_id:product?.id??null,product_link_status:product?'RESOLVED':'SOURCE_SNAPSHOT_LINK_REVIEW'};}
