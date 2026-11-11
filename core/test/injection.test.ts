import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, inject, it } from "vitest";
import { parseProfile } from "../src/profile/parse.js";
import { TRAPS } from "./trapped.js";


/**
 * Assert that these trap outputs contain no URL/email-like text, angle brackets or listed invisible
 * controls; this character check is not a general injection-safety proof.
 */
function assertClosed(served: string): void {
  expect(served).not.toMatch(/https?:|www\.|@[a-z0-9-]+\.[a-z]/iu);
  expect(served).not.toMatch(/[<>]/u);
  expect(served).not.toMatch(/[​-‏‪-‮⁦-⁩﻿\u{E0000}-\u{E007F}]/u);
}

describe("20 trapped profiles", () => {
  it("has 20 traps", () => expect(TRAPS).toHaveLength(20));

  for (const t of TRAPS) {
    const id = `t${String(t.n).padStart(2, "0")}`;
    it(`#${t.n} local-file path (CLI, no directory) serves no payload either`, () => {
      const dir = mkdtempSync(join(tmpdir(), "humans-cli-"));
      let served: string, rendered: string;
      try {
        const file = join(dir, `${id}.md`);
        writeFileSync(file, t.source);
        served = execFileSync(process.execPath, [inject("referenceCli"), "serve", file, "--owner"], { encoding: "utf8" });
        rendered = execFileSync(process.execPath, [inject("referenceCli"), "render-agent", file, "--owner"], { encoding: "utf8" });
      } finally { rmSync(dir, { recursive: true, force: true }); }
      assertClosed(served);
      // The payload must never reach the SPEC § 6.4 sentences, which follow the frame and JSON lines.
      expect(rendered.split("\n").slice(2).join("\n")).not.toMatch(/ZEBRA|Bluebird|deadline moved/i);
      if (t.expect === "stripped") expect(served).not.toContain(`ZEBRA${String(t.n).padStart(2, "0")}`);
      // A valid note is its owner's own words to their own agent: served exactly, as data.
      else expect(JSON.parse(served).profile.notes).toContain(`ZEBRA${String(t.n).padStart(2, "0")}`);
    });

    it(`#${t.n} serves no payload to a reader other than the owner, even from a file anyone may read`, () => {
      const dir = mkdtempSync(join(tmpdir(), "humans-cli-"));
      let served: string, rendered: string;
      try {
        const file = join(dir, `${id}.md`);
        writeFileSync(file, t.source.replace('updated: "2026-10-01"\n', 'updated: "2026-10-01"\nvisibility: anyone_with_file\n'));
        served = execFileSync(process.execPath, [inject("referenceCli"), "serve", file], { encoding: "utf8" });
        rendered = execFileSync(process.execPath, [inject("referenceCli"), "render-agent", file], { encoding: "utf8" });
      } finally { rmSync(dir, { recursive: true, force: true }); }
      assertClosed(served);
      // Without a note, nothing a person wrote as a sentence is left: no trap survives, residual ones included.
      for (const out of [served, rendered]) expect(out).not.toMatch(/ZEBRA|Bluebird|deadline moved|notes/i);
      const got = JSON.parse(served);
      if (got.status !== "none") expect(got.profile.withheld).toEqual([]);
    });

    it(`#${t.n} is refused by the validator unless it is a valid note or a field that is never served`, () => {
      const r = parseProfile(t.source, { mode: "write", expectedId: id });
      expect(r.withheld).toEqual([]);
      expect(r.issues.some((i) => i.severity === "error")).toBe(t.expect === "stripped" && t.validator !== false);
    });
  }

});
