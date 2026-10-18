import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProfile } from "../src/profile/parse.js";
import { serveTo } from "../src/profile/view.js";
import { SPEC_VERSION } from "../src/profile/schema.js";
import schema from "../../spec/schema/humans.schema.json" with { type: "json" };
// @ts-ignore Pinned portable parser constants.
import { READ_VERSIONS, WRITE_VERSION } from "../../spec/tools/reader-core.mjs";

const root = join(import.meta.dirname, "..");
/**
 * Load a named repository test fixture as UTF-8; ids are fixed by the test, never taken from a personal
 * profile path.
 */
const read = (id: string) => readFileSync(join(root, `test/fixtures/${id}.md`), "utf8");
const ids = ["tristan", "maria", "leo", "alex-k", "alex-r"];
const today = "2026-10-13";
const head = `---\nhumans: "0.3"\nid: x1\nname: X\nupdated: "2026-10-01"\n`;

describe("parse", () => {
  it("writes the pinned 0.3 version and reads 0.3 and 0.2", () => {
    expect(SPEC_VERSION).toBe(WRITE_VERSION);
    expect(SPEC_VERSION).toBe(schema.properties.humans.const);
    expect(READ_VERSIONS).toEqual(["0.3", "0.2"]);
    const previous = head.replace('humans: "0.3"', 'humans: "0.2"');
    expect(parseProfile(`${previous}visibility: public\n---\n`).profile?.visibility).toBe("anyone_with_file");
    expect(parseProfile(`${previous}---\n`, { mode: "write" }).issues.map((i) => i.message)).toEqual(["UNSUPPORTED_VERSION"]);
  });
  it("accepts every sample profile in write mode", () => {
    for (const id of ids) expect(parseProfile(read(id), { mode: "write", expectedId: id }).issues, id).toEqual([]);
  });
  it("rejects an id that differs from the file name", () => {
    expect(parseProfile(read("leo"), { mode: "write", expectedId: "leon" }).profile).toBeUndefined();
  });
  it("ignores unknown enum values in read mode and keeps recognized values", () => {
    const r = parseProfile(`${head}reading:\n  length: huge\n  tone: warm\n---\n`);
    expect(r.profile?.reading).toEqual({ tone: "warm" });
  });
  it("rejects a scalar where the schema wants a list", () => {
    expect(parseProfile(`${head}reading:\n  visual: table\n---\n`, { mode: "write" }).profile).toBeUndefined();
  });
  it("rejects a misspelt or mistyped visibility", () => {
    for (const bad of ["Private", "everyone", "[org]", "1", "cancer"]) {
      expect(parseProfile(`${head}visibility: ${bad}\n---\n`).profile, bad).toBeUndefined();
      expect(parseProfile(`${head}visibility: ${bad}\n---\n`, { mode: "write" }).profile, bad).toBeUndefined();
    }
  });
  it("rejects a note with disallowed characters as an invalid profile", () => {
    const r = parseProfile(`${head}notes: "Short please, see https://evil.example"\n---\n`);
    expect(r.profile).toBeUndefined();
    expect(r.withheld).toEqual([]);
    expect(r.issues[0].severity).toBe("error");
  });
  it("treats inherited names like toString as unknown fields", () => {
    const r = parseProfile(`${head}reading:\n  toString: short\n  constructor: x\n  tone: warm\n---\n`);
    expect(r.profile?.reading).toEqual({ tone: "warm" });
  });
  it("rejects unsupported 0.1 in both modes", () => {
    const v01 = `---\nhumans: "0.1"\nid: old\nname: Old\nupdated: "2026-10-01"\nreading:\n  length: short\n  asks_per_message: one\n  decisions: recommendation_first\n  challenge: welcome_early\n  channel_hint: async_written\nstates:\n  tired:\n    length: minimal\n    asks_per_message: one\n---\n`;
    expect(parseProfile(v01).profile).toBeUndefined();
    expect(parseProfile(v01, { mode: "write" }).profile).toBeUndefined();
  });
  it("HUMANS.md holds the frontmatter only; a repo profile may add 4 KB of body", () => {
    const src = `${head}---\nSome prose.\n`;
    expect(parseProfile(src, { mode: "write", kind: "me" }).profile).toBeUndefined();
    expect(parseProfile(src, { mode: "write", kind: "repo" }).issues).toEqual([]);
    expect(parseProfile(`${head}---\n${"x".repeat(4200)}\n`, { mode: "write", kind: "repo" }).issues[0].message).toBe("PROFILE_INVALID");
  });
  it("rejects a non-existent date and accepts ordinary names", () => {
    expect(parseProfile(head.replace("2026-10-01", "2026-02-30") + "---\n", { mode: "write" }).profile).toBeUndefined();
    expect(parseProfile(head.replace("name: X", "name: Grant Lee\naliases: [Grant, GL]") + "---\n", { mode: "write" }).issues).toEqual([]);
  });
});
