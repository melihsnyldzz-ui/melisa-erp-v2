import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {screenRegistry} from '../../data/mockNavigationData.js';
const require=createRequire(import.meta.url),{transformSync}=require('esbuild');
function workspace(testReadOnly){
 const code=transformSync(readFileSync(new URL('../../components/workspace/Workspace.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',target:'es2022',define:{'import.meta.env.VITE_TEST_READ_ONLY':JSON.stringify(String(testReadOnly))}}).code;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,require:spec=>spec==='react'?{createElement:(type,props,...children)=>({type,props:{...props,children}})}:new Proxy({},{get:(_,key)=>key==='__esModule'?true:key})});return module.exports.Workspace;
}
test('actual Workspace binds receipt to TEST read screen for existing purchase view/create permissions and keeps normal mode unbound',()=>{
 assert.equal(screenRegistry['inventory-receipt-list'].label,'Gelen mal');const payload={receiptId:'9007199254740993'},activeTab={id:'inventory-receipt-list',payload};
 for(const permission of ['purchase.view','purchase.create']){const r=workspace(true)({activeTab,permissions:[permission]});assert.equal(r.type,'ReceiptReadScreen');assert.equal(r.props.initialReceiptId,payload.receiptId);}
 assert.equal(workspace(true)({activeTab,permissions:['product.view']}).type,'UnauthorizedScreen');assert.equal(workspace(false)({activeTab,permissions:['purchase.view']}).type.name,'UnmappedScreen');
});
test('actual Workspace preserves existing TEST invoice/party read routes and permission denial',()=>{
 const run=workspace(true);
 for(const [id,permission,type]of [['sales-invoice-list','sales.view','ReadOnlyInvoiceListScreen'],['purchase-invoice-list','purchase.view','ReadOnlyInvoiceListScreen'],['customer-list','customer.view','ReadOnlyPartyListScreen'],['supplier-list','supplier.view','ReadOnlyPartyListScreen']]){
  assert.equal(run({activeTab:{id},permissions:[permission]}).type,type);assert.equal(run({activeTab:{id},permissions:[]}).type,'UnauthorizedScreen');
 }
});

test('TEST finance viewer can reach closed cheque screen without acquiring command capability; normal mode is unchanged',()=>{
 const activeTab={id:'collections-overview',payload:{mode:'cheque',capability:{enabled:true}}};
 const result=workspace(true)({activeTab,permissions:['finance.view']});assert.equal(result.type,'ChequeCreateScreen');assert.equal(result.props.capability,undefined);
 assert.equal(workspace(true)({activeTab,permissions:['product.view']}).type,'UnauthorizedScreen');assert.equal(workspace(false)({activeTab,permissions:['finance.view']}).type,'UnauthorizedScreen');
});

test('supplier return read preparation is reachable only through TEST purchase view and does not accept payload capability',()=>{
 const activeTab={id:'purchase-invoice-list',payload:{mode:'supplier-return-read',capability:{enabled:true}}};
 const result=workspace(true)({activeTab,permissions:['purchase.view']});assert.equal(result.type,'SupplierReturnReadScreen');assert.equal(result.props.capability,undefined);
 assert.equal(workspace(true)({activeTab,permissions:['product.view']}).type,'UnauthorizedScreen');assert.equal(workspace(false)({activeTab,permissions:['purchase.view']}).type,'VegaPurchaseInvoiceListScreen');
});

test('TEST count workspace uses actual reader permissions and preserves the normal screen boundary',()=>{
 const activeTab={id:'stock-count',payload:{count:{kind:'stock_count',source:'/api/stock-counts',documentId:'99'},capability:{enabled:true}}};
 for(const permission of ['stock.adjust','terminal.stock_count.create']){
  const result=workspace(true)({activeTab,permissions:[permission]});assert.equal(result.type,'NativeStockCountScreen');assert.equal(result.props.initialCount,activeTab.payload.count);assert.equal(result.props.capability,undefined);
 }
 assert.equal(workspace(true)({activeTab,permissions:['product.view','product.edit']}).type,'UnauthorizedScreen');
 assert.equal(workspace(false)({activeTab,permissions:['product.view','product.edit']}).type,'StockCountScreen');
});

