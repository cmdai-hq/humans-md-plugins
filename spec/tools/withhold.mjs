// Conformance check for SPEC.md § 6.2 (withholding) and § 6.3 (serialization).
// Usage: node withhold.mjs ../tests/withholding.json
import { readFileSync } from "node:fs";
import { serializeNote, withholdReason } from "./lib.mjs";

const { cases, serialization } = JSON.parse(readFileSync(process.argv[2], "utf8"));
let ok = true;
for (const { text, expect } of cases) {
  const reason = withholdReason(text);
  const got = reason ? "withhold" : "serve";
  const pass = got === expect;
  ok &&= pass;
  console.log(`${pass ? "ok  " : "FAIL"} ${got.padEnd(8)} ${JSON.stringify(text)}${reason ? `  ${reason}` : ""}`);
}
for (const { text, json_string: expect } of serialization) {
  const got = serializeNote(text);
  const pass = got === expect;
  ok &&= pass;
  console.log(`${pass ? "ok  " : "FAIL"} serialize ${got}`);
}
process.exit(ok ? 0 : 1);
