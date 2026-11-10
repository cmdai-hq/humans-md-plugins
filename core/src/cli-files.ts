// Trusted local-file entrance. Remote callers must supply their own authorization.
import { basename, resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { readBounded } from '../../spec/tools/bytes.mjs';
import { invalid } from '../../spec/tools/reader-core.mjs';
import { parseProfile, type Issue, type ParseResult } from './profile/parse.js';
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
/** The file a link points to, in the spelling the file system stores; the path itself when it cannot be resolved. */
export const real = (file: string): string => { try { return realpathSync.native(file); } catch { return file; } };
/**
 * `humans-md check`: the strict writer's verdict on a local file. A path named HUMANS.md whose real
 * name differs (another case on a case-insensitive file system, a link to someone's `<id>.md`) is
 * refused as `show` and the hooks refuse it.
 */
export function checkProfile(file: string, draft = false): { ok: boolean; issues: Issue[] } {
  if (!draft && basename(file) === 'HUMANS.md' && basename(real(file)) !== 'HUMANS.md') return { ok: false, issues: invalid('FILENAME_MISMATCH').issues };
  const { issues } = loadProfile(file, 'write', draft);
  return { ok: !issues.some(i => i.severity === 'error'), issues };
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
