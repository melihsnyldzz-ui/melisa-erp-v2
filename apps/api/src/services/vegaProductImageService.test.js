import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { cleanupUploadedFileAfterFailure } from './vegaProductImageService.js';

test('a locally written upload is removed after its SQL transaction fails', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'melisa-erp-image-rollback-'));
  const diskPath = path.join(directory, 'orphan.jpg');
  try {
    await writeFile(diskPath, Buffer.from('test-image'));
    assert.equal(await cleanupUploadedFileAfterFailure({ diskPath }), true);
    await assert.rejects(readFile(diskPath), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('an external image reference is never deleted by rollback cleanup', async () => {
  assert.equal(await cleanupUploadedFileAfterFailure({
    filePath: 'https://example.invalid/image.jpg',
  }), false);
});
