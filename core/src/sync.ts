// `humans-md sync`: a copy of the owner's rendered profile in a marked block of a user-level
// instruction file, for clients that run no hook and load no plugin. This is a fallback, not a
// conformant adapter: SPEC § 5 wants a renderer at each load, and this copy is only as fresh as
// the last `humans-md sync`. The rest of the target file is kept byte for byte.
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, renameSync, statSync, unlinkSync, writeSync, type Stats } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';

export const BEGIN = '<!-- humans-md:begin -->';
export const END = '<!-- humans-md:end -->';
/** Start of the generated-copy line right after BEGIN. */
export const NOTICE = '<!-- Generated copy of your HUMANS.md';
/** A user-level instruction file larger than this is refused rather than read. */
export const MAX_TARGET_BYTES = 1_048_576;
/** Documented user-level files, relative to the home directory (see recherche/0.3.0/sync.md). */
export const TARGETS = { cline: '.agents/AGENTS.md', junie: '.junie/AGENTS.md' } as const;
export type Client = keyof typeof TARGETS;

export type SyncCode = 'TARGET_NOT_REGULAR' | 'TARGET_IN_REPOSITORY' | 'TARGET_MARKERS_INVALID' | 'TARGET_TOO_LARGE' | 'TARGET_UNAVAILABLE' | 'TARGET_IS_PROFILE' | 'HOME_UNAVAILABLE';
/** Static explanations: never a path, a file excerpt or profile text (SPEC § 8). */
export const HINTS: Record<SyncCode, string> = {
  TARGET_NOT_REGULAR: 'the target is a symbolic link, a hard link or not a regular file. Nothing written.',
  TARGET_IN_REPOSITORY: 'the target is inside a git work tree, or a home directory tracked by a dotfiles repository. Your profile can hold private notes. Nothing written.',
  TARGET_MARKERS_INVALID: 'the target has humans-md markers that are duplicated, unpaired or edited. Fix or remove them by hand, then run sync again.',
  TARGET_TOO_LARGE: 'the target is larger than 1 MiB. Nothing written.',
  TARGET_UNAVAILABLE: 'the target cannot be read or written, or changed while sync ran. Nothing written.',
  TARGET_IS_PROFILE: 'the target is a HUMANS.md file. Sync writes a copy into an instruction file, never into a profile.',
  HOME_UNAVAILABLE: 'HOME is not set to an absolute path, so ~ would be the current folder. Nothing written.',
};
export class SyncError extends Error {
  constructor(readonly code: SyncCode) { super(code); }
}

export type Action = 'created' | 'updated' | 'unchanged' | 'removed' | 'absent';
/**
 * Text is handled as a binary string (one char per byte, latin1) so every byte outside the block,
 * invalid UTF-8 included, survives unchanged.
 */
export interface Plan { action: Action; text?: string }

/** One line of a binary string: its start offset, its end after the line break, its text without CR/LF. */
interface Line { start: number; end: number; text: string }
const lines = (s: string): Line[] => {
  const out: Line[] = [];
  for (let start = 0; start < s.length;) {
    const nl = s.indexOf('\n', start), end = nl < 0 ? s.length : nl + 1;
    out.push({ start, end, text: s.slice(start, nl < 0 ? end : nl).replace(/\r$/, '') });
    start = end;
  }
  return out;
};

/** Locate the one block: undefined when there is none; refuse anything ambiguous instead of guessing. */
export function findBlock(s: string): { begin: Line; end: Line; inner: string } | undefined {
  const all = lines(s);
  const marks = all.filter(l => l.text.trimStart().startsWith('<!-- humans-md:'));
  if (!marks.length) return undefined;
  const [begin, end] = marks;
  if (marks.length !== 2 || begin.text !== BEGIN || end.text !== END) throw new SyncError('TARGET_MARKERS_INVALID');
  return { begin, end, inner: s.slice(begin.end, end.start) };
}

/**
 * Plan the new file text. `block` is the full marked block (binary string, ending with LF), or null
 * to remove it. A block whose rendered content is unchanged is left as it is, its date included.
 */
