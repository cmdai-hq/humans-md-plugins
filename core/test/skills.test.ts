// The compile skill restates the schema for the model; these checks keep it in step with schema.ts.
// Source: the Claude Code plugin's skill; scripts/build.ts derives the portable skill from it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, inject, it } from "vitest";
import { AVOID, DECIDING, INTERRUPTING, READING, STATES, VISUAL, WEEKDAYS } from "../src/profile/schema.js";
import { parseProfile } from "../src/profile/parse.js";

const root = join(import.meta.dirname, "../..");
const skill = join(root, "plugins/humans-md/skills/compile");
const fields = readFileSync(join(skill, "references/fields.md"), "utf8");
const blocks = { reading: READING, deciding: DECIDING, interrupting: INTERRUPTING };

describe("skills match the schema", () => {
  for (const [block, table] of Object.entries(blocks)) {
    for (const [field, values] of Object.entries(table)) {
      it(`fields.md lists ${block}.${field} with every value`, () => {
        const row = fields.split("\n").find((l) => l.startsWith(`| \`${field}\``));
        expect(row, field).toBeDefined();
        for (const v of values) expect(row).toContain(`\`${v}\``);
      });
    }
  }
  it("fields.md lists every visual, avoid, state", () => {
    for (const v of [...VISUAL, ...AVOID, ...STATES]) expect(fields).toContain(`\`${v}\``);
  });
  it("fields.md covers interrupting.quiet_hours", () => {
    const row = fields.split("\n").find((l) => l.startsWith("| `quiet_hours`"));
    for (const member of ["time_zone", "from", "to", "all_day"]) expect(row).toContain(`\`${member}\``);
    for (const day of WEEKDAYS) expect(fields).toContain(day);
  });
  it("fields.md carries the SPEC § 10 HUMANS.md header byte for byte, and a file starting with it validates", () => {
    const spec = readFileSync(join(root, "spec/SPEC.md"), "utf8");
    const header = /```text\n(# HUMANS\.md 0\.3:[^\n]*\n[^\n]*\n[^\n]*\n)```/u.exec(spec)![1];
    expect(header.split("\n")).toHaveLength(4);
    expect(fields).toContain(`\`\`\`text\n${header}\`\`\``);
    const me = `---\n${header}humans: "0.3"\nid: alex\nname: Alex\nupdated: "2026-10-13"\nvisibility: private\n---\n`;
    const parsed = parseProfile(me, { mode: "write", kind: "me" });
    expect(parsed.issues).toEqual([]);
    expect(JSON.stringify(parsed.profile)).not.toContain("Form only");
  });
  it("skill frontmatter keeps to the six Agent Skills fields", () => {
    for (const dir of [skill, join(root, "skills/humans-md-compile")]) {
      const front = readFileSync(join(dir, "SKILL.md"), "utf8").split("---")[1];
      const keys = front.split("\n").filter((l) => /^[a-z-]+:/u.test(l)).map((l) => l.split(":")[0]);
      expect(keys.every((k) => ["name", "description", "license", "compatibility", "metadata", "allowed-tools"].includes(k)), dir).toBe(true);
      expect(keys).toContain("name");
      const desc = /description: >-\n([\s\S]*?)\n[a-z]/u.exec(front)![1].replace(/\s+/gu, " ").trim();
      expect(desc.length, `${dir} description`).toBeLessThanOrEqual(1024);
    }
  });
});

