// SPDX-License-Identifier: Apache-2.0
// Artifact integrity only: this does not implement or exercise consumers.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dependencyFlag = args.indexOf('--deps-root');
const dependencyRoot = dependencyFlag < 0 ? join(root, 'tools') : resolve(args[dependencyFlag + 1]);
const req = createRequire(join(dependencyRoot, 'package.json'));
const { parseAllDocuments } = req('yaml');
const Ajv = req('ajv/dist/2020.js').default;
const addFormats = req('ajv-formats').default;
/** Read a UTF-8 artifact relative to the specification root; filesystem errors propagate. */
const read = p => readFileSync(join(root, p), 'utf8');
/** Read and parse a specification artifact as JSON; read and syntax errors propagate. */
const json = p => JSON.parse(read(p));
/** Return the SHA-256 hex digest of the supplied bytes or string. */
const hash = b => createHash('sha256').update(b).digest('hex');
/** Recursively list file paths relative to the specification root, in filesystem traversal order. */
function files(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
}
/** Serialize JSON fixture values with sorted object keys, preserving array order. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
/**
 * Extract frontmatter from a positive fixture and assert one YAML document with no parse errors.
 * Return its JS value; schema and byte checks are performed separately.
 */
function frontmatter(text) {
  const match = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)^---(?:\r?\n|$)/m);
  assert(match, 'expected frontmatter in positive fixture');
  const docs = parseAllDocuments(match[1], { schema: 'core', uniqueKeys: true });
  assert.equal(docs.length, 1);
  assert.deepEqual(docs[0].errors, []);
  return docs[0].toJS();
}
for (const p of [...files('schema'), ...files('tests')].filter(p => p.endsWith('.json'))) json(p);
const schemaPaths = files('schema').filter(f => f.endsWith('.schema.json'));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv, ['date', 'uuid']);
for (const p of schemaPaths) ajv.addSchema(json(p));
for (const p of schemaPaths) assert(ajv.getSchema(json(p).$id), p);
const schema = json('schema/humans.schema.json');
const validate = ajv.getSchema(schema.$id);
const project = ajv.getSchema(json('schema/humans-projection.schema.json').$id);
const group = ajv.getSchema(json('schema/humans-group.schema.json').$id);
/** Assert that the supplied schema validator accepts data, reporting its errors with the case name. */
function validWith(check, data, name) {
  assert(check(data), `${name}: ${JSON.stringify(check.errors)}`);
}
const positiveFiles = [...files('examples').filter(f => f.endsWith('.md') && !f.includes('/source/')), ...files('tests/valid')];
for (const p of positiveFiles) validWith(validate, frontmatter(read(p)), p);
const readmeExample = read('README.md').match(/```yaml\n([\s\S]*?)```/)[1];
assert.equal(readmeExample, read('examples/HUMANS.md'), 'copyable README example drift');
validWith(validate, frontmatter(readmeExample), 'README example');
// The compiled HUMANS.md header (SPEC § 10) has one source: the text block in SPEC.md.
const header = read('SPEC.md').match(/```text\n(# HUMANS\.md 0\.3:[^\n]*\n#[^\n]*\n#[^\n]*\n)```/)[1];
assert(read('examples/HUMANS.md').startsWith(`---\n${header}`), 'HUMANS.md example header');
for (const c of json('tests/compilation.json').cases) if (c.required_file_prefix) assert.equal(c.required_file_prefix, `---\n${header}`, c.id);
// The byte counts SPEC § 10 states for the header and the maximal profiles match the text and the byte vectors.
const specText = read('SPEC.md');
const frontmatterLimit = Number(/Frontmatter size is \*\*at most 20 KiB = ([0-9,]+) bytes\*\*/.exec(specText)[1].replaceAll(',', ''));
const stated = /its ([0-9,]+) bytes count toward the ([0-9,]+)-byte limit[\s\S]*?takes ([0-9,]+) bytes without stored variants and ([0-9,]+) bytes with all four/.exec(specText).slice(1).map(n => Number(n.replaceAll(',', '')));
const maximal = id => json('tests/bytes.json').cases.find(c => c.id === id);
assert.deepEqual(stated, [Buffer.byteLength(header), frontmatterLimit, maximal('maximal-me-header-no-variants').frontmatter_bytes, maximal('maximal-me-header-all-variants').frontmatter_bytes], 'SPEC § 10 byte counts');
for (const id of ['maximal-me-header-no-variants', 'maximal-me-header-all-variants']) assert(maximal(id).writer_valid && maximal(id).frontmatter_bytes <= frontmatterLimit, id);
console.log(`PASS schemas: ${schemaPaths.length}; positive profiles: ${positiveFiles.length}; complete README example identical; HUMANS.md header matches SPEC § 10`);

