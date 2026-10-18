// Node byte entrance: never allocate or read more than the contract plus one sentinel byte.
import { openSync, readSync, closeSync } from 'node:fs';
import { MAX_FILE_BYTES } from './reader-core.mjs';
/**
 * Read at most limit + 1 bytes and reject overflow with PROFILE_INVALID.
 * Return the bytes read within the limit and close the opened descriptor even on failure.
 */
export function readBounded(path, limit = MAX_FILE_BYTES) {
  const fd = openSync(path, 'r');
  try {
    const bytes = Buffer.alloc(limit + 1);
    let used = 0;
    while (used < bytes.length) {
      const n = readSync(fd, bytes, used, bytes.length - used, null);
      if (!n) break;
      used += n;
    }
    if (used > limit) throw Object.assign(new Error('PROFILE_INVALID'), { code: 'PROFILE_INVALID' });
    return bytes.subarray(0, used);
  } finally { closeSync(fd); }
}
