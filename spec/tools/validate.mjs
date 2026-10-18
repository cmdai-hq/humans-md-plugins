// Strict file validation and supported-version reading; diagnostics never reflect payloads.
import { pathToFileURL } from 'node:url';
import { basename, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import * as yaml from 'yaml';
import { readJson, withholdReason } from './lib.mjs';
import { parseCore, readerSchema, calendarDate, invalid } from './reader-core.mjs';
import { readBounded } from './bytes.mjs';
import { unicodeSchema } from './unicode17.mjs';
const schema = unicodeSchema(readJson('schema/humans.schema.json'));
const ajv = new Ajv2020({ allErrors: false, strict: true });
addFormats(ajv, ['uuid']);
ajv.addFormat('date', calendarDate);
const readSchema = readerSchema(schema);
delete readSchema.$id;
const deps = { yaml, schema, validate: ajv.compile(schema), validateRead: ajv.compile(readSchema), withhold: withholdReason };
/** Parse profile text or bytes with the reference dependencies and supplied options; default to read mode. */
export const parseProfile = (input, opts = { mode: 'read' }) => parseCore(input, opts, deps);
/**
 * Read a bounded file and parse it with filename-derived kind and id checks.
 * Map read failures to PROFILE_INVALID for overflow or PROFILE_UNAVAILABLE otherwise.
 */
export function loadProfile(path, mode = 'read', draft = false) {
  const name = basename(path);
  try { return parseProfile(readBounded(path), { mode, kind: name === 'HUMANS.md' ? 'me' : 'repo', expectedId: name === 'HUMANS.md' ? undefined : name.endsWith('.md') ? name.slice(0, -3) : '', draft }); }
  catch (error) { return invalid(error.code === 'PROFILE_INVALID' ? 'PROFILE_INVALID' : 'PROFILE_UNAVAILABLE'); }
}
/** Return error messages from strict file validation, omitting warnings. */
export const check = path => loadProfile(path, 'write').issues.filter(i => i.severity === 'error').map(i => i.message);
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), expectInvalid = args.includes('--expect-invalid'), draft = args.includes('--draft');
  if (args.some(a => a.startsWith('-') && !['--expect-invalid', '--draft'].includes(a))) {
    process.stderr.write('UNSUPPORTED_ARGUMENT\n'); process.exit(2);
  }
  const files = args.filter(a => !a.startsWith('-'));
  let ok = files.length > 0;
  for (const file of files) {
    const result = loadProfile(file, 'write', draft);
    const unavailable = result.issues.some(i => i.message === 'PROFILE_UNAVAILABLE');
    const pass = !unavailable && (!!result.profile !== expectInvalid);
    ok &&= pass;
    console.log(JSON.stringify({ ok: pass, valid: !!result.profile, issues: result.issues }));
  }
  process.exit(ok ? 0 : 1);
}
