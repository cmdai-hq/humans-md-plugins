// Group merge (SPEC § 9), a port of S1's reference implementation spec/tools/merge.mjs. Deterministic;
// checked against spec/tests/group/*.json. Output shape: spec/schema/humans-group.schema.json.

import type { Profile } from "./parse.js";
import { AVOID, STALE_AFTER_DAYS, TOPICS } from "./schema.js";
import { daysBetween } from "./view.js";

type Rule =
  | { kind: "lead" | "min" | "borda" | "depth" | "omit" }
  | { kind: "strict"; order: string[] }
  | { kind: "any"; value: string }
  | { kind: "majority"; tie: string };

const RULES: Record<"reading" | "deciding" | "interrupting", Record<string, Rule>> = {
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
    // Times and a time zone are personal; groups never carry them (SPEC § 9).
    quiet_hours: { kind: "omit" },
  },
};
const VISUAL_TIE = ["table", "diagram", "example", "chart", "text"];
const DEPTHS = ["non_technical", "balanced", "expert"];

export interface MergedProfile {
  humans_group: "0.3";
  coverage: { with_profile: number; total: number; stale?: number };
  languages?: string[];
  reading?: Record<string, unknown>;
  deciding?: Record<string, unknown>;
  interrupting?: Record<string, unknown>;
  context?: { knows_well?: string[]; knows_little?: string[] };
  avoid?: string[];
  conflicts: Array<{ field: string; values?: Array<{ value: unknown; count: number }> }>;
}

/** Count scalar votes; ties sort numerically or by code units so results do not depend on locale. */
function counts(values: unknown[]): Array<{ value: unknown; count: number }> {
  const m = new Map<unknown, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || (typeof a.value === "number" && typeof b.value === "number" ? a.value - b.value : String(a.value) < String(b.value) ? -1 : String(a.value) > String(b.value) ? 1 : 0));
}

/**
 * Combine a nonempty list of validated votes using the selected field rule. Abstentions are removed by
 * the caller; depth and omitted fields are handled outside this helper.
 */
function mergeField(rule: Rule, values: unknown[]): unknown {
  switch (rule.kind) {
    case "lead":
      if (values.includes("tldr")) return "tldr";
      if (values.includes("decision_needed")) return "decision_needed";
      return mergeField({ kind: "majority", tie: "context" }, values);
    case "strict": return rule.order.find((v) => values.includes(v));
    case "min": return Math.min(...(values as number[]));
    case "any": return values.includes(rule.value) ? rule.value : counts(values)[0].value;
    case "majority": {
      const c = counts(values);
      return c.length > 1 && c[0].count === c[1].count ? rule.tie : c[0].value;
    }
    case "borda": {
      const score = new Map<string, number>();
      for (const list of values as string[][]) list.forEach((v, rank) => score.set(v, (score.get(v) ?? 0) + 5 - rank));
      return [...score.keys()].sort((a, b) => score.get(b)! - score.get(a)! || VISUAL_TIE.indexOf(a) - VISUAL_TIE.indexOf(b)).slice(0, 2);
    }
    default: return undefined;
  }
}

/**
 * Merge one validated, audience-authorized profile slot per member; null slots
 * count toward coverage without voting. Callers deduplicate and apply audience
 * visibility first: this helper excludes private profiles but can include org data.
 * Notes and identities are omitted; states stay inactive and own state selectors
 * throw UNSUPPORTED_ARGUMENT. Conflict counts do not guarantee anonymity.
 */
export function mergeAudience(profiles: Array<Profile | null>, opts: { today: string }): MergedProfile {
  if (Object.hasOwn(opts, 'state') || Object.hasOwn(opts, 'activeStates')) {
    throw new Error('UNSUPPORTED_ARGUMENT');
  }
  const { today } = opts;
  const members = profiles.filter((p): p is Profile => !!p && p.visibility !== "private");
  const out: MergedProfile = { humans_group: "0.3", coverage: { with_profile: members.length, total: profiles.length }, conflicts: [] };
  const stale = members.filter((p) => daysBetween(p.updated, today) > STALE_AFTER_DAYS).length;
  if (stale) out.coverage.stale = stale;

  const langLists = members.map((p) => p.languages).filter((l): l is string[] => !!l?.length);
  if (langLists.length) {
    /**
     * Sum language positions across nonempty ballots, charging 10 for absence; a lower score is
     * preferred.
     */
    const rank = (l: string) => langLists.reduce((s, list) => s + (list.includes(l) ? list.indexOf(l) : 10), 0);
    const all = [...new Set(langLists.flat())];
    /** Order languages by ballot score, then code units for locale-independent ties. */
    const byRank = (a: string, b: string) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0);
    const common = all.filter((l) => langLists.every((list) => list.includes(l)));
    if (common.length) out.languages = common.sort(byRank);
    else {
      /** Count nonempty ballots containing this language, used when no language is shared by every voter. */
      const n = (l: string) => langLists.filter((list) => list.includes(l)).length;
      out.languages = [all.sort((a, b) => n(b) - n(a) || byRank(a, b))[0]];
    }
  }

  for (const [block, rules] of Object.entries(RULES) as Array<[keyof typeof RULES, Record<string, Rule>]>) {
    const merged: Record<string, unknown> = {};
    for (const [field, rule] of Object.entries(rules)) {
      if (rule.kind === "omit") continue;
      const values = members.map((p) => (p[block] as Record<string, unknown> | undefined)?.[field]).filter((v) => v !== undefined && (!Array.isArray(v) || v.length));
      if (!values.length) continue;
      if (rule.kind === "depth") {
        const depths = DEPTHS.filter((d) => values.includes(d));
        merged[field] = depths[0];
        if (depths.length > 1) merged.appendix_depth = depths.at(-1);
      } else merged[field] = mergeField(rule, values);
      // SPEC § 9: conflicts cover single-value fields; visual is a list and has no scalar conflict.
      if (field !== "visual") {
        const c = counts(values);
        if (c.length > 1) out.conflicts.push(values.length >= 3 ? { field: `${block}.${field}`, values: c } : { field: `${block}.${field}` });
      }
    }
    if (Object.keys(merged).length) out[block] = merged;
  }

  const context: NonNullable<MergedProfile["context"]> = {};
  const well = members.map((p) => p.context?.knows_well ?? []);
  const common = TOPICS.filter((t) => well.length && well.every((l) => l.includes(t)));
  if (common.length) context.knows_well = common;
  const little = TOPICS.filter((t) => members.some((p) => p.context?.knows_little?.includes(t)));
  if (little.length) context.knows_little = little;
  if (Object.keys(context).length) out.context = context;

  const avoid = AVOID.filter((a) => members.some((p) => p.avoid?.includes(a)));
  if (avoid.length) out.avoid = avoid;
  // Same key order as the reference output.
  const { conflicts, ...rest } = out;
  return { ...rest, conflicts } as MergedProfile;
}
