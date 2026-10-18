// S1's conformance cases are the oracle: the server and the skills must agree with spec/ exactly.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProfile, type Profile } from "../src/profile/parse.js";
import { mergeAudience } from "../src/profile/merge.js";
import { agentWord, serializeNote } from "../src/profile/terms.js";

const spec = join(import.meta.dirname, "../../spec");
/**
 * Read direct Markdown children of a normative corpus directory as filename/source pairs, ignoring other
 * file types.
 */
const md = (dir: string) => readdirSync(join(spec, dir)).filter((f) => f.endsWith(".md")).map((f) => [f, readFileSync(join(spec, dir, f), "utf8")] as const);
// As spec/tools/validate.mjs: id = file name, except HUMANS.md, which also carries no body.
/**
 * Apply writer validation with filename/id matching for repository profiles and the body-free HUMANS.md rule,
 * returning errors while leaving warnings out of validity assertions.
 */
const errors = (src: string, file: string) => {
  const me = file === "HUMANS.md";
  return parseProfile(src, { mode: "write", kind: me ? "me" : "repo", expectedId: me ? undefined : file.replace(/\.md$/u, "") }).issues.filter((i) => i.severity === "error");
};

describe("profiles (SPEC § 3)", () => {
  for (const [f, src] of md("examples")) it(`accepts examples/${f}`, () => expect(errors(src, f)).toEqual([]));
  for (const [f, src] of md("tests/invalid")) it(`rejects tests/invalid/${f}`, () => expect(errors(src, f).length).toBeGreaterThan(0));
  for (const [f, src] of md("tests/schema-valid-but-withheld")) {
    it(`accepts then withholds tests/schema-valid-but-withheld/${f}`, () => {
      expect(errors(src, f)).toEqual([]);
      expect(parseProfile(src, { mode: "read" }).withheld).toContain("notes");
    });
  }
});

describe("withholding and serialization (SPEC § 6.2, § 6.3)", () => {
  const { cases, serialization } = JSON.parse(readFileSync(join(spec, "tests/withholding.json"), "utf8"));
  for (const c of cases) it(`${c.expect}: ${c.text}`, () => expect(agentWord(c.text) ? "withhold" : "serve").toBe(c.expect));
  for (const c of serialization) it(`serializes ${c.text}`, () => expect(serializeNote(c.text)).toBe(c.json_string));
});

describe("groups (SPEC § 9), same output as spec/tools/merge.mjs", () => {
  const dir = join(spec, "tests/group");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    it(f, () => {
      const c = JSON.parse(readFileSync(join(dir, f), "utf8"));
      const profiles = c.members.map((rel: string | null) => (rel === null ? null : parseProfile(readFileSync(join(dir, rel), "utf8"), { mode: "read" }).profile ?? null)) as Array<Profile | null>;
      const options = { today: c.today };
      for (const key of ['state', 'activeStates'] as const) if (Object.hasOwn(c, key)) Object.assign(options, { [key]: c[key] });
      expect(mergeAudience(profiles, options)).toEqual(c.expect);
    });
  }
});
