import type { CompanyStage } from '../types';

export type ListingStage = 'pre_seed' | 'seed' | 'seed_plus' | 'series_a';
export type ProductRollout = 'Planning' | 'Prototype' | 'MVP' | 'Market';

/** "Over $5m": revenue strictly above this, in the run's reporting currency (no FX conversion). */
export const GROWTH_REVENUE_THRESHOLD = 5_000_000;

/**
 * Suggests the engine's company stage from the listing, for the founder to
 * confirm in the intake. Rules from the development spec, section 7, applied in
 * this order (first match wins):
 *
 * 1. Roll-out `Planning` and no revenue (0 or less) -> `idea`.
 * 2. Positive EBITDA (above 0) and revenue over $5m -> `growth`, whatever the listing stage.
 * 3. Listing stage `series_a` -> `expansion`.
 * 4. Revenue above 0 (pre_seed, seed or seed_plus) -> `startup`.
 * 5. No revenue -> `development`. The spec states this for pre_seed only; seed
 *    and seed_plus with no revenue fall here too, as the closest stage.
 *
 * Never returns `maturity`. A null EBITDA is unknown and never qualifies for `growth`.
 */
export function suggestStage(input: {
  listingStage: ListingStage;
  lastActualRevenue: number;
  lastActualEbitda: number | null;
  productRollout: ProductRollout;
}): CompanyStage {
  const { listingStage, lastActualRevenue, lastActualEbitda, productRollout } = input;
  const hasRevenue = lastActualRevenue > 0;

  if (productRollout === 'Planning' && !hasRevenue) return 'idea';
  if (lastActualEbitda !== null && lastActualEbitda > 0 && lastActualRevenue > GROWTH_REVENUE_THRESHOLD) return 'growth';
  if (listingStage === 'series_a') return 'expansion';
  if (hasRevenue) return 'startup';
  return 'development';
}
