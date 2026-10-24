import { describe, it, expect } from 'vitest';
import { getCurrencyForCountry, resolveCountryCode } from '../referenceData';

describe('getCurrencyForCountry', () => {
  // The wizard and the Raise HQ portal both send the country's display name.
  // The lookup used to index by ISO code only, so every report came out USD.
  it('resolves display names, as the wizards send them', () => {
    expect(getCurrencyForCountry('United Kingdom')).toBe('GBP');
    expect(getCurrencyForCountry('Germany')).toBe('EUR');
    expect(getCurrencyForCountry('Ireland')).toBe('EUR');
    expect(getCurrencyForCountry('Sweden')).toBe('SEK');
    expect(getCurrencyForCountry('Switzerland')).toBe('CHF');
    expect(getCurrencyForCountry('Poland')).toBe('PLN');
    expect(getCurrencyForCountry('United States')).toBe('USD');
    expect(getCurrencyForCountry('United Arab Emirates')).toBe('USD');
  });

  it('is case/whitespace-insensitive and accepts ISO codes', () => {
    expect(getCurrencyForCountry('  united kingdom ')).toBe('GBP');
    expect(getCurrencyForCountry('GB')).toBe('GBP');
    expect(getCurrencyForCountry('fr')).toBe('EUR');
  });

  it('falls back to USD for unknown or missing countries', () => {
    expect(getCurrencyForCountry('Atlantis')).toBe('USD');
    expect(getCurrencyForCountry('')).toBe('USD');
    expect(getCurrencyForCountry(null)).toBe('USD');
    expect(getCurrencyForCountry(undefined)).toBe('USD');
  });
});

describe('resolveCountryCode', () => {
  it('maps names and codes to the same key the benchmarks use', () => {
    expect(resolveCountryCode('United Kingdom')).toBe('GB');
    expect(resolveCountryCode('uk')).toBe('GB');
    expect(resolveCountryCode('GB')).toBe('GB');
    expect(resolveCountryCode('Nowhere')).toBe('default');
    expect(resolveCountryCode('default')).toBe('default');
  });
});
