import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parseProfile, loadProfile } from './validate.mjs';
import { merge } from './merge.mjs';
import { specDir, readJson, withholdReason } from './lib.mjs';
import { assertParsers, assertGroups, parserCases, optionsFor } from './conformance.mjs';
import { assertRejectedArguments } from './cli-regressions.mjs';
import { unsafeUnicodePattern } from './unicode17.mjs';
import { yamlData } from './yaml-data.mjs';
import * as yaml from 'yaml';
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
ajv.addSchema(readJson('schema/humans.schema.json'));
const group = ajv.compile(readJson('schema/humans-group.schema.json'));
test('shared parser vectors', () => console.log(`parser outcomes: ${assertParsers(specDir,parseProfile)}`));
test('visibility public is read as anyone_with_file only in a 0.2 profile', () => {
  const body = 'id: sample\nname: Example\nupdated: "2026-10-13"\nvisibility: public\n---\n';
  assert.equal(parseProfile(`---\nhumans: "0.2"\n${body}`).profile.visibility, 'anyone_with_file');
  assert.equal(parseProfile(`---\nhumans: "0.2"\n${body}`, { mode: 'write' }).issues[0].message, 'UNSUPPORTED_VERSION');
  for (const mode of ['read', 'write']) assert.deepEqual(parseProfile(`---\nhumans: "0.3"\n${body}`, { mode }).issues.map(i => i.message), ['PROFILE_INVALID']);
  // No other value is mapped, and an unknown 0.2 visibility still makes the profile absent.
  assert.equal(parseProfile(`---\nhumans: "0.2"\n${body.replace('public', 'external')}`).profile, undefined);
  assert.equal(parseProfile(`---\nhumans: "0.3"\n${body.replace('public', 'anyone_with_file')}`, { mode: 'write' }).profile.visibility, 'anyone_with_file');
});
test('instruction sentences are never withheld by the baseline heuristic', () => {
  let count = 0;
  for (const sentences of Object.values(readJson('schema/instructions.json').languages)) {
    for (const [field, entry] of Object.entries(sentences)) for (const sentence of typeof entry === 'string' ? [entry] : Object.values(entry)) {
      assert.equal(withholdReason(sentence), null, `${field}: ${sentence}`);
      count++;
    }
  }
  console.log(`instruction sentences checked: ${count}`);
});
test('read preferences match the expected owner projections', () => {
  // The reference tools have no renderer; this compares the preference part a renderer would copy.
  const keys = ['languages', 'reading', 'deciding', 'interrupting', 'avoid'];
  /** Copy projected preference keys, dropping the inactive when_focused and any block it leaves empty. */
  const preferences = profile => {
    const out = {};
    for (const k of keys) if (profile[k] !== undefined) out[k] = JSON.parse(JSON.stringify(profile[k]));
    if (out.interrupting) { delete out.interrupting.when_focused; if (!Object.keys(out.interrupting).length) delete out.interrupting; }
    return out;
  };
  let count = 0;
  for (const c of readJson('tests/projection.json').cases) {
    if (c.trusted_audience !== 'owner' || c.expect.status === 'none') continue;
    const got = parseProfile(Buffer.from(c.source), optionsFor(c, 'read'));
    assert.deepEqual(preferences(got.profile), preferences(c.expect.profile), c.id);
    count++;
  }
  console.log(`projected preference comparisons: ${count}`);
});
for (const c of parserCases(specDir).filter(c => c.id.startsWith('version-'))) for (const mode of ['read', 'write']) {
  test(`${c.id} ${mode}: exact version diagnostics for text and bytes`, () => {
    for (const source of [c.source, Buffer.from(c.source)]) {
      const got = parseProfile(source, optionsFor(c, mode)), expected = c[`${mode}_diagnostics`];
      assert.deepEqual(got.issues, expected.map(message => ({ path: '$', message, severity: 'error' })));
      assert.deepEqual(got.withheld, []);
      if (!expected.length) {
        assert.equal(got.profile.humans, /humans: "([^"]*)"/.exec(c.source)[1]);
        assert.equal(got.profile.notes, 'I have ADHD.');
      } else assert.equal(got.profile, undefined);
    }
  });
}
test('byte, YAML and body invalidity precedes unsupported version diagnostics', () => {
  const head = '---\nhumans: "0.4"\nid: sample\nname: Example\nupdated: "2026-10-13"\n';
  const invalidSources = [
    Buffer.concat([Buffer.from(`${head}---\n`), Buffer.from([0xff])]),
    `${head}unknown: "\\uD800"\n---\n`,
    `${head}unknown: {a: one, "\\u0061": two}\n---\n`,
    `${head}unknown: &alias value\n---\n`,
    `${head}unknown: [broken\n---\n`,
    `${head}#${'x'.repeat(20480)}\n---\n`,
    `${head}---\n${'x'.repeat(4097)}`,
  ];
  for (const mode of ['read', 'write']) {
    for (const source of invalidSources) {
      assert.deepEqual(parseProfile(source, { mode }), { withheld: [], issues: [{ path: '$', message: 'PROFILE_INVALID', severity: 'error' }] });
    }
    assert.equal(parseProfile(`${head}---\nbody`, { mode, kind: 'me' }).issues[0].message, 'PROFILE_INVALID');
    assert.equal(parseProfile(`${head}unknown: harmless\n---\n`, { mode }).issues[0].message, 'UNSUPPORTED_VERSION');
  }
});
test('shared merge vectors and schemas, both permutations', () => console.log(`merge outcomes: ${assertGroups(specDir,merge,p => loadProfile(p).profile ?? null,group)}`));
test('real bounded file entrances use original bytes', () => {
  const dir = mkdtempSync(join(tmpdir(),'humans-bytes-'));
  try {
    for (const c of parserCases(specDir).filter(c => !c.stringOnly)) {
      const file = join(dir,c.filename); writeFileSync(file,c.source);
      assert.equal(!!loadProfile(file,'write').profile,c.writer_valid,c.id);
    }
    const file = join(dir,'HUMANS.md');
    writeFileSync(file,Buffer.alloc(2 ** 20, 0x61));
    assert.equal(loadProfile(file).profile,undefined);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('pinned Unicode 17 integrity and boundaries are independent of host ICU', () => {
  assert.equal(createHash('sha256').update(readFileSync(new URL('./unicode17.mjs',import.meta.url))).digest('hex'), '9c73156f6e0f3fc2ae6adf612df8160b6f25a6cbba516dddeb81dba3b08e03a6');
  const pinned = new RegExp(unsafeUnicodePattern,'u');
  const safe = [0x20, 0x21, 0x7e, 0xa1, 0x377, 0x37a, 0xfffd, 0x1e6c0, 0x1e6de, 0x1e6e0, 0x1faea];
  const unsafe = [0, 0x1f, 0x7f, 0xa0, 0x378, 0x379, 0x61c, 0xd800, 0xdfff, 0xe000, 0xfffe, 0x1e6bf, 0x1e6df, 0x10ffff];
  const base = '---\nhumans: "0.3"\nid: sample\nupdated: "2026-10-13"\n';
  for (const [points, bad] of [[safe,false],[unsafe,true]]) for (const cp of points) {
    const char = String.fromCodePoint(cp);
    assert.equal(pinned.test(char), bad, `U+${cp.toString(16)}`);
    // Tilde is category-safe but separately excluded by plain-text syntax.
    assert.equal(!!parseProfile(`${base}name: "A${char}"\n---\n`).profile, !(bad || cp === 0x7e), `parser U+${cp.toString(16)}`);
  }
});

test('reference CLI rejects unsupported flags before file IO', () => {
  assertRejectedArguments(new URL('./validate.mjs',import.meta.url), []);
  assertRejectedArguments(new URL('./merge.mjs',import.meta.url), []);
});

test('merge rejects own selectors by presence before touching profiles or option values', () => {
  const profiles = new Proxy([], { /** Fail on any profile property access so selector rejection order is observable. */ get() { assert.fail('profiles accessed before rejection'); } });
  for (const key of ['state', 'activeStates']) {
    for (const value of [undefined, null, '', [], {}, false, 'PAYLOAD_MUST_NOT_APPEAR']) {
      assert.throws(() => merge(profiles, { today: '2026-10-14', [key]: value }), { message: 'UNSUPPORTED_ARGUMENT' });
    }
    const options = Object.defineProperty({}, key, { /** Fail if selector rejection reads the selector value. */ get() { assert.fail('selector value accessed'); } });
    Object.defineProperty(options, 'today', { /** Fail if today is read before selector rejection. */ get() { assert.fail('today accessed before rejection'); } });
    assert.throws(() => merge(profiles, options), { message: 'UNSUPPORTED_ARGUMENT' });
  }
  const options = Object.create({ state: 'inactive', activeStates: ['inactive'] });
  options.today = '2026-10-14';
  assert.deepEqual(merge([], options), { humans_group: '0.3', coverage: { with_profile: 0, total: 0 }, conflicts: [] });
});

test('merge CLI rejects case selectors before member file IO and emits no normal result', () => {
  const dir = mkdtempSync(join(tmpdir(), 'humans-merge-selectors-'));
  try {
    const file = join(dir, 'case.json'), target = join(dir, 'PAYLOAD_MUST_NOT_APPEAR.md');
    const trace = join(dir, 'io'), preload = join(dir, 'preload.mjs');
    writeFileSync(target, 'PAYLOAD_MUST_NOT_BE_READ');
    writeFileSync(preload, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
for (const method of ['openSync', 'readFileSync']) {
  const original = fs[method];
  fs[method] = function(path, ...args) {
    if (path === ${JSON.stringify(target)}) { fs.writeFileSync(${JSON.stringify(trace)}, method); throw Error('UNEXPECTED_FILE_IO'); }
    return original.call(this, path, ...args);
  };
}
syncBuiltinESMExports();
`);
    /**
     * Run the merge CLI on the current case fixture with the filesystem watcher preloaded
     * and a five-second timeout; return the subprocess result.
     */
    const run = () => spawnSync(process.execPath, ['--import', preload, fileURLToPath(new URL('./merge.mjs', import.meta.url)), file], { encoding: 'utf8', timeout: 5000 });
    for (const key of ['state', 'activeStates']) for (const value of [null, '', [], {}, false, 'PAYLOAD_MUST_NOT_APPEAR']) {
      writeFileSync(file, JSON.stringify({ members: ['PAYLOAD_MUST_NOT_APPEAR.md'], today: '2026-10-14', [key]: value }));
      const r = run();
      assert.equal(r.status, 2, r.stderr);
      assert.equal(r.stdout, ''); assert.equal(r.stderr, 'UNSUPPORTED_ARGUMENT\n');
      assert.equal(existsSync(trace), false, `${key}: member IO preceded rejection`);
    }
    // The same fixture without a selector reaches the watched member entrance.
    writeFileSync(file, JSON.stringify({ members: ['PAYLOAD_MUST_NOT_APPEAR.md'], today: '2026-10-14', expect: { humans_group: '0.3', coverage: { with_profile: 0, total: 1 }, conflicts: [] } }));
    assert.equal(run().status, 0);
    assert.equal(existsSync(trace), true, 'control must exercise member IO');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('expect-invalid distinguishes unavailable files from malformed bytes through the real CLI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'humans-expect-invalid-'));
  try {
    const file = join(dir, 'HUMANS.md'), unreadable = join(dir, 'unreadable-PAYLOAD.md'), preload = join(dir, 'preload.mjs');
    const cli = fileURLToPath(new URL('./validate.mjs', import.meta.url));
    writeFileSync(unreadable, 'PAYLOAD_MUST_NOT_APPEAR');
    // Deterministic EACCES even when the test runner has elevated filesystem privileges.
    writeFileSync(preload, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const open = fs.openSync;
fs.openSync = function(path, ...args) {
  if (path === ${JSON.stringify(unreadable)}) throw Object.assign(Error('PAYLOAD_MUST_NOT_APPEAR'), { code: 'EACCES' });
  return open.call(this, path, ...args);
};
syncBuiltinESMExports();
`);
    /**
     * Run the validation CLI with the simulated EACCES preload and supplied arguments,
     * using a five-second timeout; return the subprocess result.
     */
    const run = (...args) => spawnSync(process.execPath, ['--import', preload, cli, ...args], { encoding: 'utf8', timeout: 5000 });
    for (const target of [join(dir, 'missing-PAYLOAD.md'), dir, unreadable]) for (const flags of [[], ['--expect-invalid'], ['--draft', '--expect-invalid']]) {
      const r = run(target, ...flags);
      assert.equal(r.status, 1); assert.equal(r.stderr, '');
      assert.deepEqual(JSON.parse(r.stdout), { ok: false, valid: false, issues: [{ path: '$', message: 'PROFILE_UNAVAILABLE', severity: 'error' }] });
    }
    for (const source of [Buffer.from('PAYLOAD_MUST_NOT_APPEAR'), Buffer.alloc(24590, 0x61), Buffer.from([0xff])]) {
      writeFileSync(file, source);
      const result = loadProfile(file, 'write');
      assert.deepEqual(result.issues, [{ path: '$', message: 'PROFILE_INVALID', severity: 'error' }]);
      const r = run('--expect-invalid', file);
      assert.equal(r.status, 0); assert.equal(r.stderr, '');
      assert.deepEqual(JSON.parse(r.stdout), { ok: true, valid: false, issues: result.issues });
      assert.equal(run(file).status, 1);
      const mixed = run('--expect-invalid', file, unreadable);
      assert.equal(mixed.status, 1);
      assert.deepEqual(mixed.stdout.trim().split('\n').map(line => JSON.parse(line).ok), [true, false]);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('reference CLI retains legitimate draft and expect-invalid flags', () => {
  const dir = mkdtempSync(join(tmpdir(),'humans-valid-args-'));
  try {
    const file = join(dir,'draft.md');
    writeFileSync(file,'---\nhumans: "0.3"\nid: sample\nname: Example\nupdated: "2026-10-13"\nnotes: "I have ADHD."\n---\n');
    /** Run the validation CLI on the draft fixture with the supplied flags and capture its result. */
    const run = (...args) => spawnSync(process.execPath,[fileURLToPath(new URL('./validate.mjs',import.meta.url)),file,...args],{encoding:'utf8'});
    assert.equal(run().status,1);
    const invalid = run('--expect-invalid'); assert.equal(invalid.status,0); assert.equal(JSON.parse(invalid.stdout).valid,false);
    const draft = run('--draft'); assert.equal(draft.status,0); assert.equal(draft.stderr,'');
    assert.deepEqual(JSON.parse(draft.stdout),{ok:true,valid:true,issues:[{path:'$',message:'DRAFT_FILENAME_UNCHECKED',severity:'warning'}]});
    assert.equal(run('--draft','--expect-invalid').status,1);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('iterative composition preserves ordinary YAML semantics and syntax rejection', () => {
  const leaves = ['null', 'true', '42', '"😀"', '{a: 1, b: null}', '[a: 1, b: 2]', '{__proto__: 1}', '{a: 1, "\\u0061": 2}', '[0,,1]', '{a: 1 b: 2}', '[0, 1', '"\\uZZZZ"'];
  const wrap = [s => `x: ${s}\n`, s => `x: [${s}]\n`, s => `x:\n  - ${s}\n`, s => `x: {child: ${s}}\n`, s => `x:\n  child: ${s}\n`, s => `x: [a: ${s}]\n`];
  for (const leaf of leaves) for (const outer of wrap) for (const inner of wrap) {
    const source = outer(`{nested: ${leaf}}`) + inner('null').replace(/^x:/,'y:');
    const doc = yaml.parseDocument(source,{schema:'core',uniqueKeys:true,strict:true,prettyErrors:false});
    if (doc.errors.length || doc.warnings.length) assert.throws(() => yamlData(source,yaml),source);
    else assert.deepEqual(JSON.parse(JSON.stringify(yamlData(source,yaml))),doc.toJS(),source);
  }
});

test('draft filename exemption is validation-only', () => {
  const c = parserCases(specDir).find(c => c.id === 'minimal');
  assert.equal(parseProfile(c.source,{mode:'read',draft:true}).profile,undefined);
  const result = parseProfile(c.source,{mode:'write',draft:true,expectedId:'mismatch'});
  assert.ok(result.profile); assert.equal(result.issues[0].message,'DRAFT_FILENAME_UNCHECKED');
});

test('collection fragments preserve contextual offsets and the implicit-key limit', () => {
  for (const child of [`  child: ${'x'.repeat(1100)}\n`, `  - ${'x'.repeat(1100)}\n`, `  - child: ${'x'.repeat(1100)}\n`]) {
    for (const prefix of ['', `padding: ${'x'.repeat(1100)}\n`]) {
      for (const length of [7, 1024, 1025]) {
        const source = `${prefix}unknown:\n${child}${'k'.repeat(length)}: {length: short}\n`;
        const doc = yaml.parseDocument(source,{schema:'core',uniqueKeys:true,strict:true,prettyErrors:false});
        assert.deepEqual(doc.errors.map(e => e.code),length > 1024 ? ['KEY_OVER_1024_CHARS'] : []);
        assert.deepEqual(doc.warnings,[]);
        if (length > 1024) assert.throws(() => yamlData(source,yaml),/PROFILE_INVALID/);
        else assert.deepEqual(JSON.parse(JSON.stringify(yamlData(source,yaml))),doc.toJS());
      }
    }
  }
});

test('seeded nested YAML corpus matches stock composition at every source offset', () => {
  // Reproduce the independent L2 review corpus, including all 275 former rejects.
  let seed = 0x521ea7;
  /** Advance the shared xorshift seed and return its unsigned value modulo n. */
  const random = n => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) % n; };
  const leaves = [null,true,false,0,-123,4.5,0.000012,'yes','0.2','2026-10-14','😀','a\nb','line\nwith\nfinal\n','quoted " value','backslash \\','null','-.inf','1e999','value : with colon','# text',''];
  const keys = ['a','b','c','__proto__','constructor','toString','a b','x:y','😀','0','true','line\nbreak',''];
  /** Build a seeded synthetic scalar, array or null-prototype object with at most the given depth. */
  function value(depth) {
    if (depth === 0 || random(3) === 0) return leaves[random(leaves.length)];
    if (random(2) === 0) return Array.from({length:random(5)},() => value(depth-1));
    const result = Object.create(null);
    for (let i = 0, n = random(5); i < n; i++) result[keys[random(keys.length)]] = value(depth-1);
    return result;
  }
  let count = 0, oversized = 0;
  for (let i = 0; i < 1800; i++) {
    const data = {unknown:value(1+random(7)),second:value(random(4))};
    for (const opts of [{},{collectionStyle:'flow'},{collectionStyle:'block',indent:4},{singleQuote:true,lineWidth:20}]) {
      const source = yaml.stringify(data,opts);
      if (Buffer.byteLength(source) > 6000) { oversized++; continue; }
      const doc = yaml.parseDocument(source,{schema:'core',uniqueKeys:true,strict:true,prettyErrors:false});
      assert.deepEqual(doc.errors,[]); assert.deepEqual(doc.warnings,[]);
      assert.deepEqual(JSON.parse(JSON.stringify(yamlData(source,yaml))),doc.toJS(),`case ${i} ${JSON.stringify(opts)}`);
      count++;
    }
  }
  assert.equal(count,7197); assert.equal(oversized,3);
  console.log(`stock YAML differential: ${count} matching cases; ${oversized} oversized cases excluded`);
});
