import React from 'react';
import { ArrowDownLeft, ArrowLeftRight, BarChart3, Boxes, Building2, ClipboardCheck, FileText, PackageCheck, ReceiptText, ScanBarcode, Users, Wallet } from 'lucide-react';
import './workspace-ui.css';

const icons = {
  'stock-list': Boxes, 'product-card': Boxes, 'stock-movements': Boxes, 'stock-valuation': Boxes,
  'customer-list': Users, 'customer-card': Users, 'customer-movements': Users, 'customer-statement': Users,
  'supplier-list': Building2, 'supplier-card': Building2, 'supplier-movements': Building2, 'supplier-statement': Building2,
  'inventory-receipt-list': PackageCheck, receipt: PackageCheck,
  'purchase-invoice-list': FileText, 'purchase-invoice': FileText, purchase: FileText,
  'sales-invoice-list': ReceiptText, 'sales-invoice': ReceiptText, 'sales-offers': ReceiptText, 'sales-orders': ReceiptText, sale: ReceiptText,
  'cash-register': Wallet, 'cash-bank-ledger': Wallet, 'finance-overview': Wallet,
  'collections-overview': ArrowDownLeft, 'cash-customers': ArrowDownLeft,
  'stock-count': ClipboardCheck, count: ClipboardCheck, 'terminal-overview': ScanBarcode,
  'reports-overview': BarChart3, 'accounting-journal': ArrowLeftRight, 'price-list': FileText,
};

export function WorkspaceHeading({ screen, title, description, count, actions }) {
  const Icon = icons[screen] || FileText;
  return <header className="erp-panel op-heading ui-page-heading"><div className="ui-page-title"><span className="ui-page-icon"><Icon size={22} strokeWidth={1.65} aria-hidden="true"/></span><div><h1>{title}</h1>{description && <p>{description}</p>}</div></div><div className="ui-heading-actions">{count != null && <span className="ui-record-count">{count}</span>}{actions}</div></header>;
}

export function CurrencyMark({ code }) {
  return <span className={`ui-currency ui-currency-${code.toLowerCase()}`}><span aria-hidden="true">{{ USD: '$', EUR: '€', TRY: '₺' }[code] || code}</span>{code}</span>;
}
