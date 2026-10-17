import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {workTaskHandoff} from './workTaskHandoff.mjs';
import {terminalCrmViewportHeight} from './personnelTerminalModel.mjs';
const postcss=createRequire(new URL('../../package.json',import.meta.url))('postcss');
const css=await readFile(new URL('./personnelTerminal.css',import.meta.url),'utf8');
const marker='/* Four-task handheld presentation only. Transaction controls and warnings stay visible. */';
const rules=postcss.parse(css.slice(css.indexOf(marker)));
test('CRM viewport uses the real handheld space and keyboard resize without subtracting the native header',()=>{
 assert.equal(terminalCrmViewportHeight({visualHeight:504,innerHeight:504,headerHeight:42}),462);
 assert.equal(terminalCrmViewportHeight({visualHeight:244,innerHeight:504,headerHeight:42}),202);
 assert.equal(terminalCrmViewportHeight({visualHeight:504,innerHeight:504,headerHeight:68}),436);
 assert.equal(terminalCrmViewportHeight({visualHeight:504,innerHeight:504,headerHeight:0}),504);
});
test('CRM viewport rejects zero/unknown viewport readings and never produces a zero iframe',()=>{
 for(const visualHeight of [0,NaN,Infinity,-1,'504',undefined])assert.equal(terminalCrmViewportHeight({visualHeight,innerHeight:504,headerHeight:42}),462);
 assert.equal(terminalCrmViewportHeight({visualHeight:0,innerHeight:0,headerHeight:42}),438);
 assert.equal(terminalCrmViewportHeight({visualHeight:20,headerHeight:42}),1);
 assert.equal(terminalCrmViewportHeight({visualHeight:504,headerHeight:NaN}),504);
 assert.equal(terminalCrmViewportHeight({visualHeight:504,headerHeight:-42}),504);
 const crmRule=postcss.parse(css).nodes.find(r=>r.selector==='#terminal-crm');
 assert.ok(crmRule);const heights=crmRule.nodes.filter(d=>d.prop==='height').map(d=>d.value);
 assert.deepEqual(heights,['calc(100vh - 68px)','var(--terminal-crm-height,calc(100vh - 68px))']);
 assert.equal(crmRule.nodes.find(d=>d.prop==='min-height').value,'160px');
});
test('handheld simplification is confined to the four-task body and small screen',()=>{
 assert.ok(css.includes(marker));let count=0;rules.walkRules(rule=>{count++;assert.equal(rule.parent.type,'atrule');assert.equal(rule.parent.name,'media');assert.equal(rule.parent.params,'(max-width:650px)');for(const selector of rule.selectors)assert.ok(selector.startsWith('.work-task-terminal '),selector);});assert.ok(count>=30);
});
test('only duplicate heading/help descriptions are hidden; role titles/link and transaction messages are retained',()=>{
 const hidden=[];rules.walkDecls(decl=>{if(decl.prop==='display'&&decl.value==='none')hidden.push(decl.parent.selector);assert.ok(!['visibility','opacity','content'].includes(decl.prop));});
 assert.deepEqual(hidden,['.work-task-terminal .work-inbound > .heading .eyebrow','.work-task-terminal .work-trade > .heading .eyebrow','.work-task-terminal .work-inbound > .heading .sub','.work-task-terminal .work-trade > .heading .sub','.work-task-terminal .work-task-handoff li > span']);
 for(const lesson of ['receiving','sale']){const html=workTaskHandoff(lesson);assert.equal((html.match(/<li><b>/g)??[]).length,3);assert.match(html,/href="\/kullanim-egitimi.html#/);}
 assert.doesNotMatch(hidden.join(' '),/status|warning|alert|capabilit|data-count|data-sale/);
});
test('barcode search follows customer choice before product rows, while primary controls keep 52px hit targets',()=>{
 const declarations=(selector)=>{let values;rules.walkRules(rule=>{if(rule.selector===selector)values=Object.fromEntries(rule.nodes.map(n=>[n.prop,n.value]));});assert.ok(values,selector);return values;};
 const fields=declarations('.work-task-terminal .work-trade .trade-panel > .trade-fields');
 const scan=declarations('.work-task-terminal .work-trade .trade-panel > form[data-sale-search]');
 const products=declarations('.work-task-terminal .work-trade .trade-panel > .trade-product');
 assert.ok(Number(fields.order)<Number(scan.order));assert.ok(Number(scan.order)<Number(products.order));
 for(const task of ['work-inbound','work-trade'])assert.equal(declarations(`.work-task-terminal .${task} .btn.primary`)['min-height'],'52px');
 assert.equal(declarations('.work-task-terminal .work-trade .trade-panel > .trade-catalog-list')['max-height'],'180px');
});
test('360px count header reserves a full title row and two bounded wrapping buttons',()=>{
 const values=selector=>{let result;rules.walkRules(r=>{if(r.selector===selector)result=Object.fromEntries(r.nodes.map(n=>[n.prop,n.value]));});assert.ok(result,selector);return result;};
 assert.equal(values('.work-task-terminal .heading')['flex-wrap'],'wrap');
 assert.equal(values('.work-task-terminal .heading > div:first-child').flex,'1 1 100%');
 const actions=values('.work-task-terminal .work-inbound > .heading .inbound-actions');assert.equal(actions.display,'grid');assert.equal(actions.width,'100%');assert.equal(actions['grid-template-columns'],'repeat(2,minmax(0,1fr))');
 const buttons=values('.work-task-terminal .work-inbound > .heading .inbound-actions > .btn');assert.equal(buttons['min-width'],'0');assert.equal(buttons['white-space'],'normal');assert.equal(buttons.width,'100%');
 const viewport=360,viewPadding=8,gap=Number.parseInt(actions.gap),available=viewport-2*viewPadding,column=(available-gap)/2;assert.equal(2*column+gap,available);assert.ok(column>140&&column<viewport);
});
test('handheld sales keeps title and refresh on one row, small panel headings and 44px help/logout targets',()=>{
 const values=selector=>{let result;rules.walkRules(r=>{if(r.selector===selector)result=Object.fromEntries(r.nodes.map(n=>[n.prop,n.value]));});assert.ok(result,selector);return result;};
 assert.equal(values('.work-task-terminal .work-trade > .heading')['flex-wrap'],'nowrap');
 assert.equal(values('.work-task-terminal .work-trade > .heading > div:first-child').flex,'1 1 0');
 assert.equal(values('.work-task-terminal .work-trade .trade-panel > h2').margin,'0 0 8px');
 for(const selector of ['.work-task-terminal #terminal-logout','.work-task-terminal .terminal-task-help > summary','.work-task-terminal .work-task-heading a'])assert.ok(Number.parseInt(values(selector)['min-height'])>=44);
});
