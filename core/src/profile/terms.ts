// Note serialization of SPEC § 6.3, as in spec/tools/lib.mjs. No word list decides whether a note is
// served (SPEC § 6.2): the reader does, in view.ts.

/**
 * JSON-quote note text without changing its decoded value: the only text form in which a note reaches
 * its owner's model. Callers still decide, from the trusted reader, whether the note is served at all.
 */
export const serializeNote = (text: string) =>
  JSON.stringify(text);
