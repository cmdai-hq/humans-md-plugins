// Shared helpers for the reference tools: text folding, term matching, withholding, serialization.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const specDir = join(here, "..");
/** Read and parse a JSON file relative to specDir; read and syntax errors propagate. */
export const readJson = (rel) => JSON.parse(readFileSync(join(specDir, rel), "utf8"));
export const terms = readJson("schema/terms.json");

// Lowercase, strip accents, turn every non-alphanumeric run into one space, pad with spaces.
// "Example-user" -> " example user ".
/**
 * Decompose text with NFD, remove combining marks and lowercase it.
 * Collapse non-letter/non-number runs to spaces, trim, then pad with one space on each side.
 */
export function fold(text) {
  return ` ${text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
}

/** Apply the matching normalization to every term in a list. */
const folded = (list) => list.map((t) => fold(t));
const AGENT = folded([...terms.agent_words.en, ...terms.agent_words.fr]);

/** Find the first pre-folded list entry contained in folded text; return its trimmed form or null. */
const firstMatch = (text, list) => {
  const f = fold(text);
  const hit = list.find((t) => f.includes(t));
  return hit ? hit.trim() : null;
};

/** Why a note or a served free-text value is withheld, or null when it can be served (SPEC § 6.2). */
export const withholdReason = (text) => {
  const word = firstMatch(text, AGENT);
  return word ? "NOTE_WITHHELD_AGENT_DIRECTED" : null;
};

/** The only text form a consumer may use to pass a note to a model (SPEC § 6.3). */
export const serializeNote = (text) =>
  JSON.stringify(text);
