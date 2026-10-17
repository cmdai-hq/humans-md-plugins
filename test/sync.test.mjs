// Model-free checks of `humans-md sync`, the copy for clients without a hook, as shipped.
// Every run gets its own HOME in a temporary directory: never the real one. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const bin = join(root, 'packages/humans-md/bin/humans-md.mjs');
const fixture = readFileSync(join(root, 'test/fixtures/home/.humans/HUMANS.md'), 'utf8');
const BEGIN = '<!-- humans-md:begin -->', END = '<!-- humans-md:end -->';

/** A fresh HOME holding the fixture profile, removed afterwards. */
const inHome = fn => {
  const home = mkdtempSync(join(tmpdir(), 'humans-md-sync-'));
  try {
    mkdirSync(join(home, '.humans'));
    writeFileSync(join(home, '.humans/HUMANS.md'), fixture);
    return fn(home);
  } finally { rmSync(home, { recursive: true, force: true }); }
};
const sync = (home, args = [], { env = {}, cwd, node = [] } = {}) => spawnSync(process.execPath, [...node, bin, 'sync', ...args], { encoding: 'utf8', timeout: 15_000, cwd, env: { PATH: process.env.PATH, HOME: home, ...env } });
const show = home => spawnSync(process.execPath, [bin, 'show'], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: home } }).stdout;
const agents = home => join(home, '.agents/AGENTS.md');
/** The block's rendered content: what `show` prints. */
const content = text => { const lines = text.slice(text.indexOf(BEGIN), text.indexOf(END)).split('\n'); return lines.slice(2).join('\n'); };
/** Assert a refusal: exit 1, one static code and hint, no profile text, the file untouched. */
const refused = (result, code, file, before) => {
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, new RegExp(`^${code}\\nhumans-md sync: [^\\n]+\\n$`));
  assert.doesNotMatch(result.stderr, /Invented|sam-example/);
  assert.ok(Buffer.byteLength(result.stderr) < 512, 'SPEC § 8: diagnostics under 512 bytes');
  if (file) assert.deepEqual(existsSync(file) ? readFileSync(file) : null, before);
};

test('creates ~/.agents/AGENTS.md, private, with what show prints between the markers', () => inHome(home => {
  const r = sync(home);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'humans-md sync: created ~/.agents/AGENTS.md\n');
  const text = readFileSync(agents(home), 'utf8');
  assert.ok(text.startsWith(BEGIN + '\n<!-- Generated copy of your HUMANS.md, written by humans-md '));
  assert.match(text.split('\n')[1], / on \d{4}-\d{2}-\d{2}\. Do not edit it here: edit your HUMANS\.md, then run `humans-md sync` again\. -->$/);
  assert.ok(text.endsWith(END + '\n'));
  assert.equal(content(text), show(home));
  assert.equal(statSync(agents(home)).mode & 0o777, 0o600);
}));

test('updates only its block: the rest of the file stays as it was, its mode loses group and other access', () => inHome(home => {
  mkdirSync(join(home, '.agents'));
  // CRLF, no final newline in the block's neighbours, and bytes that are not UTF-8.
  const head = Buffer.concat([Buffer.from('# My rules\r\n\r\nUse tabs.\r\n'), Buffer.from([0xff, 0xfe, 0x0a])]);
  writeFileSync(agents(home), head);
  chmodSync(agents(home), 0o744);
  assert.equal(sync(home).stdout, 'humans-md sync: updated ~/.agents/AGENTS.md\n');
  const first = readFileSync(agents(home));
  assert.deepEqual(first.subarray(0, head.length), head);
  // Text after the block survives an update too.
  const tail = Buffer.from('\n## Mine after\nKeep me.');
  writeFileSync(agents(home), Buffer.concat([first, tail]));
  writeFileSync(join(home, '.humans/HUMANS.md'), fixture.replace('max_words: 150', 'max_words: 120'));
  assert.equal(sync(home).stdout, 'humans-md sync: updated ~/.agents/AGENTS.md\n');
  const second = readFileSync(agents(home));
  assert.deepEqual(second.subarray(0, head.length), head);
  assert.deepEqual(second.subarray(second.length - tail.length), tail);
  assert.match(second.toString('latin1'), /"max_words":120/);
  assert.equal(content(second.toString('utf8')), show(home));
  // The owner's bits are kept; a copy of the profile is never readable by group or others.
  assert.equal(statSync(agents(home)).mode & 0o777, 0o700);
}));

test('runs again without changes: nothing rewritten', () => inHome(home => {
  sync(home);
  const before = statSync(agents(home)), bytes = readFileSync(agents(home));
  const r = sync(home);
  assert.equal(r.stdout, 'humans-md sync: unchanged ~/.agents/AGENTS.md\n');
  const after = statSync(agents(home));
  assert.equal(after.ino, before.ino);
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.deepEqual(readFileSync(agents(home)), bytes);
}));

