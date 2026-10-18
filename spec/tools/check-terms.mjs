// Checks that every term in schema/terms.json is listed in VOCABULARY.md, so the spec and the tools never drift.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { specDir, terms } from "./lib.mjs";

const spec = readFileSync(join(specDir, "VOCABULARY.md"), "utf8");
const missing = Object.values(terms).flatMap((byLang) => Object.values(byLang).flat()).filter((t) => !spec.includes(`\`${t}\``));
console.log(missing.length ? `FAIL terms missing from VOCABULARY.md: ${missing.join(", ")}` : "ok   every term of schema/terms.json is listed in VOCABULARY.md");
process.exit(missing.length ? 1 : 0);
