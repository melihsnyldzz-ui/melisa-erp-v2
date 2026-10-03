// Existing ERP services attach optional transport metadata to Error objects.
// Ordinary Error instances are still valid and none of these fields is assumed
// present. Payload details must be narrowed by consumers before use.
interface Error {
  code?: string;
  originalCode?: string;
  transactionOutcome?: 'unverified';
  statusCode?: number;
  status?: number;
  details?: unknown;
  meta?: Record<string, unknown>;
}