export function planSync(existing: string | null, block: string | null): Plan {
  const found = existing === null ? undefined : findBlock(existing);
  if (block === null) {
    if (!found || existing === null) return { action: 'absent' };
    let before = existing.slice(0, found.begin.start);
    const after = existing.slice(found.end.end);
    // Undo the blank line that sync puts before a block it appends at the end of a file. A file
    // that had no final newline keeps the one added then: the two cases look the same here.
    if (after === '' && before.endsWith('\n\n')) before = before.slice(0, -1);
    return { action: 'removed', text: before + after };
  }
  if (existing === null || existing === '') return { action: 'created', text: block };
  if (!found) return { action: 'updated', text: existing + (existing.endsWith('\n') ? '\n' : '\n\n') + block };
  const body = (inner: string) => inner.startsWith(NOTICE) && inner.includes('\n') ? inner.slice(inner.indexOf('\n') + 1) : null;
  const next = findBlock(block)!;
  if (body(found.inner) === body(next.inner)) return { action: 'unchanged' };
  return { action: 'updated', text: existing.slice(0, found.begin.start) + block + existing.slice(found.end.end) };
}

/**
 * The marked block around a text rendering (frame, JSON line and sentences, ending with LF), as UTF-8
 * text. `rerun` is the command to run again; it must not contain a line break or `-->`.
 */
export function makeBlock(rendering: string, date: string, version: string, rerun: string): string {
  if (/[\r\n]|-->/.test(rerun) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[\w.+-]+$/.test(version)) throw new Error('UNSUPPORTED_ARGUMENT');
  const notice = `${NOTICE}, written by humans-md ${version} on ${date}. Do not edit it here: edit your HUMANS.md, then run \`${rerun}\` again. -->`;
  const block = `${BEGIN}\n${notice}\n${rendering}${END}\n`;
  // A rendering never has a marker line (it is the frame, one JSON line and fixed sentences).
  if (findBlock(block)?.begin.start !== 0) throw new Error('UNSUPPORTED_ARGUMENT');
  return block;
}

/** The command line to show in the block. A path with unusual characters is left out, not quoted. */
export function rerunCommand(parts: { to?: Client; target?: string; profile?: string; guidance: boolean }, home: string): string {
  const shown = (p: string) => {
    const short = p === home || p.startsWith(home + '/') ? '~' + p.slice(home.length) : p;
    return /^[\w./~+@-]+$/.test(short) ? short : null;
  };
  const words = ['humans-md sync'];
  let complete = true;
  for (const [flag, value] of [['', parts.profile], ['--target ', parts.target]] as const) {
    if (value === undefined) continue;
    const s = shown(value);
    if (s === null) complete = false; else words.push(flag + s);
  }
  if (parts.to) words.push(`--to ${parts.to}`);
  if (!parts.guidance) words.push('--no-guidance');
  return words.join(' ') + (complete ? '' : ' with the same file arguments');
}

/** The nearest existing ancestor of a path, through symbolic links. */
function existingAncestor(dir: string): string {
  for (let d = dir; ; d = dirname(d)) {
    try { return realpathSync.native(d); } catch { if (dirname(d) === d) throw new SyncError('TARGET_UNAVAILABLE'); }
  }
}
/** Whether a real directory or one of its ancestors holds a `.git` entry (a repository or a worktree). */
function inRepository(realDir: string): boolean {
  for (let d = realDir; ; d = dirname(d)) {
    try { lstatSync(join(d, '.git')); return true; } catch { /* keep looking */ }
    if (dirname(d) === d) return false;
  }
}
/** Git folders that common dotfiles setups keep in the home directory they track (bare repository, yadm). */
const DOTFILES_GIT_DIRS = ['.dotfiles', '.cfg', '.local/share/yadm/repo.git', '.config/yadm/repo.git'];
/** A small regular file's text, or null. */
const smallText = (path: string): string | null => {
  try { const st = statSync(path); return st.isFile() && st.size <= 65_536 ? readFileSync(path, 'utf8') : null; } catch { return null; }
};
/**
 * Whether git may treat a real directory as part of a work tree that has no `.git` entry: GIT_DIR or
 * GIT_WORK_TREE set, or a home directory tracked by a known dotfiles git folder whose config is bare
 * (used with --work-tree=$HOME) or names the home directory as its work tree. The config is read as
 * text: running git would run what a repository's config asks for. Other setups are not detected.
 */
