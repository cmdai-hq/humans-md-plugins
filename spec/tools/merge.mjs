// Reference implementation of the group merge (SPEC.md § 9). Deterministic: same inputs, same output.
// Usage: node merge.mjs ../tests/group/<case>.json   (checks the result against the case's "expect")
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { loadProfile } from "./validate.mjs";
import { readJson } from "./lib.mjs";

const profileSchema = readJson("schema/humans.schema.json");
const groupSchema = readJson("schema/humans-group.schema.json");
const defs = profileSchema.$defs;

const STALE_DAYS = 365;
// Field rules. strict: first value of this order that anyone set. any: value wins if anyone set it.
// majority: most frequent; a tie gives the tie value. lowest: first in order.
const RULES = {
  reading: {
    lead_with: { kind: "lead" },
    length: { kind: "strict", order: ["minimal", "short", "standard", "thorough"] },
    max_words: { kind: "min" },
    structure: { kind: "majority", tie: "mixed" },
    visual: { kind: "borda" },
    technical_depth: { kind: "depth" },
    jargon: { kind: "strict", order: ["avoid", "define", "ok"] },
    tone: { kind: "majority", tie: "neutral" },
    evidence: { kind: "majority", tie: "key_numbers" },
    uncertainty: { kind: "any", value: "flag_explicitly" },
    close_with: { kind: "majority", tie: "nothing" },
  },
  deciding: {
    reversible: { kind: "any", value: "ask" },
    batch_questions: { kind: "majority", tie: "end_of_task" },
    default_answer: { kind: "any", value: "always" },
    asks_per_message: { kind: "strict", order: ["one", "few", "any"] },
    format: { kind: "majority", tie: "options_then_recommendation" },
    question_style: { kind: "majority", tie: "multiple_choice" },
    challenge: { kind: "majority", tie: "after_draft" },
    out_of_scope_steps: { kind: "majority", tie: "omit_unless_blocking" },
  },
  interrupting: {
    interrupt_for: { kind: "strict", order: ["blocking_only", "blocking_or_risky", "anything"] },
    group_by: { kind: "any", value: "project" },
    when_focused: { kind: "omit" },
    channel_hint: { kind: "majority", tie: "either" },
    progress_updates: { kind: "majority", tie: "phase_changes" },
    quiet_hours: { kind: "omit" },
  },
};
const VISUAL_TIE = ["table", "diagram", "example", "chart", "text"];

