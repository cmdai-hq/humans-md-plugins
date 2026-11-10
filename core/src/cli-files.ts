// Trusted local-file entrance. Remote callers must supply their own authorization.
import { basename, resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { readBounded } from '../../spec/tools/bytes.mjs';
import { invalid } from '../../spec/tools/reader-core.mjs';
import { parseProfile, type Issue, type ParseOptions, type ParseResult } from './profile/parse.js';
import { locateInvalid } from './profile/locate.js';
/** Parser options a file name implies: `HUMANS.md` is the owner's file, `<id>.md` a shared one. */
const named = (file: string, draft: boolean): Pick<ParseOptions, 'kind' | 'expectedId' | 'draft'> => {
  const name = basename(file), me = name === 'HUMANS.md';
  return { kind: me ? 'me' : 'repo', draft, expectedId: me ? undefined : name.endsWith('.md') ? name.slice(0, -3) : '' };
};
/**
 * Read bounded original bytes from a caller-authorized path and validate its basename.
 * Draft mode exempts filename matching only. I/O failures become fixed issue codes;
 * this local entrance does not authorize paths for remote callers.
 */
export function loadProfile(file: string, mode: 'read' | 'write', draft = false): ParseResult {
  try { return parseProfile(readBounded(file), { mode, ...named(file, draft) }); }
  catch (error) { return invalid(error instanceof Error && 'code' in error && error.code === 'PROFILE_INVALID' ? 'PROFILE_INVALID' : 'PROFILE_UNAVAILABLE'); }
}
/** The file a link points to, in the spelling the file system stores; the path itself when it cannot be resolved. */
export const real = (file: string): string => { try { return realpathSync.native(file); } catch { return file; } };
/**
 * `humans-md check`: the strict writer's verdict on a local file, as one bounded line (SPEC § 8:
 * static codes, at most 512 bytes). A path named HUMANS.md whose real name differs (another case on
 * a case-insensitive file system, a link to someone's `<id>.md`) is refused as `show` and the hooks
 * refuse it. A PROFILE_INVALID names the recognized fields at fault, as many as fit, when they are found.
 */
export function checkProfile(file: string, draft = false): { ok: boolean; issues: Issue[] } {
  if (!draft && basename(file) === 'HUMANS.md' && basename(real(file)) !== 'HUMANS.md') return { ok: false, issues: invalid('FILENAME_MISMATCH').issues };
  let { issues } = loadProfile(file, 'write', draft);
  const ok = !issues.some(i => i.severity === 'error');
  if (issues.some(i => i.message === 'PROFILE_INVALID')) {
    // A second, bounded read: the reader's result carries no place. Over the bound, the read itself fails.
    let located: Issue[] | undefined;
    try { located = locateInvalid(readBounded(file), named(file, draft)); }
    catch (error) { if (error instanceof Error && 'code' in error && error.code === 'PROFILE_INVALID') located = invalid('TOO_LARGE').issues; }
    if (located) {
      while (located.length > 1 && Buffer.byteLength(JSON.stringify({ ok, issues: located })) >= 512) located.pop();
      issues = located;
    }
  }
  return { ok, issues };
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
