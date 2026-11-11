// S1's conformance cases are the oracle: the server and the skills must agree with spec/ exactly.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProfile, type Profile } from "../src/profile/parse.js";
import { mergeAudience } from "../src/profile/merge.js";
import { serializeNote } from "../src/profile/terms.js";
import { serveTo, type ServeOptions } from "../src/profile/view.js";

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
  for (const [f, src] of md("tests/valid")) {
    it(`accepts tests/valid/${f} and withholds nothing for its words`, () => {
      expect(errors(src, f)).toEqual([]);
      const read = parseProfile(src, { mode: "read" });
      expect(read.withheld).toEqual([]);
      expect(read.issues).toEqual([]);
    });
  }
});

describe("a note is served to its owner's agent only, whatever it says (SPEC § 6.2, § 6.3)", () => {
  const { audiences, cases, serialization } = JSON.parse(readFileSync(join(spec, "tests/withholding.json"), "utf8"));
  // Visible to every audience, so that only the note rule decides what each one receives.
  const base: Profile = { humans: "0.3", id: "sample", name: "Example", updated: "2026-10-13", visibility: "anyone_with_file" };
  const today = "2026-10-13";
  it("covers the owner and every other audience", () => expect(Object.entries(audiences).filter(([, d]) => d === "serve").map(([a]) => a)).toEqual(["owner"]));
  for (const c of cases) for (const [audience, decision] of Object.entries(audiences) as Array<[NonNullable<ServeOptions["audience"]>, string]>) {
    it(`${audience} ${decision}: ${c.text}`, () => {
      const got = serveTo({ ...base, notes: c.text }, { today, audience });
      expect(got.status).toBe("found");
      expect(got.profile!.withheld).toEqual([]);
      if (decision === "serve") expect(got.profile!.notes).toBe(c.text);
      // Another reader gets exactly what the profile would give without a note: nothing shows one exists.
      else expect(got).toEqual(serveTo(base, { today, audience }));
    });
  }
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