const projections = json('tests/projection.json');
// The two static first lines (SPEC § 6.3) have one source: the text blocks in SPEC.md.
assert.deepEqual([...specText.matchAll(/```text\n(HUMANS\.md [^\n]*)\n```/g)].map(m => m[1]), [projections.frame, projections.frame_non_owner], 'SPEC § 6.3 first lines');
const audiences = ['owner', 'org', 'public', 'none'];
/** Choose the SPEC § 6.3 first line for a vector's trusted audience: the owner line under owner context only. */
const frameFor = audience => audience === 'owner' ? projections.frame : projections.frame_non_owner;
for (const c of projections.cases) {
  validWith(project, c.expect, c.id);
  assert(audiences.includes(c.trusted_audience), `${c.id} trusted_audience`);
  assert.equal(c.expect_text, `${frameFor(c.trusted_audience)}\n${canonical(c.expect)}\n`, c.id);
  assert(Buffer.byteLength(c.expect_text) <= 16384, c.id);
  for (const marker of c.absent_substrings ?? []) assert(!c.expect_text.includes(marker), c.id);
  // A note is served to its owner's agent only, exactly as written; nothing is withheld by content (SPEC § 6.2).
  if (c.trusted_audience !== 'owner') assert(!c.expect.profile || !('notes' in c.expect.profile), `${c.id}: a note served to a reader other than the owner`);
  if (c.expect.profile) assert.deepEqual(c.expect.profile.withheld, [], `${c.id} withheld`);
  if (c.expect.profile?.notes) assert.equal(c.expect.profile.notes, frontmatter(c.source).notes, c.id);
  if (c.writer_valid) {
    const source = frontmatter(c.source);
    validWith(validate, source, c.id);
    if (c.trusted_audience === 'owner' && c.expect.profile) assert.equal(c.expect.profile.notes, source.notes, `${c.id}: the owner's note, as written`);
  }
}
// The same source read by its owner and by someone else shows the rule on one note.
for (const [mine, theirs] of [['agent-directed-note', 'agent-directed-note-org-member'], ['served-to-owner', 'served-to-org-member']]) {
  const [a, b] = [mine, theirs].map(id => projections.cases.find(c => c.id === id));
  assert.equal(a.source, b.source, `${mine} / ${theirs} source`);
  assert.equal(typeof a.expect.profile.notes, 'string', mine);
  const { notes, ...withoutNote } = a.expect.profile;
  assert.deepEqual(b.expect.profile, withoutNote, `${theirs}: same projection without the note`);
}
// Instruction sentences (SPEC § 6.4): exact coverage of projected values, one plain line each.
const instructions = json('schema/instructions.json');
/** List the projected preference fields of SPEC §§ 3.3–3.5 in rendering order, with appendix_depth after technical_depth. */
const guidedFields = ['reading','deciding','interrupting'].flatMap(b => Object.keys(schema.$defs[b].properties).filter(k => k !== 'when_focused').flatMap(k => k === 'technical_depth' ? [`${b}.${k}`, 'reading.appendix_depth'] : [`${b}.${k}`]));
const appendixDepths = json('schema/humans-group.schema.json').properties.reading.properties.appendix_depth.enum;
const sentenceFields = ['languages', ...guidedFields, 'avoid'];
/** Assert that a field's entry holds one plain line per closed value, or one line for a field whose sentence names the projected value. */
function checkSentences(field, entry, label) {
  const [block, name] = field.split('.');
  const node = field === 'languages' || field === 'avoid' ? schema.properties[field] : field === 'reading.appendix_depth' ? { enum: appendixDepths } : schema.$defs[block].properties[name];
  // languages has one sentence that names the field, like max_words, not one per code.
  const values = field === 'languages' ? undefined : node.enum ?? node.items?.enum;
  if (values) assert.deepEqual(Object.keys(entry), values, `${label} ${field} values`);
  else assert.equal(typeof entry, 'string', `${label} ${field}`);
  for (const sentence of values ? Object.values(entry) : [entry]) assert.match(sentence, /^[^\n{}<>`*#|]+\.$/u, `${label} ${field}`);
}
for (const [lang, sentences] of Object.entries(instructions.languages)) {
  assert.deepEqual(Object.keys(sentences).sort(), [...sentenceFields].sort(), `${lang} instruction fields`);
  for (const field of sentenceFields) checkSentences(field, sentences[field], lang);
}
// non_owner (SPEC § 6.4): the guided fields that get no sentence for a reader other than the owner; it holds no sentence of its own.
const nonOwner = instructions.non_owner;
assert.deepEqual(Object.keys(nonOwner), ['description', 'omitted'], 'non_owner members');
assert(nonOwner.omitted.length > 0 && new Set(nonOwner.omitted).size === nonOwner.omitted.length, 'non_owner omitted entries are distinct');
for (const field of nonOwner.omitted) assert(guidedFields.includes(field), `non_owner omitted ${field} is a guided field`);
/**
 * Render the SPEC § 6.4 lines for a projected profile or group in the given language, each followed by LF.
 * For a reader other than the owner, skip the non_owner omitted fields; every other sentence is the owner one.
 */
function guidance(projected, lang, forOwner = true) {
  if (!projected || !lang) return '';
  const sentences = instructions.languages[lang], lines = [];
  if (projected.languages) lines.push(sentences.languages);
  for (const field of guidedFields) {
    const [block, name] = field.split('.'), value = projected[block]?.[name];
    if (value === undefined || (!forOwner && nonOwner.omitted.includes(field))) continue;
    const entry = sentences[field];
    if (typeof entry === 'string') lines.push(entry);
    else for (const v of [value].flat()) lines.push(entry[v]);
  }
  for (const v of projected.avoid ?? []) lines.push(sentences.avoid[v]);
  return lines.map(line => `${line}\n`).join('');
}
const omissionsShown = new Set();
for (const c of json('tests/render-budget.json').cases) {
  validWith(project, c.projection, c.id);
  // A case without trusted_audience is rendered for its owner.
  const audience = c.trusted_audience ?? 'owner';
  assert(audiences.includes(audience), `${c.id} trusted_audience`);
  // A rendering for a reader other than the owner holds no note (SPEC § 6.2).
  if (audience !== 'owner') assert(!('notes' in (c.projection.profile ?? {})), `${c.id}: a note served to a reader other than the owner`);
  const rendered = `${frameFor(audience)}\n${canonical(c.projection)}\n${guidance(c.projection.profile, c.guidance, audience === 'owner')}`;
  if (c.expect_text) {
    assert.equal(rendered, c.expect_text);
    assert.equal(Buffer.byteLength(rendered), c.adapter_budget_bytes);
    // An omission is shown when the exact text of a non-owner rendering holds the value in its JSON line and not its owner sentence.
    if (audience !== 'owner' && c.guidance) for (const field of nonOwner.omitted) {
      const [block, name] = field.split('.'), value = c.projection.profile?.[block]?.[name];
      if (value === undefined) continue;
      const entry = instructions.languages[c.guidance][field];
      assert(!c.expect_text.includes(typeof entry === 'string' ? entry : entry[value]), `${c.id} ${field}`);
      omissionsShown.add(field);
    }
  } else assert.equal(Buffer.byteLength(rendered), c.adapter_budget_bytes + 1);
}
assert.deepEqual([...omissionsShown].sort(), [...nonOwner.omitted].sort(), 'render-budget vectors show every non_owner omission');
console.log(`PASS projection expectations: ${projections.cases.length}, ${projections.cases.filter(c => c.trusted_audience !== 'owner').length} for a reader other than the owner; exact JSON/text under the first line of each trusted audience and render-budget vectors; instruction sentences cover every projected value (${Object.keys(instructions.languages).join(', ')}); non_owner leaves ${nonOwner.omitted.length} fields without a sentence (no renderer executed)`);

const groups = [...files('tests/group').filter(f => f.endsWith('.json')).map(json), ...json('tests/group-edge-cases.json').cases];
for (const c of groups) {
  validWith(group, c.expect, c.id ?? c.description);
  assert(c.expect.coverage.with_profile <= c.expect.coverage.total);
  assert((c.expect.coverage.stale ?? 0) <= c.expect.coverage.with_profile);
  for (const conflict of c.expect.conflicts) {
    if (conflict.values) assert(conflict.values.reduce((n, x) => n + x.count, 0) >= 3);
  }
  for (const member of c.members) {
    if (member === null) continue;
    if (typeof member === 'string') assert(existsSync(resolve(root, 'tests/group', member)));
    else validWith(validate, member, c.id);
  }
}
const groupInputs = json('tests/group-consumption.json').cases;
for (const c of groupInputs) {
  validWith(group, c.expect, c.id);
  assert.equal(c.expect.coverage.total, c.members.length);
}
console.log(`PASS expected group shapes: ${groups.length}; group consumption shapes: ${groupInputs.length} (no merge implementation executed)`);

const bytes = json('tests/bytes.json').cases;
for (const c of bytes) {
  const raw = Buffer.concat(c.segments.flatMap(s => Array.from({ length: s.repeat ?? 1 }, () =>
    'text' in s ? Buffer.from(s.text, 'utf8') : Buffer.from(s.hex, 'hex'))));
  assert.equal(raw.length, c.size, c.id);
  assert.equal(hash(raw), c.sha256, c.id);
  if (c.writer_valid) validWith(validate, frontmatter(new TextDecoder('utf-8', { fatal: true }).decode(raw)), c.id);
  if ('frontmatter_bytes' in c || 'body_bytes' in c) {
    // Inspect the byte recipe, not the consumer's acceptance decision.
    const start = raw.indexOf(0x0a) + 1;
    const closing = raw.indexOf(Buffer.from('---'), start);
    assert(closing >= start, c.id);
    const endLine = raw.indexOf(0x0a, closing);
    if ('frontmatter_bytes' in c) assert.equal(closing - start, c.frontmatter_bytes, c.id);
    if ('body_bytes' in c) assert.equal(endLine < 0 ? 0 : raw.length - endLine - 1, c.body_bytes, c.id);
  }
}
assert.equal(bytes.find(c => c.id === 'total-max-with-bom').size, 24589);
console.log(`PASS byte recipes: ${bytes.length}; hashes, sizes, declared boundaries and positive YAML/schema shapes (no consumer byte reader executed)`);

const vocabulary = read('VOCABULARY.md');
for (const type of ['role', 'topic', 'decision']) {
  const heading = {role:'## Roles',topic:'## Topics',decision:'## Decisions'}[type];
  const section = vocabulary.slice(vocabulary.indexOf(heading)).split(/\n## /)[0];
  const mentioned = [...section.matchAll(/`([^`]+)`/g)].map(x=>x[1]).filter(x=>!x.startsWith('context.'));
  assert.deepEqual(mentioned, schema.$defs[type].enum, type);
}
// Notes (SPEC § 6.2): no word list exists, and the decision to serve follows the trusted audience alone.
assert(!existsSync(join(root, 'schema/terms.json')) && !/^## Words addressed to an agent/m.test(vocabulary), 'no word list for notes');
const withholding = json('tests/withholding.json');
assert.deepEqual(Object.keys(withholding.audiences), audiences, 'withholding audiences');
for (const [audience, decision] of Object.entries(withholding.audiences)) assert.equal(decision, audience === 'owner' ? 'serve' : 'withhold', `withholding ${audience}`);
const validNote = ajv.compile({ $ref: `${schema.$id}#/properties/notes` });
for (const c of withholding.cases) {
  // A case is a text and nothing else: what it says decides nothing.
  assert.deepEqual(Object.keys(c), ['text'], 'withholding case shape');
  validWith(validNote, c.text, `withholding note ${JSON.stringify(c.text)}`);
}
for (const c of withholding.serialization) assert.equal(JSON.stringify(c.text), c.json_string);
assert.equal(Object.values(schema.$defs).filter(x => ['What I read.','What I decide.','When to interrupt me.'].includes(x.description)).reduce((n,x)=>n+Object.keys(x.properties).length,0),25);
for (const c of json('tests/requests.json').rejected_arguments) {
  assert.equal(c.control_must_succeed, true);
  assert(!('state' in c.control_request) && !('activeStates' in c.control_request));
  for (const [k,v] of Object.entries(c.control_request)) assert.deepEqual(c.arguments[k], v);
}
// Projection, group and stored-variant blocks repeat the profile fields and values; they must not drift.
const projectionSchema = json('schema/humans-projection.schema.json'), groupSchema = json('schema/humans-group.schema.json');
/** Return the closed values, or the type, that a field schema accepts. */
const accepted = n => n.enum ?? n.items?.enum ?? n.type;
const preferenceFields = [];
for (const block of ['reading','deciding','interrupting']) {
  const source = schema.$defs[block].properties;
  preferenceFields.push(...Object.entries(source));
  const derived = { projection: [projectionSchema.oneOf[1].properties.profile.properties[block].properties, ['when_focused']], group: [groupSchema.properties[block].properties, ['when_focused','quiet_hours']] };
  for (const [name, [props, omitted]] of Object.entries(derived)) {
    const fields = Object.keys(props).filter(k => k !== 'appendix_depth');
    assert.deepEqual(fields, Object.keys(source).filter(k => !omitted.includes(k)), `${name} ${block} fields`);
    for (const k of fields) assert.deepEqual(accepted(props[k]), accepted(source[k]), `${name} ${block}.${k}`);
  }
}
const stored = schema.$defs.stateOverride.properties;
assert.deepEqual(Object.keys(stored), preferenceFields.map(([k]) => k).filter(k => k !== 'quiet_hours'), 'stored variant fields');
for (const [k, v] of preferenceFields) if (k !== 'quiet_hours') assert.deepEqual(accepted(stored[k]), accepted(v), `stored variant ${k}`);
for (const s of [projectionSchema.oneOf[1].properties.profile.properties, groupSchema.properties]) assert.deepEqual(s.avoid.items.enum, schema.properties.avoid.items.enum, 'avoid values');
const conflictFields = ['reading','deciding','interrupting'].flatMap(b => Object.keys(groupSchema.properties[b].properties).filter(k => !['visual','appendix_depth'].includes(k)).map(k => `${b}.${k}`));
assert.deepEqual(groupSchema.properties.conflicts.items.properties.field.enum, conflictFields, 'conflict fields');
assert.equal(groupSchema.properties.conflicts.maxItems, conflictFields.length);
// Projection and group schemas compile on their own: no reference leaves the file, and local $defs copy the profile's.
for (const derived of [projectionSchema, groupSchema]) {
  for (const m of JSON.stringify(derived).matchAll(/"\$ref":"([^"]*)"/g)) assert.match(m[1], /^#\/\$defs\//, `${derived.$id} reference ${m[1]}`);
  for (const [k, v] of Object.entries(derived.$defs)) assert.deepEqual(v, schema.$defs[k], `${derived.$id} $defs.${k}`);
  const alone = new Ajv({ allErrors: true, strict: true });
  addFormats(alone, ['date', 'uuid']);
  alone.compile(derived);
}
for (const k of ['id', 'updated', 'notes']) assert.deepEqual(projectionSchema.oneOf[1].properties.profile.properties[k], schema.properties[k], `projection ${k}`);
// Text in a projection (SPEC §§ 2, 6.2). Walk every value a projected profile or a group result can carry: each must be a closed value,
// a number, a boolean, a string with one of the pinned patterns below, or `notes`. Every object must be closed, and any other
// schema shape fails, so a new string cannot enter a projection without this list changing.
const pinnedPatterns = { id: schema.properties.id.pattern, updated: schema.properties.updated.pattern, 'interrupting.quiet_hours.from': '^(?:[01][0-9]|2[0-3]):(?:00|30)$', 'interrupting.quiet_hours.to': '^(?:[01][0-9]|2[0-3]):(?:00|30)$' };
/** Classify each value reachable through properties and items of a schema; return the paths of patterned and of unconstrained strings. */
function projectedText(rootSchema, start) {
  const found = { patterned: {}, free: [] };
  const allowed = { object: ['$schema', '$id', '$defs', 'title', 'type', 'additionalProperties', 'properties', 'required', 'minProperties', 'allOf', 'description'], array: ['type', 'items', 'minItems', 'maxItems', 'uniqueItems', 'description'] };
  (function walk(node, path) {
    if (node.$ref) node = node.$ref.slice(2).split('/').reduce((s, k) => s[k], rootSchema);
    if (node.enum || node.const !== undefined) return;
    if (node.anyOf && Object.keys(node).every(k => k === 'anyOf' || k === 'description')) return node.anyOf.forEach(alternative => walk(alternative, path));
    if (['boolean', 'integer', 'number'].includes(node.type)) return;
    if (node.type === 'object' || node.type === 'array') for (const k of Object.keys(node)) assert(allowed[node.type].includes(k), `${path || '(root)'}: unexpected ${k} on a projected ${node.type}`);
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false, `${path || '(root)'}: a projected object must be closed`);
      for (const [k, v] of Object.entries(node.properties)) walk(v, path ? `${path}.${k}` : k);
    } else if (node.type === 'array') walk(node.items, `${path}[]`);
    else if (node.type === 'string') { if (typeof node.pattern === 'string') found.patterned[path] = node.pattern; else found.free.push(path); }
    else assert.fail(`${path}: a projected value with no closed shape (${JSON.stringify(Object.keys(node))})`);
  })(start, '');
  return found;
}
const profileText = projectedText(projectionSchema, projectionSchema.oneOf[1].properties.profile);
assert.deepEqual(profileText.free, ['notes'], 'notes is the only unconstrained string a projected profile can carry');
assert.deepEqual(profileText.patterned, pinnedPatterns, 'patterned strings of a projected profile');
// A group result: the only string without closed values is a conflict's value, and each conflict field pins it to that field's closed values.
assert.deepEqual(projectedText(groupSchema, groupSchema), { patterned: {}, free: ['conflicts[].values[].value'] }, 'strings of a group result');
const pinnedConflictValues = Object.fromEntries(groupSchema.properties.conflicts.items.allOf.map(rule => [rule.if.properties.field.const, rule.then.properties.values.items.properties.value]));
assert.deepEqual(Object.keys(pinnedConflictValues).sort(), [...conflictFields].sort(), 'every conflict field pins its values');
for (const [field, value] of Object.entries(pinnedConflictValues)) assert(Array.isArray(value.enum) || value.type === 'integer', `conflict values of ${field} are closed`);
console.log('PASS vocabulary bijection, 25 preference fields, derived schema blocks, self-contained projection and group schemas, closed projection and group shapes with notes as the only unconstrained string, note audience and encoding vectors, state-request positive controls');

const behavior = json('tests/behavior.json').cases;
const permission = behavior.find(c => c.id === 'repository-permission-wins');
const control = behavior.find(c => c.id === 'repository-permission-authorized-control');
assert.equal(control.control_for, permission.id);
for (const key of ['preferences', 'fixture', 'repository_rule']) assert.deepEqual(control[key], permission[key], key);
assert.equal(permission.turns.length, 1);
assert.equal(control.turns.length, 2);
assert.deepEqual(control.turns[0], permission.turns[0]);
assert.equal(permission.fixture.path, 'synthetic-permission.txt');
assert.equal(permission.fixture.initial_utf8, 'before\n');
assert.equal(permission.fixture.requested_utf8, 'after\n');
for (const c of [permission, control]) {
  assert.equal(c.no_real_sensitive_action, true);
  assert.equal(c.preferences.deciding.reversible, 'decide_and_report');
  for (const turn of c.turns) {
    assert.equal(typeof turn.user, 'string');
    assert(turn.user.includes(c.fixture.path));
    assert.equal(typeof turn.expect.transcript.required_text, 'string');
    assert(turn.expect.transcript.required_text.length > 0);
  }
  const pending = c.turns[0].expect;
  assert(c.repository_rule.includes(pending.transcript.required_text));
  assert.deepEqual(pending.tool_trace, { write_attempts: 0 });
  assert.deepEqual(pending.filesystem, { fixture_utf8: c.fixture.initial_utf8, changed_paths: [] });
}
const confirmed = control.turns[1].expect;
assert.deepEqual(confirmed.tool_trace, { write_paths_only: [control.fixture.path] });
assert.deepEqual(confirmed.filesystem, { fixture_utf8: control.fixture.requested_utf8, changed_paths: [control.fixture.path] });
console.log('PASS permission vector structure: paired pending/confirmed expectations (no filesystem trial or model executed)');

// Check local file targets; headings and external URLs require separate review.
const docPaths = ['README.md','SPEC.md','CONTRIBUTING.md','CONFORMANCE.md','CHANGELOG.md','VOCABULARY.md','SOURCES.md','tests/README.md'];
for (const p of docPaths) {
  for (const m of read(p).matchAll(/\]\(([^)]+)\)/g)) {
    const target = m[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    if (target === 'CONTRACT.json' && args.includes('--write-manifest')) continue;
    assert(existsSync(resolve(root, dirname(p), target)), `${p}: missing ${target}`);
  }
}
const inventory = [...docPaths.filter(p => !p.startsWith('tests/')), 'LICENSE','tools/LICENSE', ...files('schema'), ...files('examples'), ...files('tests')].sort();
assert.equal(new Set(inventory).size, inventory.length);
const manifest = {
  contract: '0.3-draft.2026-11-11.1',
  status: 'draft',
  repository: 'https://github.com/cmdai-hq/HUMANS.md',
  source_revision_note: 'Content manifest for this contract revision. Consumers also pin the canonical commit that contains these files.',
  files: Object.fromEntries(inventory.map(p => [p, hash(readFileSync(join(root,p)))]))
};
if (args.includes('--write-manifest')) writeFileSync(join(root, 'CONTRACT.json'), JSON.stringify(manifest,null,2)+'\n');
assert.deepEqual(json('CONTRACT.json'), manifest, 'manifest inventory or digest drift; review changes before regenerating');
console.log(`PASS local document links and complete manifest: ${inventory.length} files`);
console.log(`Structural checks only. Node ${process.version}; Unicode ${process.versions.unicode}. No consumer, native adapter, compiler or model conformance claimed.`);
