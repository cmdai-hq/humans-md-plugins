// Generator verification only: intentionally fails on hosts without Unicode 17.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unsafeUnicodePattern } from './unicode17.mjs';
import { readJson } from './lib.mjs';
test('Unicode 17 generator equivalence over all 1,114,112 code points', () => {
  assert.equal(process.versions.unicode, '17.0', 'test:unicode requires a Unicode 17.0 runtime (Node 24.21.0 or 26.10.0)');
  const pinned = new RegExp(unsafeUnicodePattern,'u');
  const normative = new RegExp(readJson('schema/humans.schema.json').$defs.unsafeText.anyOf[0].pattern,'u');
  for (let n = 0; n <= 0x10ffff; n++) assert.equal(pinned.test(String.fromCodePoint(n)),normative.test(String.fromCodePoint(n)),`U+${n.toString(16)}`);
});