/** Count equal values and sort by descending frequency, breaking ties by numeric or lexical value. */
function counts(values) {
  const m = new Map();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (typeof a.value === "number" ? a.value - b.value : a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
}

/**
 * Apply one field rule to the supplied nonempty values; Borda scoring uses the ranked lists.
 * Unrecognized rule kinds return undefined.
 */
function mergeField(rule, values, lists) {
  switch (rule.kind) {
    case "lead":
      if (values.includes("tldr")) return "tldr";
      if (values.includes("decision_needed")) return "decision_needed";
      return mergeField({ kind: "majority", tie: "context" }, values);
    case "strict": return rule.order.find((v) => values.includes(v));
    case "min": return Math.min(...values);
    case "any": return values.includes(rule.value) ? rule.value : counts(values)[0].value;
    case "majority": {
      const c = counts(values);
      return c.length > 1 && c[0].count === c[1].count ? rule.tie : c[0].value;
    }
    case "borda": {
      const score = new Map();
      for (const list of lists) list.forEach((v, rank) => score.set(v, (score.get(v) ?? 0) + 5 - rank));
      return [...score.keys()].sort((a, b) => score.get(b) - score.get(a) || VISUAL_TIE.indexOf(a) - VISUAL_TIE.indexOf(b)).slice(0, 2);
    }
    default: return undefined;
  }
}

/** Throw UNSUPPORTED_ARGUMENT when either selector is an own property, without reading its value. */
function rejectSelectors(options) {
  if (Object.hasOwn(options, 'state') || Object.hasOwn(options, 'activeStates')) {
    throw new Error('UNSUPPORTED_ARGUMENT');
  }
}

/** profiles: frontmatter objects (null for a member without a profile). */
export function merge(profiles, options) {
  rejectSelectors(options);
  const { today } = options;
  const members = profiles.filter((p) => p && p.visibility !== "private");
  const out = { humans_group: "0.3", coverage: { with_profile: members.length, total: profiles.length } };
  const stale = members.filter((p) => (Date.parse(today) - Date.parse(p.updated)) / 864e5 > STALE_DAYS).length;
  if (stale) out.coverage.stale = stale;

  const langLists = members.map((p) => p.languages).filter(l => l?.length);
  if (langLists.length) {
    /** Sum language positions across nonempty member lists, assigning 10 for each omission. */
    const rank = (l) => langLists.reduce((s, list) => s + (list.includes(l) ? list.indexOf(l) : 10), 0);
    const all = [...new Set(langLists.flat())];
    const common = all.filter((l) => langLists.every((list) => list.includes(l)));
    /** Compare languages by summed rank, breaking ties lexically. */
    const byRank = (a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0);
    if (common.length) out.languages = common.sort(byRank);
    else {
      /** Count nonempty member language lists containing the given language. */
      const n = (l) => langLists.filter((list) => list.includes(l)).length;
      out.languages = [all.sort((a, b) => n(b) - n(a) || byRank(a, b))[0]];
    }
  }

  const conflicts = [];
  for (const [block, rules] of Object.entries(RULES)) {
    const merged = {};
    for (const [field, rule] of Object.entries(rules)) {
      if (rule.kind === "omit") continue;
      const lists = members.map((p) => p[block]?.[field]).filter((v) => v !== undefined && (!Array.isArray(v) || v.length));
      if (!lists.length) continue;
      if (rule.kind === "depth") {
        const depths = ["non_technical", "balanced", "expert"].filter((d) => lists.includes(d));
        merged[field] = depths[0];
        if (depths.length > 1) merged.appendix_depth = depths.at(-1);
      } else merged[field] = mergeField(rule, lists, lists);
      if (field !== "visual") {
        const c = counts(lists);
        if (c.length > 1) conflicts.push(lists.length >= 3 ? { field: `${block}.${field}`, values: c } : { field: `${block}.${field}` });
      }
    }
    if (Object.keys(merged).length) out[block] = merged;
  }

  const topics = defs.topic.enum;
  const context = {};
  const well = members.map((p) => p.context?.knows_well ?? []);
  const common = topics.filter((t) => well.length && well.every((l) => l.includes(t)));
  if (common.length) context.knows_well = common;
  const little = topics.filter((t) => members.some((p) => p.context?.knows_little?.includes(t)));
  if (little.length) context.knows_little = little;
  if (Object.keys(context).length) out.context = context;

  const avoid = profileSchema.properties.avoid.items.enum.filter((a) => members.some((p) => p.avoid?.includes(a)));
  if (avoid.length) out.avoid = avoid;
  out.conflicts = conflicts;
  return out;
}

// Run only when executed directly. pathToFileURL handles spaces and Windows paths.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args.some(a => a.startsWith('-'))) {
    process.stderr.write('UNSUPPORTED_ARGUMENT\n'); process.exit(2);
  }
  const [casePath] = args;
  const c = JSON.parse(readFileSync(casePath, "utf8"));
  try { rejectSelectors(c); }
  catch { process.stderr.write('UNSUPPORTED_ARGUMENT\n'); process.exit(2); }
  /**
   * Resolve a fixture member relative to its case file and return its parsed profile,
   * or null for a null member or a load without a profile.
   */
  const load = (rel) => {
    if (rel === null) return null;
    return loadProfile(join(dirname(casePath), rel)).profile ?? null;
  };
  const got = merge(c.members.map(load), { today: c.today });
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv, ["date", "uuid"]);
  ajv.addSchema(profileSchema);
  const okSchema = ajv.validate(groupSchema, got);
  const okExpect = isDeepStrictEqual(got, c.expect);
  console.log(`${okSchema && okExpect ? "ok  " : "FAIL"} merge ${casePath} (schema ${okSchema ? "ok" : "FAIL"}, expected ${okExpect ? "ok" : "FAIL"})`);
  if (!okSchema) console.log(ajv.errors);
  if (!okExpect || process.env.SHOW) console.log(JSON.stringify(got, null, 2));
  process.exit(okSchema && okExpect ? 0 : 1);
}