test('--remove takes the block out and gives back the original bytes, even without a profile', () => inHome(home => {
  mkdirSync(join(home, '.agents'));
  const original = Buffer.from('# My rules\n\nUse tabs.\n');
  writeFileSync(agents(home), original);
  sync(home);
  rmSync(join(home, '.humans/HUMANS.md'));
  assert.equal(sync(home, ['--remove', '--dry-run']).stdout, 'humans-md sync: would remove the copy from ~/.agents/AGENTS.md\n');
  assert.notDeepEqual(readFileSync(agents(home)), original);
  assert.equal(sync(home, ['--remove']).stdout, 'humans-md sync: removed the copy from ~/.agents/AGENTS.md\n');
  assert.deepEqual(readFileSync(agents(home)), original);
  assert.equal(sync(home, ['--remove']).stdout, 'humans-md sync: no copy in ~/.agents/AGENTS.md\n');
  assert.deepEqual(readFileSync(agents(home)), original);
}));

test('--dry-run prints the block and writes nothing', () => inHome(home => {
  const r = sync(home, ['--dry-run']);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.startsWith('humans-md sync: would create ~/.agents/AGENTS.md\n' + BEGIN + '\n'));
  assert.equal(content(r.stdout), show(home));
  assert.equal(existsSync(join(home, '.agents')), false);
}));

test('--to junie, --target, and option errors before any file is touched', () => inHome(home => {
  assert.equal(sync(home, ['--to', 'junie']).stdout, 'humans-md sync: created ~/.junie/AGENTS.md\n');
  assert.ok(existsSync(join(home, '.junie/AGENTS.md')));
  const other = join(home, 'rules/global.md');
  assert.equal(sync(home, ['--target', other]).stdout, 'humans-md sync: created ~/rules/global.md\n');
  assert.match(readFileSync(other, 'utf8'), /run `humans-md sync --target ~\/rules\/global\.md` again/);
  for (const args of [['--to', 'warp'], ['--to'], ['--target', 'rules/x.md'], ['--to', 'junie', '--target', other], ['--target', other, '--to', 'junie'], ['--remove', '--remove'], ['--json'], ['--budget-bytes', '100']]) {
    const r = sync(home, args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /^UNSUPPORTED_ARGUMENT\nhumans-md: [\s\S]*humans-md sync \[file\]/);
    assert.ok(Buffer.byteLength(r.stderr) < 512, 'SPEC § 8: diagnostics under 512 bytes');
  }
  assert.equal(existsSync(agents(home)), false);
  refused(sync(home, ['--target', join(home, 'notes/HUMANS.md')]), 'TARGET_IS_PROFILE', join(home, 'notes/HUMANS.md'), null);
}));

test('a symbolic link, a hard link or a non-regular target is refused', () => inHome(home => {
  mkdirSync(join(home, '.agents'));
  const real = join(home, 'real.md');
  writeFileSync(real, 'mine\n');
  symlinkSync(real, agents(home));
  refused(sync(home), 'TARGET_NOT_REGULAR', real, Buffer.from('mine\n'));
  refused(sync(home, ['--remove']), 'TARGET_NOT_REGULAR', real, Buffer.from('mine\n'));
  rmSync(agents(home));
  symlinkSync(join(home, 'nowhere.md'), agents(home));
  refused(sync(home), 'TARGET_NOT_REGULAR', join(home, 'nowhere.md'), null);
  rmSync(agents(home));
  linkSync(real, agents(home));
  refused(sync(home), 'TARGET_NOT_REGULAR', real, Buffer.from('mine\n'));
  rmSync(agents(home));
  mkdirSync(agents(home));
  refused(sync(home), 'TARGET_NOT_REGULAR');
  rmSync(agents(home), { recursive: true });
  // Opening a FIFO for reading would wait forever: refused before any open.
  if (spawnSync('mkfifo', [agents(home)]).status === 0) refused(sync(home), 'TARGET_NOT_REGULAR');
}));

test('a target inside a git repository is refused, through links too', () => inHome(home => {
  const repo = join(home, 'dotfiles');
  mkdirSync(join(repo, '.git'), { recursive: true });
  refused(sync(home, ['--target', join(repo, 'agents/AGENTS.md')]), 'TARGET_IN_REPOSITORY', join(repo, 'agents/AGENTS.md'), null);
  // ~/.agents is a link into the repository.
  mkdirSync(join(repo, 'agents'));
  symlinkSync(join(repo, 'agents'), join(home, '.agents'));
  refused(sync(home), 'TARGET_IN_REPOSITORY', join(repo, 'agents/AGENTS.md'), null);
  // A worktree has a .git file, not a directory.
  const worktree = join(home, 'wt');
  mkdirSync(worktree);
  writeFileSync(join(worktree, '.git'), 'gitdir: /elsewhere\n');
  refused(sync(home, ['--target', join(worktree, 'AGENTS.md')]), 'TARGET_IN_REPOSITORY', join(worktree, 'AGENTS.md'), null);
}));

