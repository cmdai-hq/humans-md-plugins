// Model-free checks of `humans-md check`, as shipped: a file the hooks refuse is not reported as
// valid. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const bin = join(root, 'packages/humans-md/bin/humans-md.mjs');
const hook = join(root, 'plugins/humans-md/hooks/session-start.mjs');
const fixture = readFileSync(join(root, 'test/fixtures/home/.humans/HUMANS.md'), 'utf8');
const run = (file, args, opts = {}) => spawnSync(process.execPath, [file, ...args], { encoding: 'utf8', timeout: 10_000, ...opts });
/** Run with a temporary directory, removed afterwards. */
const inTemp = fn => { const dir = mkdtempSync(join(tmpdir(), 'humans-md-check-')); try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };
const error = (path, message) => ({ path, message, severity: 'error' });

test('check refuses what the hooks refuse: a link named HUMANS.md to a file with another name', () => inTemp(dir => {
  mkdirSync(join(dir, 'people')); mkdirSync(join(dir, '.humans'));
  writeFileSync(join(dir, 'people/alice.md'), fixture.replace('id: sam-example', 'id: alice'));
  const file = join(dir, '.humans/HUMANS.md');
  symlinkSync(join(dir, 'people/alice.md'), file);
  const env = { PATH: process.env.PATH, HOME: dir };
  const checked = run(bin, ['check'], { env });
  assert.equal(checked.status, 1);
  assert.deepEqual(JSON.parse(checked.stdout), { ok: false, issues: [error('$', 'FILENAME_MISMATCH')] });
  assert.doesNotMatch(checked.stdout + checked.stderr, /alice|Invented/);
  // The hook and `show` already refuse it.
  const hooked = run(hook, [], { input: '{"hook_event_name":"SessionStart"}', env });
  assert.equal(JSON.parse(JSON.parse(hooked.stdout).hookSpecificOutput.additionalContext.split('\n')[1]).status, 'none');
  assert.equal(run(bin, ['show', file]).status, 2);
  // A link to a file that is also named HUMANS.md is yours (dotfiles): valid for all three.
  mkdirSync(join(dir, 'dotfiles'));
  writeFileSync(join(dir, 'dotfiles/HUMANS.md'), fixture);
  rmSync(file);
  symlinkSync(join(dir, 'dotfiles/HUMANS.md'), file);
  assert.equal(run(bin, ['check'], { env }).stdout, '{"ok":true,"issues":[]}\n');
  assert.equal(run(bin, ['show', file, '--json']).status, 0);
}));

test('on a case-insensitive file system, a file named humans.md is not reported as valid', t => inTemp(dir => {
  mkdirSync(join(dir, '.humans'));
  writeFileSync(join(dir, '.humans/humans.md'), fixture);
  const file = join(dir, '.humans/HUMANS.md');
  // macOS (APFS) and Windows open it under either spelling; most Linux file systems do not.
  if (!existsSync(file)) return t.skip('this file system is case-sensitive');
  const env = { PATH: process.env.PATH, HOME: dir };
  const checked = run(bin, ['check'], { env });
  assert.equal(checked.status, 1);
  assert.deepEqual(JSON.parse(checked.stdout), { ok: false, issues: [error('$', 'FILENAME_MISMATCH')] });
  // The hook gives the absence and `show` refuses the file: all three now agree.
  const hooked = run(hook, [], { input: '{"hook_event_name":"SessionStart"}', env });
  assert.equal(JSON.parse(JSON.parse(hooked.stdout).hookSpecificOutput.additionalContext.split('\n')[1]).status, 'none');
  assert.equal(run(bin, ['show', file]).status, 2);
}));
