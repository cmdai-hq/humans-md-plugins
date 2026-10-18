// Reference CLI of the conformance tests (validate, serve, merge, render-agent), bundled by
// test/setup/reference-cli.ts. Never published: the published CLI is cli-solo.ts.
import { loadProfile, distinctPaths, diagnostics } from './cli-files.js';
import { mergeAudience } from './profile/merge.js';
import { serveTo } from './profile/view.js';
import { ADAPTERS, renderProjection, type Adapter, type Projection } from './profile/render.js';
const [cmd, ...args] = process.argv.slice(2);
/** Reject invalid CLI syntax with a static diagnostic and exit 2, before profile I/O. */
const fail = (): never => { process.stderr.write('UNSUPPORTED_ARGUMENT\n'); process.exit(2); };
// Validate every option and cardinality before ANY profile/path IO.
if (!['validate', 'serve', 'merge', 'render-agent'].includes(cmd)) fail();
let draft = false, owner = false, group = false, guidance = true, adapter: Adapter = 'text';
let budgetBytes: number | undefined, budgetTokens: number | undefined;
const files: string[] = [], seen = new Set<string>();
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!arg.startsWith('-')) { files.push(arg); continue; }
  if (seen.has(arg)) fail();
  seen.add(arg);
  if (arg === '--draft' && cmd === 'validate') draft = true;
  else if (arg === '--owner' && (cmd === 'serve' || cmd === 'render-agent')) owner = true;
  else if (arg === '--group' && cmd === 'render-agent') group = true;
  else if (arg === '--no-guidance' && cmd === 'render-agent') guidance = false;
  else if (arg === '--adapter' && cmd === 'render-agent') {
    const value = args[++i];
    if (!ADAPTERS.includes(value as Adapter)) fail();
    adapter = value as Adapter;
  } else if (['--budget-bytes', '--budget-tokens'].includes(arg) && cmd === 'render-agent') {
    const value = args[++i];
    if (!/^(0|[1-9][0-9]{0,8})$/.test(value ?? '')) fail();
    if (arg === '--budget-bytes') budgetBytes = Number(value); else budgetTokens = Number(value);
  } else fail();
}
if (group && owner) fail();
if (cmd === 'merge' || group) { if (files.length < 1 || files.length > 200) fail(); }
else if (files.length !== 1) fail();
/** Write one JSON value plus LF to stdout for diagnostic commands; adapter output uses its own envelope. */
const print = (value: unknown) => process.stdout.write(JSON.stringify(value) + '\n');
const today = new Date().toISOString().slice(0, 10);
if (cmd === 'validate') {
  const { issues } = loadProfile(files[0], 'write', draft);
  const ok = !issues.some(i => i.severity === 'error');
  print({ ok, issues }); process.exit(ok ? 0 : 1);
}
let projection: Projection;
const codes: string[] = [];
if (cmd === 'merge' || group) {
  const profiles = distinctPaths(files).map(f => {
    const result = loadProfile(f, 'read');
    if (cmd === 'render-agent') codes.push(...result.issues.map(i => i.message));
    // Only anyone_with_file profiles are readable without authentication (SPEC § 6.1).
    return result.profile?.visibility === 'anyone_with_file' ? result.profile : null;
  });
  projection = mergeAudience(profiles, { today });
} else {
  const { profile, withheld, issues } = loadProfile(files[0], 'read');
  codes.push(...issues.map(i => i.message));
  // --owner requires an owner's explicit selected file in trusted local context.
  // It is never a remote identity or an MCP argument.
  projection = profile ? serveTo(profile, { today, withheld, audience: owner ? 'owner' : 'public' }) : { status: 'none' };
}
if (cmd === 'render-agent') {
  // Text adapters append the SPEC § 6.4 instruction sentences unless --no-guidance is given.
  const rendered = renderProjection(projection, { adapter, budgetBytes, budgetTokens, ...(guidance ? {} : { guidance: false }) });
  if (rendered.diagnostic) codes.push(rendered.diagnostic);
  process.stdout.write(rendered.output);
} else print(projection); // Diagnostic compatibility commands, not adapter fallbacks.
process.stderr.write(diagnostics(codes));
