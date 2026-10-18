/**
 * Read a caller-authorized local path synchronously, defaulting limit to MAX_FILE_BYTES.
 * Expect a nonnegative integer limit suitable for Buffer allocation; custom limits are
 * not clamped to MAX_FILE_BYTES. Allocate and read at most limit + 1 bytes to detect overflow.
 * Return the bytes read when within limit; overflow throws with message and code PROFILE_INVALID.
 * Close an opened descriptor in finally on success or failure; filesystem and allocation
 * errors propagate. This reads bytes without decoding or validating profile contents.
 */
export function readBounded(path: string, limit?: number): Uint8Array;