describe("compile interview", () => {
  const compile = readFileSync(join(skill, "SKILL.md"), "utf8");
  const interview = readFileSync(join(skill, "references/interview.md"), "utf8");
  const schema = JSON.parse(readFileSync(join(root, "spec/schema/humans.schema.json"), "utf8"));
  const questions = interview.split("## Questions")[1].split("\nDone when:")[0];
  const items = questions.split("\n").filter((l) => /^\d+\. /u.test(l));

  it("SKILL.md points to the interview and discloses the provider before its first question", () => {
    expect(compile).toContain("[interview](references/interview.md)");
    expect(compile).toMatch(/or asking the first interview question, state which assistant\/provider/u);
    expect(compile).toContain("disclosed before source access or questions");
  });
  it("the opening names the provider before any question, and asks one question at a time", () => {
    const opening = interview.indexOf("## Before the first question");
    expect(opening).toBeGreaterThan(-1);
    expect(interview.indexOf("provider", opening)).toBeLessThan(interview.indexOf("## Questions"));
    expect(interview).toContain("One question per message.");
    expect(interview).toContain("AskUserQuestion");
  });
  it("asks about ten questions, each with at most four choices", () => {
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items.length).toBeLessThanOrEqual(11);
    for (const item of items) expect(item.split(" · ").length, item).toBeLessThanOrEqual(4);
  });
  it("every choice maps to a closed value of the field it names", () => {
    const tables: Record<string, Record<string, readonly string[]>> = { ...blocks, visual: { visual: VISUAL } };
    let checked = 0;
    for (const item of items) {
      let current: readonly string[] | undefined;
      for (const [, token] of item.matchAll(/`([^`]+)`/gu)) {
        // A top-level field name ends the list of values of the field before it.
        if (/^(?:notes|name|id)$/u.test(token)) { current = undefined; continue; }
        const full = /^(reading|deciding|interrupting)\.(\w+): (\w+)$/u.exec(token);
        if (full) { current = tables[full[1]][full[2]]; expect(current, token).toBeDefined(); expect(current).toContain(full[3]); checked++; continue; }
        const vis = /^visibility: (\w+)$/u.exec(token);
        if (vis) { current = schema.properties.visibility.enum; expect(current).toContain(vis[1]); checked++; continue; }
        if (item.includes("Pick any.") && item.includes("`reading.visual`") && token !== "reading.visual") { expect(VISUAL).toContain(token); checked++; continue; }
        if (current && /^[a-z_]+$/u.test(token)) { expect(current, `${token} in ${item.slice(0, 40)}`).toContain(token); checked++; }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(20);
  });
  it("asks about preferences only, never health, diagnosis or psychology", () => {
    expect(questions).not.toMatch(/health|diagnos|disab|personality|psycholog|feel|stress|anxi|trigger|well-?being|mood|emotion/iu);
    expect(interview).toMatch(/Never ask about health, diagnosis, personality, feelings, stress or triggers, and never use them as examples\./u);
    expect(interview).toContain("kept exactly as written");
  });
  it("asks for the reading language, not the conversation's; plain text only goes alone", () => {
    expect(questions).toMatch(/read agents' replies most easily\? It can differ from the one you write in\./u);
    expect(questions).toContain("Do not assume the language of the conversation.");
    expect(questions).toMatch(/"Plain text only" goes alone/u);
  });
  it("splits the last question: name, then job and topics mapped as interpretations, then an optional note", () => {
    expect(questions).toMatch(/9\. \*\*What name should agents use for you\?\*\*/u);
    expect(questions).toMatch(/`context\.role`[\s\S]*`context\.knows_well`[\s\S]*interpretation shown in the preview/u);
    expect(questions).toMatch(/11\. \*\*Anything else agents should know/u);
  });
  it("reconciles free answers with choices, shows the whole file, and never edits settings by hand", () => {
    expect(interview).toMatch(/## Before the preview[\s\S]*Never change a choice without asking\./u);
    expect(interview).toMatch(/Show the complete frontmatter exactly as it will be saved[\s\S]*A one-line summary is not a preview\./u);
    expect(interview).toMatch(/ask about one preference they saved[\s\S]*when `interrupting\.interrupt_for` is set/u);
    expect(interview).toContain("Never edit a settings file by hand.");
    // This plugin's own setting, the only one named.
    expect(interview).toContain("claude plugin configure humans-md@humans-md");
    expect(interview).toMatch(/Map it like any source statement \(step 2\) first/u);
    expect(interview).toMatch(/propose the person's own words as part of the note/u);
  });
  it("a skipped visibility question still proposes private, never the absent default (org)", () => {
    expect(questions).toMatch(/Skip → `private`/u);
    expect(interview).toMatch(/except question 8: skipping it proposes `visibility: private`/u);
  });
  it("uses no \"it's not X, it's Y\" construction", () => {
    for (const text of [compile, interview]) expect(text).not.toMatch(/\b(?:it'?s|is|isn'?t) not\b[^.;\n]*[,;—] *(?:it'?s|but)\b/iu);
  });
});

describe("reference CLI", () => {
  const cli = inject("referenceCli");
  /**
   * Execute the bundled diagnostic CLI and parse its stdout JSON; unexpected nonzero exits or malformed
   * output fail the test.
   */
  const run = (...args: string[]) => JSON.parse(execFileSync("node", [cli, ...args], { encoding: "utf8" }));
  const profiles = join(import.meta.dirname, "./fixtures");
  it("refuses a private profile unless --owner", () => {
    expect(run("serve", join(profiles, "alex-r.md")).status).toBe("none");
    expect(run("serve", join(profiles, "alex-r.md"), "--owner").status).toBe("found");
  });
  it("names the person by id, not by the name they wrote", () => {
    const p = run("serve", join(profiles, "tristan.md"), "--owner").profile;
    expect(p.id).toBe("tristan");
    expect(p).not.toHaveProperty("display_name");
  });
});

