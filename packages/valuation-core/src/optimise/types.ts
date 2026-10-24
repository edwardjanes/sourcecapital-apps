import type { ValuationReportOutput } from '../types';
import type { CheckResult } from '../checks/evaluateChecks';
import type { ValuationContext } from '../angel/context';

export const OPTIMISE_RULESET_VERSION = 'angel-optimise-v1';

export type ActionKind = 'fix' | 'prove' | 'build' | 'present';
export type ActionEffort = 'S' | 'M' | 'L';
export type ActionTimeBand = 'under_2_weeks' | '1_to_3_months' | 'longer';
export type ActionEffectKind = 'value' | 'quality';

/** One Scorecard or Checklist criterion a rule acts on. */
export type FactorRef =
  | { method: 'scorecard'; criterion: 'team' | 'opportunity' | 'competitive_env' | 'product_ip' | 'partnerships' | 'funding_required' | 'other' }
  | { method: 'checklist'; criterion: 'team' | 'idea' | 'product_ip' | 'relationships' | 'operating_stage' };

/** The closed list of evidence kinds TheAngel knows how to evaluate. */
export const EVIDENCE_KINDS = [
  'stage_confirmed',
  'balance_sheet_balances',
  'cash_never_negative',
  'use_of_funds_totals',
  'model_or_revised_forecast',
  'data_room_file',
  'traction_verified',
  'rollout_and_paying_customers',
  'listing_team_member',
  'partner_named',
  'traction_metric',
  'field_changed',
  'listing_team_bios',
  'competitors_entered',
  'update_metric',
  'cap_table_investor',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/**
 * What proves the action was done. A descriptor only: TheAngel evaluates it
 * against its own tables. `params` narrows it (a file category, a role, a field id).
 */
export interface EvidenceRule {
  kind: EvidenceKind;
  params?: Record<string, string | number>;
  /** The proof in plain words, for reviewers. */
  description: string;
}

export interface ActionRule {
  code: string;
  kind: ActionKind;
  effort: ActionEffort;
  timeBand: ActionTimeBand;
  factors: FactorRef[];
  /** The blocking check this rule clears, if any. */
  fixesCheck?: string;
  applies(ctx: ValuationContext, report: ValuationReportOutput, checks: CheckResult[]): boolean;
  /** Pure: returns a changed copy. Rules whose effect is quality only return the context unchanged. */
  counterfactual(ctx: ValuationContext): ValuationContext;
  evidence: EvidenceRule;
  effectKind: ActionEffectKind;
  copy: { title: string; why: string; proof: string };
}

export interface ActionItem {
  code: string;
  kind: ActionKind;
  effort: ActionEffort;
  timeBand: ActionTimeBand;
  title: string;
  why: string;
  proof: string;
  effectKind: ActionEffectKind;
  /** Change in the point value if this action alone were done. Null for quality effects, and in benchmark_only. */
  estimatedDeltaPoint: number | null;
  /** Sum of the rule's factors' headroom: the most those criteria can still add. Null in benchmark_only. */
  headroomUpTo: number | null;
  evidence: EvidenceRule;
  /** True when this action clears a blocking check that is failing. */
  appliesToBlocking: boolean;
}

export const EFFORT_POINTS: Record<ActionEffort, number> = { S: 1, M: 3, L: 8 };
export const TIME_BAND_ORDER: Record<ActionTimeBand, number> = { under_2_weeks: 0, '1_to_3_months': 1, longer: 2 };
