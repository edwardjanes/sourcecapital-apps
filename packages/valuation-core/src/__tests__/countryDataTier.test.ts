import { describe, it, expect } from 'vitest';
import { getCountryDataTier, resolveCountryCode } from '../referenceData';
import { getDataQualityDisclaimer } from '../dataQualityDisclaimer';

// Ticket 1 of the 25 Sep valuation brief. The tier decides which of three
// disclaimers a founder's report carries, so a country landing in the wrong
// bucket either overstates confidence or needlessly undersells it.
//
// Every tier is asserted with inputs that MUST land in it, not only with
// inputs that must be rejected -- a resolver that returned 'illustrative' for
// everything would satisfy a negative-only test while making the feature
// pointless (same trap as the URL validator logged in CLAUDE.md, 23 Sep).
describe('getCountryDataTier', () => {
  it('treats Germany as validated, and only Germany', () => {
    expect(getCountryDataTier('Germany')).toBe('validated');
    expect(getCountryDataTier('DE')).toBe('validated');
  });

  it('treats the seven partially sourced countries as partial', () => {
    const partial = [
      'United States',
      'United Kingdom',
      'France',
      'Netherlands',
      'Ireland',
      'Sweden',
      'Switzerland',
    ];
    for (const name of partial) {
      expect(getCountryDataTier(name), `${name} should be partial`).toBe('partial');
    }
  });

  it('accepts ISO codes as well as full names', () => {
    for (const code of ['US', 'GB', 'FR', 'NL', 'IE', 'SE', 'CH']) {
      expect(getCountryDataTier(code), `${code} should be partial`).toBe('partial');
    }
  });

  it('treats every other supported country as illustrative', () => {
    // These are real entries in COUNTRIES, deliberately: the point is that a
    // country being supported does not make its benchmarks sourced.
    const illustrative = ['Spain', 'Italy', 'Japan', 'Canada', 'Brazil', 'Australia', 'Poland', 'India'];
    for (const name of illustrative) {
      expect(getCountryDataTier(name), `${name} should be illustrative`).toBe('illustrative');
    }
  });

  it('falls back to illustrative for unknown, empty and null country', () => {
    expect(getCountryDataTier('Atlantis')).toBe('illustrative');
    expect(getCountryDataTier('')).toBe('illustrative');
    expect(getCountryDataTier(null)).toBe('illustrative');
    expect(getCountryDataTier(undefined)).toBe('illustrative');
    // 'default' resolves to the default country bucket, which is illustrative.
    expect(resolveCountryCode('default')).toBe('default');
    expect(getCountryDataTier('default')).toBe('illustrative');
  });

  it('is case-insensitive, matching resolveCountryCode', () => {
    expect(getCountryDataTier('united kingdom')).toBe('partial');
    expect(getCountryDataTier('UNITED KINGDOM')).toBe('partial');
    expect(getCountryDataTier('germany')).toBe('validated');
  });
});

describe('getDataQualityDisclaimer', () => {
  it('returns distinct wording for all three tiers', () => {
    const bodies = (['validated', 'partial', 'illustrative'] as const).map(
      (t) => getDataQualityDisclaimer(t).body
    );
    expect(new Set(bodies).size).toBe(3);
  });

  it('never attributes the methodology to Equidam', () => {
    // The reference data's own header says it is "NOT Equidam's
    // proprietary/internal data"; only Germany was checked against a sample
    // report. Copy that says otherwise is the specific thing Ticket 1 exists
    // to stop, so it is asserted rather than left to review.
    for (const tier of ['validated', 'partial', 'illustrative'] as const) {
      const d = getDataQualityDisclaimer(tier);
      const text = `${d.label} ${d.summary} ${d.body} ${d.guidance ?? ''}`;
      expect(text.toLowerCase(), `${tier} disclaimer must not name Equidam`).not.toContain('equidam');
    }
  });

  it('carries the tier through and gives the illustrative tier the longest caveat', () => {
    for (const tier of ['validated', 'partial', 'illustrative'] as const) {
      expect(getDataQualityDisclaimer(tier).tier).toBe(tier);
    }
    const validated = getDataQualityDisclaimer('validated').body.length;
    const illustrative = getDataQualityDisclaimer('illustrative').body.length;
    expect(illustrative).toBeGreaterThan(validated);
  });

  it('offers guidance where something can be done, and not where it cannot', () => {
    expect(getDataQualityDisclaimer('validated').guidance).toBeNull();
    expect(getDataQualityDisclaimer('partial').guidance).toBeTruthy();
    expect(getDataQualityDisclaimer('illustrative').guidance).toBeTruthy();
  });
});
