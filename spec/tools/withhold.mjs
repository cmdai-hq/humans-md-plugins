// Conformance check for SPEC.md § 6.2 (a note is served to its owner's agent only, whatever it says) and § 6.3 (serialization).
// Usage: node withhold.mjs ../tests/withholding.json
import { readFileSync } from "node:fs";
import { serializeNote } from "./lib.mjs";
import { noteFor } from "./conformance.mjs";

const { audiences, cases, serialization } = JSON.parse(readFileSync(process.argv[2], "utf8"));
let ok = true;
for (const { text } of cases) {
  const got = Object.keys(audiences).map((audience) => {
    const note = noteFor(audience, text);
    // A served note is the exact decoded string; anything else counts as withheld.
    return note === text ? "serve" : note === undefined ? "withhold" : "altered";
  });
  const pass = got.every((decision, i) => decision === Object.values(audiences)[i]);
  ok &&= pass;
  console.log(`${pass ? "ok  " : "FAIL"} ${Object.keys(audiences).map((audience, i) => `${audience}=${got[i]}`).join(" ")} ${JSON.stringify(text)}`);
}
for (const { text, json_string: expect } of serialization) {
  const got = serializeNote(text);
  const pass = got === expect;
  ok &&= pass;
  console.log(`${pass ? "ok  " : "FAIL"} serialize ${got}`);
}
process.exit(ok ? 0 : 1);
