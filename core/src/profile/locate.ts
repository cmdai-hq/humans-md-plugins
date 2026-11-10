// Where a strict-writer rejection comes from, for `humans-md check`. The verdict stays
// parseProfile's (the pinned reader, compared with the reference in test/conformance.test.ts): this
// second pass over the same bytes only names a place, as a path of field names the schema declares
// plus a static code. It never returns a value, a key the schema does not declare or parser text
// (SPEC § 8), and gives up (undefined) rather than guess.
import * as yaml from 'yaml';
import validate from '../generated/validate-profile.js';
import schema from '../../../spec/schema/humans.schema.json' with { type: 'json' };
import { decodeBytes, MAX_BODY_BYTES, MAX_FILE_BYTES, MAX_FRONTMATTER_BYTES, WRITE_VERSION } from '../../../spec/tools/reader-core.mjs';
// @ts-ignore The portable YAML composer ships without a declaration file.
import { yamlData } from '../../../spec/tools/yaml-data.mjs';
import type { Issue, ParseOptions } from './parse.js';

/** Static code of each schema keyword the profile schema uses. */
const KEYWORDS: Record<string, string> = {
  required: 'MISSING', additionalProperties: 'UNKNOWN_FIELD', type: 'WRONG_TYPE', enum: 'NOT_AN_ALLOWED_VALUE', const: 'NOT_AN_ALLOWED_VALUE',
  minimum: 'OUT_OF_RANGE', maximum: 'OUT_OF_RANGE', minLength: 'OUT_OF_RANGE', maxLength: 'OUT_OF_RANGE', maxItems: 'OUT_OF_RANGE',
  pattern: 'WRONG_FORMAT', format: 'WRONG_FORMAT', not: 'NOT_PLAIN_TEXT', uniqueItems: 'DUPLICATE_VALUE',
};
/** Every code this pass can return. */
export const LOCATED_CODES: readonly string[] = [...new Set(Object.values(KEYWORDS)), 'TOO_LARGE', 'NOT_UTF8', 'FRONTMATTER_DELIMITERS',
  'BODY_NOT_ALLOWED', 'YAML_FEATURE_NOT_ALLOWED', 'YAML_INVALID', 'FILENAME_MISMATCH', 'EMPTY_RANGE'];

interface Node { $ref?: string; properties?: Record<string, Node> }
/** The schema node a local `$ref` names, or the node itself. */
const resolve = (node: Node): Node => node.$ref ? node.$ref.slice(2).split('/').reduce((s, k) => (s as Record<string, Node>)[k], schema as Node) : node;
/**
 * The keys of a JSON Pointer that the schema declares as properties, as a JSON Pointer (the form
 * the withheld-notes warning already uses, `/notes`), stopping at the first key the schema does not
 * declare: an array index, or a key that only the file has. `$` when none is declared: the file as a whole.
 */
export function declaredPath(pointer: string, last?: string): string {
  let node = schema as Node, path = '';
  for (const key of [...pointer.split('/').slice(1), ...(last === undefined ? [] : [last])]) {
    const properties = node.properties;
    if (!properties || !Object.hasOwn(properties, key)) break;
    path += '/' + key;
    node = resolve(properties[key]);
  }
  return path || '$';
}
const isMap = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const size = (s: string) => new TextEncoder().encode(s).length;

/**
 * The place of a PROFILE_INVALID rejection of these bytes by the strict writer, following the
 * reader's own order of checks (spec/tools/reader-core.mjs), or undefined when none is found.
 * Schema faults give one issue per field, in the validator's order.
 */
export function locateInvalid(bytes: Uint8Array, opts: Pick<ParseOptions, 'kind' | 'expectedId' | 'draft'>): Issue[] | undefined {
  const at = (path: string, message: string): Issue[] => [{ path, message, severity: 'error' }];
  try {
    if (bytes.byteLength > MAX_FILE_BYTES) return at('$', 'TOO_LARGE');
    let source: string;
    try { source = decodeBytes(bytes); } catch { return at('$', 'NOT_UTF8'); }
    source = source.replace(/^﻿/u, '');
    if (source.includes('﻿') || /\r(?!\n)/u.test(source)) return undefined;
    const match = /^---\r?\n([\s\S]*?\r?\n)?---(?:\r?\n|$)([\s\S]*)$/u.exec(source);
    if (!match) return at('$', 'FRONTMATTER_DELIMITERS');
    const front = match[1] ?? '', body = match[2];
    if (size(front) > MAX_FRONTMATTER_BYTES || size(body) > MAX_BODY_BYTES) return at('$', 'TOO_LARGE');
    if (opts.kind === 'me' && body.length !== 0) return at('$', 'BODY_NOT_ALLOWED');
    for (const lexeme of new yaml.Lexer().lex(front)) {
      if (['anchor', 'alias', 'tag', 'directive-line', 'doc-start', 'doc-end'].includes(yaml.CST.tokenType(lexeme) as string)) return at('$', 'YAML_FEATURE_NOT_ALLOWED');
    }
    let raw: unknown;
    try { raw = yamlData(front, yaml); } catch { return at('$', 'YAML_INVALID'); }
    if (!isMap(raw)) return at('$', 'WRONG_TYPE');
    if (typeof raw.humans !== 'string') return at('/humans', Object.hasOwn(raw, 'humans') ? 'WRONG_TYPE' : 'MISSING');
    // Another version is UNSUPPORTED_VERSION, the reader's own code: nothing to place.
    if (raw.humans !== WRITE_VERSION) return undefined;
    if (opts.expectedId !== undefined && !opts.draft && raw.id !== opts.expectedId) return at('/id', 'FILENAME_MISMATCH');
    if (!validate(raw)) {
      const found = new Map<string, Issue>();
      for (const e of (validate.errors ?? []) as { instancePath: string; keyword: string; params: { missingProperty?: string } }[]) {
        const code = KEYWORDS[e.keyword];
        if (!code) continue;
        const path = declaredPath(e.instancePath, e.keyword === 'required' ? e.params.missingProperty : undefined);
        if (!found.has(path)) found.set(path, { path, message: code, severity: 'error' });
      }
      return found.size ? [...found.values()] : undefined;
    }
    const quiet = isMap(raw.interrupting) ? raw.interrupting.quiet_hours : undefined;
    if (isMap(quiet) && quiet.from === quiet.to) return at('/interrupting/quiet_hours', 'EMPTY_RANGE');
    return undefined;
  } catch { return undefined; }
}
