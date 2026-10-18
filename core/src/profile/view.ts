// Deterministic projection of a parsed profile. Authorization is trusted caller context.
import type { Profile, QuietHours } from './parse.js';
import { agentWord } from './terms.js';
import { CONTEXT_STALE_AFTER_DAYS, STALE_AFTER_DAYS } from './schema.js';
export interface ServedProfile {
  id: string;
  updated: string;
  stale: boolean;
  languages?: string[];
  reading?: Profile['reading'];
  deciding?: Profile['deciding'];
  interrupting?: Profile['interrupting'];
  context?: { role?: string; knows_well?: string[]; knows_little?: string[]; decides?: string[]; stale: boolean };
  avoid?: string[];
  notes?: string;
  withheld: string[];
}
export type ServeStatus = 'found' | 'stale' | 'none';
export interface ServeOptions {
  today: string;
  audience?: 'owner' | 'org' | 'public' | 'none';
  contextExtension?: boolean;
  withheld?: string[];
  /** Local owner selection only; remote APIs must derive authority themselves. */
  owner?: boolean;
  /** Legacy display names are never projected. */
  displayName?: string;
}
/**
 * Apply visibility to a parsed profile using trusted caller authority; omitted visibility means org.
 * `anyone_with_file` is served to any reader who has the file: the consumer checks nothing (SPEC § 6.1).
 * The `public` audience is an unauthenticated reader, not a visibility value.
 */
export function visibleTo(p: Profile, audience: ServeOptions['audience'] = 'none'): boolean {
  return audience === 'owner' || p.visibility === 'anyone_with_file' || (audience === 'org' && p.visibility !== 'private');
}
/** Copy quiet hours as closed members only, dropping an empty all_day list (SPEC §§ 3.5, 6.1). */
function quietHours(q: QuietHours): QuietHours {
  const out: QuietHours = { time_zone: q.time_zone, from: q.from, to: q.to };
  if (q.all_day?.length) out.all_day = [...q.all_day];
  return out;
}
/**
 * Project a validated profile for a trusted audience without mutating the source.
 * Hidden profiles yield absence; identity prose and dormant fields are omitted.
 * Voluntary notes remain exact unless lexically withheld, which is disclosed.
 * Own state/activeStates options throw UNSUPPORTED_ARGUMENT even when undefined.
 */
export function serveTo(p: Profile, opts: ServeOptions): { status: ServeStatus; profile?: ServedProfile } {
  if (Object.hasOwn(opts, 'state') || Object.hasOwn(opts, 'activeStates')) {
    throw new Error('UNSUPPORTED_ARGUMENT');
  }
  if (!visibleTo(p, opts.owner ? 'owner' : opts.audience)) return { status: 'none' };
  return serveOwner(p, opts);
}

/**
 * Project a validated profile for its owner: visibility always admits the owner, so no audience is
 * read. Only for the owner's explicit local selection (the single-person CLI); every other reader
 * goes through serveTo. Own state/activeStates options throw UNSUPPORTED_ARGUMENT.
 */
export function serveOwner(p: Profile, opts: Pick<ServeOptions, 'today' | 'withheld' | 'contextExtension'>): { status: ServeStatus; profile?: ServedProfile } {
  if (Object.hasOwn(opts, 'state') || Object.hasOwn(opts, 'activeStates')) {
    throw new Error('UNSUPPORTED_ARGUMENT');
  }
  const withheld = opts.withheld?.includes('notes') || (p.notes && agentWord(p.notes)) ? ['notes'] : [];
  const out: ServedProfile = { id: p.id, updated: p.updated, stale: daysBetween(p.updated, opts.today) > STALE_AFTER_DAYS, withheld };
  for (const key of ['languages', 'avoid'] as const) if (p[key]?.length) out[key] = [...p[key]!];
  for (const key of ['reading', 'deciding', 'interrupting'] as const) {
    const block = Object.fromEntries(Object.entries(p[key] ?? {}).filter(([k,v]) => k !== 'when_focused' && (!Array.isArray(v) || v.length))
      .map(([k, v]) => [k, k === 'quiet_hours' ? quietHours(v as QuietHours) : v]));
    if (Object.keys(block).length) Object.assign(out, { [key]: structuredClone(block) });
  }
  const c = p.context;
  if (c && opts.contextExtension !== false) {
    const fields = Object.fromEntries(['role','knows_well','knows_little','decides'].flatMap(k => {
      const v = c[k as keyof typeof c];
      return v !== undefined && (!Array.isArray(v) || v.length) ? [[k, structuredClone(v)]] : [];
    }));
    if (Object.keys(fields).length) out.context = { ...fields, stale: daysBetween(c.context_updated ?? p.updated, opts.today) > CONTEXT_STALE_AFTER_DAYS };
  }
  if (p.notes && !withheld.length) out.notes = p.notes;
  return { status: out.stale ? 'stale' : 'found', profile: out };
}
/**
 * Return signed whole UTC days between validated YYYY-MM-DD dates for staleness checks; unparseable dates
 * yield NaN, so this helper does not validate calendar dates.
 */
export function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
