export interface Header {
  proformaNo: string;
  sourceDocumentNo: string;
  issueDate: string;
  validUntil: string;
  currency: string;
}
export interface Buyer {
  name: string;
  customerCode: string;
  address: string;
  cityCountry: string;
  contactName: string;
  phone: string;
  email: string;
  taxNumber: string;
}
export interface ShipmentText {
  incoterm: string;
  paymentTerms: string;
  transportMode: string;
  deliveryPlace: string;
  packageCount: string;
  netWeight: string;
  grossWeight: string;
  originCountry: string;
  notes: string;
}
export interface LineText {
  id: string;
  stockCode: string;
  description: string;
  barcode: string;
  gtipCode: string;
  gtipStatus: string;
  gtipConfidence: string;
  gtipMaterialBasis: string;
  gtipNote: string;
  gtipSource: string;
  gtipRuleId: string;
  unitName: string;
}
export interface Line extends LineText {
  included: boolean;
  gtipRequiresReview: boolean;
  quantity: number;
  unitPrice: number;
}
// Persisted drafts are untrusted. The sanitizer validates each field at runtime.
export interface DraftInput {
  header?: Record<string, unknown>;
  buyer?: Record<string, unknown>;
  shipment?: Record<string, unknown>;
  lines?: unknown;
}
export interface DraftIdentityInput extends DraftInput {
  sourceFingerprint?: unknown;
  draftOwnerId?: unknown;
}
export interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
  lineId?: unknown;
  count?: number;
}
export interface PrintPayload {
  header?: Partial<Header>;
  buyer?: Partial<Buyer>;
  shipment?: Partial<ShipmentText> & { freightAmount?: number | string };
  lines?: Array<Partial<LineText> & {
    included?: boolean;
    productName?: string;
    quantity?: number | string;
    unitPrice?: number | string;
  }>;
  seller?: Partial<Record<'name' | 'address' | 'cityCountry' | 'phone' | 'fax' | 'taxOffice' | 'taxNumber' | 'mersis' | 'tradeRegistry', string>>;
  bank?: Partial<Record<'name' | 'tryIban' | 'usdIban' | 'eurIban' | 'iban' | 'swift', string>>;
  logoUrl?: string;
  generatedAt?: Date;
}