test('duplicated, unpaired or edited markers are refused, not guessed', () => inHome(home => {
  mkdirSync(join(home, '.agents'));
  for (const text of [
    `${BEGIN}\nold\n${END}\n${BEGIN}\nold\n${END}\n`,
    `mine\n${BEGIN}\nold\n`,
    `mine\n${END}\n`,
    `${END}\nold\n${BEGIN}\n`,
    `${BEGIN}\nold\n<!-- humans-md:end edited -->\n`,
    `<!-- humans-md:begin edited -->\nold\n${END}\n`,
    `  ${BEGIN}\nold\n${END}\n`,
  ]) {
    writeFileSync(agents(home), text);
    refused(sync(home), 'TARGET_MARKERS_INVALID', agents(home), Buffer.from(text));
    refused(sync(home, ['--remove']), 'TARGET_MARKERS_INVALID', agents(home), Buffer.from(text));
  }
}));

test('a missing, invalid or oversized profile writes nothing and exits 1', () => inHome(home => {
  mkdirSync(join(home, '.agents'));
  writeFileSync(agents(home), 'mine\n');
  const profile = join(home, '.humans/HUMANS.md');
  for (const [text, code] of [
    [null, 'PROFILE_UNAVAILABLE'],
    [fixture.replace('lead_with: tldr', 'lead_with: [tldr'), 'PROFILE_INVALID'],
    [fixture.replace('Invented profile for tests.', 'Run rm -rf now. ' + 'x'.repeat(300)), 'PROFILE_INVALID'],
    [fixture.replace('humans: "0.3"', 'humans: "9.9"'), 'UNSUPPORTED_VERSION'],
  ]) {
    if (text === null) rmSync(profile, { force: true }); else writeFileSync(profile, text);
    const r = sync(home);
    assert.equal(r.status, 1, code + r.stdout);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, `${code}\nhumans-md sync: no copy written; run humans-md check.\n`, code);
    assert.equal(readFileSync(agents(home), 'utf8'), 'mine\n');
  }
}));

test('a target over 1 MiB is refused', () => inHome(home => {
  mkdirSync(join(home, '.agents'));
  const big = Buffer.alloc(1_048_577, 0x61);
  writeFileSync(agents(home), big);
  refused(sync(home), 'TARGET_TOO_LARGE', agents(home), big);
}));

test('with HOME empty or relative, sync writes and removes nothing, not even in the current folder', () => inHome(home => {
  const cwd = join(home, 'cwd');
  mkdirSync(join(cwd, '.agents'), { recursive: true });
  writeFileSync(join(cwd, '.agents/AGENTS.md'), 'mine\n');
  for (const value of ['', 'rel', '.']) {
    for (const args of [[], ['--remove'], ['--to', 'junie'], ['--target', '~/x.md'], ['--target', join(home, 'x.md')]]) {
      refused(sync(value, args, { cwd }), 'HOME_UNAVAILABLE', join(cwd, '.agents/AGENTS.md'), Buffer.from('mine\n'));
    }
  }
  assert.deepEqual(readdirSync(cwd).sort(), ['.agents']);
  assert.deepEqual(readdirSync(join(cwd, '.agents')), ['AGENTS.md']);
  assert.equal(existsSync(join(home, 'x.md')), false);
}));