test('supplier payment navigation preserves selected identity and cannot inject a write capability',()=>{
 const permissions=['supplier.view','finance.payment'],run=workspace(true);
 const supplier=run({activeTab:{id:'supplier-list',payload:{supplierId:'8'}},permissions});
 assert.equal(supplier.props.permissions,permissions);assert.equal(supplier.props.initialPartyId,'8');
 const payment=run({activeTab:{id:'collections-overview',payload:{mode:'payment',supplierId:'8',source:'PROMPT-2-20260923-01',capability:{enabled:true}}},permissions});
 assert.equal(payment.type,'SupplierPaymentScreen');assert.equal(payment.props.supplierId,'8');assert.equal(payment.props.source,'PROMPT-2-20260923-01');assert.equal(payment.props.capability,undefined);
});

test('actual TEST AppShell opens distinct count/notice/cheque tabs and opens only the read-only cash wrapper',()=>{
 const slots=[];let cursor=0;
 const react={Component:class{},Activity:'Activity',createElement:(type,props,...children)=>({type,props:{...props,children}}),
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
  useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useMemo:fn=>fn(),useCallback:fn=>fn,useEffect(){},useLayoutEffect(){}};
 const module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('../../components/layout/AppShell.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',define:{'import.meta.env.VITE_TEST_READ_ONLY':'"true"'}}).code,
  {module,exports:module.exports,require:spec=>spec==='react'?react:spec.includes('mockNavigationData')?{screenRegistry,initialTabs:[screenRegistry.dashboard],getNavigationSection:()=>({})}:
   spec.includes('viewOptions')?{readStoredViewOptions:()=>({})}:spec.includes('roleViews')?{readStoredRoleView:()=> 'yonetici',getRoleScreenIds:()=>[]}:
   new Proxy({},{get:(_,key)=>key==='__esModule'?true:key})});
 function children(t,out=[]){if(Array.isArray(t))t.forEach(n=>children(n,out));else if(t&&typeof t==='object'){if(t.type==='Workspace')out.push(t);children(t.props?.children,out);}return out;}
 const render=()=>{cursor=0;return children(module.exports.AppShell({user:{},permissions:['dashboard.view','stock.adjust','finance.view']}));};
 let nodes=render();const open=nodes[0].props.onOpenScreen;
 for(const documentId of ['99','100'])open('stock-count',{count:{kind:'stock_count',source:'/api/stock-counts',documentId}});
 open('collections-overview',{mode:'cheque',cheque:{kind:'cheque',source:'/api/cheques',documentId:'77'}});
 open('collections-overview',{notice:{kind:'collection_notice',source:'/api/collection-notices',documentId:'77'}});
 open('cash-bank-ledger');open('auth-admin');nodes=render();assert.equal(nodes.length,6);
 assert.equal(nodes.find(n=>n.props.activeTab.id==='stock-count:99').props.activeTab.payload.count.documentId,'99');
 assert.ok(nodes.some(n=>n.props.activeTab.id==='stock-count:100'));assert.ok(nodes.some(n=>n.props.activeTab.id==='collections-overview:cheque:77'));
 assert.ok(nodes.some(n=>n.props.activeTab.id==='collections-overview:notice:77'));assert.ok(nodes.some(n=>n.props.activeTab.screenId==='cash-bank-ledger'));assert.ok(!nodes.some(n=>n.props.activeTab.screenId==='auth-admin'));
 const ledger=workspace(true)({activeTab:{id:'cash-bank-ledger'},permissions:['finance.view']});assert.equal(ledger.type,'CashBankLedgerScreen');assert.equal(ledger.props.readOnly,true);assert.equal(ledger.props.commandPanel.type,'FinanceTransferForm');
 assert.equal(workspace(false)({activeTab:{id:'cash-bank-ledger'},permissions:['finance.view']}).props.readOnly,false);
});

