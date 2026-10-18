import { it, expect, inject } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadProfile } from '../src/cli-files.js';
import { FRAME } from '../src/profile/render.js';
// @ts-ignore Reference file entrance, differential oracle.
import { loadProfile as reference } from '../../spec/tools/validate.mjs';

const cli = inject('referenceCli');

it('typed and bundled file entrances distinguish malformed bytes from unavailable files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'humans-file-errors-'));
  try {
    const file = join(dir, 'HUMANS.md'), missing = join(dir, 'MISSING_PAYLOAD.md');
    const cases = [
      { bytes: Buffer.from('MALFORMED_PAYLOAD'), path: file, code: 'PROFILE_INVALID' },
      { bytes: Buffer.from([0xff]), path: file, code: 'PROFILE_INVALID' },
      { bytes: Buffer.alloc(24590, 0x61), path: file, code: 'PROFILE_INVALID' },
      { path: missing, code: 'PROFILE_UNAVAILABLE' },
      { path: dir, code: 'PROFILE_UNAVAILABLE' },
    ];
    for (const c of cases) {
      if (c.bytes) writeFileSync(file, c.bytes);
      const issues = [{ path: '$', message: c.code, severity: 'error' }];
      for (const mode of ['read', 'write'] as const) {
        expect(loadProfile(c.path, mode)).toEqual(reference(c.path, mode));
        expect(loadProfile(c.path, mode).issues).toEqual(issues);
      }
      /**
       * Run the shipped CLI with a five-second timeout and capture status/stdout/stderr so refusals can
       * be checked without losing their diagnostics.
       */
      const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000 });
      const validation = run('validate', c.path);
      expect(validation.status).toBe(1); expect(validation.stderr).toBe('');
      expect(JSON.parse(validation.stdout)).toEqual({ ok: false, issues });
      const served = run('serve', c.path, '--owner');
      expect(served.status).toBe(0); expect(served.stdout).toBe('{"status":"none"}\n');
      expect(served.stderr).toBe(`${c.code}\n`);
      const rendered = run('render-agent', c.path, '--owner');
      expect(rendered.status).toBe(0); expect(rendered.stdout).toBe(`${FRAME}\n{"status":"none"}\n`);
      expect(rendered.stderr).toBe(`${c.code}\n`);
    }
    // Exercise a deterministic read failure without depending on the runner's privileges.
    const preload = join(dir, 'denied.mjs');
    writeFileSync(preload, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const open = fs.openSync;
fs.openSync = function(path, ...args) {
  if (path === ${JSON.stringify(file)}) throw Object.assign(new Error('DENIED_PAYLOAD'), { code: 'EACCES' });
  return open.call(this, path, ...args);
};
syncBuiltinESMExports();
`);
    const denied = spawnSync(process.execPath, ['--import', preload, cli, 'serve', file, '--owner'], { encoding: 'utf8', timeout: 5000 });
    expect(denied.status).toBe(0); expect(denied.stdout).toBe('{"status":"none"}\n');
    expect(denied.stderr).toBe('PROFILE_UNAVAILABLE\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 30000);

it('shared CLI does not advertise or implement the reference-only expect-invalid flag', () => {
  for (const command of ['validate', 'serve', 'merge', 'render-agent']) {
    const r = spawnSync(process.execPath, [cli, command, 'MISSING_PAYLOAD.md', '--expect-invalid'], { encoding: 'utf8', timeout: 5000 });
    expect(r.status).toBe(2); expect(r.stdout).toBe(''); expect(r.stderr).toBe('UNSUPPORTED_ARGUMENT\n');
  }
});
