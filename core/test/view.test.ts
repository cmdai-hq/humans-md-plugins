import { describe, expect, it } from 'vitest';
import { parseProfile, type Profile } from '../src/profile/parse.js';
import { serveOwner, serveTo, type ServeOptions } from '../src/profile/view.js';

const today = '2026-10-14';
const profile = parseProfile(`---
humans: "0.3"
id: sample
name: Example
updated: "2026-10-14"
visibility: private
reading: {length: short, max_words: 149}
interrupting: {interrupt_for: blocking_only, when_focused: urgent_only}
states: {incident: {length: minimal, max_words: 20}}
notes: I have ADHD.
---
`).profile!;

describe('serveTo rejects own selectors at the library boundary', () => {
  const untouchedProfile = new Proxy({} as Profile, {
    /**
     * Fail on any profile access, proving unsupported selectors are rejected before visibility or
     * projection reads.
     */
    get() { throw new Error('PROFILE_ACCESS_PAYLOAD'); } });
  for (const key of ['state', 'activeStates'] as const) {
    it.each([undefined, null, '', [], ['incident'], {}, false, 'SELECTOR_PAYLOAD'])(`rejects own ${key} = %j before any profile or option value`, value => {
      const options: ServeOptions & Partial<Record<typeof key, unknown>> = {
        /** Fail if an own-selector refusal evaluates the date first. */
        get today(): string { throw new Error('TODAY_ACCESS_PAYLOAD'); },
        /** Fail if an own-selector refusal evaluates owner authority first. */
        get owner(): boolean { throw new Error('OWNER_ACCESS_PAYLOAD'); },
        [key]: value,
      };
      expect(() => serveTo(untouchedProfile, options)).toThrowError(/^UNSUPPORTED_ARGUMENT$/);
    });
    it(`rejects a non-enumerable own ${key} without reading its getter`, () => {
      const options: ServeOptions = Object.defineProperty({ today }, key, {
        /** Fail if a forbidden non-enumerable selector is evaluated instead of rejected by presence. */
        get() { throw new Error('SELECTOR_ACCESS_PAYLOAD'); },
      });
      expect(() => serveTo(untouchedProfile, options)).toThrowError(/^UNSUPPORTED_ARGUMENT$/);
    });
    it(`rejects own ${key} on null-prototype options even when the profile is hidden`, () => {
      const options: ServeOptions = Object.assign(Object.create(null), { today, [key]: undefined });
      expect(() => serveTo(profile, options)).toThrowError(/^UNSUPPORTED_ARGUMENT$/);
    });
  }

  it('rejects a declared legacy selector passed through a structurally compatible options variable', () => {
    const legacyOptions = { today, owner: true, activeStates: ['incident'] };
    const options: ServeOptions = legacyOptions;
    expect(() => serveTo(profile, options)).toThrowError(/^UNSUPPORTED_ARGUMENT$/);
  });

  it('keeps clean owner calls, voluntary notes and base preferences; variants stay inactive', () => {
    expect(profile).toBeDefined();
    expect(serveTo(profile, { today, owner: true })).toEqual({
      status: 'found',
      profile: {
        id: 'sample', updated: today, stale: false, withheld: [],
        reading: { length: 'short', max_words: 149 },
        interrupting: { interrupt_for: 'blocking_only' }, notes: 'I have ADHD.',
      },
    });
    expect(serveTo(profile, { today, audience: 'owner' })).toEqual(serveTo(profile, { today, owner: true }));
    expect(serveTo(profile, { today, audience: 'public' })).toEqual({ status: 'none' });
    expect(serveTo(profile, { today })).toEqual({ status: 'none' });
  });

  it('projects quiet hours as closed members, without an empty all_day, under the profile visibility', () => {
    const quiet = parseProfile(`---\nhumans: "0.3"\nid: sample\nname: Example\nupdated: "2026-10-14"\nvisibility: anyone_with_file\ninterrupting: {quiet_hours: {time_zone: UTC, from: "22:00", to: "07:00", all_day: []}}\nstates: {focus: {interrupt_for: blocking_only}}\n---\n`, { mode: 'write' }).profile!;
    expect(quiet.interrupting?.quiet_hours?.all_day).toEqual([]);
    for (const audience of ['none', 'public', 'org'] as const) {
      expect(serveTo(quiet, { today, audience }).profile?.interrupting).toEqual({ quiet_hours: { time_zone: 'UTC', from: '22:00', to: '07:00' } });
    }
    expect(serveTo({ ...quiet, visibility: 'private' }, { today, audience: 'org' })).toEqual({ status: 'none' });
  });

  it('ignores inherited selectors without reading them or activating variants', () => {
    const inherited = {
      /** Fail on inherited state access; inherited selectors must remain ignored and variants inactive. */
      get state() { throw new Error('INHERITED_STATE_PAYLOAD'); },
      /** Fail on inherited activation access; own-property checks must not evaluate this getter. */
      get activeStates() { throw new Error('INHERITED_STATES_PAYLOAD'); },
    };
    const options: ServeOptions = Object.assign(Object.create(inherited), { today, owner: true });
    expect(serveTo(profile, options)).toEqual(serveTo(profile, { today, owner: true }));
  });
});

describe('serveOwner, the single-person CLI projection', () => {
  it('equals the owner audience of serveTo under every visibility, notes withheld included', () => {
    for (const visibility of ['private', 'org', 'anyone_with_file', undefined] as const) {
      const p = { ...profile, visibility };
      expect(serveOwner(p, { today })).toEqual(serveTo(p, { today, audience: 'owner' }));
      expect(serveOwner(p, { today, withheld: ['notes'] })).toEqual(serveTo(p, { today, audience: 'owner', withheld: ['notes'] }));
    }
  });
  it('rejects own selectors too', () => {
    expect(() => serveOwner(profile, { today, activeStates: ['incident'] } as ServeOptions)).toThrowError(/^UNSUPPORTED_ARGUMENT$/);
    expect(() => serveOwner(profile, { today, state: undefined } as ServeOptions)).toThrowError(/^UNSUPPORTED_ARGUMENT$/);
  });
});
