import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./liveData.js',import.meta.url),'utf8');
// Evaluate the actual pure projection without browser bootstrap/CSS imports.
const start=source.indexOf('export function nativeApprovalSummary('),end=source.indexOf('\nfunction createNativeApprovals(',start);
const project=Function(source.slice(start,end).replace('export ','')+';return nativeApprovalSummary;')();
const data=()=>({sections:{approvals:{status:'available',pendingCount:7,complete:false,sourceCoverage:['goods','count','sales-return','purchase-return']}},capabilities:{approval:true,goods:true,count:true,returns:true},navigationReady:{goods:true,count:true,returns:true}});
test('native pending count keeps permission/readiness-filtered source navigation and partial coverage',()=>{const d=data();d.navigationReady.count=false;d.capabilities.returns=false;assert.deepEqual(project(d),{pendingCount:7,status:'available',links:[{screen:'goods',label:'Mal kabulü'}]});d.sections.approvals.pendingCount=0;assert.equal(project(d).pendingCount,0);});
test('missing, unknown and forbidden data cannot become an empty approved queue',()=>{assert.throws(()=>project({}));const d=data();d.sections.approvals.pendingCount=null;assert.throws(()=>project(d));d.sections.approvals.status='forbidden';d.capabilities.approval=false;assert.equal(project(d).pendingCount,null);d.sections.approvals.pendingCount=0;assert.throws(()=>project(d));});
test('goods-only source coverage is valid while unknown, duplicate, missing or complete queues are rejected',()=>{
 const d=data();d.sections.approvals.sourceCoverage=['goods'];d.capabilities.count=false;d.capabilities.returns=false;
 assert.deepEqual(project(d),{pendingCount:7,status:'available',links:[{screen:'goods',label:'Mal kabulü'}]});
 for(const coverage of [undefined,null,[],['unknown'],['goods','goods'],['goods','count','sales-return','purchase-return','goods'],'goods',[{}],Array(1),[, 'goods']]){const invalid=data();invalid.sections.approvals.sourceCoverage=coverage;assert.throws(()=>project(invalid));}
 for(const patch of [{complete:true},{complete:null},{pendingCount:-1},{pendingCount:1.5},{pendingCount:Number.MAX_SAFE_INTEGER+1}]){const invalid=data();Object.assign(invalid.sections.approvals,patch);assert.throws(()=>project(invalid));}
});
test('actual business three-source subset remains partial and does not invent sales return coverage',()=>{
 const d=data();d.sections.approvals.sourceCoverage=['goods','count','purchase-return'];const before=JSON.stringify(d);
 assert.deepEqual(project(d),{pendingCount:7,status:'available',links:[{screen:'goods',label:'Mal kabulü'},{screen:'count',label:'Sayım'},{screen:'returns',label:'İadeler'}]});assert.equal(JSON.stringify(d),before);assert.equal(d.sections.approvals.complete,false);assert.ok(!d.sections.approvals.sourceCoverage.includes('sales-return'));
 d.navigationReady.count=false;d.navigationReady.returns=false;assert.deepEqual(project(d).links,[{screen:'goods',label:'Mal kabulü'}]);d.capabilities.goods=false;assert.deepEqual(project(d).links,[]);
 d.capabilities.approval=false;assert.throws(()=>project(d));
});
test('personnel forbidden and unavailable queues keep null and never grant approval actions',()=>{
 for(const status of ['forbidden','unavailable']){const d=data();d.sections.approvals={status,pendingCount:null};d.capabilities={approval:false,goods:true,count:false,returns:false};d.navigationReady={goods:true,count:false,returns:false};
 assert.deepEqual(project(d),{pendingCount:null,status,links:[{screen:'goods',label:'Mal kabulü'}]});d.navigationReady.goods=false;assert.deepEqual(project(d).links,[]);d.sections.approvals.pendingCount=0;assert.throws(()=>project(d));}
});
test('normal approvals use authenticated native home reads and cannot render local demo actions',()=>{const demo=readFileSync(new URL('./demoOperations.js',import.meta.url),'utf8');assert.match(source,/if\(page==='home'\|\|page==='approvals'\)/);assert.match(source,/nativeApprovalSummary\(validateWorkHome\(await session\.home\(\)\)\)/);assert.match(demo,/\['stock','home','approvals'.*includes\(bridge\.screen\(\)\)/);assert.doesNotMatch(demo,/window\.approvalsPage=approvalPage/);const ui=source.slice(end,source.indexOf('\nfunction mount()',end));assert.doesNotMatch(ui,/session\.(post|approve|decide)/);assert.match(ui,/İndirim kararları ve birleşik karar geçmişi bu özete dahil değildir/);});
