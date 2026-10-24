// The one input type every E2 module takes. TheAngel builds it from its own
// tables (slice A3); the package does no I/O and reads nothing else.

import type { CompanyStage, UpdatedValuationParameters } from '../types';
import type { IntakeAnswers } from '../intake/fields';
import type { IntakeBalance, IntakeFinancials } from '../intake/mapIntakeToEngine';
import type { ListingStage } from '../intake/suggestStage';

/**
 * Where an input came from. `dataroom` means a figure taken from a CONFIRMED
 * financial-model parse; an unconfirmed parse is still `estimated`.
 */
export type InputSource = 'founder' | 'verified' | 'platform' | 'market' | 'estimated' | 'dataroom';

/**
 * Key of one financials grid cell in `ValuationContext.sources`:
 * `grid.<rowId>.<column>`, column 0 being the base (last actual) year.
 * Every other key is an intake field id.
 */
export type GridSourceKey = `grid.${string}.${number}`;
export const gridSourceKey = (rowId: string, column: number): GridSourceKey => `grid.${rowId}.${column}`;

/**
 * Plain facts the caller reads from its own database. All optional: a missing
 * fact is unknown, and every rule that needs one treats unknown as "does not
 * hold" rather than guessing.
 */
export interface ValuationFacts {
  /** A data-room document with category `financial_model` exists. */
  hasFinancialModel?: boolean;
  /** The listing's funding stage, the input suggestStage needs. */
  listingStage?: ListingStage | null;
  /** The listing's pre-money ask (or SAFE/note cap) in MINOR units of `opts.currency`, or null. */
  askPreMoney?: number | null;
  /** Days since the latest confirmed company update, or null when there is none. */
  lastUpdateAgeDays?: number | null;
  /** Every advisor on the listing team has a bio. */
  advisorsHaveBios?: boolean;
  /** A listing team member has a technical role (CTO, engineer, technical). */
  hasTechnicalTeamMember?: boolean;
  /** A strategic partner is named in a Timeline milestone or a data-room contract. */
  partnersNamed?: boolean;
  /** Traction carries a retention metric. */
  retentionMetricPresent?: boolean;
  /** Source of the customer-count traction metric, when one exists. */
  customersSource?: InputSource | null;
}

export interface ValuationOverride {
  /** Dotted path into UpdatedValuationParameters, e.g. `dcf_shared.discount_rate` or `method_weights.vc`. */
  parameter: string;
  value: number;
  source: 'advisor' | 'founder';
  reason: string;
}

export interface ValuationContext {
  answers: IntakeAnswers;
  /** Financials grid, base year first, as mapIntakeToEngine takes it. */
  financials: IntakeFinancials;
  balance: IntakeBalance;
  opts: { asOf: string; currency: string };
  /** Source per intake field id and per grid cell (see GridSourceKey). Absent means `founder`. */
  sources: Partial<Record<string, InputSource>>;
  /** What the founder (or reviewer) confirmed, as engine keys; null when not confirmed yet. */
  confirmed: { stageConfirmed: CompanyStage | null; industryConfirmed: string | null };
  facts: ValuationFacts;
  overrides: ValuationOverride[];
  /**
   * Replay: when set, these parameters are used exactly as stored (a run's
   * `parametersSnapshot.parameters`), instead of buildDefaultParameters plus
   * `overrides`. This is what lets an old run be recomputed to the cent.
   */
  replayParameters?: UpdatedValuationParameters;
}

/** Source of one input, `founder` when the caller supplied none. */
export function sourceOf(ctx: ValuationContext, key: string): InputSource {
  return ctx.sources[key] ?? 'founder';
}
