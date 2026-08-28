import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import { getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { getSalesDraft } from './invoiceDraftService.js';

const execFileAsync = promisify(execFile);
const receiptWidth = 42;
let printQueue = Promise.resolve();

function serviceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function text(value, fallback = '-') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value, currency = 'TRY') {
  return `${number(value).toFixed(2)} ${text(currency, 'TRY')}`;
}

function fitLine(value, width = receiptWidth) {
  const normalized = text(value, '');
  return normalized.length > width ? `${normalized.slice(0, Math.max(0, width - 3))}...` : normalized;
}

function pairLine(left, right, width = receiptWidth) {
  const safeLeft = text(left, '');
  const safeRight = text(right, '');
  const availableLeft = Math.max(1, width - safeRight.length - 1);
  const fittedLeft = fitLine(safeLeft, availableLeft);
  const spaces = Math.max(1, width - fittedLeft.length - safeRight.length);
  return `${fittedLeft}${' '.repeat(spaces)}${safeRight}`;
}

function dateLabel(value) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return text(value);
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(parsed);
}

export function buildTerminalReceiptText(invoice = {}) {
  const currency = invoice.documentCurrency || invoice.customerCurrency || 'TRY';
  const lines = [
    'MELISA BABY',
    'SATIS FISI',
    '='.repeat(receiptWidth),
    pairLine('Fis No', text(invoice.documentNo || invoice.id)),
    pairLine('Tarih', dateLabel(invoice.documentDate || invoice.updatedAt)),
    pairLine('Terminal', text(invoice.terminalCode || invoice.terminalName)),
    pairLine('Personel', text(invoice.employeeName || invoice.employeeCode)),
    '-'.repeat(receiptWidth),
    fitLine(`Cari: ${text(invoice.customerName)}`),
    fitLine(`Kod: ${text(invoice.customerCode)}`),
    '='.repeat(receiptWidth),
  ];

  for (const item of invoice.items || []) {
    const quantity = number(item.quantity);
    const unitPrice = number(item.unitPrice);
    const lineTotal = Number.isFinite(Number(item.lineTotal))
      ? number(item.lineTotal)
      : quantity * unitPrice;

    lines.push(fitLine(`${text(item.stockCode)} ${text(item.productName)}`));
    lines.push(pairLine(`${quantity} x ${unitPrice.toFixed(2)}`, money(lineTotal, item.currency || currency)));
  }

  lines.push(
    '='.repeat(receiptWidth),
    pairLine('ARA TOPLAM', money(invoice.subtotal, currency)),
    pairLine('INDIRIM', money(invoice.discountTotal, currency)),
    pairLine('GENEL TOPLAM', money(invoice.grandTotal, currency)),
    '='.repeat(receiptWidth),
    'Tesekkur ederiz.',
    '',
    '',
  );

  return lines.join(os.EOL);
}

async function executeWindowsPrint(receiptText, printerName) {
  if (process.platform !== 'win32') {
    throw serviceError('TERMINAL_RECEIPT_WINDOWS_REQUIRED', 'Receipt printing requires the ERP API to run on Windows', 503);
  }

  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), 'melisa-receipt-'));
  const receiptPath = path.join(workingDirectory, 'receipt.txt');
  const scriptPath = path.join(workingDirectory, 'print-receipt.ps1');
  const powershellPath = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );

  const script = [
    'param([string]$ReceiptPath, [string]$PrinterName)',
    "$ErrorActionPreference = 'Stop'",
    '$content = Get-Content -LiteralPath $ReceiptPath -Raw -Encoding UTF8',
    'if ([string]::IsNullOrWhiteSpace($PrinterName)) {',
    '  $content | Out-Printer',
    '} else {',
    '  $content | Out-Printer -Name $PrinterName',
    '}',
  ].join('\r\n');

  try {
    await writeFile(receiptPath, receiptText, 'utf8');
    await writeFile(scriptPath, script, 'utf8');
    await execFileAsync(powershellPath, [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-ReceiptPath',
      receiptPath,
      '-PrinterName',
      printerName || '',
    ], {
      windowsHide: true,
      timeout: env.receiptPrinting.timeoutMs,
      maxBuffer: 1024 * 1024,
    });
  } finally {
    await rm(workingDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

async function enqueuePrint(receiptText, printerName) {
  const task = printQueue.then(() => executeWindowsPrint(receiptText, printerName));
  printQueue = task.catch(() => {});
  return task;
}

async function writePrintAudit(action, invoice, actor, details = {}) {
  const pool = await getSqlPool();
  await writeAuditLog(pool.request(), {
    action,
    entityType: 'sales_invoice',
    entityId: invoice.id,
    actor,
    afterSnapshot: {
      invoiceId: Number(invoice.id),
      documentNumber: invoice.documentNo,
      terminalCode: invoice.terminalCode || null,
      printerName: env.receiptPrinting.printerName || 'Windows default printer',
      ...details,
    },
  });
}

export async function printTerminalSaleReceipt(invoiceId, actor = null) {
  if (!env.receiptPrinting.enabled) {
    throw serviceError('TERMINAL_RECEIPT_PRINT_DISABLED', 'ERP computer receipt printing is disabled', 503);
  }

  const invoice = await getSalesDraft(invoiceId);
  if (String(invoice.status || '').toUpperCase() !== 'FINALIZED') {
    throw serviceError('TERMINAL_RECEIPT_FINALIZED_REQUIRED', 'Only finalized sales receipts can be printed', 409);
  }

  const receiptText = buildTerminalReceiptText(invoice);
  const requestedAt = new Date().toISOString();
  await writePrintAudit('terminal_receipt_print_requested', invoice, actor, { requestedAt });

  if (env.receiptPrinting.mode === 'preview') {
    return {
      ok: true,
      preview: true,
      invoiceId: Number(invoice.id),
      documentNumber: invoice.documentNo,
      printerName: env.receiptPrinting.printerName || 'Windows default printer',
      receiptText,
    };
  }

  if (env.receiptPrinting.mode !== 'windows') {
    throw serviceError('TERMINAL_RECEIPT_PRINT_MODE_INVALID', 'ERP receipt print mode is not configured for Windows', 503);
  }

  try {
    await enqueuePrint(receiptText, env.receiptPrinting.printerName);
  } catch (error) {
    throw serviceError(
      'TERMINAL_RECEIPT_PRINT_FAILED',
      `Windows printer could not print the receipt: ${error.message || 'unknown error'}`,
      503,
    );
  }

  const printedAt = new Date().toISOString();
  await writePrintAudit('terminal_receipt_print_completed', invoice, actor, { requestedAt, printedAt }).catch(() => {});

  return {
    ok: true,
    preview: false,
    invoiceId: Number(invoice.id),
    documentNumber: invoice.documentNo,
    printerName: env.receiptPrinting.printerName || 'Windows default printer',
    printedAt,
  };
}
