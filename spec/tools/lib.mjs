// Shared helpers for the reference tools: file access, instruction sentences, note serialization.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const specDir = join(here, "..");
/** Read and parse a JSON file relative to specDir; read and syntax errors propagate. */
export const readJson = (rel) => JSON.parse(readFileSync(join(specDir, rel), "utf8"));

/**
 * List every fixed instruction sentence of schema/instructions.json (SPEC § 6.4) with its place, language by language.
 * non_owner holds no sentence: it only names fields that get none for a reader other than the owner.
 */
export function instructionSentences(instructions = readJson("schema/instructions.json")) {
  const listed = [];
  const walk = (label, sentences) => {
    for (const [field, entry] of Object.entries(sentences)) {
      for (const sentence of typeof entry === "string" ? [entry] : Object.values(entry)) listed.push({ where: `${label} ${field}`, sentence });
    }
  };
  for (const [lang, sentences] of Object.entries(instructions.languages)) walk(lang, sentences);
  return listed;
}

/** The only text form a consumer may use to pass a note to its owner's model (SPEC §§ 6.2, 6.3). */
export const serializeNote = (text) =>
  JSON.stringify(text);
