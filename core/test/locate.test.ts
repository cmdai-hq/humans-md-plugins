import { it, expect } from 'vitest';
import { join } from 'node:path';
import { parseProfile } from '../src/profile/parse.js';
import { declaredPath, locateInvalid, LOCATED_CODES } from '../src/profile/locate.js';
import schema from '../../spec/schema/humans.schema.json' with { type: 'json' };
// @ts-ignore Test-only mirror module, shared executable corpus.
import { optionsFor, parserCases } from '../../spec/tools/conformance.mjs';

const root = join(import.meta.dirname, '../../spec');
type Node = { $ref?: string; properties?: Record<string, Node> };
/** Every path the schema declares, written `/a/b`. */
function declared(node: Node = schema as Node, path = '$', out = new Set<string>()): Set<string> {
  if (node.$ref) node = node.$ref.slice(2).split('/').reduce((s, k) => (s as Record<string, Node>)[k], schema as Node);
  out.add(path);
  for (const [key, child] of Object.entries(node.properties ?? {})) declared(child, `${path === '$' ? '' : path}/${key}`, out);
  return out;
}

it('over every shared vector, a place is given only to a strict-writer PROFILE_INVALID, in declared names and static codes', () => {
  const paths = declared();
  expect(paths.has('/interrupting/quiet_hours/time_zone')).toBe(true);
  expect(paths.has('/states/incident/max_words')).toBe(true);
  let located = 0;
  for (const c of parserCases(root).filter((c: any) => !c.stringOnly)) {
    const opts = optionsFor(c, 'write');
    const bytes = typeof c.source === 'string' ? Buffer.from(c.source) : c.source;
    const verdict = parseProfile(bytes, opts).issues.map(i => i.message);
    const issues = locateInvalid(bytes, opts);
    // Whatever the reader accepts, or rejects for its version, this pass must leave alone.
    if (!verdict.includes('PROFILE_INVALID')) { expect(issues, c.id).toBeUndefined(); continue; }
    if (!issues) {
      // The two rejections this pass leaves at the root: a byte order mark inside the file, a lone carriage return.
      const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes).replace(/^\uFEFF/u, '');
      expect(text.includes('\uFEFF') || /\r(?!\n)/u.test(text), `${c.id}: an invalid vector without a place`).toBe(true);
      continue;
    }
    located++;
    expect(issues.length, c.id).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(Object.keys(issue).sort(), c.id).toEqual(['message', 'path', 'severity']);
      expect(paths.has(issue.path), `${c.id}: ${issue.path}`).toBe(true);
      expect(LOCATED_CODES, c.id).toContain(issue.message);
      expect(issue.severity, c.id).toBe('error');
    }
    for (const text of c.absent_substrings ?? []) expect(JSON.stringify(issues), c.id).not.toContain(text);
  }
  expect(located).toBeGreaterThan(100);
});

it('a path keeps declared names only: no array index, no key of the file', () => {
  expect(declaredPath('')).toBe('$');
  expect(declaredPath('/reading/max_words')).toBe('/reading/max_words');
  expect(declaredPath('/avoid/3')).toBe('/avoid');
  expect(declaredPath('/states/incident/visual/0')).toBe('/states/incident/visual');
  expect(declaredPath('/states/PAYLOAD_KEY/length')).toBe('/states');
  expect(declaredPath('/PAYLOAD_KEY/reading')).toBe('$');
  expect(declaredPath('/interrupting/quiet_hours', 'time_zone')).toBe('/interrupting/quiet_hours/time_zone');
  // A missing name is appended only below a fully declared path.
  expect(declaredPath('/states/PAYLOAD_KEY', 'length')).toBe('/states');
  for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) expect(declaredPath(`/${key}`)).toBe('$');
});
