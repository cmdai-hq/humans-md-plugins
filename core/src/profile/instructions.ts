// Instruction sentences of SPEC § 6.4, loaded from the pinned spec/schema/instructions.json.
// They derive only from a canonical, authorized projection: no profile value is interpolated, and
// notes, context, language codes, names written in files and bodies never enter them.
import type { ServedProfile } from "./view.js";
import type { MergedProfile } from "./merge.js";
import instructions from "../../../spec/schema/instructions.json" with { type: "json" };
import schema from "../../../spec/schema/humans.schema.json" with { type: "json" };
import { LANGUAGES, QUIET_TIME, TIME_ZONES, VISUAL, WEEKDAYS } from "./schema.js";

/** One language of instructions.json: a sentence per closed value, or one sentence for the field. */
export type InstructionTable = Readonly<Record<string, string | Readonly<Record<string, string>>>>;
export type InstructionLanguage = keyof typeof instructions.languages;
export const INSTRUCTION_LANGUAGES = Object.keys(instructions.languages) as InstructionLanguage[];
/** The English sentences, keyed `block.field` (or `avoid`) as in instructions.json. */
export const INSTRUCTIONS: InstructionTable = instructions.languages.en;

/**
 * Sentence order of SPEC § 6.4: `languages` first, then the field order of §§ 3.3–3.6 (the schema's
 * property order), with the group-only `appendix_depth` right after `technical_depth`, then `avoid`.
 * `when_focused` has no sentence.
 */
export const INSTRUCTION_ORDER: readonly string[] = [
  "languages",
  ...Object.keys(schema.$defs.reading.properties).flatMap((f) => (f === "technical_depth" ? [`reading.${f}`, "reading.appendix_depth"] : [`reading.${f}`])),
  ...Object.keys(schema.$defs.deciding.properties).map((f) => `deciding.${f}`),
  ...Object.keys(schema.$defs.interrupting.properties).filter((f) => f !== "when_focused").map((f) => `interrupting.${f}`),
  "avoid",
];

/** Test for a non-null, non-array object. */
const isMap = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
/** Accept only a projected quiet_hours shape: pinned zone, half-hour times that differ, known weekdays. */
const quietHours = (v: unknown): boolean => isMap(v) && typeof v.time_zone === "string" && TIME_ZONES.includes(v.time_zone)
  && typeof v.from === "string" && QUIET_TIME.test(v.from) && typeof v.to === "string" && QUIET_TIME.test(v.to) && v.from !== v.to
  && (v.all_day === undefined || (Array.isArray(v.all_day) && v.all_day.every((d) => typeof d === "string" && WEEKDAYS.includes(d))));

/**
 * Return the fixed sentences for an authorized individual or group projection, one per projected value,
 * in SPEC § 6.4 order. Only own, closed-value entries of the pinned table are used; unknown fields,
 * unknown values and prototype keys contribute nothing. `appendix_depth` is read on groups only and
 * `quiet_hours` on individuals only, as SPEC § 9 defines them. The sentences grant no action authority.
 * An unknown language throws UNSUPPORTED_ARGUMENT.
 */
export function asInstructions(served: ServedProfile | MergedProfile, language: InstructionLanguage = "en"): string[] {
  if (!Object.hasOwn(instructions.languages, language)) throw new Error("UNSUPPORTED_ARGUMENT");
  const table: InstructionTable = instructions.languages[language];
  let group = false;
  // Dropped from the single-person public bundle (build-public.ts, esbuild dropLabels): it never
  // renders a group, so `group` stays false there.
  MULTI_PERSON: group = "humans_group" in served;
  const out: string[] = [];
  /** Append the sentence for one closed value, if the table has exactly that own entry. */
  const closed = (field: string, value: unknown) => {
    const entry = Object.hasOwn(table, field) ? table[field] : undefined;
    if (typeof value === "string" && isMap(entry) && Object.hasOwn(entry, value)) out.push(entry[value] as string);
  };
  /** Append the single sentence of a field that refers to its projected value instead of repeating it. */
  const single = (field: string) => {
    const entry = Object.hasOwn(table, field) ? table[field] : undefined;
    if (typeof entry === "string") out.push(entry);
  };
  for (const field of INSTRUCTION_ORDER) {
    if (field === "languages") {
      // One sentence that names the field, never the code: only a nonempty list of known codes earns it.
      const codes: unknown = served.languages;
      if (Array.isArray(codes) && codes.length > 0 && codes.every((c) => typeof c === "string" && LANGUAGES.includes(c))) single(field);
      continue;
    }
    if (field === "avoid") {
      for (const value of Array.isArray(served.avoid) ? served.avoid : []) closed(field, value);
      continue;
    }
    const [block, name] = field.split(".") as ["reading" | "deciding" | "interrupting", string];
    const values: unknown = served[block];
    if (!isMap(values) || !Object.hasOwn(values, name)) continue;
    const value = values[name];
    if (name === "max_words") {
      if (typeof value === "number" && Number.isInteger(value) && value >= 20 && value <= 2000) single(field);
    } else if (name === "visual") {
      if (Array.isArray(value)) for (const item of value) if (typeof item === "string" && VISUAL.includes(item)) closed(field, item);
    } else if (name === "quiet_hours") {
      if (!group && quietHours(value)) single(field);
    } else if (name !== "appendix_depth" || group) closed(field, value);
  }
  return out;
}
