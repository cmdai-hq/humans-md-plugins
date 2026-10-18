// The HUMANS.md format as the skills and the MCP server consume it. Every list comes from S1's files:
// spec/schema/humans.schema.json (fields, vocabularies) and spec/schema/terms.json (agent words).
// Validation itself runs on a validator compiled from that schema (scripts/gen-validator.ts).
import schema from "../../../spec/schema/humans.schema.json" with { type: "json" };
import terms from "../../../spec/schema/terms.json" with { type: "json" };

type Props = Record<string, { enum?: string[]; items?: { enum?: string[] } }>;
/** Extract scalar enum properties from the pinned schema; array vocabularies are exported separately. */
const enums = (props: Props): Record<string, readonly string[]> =>
  Object.fromEntries(Object.entries(props).filter(([, v]) => v.enum).map(([k, v]) => [k, v.enum!]));

/** The version a strict writer writes; readers also accept "0.2" (spec/tools/reader-core.mjs READ_VERSIONS). */
export const SPEC_VERSION = "0.3";
/** SPEC § 3.1 byte bounds, from the pinned reader: 20 KiB frontmatter, 4 KiB body, 24,589-byte read. */
export { MAX_FILE_BYTES, MAX_FRONTMATTER_BYTES, MAX_BODY_BYTES as MAX_REPO_BODY_BYTES } from "../../../spec/tools/reader-core.mjs";

export const READING = enums(schema.$defs.reading.properties as Props);
export const DECIDING = enums(schema.$defs.deciding.properties as Props);
export const INTERRUPTING = enums(schema.$defs.interrupting.properties as Props);
export const VISUAL: readonly string[] = schema.$defs.reading.properties.visual.items.enum;
export const AVOID: readonly string[] = schema.properties.avoid.items.enum;
export const STATES: readonly string[] = Object.keys(schema.properties.states.properties);
export const TOPICS: readonly string[] = schema.$defs.topic.enum;
export const LANGUAGES: readonly string[] = schema.$defs.language.enum;
/** Pinned `interrupting.quiet_hours.time_zone` names (IANA tz 2026e zone.tab plus UTC), SPEC § 3.5. */
export const TIME_ZONES: readonly string[] = schema.$defs.timeZone.enum;
export const WEEKDAYS: readonly string[] = schema.$defs.interrupting.properties.quiet_hours.properties.all_day.items.enum;
/** Same pattern as the schema: HH:MM on the hour or half hour. */
export const QUIET_TIME: RegExp = new RegExp(schema.$defs.interrupting.properties.quiet_hours.properties.from.pattern, "u");

export const AGENT_WORDS: readonly string[] = [...terms.agent_words.en, ...terms.agent_words.fr];

export const ID_PATTERN = /^[a-z0-9-]{2,64}$/;
/** Profiles older than this are served with `stale: true`; context after CONTEXT_STALE_AFTER_DAYS. */
export const STALE_AFTER_DAYS = 365;
export const CONTEXT_STALE_AFTER_DAYS = 183;