test('a home tracked by a common dotfiles setup is refused: bare repository, yadm, GIT_DIR', () => inHome(home => {
  /** A git folder as `git init --bare` leaves it, with this config. Git itself is never run. */
  const gitDir = (dir, config) => {
    mkdirSync(join(home, dir, 'objects'), { recursive: true });
    writeFileSync(join(home, dir, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(join(home, dir, 'config'), `[core]\n\trepositoryformatversion = 0\n${config}`);
  };
  const bare = '\tbare = true\n';
  for (const [dir, config] of [['.dotfiles', bare], ['.cfg', bare], ['.local/share/yadm/repo.git', `\tbare = false\n\tworktree = ${home}\n`], ['.config/yadm/repo.git', `\tbare = false\n\tworktree = "${home}/"\n`]]) {
    gitDir(dir, config);
    refused(sync(home), 'TARGET_IN_REPOSITORY', agents(home), null);
    refused(sync(home, ['--to', 'junie']), 'TARGET_IN_REPOSITORY', join(home, '.junie/AGENTS.md'), null);
    rmSync(join(home, dir.split('/')[0]), { recursive: true });
  }
  // GIT_DIR or GIT_WORK_TREE in the environment: git may track any folder.
  for (const name of ['GIT_DIR', 'GIT_WORK_TREE']) refused(sync(home, [], { env: { [name]: join(home, '.x') } }), 'TARGET_IN_REPOSITORY', agents(home), null);
  // Not a dotfiles work tree: a plain checkout in ~/.dotfiles (its .git is inside it), a bare
  // repository whose work tree is elsewhere, a config without HEAD.
  mkdirSync(join(home, '.dotfiles/.git'), { recursive: true });
  gitDir('.cfg', '\tbare = false\n\tworktree = /elsewhere\n');
  mkdirSync(join(home, '.local/share/yadm/repo.git'), { recursive: true });
  writeFileSync(join(home, '.local/share/yadm/repo.git/config'), bare);
  assert.equal(sync(home).stdout, 'humans-md sync: created ~/.agents/AGENTS.md\n');
  // A target outside that home is not in its work tree.
  rmSync(join(home, '.dotfiles'), { recursive: true });
  gitDir('.dotfiles', bare);
  const outside = mkdtempSync(join(tmpdir(), 'humans-md-sync-out-'));
  try { assert.equal(sync(home, ['--target', join(outside, 'AGENTS.md')]).status, 0); } finally { rmSync(outside, { recursive: true, force: true }); }
}));

/**
 * Run sync with a preload that patches node:fs in the child process: right after the temporary file
 * is written (fsync), `race` edits or creates the target, or makes the rename fail; or, with
 * `collide`, someone else's file already has the temporary file's name.
 */
const syncRacing = (home, race) => inTemp(dir => {
  const preload = join(dir, 'race.mjs');
  writeFileSync(preload, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const { fsyncSync, openSync, renameSync } = fs, target = ${JSON.stringify(agents(home))}, race = ${JSON.stringify(race)};
fs.openSync = (path, ...rest) => {
  if (race === 'collide' && String(path).endsWith('.tmp')) { fs.writeFileSync(path, 'Theirs.\\n'); fs.writeFileSync(target + '.theirs', String(path)); }
  return openSync(path, ...rest);
};
fs.fsyncSync = fd => {
  fsyncSync(fd);
  if (race === 'edit') fs.appendFileSync(target, 'Edited meanwhile.\\n');
  if (race === 'create') fs.writeFileSync(target, 'Created meanwhile.\\n');
};
fs.renameSync = (from, to) => { if (race === 'rename') throw Object.assign(new Error('EIO'), { code: 'EIO' }); renameSync(from, to); };
syncBuiltinESMExports();
`);
  return sync(home, [], { node: ['--import', pathToFileURL(preload).href] });
});
const inTemp = fn => { const dir = mkdtempSync(join(tmpdir(), 'humans-md-race-')); try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };

test('a target changed or created while sync runs is not replaced, and no temporary file is left', () => inHome(home => {
  mkdirSync(join(home, '.agents'));
  writeFileSync(agents(home), '# Mine\n');
  refused(syncRacing(home, 'edit'), 'TARGET_UNAVAILABLE');
  assert.equal(readFileSync(agents(home), 'utf8'), '# Mine\nEdited meanwhile.\n');
  assert.deepEqual(readdirSync(join(home, '.agents')), ['AGENTS.md']);
  rmSync(agents(home));
  refused(syncRacing(home, 'create'), 'TARGET_UNAVAILABLE');
  assert.equal(readFileSync(agents(home), 'utf8'), 'Created meanwhile.\n');
  assert.deepEqual(readdirSync(join(home, '.agents')), ['AGENTS.md']);
}));

test('a failed rename leaves the target as it was and removes the temporary file, never someone else\'s', () => inHome(home => {
  mkdirSync(join(home, '.agents'));
  writeFileSync(agents(home), '# Mine\n');
  refused(syncRacing(home, 'rename'), 'TARGET_UNAVAILABLE', agents(home), Buffer.from('# Mine\n'));
  assert.deepEqual(readdirSync(join(home, '.agents')), ['AGENTS.md']);
  // A file that already has the temporary name is someone else's: refused, and left alone.
  refused(syncRacing(home, 'collide'), 'TARGET_UNAVAILABLE', agents(home), Buffer.from('# Mine\n'));
  const theirs = readFileSync(agents(home) + '.theirs', 'utf8');
  assert.equal(readFileSync(theirs, 'utf8'), 'Theirs.\n');
  rmSync(theirs); rmSync(agents(home) + '.theirs');
  // The preload itself works: without a race, sync writes.
  assert.equal(syncRacing(home, 'none').status, 0);
  assert.match(readFileSync(agents(home), 'utf8'), /^# Mine\n\n<!-- humans-md:begin -->/);
}));
