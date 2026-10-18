export const MAX_FILE_BYTES: number;
export const MAX_FRONTMATTER_BYTES: number;
export const MAX_BODY_BYTES: number;
/** The only version a strict writer accepts: "0.3". */
export const WRITE_VERSION: string;
/** Versions a reader accepts, newest first: "0.3" and "0.2". A "0.2" profile is read exactly as "0.3". */
export const READ_VERSIONS: readonly string[];
/**
 * Decode at most MAX_FILE_BYTES of strict UTF-8, preserving any initial BOM.
 * Throw for input that is not a Uint8Array, exceeds the byte limit or has malformed UTF-8.
 */
export function decodeBytes(bytes: Uint8Array): string;
/**
 * Return whether the string has YYYY-MM-DD syntax and a valid Gregorian month/day,
 * applying leap-year rules including year 0000.
 */
export function calendarDate(s: string): boolean;
/**
 * Clone the profile schema and replace encountered enums with string types, walking
 * only properties, $defs, items, allOf, anyOf and oneOf. Restore properties.visibility
 * by reference from the original schema so its enum stays strict, and replace
 * properties.humans with an enum of READ_VERSIONS.
 * Expect a structured-cloneable schema with properties and the supported keyword shapes;
 * this does not validate arbitrary schemas. Cloning and traversal errors propagate.
 */
export function readerSchema(schema: any): any;
/**
 * Return no profile, an empty withheld list and one error issue at path "$".
 * Use code as the issue message, defaulting to PROFILE_INVALID; do not validate the code.
 */
export function invalid(code?: string): any;
/**
 * Parse profile text or original UTF-8 bytes within MAX_FILE_BYTES, with frontmatter
 * and body bounded by MAX_FRONTMATTER_BYTES and MAX_BODY_BYTES respectively.
 * Expect opts with mode "read" or "write", and deps with the compatible yaml API,
 * profile schema, synchronous validate/validateRead predicates and withhold predicate.
 * These injected dependencies are trusted; their contracts are not checked here.
 * Write mode validates raw data; other modes shape recognized fields, map visibility
 * "public" to "anyone_with_file" in a "0.2" profile only, validate with
 * validateRead, then filter unknown enums and empty shaped collections, omitting an
 * object that loses a required member to that filtering. Both modes reject an
 * interrupting.quiet_hours whose from equals its to.
 * opts.kind === "me" forbids a body. opts.expectedId checks the id unless opts.draft
 * is set; draft requires write mode and adds DRAFT_FILENAME_UNCHECKED.
 * Return { profile, withheld, issues } on success; a truthy withhold(notes) marks notes
 * withheld with a warning but leaves them in profile. Parsing does not authorize disclosure.
 * Rejections return no profile: UNSUPPORTED_ARGUMENT for draft outside write mode,
 * UNSUPPORTED_VERSION for a string version other than WRITE_VERSION in write mode or
 * outside READ_VERSIONS in read mode, otherwise PROFILE_INVALID.
 * Exceptions inside the parsing body become PROFILE_INVALID; dependency destructuring
 * happens before that catch and can throw.
 */
export function parseCore(input: string | Uint8Array, opts: any, deps: any): any;
