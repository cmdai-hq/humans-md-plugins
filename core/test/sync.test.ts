// `humans-md sync`: block planning and file guards. The public tests (public/test/sync.test.mjs)
// run the same paths through the shipped binary.
import { describe, expect, it } from 'vitest';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BEGIN, END, MAX_TARGET_BYTES, bindingOf, checkFile, findBlock, makeBlock, planSync, rerunCommand, syncFile } from '../src/sync.js';

const RENDERING = 'FRAME\n{"status":"found"}\nOne sentence.\n';
// SHA-256 of the source profile's bytes, as the command line computes it.
const DIGEST = 'ab'.repeat(32);
const block = (rendering = RENDERING, date = '2026-10-17', version = '0.3.0', digest = DIGEST) => makeBlock(rendering, date, version, 'humans-md sync', digest);
// A block as humans-md 0.3.0 to 0.3.2 wrote it: no source digest in its first line.
const UNBOUND = `${BEGIN}\n<!-- Generated copy of your HUMANS.md, written by humans-md 0.3.2 on 2026-10-17. Do not edit it here: edit your HUMANS.md, then run \`humans-md sync\` again. -->\n${RENDERING}${END}\n`;
/** Run with a temporary directory outside any repository, removed afterwards. */
const scratch = (fn: (dir: string) => void) => { const dir = mkdtempSync(join(tmpdir(), 'humans-sync-')); try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };
// Set while git runs a hook, for example: syncFile would refuse every target.
delete process.env.GIT_DIR; delete process.env.GIT_WORK_TREE;
/** Run with HOME (read by os.homedir()) set to `home`, restored afterwards. */
const withHome = (home: string, fn: () => void) => { const saved = process.env.HOME; process.env.HOME = home; try { fn(); } finally { if (saved === undefined) delete process.env.HOME; else process.env.HOME = saved; } };

describe('makeBlock', () => {
  it('wraps the rendering between fixed markers, bound to its source, renderer and day, with the command to run again', () => {
    expect(block()).toBe(`${BEGIN}\n<!-- Generated copy of your HUMANS.md, written by humans-md 0.3.0 on 2026-10-17 from the profile with SHA-256 ${DIGEST}. Do not edit it here: edit your HUMANS.md, then run \`humans-md sync\` again. -->\n${RENDERING}${END}\n`);
  });
  it('refuses a command that could end the comment or the line, a rendering with a marker line, and anything but a SHA-256', () => {
    for (const rerun of ['humans-md sync -->', 'humans-md sync\nx']) expect(() => makeBlock(RENDERING, '2026-10-17', '0.3.0', rerun, DIGEST)).toThrow('UNSUPPORTED_ARGUMENT');
    expect(() => makeBlock(`FRAME\n${END}\n`, '2026-10-17', '0.3.0', 'humans-md sync', DIGEST)).toThrow();
    for (const digest of ['', 'ab', DIGEST.toUpperCase(), DIGEST + 'ab', DIGEST.slice(2) + '--', `${DIGEST.slice(4)}. --`]) expect(() => block(RENDERING, '2026-10-17', '0.3.0', digest), digest).toThrow('UNSUPPORTED_ARGUMENT');
  });
});

describe('bindingOf', () => {
  it('reads the source digest, the renderer version and the day from a block; nothing from an earlier or edited one', () => {
    expect(bindingOf(findBlock(block())!.inner)).toEqual({ version: '0.3.0', date: '2026-10-17', digest: DIGEST });
    expect(bindingOf(findBlock(UNBOUND)!.inner)).toBeUndefined();
    for (const inner of ['', 'edited\n', RENDERING, findBlock(block())!.inner.replace('SHA-256 ab', 'SHA-256 zz'), ' ' + findBlock(block())!.inner]) expect(bindingOf(inner), inner).toBeUndefined();
  });
});

