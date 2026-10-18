// Executable vectors shared with the workshop; test-only Node module.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { regressions } from './regressions.mjs';
/** Read a JSON fixture relative to the supplied root; read and syntax errors propagate. */
export const json = (root, file) => JSON.parse(readFileSync(join(root, file), 'utf8'));
/**
 * Collect materialized byte recipes, projection inputs, Markdown fixtures and regression cases.
 * Projection diagnostics are adapted separately for reader and strict-writer expectations.
 */
export function parserCases(root) {
  const bytes = json(root, 'tests/bytes.json').cases.map(c => ({ ...c, source: Buffer.concat(c.segments.flatMap(s => Array.from({ length: s.repeat ?? 1 }, () => s.hex !== undefined ? Buffer.from(s.hex, 'hex') : Buffer.from(s.text)))) }));
  const projections = json(root, 'tests/projection.json').cases.map(c => ({
    ...c, source: Buffer.from(c.source),
    read_diagnostics: c.diagnostics ?? [],
    // Projection diagnostics describe reading. A strict writer additionally
    // rejects reader-tolerated unknown fields/enums as PROFILE_INVALID, unless
    // the case states its own writer diagnostics (a readable previous version).
    write_diagnostics: c.write_diagnostics ?? c.diagnostics ?? (c.writer_valid ? [] : ['PROFILE_INVALID']),
  }));
  const files = ['examples', 'tests/valid', 'tests/invalid', 'tests/schema-valid-but-withheld'].flatMap(dir => readdirSync(join(root,dir)).filter(f => f.endsWith('.md')).map(filename => ({ id: `${dir}/${filename}`, filename, source: readFileSync(join(root,dir,filename)), writer_valid: dir !== 'tests/invalid' })));
  return [...bytes, ...projections, ...files, ...regressions];
}
/** Derive parser mode, profile kind and expected repository id from a case filename. */
export const optionsFor = (c, mode) => ({ mode, kind: c.filename === 'HUMANS.md' ? 'me' : 'repo', expectedId: c.filename === 'HUMANS.md' ? undefined : c.filename.replace(/\.md$/, '') });
/**
 * Run each shared case in read and write modes, checking declared validity and diagnostics,
 * the diagnostic size bound and the health-choice assertion; optionally compare complete parser results.
 * Return the number of case/mode checks.
 */
export function assertParsers(root, parse, reference) {
  let count = 0;
  for (const c of parserCases(root)) for (const mode of ['read','write']) {
    const opts = optionsFor(c, mode), got = parse(c.source, opts);
    if (mode === 'write') assert.equal(!!got.profile, c.writer_valid, `${c.id} strict writer`);
    if (mode === 'read' && c.reader_valid !== undefined) assert.equal(!!got.profile, c.reader_valid, `${c.id} reader validity`);
    if (c.expect?.status !== undefined && mode === 'read' && c.trusted_audience === 'owner') assert.equal(!!got.profile, c.expect.status !== 'none', `${c.id} reader`);
    assert.ok(Buffer.byteLength(JSON.stringify(got.issues)) <= 512, `${c.id} diagnostics`);
    const diagnostics = c[`${mode}_diagnostics`];
    if (diagnostics !== undefined) assert.deepEqual(got.issues.map(i => i.message), diagnostics, `${c.id} ${mode} diagnostics`);
    if (reference) assert.deepEqual(JSON.parse(JSON.stringify(got)), JSON.parse(JSON.stringify(reference(c.source, opts))), `${c.id} differential ${mode}`);
    if (c.id.endsWith('health-choice')) {
      assert.equal(got.profile.notes, 'I have ADHD.'); assert.deepEqual(got.withheld, []);
    }
    count++;
  }
  return count;
}
/** Collect inline group edge cases and file-backed group fixtures, loading non-null member paths. */
export function groupCases(root, load) {
  return [...json(root,'tests/group-edge-cases.json').cases, ...readdirSync(join(root,'tests/group')).filter(f => f.endsWith('.json')).map(f => {
    const c = json(root,`tests/group/${f}`);
    return { ...c, id: f, profiles: c.members.map(p => p === null ? null : load(join(root,'tests/group',p))) };
  })];
}
/**
 * Check exact expected output and its schema for original and reversed member lists,
 * optionally comparing a reference merge; return the number of case/order checks.
 */
export function assertGroups(root, merge, load, validate, reference) {
  let count = 0;
  for (const c of groupCases(root,load)) {
    const profiles = c.profiles ?? c.members;
    const options = { today: c.today };
    for (const key of ['state', 'activeStates']) if (Object.hasOwn(c, key)) options[key] = c[key];
    for (const list of [profiles, [...profiles].reverse()]) {
      const got = merge(list, options);
      assert.deepEqual(got, c.expect, c.id);
      assert.equal(validate(got), true, `${c.id}: output schema ${JSON.stringify(validate.errors)}`);
      if (reference) assert.deepEqual(got, reference(list, options), `${c.id}: differential merge`);
      count++;
    }
  }
  return count;
}
