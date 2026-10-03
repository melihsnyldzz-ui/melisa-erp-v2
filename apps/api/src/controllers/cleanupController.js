import {
  applyDemoCleanup,
  applyTestArchiveRestore,
  applyTestTreeCleanup,
  previewDemoCleanup,
  previewTestArchiveRestore,
  previewTestTreeCleanup,
} from '../services/cleanupService.js';
import { fail, ok } from '../utils/response.js';

function cleanupFail(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Cleanup request failed',
  );
}

export async function getDemoCleanupPreview(req, res) {
  try {
    const data = await previewDemoCleanup();
    return ok(res, data, { source: 'sql-demo-cleanup-preview' });
  } catch (error) {
    return cleanupFail(res, error, 'DEMO_CLEANUP_PREVIEW_FAILED');
  }
}

export async function postDemoCleanupApply(req, res) {
  try {
    const data = await applyDemoCleanup(req.body, req.user);
    return ok(res, data, { source: 'sql-demo-cleanup-apply', audit: 'demo_test_cleanup_applied' });
  } catch (error) {
    return cleanupFail(res, error, 'DEMO_CLEANUP_APPLY_FAILED');
  }
}

export async function getTestTreeCleanupPreview(req, res) {
  try {
    const data = await previewTestTreeCleanup();
    return ok(res, data, { source: 'sql-test-tree-cleanup-preview' });
  } catch (error) {
    return cleanupFail(res, error, 'TEST_TREE_CLEANUP_PREVIEW_FAILED');
  }
}

export async function postTestTreeCleanupApply(req, res) {
  try {
    const data = await applyTestTreeCleanup(req.body, req.user);
    return ok(res, data, { source: 'sql-test-tree-cleanup-apply', audit: 'test_transaction_tree_archived' });
  } catch (error) {
    return cleanupFail(res, error, 'TEST_TREE_CLEANUP_APPLY_FAILED');
  }
}

export async function getTestArchiveRestorePreview(req, res) {
  try {
    const data = await previewTestArchiveRestore();
    return ok(res, data, { source: 'sql-test-archive-restore-preview' });
  } catch (error) {
    return cleanupFail(res, error, 'TEST_ARCHIVE_RESTORE_PREVIEW_FAILED');
  }
}

export async function postTestArchiveRestoreApply(req, res) {
  try {
    const data = await applyTestArchiveRestore(req.body, req.user);
    return ok(res, data, { source: 'sql-test-archive-restore-apply', audit: 'test_transaction_tree_restored' });
  } catch (error) {
    return cleanupFail(res, error, 'TEST_ARCHIVE_RESTORE_APPLY_FAILED');
  }
}
