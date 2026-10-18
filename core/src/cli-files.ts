// Trusted local-file entrance. Remote callers must supply their own authorization.
import { basename, resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { readBounded } from '../../spec/tools/bytes.mjs';
import { invalid } from '../../spec/tools/reader-core.mjs';
import { parseProfile, type ParseResult } from './profile/parse.js';
/**
 * Read bounded original bytes from a caller-authorized path and validate its basename.
 * Draft mode exempts filename matching only. I/O failures become fixed issue codes;
 * this local entrance does not authorize paths for remote callers.
 */
export function loadProfile(file: string, mode: 'read' | 'write', draft = false): ParseResult {
  const name = basename(file), me = name === 'HUMANS.md';
  try { return parseProfile(readBounded(file), { mode, kind: me ? 'me' : 'repo', draft, expectedId: me ? undefined : name.endsWith('.md') ? name.slice(0, -3) : '' }); }
  catch (error) { return invalid(error instanceof Error && 'code' in error && error.code === 'PROFILE_INVALID' ? 'PROFILE_INVALID' : 'PROFILE_UNAVAILABLE'); }
}
/** Deduplicate OS-resolved targets in input order; unresolved paths use absolute lexical paths. */
export function distinctPaths(files: string[]): string[] {
  return [...new Set(files.map(file => {
    // Native OS semantics: follow symlinks BEFORE resolving parent segments.
    try { return realpathSync.native(file); } catch { return resolve(file); }
  }))];
}
const CODES = new Set(['PROFILE_INVALID', 'UNSUPPORTED_VERSION', 'PROFILE_UNAVAILABLE', 'NOTE_WITHHELD_AGENT_DIRECTED', 'DRAFT_FILENAME_UNCHECKED', 'UNSUPPORTED_ARGUMENT', 'RENDER_LIMIT']);
/** Fixed vocabulary, deduplicated per operation; never forward exception text. */
export function diagnostics(codes: string[]): string {
  return [...new Set(codes.map(c => CODES.has(c) ? c : 'PROFILE_INVALID'))].map(c => c + '\n').join('');
}
