// Portable parsing contract shared by reference and compiled-validator adapters.
// Dependencies are injected so this module also bundles on Workers without filesystem access.
import { yamlData } from './yaml-data.mjs';
export const MAX_FILE_BYTES = 24589;
export const MAX_FRONTMATTER_BYTES = 20480;
export const MAX_BODY_BYTES = 4096;
/** Version a strict writer writes, and versions a reader accepts (SPEC § 11). */
export const WRITE_VERSION = '0.3';
export const READ_VERSIONS = Object.freeze(['0.3', '0.2']);
/** Build a profile-less result with no withheld fields and one root error using the given code. */
export const invalid = (code = 'PROFILE_INVALID') => ({ withheld: [], issues: [{ path: '$', message: code, severity: 'error' }] });
/** Test for a non-null object that is not an array; this does not require a plain object. */
export const isMap = v => v !== null && typeof v === 'object' && !Array.isArray(v);
/** Test that text contains no unpaired surrogate code points. */
const scalarString = s => !/[\uD800-\uDFFF]/u.test(s);
/**
 * Decode a Uint8Array within MAX_FILE_BYTES as strict UTF-8, preserving any initial BOM.
 * Wrong input types, oversized input and malformed UTF-8 throw.
 */
export function decodeBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_FILE_BYTES) throw new Error('PROFILE_INVALID');
  // Preserve BOM here: exactly one is removed by the delimiter parser.
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}
/** Check YYYY-MM-DD syntax and month/day ranges using Gregorian leap-year rules, including year 0000. */
export function calendarDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, month, day] = m.slice(1).map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
/**
 * Clone the schema and replace traversed enum constraints with string types,
 * then restore the original visibility schema and accept every readable version.
 */
export function readerSchema(schema) {
  const copy = structuredClone(schema);
  /** Replace enums in schema objects reached through properties, $defs, items and combinators. */
  function walk(v) {
    if (!isMap(v)) return;
    if (v.enum) { delete v.enum; v.type = 'string'; }
    for (const [k, x] of Object.entries(v)) {
      if (k === 'properties' || k === '$defs') Object.values(x).forEach(walk);
      else if (k === 'items') walk(x);
      else if (['allOf', 'anyOf', 'oneOf'].includes(k)) x.forEach(walk);
    }
  }
  walk(copy);
  copy.properties.visibility = schema.properties.visibility;
  copy.properties.humans = { enum: [...READ_VERSIONS] };
  return copy;
}
/**
 * Follow local schema references and retain declared object properties recursively.
 * When filterEnums is true, also remove unknown enum values and empty shaped collections,
 * and omit an object that lost a required member that way (an unknown quiet_hours.time_zone).
 */
function shape(value, node, schema, filterEnums) {
  if (node.$ref) node = node.$ref.slice(2).split('/').reduce((s, k) => s[k], schema);
  if (filterEnums && node.enum && !node.enum.includes(value)) return undefined;
  if (Array.isArray(value) && node.items) {
    const result = value.map(v => shape(v, node.items, schema, filterEnums)).filter(v => v !== undefined);
    return filterEnums && !result.length ? undefined : result;
  }
  if (isMap(value) && node.properties) {
    const result = Object.create(null);
    for (const [k, v] of Object.entries(value)) if (Object.hasOwn(node.properties, k)) {
      const next = shape(v, node.properties[k], schema, filterEnums);
      if (next !== undefined) result[k] = next;
    }
    if (filterEnums && node.required?.some(k => !Object.hasOwn(result, k))) return undefined;
    return filterEnums && !Object.keys(result).length ? undefined : result;
  }
  return value;
}
/**
 * Parse bounded profile text or bytes using injected YAML, schema validators and withholding logic.
 * Apply writer or reader shaping and filename rules, returning profile/diagnostics or a profile-less error;
 * caught failures become PROFILE_INVALID.
 */
export function parseCore(input, opts, { yaml, schema, validate, validateRead, withhold }) {
  try {
    if (opts.draft && opts.mode !== 'write') return invalid('UNSUPPORTED_ARGUMENT');
    let source = typeof input === 'string' ? input : decodeBytes(input);
    // Reject raw JS surrogates before TextEncoder can replace them; scan escaped YAML after parsing too.
    if (!scalarString(source) || new TextEncoder().encode(source).length > MAX_FILE_BYTES) return invalid();
    source = source.replace(/^\uFEFF/u, '');
    if (source.includes('\uFEFF') || /\r(?!\n)/u.test(source)) return invalid();
    const match = /^---\r?\n([\s\S]*?\r?\n)?---(?:\r?\n|$)([\s\S]*)$/u.exec(source);
    if (!match) return invalid();
    const front = match[1] ?? '', body = match[2];
    if (new TextEncoder().encode(front).length > MAX_FRONTMATTER_BYTES || new TextEncoder().encode(body).length > MAX_BODY_BYTES || (opts.kind === 'me' && body.length !== 0)) return invalid();
    for (const lexeme of new yaml.Lexer().lex(front)) {
      if (['anchor', 'alias', 'tag', 'directive-line', 'doc-start', 'doc-end'].includes(yaml.CST.tokenType(lexeme))) return invalid();
    }
    const raw = yamlData(front, yaml);
    if (!isMap(raw)) return invalid();
    if (typeof raw.humans !== 'string') return invalid();
    if (opts.mode === 'write' ? raw.humans !== WRITE_VERSION : !READ_VERSIONS.includes(raw.humans)) return invalid('UNSUPPORTED_VERSION');
    if (opts.expectedId !== undefined && !opts.draft && raw.id !== opts.expectedId) return invalid();
    const data = opts.mode === 'write' ? raw : shape(raw, schema, schema, false);
    // The one value 0.3 renamed: a 0.2 reader's public is 0.3's anyone_with_file (SPEC § 11).
    if (opts.mode !== 'write' && raw.humans === '0.2' && data.visibility === 'public') data.visibility = 'anyone_with_file';
    if (!(opts.mode === 'write' ? validate : validateRead)(data)) return invalid();
    // A schema cannot compare two members: an empty daily quiet range is invalid (SPEC § 3.5).
    const quiet = data.interrupting?.quiet_hours;
    if (isMap(quiet) && quiet.from === quiet.to) return invalid();
    const profile = opts.mode === 'write' ? data : shape(data, schema, schema, true);
    const withheld = typeof profile.notes === 'string' && withhold(profile.notes) ? ['notes'] : [];
    const issues = withheld.length ? [{ path: '/notes', message: 'NOTE_WITHHELD_AGENT_DIRECTED', severity: 'warning' }] : [];
    if (opts.draft) issues.push({ path: '$', message: 'DRAFT_FILENAME_UNCHECKED', severity: 'warning' });
    return { profile, withheld, issues };
  } catch { return invalid(); }
}
