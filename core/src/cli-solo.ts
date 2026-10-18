// Public single-person CLI (npm `@humans-md/cli`, command `humans-md`; public Claude Code plugin).
// It reads the owner's own profile only: no recipient or group path, nothing from team/.
// Running it on your machine with your file is the owner's explicit local selection (SPEC § 6.1);
// `show` and `hook` accept only a file named HUMANS.md (SPEC § 5): a shared `<id>.md` is someone
// else's and is refused before any read.
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, isAbsolute, join } from 'node:path';
import { loadProfile, diagnostics } from './cli-files.js';
import { serveOwner } from './profile/view.js';
import { renderProjection, type Adapter } from './profile/render.js';
import { HINTS, SyncError, TARGETS, makeBlock, rerunCommand, syncFile, type Client, type SyncCode } from './sync.js';
declare const __HUMANS_MD_VERSION__: string;
const CLIENTS = ['claude', 'codex', 'cursor', 'copilot'] as const satisfies readonly Adapter[];
const DEFAULT_FILE = '~/.humans/HUMANS.md';
const USAGE = `humans-md: check and load your own HUMANS.md (https://humansmd.dev)

  humans-md check [file] [--draft]    validate a profile
  humans-md show [file] [--json]     what your agents receive
  humans-md hook ${CLIENTS.join('|')} [file]   the session-start hook output
  humans-md sync [file] [--to cline|junie|--target F] [--remove] [--dry-run]
  options for show and hook: --no-guidance, --budget-bytes N, --budget-tokens N
  file defaults to ${DEFAULT_FILE}
`;
// yaml prints every frontmatter token to stdout when these are set: comments and withheld notes
// would reach the agent's context ahead of the envelope.
delete process.env.LOG_TOKENS; delete process.env.LOG_STREAM;
const [cmd, ...args] = process.argv.slice(2);
if (args.length === 0 && (cmd === '--help' || cmd === '-h' || cmd === 'help')) { process.stdout.write(USAGE); process.exit(0); }
if (args.length === 0 && cmd === '--version') { process.stdout.write(__HUMANS_MD_VERSION__ + '\n'); process.exit(0); }
/** Reject invalid CLI syntax with a static diagnostic and the usage on stderr, exit 2, before profile I/O. */
const fail = (): never => { process.stderr.write('UNSUPPORTED_ARGUMENT\n' + USAGE); process.exit(2); };
// Validate every option and cardinality before ANY profile/path IO.
if (cmd !== 'check' && cmd !== 'show' && cmd !== 'hook' && cmd !== 'sync') fail();
let draft = false, json = false, guidance = true, remove = false, dryRun = false;
let to: Client | undefined, target: string | undefined;
let budgetBytes: number | undefined, budgetTokens: number | undefined;
const positional: string[] = [], seen = new Set<string>();
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!arg.startsWith('-')) { positional.push(arg); continue; }
  if (seen.has(arg)) fail();
  seen.add(arg);
  if (arg === '--draft' && cmd === 'check') draft = true;
  else if (arg === '--json' && cmd === 'show') json = true;
  else if (arg === '--no-guidance' && cmd !== 'check') guidance = false;
  else if (arg === '--remove' && cmd === 'sync') remove = true;
  else if (arg === '--dry-run' && cmd === 'sync') dryRun = true;
  else if (arg === '--to' && cmd === 'sync' && !seen.has('--target')) {
    const value = args[++i];
    if (!Object.hasOwn(TARGETS, value ?? '')) fail();
    to = value as Client;
  } else if (arg === '--target' && cmd === 'sync' && !seen.has('--to')) {
    target = args[++i];
    if (!target || !(target.startsWith('~/') || isAbsolute(target))) fail();
  } else if (['--budget-bytes', '--budget-tokens'].includes(arg) && (cmd === 'show' || cmd === 'hook')) {
    const value = args[++i];
    if (!/^(0|[1-9][0-9]{0,8})$/.test(value ?? '')) fail();
    if (arg === '--budget-bytes') budgetBytes = Number(value); else budgetTokens = Number(value);
  } else fail();
}
const client = cmd === 'hook' ? positional.shift() : undefined;
if (cmd === 'hook' && !(CLIENTS as readonly string[]).includes(client ?? '')) fail();
if (positional.length > 1) fail();
/** Refuse the sync step with a static code and hint: nothing written. */
function refuse(code: SyncCode): never { process.stderr.write(`${code}\nhumans-md sync: ${HINTS[code]}\n`); process.exit(1); }
// With HOME empty or relative, `~/` would be the current folder: sync writes nothing, removes nothing.
if (cmd === 'sync' && !isAbsolute(homedir())) refuse('HOME_UNAVAILABLE');
let file = positional[0] ?? DEFAULT_FILE;
// A leading `~/` is the home directory.
const home = (p: string) => p.startsWith('~/') ? join(homedir(), p.slice(2)) : p;
file = home(file);
const destination = home(target ?? '~/' + TARGETS[to ?? 'cline']);
/** Run the sync step and exit: a static code and hint on failure, nothing written. */
const sync = (block: string | null): never => {
  try {
    const action = syncFile(destination, block, dryRun);
    const shown = destination.startsWith(homedir() + '/') ? '~' + destination.slice(homedir().length) : destination;
    const verb = (dryRun ? { created: 'would create', updated: 'would update', removed: 'would remove the copy from' } as Record<string, string> : {})[action]
      ?? { created: 'created', updated: 'updated', unchanged: 'unchanged', removed: 'removed the copy from', absent: 'no copy in' }[action];
    process.stdout.write(`humans-md sync: ${verb} ${shown}\n` + (dryRun && block ? block : ''));
    process.exit(0);
  } catch (e) {
    refuse(e instanceof SyncError ? e.code : 'TARGET_UNAVAILABLE');
  }
};
// Removing the copy reads no profile: it works after the profile is gone.
if (cmd === 'sync' && remove) sync(null);
const today = new Date().toISOString().slice(0, 10);
if (cmd === 'check') {
  const { issues } = loadProfile(file, 'write', draft);
  const ok = !issues.some(i => i.severity === 'error');
  process.stdout.write(JSON.stringify({ ok, issues }) + '\n'); process.exit(ok ? 0 : 1);
}
// Loading as the owner: an absolute path, never relative (a hook runs in the session's directory,
// where a repository could ship its own `.humans/HUMANS.md`), to a file named HUMANS.md.
// A link named HUMANS.md to someone's `<id>.md` is not the owner's file either.
const real = (f: string) => { try { return realpathSync.native(f); } catch { return f; } };
if (!isAbsolute(file) || basename(file) !== 'HUMANS.md' || basename(real(file)) !== 'HUMANS.md') fail();
const { profile, withheld, issues } = loadProfile(file, 'read');
const codes = issues.map(i => i.message);
const projection = profile ? serveOwner(profile, { today, withheld }) : { status: 'none' as const };
const adapter = (cmd === 'hook' ? client : json ? 'json' : 'text') as Adapter;
// Text adapters append the SPEC § 6.4 instruction sentences unless --no-guidance is given.
const rendered = renderProjection(projection, { adapter, budgetBytes, budgetTokens, ...(guidance ? {} : { guidance: false }) });
if (rendered.diagnostic) codes.push(rendered.diagnostic);
if (cmd === 'sync') {
  // A missing, invalid or oversized profile writes nothing: no copy of an absence.
  if (!profile || rendered.diagnostic) { process.stderr.write(diagnostics(codes) + 'humans-md sync: no copy written; run humans-md check.\n'); process.exit(1); }
  process.stderr.write(diagnostics(codes));
  const rerun = rerunCommand({ to, target: target && destination, profile: positional[0] && file, guidance }, homedir());
  sync(makeBlock(rendered.output, today, __HUMANS_MD_VERSION__, rerun));
}
process.stdout.write(rendered.output);
process.stderr.write(diagnostics(codes));