describe('planSync', () => {
  it('creates, appends after a blank line, and replaces only the block', () => {
    expect(planSync(null, block())).toEqual({ action: 'created', text: block() });
    expect(planSync('', block())).toEqual({ action: 'created', text: block() });
    expect(planSync('a\n', block())).toEqual({ action: 'updated', text: `a\n\n${block()}` });
    expect(planSync('a', block())).toEqual({ action: 'updated', text: `a\n\n${block()}` });
    const old = `head\r\n\xff\n${block('FRAME\nold\n')}tail`;
    expect(planSync(old, block())).toEqual({ action: 'updated', text: `head\r\n\xff\n${block()}tail` });
  });
  it('leaves a block alone only when its binding and its rendering are the ones to write', () => {
    expect(planSync(`a\n\n${block()}`, block())).toEqual({ action: 'unchanged' });
    // Another day, another renderer version or another source: the binding is written again (SPEC § 5).
    expect(planSync(`a\n\n${block()}`, block(RENDERING, '2027-01-01'))).toEqual({ action: 'updated', text: `a\n\n${block(RENDERING, '2027-01-01')}` });
    expect(planSync(block(), block(RENDERING, '2026-10-17', '0.3.9')).action).toBe('updated');
    expect(planSync(block(), block(RENDERING, '2026-10-17', '0.3.0', 'cd'.repeat(32))).action).toBe('updated');
    // A block written before bindings, or a first line edited by hand, is replaced.
    expect(planSync(`a\n\n${UNBOUND}b\n`, block())).toEqual({ action: 'updated', text: `a\n\n${block()}b\n` });
    expect(planSync(`${BEGIN}\nedited\n${RENDERING}${END}\n`, block()).action).toBe('updated');
    expect(planSync(`a\n\n${UNBOUND}`, null)).toEqual({ action: 'removed', text: 'a\n' });
  });
  it('removes the block and the blank line it added; nothing to remove is not a change', () => {
    expect(planSync(`a\n\n${block()}`, null)).toEqual({ action: 'removed', text: 'a\n' });
    expect(planSync(`a\n\n${block()}b\n`, null)).toEqual({ action: 'removed', text: 'a\n\nb\n' });
    expect(planSync(block(), null)).toEqual({ action: 'removed', text: '' });
    expect(planSync('a\n', null)).toEqual({ action: 'absent' });
    expect(planSync(null, null)).toEqual({ action: 'absent' });
  });
  it('refuses duplicated, unpaired, reversed or edited markers', () => {
    for (const text of [block() + block(), `${BEGIN}\n`, `${END}\n`, `${END}\n${BEGIN}\n`, `<!-- humans-md:begin v2 -->\n${END}\n`, `${BEGIN}\n<!-- humans-md:end v2 -->\n`, ` ${BEGIN}\n${END}\n`, `${BEGIN}\n<!-- humans-md:note -->\n${END}\n`]) {
      expect(() => planSync(text, block()), JSON.stringify(text)).toThrow('TARGET_MARKERS_INVALID');
      expect(() => planSync(text, null)).toThrow('TARGET_MARKERS_INVALID');
    }
    expect(findBlock('mentions humans-md:begin in prose\n')).toBeUndefined();
  });
});

describe('rerunCommand', () => {
  const home = '/home/sam';
  it('repeats the options, with ~ for the home directory', () => {
    expect(rerunCommand({ guidance: true }, home)).toBe('humans-md sync');
    expect(rerunCommand({ to: 'junie', guidance: false }, home)).toBe('humans-md sync --to junie --no-guidance');
    expect(rerunCommand({ target: '/home/sam/rules/a.md', profile: '/home/sam/p/HUMANS.md', guidance: true }, home)).toBe('humans-md sync ~/p/HUMANS.md --target ~/rules/a.md');
  });
  it('leaves out a path it cannot show safely', () => {
    expect(rerunCommand({ target: '/home/sam/my rules/--> x.md', guidance: true }, home)).toBe('humans-md sync with the same file arguments');
  });
});

describe('checkFile', () => {
  it('accepts only the block that would be written now; otherwise one static code', () => scratch(dir => {
    const target = join(dir, 'AGENTS.md');
    const check = (text: string | null, want = block()) => {
      if (text === null) rmSync(target, { force: true }); else writeFileSync(target, text, 'latin1');
      const before = text === null ? null : statSync(target).mtimeMs;
      const code = checkFile(target, want);
      // Nothing is written, whatever the answer.
      expect(text === null ? readdirSync(dir) : [readFileSync(target, 'latin1'), statSync(target).mtimeMs]).toEqual(text === null ? [] : [text, before]);
      return code;
    };
    expect(check(`mine\r\n\xff\n\n${block()}tail`)).toBeUndefined();
    expect(check(null)).toBe('COPY_MISSING');
    expect(check('mine\n')).toBe('COPY_MISSING');
    expect(check('')).toBe('COPY_MISSING');
    // Written before copies were bound, or the first line edited.
    expect(check(`mine\n\n${UNBOUND}`)).toBe('BINDING_MISSING');
    expect(check(`${BEGIN}\nedited\n${RENDERING}${END}\n`)).toBe('BINDING_MISSING');
    // The source, the renderer or the rendering is not the one bound.
    expect(check(block(), block(RENDERING, '2026-10-17', '0.3.0', 'cd'.repeat(32)))).toBe('BINDING_MISMATCH');
    expect(check(block(), block(RENDERING, '2026-10-17', '0.3.9'))).toBe('BINDING_MISMATCH');
    expect(check(block('FRAME\n{"status":"found"}\nEdited here.\n'))).toBe('BINDING_MISMATCH');
    expect(check(block(), makeBlock(RENDERING, '2026-10-17', '0.3.0', 'humans-md sync --no-guidance', DIGEST))).toBe('BINDING_MISMATCH');
    // Same source and renderer, an earlier or later day.
    expect(check(block(), block(RENDERING, '2026-10-18'))).toBe('BINDING_STALE');
    expect(check(block(RENDERING, '2026-10-19'), block(RENDERING, '2026-10-18'))).toBe('BINDING_STALE');
    // A changed source on another day is a mismatch first.
    expect(check(block(), block(RENDERING, '2026-10-18', '0.3.0', 'cd'.repeat(32)))).toBe('BINDING_MISMATCH');
  }));
  it('refuses what sync refuses to read: ambiguous markers, a link, an oversized file, a relative target', () => scratch(dir => {
    const target = join(dir, 'AGENTS.md');
    writeFileSync(target, block() + block());
    expect(() => checkFile(target, block())).toThrow('TARGET_MARKERS_INVALID');
    writeFileSync(join(dir, 'big.md'), Buffer.alloc(MAX_TARGET_BYTES + 1));
    expect(() => checkFile(join(dir, 'big.md'), block())).toThrow('TARGET_TOO_LARGE');
    mkdirSync(join(dir, 'folder.md'));
    expect(() => checkFile(join(dir, 'folder.md'), block())).toThrow('TARGET_NOT_REGULAR');
    expect(() => checkFile('AGENTS.md', block())).toThrow('TARGET_UNAVAILABLE');
    for (const home of ['', 'rel']) withHome(home, () => expect(() => checkFile(target, block())).toThrow('HOME_UNAVAILABLE'));
  }));
});

