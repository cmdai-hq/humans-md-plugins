// Typed adapter to the pinned portable parser; compiled schemas also run without eval on Workers.
import * as yaml from "yaml";
import validate from "../generated/validate-profile.js";
import validateRead from "../generated/validate-reader.js";
import schema from "../../../spec/schema/humans.schema.json" with { type: "json" };
import { parseCore } from "../../../spec/tools/reader-core.mjs";
import { agentWord } from "./terms.js";

export type Block = Record<string, string>;
export type Override = Record<string, string | number | string[]>;

/** `interrupting.quiet_hours` (SPEC § 3.5): closed values only, never a reason. */
export interface QuietHours {
  time_zone: string;
  from: string;
  to: string;
  all_day?: string[];
}

/**
 * The validated frontmatter. Same shape as the file. A reader keeps the declared `humans` ("0.3" or
 * "0.2"); a "0.2" `visibility: public` is already read as `anyone_with_file` (SPEC § 11).
 */
export interface Profile {
  humans: string;
  id: string;
  name: string;
  aliases?: string[];
  identities?: Record<string, string>;
  languages?: string[];
  updated: string;
  visibility?: "org" | "anyone_with_file" | "private";
  reading?: Partial<Record<"lead_with" | "length" | "structure" | "technical_depth" | "jargon" | "tone" | "evidence" | "uncertainty" | "close_with", string>> & { visual?: string[]; max_words?: number };
  deciding?: Block;
  interrupting?: Partial<Record<"interrupt_for" | "group_by" | "when_focused" | "channel_hint" | "progress_updates", string>> & { quiet_hours?: QuietHours };
  context?: { role?: string; knows_well?: string[]; knows_little?: string[]; decides?: string[]; context_updated?: string };
  avoid?: string[];
  states?: Record<string, Override>;
  notes?: string;
}

export interface Issue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ParseResult {
  profile?: Profile;
  /** Fields a consumer must not serve, and must list as withheld (SPEC § 6.2). */
  withheld: string[];
  issues: Issue[];
}

export interface ParseOptions {
  mode: "read" | "write";
  /** Required to equal `id`, except for a file named exactly `HUMANS.md` (SPEC § 3.2). */
  expectedId?: string;
  /** Explicit validation-only filename exemption. */
  draft?: boolean;
  /** `me`: a file named `HUMANS.md` (~/.humans/HUMANS.md), frontmatter only. `repo`: humans/<id>.md, may carry a short body. */
  kind?: "me" | "repo";
}


const dependencies = { yaml, schema, validate, validateRead, withhold: agentWord };
/**
 * Parse through the pinned bounded reader and return recognized fields plus fixed issues.
 * Byte entrances must pass original bytes, never replacement-decoded strings.
 * Validation and note-withholding warnings do not establish visibility authority;
 * consumers must still project for their recipient before serving any fields.
 */
export function parseProfile(source: string | Uint8Array, opts: ParseOptions = { mode: "read" }): ParseResult {
  return parseCore(source, opts, dependencies) as ParseResult;
}