function inDotfilesHome(realDir: string): boolean {
  if (process.env.GIT_DIR || process.env.GIT_WORK_TREE) return true;
  let home: string;
  try { home = realpathSync.native(homedir()); } catch { return false; }
  if (realDir !== home && !realDir.startsWith(home + '/')) return false;
  const homes = new Set(['~', homedir().replace(/\/+$/, ''), home]);
  return DOTFILES_GIT_DIRS.some(dir => {
    const config = smallText(join(home, dir, 'config'));
    if (config === null || smallText(join(home, dir, 'HEAD')) === null) return false;
    const worktree = /^\s*worktree\s*=\s*"?([^"\n]*?)"?\s*$/im.exec(config)?.[1].replace(/\/+$/, '');
    return /^\s*bare\s*=\s*(true|yes|on|1)\s*$/im.test(config) || (worktree !== undefined && homes.has(worktree));
  });
}
/** Refuse anything but a regular file with one name: a link (lstat), a hard link, a directory, a FIFO. */
function checkRegular(st: Stats): void {
  if (!st.isFile() || st.nlink > 1) throw new SyncError('TARGET_NOT_REGULAR');
}
const lstatOrNull = (p: string): Stats | null => {
  try { return lstatSync(p); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new SyncError('TARGET_UNAVAILABLE'); }
};
/** Read the target without following a link, bounded; null when it does not exist. */
function readTarget(target: string): { text: string; st: Stats } | null {
  const seen = lstatOrNull(target);
  if (seen === null) return null;
  // Checked before opening: opening a FIFO for reading would block.
  checkRegular(seen);
  let fd: number;
  try { fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (e) { throw new SyncError((e as NodeJS.ErrnoException).code === 'ELOOP' ? 'TARGET_NOT_REGULAR' : 'TARGET_UNAVAILABLE'); }
  try {
    const st = fstatSync(fd);
    checkRegular(st);
    if (st.ino !== seen.ino) throw new SyncError('TARGET_UNAVAILABLE');
    const buf = Buffer.alloc(MAX_TARGET_BYTES + 1);
    let used = 0;
    for (let n; used < buf.length && (n = readSync(fd, buf, used, buf.length - used, null)); used += n);
    if (used > MAX_TARGET_BYTES) throw new SyncError('TARGET_TOO_LARGE');
    return { text: buf.subarray(0, used).toString('latin1'), st };
  } catch (e) { throw e instanceof SyncError ? e : new SyncError('TARGET_UNAVAILABLE'); }
  finally { closeSync(fd); }
}

/**
 * Write, update or remove the block in `target` (absolute). `block` is UTF-8 text or null to remove.
 * Checks run before any write; the write goes to a temporary file in the same directory, then a
 * rename, keeping the existing file's owner permissions without group or other access (0600 for a
 * new file). The temporary file never outlives a failure. With `dryRun`, nothing is written.
 */
export function syncFile(target: string, block: string | null, dryRun = false): Action {
  if (!isAbsolute(homedir())) throw new SyncError('HOME_UNAVAILABLE');
  if (!isAbsolute(target)) throw new SyncError('TARGET_UNAVAILABLE');
  if (basename(target).toLowerCase() === 'humans.md') throw new SyncError('TARGET_IS_PROFILE');
  const dir = dirname(target);
  const ancestor = existingAncestor(dir);
  if (inRepository(ancestor) || inDotfilesHome(ancestor)) throw new SyncError('TARGET_IN_REPOSITORY');
  const current = readTarget(target);
  const plan = planSync(current?.text ?? null, block === null ? null : Buffer.from(block, 'utf8').toString('latin1'));
  if (plan.text === undefined || dryRun) return plan.action;
  let tmp: string | undefined;
  try {
    if (current === null) mkdirSync(dir, { recursive: true });
    const name = join(dir, `.${basename(target)}.humans-md-${process.pid}-${randomBytes(6).toString('hex')}.tmp`);
    const fd = openSync(name, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    // Ours from here on, so removed on any failure below (not before: the name could be someone else's).
    tmp = name;
    try {
      const data = Buffer.from(plan.text, 'latin1');
      for (let off = 0; off < data.length;) off += writeSync(fd, data, off);
      // A copy of the profile: never readable by group or others, even if the file was.
      fchmodSync(fd, current ? current.st.mode & 0o7777 & ~0o077 : 0o600);
      fsyncSync(fd);
    } finally { closeSync(fd); }
    // Refuse to replace a file that changed, or appeared, since it was read.
    const now = lstatOrNull(target);
    if (current === null ? now !== null : now === null || now.ino !== current.st.ino || now.size !== current.st.size || now.mtimeMs !== current.st.mtimeMs || now.ctimeMs !== current.st.ctimeMs) {
      throw new SyncError('TARGET_UNAVAILABLE');
    }
    renameSync(tmp, target);
    tmp = undefined;
    return plan.action;
  } catch (e) {
    throw e instanceof SyncError ? e : new SyncError('TARGET_UNAVAILABLE');
  } finally {
    if (tmp) try { unlinkSync(tmp); } catch { /* already gone */ }
  }
}