describe('syncFile', () => {
  it('writes atomically: no temporary file left, mode kept, then unchanged and removed', () => scratch(dir => {
    const target = join(dir, 'agents/AGENTS.md');
    expect(syncFile(target, block(), true)).toBe('created');
    expect(() => lstatSync(join(dir, 'agents'))).toThrow();
    expect(syncFile(target, block())).toBe('created');
    expect(statSync(target).mode & 0o777).toBe(0o600);
    expect(syncFile(target, block())).toBe('unchanged');
    expect(syncFile(target, null)).toBe('removed');
    expect(readFileSync(target, 'utf8')).toBe('');
    expect(readdirSync(join(dir, 'agents'))).toEqual(['AGENTS.md']);
  }));
  it('refuses a profile as target, a repository and an oversized file', () => scratch(dir => {
    expect(() => syncFile(join(dir, 'Humans.md'), block())).toThrow('TARGET_IS_PROFILE');
    mkdirSync(join(dir, 'repo/.git'), { recursive: true });
    expect(() => syncFile(join(dir, 'repo/deep/AGENTS.md'), block())).toThrow('TARGET_IN_REPOSITORY');
    writeFileSync(join(dir, 'big.md'), Buffer.alloc(MAX_TARGET_BYTES + 1));
    expect(() => syncFile(join(dir, 'big.md'), block())).toThrow('TARGET_TOO_LARGE');
  }));
  it('keeps the owner bits of an existing file, never group or other access', () => scratch(dir => {
    const target = join(dir, 'AGENTS.md');
    writeFileSync(target, 'mine\n');
    chmodSync(target, 0o764);
    expect(syncFile(target, block())).toBe('updated');
    expect(statSync(target).mode & 0o777).toBe(0o700);
  }));
  it('refuses a relative target, and any target while HOME is empty or relative', () => scratch(dir => {
    expect(() => syncFile('agents/AGENTS.md', block())).toThrow('TARGET_UNAVAILABLE');
    for (const home of ['', 'rel']) withHome(home, () => expect(() => syncFile(join(dir, 'AGENTS.md'), block())).toThrow('HOME_UNAVAILABLE'));
    expect(readdirSync(dir)).toEqual([]);
  }));
  it('refuses a home tracked by a bare dotfiles repository or yadm, read without running git', () => scratch(dir => withHome(dir, () => {
    const target = join(dir, '.agents/AGENTS.md');
    const gitDir = (path: string, config: string) => {
      mkdirSync(join(dir, path), { recursive: true });
      writeFileSync(join(dir, path, 'HEAD'), 'ref: refs/heads/main\n');
      writeFileSync(join(dir, path, 'config'), `[core]\n${config}`);
    };
    gitDir('.dotfiles', '\tbare = true\n');
    expect(() => syncFile(target, block())).toThrow('TARGET_IN_REPOSITORY');
    rmSync(join(dir, '.dotfiles'), { recursive: true });
    gitDir('.local/share/yadm/repo.git', `\tbare = false\n\tworktree = ${dir}\n`);
    expect(() => syncFile(target, block())).toThrow('TARGET_IN_REPOSITORY');
    writeFileSync(join(dir, '.local/share/yadm/repo.git/config'), '[core]\n\tbare = false\n\tworktree = /elsewhere\n');
    expect(syncFile(target, block(), true)).toBe('created');
    process.env.GIT_WORK_TREE = dir;
    try { expect(() => syncFile(target, block())).toThrow('TARGET_IN_REPOSITORY'); } finally { delete process.env.GIT_WORK_TREE; }
  })));
});
