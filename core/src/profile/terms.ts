// Matching rules of SPEC § 3.9 and § 6.2, as in spec/tools/lib.mjs: no case, no accents, whole words.
import { AGENT_WORDS } from "./schema.js";

/** Lowercase, strip accents, turn every non-alphanumeric run into one space, pad with spaces. */
export function fold(text: string): string {
  return ` ${text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
}

const AGENT = AGENT_WORDS.map(fold);
/**
 * Return the first padded, pre-folded term found in normalized text, trimmed for reporting; return null
 * when none matches.
 */
const firstMatch = (text: string, list: string[]) => list.find((t) => fold(text).includes(t))?.trim() ?? null;

/** The agent word that makes a note withheld, or null when it can be served (SPEC § 6.2). */
export const agentWord = (text: string) => firstMatch(text, AGENT);

/** JSON-quote note text without changing its decoded value; callers still enforce visibility and withholding. */
export const serializeNote = (text: string) =>
  JSON.stringify(text);
