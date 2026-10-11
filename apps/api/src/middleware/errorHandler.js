import { env } from '../config/env.js';
import { logger, requestLogPath } from '../utils/logger.js';
import {normalizeOperationQuarantineError} from '../services/operationQuarantineError.mjs';
import {isIsolatedOperationCopyRuntime,getIsolatedOperationCopyConfig} from '../config/isolatedOperationCopyRuntime.mjs';

export function isolatedSqlNumericDiagnostics(error){
  if(error?.code!=='EREQUEST'||!isIsolatedOperationCopyRuntime())return {};
  const copy=getIsolatedOperationCopyConfig();
  if(copy.copyId!=='e16b70f0-4057-428b-9abc-6bbcaf35fe82'||copy.target.database!=='MELISA_ERP_CRM_SHARED_TEST_20261009_02'||copy.target.server!=='Semih\\MELISADEV')return {};
  const info=error.originalError?.info,flat=error.originalError;
  const fields=[['sqlNumber',error.number??info?.number??flat?.code,1,2147483647],['sqlState',error.state??info?.state??flat?.sqlstate,0,255],['sqlClass',error.class??info?.class??flat?.severity,0,25],['sqlLineNumber',error.lineNumber??info?.lineNumber??flat?.lineNumber,0,1000000]];
  return Object.fromEntries(fields.filter(([,value,min,max])=>Number.isSafeInteger(value)&&value>=min&&value<=max).map(([key,value])=>[key,value]));
}

export function errorHandler(err, req, res, next) {
  err=normalizeOperationQuarantineError(err);
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const retryAfterSeconds = code === 'CRM_V2_CRM_RATE_LIMITED' && statusCode === 429 && Number.isInteger(err.retryAfterSeconds) && err.retryAfterSeconds > 0 && err.retryAfterSeconds <= 900 ? err.retryAfterSeconds : undefined;
  if (retryAfterSeconds !== undefined) res.setHeader('Retry-After', String(retryAfterSeconds));
  const message = statusCode === 500 && env.nodeEnv === 'production'
    ? 'Unexpected server error'
    : err.message || 'Unexpected server error';

  logger.error('API error normalized', {
    requestId: req.requestId,
    method: req.method,
    path: requestLogPath(req),
    statusCode,
    code,
    category: err.category || 'api_error',
    ...isolatedSqlNumericDiagnostics(err),
  });

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
    meta: {
      requestId: req.requestId,
      ...(retryAfterSeconds === undefined ? {} : {retryAfterSeconds}),
    },
  });
}
